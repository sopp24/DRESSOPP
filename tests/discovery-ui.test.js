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
  assert.ok(app.includes("renderProductAttributes(product)"));
  assert.ok(!app.includes('class="product-details-pill" type="button" data-action="details"'));
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

test("the restored Tinder card styling keeps responsive tablet and mobile layouts", function() {
  assert.ok(css.includes(".discovery-layout--swipe"));
  assert.ok(css.includes("@media (max-width: 850px)"));
  assert.ok(css.includes("@media (max-width: 600px)"));
  assert.ok(css.includes(".deck-action-yes"));
  assert.ok(css.includes(".product-visual"));
  assert.ok(css.includes("object-fit: cover"));
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
  const primaryBranch=discover.slice(0,discover.indexOf("const trainingExtras = training"));
  assert.ok(primaryBranch.includes("const appToolbar = !training"));
  assert.ok(!primaryBranch.includes("renderAiAgentPanel()"));
  assert.ok(!primaryBranch.includes("renderCatalogStatus()"));
  assert.ok(!primaryBranch.includes("renderRetailerDirectory()"));
  assert.ok(discover.includes("const trainingExtras = training"));
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


test("swiping down on the discovery card saves it to the list", function() {
  assert.ok(app.includes("verticalSaveIntent"));
  assert.ok(app.includes("const acceptedSave = !horizontalIntent && deltaY >= saveThreshold && deltaY > Math.abs(deltaX) * 1.08"));
  assert.ok(app.includes('animateDeckDecision(productId, acceptedSave ? "save"'));
  assert.ok(css.includes(".product-card.is-committing.is-save .swipe-tint"));
});

test("Pinterest pins are inside Training and no standalone Pins navigation remains", function() {
  assert.ok(!index.includes('data-view="inspirations"'));
  assert.ok(app.includes("training-pins-panel"));
  assert.ok(app.includes("renderInspirations()"));
  assert.ok(app.includes("renderCatalogStatus() + renderRetailerDirectory() + renderAiAgentPanel()"));
  assert.ok(css.includes(".training-support .ai-agent-panel"));
});

test("mobile external article link keeps the desktop arrow instead of a large circular icon", function() {
  assert.ok(css.includes("Mobile: keep the original desktop external-link glyph"));
  assert.ok(css.includes("background: transparent;"));
});

 
test("the final mobile UX layer reserves space for the swipe deck and prevents nav/header overlap", function() {
  assert.ok(css.includes("Mobile UX pass — reserve independent zones"));
  assert.ok(css.includes("grid-template-columns: minmax(0,1fr) auto;"));
  assert.ok(css.includes("body.is-discovery-app .main-content"));
  assert.ok(css.includes("calc(78px + env(safe-area-inset-bottom))"));
  assert.ok(css.includes("max-height: min(68dvh,560px)"));
  assert.ok(css.includes("@media (max-width: 350px)"));
  assert.ok(css.includes("orientation: landscape) and (max-height: 520px"));
  assert.ok(css.includes("body.is-discovery-app .top-actions .icon-button { display: none; }"));
});


test("stored products are re-normalized before strict men's-only discovery", function() {
  assert.ok(app.includes("state.products = (Array.isArray(state.products) ? state.products : []).map(normalizeProduct)"));
});


test("swipe cards do not display gesture instructions inside the product card", function() {
  assert.ok(!app.includes("Gauche : passer"));
  assert.ok(!app.includes("Droite : j’aime"));
  assert.ok(app.includes('data-vote="no"'));
  assert.ok(app.includes('data-vote="yes"'));
  assert.ok(app.includes('data-action="save-list"'));
});


test("the restored swipe layout keeps the product card separate from the action row", function() {
  const cardRenderer = app.slice(app.indexOf("function renderDeckCard"),app.indexOf("function renderGridCards"));
  assert.ok(cardRenderer.indexOf("'<div class=\"product-visual\">'") < cardRenderer.indexOf("'<div class=\"product-info\">"));
  assert.ok(cardRenderer.indexOf("'<div class=\"product-info\">") < cardRenderer.indexOf("'</article>'"));
  assert.ok(cardRenderer.indexOf("'</article>'") < cardRenderer.indexOf("'<div class=\"deck-actions\""));
  assert.ok(cardRenderer.endsWith("    '</div>';\n}\n"));
  assert.ok(app.includes("renderProductAttributes(product)"));
  assert.ok(app.includes('const gestureSurface = card.closest(".deck-card-wrap") || card;'));
  assert.ok(app.includes("gestureSurface.setPointerCapture(pointerId)"));
  assert.ok(css.includes(".product-card {"));
  assert.ok(css.includes(".product-visual img"));
  assert.ok(css.includes(".product-info {"));
  assert.ok(css.includes(".deck-actions {"));
  assert.ok(css.includes("min-width: 44px"));
  assert.ok(!css.includes("Maquette DRESSOPP — carte mobile verticale"));
  assert.ok(app.includes("isMenswearPin(pin)"));
  assert.ok(app.includes('name="menswear" required'));
  assert.ok(app.includes('if (data.get("menswear") !== "on") throw new Error("Confirme que la fiche source classe explicitement cet article dans la collection homme.")'));
  assert.ok(app.includes('gender: "men", genderVerified: true'));
});
