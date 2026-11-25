import test from "node:test";
import assert from "node:assert/strict";
import { diversifyDeck, diversifyProducts, createRng, brandKey, merchantKey, familyKey, productKeys } from "../modules/diversify.js";
import { normalizeProduct as normalizeRawProduct, rankProducts, createInitialState, decisionHistory } from "../modules/engine.js";

function normalizeProduct(raw) { return normalizeRawProduct(Object.assign({ gender: "men", genderVerified: true, seasonTags: ["Toute saison"] }, raw || {})); }
function maxRun(values) {
  let best = 0, run = 0, previous = null;
  values.forEach(function(value) { run = value === previous ? run + 1 : 1; previous = value; best = Math.max(best, run); });
  return best;
}
// Catalogue de test : une grande marque très pertinente (TNF) et plusieurs autres, de pertinence légèrement inférieure.
function buildCatalogue() {
  const brands = ["TheNorthFace", "Nike", "Jules", "Carhartt WIP", "Uniqlo", "Lemaire", "Asket", "Edwin"];
  const kinds = [["Pull", "Pull"], ["Chemise", "Chemise"], ["Pantalon", "Pantalon"], ["T-shirt", "T-shirt"], ["Veste", "Veste"]];
  const entries = [];
  brands.forEach(function(brand, brandIndex) {
    kinds.forEach(function(kind, kindIndex) {
      for (let copy = 0; copy < 3; copy += 1) {
        const product = normalizeProduct({
          id: brand + "-" + kind[0] + "-" + copy, name: kind[0] + " " + brand + " " + copy, brand: brand, merchant: brand,
          objective: "Vêtements", category: kind[1], price: 20 + ((brandIndex * 7 + kindIndex * 31 + copy * 17) % 160),
          styleTags: [["Classique", "Sport", "Preppy", "Workwear"][(brandIndex + kindIndex) % 4]],
          colors: [["Noir", "Bleu", "Beige", "Vert"][(brandIndex + copy) % 4]]
        });
        // TheNorthFace est systématiquement un peu mieux noté, comme si le profil l'aimait.
        entries.push({ product: product, score: 50 - brandIndex * 1.2 - kindIndex * .8 - copy * .3 + (brand === "TheNorthFace" ? 6 : 0) });
      }
    });
  });
  return entries;
}

test("createRng is deterministic for a given seed and differs between seeds", function() {
  const a = createRng("graine"), b = createRng("graine"), c = createRng("autre");
  const first = [a(), a(), a()], second = [b(), b(), b()];
  assert.deepEqual(first, second);
  assert.notDeepEqual(first, [c(), c(), c()]);
  first.forEach(function(value) { assert.ok(value >= 0 && value < 1); });
});

test("brand, merchant and family keys are canonical", function() {
  assert.equal(brandKey({ brand: "NIKE", merchant: "Foot Locker" }), brandKey({ brand: "Nike", merchant: "Courir" }));
  assert.equal(brandKey({ brand: "Armor-Lux", merchant: "Armor Lux" }), brandKey({ brand: "ARMOR LUX" }));
  // Un titre de produit dans le champ marque ne vaut pas une marque : la boutique prend le relais.
  assert.equal(brandKey({ brand: "Metropolis Series Extrafine Merino Wool Beanie", merchant: "Care of Carl" }), "shop:careofcarl");
  assert.equal(merchantKey({ merchant: "Zalando · OVS Group" }), "zalando");
  assert.equal(familyKey({ name: "Pull col roulé", category: "Pull" }), "knit");
  assert.equal(familyKey({ name: "Truc", category: "Vêtements" }), "autre");
  assert.equal(productKeys({ price: 120, colors: ["Bleu marine"], styleTags: ["Preppy"] }).price, "premium");
  assert.equal(productKeys({ colors: ["Bleu marine"] }).color, "blue");
});

test("diversifyDeck breaks long runs of one brand while keeping the most relevant card first", function() {
  const entries = buildCatalogue();
  const plain = entries.slice().sort(function(a, b) { return b.score - a.score; }).map(function(entry) { return entry.product.brand; });
  assert.ok(maxRun(plain.slice(0, 40)) >= 8, "le classement brut doit montrer la dérive vers une seule marque");
  const ordered = diversifyDeck(entries, { seed: "s1", limit: 60 }).map(function(entry) { return entry.product; });
  const brands = ordered.slice(0, 40).map(function(product) { return product.brand; });
  assert.ok(maxRun(brands) <= 1, "aucune marque deux fois de suite : " + brands.join(","));
  for (let start = 0; start + 8 <= 40; start += 1) {
    const window = brands.slice(start, start + 8), counts = {};
    window.forEach(function(brand) { counts[brand] = (counts[brand] || 0) + 1; });
    assert.ok(Math.max.apply(null, Object.values(counts)) <= 2, "plafond de 2 par marque sur 8 cartes : " + window.join(","));
  }
  assert.equal(ordered[0].brand, "TheNorthFace", "la pièce la plus pertinente reste en tête");
  assert.equal(new Set(ordered.map(function(product) { return product.id; })).size, entries.length, "aucune pièce perdue ni dupliquée");
});

test("diversifyDeck never promotes pieces outside the relevance band", function() {
  const entries = [];
  for (let index = 0; index < 12; index += 1) entries.push({ product: normalizeProduct({ id: "top-" + index, name: "Pull " + index, brand: "Favori", merchant: "Favori", category: "Pull", price: 50 }), score: 100 - index });
  for (let index = 0; index < 6; index += 1) entries.push({ product: normalizeProduct({ id: "low-" + index, name: "Chemise " + index, brand: "Autre" + index, merchant: "Autre" + index, category: "Chemise", price: 150 }), score: -40 - index });
  const ordered = diversifyDeck(entries, { seed: "band", exploration: 0 }).map(function(entry) { return entry.product.id; });
  const firstTwelve = ordered.slice(0, 12);
  assert.ok(firstTwelve.every(function(id) { return id.startsWith("top-"); }), "les pièces très peu pertinentes ne passent pas devant : " + firstTwelve.join(","));
});

test("diversifyDeck is deterministic for one seed, varies between seeds, and accepts an injected rng", function() {
  const entries = buildCatalogue();
  const ids = function(options) { return diversifyDeck(entries, options).slice(0, 30).map(function(entry) { return entry.product.id; }).join("|"); };
  assert.equal(ids({ seed: "x", exploration: .2 }), ids({ seed: "x", exploration: .2 }));
  assert.notEqual(ids({ seed: "x", exploration: .2 }), ids({ seed: "y", exploration: .2 }));
  assert.equal(ids({ rng: createRng("inject"), exploration: .2 }), ids({ rng: createRng("inject"), exploration: .2 }));
});

test("exploration adds a gentle share of off-profile pieces and never picks blocked or rejected ones", function() {
  const entries = buildCatalogue();
  entries.forEach(function(entry) { if (entry.product.brand === "Edwin") entry.blocked = true; });
  entries.forEach(function(entry) { entry.affinity = entry.product.brand === "Asket" ? -10 : 5; });
  let explored = 0, total = 0;
  for (let run = 0; run < 40; run += 1) {
    const output = diversifyDeck(entries, { seed: "run-" + run, exploration: .18, limit: 1 });
    const first = output[0].product;
    total += 1;
    // La tête n'est « exploratoire » que si elle n'est pas la plus pertinente.
    if (first.brand !== "TheNorthFace") explored += 1;
    assert.ok(first.brand !== "Edwin" && first.brand !== "Asket", "pièce bloquée proposée : " + first.brand);
  }
  assert.ok(explored >= 1 && explored <= total * .45, "part d'exploration raisonnable : " + explored + "/" + total);
});

test("recent decisions and the day's history also count against repeated brands", function() {
  const entries = buildCatalogue();
  const history = [];
  for (let index = 0; index < 8; index += 1) {
    history.push({ product: normalizeProduct({ id: "h" + index, name: "Pull TheNorthFace h" + index, brand: "TheNorthFace", merchant: "TheNorthFace", category: "Pull" }), at: Date.now() - (8 - index) * 60000 });
  }
  const ordered = diversifyDeck(entries, { seed: "history", history: history, exploration: 0, limit: 10 });
  const firstBrands = ordered.slice(0, 6).map(function(entry) { return entry.product.brand; });
  assert.ok(!firstBrands.includes("TheNorthFace"), "après huit TheNorthFace décidées, la marque disparaît du début du paquet : " + firstBrands.join(","));
});

test("rankProducts keeps seen, filtered and unsuitable pieces out while diversifying per session", function() {
  const products = buildCatalogue().map(function(entry) { return entry.product; });
  const state = createInitialState(products);
  const rated = products[0];
  state.interactions.dislikes.push({ productId: rated.id, createdAt: new Date().toISOString() });
  const filters = { objective: "Vêtements", style: "Tous", season: "Toute saison", maxPrice: 90 };
  const ranked = rankProducts(products, state, { filters: filters, seed: "session-a", exploration: .18 });
  assert.ok(ranked.length > 20);
  assert.ok(!ranked.some(function(product) { return product.id === rated.id; }), "une pièce déjà refusée ne revient pas");
  assert.ok(ranked.every(function(product) { return product.price <= 90; }), "le plafond de budget reste respecté");
  assert.deepEqual(
    rankProducts(products, state, { filters: filters, seed: "session-a" }).map(function(product) { return product.id; }),
    rankProducts(products, state, { filters: filters, seed: "session-a" }).map(function(product) { return product.id; }),
    "même session, même paquet"
  );
  const brands = ranked.slice(0, 30).map(function(product) { return product.brand; });
  assert.ok(maxRun(brands) <= 2, "pas de série de marque : " + brands.join(","));
  assert.ok(decisionHistory(state).length === 1);
});

test("a brand rejected several times without a single Oui is demoted and never used for exploration", function() {
  const products = buildCatalogue().map(function(entry) { return entry.product; });
  const state = createInitialState(products);
  products.filter(function(product) { return product.brand === "Nike"; }).slice(0, 4).forEach(function(product, index) {
    state.interactions.dislikes.push({ productId: product.id, createdAt: new Date(Date.now() - (10 - index) * 1000).toISOString() });
  });
  const filters = { objective: "Vêtements", style: "Tous", season: "Toute saison", maxPrice: null };
  for (let run = 0; run < 25; run += 1) {
    const top = rankProducts(products, state, { filters: filters, seed: "reject-" + run, exploration: .5 }).slice(0, 10);
    assert.ok(top.every(function(product) { return product.brand !== "Nike"; }), "Nike ne remonte pas après quatre Non");
  }
});

test("rankProducts puts the piece restored by Undo back on top", function() {
  const products = buildCatalogue().map(function(entry) { return entry.product; });
  const state = createInitialState(products);
  const filters = { objective: "Vêtements", style: "Tous", season: "Toute saison", maxPrice: null };
  const target = products[products.length - 1];
  const ranked = rankProducts(products, state, { filters: filters, seed: "undo", pinFirstId: target.id });
  assert.equal(ranked[0].id, target.id);
  assert.equal(ranked.length, products.length);
});

test("diversifyProducts reorders an already ranked list only by a few places", function() {
  const list = [];
  for (let index = 0; index < 30; index += 1) list.push(normalizeProduct({ id: "p" + index, name: "Pull " + index, brand: index < 15 ? "A" : "B" + index, merchant: index < 15 ? "A" : "B" + index, category: "Pull" }));
  const output = diversifyProducts(list, { seed: "agent", limit: 20 });
  assert.equal(output.length, list.length);
  assert.equal(new Set(output.map(function(product) { return product.id; })).size, list.length);
  assert.ok(maxRun(output.slice(0, 20).map(function(product) { return product.brand; })) <= 6, "les séries d'une même marque sont coupées");
  output.forEach(function(product, position) {
    assert.ok(Number(product.id.slice(1)) - position <= 10, "une pièce ne remonte que de quelques places : " + product.id + " en position " + position);
  });
});
