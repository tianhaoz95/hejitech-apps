#!/usr/bin/env python3
"""Scores Voxbrief's Stage 2 prompts on the bundled on-device model (Qwen3-0.6B-4bit, "Lite").

Reads the prompts the app itself built (`prompts.json`, exported by the macOS test
`LLMPromptExportTests`) and the expectations in `cases.json`, runs each case like
`OnDeviceLLMService` does (system + user chat, `enable_thinking: false`, temperature 0.3,
1024 tokens; 24 for template classification) and writes a JSON result plus a Markdown report.
Each case runs `--samples` times with fixed seeds, so a run is reproducible and a pass rate,
not a single lucky sample, is what gets compared. See README.md.
"""

import argparse
import json
import re
import sys
import time
from pathlib import Path

from checks import extract_json, score_output

GENERATION_MAX_TOKENS = 1024
TEMPERATURE = 0.3


class Runner:
    def __init__(self, model_path, temperature, top_p):
        import mlx.core as mx
        from mlx_lm import generate, load
        from mlx_lm.sample_utils import make_sampler

        self.mx, self.generate_fn = mx, generate
        self.model, self.tokenizer = load(model_path)
        self.sampler = make_sampler(temp=temperature, top_p=top_p)

    def __call__(self, system, user, max_tokens, seed):
        self.mx.random.seed(seed)
        prompt = self.tokenizer.apply_chat_template(
            [{"role": "system", "content": system}, {"role": "user", "content": user}],
            add_generation_prompt=True,
            tokenize=False,
            enable_thinking=False,
        )
        return self.generate_fn(self.model, self.tokenizer, prompt=prompt, max_tokens=max_tokens,
                                sampler=self.sampler, verbose=False)


def resolve_template(raw, candidates, fallback):
    """Same rule as LLMCopywriterService.resolveTemplate."""
    parsed = extract_json(raw) or {}
    name = parsed.get("template")
    if isinstance(name, str):
        for candidate in candidates:
            if candidate.lower() == name.strip().lower():
                return candidate
    return fallback


def run_sample(runner, prompts, seed):
    """Returns (template or None, raw generation, raw classification or None)."""
    if prompts["mode"] == "light":
        light = prompts["light"]
        return None, runner(light["system"], light["user"], GENERATION_MAX_TOKENS, seed), None
    generation = prompts["generation"]
    classification_raw = None
    if "classification" in prompts:
        c = prompts["classification"]
        classification_raw = runner(c["system"], c["user"], c["maxTokens"], seed)
        template = resolve_template(classification_raw, list(generation), prompts["fallbackTemplate"])
    else:
        template = next(iter(generation))
    g = generation[template]
    return template, runner(g["system"], g["user"], GENERATION_MAX_TOKENS, seed), classification_raw


def score(case, prompts, template, raw):
    """List of (check, passed, detail); the checks live in checks.py."""
    field_keys = [] if case["mode"] == "light" else prompts["generation"][template]["fieldKeys"]
    return score_output(raw, case["mode"], field_keys, case.get("expect", {}), template)


def pct(passed, total):
    return f"{100 * passed / total:.0f}%" if total else "n/a"


def summarize(results):
    categories = {}
    for r in results:
        for s in r["samples"]:
            entry = categories.setdefault(r["category"], [0, 0])
            entry[0] += s["passed"]
            entry[1] += 1
    # Per check kind across cases: "has 'Voxbrief'" and "has 'Supabase'" both count as "has term".
    checks = {}
    for r in results:
        for s in r["samples"]:
            for c in s["checks"]:
                kind = re.sub(r"'[^']*'", "term", c["check"])
                kind = re.sub(r"^(?!title)\w+(?=(>=|<=| not empty))", "field", kind)
                entry = checks.setdefault(kind, [0, 0])
                entry[0] += c["passed"]
                entry[1] += 1
    total = [sum(v[0] for v in categories.values()), sum(v[1] for v in categories.values())]
    return {"categories": {k: {"passed": v[0], "total": v[1]} for k, v in sorted(categories.items())},
            "checks": {k: {"passed": v[0], "total": v[1]} for k, v in checks.items()},
            "overall": {"passed": total[0], "total": total[1]}}


def render_report(meta, summary, results, baseline):
    lines = [f"## Voxbrief Stage 2 LLM eval: {meta['model']}", "",
             f"{meta['cases']} cases × {meta['samples']} samples, temperature {meta['temperature']}, "
             f"top_p {meta['top_p']}, "
             f"{meta['seconds']:.0f}s. A sample passes when every check on it passes.", "",
             "| Category | Pass rate | Samples | vs baseline |", "|---|---|---|---|"]
    rows = list(summary["categories"].items()) + [("**overall**", summary["overall"])]
    for name, v in rows:
        key = name.strip("*")
        base = baseline.get("overall") if key == "overall" else baseline.get("categories", {}).get(key)
        delta = ""
        if base and base["total"] and v["total"]:
            diff = 100 * v["passed"] / v["total"] - 100 * base["passed"] / base["total"]
            delta = f"{diff:+.0f} pts"
        lines.append(f"| {name} | {pct(v['passed'], v['total'])} | {v['passed']}/{v['total']} | {delta} |")

    lines += ["", "| Check | Pass rate | Samples |", "|---|---|---|"]
    for name, v in summary["checks"].items():
        lines.append(f"| {name} | {pct(v['passed'], v['total'])} | {v['passed']}/{v['total']} |")

    lines += ["", "| Case | Passed | Failing checks |", "|---|---|---|"]
    for r in results:
        passed = sum(s["passed"] for s in r["samples"])
        failing = sorted({c["check"] for s in r["samples"] for c in s["checks"] if not c["passed"]})
        lines.append(f"| `{r['id']}` | {passed}/{len(r['samples'])} | {', '.join(failing)} |")

    failures = [(r, s) for r in results for s in r["samples"] if not s["passed"]]
    if failures:
        lines += ["", "<details><summary>Failing outputs</summary>", ""]
        for r, s in failures:
            details = "; ".join(f"{c['check']}{(': ' + c['detail']) if c['detail'] else ''}"
                                for c in s["checks"] if not c["passed"])
            output = s["output"].strip().replace("```", "'''")
            lines += [f"**{r['id']}** (seed {s['seed']}{', ' + s['template'] if s['template'] else ''}): {details}",
                      "", "```", output[:1500], "```", ""]
        lines.append("</details>")
    return "\n".join(lines) + "\n"


def write_outputs(args, meta, results):
    summary = summarize(results)
    baseline = json.loads(args.baseline.read_text()) if args.baseline.exists() else {}
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps({"meta": meta, "summary": summary, "results": results}, indent=2) + "\n")
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(render_report(meta, summary, results, baseline))
    overall = summary["overall"]
    rate = 100 * overall["passed"] / overall["total"] if overall["total"] else 0
    print(f"overall {overall['passed']}/{overall['total']} ({rate:.0f}%), report: {args.report}")
    if args.min_overall is not None and rate < args.min_overall:
        sys.exit(f"overall pass rate {rate:.0f}% is below --min-overall {args.min_overall:.0f}%")


def merge(args):
    """Combines shard results (--merge a.json b.json ...) into one result and report, in
    cases.json order."""
    parts = [json.loads(Path(p).read_text()) for p in args.merge]
    order = {c["id"]: i for i, c in enumerate(json.loads(args.cases.read_text()))}
    results = sorted((r for part in parts for r in part["results"]), key=lambda r: order.get(r["id"], len(order)))
    meta = dict(parts[0]["meta"], cases=len(results), seconds=max(p["meta"]["seconds"] for p in parts),
                shards=len(parts))
    write_outputs(args, meta, results)


def main():
    here = Path(__file__).resolve().parent
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--prompts", type=Path, help="prompts.json from LLMPromptExportTests")
    parser.add_argument("--cases", default=here / "cases.json", type=Path)
    parser.add_argument("--model", default="mlx-community/Qwen3-0.6B-4bit", help="Hugging Face id or local path")
    parser.add_argument("--samples", default=3, type=int)
    parser.add_argument("--only", help="regex of case ids to run")
    parser.add_argument("--shard", help="run every n-th case only, as k/n (k from 1), e.g. 2/4")
    parser.add_argument("--merge", nargs="+", help="combine shard results.json files instead of running")
    parser.add_argument("--baseline", default=here / "baseline.json", type=Path)
    parser.add_argument("--out", default=here / "out" / "results.json", type=Path)
    parser.add_argument("--report", default=here / "out" / "report.md", type=Path)
    parser.add_argument("--temperature", default=TEMPERATURE, type=float, help="the app uses 0.3")
    parser.add_argument("--top-p", default=1.0, type=float, help="the app uses 1.0 (off)")
    parser.add_argument("--min-overall", type=float, help="exit 1 below this overall pass rate (0-100)")
    args = parser.parse_args()
    if args.merge:
        return merge(args)
    if not args.prompts:
        parser.error("--prompts is required unless --merge is given")

    cases = json.loads(args.cases.read_text())
    prompts = {p["id"]: p for p in json.loads(args.prompts.read_text())["cases"]}
    stale = [c["id"] for c in cases if c["id"] not in prompts]
    if stale:
        sys.exit(f"prompts.json is missing {stale}: re-export it after changing cases.json")
    if args.only:
        cases = [c for c in cases if re.search(args.only, c["id"])]
    if args.shard:
        k, n = (int(x) for x in args.shard.split("/"))
        cases = cases[k - 1::n]

    runner = Runner(args.model, args.temperature, args.top_p)
    started = time.time()
    results = []
    for case in cases:
        samples = []
        for seed in range(args.samples):
            template, raw, classification_raw = run_sample(runner, prompts[case["id"]], seed)
            checks = score(case, prompts[case["id"]], template, raw)
            passed = all(ok for _, ok, _ in checks)
            samples.append({"seed": seed, "template": template, "passed": passed, "output": raw,
                            "classification": classification_raw,
                            "checks": [{"check": n, "passed": ok, "detail": d} for n, ok, d in checks]})
            failing = [n for n, ok, _ in checks if not ok]
            print(f"{case['id']} seed={seed}: {'pass' if passed else 'FAIL ' + ', '.join(failing)}", flush=True)
        results.append({"id": case["id"], "category": case["category"], "samples": samples})

    meta = {"model": args.model, "samples": args.samples, "cases": len(cases), "temperature": args.temperature,
            "top_p": args.top_p, "seconds": time.time() - started}
    write_outputs(args, meta, results)


if __name__ == "__main__":
    main()
