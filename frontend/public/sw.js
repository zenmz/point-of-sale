// Service worker dasar MZ POS — installable + cache app shell.
// Sinkronisasi data offline penuh menyusul di Fase 2 (IndexedDB + sync engine).
const CACHE = "mzpos-shell-v1";
const SHELL = [
  "/",
  "/index.html",
  "/favicon.svg",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Permintaan API tidak di-cache (selalu jaringan).
  if (url.pathname.startsWith("/api/")) return;

  // Navigasi SPA: coba jaringan, fallback ke shell saat offline.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/index.html")));
    return;
  }

  // Aset statis same-origin: cache-first, isi cache saat pertama diambil.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
            return res;
          }),
      ),
    );
  }
});
