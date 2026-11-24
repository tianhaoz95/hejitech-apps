use std::collections::VecDeque;
use std::io::{Read, Write};
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Manager};

pub const DEFAULT_PORT: u16 = 9123;

const MAX_RESTARTS_IN_WINDOW: usize = 5;
const RESTART_WINDOW: Duration = Duration::from_secs(300);
const MAX_BACKOFF: Duration = Duration::from_secs(16);
const STOP_GRACE_PERIOD: Duration = Duration::from_millis(2500);

#[cfg(unix)]
mod unix_proc {
    use std::os::unix::process::CommandExt;
    use std::process::Command;

    const SIGTERM: i32 = 15;
    const SIGKILL: i32 = 9;

    extern "C" {
        fn kill(pid: i32, sig: i32) -> i32;
    }

    pub fn configure_process_group(cmd: &mut Command) {
        cmd.process_group(0);
    }

    pub fn send_sigterm_group(pid: u32) {
        if pid > 0 && pid <= i32::MAX as u32 {
            unsafe {
                let _ = kill(-(pid as i32), SIGTERM);
            }
        }
    }

    pub fn send_sigkill_group(pid: u32) {
        if pid > 0 && pid <= i32::MAX as u32 {
            unsafe {
                let _ = kill(-(pid as i32), SIGKILL);
            }
        }
    }
}

/// The server port to connect to / launch on. `MEOWTRIX_PORT` overrides it so a
/// development build can run beside an installed Meowtrix without sharing its
/// server (and live session).
pub fn default_port() -> u16 {
    std::env::var("MEOWTRIX_PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(DEFAULT_PORT)
}

#[derive(Debug, Clone)]
pub enum AppMode {
    /// 100% self-contained standalone app with bundled Node runtime and server payload
    Standalone {
        node_bin: PathBuf,
        server_dir: PathBuf,
    },
    /// Lightweight client that connects to an existing local or host server
    Lite,
}

#[derive(Debug, Clone)]
struct SpawnSpec {
    node_bin: PathBuf,
    script: PathBuf,
    work_dir: PathBuf,
    port: u16,
    ai_port: u16,
    data_dir: Option<PathBuf>,
    label: &'static str,
}

struct ManagedChild {
    child: Option<Child>,
    spec: Option<SpawnSpec>,
}

struct RunningGuard(Arc<AtomicBool>);

impl Drop for RunningGuard {
    fn drop(&mut self) {
        self.0.store(false, Ordering::SeqCst);
    }
}

struct RestartTracker {
    timestamps: VecDeque<Instant>,
    max_restarts: usize,
    window: Duration,
}

impl RestartTracker {
    fn new(max_restarts: usize, window: Duration) -> Self {
        Self {
            timestamps: VecDeque::new(),
            max_restarts,
            window,
        }
    }

    fn prune(&mut self, now: Instant) {
        while let Some(&front) = self.timestamps.front() {
            if now.saturating_duration_since(front) > self.window {
                self.timestamps.pop_front();
            } else {
                break;
            }
        }
    }

    /// Records a restart attempt if within budget, returning the backoff delay
    /// to wait before respawning. Returns `None` once the budget is exhausted.
    fn next_backoff(&mut self, now: Instant) -> Option<Duration> {
        self.prune(now);
        if self.timestamps.len() >= self.max_restarts {
            return None;
        }
        let attempt = self.timestamps.len() as u32;
        self.timestamps.push_back(now);
        let secs = 1u64
            .checked_shl(attempt)
            .unwrap_or(MAX_BACKOFF.as_secs())
            .min(MAX_BACKOFF.as_secs());
        Some(Duration::from_secs(secs))
    }
}

pub struct ServerManager {
    managed: Arc<Mutex<ManagedChild>>,
    stopping: Arc<AtomicBool>,
    supervisor_running: Arc<AtomicBool>,
    pub port: u16,
    pub mode: Option<AppMode>,
}

impl ServerManager {
    pub fn new() -> Self {
        Self {
            managed: Arc::new(Mutex::new(ManagedChild {
                child: None,
                spec: None,
            })),
            stopping: Arc::new(AtomicBool::new(false)),
            supervisor_running: Arc::new(AtomicBool::new(false)),
            port: default_port(),
            mode: None,
        }
    }

    /// Detects whether the app is running as a Standalone bundle or Lite client.
    pub fn detect_mode(&mut self, app: &AppHandle) -> &AppMode {
        if self.mode.is_none() {
            let detected = detect_standalone_payload(app).unwrap_or(AppMode::Lite);
            self.mode = Some(detected);
        }
        self.mode.as_ref().unwrap()
    }

    /// Checks if a Meowtrix server is responding on the configured port.
    pub fn is_ready(&self) -> bool {
        check_server_ready(self.port)
    }

    fn wait_for_startup_ready(&self, label: &str) -> Result<(), String> {
        for _ in 0..100 {
            {
                let mut guard = self.managed.lock().unwrap_or_else(|e| e.into_inner());
                if let Some(ref mut child) = guard.child {
                    if let Ok(Some(status)) = child.try_wait() {
                        return Err(format!(
                            "{label} process exited unexpectedly with {status}"
                        ));
                    }
                }
            }
            std::thread::sleep(Duration::from_millis(100));
            if self.is_ready() {
                return Ok(());
            }
        }

        Err(format!(
            "{label} failed to become ready on http://127.0.0.1:{} within 10s",
            self.port
        ))
    }

    fn start_supervisor(&self) {
        if self
            .supervisor_running
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_err()
        {
            return;
        }

        let managed = Arc::clone(&self.managed);
        let stopping = Arc::clone(&self.stopping);
        let running = Arc::clone(&self.supervisor_running);

        std::thread::spawn(move || {
            let _guard = RunningGuard(running);
            let mut tracker = RestartTracker::new(MAX_RESTARTS_IN_WINDOW, RESTART_WINDOW);

            loop {
                if stopping.load(Ordering::SeqCst) {
                    break;
                }

                let restart_spec = {
                    let mut guard = managed.lock().unwrap_or_else(|e| e.into_inner());
                    if stopping.load(Ordering::SeqCst) {
                        break;
                    }
                    match guard.child.as_mut() {
                        Some(child) => match child.try_wait() {
                            Ok(Some(status)) => {
                                guard.child = None;
                                let spec = guard.spec.clone();
                                if let Some(ref s) = spec {
                                    log::error!(
                                        "[{}] Managed Node server exited unexpectedly with {status}",
                                        s.label
                                    );
                                }
                                spec
                            }
                            Ok(None) => None,
                            Err(e) => {
                                log::warn!("Failed to poll managed Node server status: {e}");
                                None
                            }
                        },
                        None => {
                            if guard.spec.is_some() {
                                guard.spec.clone()
                            } else {
                                break;
                            }
                        }
                    }
                };

                let Some(spec) = restart_spec else {
                    std::thread::sleep(Duration::from_millis(500));
                    continue;
                };

                if stopping.load(Ordering::SeqCst) {
                    break;
                }

                let Some(backoff) = tracker.next_backoff(Instant::now()) else {
                    log::error!(
                        "[{}] Managed Node server exceeded max restarts ({MAX_RESTARTS_IN_WINDOW} within {}s); giving up",
                        spec.label,
                        RESTART_WINDOW.as_secs()
                    );
                    break;
                };

                log::warn!(
                    "[{}] Restarting Node server on port {} in {}s...",
                    spec.label,
                    spec.port,
                    backoff.as_secs()
                );

                if sleep_interruptible(backoff, &stopping) {
                    break;
                }

                let mut new_child = match spawn_server(&spec) {
                    Ok(c) => c,
                    Err(e) => {
                        log::error!("[{}] Failed to respawn Node server: {e}", spec.label);
                        continue;
                    }
                };

                let mut ready = false;
                for _ in 0..100 {
                    if stopping.load(Ordering::SeqCst) {
                        terminate_child(new_child);
                        return;
                    }
                    if let Ok(Some(status)) = new_child.try_wait() {
                        log::error!(
                            "[{}] Respawned Node server exited during startup with {status}",
                            spec.label
                        );
                        break;
                    }
                    std::thread::sleep(Duration::from_millis(100));
                    if check_server_ready(spec.port) {
                        ready = true;
                        break;
                    }
                }

                if !ready {
                    log::error!(
                        "[{}] Respawned Node server failed to become ready on http://127.0.0.1:{}",
                        spec.label,
                        spec.port
                    );
                    terminate_child(new_child);
                    continue;
                }

                let mut guard = managed.lock().unwrap_or_else(|e| e.into_inner());
                if stopping.load(Ordering::SeqCst) {
                    drop(guard);
                    terminate_child(new_child);
                    break;
                }
                guard.child = Some(new_child);
                log::info!(
                    "[{}] Managed Node server recovered on http://127.0.0.1:{}",
                    spec.label,
                    spec.port
                );
            }
        });
    }

    /// Ensures the Meowtrix server is running.
    /// - In Standalone mode: Always launches its own embedded server on an isolated dynamic port,
    ///   with instance-scoped data storage so multiple instances or existing servers never conflict.
    /// - In Lite mode: Connects to an existing server on port 9123, or launches a local server if
    ///   development files are present.
    pub fn ensure_started(&mut self, app: &AppHandle, ai_port: u16) -> Result<u16, String> {
        self.stopping.store(false, Ordering::SeqCst);
        let is_standalone = matches!(self.detect_mode(app), AppMode::Standalone { .. });

        if is_standalone {
            // Standalone mode: Connect to existing Meowtrix server on DEFAULT_PORT if already running
            if check_server_ready(default_port()) {
                log::info!("[Standalone] Connected to existing server on port {}", default_port());
                self.port = default_port();
                return Ok(self.port);
            }

            // Otherwise allocate port (prefer DEFAULT_PORT if available, else ephemeral)
            let chosen_port = if TcpListener::bind(format!("127.0.0.1:{}", default_port())).is_ok() {
                default_port()
            } else {
                get_free_port()?
            };
            self.port = chosen_port;

            let (node_bin, server_dir) = match self.mode.as_ref().unwrap() {
                AppMode::Standalone { node_bin, server_dir } => {
                    (node_bin.clone(), server_dir.clone())
                }
                _ => unreachable!(),
            };

            // Ensure node binary has execute permission
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                if let Ok(metadata) = std::fs::metadata(&node_bin) {
                    let mut perms = metadata.permissions();
                    if perms.mode() & 0o111 == 0 {
                        perms.set_mode(perms.mode() | 0o755);
                        let _ = std::fs::set_permissions(&node_bin, perms);
                    }
                }
            }

            // Shared persistent data directory across desktop and web sessions
            let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
            let data_dir = std::env::var("MEOWTRIX_DATA_DIR")
                .map(PathBuf::from)
                .unwrap_or_else(|_| PathBuf::from(home).join(".meowtrix"));
            let _ = std::fs::create_dir_all(&data_dir);

            log::info!(
                "[Standalone] Spawning embedded server: Port={}, Node={:?}, ServerDir={:?}, DataDir={:?}, AiPort={}",
                self.port,
                node_bin,
                server_dir,
                data_dir,
                ai_port
            );

            let spec = SpawnSpec {
                node_bin,
                script: server_dir.join("server.js"),
                work_dir: server_dir,
                port: self.port,
                ai_port,
                data_dir: Some(data_dir),
                label: "Standalone",
            };

            let child = spawn_server(&spec)?;
            {
                let mut guard = self.managed.lock().unwrap_or_else(|e| e.into_inner());
                guard.child = Some(child);
            }

            if let Err(err) = self.wait_for_startup_ready("Embedded server") {
                self.stop();
                return Err(err);
            }

            {
                let mut guard = self.managed.lock().unwrap_or_else(|e| e.into_inner());
                guard.spec = Some(spec);
            }
            self.start_supervisor();

            log::info!(
                "[Standalone] Embedded server ready on http://127.0.0.1:{}",
                self.port
            );
            return Ok(self.port);
        }

        // Lite mode: Reuse existing server if running on 9123
        if check_server_ready(default_port()) {
            log::info!("[Lite] Connected to existing server on port {}", default_port());
            self.port = default_port();
            return Ok(self.port);
        }

        // If not running, check if host has node + server.js (e.g. dev environment)
        if let (Ok(node_bin), Ok(server_script)) = (find_node_binary(), find_server_script(app)) {
            let work_dir = server_script
                .parent()
                .unwrap_or_else(|| Path::new("."))
                .to_path_buf();

            log::info!(
                "[Lite] Spawning host server using Node: {:?}, Script: {:?}, AiPort: {}",
                node_bin,
                server_script,
                ai_port
            );

            self.port = default_port();
            let spec = SpawnSpec {
                node_bin,
                script: server_script,
                work_dir,
                port: self.port,
                ai_port,
                data_dir: None,
                label: "Lite",
            };

            let child = spawn_server(&spec)?;
            {
                let mut guard = self.managed.lock().unwrap_or_else(|e| e.into_inner());
                guard.child = Some(child);
            }

            if let Err(err) = self.wait_for_startup_ready("Host server") {
                self.stop();
                return Err(err);
            }

            {
                let mut guard = self.managed.lock().unwrap_or_else(|e| e.into_inner());
                guard.spec = Some(spec);
            }
            self.start_supervisor();

            log::info!("[Lite] Host server ready on http://127.0.0.1:{}", self.port);
            return Ok(self.port);
        }

        Err(format!(
            "No Meowtrix server found running on http://127.0.0.1:{}. Please start the server or launch Meowtrix Standalone.",
            default_port()
        ))
    }

    /// Gracefully stops the child Node process if managed by this instance.
    pub fn stop(&mut self) {
        self.stopping.store(true, Ordering::SeqCst);
        let child = {
            let mut guard = self.managed.lock().unwrap_or_else(|e| e.into_inner());
            guard.spec = None;
            guard.child.take()
        };
        if let Some(child) = child {
            log::info!("Stopping Meowtrix Node server process...");
            terminate_child(child);
        }
    }
}

impl Drop for ServerManager {
    fn drop(&mut self) {
        self.stop();
    }
}

pub type ServerState = Mutex<ServerManager>;

fn spawn_server(spec: &SpawnSpec) -> Result<Child, String> {
    let mut cmd = Command::new(&spec.node_bin);
    cmd.arg(&spec.script)
        .env("PORT", spec.port.to_string())
        .env("HOST", "127.0.0.1")
        .env("MISTRALRS_PORT", spec.ai_port.to_string())
        .current_dir(&spec.work_dir);

    if let Some(ref data_dir) = spec.data_dir {
        cmd.env("MEOWTRIX_DATA_DIR", data_dir);
    }

    #[cfg(unix)]
    unix_proc::configure_process_group(&mut cmd);

    cmd.spawn()
        .map_err(|e| format!("Failed to spawn {} Node server: {e}", spec.label))
}

fn terminate_child(mut child: Child) {
    #[cfg(unix)]
    {
        let pid = child.id();
        unix_proc::send_sigterm_group(pid);
        let deadline = Instant::now() + STOP_GRACE_PERIOD;
        loop {
            match child.try_wait() {
                Ok(Some(_)) => return,
                Ok(None) => {
                    if Instant::now() >= deadline {
                        break;
                    }
                    std::thread::sleep(Duration::from_millis(50));
                }
                Err(_) => break,
            }
        }
        log::warn!(
            "Meowtrix Node server (pid {pid}) did not exit after SIGTERM; sending SIGKILL"
        );
        unix_proc::send_sigkill_group(pid);
        let _ = child.kill();
        let _ = child.wait();
    }
    #[cfg(not(unix))]
    {
        let _ = child.kill();
        let _ = child.wait();
    }
}

/// Sleeps for `duration` in short intervals, returning `true` early if `stopping` is set.
fn sleep_interruptible(duration: Duration, stopping: &AtomicBool) -> bool {
    let deadline = Instant::now() + duration;
    while Instant::now() < deadline {
        if stopping.load(Ordering::SeqCst) {
            return true;
        }
        let remaining = deadline.saturating_duration_since(Instant::now());
        std::thread::sleep(remaining.min(Duration::from_millis(100)));
    }
    stopping.load(Ordering::SeqCst)
}

/// Allocates an ephemeral free port from the OS kernel.
fn get_free_port() -> Result<u16, String> {
    TcpListener::bind("127.0.0.1:0")
        .and_then(|l| l.local_addr())
        .map(|addr| addr.port())
        .map_err(|e| format!("Failed to allocate an ephemeral port: {e}"))
}

/// Checks if bundled standalone payload (node binary + server.js) exists inside app resources.
fn detect_standalone_payload(app: &AppHandle) -> Option<AppMode> {
    if let Ok(res_dir) = app.path().resource_dir() {
        let candidates = [
            res_dir.join("standalone-payload"),
            res_dir.join("resources/standalone-payload"),
            res_dir.join("_up_/standalone-payload"),
        ];

        for base in candidates {
            let node = base.join("bin/node");
            let server_js = base.join("server.js");
            if node.is_file() && server_js.is_file() {
                return Some(AppMode::Standalone {
                    node_bin: node,
                    server_dir: base,
                });
            }
        }
    }
    None
}

/// Quick TCP HTTP probe to check if the server is responding on `127.0.0.1:port`.
fn check_server_ready(port: u16) -> bool {
    let addr = SocketAddr::from(([127, 0, 0, 1], port));
    if let Ok(mut stream) = TcpStream::connect_timeout(&addr, Duration::from_millis(250)) {
        let _ = stream.set_read_timeout(Some(Duration::from_millis(500)));
        let _ = stream.set_write_timeout(Some(Duration::from_millis(500)));
        let req = format!(
            "GET /api/settings HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\n\r\n"
        );
        if stream.write_all(req.as_bytes()).is_ok() {
            let mut buf = [0u8; 128];
            if let Ok(n) = stream.read(&mut buf) {
                if n > 0 && (buf.starts_with(b"HTTP/1.1 200") || buf.starts_with(b"HTTP/1.0 200")) {
                    return true;
                }
            }
        }
    }
    false
}

/// Locates a working Node.js executable on the system or bundled resources.
fn find_node_binary() -> Result<PathBuf, String> {
    if let Ok(env_path) = std::env::var("MEOWTRIX_NODE_BIN") {
        let path = PathBuf::from(env_path);
        if path.is_file() {
            return Ok(path);
        }
    }

    if Command::new("node").arg("--version").output().is_ok() {
        return Ok(PathBuf::from("node"));
    }

    let common_locations = [
        "/opt/homebrew/bin/node",
        "/usr/local/bin/node",
        "/usr/bin/node",
    ];
    for loc in common_locations {
        let p = PathBuf::from(loc);
        if p.is_file() {
            return Ok(p);
        }
    }

    if let Ok(home) = std::env::var("HOME") {
        let nvm_dir = PathBuf::from(&home).join(".nvm/versions/node");
        if nvm_dir.is_dir() {
            if let Ok(entries) = std::fs::read_dir(nvm_dir) {
                let mut versions: Vec<PathBuf> = entries
                    .filter_map(|e| e.ok())
                    .map(|e| e.path().join("bin/node"))
                    .filter(|p| p.is_file())
                    .collect();
                versions.sort();
                if let Some(latest) = versions.pop() {
                    return Ok(latest);
                }
            }
        }
    }

    #[cfg(unix)]
    {
        if let Ok(output) = Command::new("/bin/zsh")
            .args(["-l", "-c", "which node"])
            .output()
        {
            if output.status.success() {
                let path_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
                if !path_str.is_empty() {
                    let path = PathBuf::from(path_str);
                    if path.is_file() {
                        return Ok(path);
                    }
                }
            }
        }
    }

    Err("Could not find a Node.js runtime. Please install Node.js (v18+) or run Meowtrix Standalone.".to_string())
}

/// Locates `server.js` in development directories.
fn find_server_script(app: &AppHandle) -> Result<PathBuf, String> {
    if let Ok(res_dir) = app.path().resource_dir() {
        let candidate = res_dir.join("server.js");
        if candidate.is_file() {
            return Ok(candidate);
        }
    }

    let cwd_candidate = PathBuf::from("server.js");
    if cwd_candidate.is_file() {
        return Ok(cwd_candidate.canonicalize().unwrap_or(cwd_candidate));
    }

    let parent_candidate = PathBuf::from("../server.js");
    if parent_candidate.is_file() {
        return Ok(parent_candidate.canonicalize().unwrap_or(parent_candidate));
    }

    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            for ancestor in exe_dir.ancestors().take(5) {
                let candidate = ancestor.join("server.js");
                if candidate.is_file() {
                    return Ok(candidate.canonicalize().unwrap_or(candidate));
                }
            }
        }
    }

    Err("Could not locate server.js. Ensure Meowtrix is installed correctly.".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn get_free_port_returns_ephemeral_port() {
        let port = get_free_port().expect("should allocate ephemeral port");
        assert!(port > 0);
    }

    #[test]
    fn restart_tracker_bounds_restarts_and_backs_off() {
        let mut tracker = RestartTracker::new(5, Duration::from_secs(60));
        let t0 = Instant::now();
        assert_eq!(tracker.next_backoff(t0), Some(Duration::from_secs(1)));
        assert_eq!(tracker.next_backoff(t0), Some(Duration::from_secs(2)));
        assert_eq!(tracker.next_backoff(t0), Some(Duration::from_secs(4)));
        assert_eq!(tracker.next_backoff(t0), Some(Duration::from_secs(8)));
        assert_eq!(tracker.next_backoff(t0), Some(Duration::from_secs(16)));
        assert_eq!(tracker.next_backoff(t0), None);

        // Once the window expires, budget resets
        let t_later = t0 + Duration::from_secs(61);
        assert_eq!(tracker.next_backoff(t_later), Some(Duration::from_secs(1)));
    }

    #[cfg(unix)]
    #[test]
    fn terminate_child_stops_process_group_gracefully() {
        let mut cmd = Command::new("/bin/sleep");
        cmd.arg("30");
        unix_proc::configure_process_group(&mut cmd);
        let child = cmd.spawn().expect("spawn sleep");
        let start = Instant::now();
        terminate_child(child);
        // sleep exits immediately on SIGTERM, well before the 2.5s grace period
        assert!(start.elapsed() < Duration::from_secs(2));
    }
}
