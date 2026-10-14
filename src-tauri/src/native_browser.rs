//! Native browser tabs for the desktop app.
//!
//! In the desktop editions a browser tab is a real native webview (WKWebView on
//! macOS, WebView2 on Windows, WebKitGTK on Linux) placed over the tab's
//! placeholder in the main window, instead of an iframe behind the embedding
//! proxy. Sites run on their own origins with the platform's persistent cookie
//! store, so sign-ins, OAuth redirects, passkeys and WebSockets just work.
//!
//! Each tab's view lives in its own borderless *child window* of the main window
//! rather than as a second webview inside it: Tauri only treats a window as a
//! `WebviewWindow` while it holds a single webview, so a child webview would
//! break every `get_webview_window("main")` lookup (tray, overlay, updater) and,
//! in practice, stalled the main page. As a child window it moves with the main
//! window (macOS attaches it via `addChildWindow`; elsewhere we follow `Moved`
//! events) and stays above it.
//!
//! The frontend (public/nativebrowser.js) owns placement: it reports the
//! placeholder's rect in the main webview's CSS px (== logical px relative to
//! the window's content origin) and hides the view whenever DOM UI must draw
//! over it. Views are keyed by tab id and outlive the DOM — a workspace rebuild
//! hides and later re-shows the same view, so history and page state survive.
//!
//! Events go back to the page by `eval`ing `onNativeBrowserEvent(...)` in the
//! main webview (the main window is a remote origin with no event permission).
//! A handful of app shortcuts are forwarded from inside the page by navigating
//! to `meowtrix-native://key/<combo>`, which `on_navigation` cancels and relays
//! — pages in native tabs get no IPC at all.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};
use tauri::webview::{DownloadEvent, PageLoadEvent};
use tauri::{LogicalPosition, LogicalSize, Manager, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

const LABEL_PREFIX: &str = "nb-";
const KEY_SCHEME: &str = "meowtrix-native";

/// A placeholder's rect in the main page's CSS px, plus the page's viewport
/// size (CSS px) it was measured in.
#[derive(Clone, Copy)]
struct Placement {
    x: f64,
    y: f64,
    w: f64,
    h: f64,
    vw: f64,
    vh: f64,
}

/// Placements by tab id, so views can be re-placed when the main window moves.
fn rects() -> &'static Mutex<HashMap<String, Placement>> {
    static RECTS: OnceLock<Mutex<HashMap<String, Placement>>> = OnceLock::new();
    RECTS.get_or_init(|| Mutex::new(HashMap::new()))
}

const INIT_SCRIPT: &str = r#"(() => {
  if (window.top !== window || window.__mtxNative) return;
  window.__mtxNative = true;
  const mac = /Mac/.test(navigator.platform);
  const send = (combo) => { try { location.href = 'meowtrix-native://key/' + encodeURIComponent(combo); } catch (e) {} };
  window.addEventListener('keydown', (e) => {
    const primary = mac ? e.metaKey : e.ctrlKey;
    const k = (e.key || '').toLowerCase();
    let combo = null;
    if (mac && e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && k === 'k') combo = 'palette';
    else if ((e.metaKey || e.ctrlKey) && e.shiftKey && k === 'p') combo = 'palette';
    else if ((e.metaKey || e.ctrlKey) && e.altKey && /^[1-4]$/.test(e.key)) combo = 'workspace-' + e.key;
    else if ((e.metaKey || e.ctrlKey) && e.altKey && /^Digit[1-4]$/.test(e.code || '')) combo = 'workspace-' + e.code.slice(5);
    else if (primary && !e.shiftKey && !e.altKey && k === 'l') combo = 'focus-url';
    else if (primary && !e.shiftKey && !e.altKey && k === 'w') combo = 'close-tab';
    else if (primary && !e.altKey && k === 'r') { e.preventDefault(); location.reload(); return; }
    else if (primary && !e.shiftKey && !e.altKey && e.key === '[') { e.preventDefault(); history.back(); return; }
    else if (primary && !e.shiftKey && !e.altKey && e.key === ']') { e.preventDefault(); history.forward(); return; }
    if (combo) { e.preventDefault(); e.stopPropagation(); send(combo); }
  }, true);
  window.addEventListener('focus', () => send('focus'));
  // Single-page-app navigations don't fire page-load events; report them so
  // the address bar keeps up.
  let lastUrl = location.href;
  const reportUrl = () => { if (location.href !== lastUrl) { lastUrl = location.href; send('url:' + location.href); } };
  for (const m of ['pushState', 'replaceState']) {
    const orig = history[m];
    history[m] = function () { const r = orig.apply(this, arguments); setTimeout(reportUrl, 0); return r; };
  }
  window.addEventListener('popstate', reportUrl);
  window.addEventListener('hashchange', reportUrl);
})();"#;

fn label_for(id: &str) -> Option<String> {
    if id.is_empty() || id.len() > 100 || !id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
        return None;
    }
    Some(format!("{LABEL_PREFIX}{id}"))
}

fn parse_url(raw: &str) -> Result<Url, String> {
    let url: Url = raw.parse().map_err(|e| format!("invalid url: {e}"))?;
    match url.scheme() {
        "http" | "https" | "about" => Ok(url),
        other => Err(format!("unsupported scheme: {other}")),
    }
}

/// Tell the page about something that happened in tab `id`.
fn emit(app: &tauri::AppHandle, id: &str, kind: &str, extra: serde_json::Value) {
    let Some(main) = app.get_webview_window("main") else { return };
    let mut payload = serde_json::json!({ "id": id, "kind": kind });
    if let (Some(obj), serde_json::Value::Object(more)) = (payload.as_object_mut(), extra) {
        obj.extend(more);
    }
    let _ = main.eval(format!(
        "if (typeof onNativeBrowserEvent === 'function') {{ onNativeBrowserEvent({payload}); }}"
    ));
}

fn get(app: &tauri::AppHandle, id: &str) -> Result<WebviewWindow, String> {
    let label = label_for(id).ok_or("bad tab id")?;
    app.get_webview_window(&label).ok_or_else(|| "no such native browser tab".to_string())
}

/// Move/size tab `id`'s window over its placeholder. The rect is mapped as a
/// fraction of the page's viewport onto the main window's actual content area,
/// so page zoom or a CSS-px/point mismatch can't skew it. Done in logical units
/// derived from the *main* window's scale (on macOS logical == points), since a
/// hidden child window can report a different scale factor than its monitor's.
fn place(app: &tauri::AppHandle, win: &WebviewWindow, id: &str) {
    let Some(p) = rects().lock().unwrap().get(id).copied() else { return };
    let Some(main) = app.get_webview_window("main") else { return };
    let (Ok(scale), Ok(origin), Ok(size)) = (main.scale_factor(), main.inner_position(), main.inner_size()) else { return };
    let origin = origin.to_logical::<f64>(scale);
    let size = size.to_logical::<f64>(scale);
    let kx = size.width / p.vw.max(1.0);
    let ky = size.height / p.vh.max(1.0);
    let _ = win.set_position(LogicalPosition::new(origin.x + p.x * kx, origin.y + p.y * ky));
    let _ = win.set_size(LogicalSize::new((p.w * kx).max(1.0), (p.h * ky).max(1.0)));
}

/// Re-place every view (the main window moved or resized). Called from the
/// main window's event handler in lib.rs.
pub fn reposition_all(app: &tauri::AppHandle) {
    for (label, win) in app.webview_windows() {
        if let Some(id) = label.strip_prefix(LABEL_PREFIX) {
            if win.is_visible().unwrap_or(false) {
                place(app, &win, id);
            }
        }
    }
}

/// Whether a native browser view has keyboard focus — the main window's
/// dismiss-on-blur (quick overlay) must not fire when the user clicks into one.
pub fn any_focused(app: &tauri::AppHandle) -> bool {
    app.webview_windows()
        .iter()
        .any(|(label, win)| label.starts_with(LABEL_PREFIX) && win.is_focused().unwrap_or(false))
}

/// Show without taking keyboard focus (a plain `show()` makes the window key on
/// macOS, which would steal typing from the terminal the user is in).
fn show_passive(app: &tauri::AppHandle, win: &WebviewWindow) {
    #[cfg(target_os = "macos")]
    {
        let main = app.get_webview_window("main");
        let w = win.clone();
        let _ = win.run_on_main_thread(move || {
            use objc2_app_kit::{NSWindow, NSWindowOrderingMode};
            unsafe {
                let Ok(child_ptr) = w.ns_window() else { return };
                let child = &*(child_ptr as *mut NSWindow);
                // Ordering a child window out detaches it from its parent; attach
                // it again so it keeps moving with (and staying above) the main window.
                if let Some(Ok(parent_ptr)) = main.as_ref().map(|m| m.ns_window()) {
                    let parent = &*(parent_ptr as *mut NSWindow);
                    parent.addChildWindow_ordered(child, NSWindowOrderingMode::Above);
                }
                child.orderFront(None);
            }
        });
    }
    #[cfg(not(target_os = "macos"))]
    {
        let main_focused = app.get_webview_window("main").map(|m| m.is_focused().unwrap_or(false)).unwrap_or(false);
        let _ = win.show();
        if main_focused {
            if let Some(m) = app.get_webview_window("main") {
                let _ = m.set_focus();
            }
        }
    }
}

fn downloads_dir() -> PathBuf {
    std::env::var("HOME").map(PathBuf::from).unwrap_or_else(|_| PathBuf::from(".")).join("Downloads")
}

/// A filename in ~/Downloads that doesn't clobber an existing file.
fn unique_download_path(url: &Url) -> PathBuf {
    let name = url
        .path_segments()
        .and_then(|mut s| s.next_back().map(|n| n.to_string()))
        .filter(|n| !n.is_empty())
        .unwrap_or_else(|| "download".to_string());
    let name: String = name.chars().map(|c| if c == '/' || c == '\\' || c == ':' { '_' } else { c }).collect();
    let dir = downloads_dir();
    let candidate = dir.join(&name);
    if !candidate.exists() {
        return candidate;
    }
    let (stem, ext) = match name.rsplit_once('.') {
        Some((s, e)) if !s.is_empty() => (s.to_string(), format!(".{e}")),
        _ => (name.clone(), String::new()),
    };
    for i in 1..1000 {
        let p = dir.join(format!("{stem} ({i}){ext}"));
        if !p.exists() {
            return p;
        }
    }
    dir.join(format!("{stem}-{}{ext}", std::process::id()))
}

/// Feature probe: the server self-updates independently of the desktop app,
/// so the frontend checks for this command before using native tabs.
#[tauri::command]
pub fn nb_supported() -> bool {
    true
}

/// Create (or re-attach to) the native view for tab `id`, placed over the
/// given placeholder rect. Returns the URL it's currently showing.
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn nb_open(
    app: tauri::AppHandle,
    id: String,
    url: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    vw: f64,
    vh: f64,
    visible: bool,
) -> Result<String, String> {
    let label = label_for(&id).ok_or("bad tab id")?;
    rects().lock().unwrap().insert(id.clone(), Placement { x, y, w: width, h: height, vw, vh });
    if let Some(existing) = app.get_webview_window(&label) {
        place(&app, &existing, &id);
        if visible { show_passive(&app, &existing) } else { let _ = existing.hide(); }
        return Ok(existing.url().map(|u| u.to_string()).unwrap_or_default());
    }

    let start = parse_url(if url.is_empty() { "about:blank" } else { &url })?;
    let main = app.get_webview_window("main").ok_or("main window missing")?;

    let app_nav = app.clone();
    let id_nav = id.clone();
    let app_load = app.clone();
    let id_load = id.clone();
    let app_title = app.clone();
    let id_title = id.clone();
    let app_new = app.clone();
    let id_new = id.clone();
    let app_dl = app.clone();
    let id_dl = id.clone();

    let win = WebviewWindowBuilder::new(&app, &label, WebviewUrl::External(start))
        .parent(&main)
        .map_err(|e| e.to_string())?
        .title("Meowtrix Browser")
        .decorations(false)
        .shadow(false)
        .resizable(false)
        .skip_taskbar(true)
        .visible(false)
        .focused(false)
        .accept_first_mouse(true)
        .initialization_script(INIT_SCRIPT)
        .on_navigation(move |u| {
            if u.scheme() == KEY_SCHEME {
                // meowtrix-native://key/<combo> → host "key", path "/<combo>"
                let combo = urlencoding_decode(u.path().trim_start_matches('/'));
                match combo.strip_prefix("url:") {
                    Some(u) => emit(&app_nav, &id_nav, "url", serde_json::json!({ "url": u })),
                    None => emit(&app_nav, &id_nav, "key", serde_json::json!({ "key": combo })),
                }
                return false;
            }
            matches!(u.scheme(), "http" | "https" | "about" | "blob" | "data")
        })
        .on_page_load(move |_win, payload| {
            let kind = match payload.event() {
                PageLoadEvent::Started => "loading",
                PageLoadEvent::Finished => "loaded",
            };
            emit(&app_load, &id_load, kind, serde_json::json!({ "url": payload.url().to_string() }));
        })
        .on_document_title_changed(move |_win, title| {
            emit(&app_title, &id_title, "title", serde_json::json!({ "title": title }));
        })
        .on_new_window(move |u, _features| {
            // target=_blank / window.open → a new tab beside this one.
            emit(&app_new, &id_new, "new-window", serde_json::json!({ "url": u.to_string() }));
            tauri::webview::NewWindowResponse::Deny
        })
        .on_download(move |_wv, event| {
            match event {
                DownloadEvent::Requested { url, destination } => {
                    let _ = std::fs::create_dir_all(downloads_dir());
                    *destination = unique_download_path(&url);
                    emit(&app_dl, &id_dl, "download-started", serde_json::json!({ "url": url.to_string(), "path": destination.to_string_lossy() }));
                }
                DownloadEvent::Finished { url, success, .. } => {
                    emit(&app_dl, &id_dl, "download-finished", serde_json::json!({ "url": url.to_string(), "success": success }));
                }
                _ => {}
            }
            true
        })
        .build()
        .map_err(|e| e.to_string())?;
    place(&app, &win, &id);
    if visible {
        show_passive(&app, &win);
    }
    Ok(url)
}

/// Minimal percent-decoding for the forwarded shortcut names.
fn urlencoding_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(b) = u8::from_str_radix(&s[i + 1..i + 3], 16) {
                out.push(b);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn nb_set_bounds(app: tauri::AppHandle, id: String, x: f64, y: f64, width: f64, height: f64, vw: f64, vh: f64) -> Result<(), String> {
    let win = get(&app, &id)?;
    rects().lock().unwrap().insert(id.clone(), Placement { x, y, w: width, h: height, vw, vh });
    place(&app, &win, &id);
    Ok(())
}

#[tauri::command]
pub async fn nb_set_visible(app: tauri::AppHandle, id: String, visible: bool) -> Result<(), String> {
    let win = get(&app, &id)?;
    if visible {
        place(&app, &win, &id);
        show_passive(&app, &win);
        Ok(())
    } else {
        win.hide().map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub async fn nb_navigate(app: tauri::AppHandle, id: String, url: String) -> Result<(), String> {
    let wv = get(&app, &id)?;
    wv.navigate(parse_url(&url)?).map_err(|e| e.to_string())
}

/// back | forward | reload | stop
#[tauri::command]
pub async fn nb_action(app: tauri::AppHandle, id: String, action: String) -> Result<(), String> {
    let wv = get(&app, &id)?;
    let js = match action.as_str() {
        "back" => "history.back()",
        "forward" => "history.forward()",
        "reload" => "location.reload()",
        "stop" => "window.stop()",
        _ => return Err("unknown action".into()),
    };
    wv.eval(js).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn nb_focus(app: tauri::AppHandle, id: String) -> Result<(), String> {
    get(&app, &id)?.set_focus().map_err(|e| e.to_string())
}

/// Give keyboard focus back to the app's own webview (e.g. before opening the
/// command palette from a shortcut pressed inside a native page).
#[tauri::command]
pub async fn nb_focus_main(app: tauri::AppHandle) -> Result<(), String> {
    let main = app.get_webview_window("main").ok_or("main window missing")?;
    main.set_focus().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn nb_zoom(app: tauri::AppHandle, id: String, level: f64) -> Result<(), String> {
    get(&app, &id)?.set_zoom(level.clamp(0.25, 5.0)).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn nb_close(app: tauri::AppHandle, id: String) -> Result<(), String> {
    rects().lock().unwrap().remove(&id);
    match get(&app, &id) {
        Ok(wv) => wv.close().map_err(|e| e.to_string()),
        Err(_) => Ok(()),
    }
}

/// Hide every native browser view (e.g. the page reloaded and lost track of
/// them, or the window switched into overlay mode). The page re-shows the ones
/// it still has tabs for.
#[tauri::command]
pub async fn nb_hide_all(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let mut ids = Vec::new();
    for (label, win) in app.webview_windows() {
        if let Some(id) = label.strip_prefix(LABEL_PREFIX) {
            let _ = win.hide();
            ids.push(id.to_string());
        }
    }
    Ok(ids)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn labels_are_sanitized() {
        assert_eq!(label_for("id-3-abc12").as_deref(), Some("nb-id-3-abc12"));
        assert!(label_for("").is_none());
        assert!(label_for("../evil").is_none());
        assert!(label_for("a b").is_none());
    }

    #[test]
    fn only_web_schemes() {
        assert!(parse_url("https://example.com").is_ok());
        assert!(parse_url("about:blank").is_ok());
        assert!(parse_url("file:///etc/passwd").is_err());
        assert!(parse_url("javascript:alert(1)").is_err());
    }

    #[test]
    fn decodes_combo() {
        assert_eq!(urlencoding_decode("workspace-2"), "workspace-2");
        assert_eq!(urlencoding_decode("a%20b"), "a b");
    }
}
