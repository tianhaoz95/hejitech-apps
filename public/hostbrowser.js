// ── Host browser tab ─────────────────────────────────────────────────────────
// A 'hostbrowser' tab shows a page running in a real Chromium on the host (see
// hostbrowser-service.js): the server streams JPEG frames over a per-tab
// WebSocket (/hostbrowser/<tabId>) and this file paints them onto a canvas and
// forwards input back. Because the browser is real and lives on the host, sites
// run on their own origins — logins, OAuth, passkeys and WebSockets work — and
// the signed-in profile follows the user to any device.
//
// The page outlives this view (like a PTY): closing the socket only detaches,
// so refreshes, workspace rebuilds and device handoffs re-attach to the live
// page. Only closeTab() sends 'destroy'.

const HB_IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
const hostBrowserTabs = new Set();

function hbIsTouchDevice() {
  return window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
}

function initHostBrowserTab(tab, viewEl, label, initialUrl) {
  viewEl.classList.add('browser-view', 'hostbrowser-view');
  hostBrowserTabs.add(tab);

  // ── Chrome (toolbar) ──
  const bar = document.createElement('div');
  bar.className = 'browser-bar';
  const mkBtn = (text, title) => { const b = document.createElement('button'); b.textContent = text; b.title = title; return b; };
  const backBtn = mkBtn('←', 'Back');
  const fwdBtn = mkBtn('→', 'Forward');
  const reloadBtn = mkBtn('↺', 'Reload');
  const kbdBtn = mkBtn('⌨', 'Show keyboard');
  kbdBtn.className = 'hostbrowser-kbd-btn';
  const consoleBtn = mkBtn('Console', 'Toggle page console');
  consoleBtn.className = 'browser-console-toggle';
  const badge = document.createElement('span');
  badge.className = 'hostbrowser-badge';
  badge.textContent = 'HOST';
  badge.title = 'A real Chromium running on the host machine — sign-ins are kept in its profile.';
  const urlInput = document.createElement('input');
  urlInput.className = 'browser-url';
  urlInput.type = 'text';
  urlInput.placeholder = 'Enter URL…';
  urlInput.spellcheck = false;
  urlInput.autocapitalize = 'off';
  bar.append(backBtn, fwdBtn, reloadBtn, badge, urlInput, kbdBtn, consoleBtn);

  const loadingBar = document.createElement('div');
  loadingBar.className = 'browser-loading';

  // ── Viewport ──
  const stage = document.createElement('div');
  stage.className = 'hostbrowser-stage';
  const canvas = document.createElement('canvas');
  canvas.className = 'hostbrowser-canvas';
  const ctx2d = canvas.getContext('2d', { alpha: false });
  // Receives keyboard focus, IME composition and soft-keyboard input; kept on
  // top of the canvas but invisible.
  const sink = document.createElement('textarea');
  sink.className = 'hostbrowser-input';
  sink.autocapitalize = 'off';
  sink.autocomplete = 'off';
  sink.spellcheck = false;
  sink.setAttribute('autocorrect', 'off');
  sink.setAttribute('aria-label', 'Host browser keyboard input');
  const overlay = document.createElement('div');
  overlay.className = 'hostbrowser-overlay';
  stage.append(canvas, sink, overlay);

  // ── Console ──
  const consolePanel = document.createElement('div');
  consolePanel.className = 'browser-console-panel';
  consolePanel.style.height = '160px';
  consolePanel.style.display = tab.consoleOpen ? 'flex' : 'none';
  const consoleHeader = document.createElement('div');
  consoleHeader.className = 'browser-console-header';
  consoleHeader.innerHTML = '<div class="browser-console-title"><span>Console</span></div>';
  const consoleClear = mkBtn('🗑️ Clear', 'Clear console');
  consoleClear.className = 'console-clear-btn';
  const consoleControls = document.createElement('div');
  consoleControls.className = 'browser-console-controls';
  consoleControls.append(consoleClear);
  consoleHeader.append(consoleControls);
  const consoleLogs = document.createElement('div');
  consoleLogs.className = 'browser-console-logs';
  consolePanel.append(consoleHeader, consoleLogs);
  consoleBtn.classList.toggle('active', !!tab.consoleOpen);
  consoleBtn.addEventListener('click', () => {
    tab.consoleOpen = !tab.consoleOpen;
    consolePanel.style.display = tab.consoleOpen ? 'flex' : 'none';
    consoleBtn.classList.toggle('active', tab.consoleOpen);
    if (typeof saveSessionState === 'function') saveSessionState();
  });
  consoleClear.addEventListener('click', () => { consoleLogs.innerHTML = ''; });
  const addConsoleLog = (level, text) => {
    const item = document.createElement('div');
    item.className = `console-log-item console-log-${level}`;
    const t = new Date();
    item.innerHTML = '<span class="console-log-time"></span><span class="console-log-message"></span>';
    item.firstChild.textContent = `[${t.toTimeString().split(' ')[0]}]`;
    item.lastChild.textContent = text;
    const atBottom = consoleLogs.scrollHeight - consoleLogs.clientHeight - consoleLogs.scrollTop < 30;
    consoleLogs.appendChild(item);
    while (consoleLogs.childNodes.length > 500) consoleLogs.firstChild.remove();
    if (atBottom) consoleLogs.scrollTop = consoleLogs.scrollHeight;
  };

  viewEl.append(bar, loadingBar, stage, consolePanel);

  // ── Overlay messages (connecting / errors / no browser installed) ──
  const showOverlay = (html, { dim = true } = {}) => {
    overlay.innerHTML = html;
    overlay.classList.add('visible');
    overlay.classList.toggle('dim', dim);
  };
  const hideOverlay = () => { overlay.classList.remove('visible'); overlay.innerHTML = ''; };

  // ── Socket ──
  let ws = null;
  let disposed = false;
  let retryTimer = null;
  let gotFrame = false;
  let fatal = false;
  tab.currentUrl = initialUrl || null;

  const send = (msg) => { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg)); };

  const viewSize = () => {
    const r = stage.getBoundingClientRect();
    return { width: Math.max(1, Math.round(r.width)), height: Math.max(1, Math.round(r.height)) };
  };
  const isVisible = () => viewEl.classList.contains('active') && !document.hidden && stage.offsetParent !== null;

  const connect = () => {
    if (disposed) return;
    clearTimeout(retryTimer);
    fatal = false;
    if (ws) { try { ws.onclose = null; ws.close(); } catch {} }
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const sock = new WebSocket(`${proto}//${location.host}/hostbrowser/${encodeURIComponent(tab.id)}`);
    sock.binaryType = 'arraybuffer';
    ws = sock;
    if (!gotFrame) showOverlay('<div class="hostbrowser-msg"><div class="hostbrowser-spinner"></div>Starting host browser…</div>');
    sock.onopen = () => {
      const { width, height } = viewSize();
      const homepage = (typeof getSettings === 'function' ? (getSettings().browserHomepage || '') : '').trim();
      send({
        t: 'init',
        url: tab.currentUrl || homepage || 'about:blank',
        width, height,
        dpr: window.devicePixelRatio || 1,
        zoom: tab.zoomLevel || 1,
        touch: hbIsTouchDevice(),
        mobile: hbIsTouchDevice() && width < 700,
        mac: HB_IS_MAC,
        visible: isVisible(),
      });
    };
    sock.onmessage = (e) => {
      if (typeof e.data !== 'string') { onFrame(e.data); return; }
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }
      onMessage(msg);
    };
    sock.onclose = () => {
      if (ws !== sock || disposed || fatal) return;
      ws = null;
      retryTimer = setTimeout(connect, 1000);
    };
  };

  // Paint frames as they arrive; ack each one so the server keeps streaming.
  let pendingFrame = null, painting = false;
  const onFrame = (buf) => {
    pendingFrame = buf;
    if (!painting) paint();
  };
  const paint = async () => {
    painting = true;
    while (pendingFrame) {
      const buf = pendingFrame;
      pendingFrame = null;
      try {
        const bmp = await createImageBitmap(new Blob([buf], { type: 'image/jpeg' }));
        if (canvas.width !== bmp.width || canvas.height !== bmp.height) {
          canvas.width = bmp.width;
          canvas.height = bmp.height;
        }
        ctx2d.drawImage(bmp, 0, 0);
        bmp.close();
        if (!gotFrame) { gotFrame = true; hideOverlay(); }
      } catch {}
      send({ t: 'ack' });
    }
    painting = false;
  };

  const setLabel = (title, url) => {
    if (tab.isCustomLabel) return;
    let text = title;
    if (!text) { try { text = new URL(url).hostname.replace(/^www\./, ''); } catch { text = ''; } }
    label.textContent = text || 'Host Browser';
  };

  const onMessage = (msg) => {
    switch (msg.t) {
      case 'state': {
        const changed = msg.url && msg.url !== tab.currentUrl && msg.url !== 'about:blank';
        if (msg.url && msg.url !== 'about:blank') tab.currentUrl = msg.url;
        if (document.activeElement !== urlInput) urlInput.value = msg.url === 'about:blank' ? '' : (msg.url || '');
        backBtn.disabled = !msg.canGoBack;
        fwdBtn.disabled = !msg.canGoForward;
        loadingBar.classList.toggle('active', !!msg.loading);
        reloadBtn.textContent = msg.loading ? '✕' : '↺';
        reloadBtn.title = msg.loading ? 'Stop' : 'Reload';
        tab.hbLoading = !!msg.loading;
        setLabel(msg.title, msg.url);
        if (changed && typeof saveSessionState === 'function') saveSessionState();
        break;
      }
      case 'cursor': stage.style.cursor = /^[a-z-]+$/.test(msg.cursor) ? msg.cursor : 'default'; break;
      case 'editable': tab.hbEditable = !!msg.editable; kbdBtn.classList.toggle('active', !!msg.editable); break;
      case 'clipboard': hbCopyToClipboard(msg.text); break;
      case 'console': addConsoleLog(msg.level || 'log', msg.text || ''); break;
      case 'passkey':
        // See PAGE_INIT_SCRIPT in hostbrowser-service.js.
        if (typeof showToast === 'function') showToast('Passkeys can’t be used in a host browser tab — choose another sign-in method (e.g. “Try another way”).');
        break;
      case 'error': if (typeof showToast === 'function') showToast(msg.message); break;
      case 'download': {
        if (typeof showToast === 'function') {
          showToast(`Downloaded ${msg.name} to the host — click to save it here`, () => {
            if (typeof triggerDownload === 'function') triggerDownload(msg.path);
          });
        }
        break;
      }
      case 'dialog': answerDialog(msg); break;
      case 'filechooser': chooseFiles(msg.multiple); break;
      case 'replaced': {
        showOverlay(`<div class="hostbrowser-msg">This page is being viewed on another device or window.<button class="hostbrowser-action" data-act="reattach">View it here</button></div>`);
        break;
      }
      case 'closed':
      case 'crashed': {
        gotFrame = false;
        showOverlay(`<div class="hostbrowser-msg">${msg.t === 'crashed' ? 'The host browser stopped.' : 'This page was closed.'}<button class="hostbrowser-action" data-act="reattach">Reopen</button></div>`);
        break;
      }
      case 'fatal': {
        fatal = true;
        if (msg.code === 'no-browser') {
          showOverlay(`<div class="hostbrowser-msg"><strong>No Chromium-based browser found on the host.</strong>
            <span>Install Google Chrome on the host, or let Meowtrix download Chrome for Testing (~150MB).</span>
            <button class="hostbrowser-action" data-act="install">Install browser</button></div>`);
        } else {
          showOverlay(`<div class="hostbrowser-msg"><strong>Couldn't start the host browser.</strong><span class="hostbrowser-err"></span><button class="hostbrowser-action" data-act="reattach">Retry</button></div>`);
          const errEl = overlay.querySelector('.hostbrowser-err');
          if (errEl) errEl.textContent = msg.message || '';
        }
        break;
      }
    }
  };

  overlay.addEventListener('click', async (e) => {
    const act = e.target?.dataset?.act;
    if (act === 'reattach') { gotFrame = false; connect(); }
    if (act === 'install') {
      showOverlay('<div class="hostbrowser-msg"><div class="hostbrowser-spinner"></div>Downloading Chrome for Testing on the host… this can take a minute.</div>');
      try {
        const r = await (await fetch('/api/hostbrowser/install', { method: 'POST' })).json();
        if (r.ok && r.status?.available) { connect(); return; }
        showOverlay(`<div class="hostbrowser-msg"><strong>Install failed.</strong><pre class="hostbrowser-err"></pre><button class="hostbrowser-action" data-act="install">Try again</button></div>`);
        overlay.querySelector('.hostbrowser-err').textContent = r.output || '';
      } catch {
        showOverlay('<div class="hostbrowser-msg"><strong>Install failed.</strong><button class="hostbrowser-action" data-act="install">Try again</button></div>');
      }
    }
  });

  const answerDialog = (msg) => {
    // Native dialogs are synchronous, which matches the page being paused on
    // the host while it waits for an answer.
    if (msg.kind === 'alert') { window.alert(msg.message); send({ t: 'dialog', accept: true }); }
    else if (msg.kind === 'confirm') send({ t: 'dialog', accept: window.confirm(msg.message) });
    else if (msg.kind === 'prompt') {
      const v = window.prompt(msg.message, msg.defaultValue || '');
      send({ t: 'dialog', accept: v !== null, text: v ?? undefined });
    } else send({ t: 'dialog', accept: true });
  };

  const chooseFiles = (multiple) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = !!multiple;
    let answered = false;
    const answer = async () => {
      if (answered) return;
      answered = true;
      const files = await Promise.all([...(input.files || [])].map(f => new Promise((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve({ name: f.name, type: f.type, data: String(r.result).split(',')[1] || '' });
        r.onerror = () => resolve(null);
        r.readAsDataURL(f);
      })));
      send({ t: 'files', files: files.filter(Boolean) });
    };
    input.addEventListener('change', answer);
    input.addEventListener('cancel', answer);
    // Browsers only open file pickers from a user gesture; the click that
    // opened the host's picker has already been forwarded, so ask for another.
    if (typeof showToast === 'function') {
      showToast('The page wants a file — click to choose', () => input.click());
    } else {
      input.click();
    }
  };

  // ── Input ──
  const mods = (e) => ({ shift: e.shiftKey, ctrl: e.ctrlKey, alt: e.altKey, meta: e.metaKey });
  const point = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const BUTTONS = ['left', 'middle', 'right', 'back', 'forward'];
  let moveQueued = null;
  const flushMove = () => {
    const e = moveQueued;
    moveQueued = null;
    if (e) send({ t: 'mouse', type: 'mouseMoved', ...point(e), button: 'none', buttons: e.buttons, ...mods(e) });
  };

  // Touch: forwarded as real touch events (the page runs with touch emulation),
  // so Chromium scrolls, pinches and taps natively.
  const touches = new Map();
  const touchPoints = () => [...touches.values()];
  let touchMoveQueued = false;

  const focusSink = () => {
    // Desktop: always take keyboard focus. Touch: only when the page has an
    // editable field focused, so tapping around doesn't pop the soft keyboard.
    if (!hbIsTouchDevice()) sink.focus({ preventScroll: true });
  };

  stage.addEventListener('pointerdown', (e) => {
    if (e.target === overlay || overlay.contains(e.target)) return;
    if (typeof setActivePane === 'function') { const p = paneOfTab(tab.tabEl); if (p) setActivePane(p); }
    if (e.pointerType === 'touch') {
      touches.set(e.pointerId, { id: e.pointerId, ...point(e) });
      send({ t: 'touch', type: 'touchStart', points: touchPoints() });
      try { stage.setPointerCapture(e.pointerId); } catch {}
      e.preventDefault();
      return;
    }
    focusSink();
    e.preventDefault();
    try { stage.setPointerCapture(e.pointerId); } catch {}
    send({ t: 'mouse', type: 'mousePressed', ...point(e), button: BUTTONS[e.button] || 'left', buttons: e.buttons, clickCount: e.detail || 1, ...mods(e) });
  });
  stage.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') {
      if (!touches.has(e.pointerId)) return;
      touches.set(e.pointerId, { id: e.pointerId, ...point(e) });
      if (!touchMoveQueued) {
        touchMoveQueued = true;
        requestAnimationFrame(() => { touchMoveQueued = false; if (touches.size) send({ t: 'touch', type: 'touchMove', points: touchPoints() }); });
      }
      return;
    }
    if (!moveQueued) requestAnimationFrame(flushMove);
    moveQueued = e;
  });
  const endPointer = (e) => {
    if (e.pointerType === 'touch') {
      if (!touches.delete(e.pointerId)) return;
      send({ t: 'touch', type: e.type === 'pointercancel' ? 'touchCancel' : 'touchEnd', points: touchPoints() });
      // A tap on a text field: offer the keyboard (the page reports focus a
      // moment later, after the tap is processed on the host).
      setTimeout(() => { if (tab.hbEditable) sink.focus({ preventScroll: true }); }, 250);
      return;
    }
    flushMove();
    send({ t: 'mouse', type: 'mouseReleased', ...point(e), button: BUTTONS[e.button] || 'left', buttons: e.buttons, clickCount: e.detail || 1, ...mods(e) });
  };
  stage.addEventListener('pointerup', endPointer);
  stage.addEventListener('pointercancel', endPointer);
  stage.addEventListener('contextmenu', (e) => e.preventDefault());
  stage.addEventListener('wheel', (e) => {
    e.preventDefault();
    const scale = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? viewSize().height : 1;
    send({ t: 'wheel', ...point(e), dx: e.deltaX * scale, dy: e.deltaY * scale, ...mods(e) });
  }, { passive: false });

  // Keyboard. App shortcuts (palette, workspace switching, …) run in capture
  // phase on document and stop propagation, so they never reach here.
  const isPrimary = (e) => (HB_IS_MAC ? e.metaKey : e.ctrlKey) && !e.altKey;
  let composing = false;
  sink.addEventListener('keydown', (e) => {
    if (composing || e.isComposing || e.keyCode === 229) return; // IME / soft keyboard → input events
    const k = (e.key || '').toLowerCase();
    // Paste: let the native paste event fire so we can send the *client's* clipboard.
    if (isPrimary(e) && k === 'v') return;
    e.preventDefault();
    send({ t: 'key', type: 'down', key: e.key, code: e.code, copy: isPrimary(e) && (k === 'c' || k === 'x') });
  });
  sink.addEventListener('keyup', (e) => {
    if (e.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    send({ t: 'key', type: 'up', key: e.key, code: e.code });
  });
  sink.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain');
    if (text) send({ t: 'text', text });
  });
  sink.addEventListener('compositionstart', () => { composing = true; });
  sink.addEventListener('compositionend', (e) => {
    composing = false;
    if (e.data) send({ t: 'text', text: e.data });
    sink.value = '';
  });
  sink.addEventListener('input', (e) => {
    if (composing) return;
    if (e.inputType === 'insertText' && e.data) send({ t: 'text', text: e.data });
    else if (e.inputType === 'deleteContentBackward') { send({ t: 'key', type: 'down', key: 'Backspace' }); send({ t: 'key', type: 'up', key: 'Backspace' }); }
    else if (e.inputType === 'insertLineBreak') { send({ t: 'key', type: 'down', key: 'Enter' }); send({ t: 'key', type: 'up', key: 'Enter' }); }
    sink.value = '';
  });
  sink.addEventListener('blur', () => send({ t: 'release' }));
  kbdBtn.addEventListener('click', () => sink.focus({ preventScroll: true }));

  // ── Navigation ──
  const navigate = (url) => {
    url = String(url || '').trim();
    if (!url) return;
    if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = (/^(localhost|127\.|\[::1\])/.test(url) ? 'http://' : 'https://') + url;
    tab.currentUrl = url;
    urlInput.value = url;
    if (ws && ws.readyState === WebSocket.OPEN) send({ t: 'nav', action: 'goto', url });
    else connect();
    setLabel('', url);
    if (typeof saveSessionState === 'function') saveSessionState();
  };
  tab.navigate = navigate;
  urlInput.addEventListener('focus', () => urlInput.select());
  urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { navigate(urlInput.value); sink.focus({ preventScroll: true }); }
    if (e.key === 'Escape') { urlInput.value = tab.currentUrl || ''; urlInput.blur(); }
  });
  backBtn.addEventListener('click', () => send({ t: 'nav', action: 'back' }));
  fwdBtn.addEventListener('click', () => send({ t: 'nav', action: 'forward' }));
  reloadBtn.addEventListener('click', () => send({ t: 'nav', action: tab.hbLoading ? 'stop' : 'reload' }));

  // ── Size / visibility ──
  let resizeTimer = null;
  let lastSize = '';
  const pushSize = () => {
    const { width, height } = viewSize();
    const key = `${width}x${height}@${window.devicePixelRatio}`;
    if (key === lastSize || width < 2 || height < 2) return;
    lastSize = key;
    send({ t: 'resize', width, height, dpr: window.devicePixelRatio || 1, mobile: hbIsTouchDevice() && width < 700 });
  };
  const ro = new ResizeObserver(() => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(pushSize, 80);
  });
  ro.observe(stage);
  let lastVisible = null;
  const syncVisibility = () => {
    const v = isVisible();
    if (v === lastVisible) return;
    lastVisible = v;
    send({ t: 'visibility', visible: v });
    if (v) pushSize();
  };
  tab.onActivate = () => { syncVisibility(); if (!hbIsTouchDevice()) sink.focus({ preventScroll: true }); };
  tab.hbSyncVisibility = syncVisibility;

  tab.zoom = (level) => {
    tab.zoomLevel = level;
    send({ t: 'resize', zoom: level, ...viewSize(), dpr: window.devicePixelRatio || 1 });
  };

  tab.reconnectHostBrowser = () => { gotFrame = false; connect(); };

  // View teardown (workspace rebuild / handoff) — the host page stays alive.
  tab.disposeHostBrowser = () => {
    disposed = true;
    hostBrowserTabs.delete(tab);
    clearTimeout(retryTimer);
    ro.disconnect();
    if (ws) { try { ws.onclose = null; ws.close(); } catch {} ws = null; }
  };
  // Tab closed by the user — close the page on the host too.
  tab.destroyHostBrowser = () => {
    // Over REST rather than the socket: a message queued right before close()
    // isn't reliably delivered (Firefox drops it).
    fetch('/api/hostbrowser/tabs/' + encodeURIComponent(tab.id), { method: 'DELETE', keepalive: true }).catch(() => {});
    tab.disposeHostBrowser();
  };

  if (tab.currentUrl) { urlInput.value = tab.currentUrl; setLabel('', tab.currentUrl); }
  else label.textContent = 'Host Browser';
  // Defer until the view is in the DOM and sized.
  setTimeout(connect, 0);
}

// Copy text from the host page to this device's clipboard. The keypress that
// triggered the copy is a round trip old by now, which some browsers no longer
// count as a user gesture — fall back to a click-to-copy toast.
function hbCopyToClipboard(text) {
  if (!text) return;
  const fallback = () => {
    if (typeof showToast === 'function') {
      showToast('Copied on the host — click to copy here', () => navigator.clipboard?.writeText(text).catch(() => {}));
    }
  };
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(fallback);
  else fallback();
}

// Re-grab every host-browser stream (session reclaimed / reconnected).
function reconnectAllHostBrowsers() {
  hostBrowserTabs.forEach(t => t.reconnectHostBrowser && t.reconnectHostBrowser());
}

// Workspace switches and tab activation change what's visible without a
// ResizeObserver callback; pause streams for hidden tabs to save host CPU.
function syncHostBrowserVisibility() {
  hostBrowserTabs.forEach(t => t.hbSyncVisibility && t.hbSyncVisibility());
}
document.addEventListener('visibilitychange', syncHostBrowserVisibility);
setInterval(syncHostBrowserVisibility, 1000);

// The server opened a popup / target=_blank page: give it a tab next to its opener.
function onHostBrowserPopup(msg) {
  if (typeof isActiveSession !== 'undefined' && !isActiveSession) return;
  let pane = null;
  for (const p of getAllPanesAllWorkspaces()) {
    if (p.tabs.some(t => t.id === msg.openerId)) { pane = p; break; }
  }
  pane = pane || activePane;
  if (!pane) return;
  addTab(pane, 'hostbrowser', msg.id, undefined, msg.url && msg.url !== 'about:blank' ? msg.url : undefined);
  if (typeof saveSessionState === 'function') saveSessionState();
}
