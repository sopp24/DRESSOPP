const CACHE_NAME = "dressopp-static-v2";
const CORE_FILES = [
  "./", "./index.html", "./styles.css", "./app.js",
  "./modules/store.js", "./modules/engine.js", "./modules/integrations.js", "./modules/outfits.js",
  "./data/catalog.json", "./data/pinterest-pins.json", "./manifest.webmanifest", "./assets/favicon.svg",
  "./assets/logo-horizontal.png", "./assets/logo-square.png"
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
