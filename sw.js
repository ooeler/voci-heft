// Hält die App offline verfügbar. VERSION setzt build.mjs bei jedem Build automatisch.
const VERSION = "voci-heft-dev";
const SHELL = ["./", "index.html", "style.css", "app.js", "config.js", "manifest.webmanifest", "vendor/supabase.js", "vendor/hyphen/hyphen.js", "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"];
// Schriften und die Sprachdaten der Texterkennung (keine Programme, nur Daten)
const CDN = ["cdn.jsdelivr.net", "fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // Der Wartungsschalter soll immer frisch vom Server kommen, nie aus dem Zwischenspeicher
  if (url.origin === location.origin && url.pathname.endsWith("/wartung.json")) return;
  // Eigene Dateien: zuerst Netz (damit Änderungen ankommen), sonst Zwischenspeicher
  if (url.origin === location.origin) {
    e.respondWith(fetch(e.request).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match("index.html"))));
    return;
  }
  // Schriften und Sprachdaten: feste Versionen, darum zuerst Zwischenspeicher
  if (CDN.includes(url.hostname)) {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); }
      return r;
    })));
  }
});
