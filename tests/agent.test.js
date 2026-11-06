import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState, normalizeProduct } from "../modules/engine.js";
import { createAgentPayload, orderProductsByAgent } from "../modules/agent.js";

test("AI agent is disabled and has no data-sharing consent by default", () => {
  const state = createInitialState([]);
  assert.equal(state.settings.aiAgentConsent, false);
  assert.equal(state.settings.aiAgentAutoRefresh, false);
});

test("AI payload contains categories and product feedback but excludes measurements, notes and URLs", () => {
  const products = [
    normalizeProduct({id:"like-1",name:"Navy merino sweater",brand:"Example",merchant:"Shop",price:90,objective:"Vêtements",styleTags:["Preppy"],colors:["Marine"],materials:["Laine"],url:"https://shop.example/sweater",sourceType:"public-web"}),
    normalizeProduct({id:"no-1",name:"Bright orange graphic tee",brand:"Other",merchant:"Shop",price:35,objective:"Vêtements",styleTags:["Streetwear"],colors:["Orange"],materials:["Coton"],url:"https://shop.example/tee",sourceType:"public-web"}),
    normalizeProduct({id:"saved-1",name:"Brown suede loafer",brand:"Maker",merchant:"Shoes",price:110,objective:"Chaussures",styleTags:["Heritage"],colors:["Marron"],materials:["Daim"],url:"https://shoes.example/loafer",sourceType:"public-web"})
  ];
  const state = createInitialState(products);
  state.settings.objective = "Vêtements";
  state.settings.style = "Preppy";
  state.settings.maxPrice = 150;
  state.profile.preferredStyles = ["Preppy"];
  state.profile.sizes.shoes = "42";
  state.profile.notes = "do not send this private note";
  state.interactions.likes = [{productId:"like-1"}];
  state.interactions.dislikes = [{productId:"no-1"}];
  state.likedProducts = [{productId:"saved-1",addedAt:"2026-11-06T00:00:00.000Z"}];
  const payload = createAgentPayload(state,products,[{title:"Look preppy marine",tags:["Preppy","Marine"],sourceUrl:"https://pinterest.com/pin/private"}]);
  assert.equal(payload.filters.objective,"Vêtements");
  assert.equal(payload.filters.style,"Preppy");
  assert.equal(payload.filters.maxPrice,150);
  assert.equal(payload.feedback.liked[0].name,"Navy merino sweater");
  assert.equal(payload.feedback.disliked[0].name,"Bright orange graphic tee");
  assert.equal(payload.feedback.saved[0].name,"Brown suede loafer");
  const serialized = JSON.stringify(payload);
  for (const privateValue of ["42","do not send this private note","https://","sourceUrl","pinterest.com"]) {
    assert.equal(serialized.includes(privateValue),false,privateValue);
  }
  assert.equal(Object.hasOwn(payload.profile,"sizes"),false);
  assert.equal(Object.hasOwn(payload.profile,"notes"),false);
});

test("AI candidate payload is capped at 50 products", () => {
  const products = Array.from({length:70},(_,index)=>normalizeProduct({id:"p-"+index,name:"Product "+index,price:20,objective:"Vêtements",url:"https://shop.example/p-"+index,sourceType:"public-web"}));
  const payload = createAgentPayload(createInitialState(products),products,[]);
  assert.equal(payload.products.length,50);
});

test("AI response ordering prioritizes known recommended ids and keeps local fallback order", () => {
  const products = [{id:"a"},{id:"b"},{id:"c"},{id:"d"}];
  const result = orderProductsByAgent(products,[{productId:"c"},{productId:"a"},{productId:"missing"}]);
  assert.deepEqual(result.map(item=>item.id),["c","a","b","d"]);
});
