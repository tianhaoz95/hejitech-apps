// Host browser — a real Chromium running on the host, streamed into a tab.
//
// The embedding proxy (/proxy) can't be a real browser: every proxied site runs
// on the Meowtrix origin, so cookies, OAuth redirects, passkeys and bot checks
// break. A 'hostbrowser' tab instead drives a page in a persistent Chromium
// profile (~/.meowtrix/host-browser-profile) over the Chrome DevTools Protocol:
//
//   - Pixels: CDP Page.startScreencast JPEG frames, sent to the tab as binary
//     WebSocket messages on a per-tab socket (/hostbrowser/<tabId>), so frames
//     never queue behind terminal traffic on the control socket. Flow control is
//     end-to-end: the CDP frame ack is held back while MAX_INFLIGHT frames are
//     unacknowledged by the client.
//   - Input: the tab forwards pointer/wheel/touch/key/text events as JSON; they
//     become CDP Input.dispatch* calls (keys go through Playwright's keyboard,
//     which knows key codes and macOS editing commands).
//   - Size: the page's viewport is the tab's canvas size (CSS px) at the
//     client's devicePixelRatio, so frames map 1:1 onto the canvas.
//
// Like PTYs, pages are keyed by tab id and outlive their sockets — a refresh,
// network blip or device handoff re-attaches to the same live page (the newest
// socket becomes the viewer). Logins live in the profile on the host, so they
// follow the user across devices and survive restarts. When the server
// restarts, the tab re-creates its page from the URL saved in the workspace.
//
// Same no-auth stance as the rest of the app: whoever can reach the server can
// already run a shell here — but note the profile holds real sessions.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile, spawn } = require('child_process');
const { WebSocketServer } = require('ws');
const { v4: uuidv4 } = require('uuid');

let playwright = null;
function loadPlaywright() {
  if (!playwright) playwright = require('playwright-core');
  return playwright;
}

const MAX_INFLIGHT = 2;          // unacked frames on the wire before we stall CDP
const MAX_PAGES = 16;            // host memory guard (~100–300MB per page)
const IDLE_SHUTDOWN_MS = 10 * 60 * 1000; // close Chromium when no pages are left
const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;
const IS_MAC_HOST = process.platform === 'darwin';

// Browsers we can drive, best first: a real Chrome passes more bot checks (and
// Google sign-in) than Chrome for Testing / Chromium.
function candidateExecutables() {
  if (process.platform === 'darwin') {
    const apps = [
      'Google Chrome.app/Contents/MacOS/Google Chrome',
      'Chromium.app/Contents/MacOS/Chromium',
      'Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      'Brave Browser.app/Contents/MacOS/Brave Browser',
    ];
    return apps.flatMap(a => ['/Applications/' + a, path.join(os.homedir(), 'Applications', a)]);
  }
  if (process.platform === 'win32') {
    const roots = [process.env['PROGRAMFILES'], process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean);
    return roots.flatMap(r => [
      path.join(r, 'Google/Chrome/Application/chrome.exe'),
      path.join(r, 'Microsoft/Edge/Application/msedge.exe'),
      path.join(r, 'Chromium/Application/chrome.exe'),
    ]);
  }
  const bins = ['google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser', 'microsoft-edge', 'brave-browser'];
  const dirs = (process.env.PATH || '').split(path.delimiter).concat(['/usr/bin', '/usr/local/bin', '/snap/bin']);
  return bins.flatMap(b => dirs.map(d => path.join(d, b)));
}

function findExecutable(override) {
  if (override && fs.existsSync(override)) return override;
  for (const p of candidateExecutables()) {
    try { if (fs.statSync(p).isFile()) return p; } catch {}
  }
  try {
    const p = loadPlaywright().chromium.executablePath();
    if (p && fs.existsSync(p)) return p;
  } catch {}
  return null;
}

// "Google Chrome 141.0.7390.54" → 141. Used to build a UA without "Headless".
function browserMajorVersion(exe) {
  return new Promise((resolve) => {
    execFile(exe, ['--version'], { timeout: 5000 }, (err, stdout) => {
      const m = /(\d+)\.\d+\.\d+/.exec(String(stdout || ''));
      resolve(m ? m[1] : null);
    });
  });
}

function userAgentFor(major) {
  const platform = process.platform === 'darwin' ? 'Macintosh; Intel Mac OS X 10_15_7'
    : process.platform === 'win32' ? 'Windows NT 10.0; Win64; x64'
    : 'X11; Linux x86_64';
  return `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`;
}

function normalizeUrl(raw) {
  if (typeof raw !== 'string') return null;
  let s = raw.trim();
  if (!s) return null;
  if (s === 'about:blank') return s;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
    if (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(s)) return null;
    s = (/^(localhost|127\.|\[::1\]|0\.0\.0\.0)/.test(s) ? 'http://' : 'https://') + s;
  }
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.href;
  } catch { return null; }
}

// Runs in every frame of every page: report the cursor under the mouse and
// whether an editable element has focus (so the tab can show a text cursor and,
// on touch devices, offer the soft keyboard).
const PAGE_INIT_SCRIPT = `(() => {
  if (window.__mtxHB) return; window.__mtxHB = true;
  const report = (o) => { try { window.__mtxHostBrowser && window.__mtxHostBrowser(o); } catch (e) {} };
  const editable = (el) => !!el && (el.isContentEditable || el.tagName === 'TEXTAREA' ||
    (el.tagName === 'INPUT' && !/^(button|checkbox|radio|submit|reset|file|image|range|color|hidden)$/i.test(el.type || '')));
  let last = '', pending = null;
  document.addEventListener('mousemove', (e) => {
    pending = e.target;
    if (pending.__mtxQueued) return;
    requestAnimationFrame(() => {
      const el = pending; if (!el || !el.ownerDocument) return;
      let c = 'default';
      try { c = getComputedStyle(el).cursor || 'auto'; } catch (err) {}
      if (c === 'auto') c = editable(el) ? 'text' : (el.closest && el.closest('a[href]') ? 'pointer' : 'default');
      if (c !== last) { last = c; report({ cursor: c }); }
    });
  }, { capture: true, passive: true });
  document.addEventListener('focusin', (e) => report({ editable: editable(e.target) }), true);
  document.addEventListener('focusout', () => setTimeout(() => report({ editable: editable(document.activeElement) }), 0), true);
  // Passkeys live on the user's own devices, which the host browser can't
  // reach, and headless Chrome's passkey sheet has no window, so a WebAuthn
  // request would hang forever ("Verifying it's you…"). Answer it the way a
  // cancelled prompt does (NotAllowedError) so sites offer their other sign-in
  // methods, and tell the tab so it can explain.
  if (window.CredentialsContainer) {
    const proto = CredentialsContainer.prototype;
    for (const m of ['get', 'create']) {
      const orig = proto[m];
      if (typeof orig !== 'function') continue;
      proto[m] = function (opts) {
        if (opts && opts.publicKey) {
          if (opts.mediation !== 'conditional') report({ passkey: m });
          return Promise.reject(new DOMException('The operation either timed out or was not allowed.', 'NotAllowedError'));
        }
        return orig.apply(this, arguments);
      };
    }
  }
  if (window.PublicKeyCredential) {
    try { PublicKeyCredential.isConditionalMediationAvailable = () => Promise.resolve(false); } catch (e) {}
  }
})();`;

class HostBrowserService {
  constructor({ dataDir, getSettings, broadcast, downloadsDir }) {
    this.dataDir = dataDir;
    this.profileDir = path.join(dataDir, 'host-browser-profile');
    this.downloadsDir = downloadsDir || path.join(os.homedir(), 'Downloads');
    this.getSettings = getSettings || (() => ({}));
    this.broadcast = broadcast || (() => {});
    this.pages = new Map(); // tabId -> entry
    this.context = null;
    this.launching = null;
    this.idleTimer = null;
    this.ownPages = new WeakSet(); // pages we created (vs. popups the site opened)
    this.installing = null;
    this.wss = new WebSocketServer({ noServer: true, perMessageDeflate: false, maxPayload: 80 * 1024 * 1024 });
    this.wss.on('connection', (ws, req, tabId) => this._onSocket(ws, tabId));
  }

  // ── Browser lifecycle ──────────────────────────────────────────────────────

  status() {
    const exe = findExecutable(this.getSettings().hostBrowserPath);
    return {
      available: !!exe,
      executable: exe,
      running: !!this.context,
      pages: this.pages.size,
      installing: !!this.installing,
    };
  }

  async _ensureContext() {
    if (this.context) return this.context;
    if (this.launching) return this.launching;
    this.launching = (async () => {
      const settings = this.getSettings();
      const exe = findExecutable(settings.hostBrowserPath);
      if (!exe) {
        const err = new Error('No Chromium-based browser found on the host.');
        err.code = 'no-browser';
        throw err;
      }
      const major = await browserMajorVersion(exe);
      const args = [
        '--disable-blink-features=AutomationControlled',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-features=Translate,MediaRouter',
        '--password-store=basic',
      ];
      if (major) args.push(`--user-agent=${userAgentFor(major)}`);
      fs.mkdirSync(this.profileDir, { recursive: true });
      const context = await loadPlaywright().chromium.launchPersistentContext(this.profileDir, {
        executablePath: exe,
        headless: settings.hostBrowserHeadless !== false,
        viewport: null,
        acceptDownloads: true,
        ignoreDefaultArgs: ['--enable-automation'],
        args,
      });
      await context.exposeBinding('__mtxHostBrowser', (source, info) => this._onPageReport(source.page, info));
      await context.addInitScript(PAGE_INIT_SCRIPT);
      context.on('page', (page) => this._onNewPage(page));
      context.on('close', () => {
        if (this.context === context) this.context = null;
        for (const entry of this.pages.values()) this._send(entry, { t: 'crashed' });
        this.pages.clear();
      });
      // The persistent context opens a blank window of its own; we only show
      // pages that tabs ask for.
      for (const p of context.pages()) { this.ownPages.add(p); p.close().catch(() => {}); }
      this.context = context;
      console.log(`🌐 Host browser started (${path.basename(exe)}${settings.hostBrowserHeadless === false ? ', headed' : ''})`);
      return context;
    })();
    try {
      return await this.launching;
    } finally {
      this.launching = null;
    }
  }

  _armIdleShutdown() {
    clearTimeout(this.idleTimer);
    if (this.pages.size) return;
    this.idleTimer = setTimeout(() => {
      if (!this.pages.size && this.context) {
        const ctx = this.context;
        this.context = null;
        ctx.close().catch(() => {});
        console.log('🌐 Host browser idle — closed');
      }
    }, IDLE_SHUTDOWN_MS);
    this.idleTimer.unref?.();
  }

  async shutdown() {
    clearTimeout(this.idleTimer);
    const ctx = this.context;
    this.context = null;
    if (ctx) await ctx.close().catch(() => {});
  }

  // Download Chrome for Testing via Playwright's installer (the "Install"
  // button shown when no browser is found).
  install() {
    if (this.installing) return this.installing;
    this.installing = new Promise((resolve) => {
      let cli;
      try { cli = require.resolve('playwright-core/cli.js'); } catch { return resolve({ ok: false, output: 'playwright-core is not installed' }); }
      let output = '';
      const child = spawn(process.execPath, [cli, 'install', 'chromium'], { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } });
      child.stdout.on('data', d => { output += d; });
      child.stderr.on('data', d => { output += d; });
      child.on('error', (e) => resolve({ ok: false, output: e.message }));
      child.on('close', (code) => resolve({ ok: code === 0, output: output.slice(-4000) }));
    }).finally(() => { this.installing = null; });
    return this.installing;
  }

  // ── Pages ──────────────────────────────────────────────────────────────────

  async _createEntry(tabId, url, { page: existingPage, openerId } = {}) {
    if (this.pages.size >= MAX_PAGES) {
      const err = new Error(`Too many host-browser tabs (max ${MAX_PAGES}). Close some first.`);
      err.code = 'limit';
      throw err;
    }
    clearTimeout(this.idleTimer);
    const context = await this._ensureContext();
    let page = existingPage;
    if (!page) {
      page = await context.newPage();
      this.ownPages.add(page);
    }
    const cdp = await context.newCDPSession(page);
    const entry = {
      id: tabId,
      page,
      cdp,
      viewer: null,
      width: 1280,
      height: 800,
      dpr: 1,
      zoom: 1,
      touch: false,
      mobile: false,
      clientMac: IS_MAC_HOST,
      screencasting: false,
      inflight: 0,
      pendingAck: null,
      lastFrame: null,
      cursor: 'default',
      url: page.url(),
      title: '',
      loading: false,
      openerId: openerId || null,
      dialog: null,
      fileChooser: null,
    };
    this.pages.set(tabId, entry);
    this._wirePage(entry);
    if (url && !existingPage) {
      entry.url = url;
      page.goto(url, { waitUntil: 'commit' }).catch((e) => this._send(entry, { t: 'error', message: shortError(e) }));
    }
    return entry;
  }

  _wirePage(entry) {
    const { page, cdp } = entry;
    cdp.on('Page.screencastFrame', (frame) => this._onFrame(entry, frame));
    page.on('framenavigated', (frame) => {
      // Keep the attempted URL on Chrome's error page so the address bar (and the
      // saved workspace) still say where the user was trying to go.
      if (frame === page.mainFrame()) {
        if (!frame.url().startsWith('chrome-error:')) entry.url = frame.url();
        this._pushState(entry);
      }
    });
    page.on('load', () => { entry.loading = false; this._pushState(entry); });
    page.on('domcontentloaded', () => this._pushState(entry));
    page.on('request', (req) => {
      if (req.isNavigationRequest() && req.frame() === page.mainFrame()) { entry.loading = true; this._pushState(entry); }
    });
    page.on('requestfailed', (req) => {
      if (req.isNavigationRequest() && req.frame() === page.mainFrame()) {
        entry.loading = false;
        this._pushState(entry);
        const reason = req.failure()?.errorText || 'failed';
        if (!/ERR_ABORTED/.test(reason)) this._send(entry, { t: 'error', message: `Couldn't load ${req.url()} (${reason})` });
      }
    });
    page.on('dialog', (dialog) => {
      if (dialog.type() === 'beforeunload' || !entry.viewer) { dialog.accept().catch(() => {}); return; }
      entry.dialog = dialog;
      this._send(entry, { t: 'dialog', kind: dialog.type(), message: dialog.message(), defaultValue: dialog.defaultValue() });
    });
    page.on('filechooser', (chooser) => {
      if (!entry.viewer) return;
      entry.fileChooser = chooser;
      this._send(entry, { t: 'filechooser', multiple: chooser.isMultiple() });
    });
    page.on('download', async (download) => {
      try {
        fs.mkdirSync(this.downloadsDir, { recursive: true });
        const dest = uniquePath(path.join(this.downloadsDir, download.suggestedFilename() || 'download'));
        await download.saveAs(dest);
        this._send(entry, { t: 'download', path: dest, name: path.basename(dest) });
      } catch (e) {
        this._send(entry, { t: 'error', message: 'Download failed: ' + shortError(e) });
      }
    });
    page.on('console', (msg) => {
      if (!entry.viewer) return;
      const level = msg.type();
      this._send(entry, { t: 'console', level: level === 'warning' ? 'warn' : level, text: msg.text().slice(0, 4000) });
    });
    page.on('pageerror', (err) => this._send(entry, { t: 'console', level: 'error', text: String(err && err.message || err).slice(0, 4000) }));
    page.on('crash', () => this._send(entry, { t: 'error', message: 'The page crashed. Reload to try again.' }));
    page.on('close', () => {
      if (this.pages.get(entry.id) === entry) {
        this.pages.delete(entry.id);
        this._send(entry, { t: 'closed' });
        this._armIdleShutdown();
      }
    });
  }

  // A page we didn't create: a popup or target=_blank link. Give it its own tab
  // id and ask the active session to open a tab for it beside the opener.
  _onNewPage(page) {
    setTimeout(async () => {
      if (this.ownPages.has(page) || page.isClosed()) return;
      for (const e of this.pages.values()) if (e.page === page) return;
      let openerId = null;
      try {
        const opener = await page.opener();
        for (const e of this.pages.values()) if (e.page === opener) openerId = e.id;
      } catch {}
      const id = 'hb-' + uuidv4();
      try {
        await this._createEntry(id, null, { page, openerId });
        this.broadcast({ type: 'hostbrowser:popup', id, openerId, url: page.url() });
      } catch {
        page.close().catch(() => {});
      }
    }, 150);
  }

  _onPageReport(page, info) {
    if (!info || typeof info !== 'object') return;
    for (const entry of this.pages.values()) {
      if (entry.page !== page) continue;
      if (typeof info.cursor === 'string' && info.cursor !== entry.cursor) {
        entry.cursor = info.cursor.slice(0, 64);
        this._send(entry, { t: 'cursor', cursor: entry.cursor });
      }
      if (typeof info.editable === 'boolean') this._send(entry, { t: 'editable', editable: info.editable });
      if (info.passkey) this._send(entry, { t: 'passkey' });
    }
  }

  async _pushState(entry) {
    let canGoBack = false, canGoForward = false;
    try {
      const h = await entry.cdp.send('Page.getNavigationHistory');
      canGoBack = h.currentIndex > 0;
      canGoForward = h.currentIndex < h.entries.length - 1;
    } catch {}
    try { entry.title = await entry.page.title(); } catch {}
    this._send(entry, {
      t: 'state',
      url: entry.url,
      title: entry.title,
      loading: entry.loading,
      canGoBack,
      canGoForward,
    });
  }

  // ── Screencast ─────────────────────────────────────────────────────────────

  async _applyMetrics(entry) {
    const zoom = entry.zoom || 1;
    const width = Math.max(100, Math.round(entry.width / zoom));
    const height = Math.max(100, Math.round(entry.height / zoom));
    const dpr = Math.min(3, Math.max(0.5, entry.dpr * zoom));
    await entry.cdp.send('Emulation.setDeviceMetricsOverride', {
      width, height, deviceScaleFactor: dpr, mobile: entry.mobile,
      screenWidth: width, screenHeight: height,
    }).catch(() => {});
    await entry.cdp.send('Emulation.setTouchEmulationEnabled', { enabled: entry.touch, maxTouchPoints: entry.touch ? 5 : 1 }).catch(() => {});
  }

  async _startScreencast(entry) {
    if (!entry.viewer) return;
    const quality = Math.min(95, Math.max(30, Number(this.getSettings().hostBrowserQuality) || 70));
    if (entry.screencasting) await entry.cdp.send('Page.stopScreencast').catch(() => {});
    entry.screencasting = true;
    entry.inflight = 0;
    entry.pendingAck = null;
    await entry.cdp.send('Page.startScreencast', {
      format: 'jpeg',
      quality,
      maxWidth: Math.round(entry.width * entry.dpr),
      maxHeight: Math.round(entry.height * entry.dpr),
      everyNthFrame: 1,
    }).catch(() => { entry.screencasting = false; });
  }

  async _stopScreencast(entry) {
    if (!entry.screencasting) return;
    entry.screencasting = false;
    await entry.cdp.send('Page.stopScreencast').catch(() => {});
  }

  _onFrame(entry, frame) {
    const buf = Buffer.from(frame.data, 'base64');
    entry.lastFrame = buf;
    const ws = entry.viewer;
    if (ws && ws.readyState === ws.OPEN) {
      ws.send(buf, { binary: true });
      entry.inflight++;
    }
    if (entry.inflight < MAX_INFLIGHT || !ws) {
      entry.cdp.send('Page.screencastFrameAck', { sessionId: frame.sessionId }).catch(() => {});
    } else {
      entry.pendingAck = frame.sessionId;
    }
  }

  _onClientAck(entry) {
    entry.inflight = Math.max(0, entry.inflight - 1);
    if (entry.pendingAck != null && entry.inflight < MAX_INFLIGHT) {
      const sessionId = entry.pendingAck;
      entry.pendingAck = null;
      entry.cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    }
  }

  // ── Sockets ────────────────────────────────────────────────────────────────

  handleUpgrade(req, socket, head) {
    const m = /^\/hostbrowser\/([A-Za-z0-9_-]{1,128})(?:\?|$)/.exec(req.url || '');
    if (!m) { socket.end('HTTP/1.1 400 Bad Request\r\n\r\n'); return; }
    this.wss.handleUpgrade(req, socket, head, (ws) => this.wss.emit('connection', ws, req, m[1]));
  }

  _send(entry, msg) {
    const ws = entry && entry.viewer;
    if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  }

  _onSocket(ws, tabId) {
    let entry = null;
    let ready = null; // resolves once init has attached us
    const sendRaw = (msg) => { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg)); };

    ws.on('message', async (raw, isBinary) => {
      if (isBinary) return;
      let msg;
      try { msg = JSON.parse(raw); } catch { return; }
      if (msg.t === 'init') {
        ready = this._attach(ws, tabId, msg).then((e) => { entry = e; return e; }, (err) => {
          sendRaw({ t: 'fatal', code: err.code || 'error', message: shortError(err), status: this.status() });
          return null;
        });
        return;
      }
      const e = entry || (ready && await ready);
      if (!e || e.viewer !== ws) return;
      try {
        await this._handle(e, msg, ws);
      } catch (err) {
        if (msg.t !== 'mouse' && msg.t !== 'wheel' && msg.t !== 'touch') this._send(e, { t: 'error', message: shortError(err) });
      }
    });

    ws.on('close', () => {
      if (entry && entry.viewer === ws) {
        entry.viewer = null;
        this._releaseKeys(entry);
        this._stopScreencast(entry);
        // Nobody to answer a pending dialog/file chooser — don't leave the page hung.
        if (entry.dialog) { entry.dialog.dismiss().catch(() => {}); entry.dialog = null; }
        if (entry.fileChooser) { entry.fileChooser.setFiles([]).catch(() => {}); entry.fileChooser = null; }
      }
    });
  }

  async _attach(ws, tabId, msg) {
    let entry = this.pages.get(tabId);
    const url = normalizeUrl(msg.url) || null;
    if (!entry) entry = await this._createEntry(tabId, url);
    // Newest socket wins; tell the previous viewer it was replaced.
    if (entry.viewer && entry.viewer !== ws) {
      const old = entry.viewer;
      try { old.send(JSON.stringify({ t: 'replaced' })); } catch {}
      this._releaseKeys(entry);
    }
    entry.viewer = ws;
    this._readClientView(entry, msg);
    await this._applyMetrics(entry);
    if (msg.visible !== false) await this._startScreencast(entry);
    // Paint something right away (the screencast only emits on change).
    if (entry.lastFrame && ws.readyState === ws.OPEN) { ws.send(entry.lastFrame, { binary: true }); entry.inflight++; }
    this._send(entry, { t: 'cursor', cursor: entry.cursor });
    await this._pushState(entry);
    if (entry.dialog) {
      const d = entry.dialog;
      this._send(entry, { t: 'dialog', kind: d.type(), message: d.message(), defaultValue: d.defaultValue() });
    }
    return entry;
  }

  _readClientView(entry, msg) {
    if (Number.isFinite(msg.width) && msg.width > 0) entry.width = Math.min(7680, Math.round(msg.width));
    if (Number.isFinite(msg.height) && msg.height > 0) entry.height = Math.min(4320, Math.round(msg.height));
    if (Number.isFinite(msg.dpr) && msg.dpr > 0) entry.dpr = Math.min(3, msg.dpr);
    if (Number.isFinite(msg.zoom) && msg.zoom > 0) entry.zoom = Math.min(5, Math.max(0.25, msg.zoom));
    if (typeof msg.touch === 'boolean') entry.touch = msg.touch;
    if (typeof msg.mobile === 'boolean') entry.mobile = msg.mobile;
    if (typeof msg.mac === 'boolean') entry.clientMac = msg.mac;
  }

  async _handle(entry, msg, ws) {
    const { page, cdp } = entry;
    switch (msg.t) {
      case 'ack': this._onClientAck(entry); break;
      case 'resize': {
        this._readClientView(entry, msg);
        await this._applyMetrics(entry);
        if (entry.screencasting) await this._startScreencast(entry);
        break;
      }
      case 'visibility': {
        if (msg.visible) await this._startScreencast(entry); else await this._stopScreencast(entry);
        break;
      }
      case 'nav': {
        if (msg.action === 'goto') {
          const url = normalizeUrl(msg.url);
          if (!url) { this._send(entry, { t: 'error', message: 'Only http(s) URLs can be opened.' }); break; }
          entry.url = url;
          this._pushState(entry);
          await page.goto(url, { waitUntil: 'commit' });
        } else if (msg.action === 'back') await page.goBack({ waitUntil: 'commit' }).catch(() => {});
        else if (msg.action === 'forward') await page.goForward({ waitUntil: 'commit' }).catch(() => {});
        else if (msg.action === 'reload') await page.reload({ waitUntil: 'commit' }).catch(() => {});
        else if (msg.action === 'stop') await cdp.send('Page.stopLoading').catch(() => {});
        break;
      }
      case 'mouse': {
        const z = entry.zoom || 1;
        await cdp.send('Input.dispatchMouseEvent', {
          type: msg.type, // mouseMoved | mousePressed | mouseReleased
          x: msg.x / z, y: msg.y / z,
          button: msg.button || 'none',
          buttons: msg.buttons | 0,
          clickCount: msg.clickCount | 0,
          modifiers: this._modifiers(entry, msg),
        });
        break;
      }
      case 'wheel': {
        const z = entry.zoom || 1;
        await cdp.send('Input.dispatchMouseEvent', {
          type: 'mouseWheel', x: msg.x / z, y: msg.y / z,
          deltaX: msg.dx || 0, deltaY: msg.dy || 0,
          modifiers: this._modifiers(entry, msg),
        });
        break;
      }
      case 'touch': {
        const z = entry.zoom || 1;
        await cdp.send('Input.dispatchTouchEvent', {
          type: msg.type, // touchStart | touchMove | touchEnd | touchCancel
          touchPoints: (msg.points || []).slice(0, 10).map(p => ({ x: p.x / z, y: p.y / z, id: p.id | 0, radiusX: 4, radiusY: 4, force: 1 })),
        });
        break;
      }
      case 'key': {
        let key = this._hostKey(entry, String(msg.key || ''));
        if (!key || key === 'Unidentified' || key === 'Dead' || key === 'Process') break;
        if (msg.type === 'down') {
          try { await page.keyboard.down(key); }
          catch { if ([...key].length === 1) await page.keyboard.insertText(key); }
          if (msg.copy) await this._sendSelection(entry);
        } else {
          try { await page.keyboard.up(key); } catch {}
        }
        break;
      }
      case 'release': this._releaseKeys(entry); break;
      case 'text': {
        if (typeof msg.text === 'string' && msg.text) await page.keyboard.insertText(msg.text.slice(0, 100000));
        break;
      }
      case 'copy': await this._sendSelection(entry); break;
      case 'dialog': {
        const d = entry.dialog;
        entry.dialog = null;
        if (d) { if (msg.accept) await d.accept(msg.text ?? undefined).catch(() => {}); else await d.dismiss().catch(() => {}); }
        break;
      }
      case 'files': {
        const chooser = entry.fileChooser;
        entry.fileChooser = null;
        if (!chooser) break;
        const files = [];
        let total = 0;
        for (const f of (msg.files || [])) {
          const buffer = Buffer.from(String(f.data || ''), 'base64');
          total += buffer.length;
          if (total > MAX_UPLOAD_BYTES) { this._send(entry, { t: 'error', message: 'Upload too large (max 50MB).' }); break; }
          files.push({ name: String(f.name || 'file').slice(0, 255), mimeType: String(f.type || 'application/octet-stream'), buffer });
        }
        await chooser.setFiles(files);
        break;
      }
      case 'destroy': {
        this.pages.delete(entry.id);
        entry.viewer = null;
        await page.close().catch(() => {});
        this._armIdleShutdown();
        try { ws.close(); } catch {}
        break;
      }
    }
  }

  // A Mac client's ⌘ shortcuts should act as Ctrl shortcuts on a Linux/Windows
  // host (and vice versa), so swap the primary modifier across platforms.
  _hostKey(entry, key) {
    if (entry.clientMac === IS_MAC_HOST) return key;
    if (key === 'Meta') return 'Control';
    if (key === 'Control') return 'Meta';
    return key;
  }

  _modifiers(entry, msg) {
    let meta = !!msg.meta, ctrl = !!msg.ctrl;
    if (entry.clientMac !== IS_MAC_HOST) [meta, ctrl] = [ctrl, meta];
    return (msg.alt ? 1 : 0) | (ctrl ? 2 : 0) | (meta ? 4 : 0) | (msg.shift ? 8 : 0);
  }

  _releaseKeys(entry) {
    for (const k of ['Shift', 'Control', 'Alt', 'Meta']) entry.page.keyboard.up(k).catch(() => {});
  }

  // After ⌘/Ctrl+C or X: the copy lands in the *host* browser's clipboard, so
  // read the selection and hand it to the client to put on its own clipboard.
  async _sendSelection(entry) {
    await new Promise(r => setTimeout(r, 30));
    let text = '';
    try {
      text = await entry.page.evaluate(() => {
        const el = document.activeElement;
        if (el && (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') && typeof el.selectionStart === 'number') {
          return el.value.slice(el.selectionStart, el.selectionEnd);
        }
        return String(window.getSelection ? window.getSelection() : '');
      });
    } catch {}
    if (text) this._send(entry, { t: 'clipboard', text: text.slice(0, 1000000) });
  }

  // ── Agent-facing helpers (REST, used by `mtx browser …`) ───────────────────

  list() {
    return [...this.pages.values()].map(e => ({ id: e.id, url: e.url, title: e.title, viewing: !!e.viewer }));
  }

  get(id) { return this.pages.get(id) || null; }

  async screenshot(id) {
    const e = this.pages.get(id);
    if (!e) return null;
    return e.page.screenshot({ type: 'png' });
  }

  async text(id) {
    const e = this.pages.get(id);
    if (!e) return null;
    return e.page.evaluate(() => document.body ? document.body.innerText : '');
  }

  async navigate(id, url) {
    const e = this.pages.get(id);
    const u = normalizeUrl(url);
    if (!e || !u) return false;
    e.url = u;
    await e.page.goto(u, { waitUntil: 'commit' });
    return true;
  }
}

function shortError(e) {
  return String((e && e.message) || e || 'error').split('\n')[0].slice(0, 300);
}

function uniquePath(p) {
  if (!fs.existsSync(p)) return p;
  const { dir, name, ext } = path.parse(p);
  for (let i = 1; i < 1000; i++) {
    const c = path.join(dir, `${name} (${i})${ext}`);
    if (!fs.existsSync(c)) return c;
  }
  return path.join(dir, `${name}-${Date.now()}${ext}`);
}

// REST endpoints: status/install for the tab's empty state, plus a small agent
// surface (list / screenshot / text / navigate) behind `mtx browser`.
function mountHostBrowserRoutes(app, service) {
  app.get('/api/hostbrowser/status', (req, res) => res.json(service.status()));
  app.post('/api/hostbrowser/install', async (req, res) => {
    const r = await service.install();
    res.json({ ...r, status: service.status() });
  });
  app.get('/api/hostbrowser/tabs', (req, res) => res.json({ tabs: service.list() }));
  app.get('/api/hostbrowser/tabs/:id/screenshot', async (req, res) => {
    try {
      const png = await service.screenshot(req.params.id);
      if (!png) return res.status(404).json({ ok: false, error: 'no such tab' });
      res.type('image/png').send(png);
    } catch (e) { res.status(500).json({ ok: false, error: shortError(e) }); }
  });
  app.get('/api/hostbrowser/tabs/:id/text', async (req, res) => {
    try {
      const text = await service.text(req.params.id);
      if (text == null) return res.status(404).json({ ok: false, error: 'no such tab' });
      res.type('text/plain').send(text);
    } catch (e) { res.status(500).json({ ok: false, error: shortError(e) }); }
  });
  app.post('/api/hostbrowser/tabs/:id/navigate', async (req, res) => {
    try {
      const ok = await service.navigate(req.params.id, req.body?.url);
      res.status(ok ? 200 : 404).json({ ok });
    } catch (e) { res.status(500).json({ ok: false, error: shortError(e) }); }
  });
  app.delete('/api/hostbrowser/tabs/:id', async (req, res) => {
    const e = service.get(req.params.id);
    if (e) { service.pages.delete(e.id); await e.page.close().catch(() => {}); service._armIdleShutdown(); }
    res.json({ ok: !!e });
  });
}

module.exports = { HostBrowserService, mountHostBrowserRoutes, normalizeUrl, findExecutable };
