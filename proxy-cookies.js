// Cookie jar for the embedding proxy (/proxy in server.js).
//
// Proxied pages all live on the Meowtrix origin, so the real browser can't keep
// their cookies — the proxy strips Set-Cookie and keeps them here instead, then
// replays them on outgoing requests. To make logins actually stick this follows
// the parts of RFC 6265 that sign-in flows depend on:
//
//   - Domain cookies: `Domain=.example.com` set by accounts.example.com is sent
//     to app.example.com (SSO / OAuth hops across subdomains). Without it, the
//     cookie only goes back to the exact host that set it.
//   - Path scoping and longest-path-first ordering.
//   - Secure cookies only over https (loopback counts as secure, as in browsers).
//   - Expires / Max-Age, including deletion by an already-expired cookie.
//   - Persistence to ~/.meowtrix/proxy-cookies.json, so a server restart or a
//     self-update doesn't log the user out of everything.
//
// HttpOnly is tracked so the document.cookie shim the proxy injects into pages
// only exposes what page scripts are allowed to see.

const fs = require('fs');
const path = require('path');

const MAX_COOKIES = 5000;
const SAVE_DEBOUNCE_MS = 500;

function isLoopbackHost(host) {
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1' || host.endsWith('.localhost');
}

function isIpHost(host) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':') || host.startsWith('[');
}

// RFC 6265 §5.1.3: host equals domain, or host ends with "." + domain (and the
// host isn't an IP literal).
function domainMatches(host, domain) {
  if (host === domain) return true;
  if (isIpHost(host)) return false;
  return host.endsWith('.' + domain);
}

// RFC 6265 §5.1.4.
function defaultPath(pathname) {
  if (!pathname || pathname[0] !== '/') return '/';
  const i = pathname.lastIndexOf('/');
  return i <= 0 ? '/' : pathname.slice(0, i);
}

function pathMatches(reqPath, cookiePath) {
  if (reqPath === cookiePath) return true;
  if (!reqPath.startsWith(cookiePath)) return false;
  return cookiePath.endsWith('/') || reqPath[cookiePath.length] === '/';
}

// Parse one Set-Cookie header (or a document.cookie assignment) into a cookie
// record scoped to `urlObj`. Returns null when the cookie must be rejected.
function parseSetCookie(header, urlObj, { fromScript = false } = {}) {
  if (typeof header !== 'string') return null;
  const parts = header.split(';');
  const nameValue = parts.shift();
  const eq = nameValue.indexOf('=');
  if (eq === -1) return null;
  const name = nameValue.slice(0, eq).trim();
  const value = nameValue.slice(eq + 1).trim();
  if (!name) return null;

  const host = urlObj.hostname.toLowerCase();
  const cookie = {
    name,
    value,
    domain: host,
    hostOnly: true,
    path: defaultPath(urlObj.pathname),
    secure: false,
    httpOnly: false,
    expires: null, // epoch ms; null = session cookie
    created: Date.now(),
  };

  let maxAgeSeen = false;
  for (const raw of parts) {
    const i = raw.indexOf('=');
    const key = (i === -1 ? raw : raw.slice(0, i)).trim().toLowerCase();
    const val = i === -1 ? '' : raw.slice(i + 1).trim();
    if (key === 'domain' && val) {
      const d = val.replace(/^\./, '').toLowerCase();
      if (!domainMatches(host, d)) return null; // can't set cookies for another site
      cookie.domain = d;
      cookie.hostOnly = false;
    } else if (key === 'path') {
      cookie.path = val && val[0] === '/' ? val : defaultPath(urlObj.pathname);
    } else if (key === 'secure') {
      cookie.secure = true;
    } else if (key === 'httponly') {
      cookie.httpOnly = true;
    } else if (key === 'max-age') {
      const secs = parseInt(val, 10);
      if (!isNaN(secs)) { cookie.expires = Date.now() + secs * 1000; maxAgeSeen = true; }
    } else if (key === 'expires' && !maxAgeSeen) {
      const t = Date.parse(val);
      if (!isNaN(t)) cookie.expires = t;
    }
  }
  if (fromScript && cookie.httpOnly) return null; // scripts can't create HttpOnly cookies
  // Cookie prefixes (RFC 6265bis §4.1.3).
  if (name.startsWith('__Secure-') && !cookie.secure) return null;
  if (name.startsWith('__Host-') && (!cookie.secure || !cookie.hostOnly || cookie.path !== '/')) return null;
  return cookie;
}

class CookieJar {
  constructor(file) {
    this.file = file || null;
    this.cookies = [];
    this._saveTimer = null;
    this._load();
  }

  _load() {
    if (!this.file) return;
    try {
      const data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (Array.isArray(data.cookies)) {
        const now = Date.now();
        this.cookies = data.cookies.filter(c => c && c.name && c.domain && (!c.expires || c.expires > now));
      }
    } catch {}
  }

  _scheduleSave() {
    if (!this.file || this._saveTimer) return;
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      this.flush();
    }, SAVE_DEBOUNCE_MS);
    this._saveTimer.unref?.();
  }

  flush() {
    if (!this.file) return;
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = this.file + '.tmp';
      // Session cookies for sites the user signed into — keep it owner-only.
      fs.writeFileSync(tmp, JSON.stringify({ cookies: this.cookies }), { mode: 0o600 });
      fs.renameSync(tmp, this.file);
    } catch (e) {
      console.warn('[proxy-cookies] failed to save:', e.message);
    }
  }

  _store(cookie) {
    const idx = this.cookies.findIndex(c => c.name === cookie.name && c.domain === cookie.domain && c.path === cookie.path);
    const expired = cookie.expires != null && cookie.expires <= Date.now();
    if (idx !== -1) {
      if (expired) this.cookies.splice(idx, 1);
      else { cookie.created = this.cookies[idx].created; this.cookies[idx] = cookie; }
    } else if (!expired) {
      this.cookies.push(cookie);
      if (this.cookies.length > MAX_COOKIES) {
        // Evict the oldest so a cookie-spamming site can't grow the file forever.
        this.cookies.sort((a, b) => a.created - b.created);
        this.cookies.splice(0, this.cookies.length - MAX_COOKIES);
      }
    }
    this._scheduleSave();
  }

  // Record the Set-Cookie header(s) of a response from `urlObj`.
  saveCookies(urlObj, setCookieHeaders) {
    if (!setCookieHeaders) return;
    const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];
    for (const h of headers) {
      const c = parseSetCookie(h, urlObj);
      if (c) this._store(c);
    }
  }

  // A `document.cookie = "…"` assignment made by a page at `urlObj`.
  setFromScript(urlObj, assignment) {
    const c = parseSetCookie(assignment, urlObj, { fromScript: true });
    if (!c) return false;
    // A script may not overwrite an existing HttpOnly cookie.
    const existing = this.cookies.find(x => x.name === c.name && x.domain === c.domain && x.path === c.path);
    if (existing && existing.httpOnly) return false;
    this._store(c);
    return true;
  }

  _matching(urlObj, { includeHttpOnly }) {
    const host = urlObj.hostname.toLowerCase();
    const reqPath = urlObj.pathname || '/';
    const secureChannel = urlObj.protocol === 'https:' || isLoopbackHost(host);
    const now = Date.now();
    const live = this.cookies.filter(c => c.expires == null || c.expires > now);
    if (live.length !== this.cookies.length) { this.cookies = live; this._scheduleSave(); }
    const out = [];
    for (const c of live) {
      if (c.hostOnly ? host !== c.domain : !domainMatches(host, c.domain)) continue;
      if (!pathMatches(reqPath, c.path)) continue;
      if (c.secure && !secureChannel) continue;
      if (c.httpOnly && !includeHttpOnly) continue;
      out.push(c);
    }
    // Longer paths first, then older cookies first (RFC 6265 §5.4); the sort is
    // stable, so same-millisecond cookies keep their creation order.
    out.sort((a, b) => (b.path.length - a.path.length) || (a.created - b.created));
    return out;
  }

  // The Cookie request header for a request to `urlObj`.
  getCookieHeader(urlObj) {
    return this._matching(urlObj, { includeHttpOnly: true }).map(c => `${c.name}=${c.value}`).join('; ');
  }

  // What `document.cookie` should read as for a page at `urlObj`.
  getScriptCookieString(urlObj) {
    return this._matching(urlObj, { includeHttpOnly: false }).map(c => `${c.name}=${c.value}`).join('; ');
  }

  clear() {
    this.cookies = [];
    this._scheduleSave();
  }

  get size() { return this.cookies.length; }
}

module.exports = { CookieJar, parseSetCookie, domainMatches, pathMatches, defaultPath };
