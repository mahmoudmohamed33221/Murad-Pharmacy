// Service Worker: بيخلي التطبيق يشتغل أوفلاين وبيدير التحديثات.
// BUILD بيتغير تلقائي مع كل نشر => المتصفح يكتشف النسخة الجديدة ويعرض زرار "حدّث الآن".
const BUILD = "apk-26";
const CACHE = "murad-pharmacy-" + BUILD;
const IMG_CACHE = "murad-img-v1";
const SHELL = ["./", "index.html", "config.js", "assets/style.css", "assets/app.js", "assets/logo.png",
  "manifest.webmanifest", "assets/icons/icon-192.png", "assets/icons/icon-512.png"];

self.addEventListener("install", e => {
  // مفيش skipWaiting هنا: النسخة الجديدة بتستنى لحد ما العميل يضغط "حدّث الآن"
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, {cache: "reload"})))));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("murad-pharmacy-") && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", e => { if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting(); });

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;            // خطوط جوجل وGoogle Sheets: من الشبكة مباشرة

  if (url.pathname.includes("/data/")) {                 // المنتجات: الشبكة أولًا (عشان الأسعار تتحدث) وبعدين الكاش
    e.respondWith(fetch(req).then(res => { const c = res.clone(); caches.open(CACHE).then(x => x.put(req, c)); return res; })
      .catch(() => caches.match(req)));
    return;
  }
  if (url.pathname.includes("/assets/products/")) {      // صور المنتجات: كاش أولًا
    e.respondWith(caches.open(IMG_CACHE).then(async c => {
      const hit = await c.match(req); if (hit) return hit;
      const res = await fetch(req); if (res.ok) c.put(req, res.clone()); return res;
    }));
    return;
  }
  e.respondWith(caches.match(req, {ignoreSearch: true}).then(hit => hit || fetch(req)));   // باقي الملفات: من كاش النسخة الحالية
});
