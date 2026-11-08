# ios-uidriver

A scratch XCUITest runner for demo-video recordings (skill `heji-demo-video`): it drives any app
installed on a booted iOS simulator by bundle id from a JSON step script, and logs each action's
wall-clock time and its target's frame (points). `../sim-record.mjs` builds it once (into the scratch
disk, never the repo), records the screen with `simctl io recordVideo` while it runs, and writes
`rec-<name>.mp4` + `rec-<name>.events.json` in the clip's own pixels and seconds.

Actions: `launch` (args), `wait`, `mark` (log a target without touching it), `tap`, `longpress`,
`swipeLeft|Right|Up|Down`, `drag` (dx, dy), `scroll` (dy), `type` (text), `signal` (text: a name; the recorder's `onSignal(name, cmd)` runs cmd then, e.g. a `simctl push`), `dump` (the element tree, next to the log), `home`, `lock`. Any step can be `optional: true` (skipped when its target never appears, e.g. a one-time sheet). A target `q`
is `{ type: button|text|cell|switch|field|image|other|link, label | contains | id, index, app: "springboard" }`.
