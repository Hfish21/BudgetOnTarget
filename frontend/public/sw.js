const CACHE_VERSION = "bot-v4";

const APP_SHELL = [
  "/",
  "/app/dashboard",
  "/app/transactions",
  "/app/import",
  "/app/targets",
  "/app/settings",
  "/app/trends",
  "/logo.svg",
];

self.addEventListener("install", (event) => {
  const base = self.location.pathname.replace(/\/sw\.js$/, "");
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL.map((p) => `${base}${p}`)))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Build output is content-hashed, so these URLs are immutable: if the path
// still resolves, the bytes behind it never changed.
function isImmutableAsset(url) {
  return url.pathname.includes("/_next/static/");
}

function isCacheableAsset(url) {
  return (
    isImmutableAsset(url) ||
    /\.(svg|png|ico|woff2|webmanifest)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;
  if (!request.url.startsWith(self.location.origin)) return;

  const url = new URL(request.url);

  // Documents are network-first. Serving a stale HTML document is not a
  // harmless optimization: its <script> tags name content-hashed chunks that
  // the next deploy deletes, so the cached page loads into a ChunkLoadError
  // and renders nothing. Fresh HTML always wins when the network is reachable;
  // the cache is strictly an offline fallback.
  if (request.destination === "document") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(async () => {
          const base = self.location.pathname.replace(/\/sw\.js$/, "");
          return (
            (await caches.match(request)) ??
            (await caches.match(`${base}/app/dashboard`)) ??
            new Response("Offline", { status: 503 })
          );
        })
    );
    return;
  }

  // Hashed assets are safe to serve from cache indefinitely.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        // Immutable URLs never need revalidating; anything else might.
        if (!isImmutableAsset(url)) {
          fetch(request)
            .then((response) => {
              if (response.ok) {
                const clone = response.clone();
                caches
                  .open(CACHE_VERSION)
                  .then((cache) => cache.put(request, clone));
              }
            })
            .catch(() => {});
        }
        return cached;
      }

      return fetch(request)
        .then((response) => {
          if (response.ok && isCacheableAsset(url)) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => new Response("Offline", { status: 503 }));
    })
  );
});
