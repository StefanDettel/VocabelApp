/* Vocabula Service Worker – macht die App offline-fähig. */
const VERSION = "vocabula-v1";
const CORE = ["./", "index.html", "app.js", "textgen.js", "ocr-parse.js", "manifest.webmanifest",
  "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png", "data/nouns.txt",
  "vendor/tesseract.min.js", "vendor/worker.min.js",
  "vendor/core/tesseract-core-simd-lstm.wasm.js", "vendor/core/tesseract-core-lstm.wasm.js",
  "vendor/lang/lat.traineddata.gz", "vendor/lang/deu.traineddata.gz"];
self.addEventListener("install", e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION && k !== "vocabula-fonts").map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const req = e.request; if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open("vocabula-fonts").then(async c => { const hit = await c.match(req); if (hit) return hit;
      try { const res = await fetch(req); c.put(req, res.clone()); return res; } catch (_) { return new Response("", { status: 504 }); } }));
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return res;
  }).catch(() => req.mode === "navigate" ? caches.match("index.html") : Response.error())));
});
