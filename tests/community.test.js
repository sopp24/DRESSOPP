import test from "node:test";
import assert from "node:assert/strict";
import { buildCommunityFeatures, buildCommunitySignals } from "../modules/community.js";
import { createInitialState } from "../modules/engine.js";

test("community sharing is disabled by default", () => {
  const state = createInitialState([]);
  assert.equal(state.settings.communitySharing, false);
});

test("community payload contains only compact taste features, not personal profile fields", () => {
  const state = {
    products: [
      { id:"liked", name:"Black streetwear sneaker", objective:"Chaussures", brand:"Nike", styleTags:["Streetwear"], colors:["Noir"], materials:["Cuir"] },
      { id:"disliked", name:"Wool formal shoe", objective:"Chaussures", brand:"Example", styleTags:["Classique"], materials:["Laine"] }
    ],
    interactions: { likes:[{productId:"liked"}], dislikes:[{productId:"disliked"}] },
    likedProducts: [],
    profile: {
      preferredStyles:["Preppy"], preferredColors:["Marine"], preferredMaterials:["Coton"],
      favoriteBrands:["adidas"], excludedColors:["Orange"], excludedMaterials:["Polyester"],
      excludedBrands:["Fast Fashion"], sizes:{shoes:"42"}, notes:"private note", comfort:"private"
    }
  };
  const features = buildCommunityFeatures(state);
  assert.ok(features.positive.includes("brand:nike"));
  assert.ok(features.positive.includes("style:preppy"));
  assert.ok(features.positive.includes("brand:adidas"));
  assert.ok(features.negative.includes("brand:example"));
  assert.ok(features.negative.includes("color:orange"));
  assert.ok(features.negative.includes("material:polyester"));
  const serialized = JSON.stringify(features);
  for (const privateValue of ["42","private note","private","sizes","comfort"]) {
    assert.equal(serialized.includes(privateValue), false);
  }
});

test("similar profiles contribute weighted positive and negative taste signals", () => {
  const state = {
    products:[{
      id:"liked", name:"Black streetwear sneaker", objective:"Chaussures", brand:"Nike",
      styleTags:["Streetwear"], colors:["Noir"], materials:["Cuir"]
    }],
    interactions:{likes:[{productId:"liked"}],dislikes:[]}, likedProducts:[],
    profile:{preferredStyles:[],preferredColors:[],preferredMaterials:[],favoriteBrands:[]}
  };
  const signals = buildCommunitySignals([{
    positive:["category:chaussures","brand:nike","style:streetwear","color:noir","material:coton"],
    negative:["material:cuir","color:orange"]
  }], state);
  assert.equal(signals.neighbors,1);
  assert.ok(signals.positive["brand:nike"] > 0);
  assert.ok(signals.negative["material:cuir"] > 0);
});
