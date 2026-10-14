// ── Native browser tabs (desktop app) ────────────────────────────────────────
// In the Tauri desktop app a 'browser' tab is shown with a real native webview
// (src-tauri/src/native_browser.rs) layered over a placeholder, instead of an
// iframe behind the embedding proxy. Sites keep their own origins and the OS
// cookie store, so sign-ins stick and nothing needs rewriting. The tab type is
// still 'browser' — the engine is a per-client rendering choice, so the same
// saved layout opens as a native view here and as a proxy iframe in a plain
// browser or on a phone.
//
// A native view always draws on top of the DOM, so this file keeps it glued to
// its placeholder's rect every animation frame and hides it whenever anything
// in the DOM covers the placeholder (palette, menus, dialogs, the inactive-
// session overlay, …) — checked by hit-testing sample points, which needs no
// cooperation from the code that draws those overlays.

const nativeTabs = new Map(); // tab id → tab

function nbInvoke(cmd, args = {}) {
  const t = window.__TAURI_INTERNALS__;
  if (t && typeof t.invoke === 'function') return t.invoke(cmd, args);
  if (window.__TAURI__?.core?.invoke) return window.__TAURI__.core.invoke(cmd, args);
  return Promise.reject(new Error('not in the desktop app'));
}

// Resolved before the workspace is restored (app.js bootstrapSession awaits
// it). The server self-updates independently of the desktop app, so an older
// app build without the native commands falls back to the proxy.
let nativeBrowserSupported = false;
let nbEngineAtStartup = 'auto';
const nativeBrowserProbe = (async () => {
  if (!(window.__TAURI_INTERNALS__ || window.__TAURI__) || window.DEMO_MODE) return false;
  try {
    nativeBrowserSupported = (await nbInvoke('nb_supported')) === true;
  } catch { nativeBrowserSupported = false; }
  if (nativeBrowserSupported) {
    // settings.js may not have loaded yet when the workspace is restored; read
    // the engine choice ourselves so restored tabs honour "proxy".
    try { nbEngineAtStartup = (await (await fetch('/api/settings')).json()).browserEngine || 'auto'; } catch {}
    // After a page reload, views from the previous page are still on screen
    // over a fresh DOM. Hide them; tabs that still exist re-claim theirs by id,
    // and anything unclaimed is closed once the layout has settled.
    try {
      const orphans = await nbInvoke('nb_hide_all');
      setTimeout(() => {
        for (const id of orphans || []) if (!nativeTabs.has(id)) nbInvoke('nb_close', { id }).catch(() => {});
      }, 20000);
    } catch {}
  }
  return nativeBrowserSupported;
})();

function nativeBrowserEnabled() {
  if (!nativeBrowserSupported) return false;
  const live = typeof getSettings === 'function' ? getSettings().browserEngine : undefined;
  const engine = live || nbEngineAtStartup;
  return engine !== 'proxy';
}

function initNativeBrowserTab(tab, viewEl, label, initialUrl) {
  viewEl.classList.add('browser-view', 'native-browser-view');
  tab.nativeBrowser = true;

  const bar = document.createElement('div');
  bar.className = 'browser-bar';
  const mkBtn = (text, title) => { const b = document.createElement('button'); b.textContent = text; b.title = title; return b; };
  const backBtn = mkBtn('←', 'Back (⌘[)');
  const fwdBtn = mkBtn('→', 'Forward (⌘])');
  const reloadBtn = mkBtn('↺', 'Reload (⌘R)');
  const hostBtn = mkBtn('⇄', 'Open this page in a Host Browser tab');
  const urlInput = document.createElement('input');
  urlInput.className = 'browser-url';
  urlInput.type = 'text';
  urlInput.placeholder = 'Enter URL…';
  urlInput.spellcheck = false;
  bar.append(backBtn, fwdBtn, reloadBtn, urlInput, hostBtn);

  const loadingBar = document.createElement('div');
  loadingBar.className = 'browser-loading';

  const host = document.createElement('div');
  host.className = 'native-browser-host';
  const cover = document.createElement('div');
  cover.className = 'native-browser-cover';
  host.appendChild(cover);

  const startEl = document.createElement('div');
  startEl.className = 'browser-start';
  startEl.innerHTML = `
    <div class="browser-start-card">
      <div class="browser-start-icon">${getTabIconSvg('browser')}</div>
      <h2>Browser</h2>
      <p>Type a URL in the address bar above, then press <kbd>Enter</kbd>.</p>
      <ul>
        <li>Pages open in a native browser view, so sign-ins are kept like in any browser.</li>
        <li><strong>⌘L</strong> focuses the address bar, <strong>⌘[</strong> / <strong>⌘]</strong> go back and forward.</li>
      </ul>
    </div>`;

  viewEl.append(bar, loadingBar, host, startEl);

  let created = false;
  let creating = null;
  let disposed = false;
  tab.currentUrl = initialUrl || null;

  const setLabel = (title) => {
    if (tab.isCustomLabel) return;
    if (title) { label.textContent = title; return; }
    try { label.textContent = new URL(tab.currentUrl).hostname.replace(/^www\./, ''); }
    catch { label.textContent = 'New Tab'; }
  };

  const showStart = (on) => {
    startEl.classList.toggle('visible', on);
    host.style.display = on ? 'none' : '';
  };

  const ensureView = () => {
    if (created || disposed) return Promise.resolve();
    if (creating) return creating;
    const r = host.getBoundingClientRect();
    creating = nbInvoke('nb_open', {
      id: tab.id,
      url: tab.currentUrl || 'about:blank',
      x: r.left, y: r.top, width: Math.max(1, r.width), height: Math.max(1, r.height),
      vw: window.innerWidth, vh: window.innerHeight,
      visible: false,
    }).then((current) => {
      created = true;
      tab.nbLast = null; // force a placement push
      // Re-attached to a live view (layout rebuild): adopt what it shows.
      if (current && current !== 'about:blank' && current !== tab.currentUrl) {
        tab.currentUrl = current;
        urlInput.value = current;
        setLabel();
      }
      if (tab.zoomLevel && tab.zoomLevel !== 1) nbInvoke('nb_zoom', { id: tab.id, level: tab.zoomLevel }).catch(() => {});
    }).catch((e) => {
      cover.textContent = 'Couldn’t open a native browser view: ' + (e?.message || e);
      host.classList.add('covered');
    }).finally(() => { creating = null; });
    return creating;
  };

  const navigate = (url) => {
    url = String(url || '').trim();
    if (!url) return;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = (/^(localhost|127\.|\[::1\])/.test(url) ? 'http://' : 'https://') + url;
    if (!/^(https?:|about:)/i.test(url)) return;
    tab.currentUrl = url;
    urlInput.value = url;
    setLabel();
    showStart(false);
    loadingBar.classList.add('active');
    if (created) nbInvoke('nb_navigate', { id: tab.id, url }).catch(() => {});
    else ensureView();
    if (typeof saveSessionState === 'function') saveSessionState();
  };
  tab.navigate = navigate;

  urlInput.addEventListener('focus', () => urlInput.select());
  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      navigate(urlInput.value);
      urlInput.blur();
      if (created) nbInvoke('nb_focus', { id: tab.id }).catch(() => {});
    }
    if (e.key === 'Escape') { urlInput.value = tab.currentUrl || ''; urlInput.blur(); }
  });
  backBtn.addEventListener('click', () => nbInvoke('nb_action', { id: tab.id, action: 'back' }).catch(() => {}));
  fwdBtn.addEventListener('click', () => nbInvoke('nb_action', { id: tab.id, action: 'forward' }).catch(() => {}));
  reloadBtn.addEventListener('click', () => nbInvoke('nb_action', { id: tab.id, action: tab.nbLoading ? 'stop' : 'reload' }).catch(() => {}));
  hostBtn.addEventListener('click', () => {
    const p = paneOfTab(tab.tabEl);
    if (p) { addTab(p, 'hostbrowser', undefined, undefined, tab.currentUrl || undefined); saveSessionState(); }
  });

  tab.zoom = (level) => {
    tab.zoomLevel = level;
    startEl.style.zoom = level;
    if (created) nbInvoke('nb_zoom', { id: tab.id, level }).catch(() => {});
  };

  // Events from the native view (see onNativeBrowserEvent below).
  tab.onNativeEvent = (ev) => {
    switch (ev.kind) {
      case 'loading':
      case 'loaded':
      case 'url': {
        const loading = ev.kind === 'loading';
        if (ev.kind !== 'url') {
          tab.nbLoading = loading;
          loadingBar.classList.toggle('active', loading);
          reloadBtn.textContent = loading ? '✕' : '↺';
        }
        if (ev.url && ev.url !== 'about:blank' && ev.url !== tab.currentUrl) {
          tab.currentUrl = ev.url;
          if (document.activeElement !== urlInput) urlInput.value = ev.url;
          if (ev.kind !== 'loading' && typeof saveSessionState === 'function') saveSessionState();
          if (!loading) setLabel(tab.nbTitle);
        }
        break;
      }
      case 'title':
        tab.nbTitle = ev.title || '';
        setLabel(tab.nbTitle);
        break;
      case 'new-window': {
        const p = paneOfTab(tab.tabEl);
        if (p && ev.url) { addTab(p, 'browser', undefined, undefined, ev.url); saveSessionState(); }
        break;
      }
      case 'download-started':
        if (typeof showToast === 'function') showToast(`Downloading to ${ev.path}…`);
        break;
      case 'download-finished':
        if (typeof showToast === 'function') showToast(ev.success ? 'Download finished (saved to ~/Downloads)' : 'Download failed');
        break;
      case 'key': handleNativeKey(tab, ev.key, urlInput); break;
    }
  };

  // View teardown (workspace rebuild): hide, keep the page alive for re-attach.
  tab.disposeNativeBrowser = () => {
    disposed = true;
    nativeTabs.delete(tab.id);
    if (created) nbInvoke('nb_set_visible', { id: tab.id, visible: false }).catch(() => {});
  };
  // Tab closed: close the native view.
  tab.destroyNativeBrowser = () => {
    tab.disposeNativeBrowser();
    nbInvoke('nb_close', { id: tab.id }).catch(() => {});
  };

  tab.nbHost = host;
  tab.nbIsCreated = () => created;
  nativeTabs.set(tab.id, tab);

  const homepage = (typeof getSettings === 'function' ? (getSettings().browserHomepage || '') : '').trim();
  if (tab.currentUrl) { urlInput.value = tab.currentUrl; setLabel(); showStart(false); nbNextFrame(ensureView); }
  else if (homepage) nbNextFrame(() => navigate(homepage));
  else {
    // A blank tab may still have a live view (re-attach after a rebuild).
    showStart(true);
    label.textContent = 'New Tab';
  }
  startNativeBrowserLoop();
}

function handleNativeKey(tab, key, urlInput) {
  const focusMain = () => nbInvoke('nb_focus_main').catch(() => {});
  if (key === 'focus') {
    const p = paneOfTab(tab.tabEl);
    if (p && typeof setActivePane === 'function') setActivePane(p);
  } else if (key === 'palette') {
    focusMain().then(() => { if (typeof openPalette === 'function') openPalette(); });
  } else if (key === 'focus-url') {
    focusMain().then(() => { urlInput.focus(); urlInput.select(); });
  } else if (key === 'close-tab') {
    const p = paneOfTab(tab.tabEl);
    if (p) closeTab(p, tab.id);
  } else if (/^workspace-[1-4]$/.test(key)) {
    focusMain().then(() => { if (typeof switchWorkspace === 'function') switchWorkspace(Number(key.slice(-1)) - 1); });
  }
}

// Called from Rust (native_browser.rs) via eval.
function onNativeBrowserEvent(ev) {
  const tab = ev && nativeTabs.get(ev.id);
  if (tab && tab.onNativeEvent) tab.onNativeEvent(ev);
}

// ── Placement loop ──
// Each frame: compute every native tab's rect + whether it should be visible,
// and push only what changed over IPC.
// WebKit stops requestAnimationFrame in a window macOS considers occluded,
// so each frame is scheduled with both rAF (smooth while visible) and a timer
// (keeps placement right regardless); whichever fires first runs the tick.
let nbLoopRunning = false;
function nbNextFrame(fn) {
  let done = false;
  const run = () => { if (!done) { done = true; fn(); } };
  requestAnimationFrame(run);
  setTimeout(run, 50);
}
function startNativeBrowserLoop() {
  if (nbLoopRunning) return;
  nbLoopRunning = true;
  let frame = 0;
  const tick = () => {
    if (!nativeTabs.size) { nbLoopRunning = false; return; }
    frame++;
    const checkOcclusion = frame % 3 === 0; // hit-testing is cheap, but not free
    for (const tab of nativeTabs.values()) nbSyncTab(tab, checkOcclusion);
    nbNextFrame(tick);
  };
  nbNextFrame(tick);
}

function nbVisibleRect(tab) {
  const host = tab.nbHost;
  if (!host || !host.isConnected || !tab.viewEl.classList.contains('active')) return null;
  if (document.visibilityState === 'hidden') return null;
  if (document.body.classList.contains('dragging-tab') || document.body.classList.contains('resizing-console')) return null;
  const ws = host.closest('.workspace-view');
  if (ws && !ws.classList.contains('active')) return null;
  if (host.style.display === 'none' || host.offsetParent === null) return null;
  const r = host.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return null;
  return r;
}

// Is any DOM element drawn over the placeholder? Sample a grid of points.
function nbIsOccluded(host, r) {
  const xs = [r.left + 8, r.left + r.width / 2, r.right - 8];
  const ys = [r.top + 8, r.top + r.height / 2, r.bottom - 8];
  for (const x of xs) {
    for (const y of ys) {
      const el = document.elementFromPoint(x, y);
      if (el && el !== host && !host.contains(el)) return true;
    }
  }
  return false;
}

function nbSyncTab(tab, checkOcclusion) {
  if (!tab.nbIsCreated || !tab.nbIsCreated()) return;
  const r = nbVisibleRect(tab);
  if (checkOcclusion || tab.nbOccluded === undefined) tab.nbOccluded = r ? nbIsOccluded(tab.nbHost, r) : false;
  const visible = !!r && !tab.nbOccluded;
  tab.nbHost.classList.toggle('covered', !!r && tab.nbOccluded);
  const last = tab.nbLast || {};
  if (visible) {
    const x = Math.round(r.left), y = Math.round(r.top), w = Math.round(r.width), h = Math.round(r.height);
    const vw = window.innerWidth, vh = window.innerHeight;
    if (last.x !== x || last.y !== y || last.w !== w || last.h !== h || last.vw !== vw || last.vh !== vh || !last.visible) {
      // vw/vh let the native side map CSS px onto the window exactly (page zoom).
      nbInvoke('nb_set_bounds', { id: tab.id, x, y, width: w, height: h, vw, vh }).catch(() => {});
      if (!last.visible) nbInvoke('nb_set_visible', { id: tab.id, visible: true }).catch(() => {});
      tab.nbLast = { x, y, w, h, vw, vh, visible: true };
    }
  } else if (last.visible !== false) {
    nbInvoke('nb_set_visible', { id: tab.id, visible: false }).catch(() => {});
    tab.nbLast = { ...last, visible: false };
  }
}
