import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
const root = new URL("../", import.meta.url);

test("the discovery deck exposes the five Tinder-style actions", function() {
  for (const action of ["undo", "vote", "save-list", "share-product"]) {
    assert.ok(app.includes('data-action="' + action + '"') || app.includes('data-action="' + action + '"'), "Missing " + action);
  }
  assert.ok(app.includes('data-vote="no"'));
  assert.ok(app.includes('data-vote="yes"'));
  assert.ok(app.includes("deck-action-share"));
  assert.ok(app.includes("aria-label=\"Ajouter à ma liste\"") || app.includes("Ajouter à ma liste"));
});

test("the product card includes the product details and original merchant link", function() {
  assert.ok(app.includes("product-brand-price"));
  assert.ok(app.includes("product-attributes"));
  assert.ok(app.includes("product-original-link"));
  assert.ok(app.includes("Voir l’article original"));
  assert.ok(app.includes("navigator.share"));
  assert.ok(app.includes("navigator.clipboard"));
  assert.ok(app.includes('./assets/rewind.webp'));
  assert.ok(app.includes('./assets/cross.webp'));
  assert.ok(app.includes('./assets/star.webp'));
  assert.ok(app.includes('./assets/fav.webp'));
  assert.ok(app.includes('./assets/share.webp'));
  assert.ok(css.includes(".deck-action-icon"));
});

test("the Tinder card styling has responsive tablet and mobile layouts", function() {
  assert.ok(css.includes(".discovery-layout--swipe"));
  assert.ok(css.includes("@media (max-width: 850px)"));
  assert.ok(css.includes("@media (max-width: 600px)"));
  assert.ok(css.includes(".deck-action-yes"));
  assert.ok(css.includes("aspect-ratio: 3 / 4"));
});


test("the Tenues view is Pinterest-only and exposes outfit favorites and a product carousel", function() {
  assert.ok(app.includes('pin.origin === "Pinterest"'));
  assert.ok(app.includes("data-outfit-style"));
  assert.ok(app.includes("outfitFilters"));
  assert.ok(app.includes("save-full-outfit"));
  assert.ok(app.includes("save-outfit-piece"));
  assert.ok(app.includes("open-saved-outfit"));
  assert.ok(app.includes("outfit-product-carousel"));
  assert.ok(app.includes("outfit-count"));
  assert.ok(css.includes(".outfit-proposal-grid"));
  assert.ok(css.includes(".outfit-product-carousel"));
  assert.ok(css.includes("@media (max-width: 600px)"));
});


test("saved outfit dependencies and total-price handling are imported by the application", function() {
  assert.ok(app.includes("productSlot, outfitTotalPrice"));
  assert.ok(app.includes("outfitTotalPrice(items)"));
});

test("all local files referenced by the application shell exist", function() {
  for (const match of index.matchAll(/(?:src|href)="\.\/([^"]+)"/g)) {
    assert.ok(existsSync(new URL(match[1],root)),"Missing local file: " + match[1]);
  }
  assert.ok(index.includes("https://sopp24.github.io/SOPP-agents/assets/brand-mark.webp"));
});

test("the PWA refreshes its cache and preloads the app icons and first catalogue page", function() {
  assert.ok(sw.includes('dressopp-static-v15'));
  for (const path of [
    "./assets/logo-horizontal.png",
    "./assets/logo-square.png",
    "./assets/rewind.webp",
    "./assets/cross.webp",
    "./assets/star.webp",
    "./assets/fav.webp",
    "./assets/share.webp",
    "./data/catalog-pages/page-0001.json"
  ]) {
    assert.ok(sw.includes('"' + path + '"'),"Missing offline cache entry: " + path);
    assert.ok(existsSync(new URL(path,root)),"Cached file does not exist: " + path);
  }
});

test("mobile navigation and outfit details retain compact responsive breakpoints", function() {
  assert.ok(css.includes("left: 50%;"));
  assert.ok(css.includes("transform: translateX(-50%)"));
  assert.ok(css.includes("@media (max-width: 850px)"));
  assert.ok(css.includes("@media (max-width: 600px)"));
  assert.ok(css.includes("@media (max-width: 390px)"));
  assert.ok(css.includes(".outfit-carousel-card"));
});


test("Pour toi is swipe-first and moves all secondary discovery panels to Settings", function() {
  const discover=app.slice(app.indexOf("function renderDiscover(training)"),app.indexOf("function renderWardrobe()"));
  const settings=app.slice(app.indexOf("function renderDiscoveryInsights()"),app.indexOf("function renderSettings()"));
  assert.ok(discover.includes("renderDeckCard(products[0],training)"));
  assert.ok(discover.includes("renderFilterBar(false)"));
  assert.ok(!discover.includes("renderAiAgentPanel()"));
  assert.ok(!discover.includes("renderCatalogStatus()"));
  assert.ok(!discover.includes("renderRetailerDirectory()"));
  assert.ok(settings.includes("renderAiAgentPanel()"));
  assert.ok(settings.includes("renderCatalogStatus()"));
  assert.ok(settings.includes("renderRetailerDirectory()"));
  assert.ok(app.includes('currentView === "discover"'));
  assert.ok(css.includes("height: 100dvh"));
  assert.ok(css.includes(".discovery-page--app .deck-card-wrap"));
});

test("Pinterest is the sole inspiration source and the old local lookbook is absent", function() {
  assert.ok(!app.toLowerCase().includes("lookbook"));
  assert.ok(!sw.toLowerCase().includes("lookbook"));
  assert.ok(app.includes('fromFeed: true, origin: "Pinterest"'));
  assert.ok(app.includes('source === "Pinterest"'));
  assert.ok(app.includes("function renderInspirations()"));
  assert.ok(index.includes("https://sopp24.github.io/SOPP-agents/assets/brand-mark.webp"));
});
