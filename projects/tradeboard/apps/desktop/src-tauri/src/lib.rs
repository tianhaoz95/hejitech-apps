// Tradeboard Executor for the Mac: a window and a menu-bar item around the command-line executor.
//
// The app never trades. It installs the same tradeboard-executor bundle and login service as
// `install.sh` (the copy inside the app), runs the CLI's own commands (setup, auth, check,
// model-check), starts and stops the service, and reads the files the daemon keeps in
// ~/.tradeboard (status.json, executor.log). Orders are claimed and placed only by the daemon,
// after the board's approval and the executor's own gates, exactly as without the app.
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    fs,
    io::{Read, Seek, SeekFrom},
    path::{Path, PathBuf},
    process::Command,
    sync::Mutex,
    time::{Duration, SystemTime},
};
use tauri::{
    image::Image,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    path::BaseDirectory,
    tray::{TrayIcon, TrayIconBuilder},
    AppHandle, Emitter, Manager, RunEvent, WindowEvent,
};

const LABEL: &str = "com.hejitech.tradeboard-executor";
const STALE_SECS: i64 = 90;

// ------------------------------------------------------------------------------------- paths

fn user_home() -> PathBuf {
    PathBuf::from(std::env::var("HOME").unwrap_or_else(|_| "/".into()))
}

fn tb_home() -> PathBuf {
    match std::env::var("TRADEBOARD_HOME") {
        Ok(h) if !h.is_empty() => PathBuf::from(h),
        _ => user_home().join(".tradeboard"),
    }
}

struct Paths {
    cli: PathBuf,
    mjs: PathBuf,
    config: PathBuf,
    oauth: PathBuf,
    status: PathBuf,
    kill: PathBuf,
    log: PathBuf,
    service: PathBuf,
}

fn paths() -> Paths {
    let h = tb_home();
    let service = if cfg!(target_os = "macos") {
        user_home().join("Library/LaunchAgents").join(format!("{LABEL}.plist"))
    } else {
        user_home().join(".config/systemd/user/tradeboard-executor.service")
    };
    Paths {
        cli: h.join("bin/tradeboard-executor"),
        mjs: h.join("bin/tradeboard-executor.mjs"),
        config: h.join("config.json"),
        oauth: h.join("robinhood-oauth.json"),
        status: h.join("status.json"),
        kill: h.join("KILL"),
        log: h.join("executor.log"),
        service,
    }
}

/// A Finder-launched app gets a bare PATH; install.sh needs curl/tar and finds node here.
fn path_env() -> String {
    let mut p = vec![
        tb_home().join("node/bin").to_string_lossy().into_owned(),
        "/opt/homebrew/bin".into(),
        "/usr/local/bin".into(),
        "/usr/bin".into(),
        "/bin".into(),
        "/usr/sbin".into(),
        "/sbin".into(),
    ];
    if let Ok(cur) = std::env::var("PATH") {
        p.push(cur);
    }
    p.join(":")
}

fn bundled(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    app.path().resolve(name, BaseDirectory::Resource).map_err(|e| e.to_string())
}

/// The bundle's first line is `// tradeboard-executor <version> (bundled)`.
fn bundle_version(p: &Path) -> Option<String> {
    let mut f = fs::File::open(p).ok()?;
    let mut buf = [0u8; 200];
    let n = f.read(&mut buf).ok()?;
    let line = String::from_utf8_lossy(&buf[..n]).lines().next()?.to_string();
    let rest = line.strip_prefix("// tradeboard-executor ")?;
    Some(rest.split_whitespace().next()?.to_string())
}

fn semver(v: &str) -> Option<(u64, u64, u64)> {
    let mut it = v.split('.').map(|x| x.parse::<u64>().ok());
    Some((it.next()??, it.next()??, it.next()??))
}

// ---------------------------------------------------------------------------------- overview

#[derive(Serialize, Clone)]
struct ConfigSummary {
    board_url: String,
    executor_id: String,
    has_token: bool,
    account_mask: Option<String>,
    model_enabled: bool,
    model_url: String,
    model_name: String,
    allow_live: bool,
}

#[derive(Serialize, Clone, Default)]
struct Service {
    installed: bool,
    loaded: bool,
    running: bool,
    pid: Option<i64>,
}

#[derive(Serialize, Clone)]
struct Overview {
    home: String,
    bundled_version: Option<String>,
    cli_installed: bool,
    cli_version: Option<String>,
    config: Option<ConfigSummary>,
    config_error: Option<String>,
    robinhood_tokens: bool,
    service: Service,
    /// The daemon's status.json, plus `age_secs` since it was written.
    status: Option<Value>,
    status_age_secs: Option<i64>,
    kill: bool,
}

fn config_summary() -> (Option<ConfigSummary>, Option<String>) {
    let p = paths().config;
    let Ok(text) = fs::read_to_string(&p) else { return (None, None) };
    let v: Value = match serde_json::from_str(&text) {
        Ok(v) => v,
        Err(e) => return (None, Some(format!("{} isn't valid JSON: {e}", p.display()))),
    };
    let s = |ptr: &str| v.pointer(ptr).and_then(Value::as_str).unwrap_or("").to_string();
    let account = s("/robinhood/account_number");
    (
        Some(ConfigSummary {
            board_url: s("/board_url"),
            executor_id: s("/executor_id"),
            has_token: s("/executor_token").starts_with("tbx_"),
            account_mask: (account.len() >= 4).then(|| format!("••••{}", &account[account.len() - 4..])),
            model_enabled: v.pointer("/model/enabled").and_then(Value::as_bool).unwrap_or(true),
            model_url: s("/model/base_url"),
            model_name: s("/model/model"),
            allow_live: v.pointer("/allow_live").and_then(Value::as_bool).unwrap_or(false),
        }),
        None,
    )
}

fn uid() -> u32 {
    unsafe { libc::getuid() }
}

fn service_state() -> Service {
    let p = paths();
    let mut s = Service { installed: p.service.exists(), ..Default::default() };
    if cfg!(target_os = "macos") {
        if let Ok(out) = Command::new("/bin/launchctl").args(["print", &format!("gui/{}/{LABEL}", uid())]).output() {
            if out.status.success() {
                s.loaded = true;
                let text = String::from_utf8_lossy(&out.stdout);
                for line in text.lines().map(str::trim) {
                    if line == "state = running" {
                        s.running = true;
                    }
                    if let (None, Some(pid)) = (s.pid, line.strip_prefix("pid = ")) {
                        s.pid = pid.trim().parse().ok();
                    }
                }
            }
        }
    } else if let Ok(out) = Command::new("systemctl").args(["--user", "is-active", "tradeboard-executor"]).output() {
        let state = String::from_utf8_lossy(&out.stdout).trim().to_string();
        s.loaded = state != "inactive" && state != "unknown" && !state.is_empty();
        s.running = state == "active";
    }
    s
}

fn read_status() -> (Option<Value>, Option<i64>) {
    let p = paths().status;
    let Ok(text) = fs::read_to_string(&p) else { return (None, None) };
    let v: Option<Value> = serde_json::from_str(&text).ok();
    let age = fs::metadata(&p)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| SystemTime::now().duration_since(t).ok())
        .map(|d| d.as_secs() as i64);
    (v, age)
}

fn compute_overview(app: &AppHandle) -> Overview {
    let p = paths();
    let (config, config_error) = config_summary();
    let (status, status_age_secs) = read_status();
    Overview {
        home: tb_home().to_string_lossy().into_owned(),
        bundled_version: bundled(app, "tradeboard-executor.mjs").ok().and_then(|m| bundle_version(&m)),
        cli_installed: p.cli.exists() && p.mjs.exists(),
        cli_version: bundle_version(&p.mjs),
        config,
        config_error,
        robinhood_tokens: fs::read_to_string(&p.oauth).map(|t| t.contains("access_token")).unwrap_or(false),
        service: service_state(),
        status,
        status_age_secs,
        kill: p.kill.exists(),
    }
}

/// One line for the menu bar, and whether it needs attention.
fn headline(o: &Overview) -> (String, bool) {
    if !o.cli_installed {
        return ("Executor not installed".into(), true);
    }
    if o.config.is_none() {
        return ("Executor not set up".into(), true);
    }
    if !o.service.running {
        return ("Executor stopped".into(), true);
    }
    let fresh = o.status_age_secs.map(|a| a < STALE_SECS).unwrap_or(false);
    let Some(st) = o.status.as_ref().filter(|_| fresh) else {
        return ("Executor starting or not reporting".into(), true);
    };
    if o.kill {
        return ("Running · not claiming (you stopped it)".into(), true);
    }
    let mode = if st.get("mode").and_then(Value::as_str) == Some("live") { "live" } else { "dry-run" };
    let rh = st.get("robinhood_connected").and_then(Value::as_bool).unwrap_or(false);
    let paused = st.get("paused").and_then(Value::as_bool).unwrap_or(false);
    let err = st.get("last_error").map(|e| !e.is_null()).unwrap_or(false);
    let mut s = format!("Running · {mode}");
    if paused {
        s.push_str(" · paused");
    }
    if !rh {
        s.push_str(" · Robinhood not connected");
    }
    (s, paused || !rh || err)
}

// ---------------------------------------------------------------------------- running things

async fn run_proc(program: &Path, args: &[String], envs: &[(String, String)], timeout: u64) -> Result<String, String> {
    let mut cmd = tokio::process::Command::new(program);
    cmd.args(args).env("PATH", path_env()).env("TRADEBOARD_HOME", tb_home()).kill_on_drop(true);
    for (k, v) in envs {
        cmd.env(k, v);
    }
    cmd.stdin(std::process::Stdio::null());
    let out = tokio::time::timeout(Duration::from_secs(timeout), cmd.output())
        .await
        .map_err(|_| format!("{} didn't finish within {timeout} s", program.display()))?
        .map_err(|e| format!("couldn't run {}: {e}", program.display()))?;
    let mut text = String::from_utf8_lossy(&out.stdout).into_owned();
    let err = String::from_utf8_lossy(&out.stderr);
    if !err.trim().is_empty() {
        if !text.is_empty() && !text.ends_with('\n') {
            text.push('\n');
        }
        text.push_str(&err);
    }
    if out.status.success() {
        Ok(text)
    } else {
        Err(if text.trim().is_empty() { format!("exited with {}", out.status) } else { text })
    }
}

async fn cli(args: &[&str], envs: &[(String, String)], timeout: u64) -> Result<String, String> {
    let p = paths();
    if !p.cli.exists() {
        return Err("The executor isn't installed yet.".into());
    }
    run_proc(&p.cli, &args.iter().map(|s| s.to_string()).collect::<Vec<_>>(), envs, timeout).await
}

fn sh(program: &str, args: &[&str]) -> Result<String, String> {
    let out = Command::new(program).args(args).output().map_err(|e| format!("{program}: {e}"))?;
    let text = format!("{}{}", String::from_utf8_lossy(&out.stdout), String::from_utf8_lossy(&out.stderr));
    if out.status.success() {
        Ok(text)
    } else {
        Err(format!("{program} {}: {}", args.join(" "), text.trim()))
    }
}

fn start_service() -> Result<(), String> {
    let p = paths();
    if !p.service.exists() {
        return Err("Install the executor first.".into());
    }
    if !p.config.exists() {
        return Err("Set the executor up first (board, credential, account).".into());
    }
    if cfg!(target_os = "macos") {
        let target = format!("gui/{}/{LABEL}", uid());
        let _ = sh("/bin/launchctl", &["enable", &target]);
        if service_state().loaded {
            sh("/bin/launchctl", &["kickstart", "-k", &target])?;
        } else {
            sh("/bin/launchctl", &["bootstrap", &format!("gui/{}", uid()), &p.service.to_string_lossy()])?;
        }
    } else {
        sh("systemctl", &["--user", "enable", "--now", "tradeboard-executor"])?;
    }
    Ok(())
}

fn stop_service() -> Result<(), String> {
    if cfg!(target_os = "macos") {
        let target = format!("gui/{}/{LABEL}", uid());
        // Disabled too, so it stays stopped after the next login until it's started again here.
        let _ = sh("/bin/launchctl", &["disable", &target]);
        if service_state().loaded {
            sh("/bin/launchctl", &["bootout", &target])?;
        }
    } else {
        sh("systemctl", &["--user", "disable", "--now", "tradeboard-executor"])?;
    }
    Ok(())
}

/// Config is read when the daemon starts: a running daemon restarts to pick up a change.
fn restart_if_running() {
    if service_state().running {
        let _ = start_service();
    }
}

fn set_kill_file(on: bool) -> Result<(), String> {
    let p = paths();
    if on {
        fs::create_dir_all(tb_home()).map_err(|e| e.to_string())?;
        fs::write(&p.kill, "Stopped from the Tradeboard Executor app. Remove this file (or Allow claiming in the app) to claim plans again.\n")
            .map_err(|e| e.to_string())
    } else if p.kill.exists() {
        fs::remove_file(&p.kill).map_err(|e| e.to_string())
    } else {
        Ok(())
    }
}

async fn install(app: &AppHandle) -> Result<String, String> {
    let mjs = bundled(app, "tradeboard-executor.mjs")?;
    let script = bundled(app, "install.sh")?;
    if !mjs.exists() || !script.exists() {
        return Err("This copy of the app has no executor inside it (development build without resources?).".into());
    }
    let out = run_proc(
        Path::new("/bin/bash"),
        &[script.to_string_lossy().into_owned(), "--file".into(), mjs.to_string_lossy().into_owned()],
        &[],
        900,
    )
    .await?;
    Ok(out)
}

// ---------------------------------------------------------------------------------- commands

#[tauri::command]
fn overview(app: AppHandle) -> Overview {
    compute_overview(&app)
}

#[tauri::command]
async fn install_cli(app: AppHandle) -> Result<String, String> {
    let mut out = install(&app).await?;
    if paths().config.exists() {
        match start_service() {
            Ok(()) => out.push_str("\nStarted the executor service."),
            Err(e) => out.push_str(&format!("\nCouldn't start the service: {e}")),
        }
    }
    refresh_tray(&app);
    Ok(out)
}

#[derive(Deserialize)]
struct SetupInput {
    board_url: String,
    executor_id: String,
    /// Empty keeps the saved credential.
    token: String,
    /// Empty keeps the saved account number.
    account: String,
    model_enabled: bool,
    model_url: String,
    model_name: String,
}

#[tauri::command]
async fn save_setup(app: AppHandle, input: SetupInput) -> Result<String, String> {
    let mut args = vec![
        "setup".to_string(),
        "--board-url".into(),
        input.board_url.trim().into(),
        "--executor-id".into(),
        input.executor_id.trim().into(),
        "--model-url".into(),
        input.model_url.trim().into(),
        "--model".into(),
        input.model_name.trim().into(),
        if input.model_enabled { "--model-check".into() } else { "--no-model".into() },
    ];
    args.retain(|a| !a.is_empty());
    // Secrets go through the environment, never the process list.
    let mut envs = vec![];
    if !input.token.trim().is_empty() {
        envs.push(("TRADEBOARD_EXECUTOR_TOKEN".to_string(), input.token.trim().to_string()));
    }
    if !input.account.trim().is_empty() {
        envs.push(("TRADEBOARD_ACCOUNT".to_string(), input.account.trim().to_string()));
    }
    let refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let out = cli(&refs, &envs, 30).await?;
    let mut out = out;
    if service_state().running {
        restart_if_running();
        out.push_str("Restarted the executor with the new settings.\n");
    } else if paths().service.exists() && start_service().is_ok() {
        out.push_str("Started the executor service.\n");
    }
    refresh_tray(&app);
    Ok(out)
}

#[tauri::command]
async fn set_live(app: AppHandle, allow: bool) -> Result<String, String> {
    let out = cli(&["setup", "--allow-live", if allow { "yes" } else { "no" }], &[], 30).await?;
    restart_if_running();
    refresh_tray(&app);
    Ok(out)
}

#[tauri::command]
async fn robinhood_sign_in(app: AppHandle) -> Result<String, String> {
    // `auth` opens the Robinhood sign-in in the browser and waits for the loopback redirect.
    let out = cli(&["auth"], &[], 600).await?;
    restart_if_running();
    refresh_tray(&app);
    Ok(out)
}

#[tauri::command]
async fn run_check(kind: String) -> Result<String, String> {
    let cmd = match kind.as_str() {
        "check" => "check",
        "model-check" => "model-check",
        _ => return Err("unknown check".into()),
    };
    match cli(&[cmd], &[], 600).await {
        Ok(s) => Ok(s),
        Err(s) => Ok(s), // a failed check still has its lines to show
    }
}

#[tauri::command]
fn service(app: AppHandle, action: String) -> Result<(), String> {
    let r = match action.as_str() {
        "start" => start_service(),
        "stop" => stop_service(),
        "restart" => start_service(),
        _ => Err("unknown action".into()),
    };
    refresh_tray(&app);
    r
}

#[tauri::command]
fn set_kill(app: AppHandle, on: bool) -> Result<(), String> {
    let r = set_kill_file(on);
    refresh_tray(&app);
    r
}

#[tauri::command]
fn read_log(lines: usize) -> String {
    let p = paths().log;
    let Ok(mut f) = fs::File::open(&p) else {
        return if cfg!(target_os = "macos") { String::new() } else { "Logs: journalctl --user -u tradeboard-executor -f".into() };
    };
    let len = f.metadata().map(|m| m.len()).unwrap_or(0);
    let start = len.saturating_sub(256 * 1024);
    let _ = f.seek(SeekFrom::Start(start));
    let mut buf = String::new();
    let _ = f.read_to_string(&mut buf);
    let all: Vec<&str> = buf.lines().collect();
    all[all.len().saturating_sub(lines)..].join("\n")
}

#[tauri::command]
fn log_path() -> String {
    paths().log.to_string_lossy().into_owned()
}

// -------------------------------------------------------------------------- window and tray

struct TrayState {
    tray: TrayIcon,
    status: MenuItem<tauri::Wry>,
    kill: MenuItem<tauri::Wry>,
    service: MenuItem<tauri::Wry>,
    last: Mutex<Option<(String, bool, bool, bool)>>,
}

fn show_window(app: &AppHandle) {
    #[cfg(target_os = "macos")]
    let _ = app.set_activation_policy(tauri::ActivationPolicy::Regular);
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

fn hide_window(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.hide();
    }
    // Only the menu-bar item stays, like other status-bar apps.
    #[cfg(target_os = "macos")]
    let _ = app.set_activation_policy(tauri::ActivationPolicy::Accessory);
}

fn refresh_tray(app: &AppHandle) {
    let Some(t) = app.try_state::<TrayState>() else { return };
    let o = compute_overview(app);
    let (line, alert) = headline(&o);
    let key = (line.clone(), alert, o.kill, o.service.running);
    {
        let mut last = t.last.lock().unwrap();
        if last.as_ref() == Some(&key) {
            return;
        }
        *last = Some(key);
    }
    let _ = t.status.set_text(&line);
    let _ = t.tray.set_tooltip(Some(format!("Tradeboard Executor: {line}")));
    let icon = if alert { include_bytes!("../icons/tray-alert.png").as_slice() } else { include_bytes!("../icons/tray.png").as_slice() };
    if let Ok(img) = Image::from_bytes(icon) {
        let _ = t.tray.set_icon(Some(img));
        let _ = t.tray.set_icon_as_template(true);
    }
    let _ = t.kill.set_text(if o.kill { "Allow claiming plans" } else { "Stop claiming plans" });
    let _ = t.kill.set_enabled(o.cli_installed);
    let _ = t.service.set_text(if o.service.running { "Stop the executor" } else { "Start the executor" });
    let _ = t.service.set_enabled(o.service.installed && o.config.is_some());
    let _ = app.emit("overview-changed", ());
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let status = MenuItem::with_id(app, "status", "Checking…", false, None::<&str>)?;
    let open = MenuItem::with_id(app, "open", "Open Tradeboard Executor…", true, None::<&str>)?;
    let portal = MenuItem::with_id(app, "portal", "Open the board", true, None::<&str>)?;
    let kill = MenuItem::with_id(app, "kill", "Stop claiming plans", true, None::<&str>)?;
    let service = MenuItem::with_id(app, "service", "Start the executor", true, None::<&str>)?;
    let updates = MenuItem::with_id(app, "updates", "Check for Updates…", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit (the executor keeps running)", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[
            &status,
            &PredefinedMenuItem::separator(app)?,
            &open,
            &portal,
            &PredefinedMenuItem::separator(app)?,
            &kill,
            &service,
            &PredefinedMenuItem::separator(app)?,
            &updates,
            &quit,
        ],
    )?;
    let tray = TrayIconBuilder::with_id("main")
        .icon(Image::from_bytes(include_bytes!("../icons/tray.png"))?)
        .icon_as_template(true)
        .tooltip("Tradeboard Executor")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, ev| {
            let app = app.clone();
            match ev.id().as_ref() {
                "open" => show_window(&app),
                "portal" => {
                    let url = config_summary().0.map(|c| c.board_url).filter(|u| u.starts_with("http")).unwrap_or_else(|| "https://tradeboard.hejitech.workers.dev".into());
                    let _ = tauri_plugin_opener::open_url(format!("{}/executor/", url.trim_end_matches('/')), None::<&str>);
                }
                "kill" => {
                    std::thread::spawn(move || {
                        let _ = set_kill_file(!paths().kill.exists());
                        refresh_tray(&app);
                    });
                }
                "service" => {
                    std::thread::spawn(move || {
                        let _ = if service_state().running { stop_service() } else { start_service() };
                        refresh_tray(&app);
                    });
                }
                "updates" => {
                    show_window(&app);
                    let _ = app.emit("check-updates", ());
                }
                "quit" => app.exit(0),
                _ => {}
            }
        })
        .build(app)?;
    app.manage(TrayState { tray, status, kill, service, last: Mutex::new(None) });
    Ok(())
}

/// A newer app carries a newer executor: bring an older installed one up to it (never down).
async fn update_cli_if_older(app: AppHandle) {
    let p = paths();
    let (Some(have), Some(bundled_v)) = (bundle_version(&p.mjs), bundled(&app, "tradeboard-executor.mjs").ok().and_then(|m| bundle_version(&m))) else { return };
    let (Some(a), Some(b)) = (semver(&have), semver(&bundled_v)) else { return };
    if a >= b {
        return;
    }
    match install(&app).await {
        Ok(_) => {
            restart_if_running();
            let _ = app.emit("cli-updated", format!("Updated the executor from {have} to {bundled_v}."));
        }
        Err(e) => {
            let _ = app.emit("cli-updated", format!("Couldn't update the executor from {have} to {bundled_v}: {e}"));
        }
    }
    refresh_tray(&app);
}

pub fn run() {
    let hidden = std::env::args().any(|a| a == "--hidden");
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec!["--hidden"])))
        .invoke_handler(tauri::generate_handler![
            overview, install_cli, save_setup, set_live, robinhood_sign_in, run_check, service, set_kill, read_log, log_path
        ])
        .setup(move |app| {
            let handle = app.handle().clone();
            build_tray(&handle)?;
            refresh_tray(&handle);
            if hidden {
                hide_window(&handle);
            } else {
                show_window(&handle);
            }
            tauri::async_runtime::spawn(update_cli_if_older(handle.clone()));
            std::thread::spawn(move || loop {
                std::thread::sleep(Duration::from_secs(5));
                refresh_tray(&handle);
            });
            Ok(())
        })
        .on_window_event(|w, ev| {
            if let WindowEvent::CloseRequested { api, .. } = ev {
                api.prevent_close();
                hide_window(w.app_handle());
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building Tradeboard Executor")
        .run(|app, ev| {
            #[cfg(target_os = "macos")]
            if let RunEvent::Reopen { .. } = ev {
                show_window(app);
            }
            let _ = (app, &ev);
        });
}
