"""Stage `fetch`: downloads the runs in [run] include (and this run, if it has no data yet) from
the dataset repo `publish_data` uploads to, into runs/<name>/, skipping files already there. Run
it before `build` on a machine that doesn't hold the earlier runs."""

from .publish_data import FILES


def run_stage(run, limit=None):
    from huggingface_hub import hf_hub_download
    from huggingface_hub.errors import EntryNotFoundError, RevisionNotFoundError

    repo = run["publish"].get("dataset_repo")
    if not repo:
        raise SystemExit("fetch: set [publish] dataset_repo in the config first")
    name = run["run"]["name"]
    names = list(run["run"].get("include", []))
    if not run.path("utterances.jsonl").exists():
        names.append(name)
    runs = run.dir.parent
    for other in names:
        got = 0
        for f in FILES:
            if (runs / other / f).exists():
                continue
            try:
                # revision = the run's tag: the data a model was trained on, even if the folder changes later
                hf_hub_download(repo, f"{other}/{f}", repo_type="dataset", revision=other, local_dir=runs)
                got += 1
            except EntryNotFoundError:
                pass
            except RevisionNotFoundError:
                if other != name:   # this run not published yet is normal; an included one missing isn't
                    print(f"fetch: {other} isn't in {repo} (no tag {other}); publish_data it first")
                break
        if got or other != name:
            print(f"fetch: {other}: {got} files from https://huggingface.co/datasets/{repo}/tree/{other}")
