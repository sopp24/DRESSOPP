const CACHE_NAME = "dressopp-static-v17";
const CORE_FILES = [
  "./", "./index.html", "./privacy.html", "./manifest.webmanifest", "./styles.css", "./app.js",
  "./modules/store.js", "./modules/engine.js", "./modules/integrations.js",
  "./modules/outfits.js", "./modules/community.js", "./modules/agent.js", "./modules/audience.js",
  "./data/catalog-manifest.json", "./data/catalog-pages/page-0001.json",
  "./assets/logo-square.svg", "./assets/logo-horizontal.svg", "./assets/rewind.svg", "./assets/cross.svg",
  "./assets/star.svg", "./assets/fav.svg", "./assets/share.svg",
  "./assets/fonts/poppins-latin-400-normal.woff2",
  "./assets/fonts/poppins-latin-500-normal.woff2",
  "./assets/fonts/poppins-latin-600-normal.woff2",
  "./assets/fonts/poppins-latin-700-normal.woff2",
  "./assets/fonts/poppins-latin-800-normal.woff2"
];

self.addEventListener("install", function(event) {
  event.waitUntil((async function() {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(CORE_FILES.map(async function(path) {
      try {
        await cache.add(path);
      } catch (error) {
        console.warn("Ressource non précachée :", path, error);
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", function(event) {
  event.waitUntil(caches.keys().then(function(keys) {
    return Promise.all(keys
      .filter(function(key) { return key !== CACHE_NAME; })
      .map(function(key) { return caches.delete(key); }));
  }).then(function() { return self.clients.claim(); }));
});

self.addEventListener("fetch", function(event) {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith((async function() {
    try {
      const response = await fetch(request);
      if (response && response.status === 200 && response.type !== "opaque") {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      const cached = await caches.match(request);
      if (cached) return cached;
      if (request.mode === "navigate") {
        const fallback = await caches.match("./index.html");
        if (fallback) return fallback;
      }
      return Response.error();
    }
  })());
});
