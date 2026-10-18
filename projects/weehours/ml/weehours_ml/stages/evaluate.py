"""Stage `evaluate` (Mac: needs Swift for `logeval`): runs the app's own eval harness on the
fine-tuned GGUF and on the stock one, both through llama-server at the app's llama.cpp commit,
raw and with fitted calibration, and writes runs/<name>/eval.md (eval/report.py). The fine-tuned
model's fitted calibration lands in runs/<name>/calibration.json: it replaces
spec/calibration.json when the model ships."""

import shutil
import socket
import subprocess
import sys
import time
import urllib.request

from ..config import PROJECT_DIR
from .convert import llama_cpp

LOGCORE = PROJECT_DIR / "apps" / "ios" / "LogCore"
BUNDLED = PROJECT_DIR / "apps" / "ios" / "App" / "Models" / "Laya-Q8_0.gguf"


def stock_model(run):
    """The Laya the app ships today (bundled copy, else downloaded per eval/laya.env)."""
    if BUNDLED.exists():
        return BUNDLED
    env = dict(line.split("=", 1) for line in (PROJECT_DIR / "eval" / "laya.env").read_text().splitlines()
               if "=" in line and not line.startswith("#"))
    path = run.dir.parent / env["LAYA_FILE"]
    if not path.exists():
        url = f"https://huggingface.co/{env['LAYA_REPO']}/resolve/main/{env['LAYA_FILE']}"
        print(f"evaluate: downloading {url}", flush=True)
        urllib.request.urlretrieve(url, path)
    return path


def _free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def serve_and_eval(server, model, out, logeval):
    port = _free_port()
    proc = subprocess.Popen([str(server), "-m", str(model), "--port", str(port), "-ub", "2048", "-b", "2048"],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(120):
            try:
                if b"ok" in urllib.request.urlopen(f"http://127.0.0.1:{port}/health", timeout=1).read():
                    break
            except OSError:
                time.sleep(1)
        else:
            raise SystemExit(f"evaluate: llama-server didn't come up for {model}")
        for extra in ([], ["--fit"]):
            subprocess.run([str(logeval), "--model", f"http://127.0.0.1:{port}", "--design", "hierarchical",
                            "--out", str(out), *extra], cwd=LOGCORE, check=True, stdout=subprocess.DEVNULL)
    finally:
        proc.terminate()
        proc.wait()


def run_stage(run, limit=None):
    work = llama_cpp(run["convert"]["llama_cpp_commit"])
    subprocess.run(["swift", "build", "-c", "release", "--product", "logeval"], cwd=LOGCORE, check=True)
    logeval = LOGCORE / ".build" / "release" / "logeval"
    server = work / "build" / "bin" / "llama-server"
    finetuned = run.path("gguf") / f"Laya-ft-{run['convert']['quantization']}.gguf"
    if not finetuned.exists():
        raise SystemExit(f"evaluate: {finetuned} missing; run `convert` first")

    results = run.path("eval")
    for name, model in [("finetuned", finetuned), ("stock", stock_model(run))]:
        print(f"evaluate: {name} ({model})", flush=True)
        serve_and_eval(server, model, results / name, logeval)

    report = [subprocess.run(
        [sys.executable, str(PROJECT_DIR / "eval" / "report.py"), "--title", title,
         f"fine-tuned={results / 'finetuned' / f'{label}.json'}", f"stock={results / 'stock' / f'{label}.json'}"],
        check=True, capture_output=True, text=True).stdout
        for title, label in [("Raw", "laya-hierarchical"), ("Calibrated (fit on even rows, scored on odd)",
                                                             "laya-hierarchical-calibrated")]]
    run.path("eval.md").write_text("\n".join(report))
    shutil.copy(results / "finetuned" / "laya-hierarchical-calibrated.calibration.json", run.path("calibration.json"))
    print("".join(report))
    print(f"evaluate: report -> {run.path('eval.md')}; fitted calibration -> {run.path('calibration.json')}")
