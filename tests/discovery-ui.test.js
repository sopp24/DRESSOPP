import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

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
