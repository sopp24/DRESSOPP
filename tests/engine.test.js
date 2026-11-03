import test from "node:test";
import assert from "node:assert/strict";
import { seasonFor, normalizeProduct, matchesFilters, rankProducts, createInitialState } from "../modules/engine.js";

test("seasonFor follows northern hemisphere seasons", function() {
  assert.equal(seasonFor(new Date(2026, 0, 15)), "Hiver");
  assert.equal(seasonFor(new Date(2026, 3, 15)), "Printemps");
  assert.equal(seasonFor(new Date(2026, 6, 15)), "Été");
  assert.equal(seasonFor(new Date(2026, 9, 15)), "Automne");
});

test("normalizeProduct cleans URLs, prices and attributes", function() {
  const product = normalizeProduct({
    name: "Chemise Oxford", brand: "Atelier", merchant: "Boutique",
    url: "https://shop.example/products/oxford#details", price: "19.90",
    style: "Classique, Classe", color: "Bleu, Blanc"
  });
  assert.equal(product.name, "Chemise Oxford");
  assert.equal(product.price, 19.9);
  assert.equal(product.url, "https://shop.example/products/oxford#details");
  assert.deepEqual(product.styleTags, ["Classique", "Classe"]);
  assert.deepEqual(product.colors, ["Bleu", "Blanc"]);
});

test("normalizeProduct rejects unsafe protocols and unknown prices", function() {
  const product = normalizeProduct({ name: "Article", url: "javascript:alert(1)", price: "unknown" });
  assert.equal(product.url, "");
  assert.equal(product.price, null);
});

test("matchesFilters combines category, style, season and price", function() {
  const product = normalizeProduct({
    name: "Sneakers", objective: "Chaussures", styleTags: ["Sport"],
    seasonTags: ["Toute saison"], price: 75
  });
  assert.equal(matchesFilters(product, { objective: "Chaussures", style: "Sport", season: "Hiver", maxPrice: 80 }), true);
  assert.equal(matchesFilters(product, { objective: "Vêtements", style: "Sport", season: "Hiver", maxPrice: 80 }), false);
  assert.equal(matchesFilters(product, { objective: "Chaussures", style: "Sport", season: "Hiver", maxPrice: 50 }), false);
});

test("rankProducts excludes already rated products and respects price cap", function() {
  const products = [
    normalizeProduct({ id: "a", name: "T-shirt", objective: "Vêtements", styleTags: ["Classique"], price: 15 }),
    normalizeProduct({ id: "b", name: "Pantalon", objective: "Vêtements", styleTags: ["Classique"], price: 45 }),
    normalizeProduct({ id: "c", name: "Sweat", objective: "Vêtements", styleTags: ["Classique"], price: 18 })
  ];
  const state = createInitialState(products);
  state.interactions.likes.push({ productId: "a" });
  const result = rankProducts(products, state, {
    filters: { objective: "Vêtements", style: "Classique", season: "Toute saison", maxPrice: 20 }
  });
  assert.deepEqual(result.map(function(item) { return item.id; }).sort(), ["c"]);
});
