const CACHE_VERSION = "bot-v1";
const PRECACHE_URLS = [
  "/",
  "/dashboard",
  "/transactions",
  "/import",
  "/targets",
  "/settings",
  "/trends",
  "/logo.svg",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;
  if (!request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          }
        }).catch(() => {});
        return cached;
      }

      return fetch(request).then((response) => {
        if (!response.ok) return response;

        const url = new URL(request.url);
        const shouldCache =
          request.destination === "document" ||
          url.pathname.startsWith("/_next/static/") ||
          url.pathname.endsWith(".svg") ||
          url.pathname.endsWith(".png") ||
          url.pathname.endsWith(".ico") ||
          url.pathname.endsWith(".woff2");

        if (shouldCache) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
        }

        return response;
      }).catch(() => {
        if (request.destination === "document") {
          return caches.match("/dashboard");
        }
        return new Response("Offline", { status: 503 });
      });
    })
  );
});
