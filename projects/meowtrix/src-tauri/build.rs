// Declaring the app's commands in an app manifest generates `allow-<command>`
// permissions, so capabilities can grant them per window and per origin. The
// main window loads the Node server (http://127.0.0.1:<port>), which Tauri
// treats as a remote origin: it may only call commands a capability grants it
// (see capabilities/remote-window.json — the native browser tab commands).
const COMMANDS: &[&str] = &[
    "hide_overlay",
    "show_overlay",
    "show_normal_window",
    "set_overlay_opacity",
    "start_window_drag",
    "close_window",
    "minimize_window",
    "maximize_window",
    "update_hud_state",
    "dismiss_update_hud",
    "nb_supported",
    "nb_open",
    "nb_set_bounds",
    "nb_set_visible",
    "nb_navigate",
    "nb_action",
    "nb_focus",
    "nb_focus_main",
    "nb_zoom",
    "nb_close",
    "nb_hide_all",
];

fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(COMMANDS)),
    )
    .expect("failed to run tauri-build");
}
