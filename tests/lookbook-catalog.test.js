import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildOutfitIdeas } from "../modules/outfits.js";
import { createInitialState, normalizeProduct } from "../modules/engine.js";
import { createAgentPayload, selectAgentCandidates } from "../modules/agent.js";

const readJson = path => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const seeds = readJson("../data/catalog-seeds.json").products;
const catalog = readJson("../data/catalog.json");
const lookbook = readJson("../data/lookbook-pins.json");
const library = readJson("../data/lookbook-reference-library.json");
const validLookIds = new Set(lookbook.pins.map(pin => pin.id));
const validLevels = new Set(["close", "stylistic", "partial"]);

test("the editorial library maps all 20 original visuals without inventing exact SKUs", () => {
  assert.equal(library.looks.length, 20);
  assert.equal(library.sourceBook.visualCount, 20);
  assert.equal(library.sourceBook.outfitCount, 19);
  assert.equal(library.looks.filter(item => item.kind === "detail").length, 1);
  assert.match(library.matchingPolicy.exact, /Aucun article/);
  library.looks.forEach(item => {
    assert.ok(validLookIds.has(item.id), "Unknown look " + item.id);
    item.productIds.forEach(id => assert.ok(seeds.some(product => product.id === id), "Unknown product " + id));
  });
});

test("every curated seed has a product page, image and explicit confidence metadata", () => {
  assert.equal(seeds.length, 23);
  seeds.forEach(product => {
    assert.match(product.url, /^https:\/\//);
    assert.match(product.imageUrl, /^https:\/\//);
    assert.equal(product.sourceType, "curated");
    assert.ok(validLevels.has(product.matchLevel), product.id);
    assert.ok(product.matchReason && product.matchReason.length > 20, product.id);
    assert.ok(Array.isArray(product.lookbookRefs));
    product.lookbookRefs.forEach(id => assert.ok(validLookIds.has(id), product.id + " -> " + id));
  });
  assert.equal(seeds.some(product => product.id === "seed-lookbook-massimo-dutti-striped-knit-zip"), false);
});

test("the merged catalogue contains every curated reference and preserves public-web items", () => {
  const publicCount = catalog.products.filter(product => product.sourceType === "public-web").length;
  const curatedCount = catalog.products.filter(product => product.sourceType === "curated").length;
  assert.equal(publicCount, 67);
  assert.equal(curatedCount, seeds.length);
  assert.equal(catalog.products.length, publicCount + curatedCount);
  assert.equal(catalog.products.some(product => product.id === "seed-lookbook-massimo-dutti-striped-knit-zip"), false);
});

test("the agent receives all 20 inspirations, their IDs and the product-to-look mapping", () => {
  const payload = createAgentPayload(createInitialState(seeds), seeds.slice(0, 2),
    lookbook.pins.map(pin => ({ id: pin.id, title: pin.title, tags: pin.tags })));
  assert.equal(payload.inspirations.length, 20);
  assert.equal(payload.inspirations[19].id, "lookbook-20");
  assert.ok(Array.isArray(payload.products[0].lookbookRefs));
  assert.ok(validLevels.has(payload.products[0].matchLevel));
});

test("curated lookbook references remain inside the agent candidate window", () => {
  const candidates = selectAgentCandidates(catalog.products.slice(), 50);
  assert.equal(candidates.filter(product => product.sourceType === "curated").length, seeds.length);
});

test("a product explicitly mapped to a look outranks a generic tag-only candidate", () => {
  const pin = lookbook.pins.find(item => item.id === "lookbook-10");
  const mapped = normalizeProduct({
    id:"mapped-rugby", name:"Polo rugby", objective:"Vêtements", category:"Polo rugby",
    url:"https://example.com/mapped", styleTags:[], colors:[], materials:[], cuts:[], patterns:[],
    lookbookRefs:["lookbook-10"], matchLevel:"close"
  });
  const generic = normalizeProduct({
    id:"generic-rugby", name:"Polo rugby rose", objective:"Vêtements", category:"Polo rugby",
    url:"https://example.com/generic", styleTags:["Preppy"], colors:["Rose"],
    materials:[], cuts:[], patterns:[]
  });
  const ideas = buildOutfitIdeas([pin], [], [generic, mapped], []);
  assert.equal(ideas[0].suggestions.find(item => item.slot === "top").product.id, "mapped-rugby");
});
