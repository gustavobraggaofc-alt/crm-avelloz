// =========================================================
// CRM AVELLOZ - Service Worker (experiência de app instalável)
// =========================================================

const CACHE_NAME = "avelloz-crm-v2";
const STATIC_ASSETS = [
  "css/style.css",
  "js/script.js",
  "js/api.js",
  "icon.svg",
  "manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || request.url.includes("/api/")) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      const atualizado = fetch(request)
        .then((resposta) => {
          cache.put(request, resposta.clone());
          return resposta;
        })
        .catch(() => cached);
      return cached || atualizado;
    })
  );
});
