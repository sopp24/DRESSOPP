const CACHE_NAME = "dressopp-static-v16";
const CORE_FILES = [
  "./", "./index.html", "./privacy.html", "./styles.css", "./app.js",
  "./modules/store.js", "./modules/engine.js", "./modules/integrations.js", "./modules/outfits.js", "./modules/community.js", "./modules/agent.js", "./modules/audience.js",
  "./data/catalog-pages/page-0001.json",
  "./assets/logo-horizontal.png",
  "./assets/rewind.webp", "./assets/cross.webp", "./assets/star.webp", "./assets/fav.webp", "./assets/share.webp",
  "./assets/logo-square.png",
  "./assets/fonts/poppins-latin-400-normal.woff2", "./assets/fonts/poppins-latin-500-normal.woff2", "./assets/fonts/poppins-latin-600-normal.woff2",
  "./assets/fonts/poppins-latin-700-normal.woff2", "./assets/fonts/poppins-latin-800-normal.woff2"
];
self.addEventListener("install", function(event) {
  event.waitUntil(caches.open(CACHE_NAME).then(function(cache) {
    return cache.addAll(CORE_FILES).catch(function(error) { console.warn("Cache initial partiel :", error); });
  }).then(function() { return self.skipWaiting(); }));
});
self.addEventListener("activate", function(event) {
  event.waitUntil(caches.keys().then(function(keys) {
    return Promise.all(keys.filter(function(key) { return key !== CACHE_NAME; }).map(function(key) { return caches.delete(key); }));
  }).then(function() { return self.clients.claim(); }));
});
self.addEventListener("fetch", function(event) {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then(function(response) {
    if (response && response.status === 200) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(function(cache) { cache.put(event.request, copy); });
    }
    return response;
  }).catch(function() {
    return caches.match(event.request).then(function(cached) {
      return cached || (event.request.mode === "navigate" ? caches.match("./index.html") : Response.error());
    });
  }));
});
