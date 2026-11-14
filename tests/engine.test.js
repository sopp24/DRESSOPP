import test from "node:test";
import assert from "node:assert/strict";
import { seasonFor, normalizeProduct as normalizeRawProduct, matchesFilters, rankProducts, createInitialState, deriveLearnedPreferences, registerMenMerchants, isMenFit } from "../modules/engine.js";

function normalizeProduct(raw) {
  return normalizeRawProduct(Object.assign({ gender:"men", genderVerified:true },raw || {}));
}

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

test("Pinterest board metadata contributes positive learned style signals", function() {
  const state = createInitialState([]);
  state.pinterestPins = [
    { title: "Minimalist beige linen oversized outfit", description: "Clean summer streetwear", visualAnalysis:{version:3,audience:"men",isFashion:true} }
  ];
  const learned = deriveLearnedPreferences(state);
  assert.ok(learned["styleTags:classique"] > 0);
  assert.ok(learned["colors:beige"] > 0);
  assert.ok(learned["materials:lin"] > 0);
  assert.ok(learned["cuts:oversized"] > 0);
});


test("normalizeProduct rejects relative URLs as merchant links", function() {
  const product = normalizeProduct({ name: "Produit", url: "/produits/chemise" });
  assert.equal(product.url, "");
});

test("rankProducts never recommends an item already saved in the wardrobe", function() {
  const product = normalizeProduct({ id: "saved", name: "Chemise", objective: "Vêtements", price: 15 });
  const state = createInitialState([product]);
  state.likedProducts.push({ productId: "saved", addedAt: new Date().toISOString() });
  state.interactions.saves = [];
  const result = rankProducts([product], state, {
    filters: { objective: "Vêtements", style: "Tous", season: "Toute saison", maxPrice: null }
  });
  assert.equal(result.length, 0);
});

test("validating and rejecting an outfit changes learned style preferences", function() {
  const state = createInitialState([]);
  state.pinterestPins = [
    { id: "look-1", title: "Minimalist beige linen oversized outfit", visualAnalysis:{version:3,audience:"men",isFashion:true} }
  ];
  const baseline = deriveLearnedPreferences(state);
  assert.deepEqual(state.outfitFeedback, {});

  state.outfitFeedback = { "look-1": { vote: "yes" } };
  const approved = deriveLearnedPreferences(state);
  assert.ok(approved["colors:beige"] > baseline["colors:beige"]);
  assert.ok(approved["materials:lin"] > baseline["materials:lin"]);

  state.outfitFeedback = { "look-1": { vote: "no" } };
  const rejected = deriveLearnedPreferences(state);
  assert.ok(rejected["colors:beige"] < baseline["colors:beige"]);
  assert.ok(rejected["materials:lin"] < baseline["materials:lin"]);
});


test("rankProducts filters to the profile size when merchant sizes are known", function() {
  const fitting = normalizeProduct({ id:"fit", name:"Chemise Oxford", objective:"Vêtements", sizes:["S","M","L"], price:45 });
  const unavailable = normalizeProduct({ id:"no-fit", name:"Chemise Oxford slim", objective:"Vêtements", sizes:["XS","S"], price:45 });
  const state = createInitialState([fitting, unavailable]);
  state.profile.sizes.tops = "M";
  const result = rankProducts([fitting, unavailable], state, {
    filters:{ objective:"Vêtements", style:"Tous", season:"Toute saison", maxPrice:null }
  });
  assert.deepEqual(result.map(item => item.id), ["fit"]);
});

test("rankProducts never puts withdrawn or expired feed products back in discovery", function() {
  const withdrawn = normalizeProduct({ id:"withdrawn", name:"Pull", price:40, catalogStatus:"stale", sourceType:"awin" });
  const expired = normalizeProduct({ id:"expired", name:"Jean", price:50, expiresAt:"2020-01-01T00:00:00.000Z" });
  const active = normalizeProduct({ id:"active", name:"Pantalon", price:55 });
  const state = createInitialState([withdrawn, expired, active]);
  const result = rankProducts([withdrawn, expired, active], state, {
    filters:{ objective:"Tout", style:"Tous", season:"Toute saison", maxPrice:null }
  });
  assert.deepEqual(result.map(item => item.id), ["active"]);
});


test("rankProducts uses merchant reputation separately from product reviews", function() {
  const trusted = normalizeProduct({
    id:"trusted", name:"Pull marron", merchant:"Shop A", objective:"Vêtements",
    price:45, merchantRating:4.9, merchantRatingCount:1200
  });
  const unknown = normalizeProduct({
    id:"unknown", name:"Pull marron", merchant:"Shop B", objective:"Vêtements",
    price:45
  });
  const state = createInitialState([trusted, unknown]);
  const result = rankProducts([unknown, trusted], state, {
    includeSeen:true,
    filters:{ objective:"Vêtements", style:"Tous", season:"Toute saison", maxPrice:null }
  });
  assert.equal(result[0].id, "trusted");
});

test("rankProducts gives a small lift to explicit best-seller signals", function() {
  const popular = normalizeProduct({
    id:"popular", name:"Polo maille", merchant:"Shop A", objective:"Vêtements",
    price:40, popularityScore:95, isBestSeller:true
  });
  const standard = normalizeProduct({
    id:"standard", name:"Polo maille", merchant:"Shop B", objective:"Vêtements",
    price:40
  });
  const state = createInitialState([popular, standard]);
  const result = rankProducts([standard, popular], state, {
    includeSeen:true,
    filters:{ objective:"Vêtements", style:"Tous", season:"Toute saison", maxPrice:null }
  });
  assert.equal(result[0].id, "popular");
});


test("Pinterest style signals receive a strong baseline weight", function() {
  const state = createInitialState([]);
  state.pinterestPins = [{ title:"Minimalist beige linen oversized outfit",visualAnalysis:{version:3,audience:"men",isFashion:true} }];
  const learned = deriveLearnedPreferences(state);
  assert.equal(learned["colors:beige"], 2.5);
  assert.equal(learned["materials:lin"], 2.5);
  assert.equal(learned["cuts:oversized"], 2.5);
});


test("new local state keeps outfit filters and a separate saved outfit collection", function() {
  const state = createInitialState([]);
  assert.deepEqual(state.savedOutfits,[]);
  assert.deepEqual(state.settings.outfitFilters,{styles:[],season:"Toute saison",maxPrice:null});
  assert.equal(state.settings.outfitLibraryView,"discover");
});


test("product discovery keeps men's and men-compatible unisex pieces, never women's or unknown ones", function() {
  const men = normalizeProduct({ id:"men", name:"Chemise homme", price:40 });
  const unisex = normalizeRawProduct({ id:"unisex", name:"T-shirt unisexe", price:25 });
  const unisexDress = normalizeRawProduct({ id:"unisex-dress", name:"Robe unisexe", price:25 });
  const women = normalizeRawProduct({ id:"women", name:"Blouse femme", url:"https://shop.example/femme/blouse", price:30 });
  const unknown = normalizeRawProduct({ id:"unknown", name:"Pull en maille", price:32 });
  const state = createInitialState([men,unisex,women,unknown]);
  const result = rankProducts([women,unisex,unisexDress,unknown,men],state,{
    includeSeen:true,
    filters:{objective:"Tout",style:"Tous",season:"Toute saison",maxPrice:null}
  });
  assert.deepEqual(result.map(item=>item.id).sort(),["men","unisex"]);
  assert.equal(men.gender,"men");
  assert.equal(men.menFit,"men");
  assert.equal(unisex.gender,"unisex");
  assert.equal(unisex.menFit,"unisex");
  assert.equal(unisexDress.menFit,"");
  assert.equal(women.gender,"women");
  assert.equal(unknown.gender,"unknown");
});

test("men-only merchants make unlabelled pieces eligible, except typically feminine items", function() {
  registerMenMerchants([{ name:"Jules", domain:"jules.com", audience:"men" }]);
  try {
    const jumper = normalizeRawProduct({ id:"jules-1", name:"Pull col rond", merchant:"Jules", url:"https://www.jules.com/fr/p/pull-1.html", price:30 });
    const dress = normalizeRawProduct({ id:"jules-2", name:"Robe fluide", merchant:"Jules", price:30 });
    const other = normalizeRawProduct({ id:"other-1", name:"Pull col rond", merchant:"Autre boutique", price:30 });
    assert.equal(jumper.gender,"men");
    assert.equal(jumper.menFit,"men");
    assert.equal(dress.menFit,"");
    assert.equal(other.menFit,"");
    assert.ok(isMenFit(jumper) && !isMenFit(dress) && !isMenFit(other));
  } finally { registerMenMerchants([]); }
});

test("missing colours and materials are read from the product title and description", function() {
  const product = normalizeProduct({ id:"p1", name:"Pull col V en laine mérinos – Crème", description:"Coupe oversize", price:40 });
  assert.deepEqual(product.colors,["Crème"]);
  assert.ok(product.materials.includes("Laine"));
  assert.ok(product.cuts.includes("Oversize"));
  const declared = normalizeProduct({ id:"p2", name:"Pull noir", colors:["Bleu"], price:40 });
  assert.deepEqual(declared.colors,["Bleu"]);
});

test("the Pinterest board ranks the closest pieces first", function() {
  const pin = { id:"pin-1", title:"Look maille crème", description:"Pull oversize en laine crème avec pantalon marron", visualAnalysis:{
    version:3, isFashion:true, audience:"men", styleTags:["Smart Casual"], colors:["crème","marron"], materials:["laine"], cuts:["oversize"], patterns:[],
    pieces:[{type:"pull",color:"crème",material:"laine",cut:"oversize",pattern:"uni",details:["col v"]},{type:"pantalon",color:"marron",material:"",cut:"droit",pattern:"uni",details:[]}], details:["col v"] } };
  const close = normalizeProduct({ id:"close", name:"Pull col V oversize en laine – Crème", brand:"A", price:50, url:"https://a.example/homme/pull", gender:"men", genderVerified:true });
  const far = normalizeProduct({ id:"far", name:"Short de bain imprimé homme", brand:"B", price:50, url:"https://b.example/homme/short", gender:"men", genderVerified:true });
  const state = createInitialState([close,far]);
  state.pinterestPins = [pin];
  const ranked = rankProducts([far,close],state,{ includeSeen:true, filters:{objective:"Tout",style:"Tous",season:"Toute saison",maxPrice:null} });
  assert.equal(ranked[0].id,"close");
});
