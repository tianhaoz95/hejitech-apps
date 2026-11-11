# hq

The repo side of [HQ](https://hq.hejitech.workers.dev), a repo's autopilot: scheduled agents propose
maintenance, reliability and performance work as evidence-backed cards, the team approves them in
the portal or the iPhone app, and a runner on your machine builds what was approved.

```sh
npm install -g @hejitech/hq      # or: npx @hejitech/hq <command>
```

In a repository that has a workspace in HQ:

```sh
hq init --repo owner/name   # writes .hq/HQ.md if the repo has none
hq login                    # asks for the HQ address, then signs in in the browser (workspace admins)
hq sync                     # uploads the repo's .hq/ policy
hq runner                   # claims approved work and starts agents
```

| Command | What it does |
|---|---|
| `hq login [--url <address>] [--browser \| --token] [--no-open]` | Sign in and save it for this repo (`~/.config/hq/credentials.json`) |
| `hq logout` | Forget this repo's saved login |
| `hq lint [--no-run]` | Check every `.hq/` folder: schema, verbs exist and are executable, dry runs |
| `hq policy` | Print the merged policy as JSON |
| `hq sync` | Upload the policy to HQ |
| `hq context [project]` | Print what agents get from `get_context` |
| `hq verb <project> <verb> [--dry-run]` | Run a verb locally, as the runner would |
| `hq runner [--once] [--caps …] [--interval 60]` | Claim and do work |
| `hq --version` | Print the version |

On a machine without a person (CI, a server), skip `hq login`: create a runner token and an agent
token in the portal's Settings and set `HQ_URL`, `HQ_TOKEN` and `HQ_AGENT_TOKEN`. They always win
over a saved login.

Needs Node 20 or newer.
