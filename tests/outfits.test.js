import test from "node:test";
import assert from "node:assert/strict";
import { inferPinterestFeatures, inferPinterestTags, productSlot, buildOutfitIdeas } from "../modules/outfits.js";

test("Pinterest metadata is classified into style, color and material signals", function() {
  const features = inferPinterestFeatures({
    title: "Minimalist streetwear outfit",
    description: "Oversized beige linen shirt with wide leg trousers"
  });
  assert.ok(features.styleTags.includes("Classique"));
  assert.ok(features.styleTags.includes("Streetwear"));
  assert.ok(features.colors.includes("beige"));
  assert.ok(features.materials.includes("lin"));
  assert.ok(features.cuts.includes("oversized"));
  assert.ok(inferPinterestTags({ title: "black outfit" }).includes("noir"));
});

test("productSlot distinguishes wardrobe pieces", function() {
  assert.equal(productSlot({ name: "Chemise Oxford", objective: "Vêtements" }), "top");
  assert.equal(productSlot({ name: "Jean droit", objective: "Vêtements" }), "bottom");
  assert.equal(productSlot({ name: "Sneakers", objective: "Chaussures" }), "shoes");
});

test("outfit ideas use saved pieces and only suggest catalogue products with merchant links", function() {
  const pin = { id: "pin-1", title: "Minimalist beige summer outfit", description: "Linen shirt and white sneakers" };
  const wardrobe = [
    { id: "top-1", name: "Chemise en lin beige", objective: "Vêtements", materials: ["lin"], colors: ["beige"], url: "https://shop.example/top" },
    { id: "shoes-1", name: "Sneakers blanches", objective: "Chaussures", colors: ["blanc"], url: "https://shop.example/shoes" }
  ];
  const catalogue = [
    { id: "bottom-1", name: "Pantalon beige", objective: "Vêtements", colors: ["beige"], url: "https://shop.example/bottom" },
    { id: "fake-1", name: "Pantalon sans lien", objective: "Vêtements", colors: ["beige"], url: "" }
  ];
  const ideas = buildOutfitIdeas([pin], wardrobe, catalogue, []);
  assert.equal(ideas.length, 1);
  assert.equal(ideas[0].pieces.length, 2);
  assert.equal(ideas[0].suggestions.length, 1);
  assert.equal(ideas[0].suggestions[0].product.id, "bottom-1");
  assert.ok(ideas[0].missingSlots.includes("bottom"));
});

test("approved outfit references move ahead of rejected ones", function() {
  const rejected = { id: "rejected", title: "Streetwear red oversized outfit" };
  const approved = { id: "approved", title: "Minimalist beige linen outfit" };
  const untrained = buildOutfitIdeas([rejected, approved], [], [], []);
  assert.deepEqual(untrained.map(function(idea) { return idea.pin.id; }), ["rejected", "approved"]);

  const trained = buildOutfitIdeas([rejected, approved], [], [], [], {
    rejected: { vote: "no" },
    approved: { vote: "yes" }
  });
  assert.deepEqual(trained.map(function(idea) { return idea.pin.id; }), ["approved", "rejected"]);
});


test("visual Pinterest analysis improves matching without changing visible text tags", function() {
  const pin = {
    id:"visual-pin",
    title:"",
    description:"",
    visualAnalysis:{
      isFashion:true,
      summary:"Veste en cuir noire, pantalon ample et sneakers.",
      styleTags:["Streetwear"],
      colors:["noir"],
      materials:["cuir"],
      cuts:["oversized"],
      patterns:[]
    }
  };
  const features = inferPinterestFeatures(pin);
  assert.ok(features.styleTags.includes("Streetwear"));
  assert.ok(features.colors.includes("noir"));
  assert.ok(features.materials.includes("cuir"));
  assert.ok(features.cuts.includes("oversized"));
  assert.deepEqual(inferPinterestTags(pin),[]);
});

test("visual analysis marked as non-fashion does not add style signals", function() {
  const pin = {
    title:"",
    description:"",
    visualAnalysis:{isFashion:false,summary:"",styleTags:["Streetwear"],colors:["noir"],materials:["cuir"],cuts:[],patterns:[]}
  };
  const features = inferPinterestFeatures(pin);
  assert.deepEqual(features.styleTags,[]);
  assert.deepEqual(features.colors,[]);
  assert.deepEqual(inferPinterestTags(pin),[]);
});
