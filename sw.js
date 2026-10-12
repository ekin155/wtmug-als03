const CACHE_NAME = "weather-pwa-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

// Kurulum: uygulama kabuğunu önbelleğe al
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Aktivasyon: eski önbellekleri temizle
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch stratejisi
self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Open-Meteo API istekleri: Network-first, başarısızsa önbellekten
  if (url.hostname.includes("open-meteo.com")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Diğer istekler: Cache-first
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});