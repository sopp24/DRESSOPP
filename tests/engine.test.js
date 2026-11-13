import test from "node:test";
import assert from "node:assert/strict";
import { seasonFor, normalizeProduct as normalizeRawProduct, matchesFilters, rankProducts, createInitialState, deriveLearnedPreferences } from "../modules/engine.js";

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


test("product discovery is limited to confirmed men's pieces", function() {
  const men = normalizeProduct({ id:"men", name:"Chemise homme", price:40 });
  const unisex = normalizeRawProduct({ id:"unisex", name:"T-shirt unisexe", price:25 });
  const women = normalizeRawProduct({ id:"women", name:"Blouse femme", url:"https://shop.example/femme/blouse", price:30 });
  const unknown = normalizeRawProduct({ id:"unknown", name:"Pull en maille", price:32 });
  const state = createInitialState([men,unisex,women,unknown]);
  const result = rankProducts([women,unisex,unknown,men],state,{
    includeSeen:true,
    filters:{objective:"Tout",style:"Tous",season:"Toute saison",maxPrice:null}
  });
  assert.deepEqual(result.map(item=>item.id),["men"]);
  assert.equal(men.gender,"men");
  assert.equal(unisex.gender,"unisex");
  assert.equal(women.gender,"women");
  assert.equal(unknown.gender,"unknown");
});


test("normalizeProduct accepts only safe repository-local cached photo paths", function() {
  const product = normalizeProduct({
    imageUrl:"./assets/product-images/abc123.webp",
    imageFallbackUrl:"https://cdn.example.com/product.webp"
  });
  assert.equal(product.imageUrl,"./assets/product-images/abc123.webp");
  assert.equal(product.imageFallbackUrl,"https://cdn.example.com/product.webp");
  const unsafe = normalizeProduct({ imageUrl:"../private/photo.jpg" });
  assert.equal(unsafe.imageUrl,"");
});

test("curated men's references remain discoverable after their editorial TTL", function() {
  const product = normalizeProduct({
    id:"curated-expired",name:"Pull en laine homme",merchant:"Atelier",price:79,
    objective:"Vêtements",category:"Pull",styleTags:["Heritage"],seasonTags:["Toute saison"],
    sourceType:"curated",catalogStatus:"active",expiresAt:"2020-01-01T00:00:00.000Z"
  });
  const state = createInitialState([product]);
  const result = rankProducts([product],state,{
    includeSeen:true,
    filters:{objective:"Vêtements",style:"Tous",season:"Toute saison",maxPrice:null}
  });
  assert.deepEqual(result.map(item=>item.id),["curated-expired"]);
});

test("default discovery interleaves merchants and balances style and price bands", function() {
  const products = [
    normalizeProduct({id:"a1",name:"Pull preppy 1",merchant:"Boutique A",brand:"A",price:24,category:"Pull",styleTags:["Preppy"],seasonTags:["Toute saison"]}),
    normalizeProduct({id:"a2",name:"Pull preppy 2",merchant:"Boutique A",brand:"A",price:29,category:"Pull",styleTags:["Preppy"],seasonTags:["Toute saison"]}),
    normalizeProduct({id:"a3",name:"Pull preppy 3",merchant:"Boutique A",brand:"A",price:35,category:"Pull",styleTags:["Preppy"],seasonTags:["Toute saison"]}),
    normalizeProduct({id:"b1",name:"Veste streetwear",merchant:"Boutique B",brand:"B",price:75,category:"Veste",styleTags:["Streetwear"],seasonTags:["Toute saison"]}),
    normalizeProduct({id:"c1",name:"Derbies heritage",merchant:"Boutique C",brand:"C",price:160,objective:"Chaussures",category:"Derbies",styleTags:["Heritage"],seasonTags:["Toute saison"]}),
    normalizeProduct({id:"d1",name:"Chemise workwear",merchant:"Boutique D",brand:"D",price:49,category:"Chemise",styleTags:["Workwear"],seasonTags:["Toute saison"]})
  ];
  const state = createInitialState(products);
  const result = rankProducts(products,state,{
    includeSeen:true,
    filters:{objective:"Tout",style:"Tous",season:"Toute saison",maxPrice:null}
  });
  const firstFour = result.slice(0,4);
  assert.equal(new Set(firstFour.map(item=>item.merchant)).size,4);
  assert.ok(new Set(firstFour.map(item=>item.styleTags[0])).size >= 3);
  assert.ok(new Set(firstFour.map(item=>item.price < 40 ? "budget" : item.price < 100 ? "mid" : "premium")).size >= 3);
});


// A marketplace with multiple sellers must not count as several distinct boutiques.
test("merchant diversity treats seller labels on one marketplace as the same shop", function() {
  const products = [
    normalizeProduct({id:"z1",name:"Pull OVS",merchant:"Zalando · OVS Group",brand:"OVS",price:50,category:"Pull",seasonTags:["Toute saison"]}),
    normalizeProduct({id:"z2",name:"Jean OVS",merchant:"Zalando · OVS Group",brand:"OVS",price:65,category:"Pantalon",seasonTags:["Toute saison"]}),
    normalizeProduct({id:"z3",name:"Pull Massimo",merchant:"Zalando · Massimo Dutti",brand:"Massimo Dutti",price:85,category:"Pull",seasonTags:["Toute saison"]}),
    normalizeProduct({id:"c1",name:"Veste COS",merchant:"COS",brand:"COS",price:190,category:"Veste",seasonTags:["Toute saison"]}),
    normalizeProduct({id:"s1",name:"Sneakers SNIPES",merchant:"SNIPES",brand:"Nike",price:110,objective:"Chaussures",category:"Chaussures",seasonTags:["Toute saison"]}),
    normalizeProduct({id:"u1",name:"Pantalon UNIQLO",merchant:"UNIQLO",brand:"UNIQLO",price:49,category:"Pantalon",seasonTags:["Toute saison"]})
  ];
  const state = createInitialState(products);
  const result = rankProducts(products,state,{
    includeSeen:true,
    filters:{objective:"Tout",style:"Tous",season:"Toute saison",maxPrice:null}
  });
  const firstFour = result.slice(0,4).map(item=>String(item.merchant).split(" · ")[0]);
  assert.equal(new Set(firstFour).size,4);
});
