import test from "node:test";
import assert from "node:assert/strict";
import { buildCommunityFeatures, buildCommunitySignals } from "../modules/community.js";
import { createInitialState, productCommunityToken, rankProducts } from "../modules/engine.js";

test("community sharing is disabled by default", () => {
  const state = createInitialState([]);
  assert.equal(state.settings.communitySharing, false);
});

test("community payload contains only compact taste features, not personal profile fields", () => {
  const state = {
    products: [
      { id:"liked", name:"Black streetwear sneaker", objective:"Chaussures", brand:"Nike", styleTags:["Streetwear"], colors:["Noir"], materials:["Cuir"], sourceType:"public-web", url:"https://www.nike.com/fr/air-force" },
      { id:"disliked", name:"Wool formal shoe", objective:"Chaussures", brand:"Example", styleTags:["Classique"], materials:["Laine"], sourceType:"public-web", url:"https://example.com/formal-shoe" }
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
  assert.equal(features.positiveItems.length, 1);
  assert.equal(features.negativeItems.length, 1);
  assert.ok(features.positiveItems[0].startsWith("item:"));
  const serialized = JSON.stringify(features);
  for (const privateValue of ["42","private note","private","sizes","comfort","https://","nike.com","air-force"]) {
    assert.equal(serialized.includes(privateValue), false);
  }
});

test("similar profiles contribute weighted positive and negative taste signals", () => {
  const state = {
    products:[{
      id:"liked", name:"Black streetwear sneaker", objective:"Chaussures", brand:"Nike",
      styleTags:["Streetwear"], colors:["Noir"], materials:["Cuir"],
      sourceType:"public-web", url:"https://www.nike.com/fr/air-force"
    }],
    interactions:{likes:[{productId:"liked"}],dislikes:[]}, likedProducts:[],
    profile:{preferredStyles:[],preferredColors:[],preferredMaterials:[],favoriteBrands:[]}
  };
  const signals = buildCommunitySignals([{
    positive:["category:chaussures","brand:nike","style:streetwear","color:noir","material:coton"],
    negative:["material:cuir","color:orange"],
    positiveItems:[productCommunityToken(state.products[0])],
    negativeItems:[]
  }], state);
  assert.equal(signals.neighbors,1);
  assert.ok(signals.positive["brand:nike"] > 0);
  assert.ok(signals.negative["material:cuir"] > 0);
  assert.ok(signals.positiveItems[productCommunityToken(state.products[0])] > 0);
});

test("the community ranker boosts a product appreciated by similar users", () => {
  const state = createInitialState([
    { id:"same", name:"Sneaker populaire", objective:"Chaussures", brand:"Nike", sourceType:"public-web", url:"https://www.nike.com/fr/air-force", price:100 },
    { id:"other", name:"Sneaker différente", objective:"Chaussures", brand:"Nike", sourceType:"public-web", url:"https://www.nike.com/fr/other-shoe", price:100 }
  ]);
  state.settings.objective = "Tout";
  const token = productCommunityToken(state.products[0]);
  const ranked = rankProducts(state.products, state, {
    communitySignals:{positive:{},negative:{},positiveItems:{[token]:1.8},negativeItems:{}}
  });
  assert.equal(ranked[0].id,"same");
});
