import test from "node:test";
import assert from "node:assert/strict";
import { createInitialState, normalizeProduct } from "../modules/engine.js";
import { createAgentPayload, orderProductsByAgent, selectAgentCandidates, recommendLocally } from "../modules/agent.js";

test("AI agent is disabled and has no data-sharing consent by default", () => {
  const state = createInitialState([]);
  assert.equal(state.settings.aiAgentConsent, false);
  assert.equal(state.settings.aiAgentAutoRefresh, false);
});

test("AI payload contains categories and product feedback but excludes measurements, notes and URLs", () => {
  const products = [
    normalizeProduct({gender:"men",genderVerified:true,id:"like-1",name:"Navy merino sweater",brand:"Example",merchant:"Shop",price:90,objective:"Vêtements",styleTags:["Preppy"],colors:["Marine"],materials:["Laine"],url:"https://shop.example/sweater",sourceType:"public-web"}),
    normalizeProduct({gender:"men",genderVerified:true,id:"no-1",name:"Bright orange graphic tee",brand:"Other",merchant:"Shop",price:35,objective:"Vêtements",styleTags:["Streetwear"],colors:["Orange"],materials:["Coton"],url:"https://shop.example/tee",sourceType:"public-web"}),
    normalizeProduct({gender:"men",genderVerified:true,id:"saved-1",name:"Brown suede loafer",brand:"Maker",merchant:"Shoes",price:110,objective:"Chaussures",styleTags:["Heritage"],colors:["Marron"],materials:["Daim"],url:"https://shoes.example/loafer",sourceType:"public-web"})
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
  const products = Array.from({length:70},(_,index)=>normalizeProduct({gender:"men",genderVerified:true,id:"p-"+index,name:"Product "+index,price:20,objective:"Vêtements",url:"https://shop.example/p-"+index,sourceType:"public-web"}));
  const payload = createAgentPayload(createInitialState(products),products,[]);
  assert.equal(payload.products.length,50);
});

test("AI response ordering prioritizes known recommended ids and keeps local fallback order", () => {
  const products = [{id:"a"},{id:"b"},{id:"c"},{id:"d"}];
  const result = orderProductsByAgent(products,[{productId:"c"},{productId:"a"},{productId:"missing"}]);
  assert.deepEqual(result.map(item=>item.id),["c","a","b","d"]);
});

test("AI candidate selection reserves space for curated product references", () => {
  const ranked = Array.from({length:55},(_,index)=>({id:"public-"+index,sourceType:"public-web"}));
  ranked.push({id:"curated-a",sourceType:"curated"},{id:"curated-b",sourceType:"curated"});
  const selected = selectAgentCandidates(ranked,50);
  assert.equal(selected.length,50);
  assert.deepEqual(selected.slice(0,2).map(item=>item.id),["curated-a","curated-b"]);
  assert.equal(selected.some(item=>item.id==="public-0"),true);
  assert.equal(selected.some(item=>item.id==="public-48"),false);
});


test("the local personal shopper is usable without a remote endpoint or data sharing", () => {
  const products = [
    normalizeProduct({gender:"men",genderVerified:true,id:"plain",name:"T-shirt coton",brand:"Basics",merchant:"Shop A",price:25,objective:"Vêtements",styleTags:["Casual"],colors:["Blanc"],materials:["Coton"]}),
    normalizeProduct({gender:"men",genderVerified:true,id:"match",name:"Pull beige en lin",brand:"Atelier",merchant:"Shop B",price:65,objective:"Vêtements",styleTags:["Minimaliste"],colors:["Beige"],materials:["Lin"],cuts:["Oversize"]})
  ];
  const state = createInitialState(products);
  state.profile.preferredStyles = ["Minimaliste"];
  state.profile.preferredColors = ["Beige"];
  state.interactions.likes = [{productId:"match"}];
  const result = recommendLocally(state,products,[{title:"Beige linen minimalist outfit",tags:["Minimaliste","Beige","Lin"]}]);
  assert.equal(result.provider,"local");
  assert.equal(result.candidateCount,2);
  assert.equal(result.recommendations[0].productId,"match");
  assert.match(result.recommendations[0].reason,/Beige|Minimaliste|Lin/);
  assert.deepEqual(result.recommendations.map(item=>item.productId).sort(),["match","plain"]);
});

test("the local personal shopper penalizes a product that repeats disliked features", () => {
  const products = [
    normalizeProduct({gender:"men",genderVerified:true,id:"disliked",name:"Sweat orange",objective:"Vêtements",colors:["Orange"],styleTags:["Logotypé"]}),
    normalizeProduct({gender:"men",genderVerified:true,id:"preferred",name:"Surchemise marine",objective:"Vêtements",colors:["Marine"],styleTags:["Minimaliste"]})
  ];
  const state = createInitialState(products);
  state.profile.preferredColors = ["Marine"];
  state.interactions.dislikes = [{productId:"disliked"}];
  const result = recommendLocally(state,products,[]);
  assert.equal(result.recommendations[0].productId,"preferred");
});


test("local recommendations interleave shops instead of presenting merchant batches", () => {
  const products = [
    normalizeProduct({gender:"men",genderVerified:true,id:"a1",name:"Pull preppy 1",merchant:"Boutique A",brand:"A",price:25,styleTags:["Preppy"]}),
    normalizeProduct({gender:"men",genderVerified:true,id:"a2",name:"Pull preppy 2",merchant:"Boutique A",brand:"A",price:29,styleTags:["Preppy"]}),
    normalizeProduct({gender:"men",genderVerified:true,id:"a3",name:"Pull preppy 3",merchant:"Boutique A",brand:"A",price:35,styleTags:["Preppy"]}),
    normalizeProduct({gender:"men",genderVerified:true,id:"b1",name:"Veste streetwear",merchant:"Boutique B",brand:"B",price:75,styleTags:["Streetwear"]}),
    normalizeProduct({gender:"men",genderVerified:true,id:"c1",name:"Derbies heritage",merchant:"Boutique C",brand:"C",price:160,objective:"Chaussures",styleTags:["Heritage"]}),
    normalizeProduct({gender:"men",genderVerified:true,id:"d1",name:"Chemise workwear",merchant:"Boutique D",brand:"D",price:49,styleTags:["Workwear"]})
  ];
  const result = recommendLocally(createInitialState(products),products,[],4);
  const firstFour = result.recommendations.map(item=>products.find(product=>product.id===item.productId));
  assert.equal(new Set(firstFour.map(item=>item.merchant)).size,4);
});

