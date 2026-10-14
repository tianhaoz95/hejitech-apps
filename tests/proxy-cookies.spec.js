const { test, expect } = require('@playwright/test');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { CookieJar } = require('../proxy-cookies');

// Fixture sites are fetched by the *Meowtrix server*, which in CI runs in
// another container: bind on all interfaces and address them by this
// container's name (FIXTURE_HOST, set in docker-compose.test.yml; else the
// hostname) unless the server is local.
function fixtureHost(baseURL) {
  const h = new URL(baseURL).hostname;
  if (h === 'localhost' || h === '127.0.0.1') return '127.0.0.1';
  return process.env.FIXTURE_HOST || os.hostname();
}

// The embedding proxy's cookie jar (proxy-cookies.js) and the login flows it
// exists for: cookies set on a redirect, Domain cookies shared across
// subdomains, document.cookie writes, and persistence across restarts.

test.describe('proxy cookie jar (unit)', () => {
  const u = (s) => new URL(s);

  test('domain cookies reach sibling subdomains; host-only cookies do not', () => {
    const jar = new CookieJar();
    jar.saveCookies(u('https://accounts.example.com/login'), [
      'sso=1; Domain=.example.com; Path=/',
      'local=2; Path=/',
    ]);
    expect(jar.getCookieHeader(u('https://app.example.com/'))).toBe('sso=1');
    expect(jar.getCookieHeader(u('https://accounts.example.com/'))).toBe('sso=1; local=2');
    expect(jar.getCookieHeader(u('https://example.org/'))).toBe('');
  });

  test('rejects cookies for unrelated domains and honours Path / Secure / expiry', () => {
    const jar = new CookieJar();
    jar.saveCookies(u('https://a.example.com/'), [
      'evil=1; Domain=other.com',
      'p=1; Path=/admin',
      's=1; Secure',
      'gone=1; Max-Age=0',
    ]);
    expect(jar.getCookieHeader(u('https://a.example.com/'))).toBe('s=1');
    expect(jar.getCookieHeader(u('https://a.example.com/admin/x'))).toBe('p=1; s=1');
    expect(jar.getCookieHeader(u('https://a.example.com/administrator'))).toBe('s=1');
    expect(jar.getCookieHeader(u('http://a.example.com/'))).toBe(''); // Secure needs https
    expect(jar.getCookieHeader(u('http://localhost:3000/'))).toBe('');
    jar.saveCookies(u('http://localhost:3000/'), ['dev=1; Secure']);
    expect(jar.getCookieHeader(u('http://localhost:3000/'))).toBe('dev=1'); // loopback counts as secure
  });

  test('an expired cookie deletes the stored one; HttpOnly is hidden from scripts', () => {
    const jar = new CookieJar();
    const site = u('https://x.test/');
    jar.saveCookies(site, ['sid=abc; HttpOnly', 'theme=dark']);
    expect(jar.getScriptCookieString(site)).toBe('theme=dark');
    expect(jar.setFromScript(site, 'sid=hijack')).toBe(false); // can't overwrite HttpOnly
    expect(jar.setFromScript(site, 'lang=en; path=/')).toBe(true);
    jar.saveCookies(site, ['theme=; Expires=Thu, 01 Jan 1970 00:00:00 GMT']);
    expect(jar.getCookieHeader(site)).toBe('sid=abc; lang=en');
  });

  test('persists to disk and reloads', () => {
    const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mtx-jar-')), 'jar.json');
    const jar = new CookieJar(file);
    jar.saveCookies(u('https://keep.test/'), ['a=1; Max-Age=3600', 'b=2']);
    jar.flush();
    const again = new CookieJar(file);
    expect(again.getCookieHeader(u('https://keep.test/'))).toBe('a=1; b=2');
  });
});

test.describe('proxy login flow (e2e)', () => {
  let site;
  let port;
  let host;

  test.beforeAll(async ({ baseURL }) => {
    host = fixtureHost(baseURL);
    site = http.createServer((req, res) => {
      if (req.url === '/login' && req.method === 'POST') {
        let body = '';
        req.on('data', d => { body += d; });
        req.on('end', () => {
          // The form body must arrive untouched (not re-encoded as JSON).
          const ok = body === 'user=alice&pw=s3cret';
          res.writeHead(302, { Location: '/', 'Set-Cookie': `auth=${ok ? 'alice' : 'bad'}; Path=/; HttpOnly` });
          res.end();
        });
        return;
      }
      const cookie = req.headers.cookie || '';
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`<!doctype html><head><title>t</title></head><body>
        <div id="who">${/auth=alice/.test(cookie) ? 'signed-in' : 'signed-out'}</div>
        <div id="js">${/pref=1/.test(cookie) ? 'pref-seen' : 'no-pref'}</div>
        <form method="post" action="/login"><input name="user" value="alice"><input name="pw" value="s3cret"><button id="go">go</button></form>
        <script>document.cookie = 'pref=1; path=/';</script></body>`);
    });
    await new Promise(r => site.listen(0, '0.0.0.0', r));
    port = site.address().port;
  });
  test.afterAll(() => new Promise(r => { site.close(r); site.closeAllConnections(); }));

  test('a form login that sets its cookie on a 302 stays signed in', async ({ page, request }) => {
    await request.delete('/api/proxy/cookies');
    await page.goto(`/proxy/http/${host}:${port}/`);
    await expect(page.locator('#who')).toHaveText('signed-out');
    await page.locator('#go').click();
    await expect(page.locator('#who')).toHaveText('signed-in');
    // The page's own document.cookie write was forwarded to the jar too (it's
    // async, so it can land after the redirect's GET — check on a reload).
    await expect.poll(async () => { await page.reload(); return page.locator('#js').textContent(); }).toBe('pref-seen');
    // A fresh browser context (no Meowtrix-origin cookies at all) is still
    // signed in: the session lives in the server-side jar.
    const other = await page.context().browser().newPage();
    await other.goto(new URL(`/proxy/http/${host}:${port}/`, page.url()).href);
    await expect(other.locator('#who')).toHaveText('signed-in');
    await other.close();
    await request.delete('/api/proxy/cookies');
  });
});

test.describe('proxied WebSockets (e2e)', () => {
  let site;
  let port;
  let host;

  test.beforeAll(async ({ baseURL }) => {
    host = fixtureHost(baseURL);
    const { WebSocketServer } = require('ws');
    site = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html', 'Set-Cookie': 'wsauth=ok; Path=/' });
      // Pages usually build their socket URL from location.host — which, behind
      // the proxy, is Meowtrix's. The injected shim must route it to the site.
      res.end(`<!doctype html><head><title>ws</title></head><body><div id="out">waiting</div><script>
        var s = new WebSocket('ws://' + location.host + '/echo');
        s.onopen = function () { s.send('ping'); };
        s.onmessage = function (e) { document.getElementById('out').textContent = e.data; };
        s.onerror = function () { document.getElementById('out').textContent = 'error'; };
      </script></body>`);
    });
    const wss = new WebSocketServer({ server: site, path: '/echo' });
    wss.on('connection', (ws, req) => ws.on('message', (m) => ws.send(`echo:${m}:${/wsauth=ok/.test(req.headers.cookie || '') ? 'cookie' : 'nocookie'}`)));
    await new Promise(r => site.listen(0, '0.0.0.0', r));
    port = site.address().port;
  });
  test.afterAll(() => new Promise(r => { site.close(r); site.closeAllConnections(); }));

  test('a page socket built from location.host reaches the real server with its cookies', async ({ page }) => {
    await page.goto(`/proxy/http/${host}:${port}/`);
    await expect(page.locator('#out')).toHaveText('echo:ping:cookie');
  });
});
