// Installable-app service worker. It never caches pages or API responses: plans, approvals and the
// executor's state must always be live, so a stale copy is never shown. Offline, a page load gets
// a small "you're offline" page instead of the browser's error.
const CACHE = "tradeboard-offline-v2";
// The canonical URL: Cloudflare redirects /offline.html here, and a redirected response can't answer a navigation.
const OFFLINE = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.add(new Request(OFFLINE, { cache: "reload" }))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE)));
});
