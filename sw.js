/* ==========================================================
   Mavo City – Service Worker (App-Installation & Offline)
   - Seiten: zuerst aus dem Netz, offline aus dem Speicher
   - CSS/JS: zuerst aus dem Netz (passend zur Seite), offline aus dem Speicher
   - Bilder/Schriften: sofort aus dem Speicher, im Hintergrund aktualisiert
   - Fremde Dienste (Supabase, FiveM, Discord, Twitch) werden NIE gespeichert
   Bei größeren Änderungen VERSION erhöhen.
   ========================================================== */
const VERSION = "mavo-v5";
const CORE = ["./", "index.html", "css/style.css", "css/pages.css", "css/features.css", "css/forum.css", "css/extras.css",
  "assets/logo.svg", "assets/icons.svg", "assets/favicon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.endsWith("/admin.html") || url.pathname.includes("/supabase/")) return;

  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(req, copy));
      return res;
    }).catch(() => caches.match(req).then((r) => r || caches.match("index.html"))));
    return;
  }

  // Code & Styles: immer frisch (damit HTML und JS zusammenpassen), offline aus dem Speicher
  const isCode = /\.(js|css|webmanifest)$/.test(url.pathname);
  if (isCode) {
    e.respondWith(fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req)));
    return;
  }

  // Bilder & Schriften: sofort aus dem Speicher, im Hintergrund aktualisieren
  e.respondWith(caches.open(VERSION).then((cache) => cache.match(req).then((cached) => {
    const fresh = fetch(req).then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => cached);
    return cached || fresh;
  })));
});
