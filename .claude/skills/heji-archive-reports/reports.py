#!/usr/bin/env python3
"""Archive review sites from reports/ into reports/archive/ and prove they still work.

  .claude/skills/heji-archive-reports/reports.py                      # list active + archived, oldest first
  .claude/skills/heji-archive-reports/reports.py archive <slug>...    # move to reports/archive/<slug>
  .claude/skills/heji-archive-reports/reports.py archive --older-than 7
  .claude/skills/heji-archive-reports/reports.py restore <slug>...    # move back to reports/<slug>
  .claude/skills/heji-archive-reports/reports.py check [<slug>...]    # verify (default: every report)

Moving a report rewrites `reports/<slug>` to `reports/archive/<slug>` (or back) in every report,
in tracked repo files and in this repo's Claude memory, restarts its server if one was running,
then serves the moved copy and fetches every local file its pages reference. Nothing is staged
or committed: the caller commits (git sees the moves as renames).
"""

import argparse
import html.parser
import os
import re
import signal
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(subprocess.check_output(
    ["git", "-C", str(Path(__file__).resolve().parent), "rev-parse", "--show-toplevel"], text=True).strip())
REPORTS = ROOT / "reports"
ARCHIVE = REPORTS / "archive"
MEMORY = Path.home() / ".claude" / "projects" / re.sub(r"[^A-Za-z0-9]", "-", str(ROOT)) / "memory"
TEXT = {".html", ".htm", ".js", ".mjs", ".css", ".sh", ".md", ".json", ".txt", ".py", ".svg", ".yml", ".yaml"}


def reports_in(base):
    if not base.is_dir():
        return []
    return sorted(d for d in base.iterdir() if d.is_dir() and d != ARCHIVE and not d.name.startswith("."))


def find(slug):
    for base in (REPORTS, ARCHIVE):
        if (base / slug).is_dir():
            return base / slug
    sys.exit(f"no report named {slug} in reports/ or reports/archive/")


def last_change(d):
    """Newest of the last commit touching it and, when it has uncommitted changes, its newest file."""
    rel = str(d.relative_to(ROOT))
    committed = subprocess.run(["git", "-C", str(ROOT), "log", "-1", "--format=%ct", "--", rel],
                               capture_output=True, text=True).stdout.strip()
    dirty = subprocess.run(["git", "-C", str(ROOT), "status", "--porcelain", "--", rel],
                           capture_output=True, text=True).stdout.strip()
    times = [int(committed)] if committed else []
    if dirty or not committed:
        times += [f.stat().st_mtime for f in d.rglob("*") if f.is_file()]
    return max(times) if times else 0


def cmd_list(_args):
    now = time.time()
    for title, base in (("reports/", REPORTS), ("reports/archive/", ARCHIVE)):
        rows = sorted(((last_change(d), d) for d in reports_in(base)), key=lambda r: r[0])
        print(f"{title} ({len(rows)})")
        for t, d in rows:
            print(f"  {(now - t) / 86400:5.1f} days  {time.strftime('%Y-%m-%d', time.localtime(t))}  {d.name}")


# ---------- references inside a report ----------

class Refs(html.parser.HTMLParser):
    ATTRS = {"src", "href", "poster", "data", "action"}

    def __init__(self):
        super().__init__()
        self.refs = []

    def handle_starttag(self, tag, attrs):
        for k, v in attrs:
            if not v:
                continue
            if k in self.ATTRS:
                self.refs.append(v)
            elif k == "srcset":
                self.refs += [part.strip().split(" ")[0] for part in v.split(",") if part.strip()]
            elif k == "style":
                self.refs += re.findall(r"url\(\s*['\"]?([^'\")]+)", v)


def local(ref):
    ref = ref.strip()
    if not ref or ref.startswith(("#", "data:", "mailto:", "tel:", "javascript:", "blob:", "about:")) or "${" in ref:
        return None
    u = urllib.parse.urlsplit(ref)
    if u.scheme or u.netloc:
        return None
    return urllib.parse.unquote(u.path) or None


def site_of(report):
    return report / "site" if (report / "site").is_dir() else report


def collect(report):
    """(url path relative to the served root, file it came from) for every local reference."""
    site = site_of(report)
    out = []
    for f in sorted(site.rglob("*")):
        if f.suffix in (".html", ".htm"):
            p = Refs()
            p.feed(f.read_text(errors="replace"))
            p.feed("")
            raw = p.refs + re.findall(r"url\(\s*['\"]?([^'\")]+)", f.read_text(errors="replace"))
        elif f.suffix == ".css":
            raw = re.findall(r"url\(\s*['\"]?([^'\")]+)", f.read_text(errors="replace")) + \
                re.findall(r"@import\s+['\"]([^'\"]+)", f.read_text(errors="replace"))
        else:
            continue
        for r in raw:
            path = local(r)
            if path is None:
                continue
            target = (site / path.lstrip("/")) if path.startswith("/") else (f.parent / path)
            out.append((os.path.normpath(target), f))
    return site, out


def problems_before_move(report):
    """Things that would break (or already point somewhere fixed) once the folder moves."""
    bad = []
    site, refs = collect(report)
    for target, src in refs:
        if not target.startswith(str(report) + os.sep):
            bad.append(f"{src.relative_to(ROOT)}: link leaves the report folder -> {target}")
    for f in report.rglob("*"):
        if f.is_file() and f.suffix in TEXT:
            for m in re.finditer(r"file://|" + re.escape(str(ROOT)), f.read_text(errors="replace")):
                bad.append(f"{f.relative_to(ROOT)}: absolute local path ({m.group(0)})")
    for f in report.rglob("*"):
        if f.is_symlink() and not os.path.realpath(f).startswith(str(report) + os.sep):
            bad.append(f"{f.relative_to(ROOT)}: symlink out of the report -> {os.readlink(f)}")
    return bad


# ---------- serving ----------

def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def start_server(report, port):
    env = dict(os.environ, NO_OPEN="1")
    serve = report / "script" / "serve.sh"
    if serve.is_file():
        cmd = ["bash", str(serve), str(port)]
    else:
        cmd = [sys.executable, "-m", "http.server", str(port), "--bind", "127.0.0.1", "--directory", str(site_of(report))]
    proc = subprocess.Popen(cmd, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    for _ in range(50):
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.2):
                return proc
        except OSError:
            if proc.poll() is not None:
                break
            time.sleep(0.1)
    stop(proc)
    return None


def stop(proc):
    try:
        os.killpg(proc.pid, signal.SIGTERM)
    except ProcessLookupError:
        pass
    proc.wait(timeout=5)


def fetch(url):
    try:
        with urllib.request.urlopen(url, timeout=5) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except OSError as e:
        return str(e)


def check(report):
    """Serve the report from where it is now and fetch its index and every local reference."""
    site, refs = collect(report)
    errors = []
    port = free_port()
    proc = start_server(report, port)
    if proc is None:
        return [f"{report.name}: server did not start"]
    try:
        base = f"http://127.0.0.1:{port}/"
        status = fetch(base)
        if status != 200:
            errors.append(f"{report.name}: GET / -> {status}")
        seen = set()
        for target, src in refs:
            if not target.startswith(str(site) + os.sep) and target != str(site):
                errors.append(f"{src.relative_to(ROOT)}: outside the served folder -> {target}")
                continue
            rel = os.path.relpath(target, site).replace(os.sep, "/")
            if rel in seen:
                continue
            seen.add(rel)
            status = fetch(base + urllib.parse.quote(rel))
            if status != 200:
                errors.append(f"{src.relative_to(ROOT)}: {rel} -> {status}")
    finally:
        stop(proc)
    print(f"  {'ok ' if not errors else 'BAD'} {report.relative_to(ROOT)}  ({len(seen)} files fetched)")
    return errors


def cmd_check(args):
    targets = [find(s) for s in args.slugs] or reports_in(REPORTS) + reports_in(ARCHIVE)
    errors = []
    for r in targets:
        errors += check(r)
    for e in errors:
        print("   ", e)
    sys.exit(1 if errors else 0)


# ---------- moving ----------

def running_servers(report):
    """(pid, port) of servers already serving this report's folder (serve.sh or by hand)."""
    out = subprocess.run(["ps", "-axo", "pid=,command="], capture_output=True, text=True).stdout
    found = []
    for line in out.splitlines():
        pid, _, command = line.strip().partition(" ")
        if str(report) + "/" not in command + "/" or ("http.server" not in command and "http-server" not in command):
            continue
        m = re.search(r"http\.server\s+(\d+)", command) or re.search(r"-p\s+(\d+)", command)
        found.append((int(pid), int(m.group(1)) if m else None))
    return found


def rewrite_paths(old, new):
    """`reports/<old>` -> `reports/<new>` wherever a report path is written (not projects/*/reports/)."""
    pattern = re.compile(r"(?<![\w/.-])(\./)?" + re.escape(old) + r"(?![\w-])")
    files = [f for f in REPORTS.rglob("*") if f.is_file() and f.suffix in TEXT]
    tracked = subprocess.run(["git", "-C", str(ROOT), "grep", "-lF", old, "--", ".", ":!reports"],
                             capture_output=True, text=True).stdout.split()
    files += [ROOT / t for t in tracked]
    if MEMORY.is_dir():
        files += sorted(MEMORY.glob("*.md"))
    changed = []
    for f in files:
        text = f.read_text(errors="surrogateescape")
        updated = pattern.sub(lambda m: (m.group(1) or "") + new, text)
        if updated != text:
            f.write_text(updated, errors="surrogateescape")
            changed.append(f)
    return changed


def move(slug, src_base, dst_base):
    src, dst = src_base / slug, dst_base / slug
    if not src.is_dir():
        sys.exit(f"{src.relative_to(ROOT)} doesn't exist")
    if dst.exists():
        sys.exit(f"{dst.relative_to(ROOT)} already exists; pick one to keep first")
    bad = problems_before_move(src)
    if bad:
        print(f"!! {slug} would break if moved; fix these first (make them relative and inside the report):")
        print("\n".join("   " + b for b in bad))
        sys.exit(1)

    servers = running_servers(src)
    for pid, _ in servers:
        os.kill(pid, signal.SIGTERM)
    dst_base.mkdir(parents=True, exist_ok=True)
    src.rename(dst)
    changed = rewrite_paths(str(src.relative_to(ROOT)), str(dst.relative_to(ROOT)))
    print(f"==> {src.relative_to(ROOT)} -> {dst.relative_to(ROOT)}")
    for f in changed:
        where = f.relative_to(ROOT) if ROOT in f.parents else f
        print(f"    updated path in {where}")

    for _, port in servers:
        if port and start_server(dst, port):
            print(f"    restarted its server on http://localhost:{port}/")
        else:
            print(f"    !! a server for it was stopped; start it again with {dst.relative_to(ROOT)}/script/serve.sh")
    return dst


def cmd_archive(args):
    slugs = list(args.slugs)
    if args.older_than is not None:
        cutoff = time.time() - args.older_than * 86400
        slugs += [d.name for d in reports_in(REPORTS) if last_change(d) < cutoff and d.name not in slugs]
    if not slugs:
        sys.exit("nothing to archive: name reports or pass --older-than <days> (list: run with no arguments)")
    moved = [move(s, REPORTS, ARCHIVE) for s in slugs]
    verify(moved)


def cmd_restore(args):
    verify([move(s, ARCHIVE, REPORTS) for s in args.slugs])


def verify(reports):
    print("==> serving each moved report and fetching every file its pages reference")
    errors = []
    for r in reports:
        errors += check(r)
    for e in errors:
        print("   ", e)
    sys.exit(1 if errors else 0)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd")
    a = sub.add_parser("archive")
    a.add_argument("slugs", nargs="*")
    a.add_argument("--older-than", type=float, metavar="DAYS")
    r = sub.add_parser("restore")
    r.add_argument("slugs", nargs="+")
    c = sub.add_parser("check")
    c.add_argument("slugs", nargs="*")
    args = ap.parse_args()
    {"archive": cmd_archive, "restore": cmd_restore, "check": cmd_check}.get(args.cmd, cmd_list)(args)


if __name__ == "__main__":
    main()
