const CACHE_NAME = "dressopp-static-v14";
const CORE_FILES = [
  "./", "./index.html", "./privacy.html", "./styles.css", "./app.js",
  "./modules/store.js", "./modules/engine.js", "./modules/integrations.js", "./modules/outfits.js", "./modules/community.js", "./modules/agent.js",
  "./data/catalog.json", "./data/catalog-manifest.json", "./data/catalog-meta.json", "./data/catalog-seeds.json", "./data/public-sources.json", "./data/merchant-directory.json", "./data/community-config.json", "./data/ai-agent-config.json", "./data/pinterest-pins.json", "./data/lookbook-pins.json",
  "./data/catalog-pages/page-0001.json",
  "./assets/logo-horizontal.png",
  "./assets/rewind.webp", "./assets/cross.webp", "./assets/star.webp", "./assets/fav.webp", "./assets/share.webp",
  "./assets/lookbook/look-01.webp",
  "./assets/lookbook/look-02.webp",
  "./assets/lookbook/look-03.webp",
  "./assets/lookbook/look-04.webp",
  "./assets/lookbook/look-05.webp",
  "./assets/lookbook/look-06.webp",
  "./assets/lookbook/look-07.webp",
  "./assets/lookbook/look-08.webp",
  "./assets/lookbook/look-09.webp",
  "./assets/lookbook/look-10.webp",
  "./assets/lookbook/look-11.webp",
  "./assets/lookbook/look-12.webp",
  "./assets/lookbook/look-13.webp",
  "./assets/lookbook/look-14.webp",
  "./assets/lookbook/look-15.webp",
  "./assets/lookbook/look-16.webp",
  "./assets/lookbook/look-17.webp",
  "./assets/lookbook/look-18.webp",
  "./assets/lookbook/look-19.webp",
  "./assets/lookbook/look-20.webp", "./manifest.webmanifest",
  "./assets/logo-square.png"
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
