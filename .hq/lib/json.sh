# Helpers for .hq/bin verbs (sourced). Verbs print one JSON object on stdout; humans read stderr.
hq_root() { echo "${HQ_REPO_ROOT:-$(git rev-parse --show-toplevel)}"; }
# json_str <text>: a JSON string literal.
json_str() { node -e 'process.stdout.write(JSON.stringify(require("fs").readFileSync(0, "utf8")))' <<<"$1"; }
