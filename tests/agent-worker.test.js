import test from "node:test";
import assert from "node:assert/strict";
import worker from "../workers/dressopp-agent/src/index.js";

function request(body, ip) {
  return new Request("https://dressopp-agent.example.workers.dev/recommend", {
    method:"POST",
    headers:{ "content-type":"application/json", "origin":"https://sopp24.github.io", "cf-connecting-ip":ip },
    body:JSON.stringify(body)
  });
}
function payload(products) {
  return {
    filters:{objective:"Vêtements",style:"Tous",season:"Hiver",maxPrice:100},
    profile:{preferredStyles:["Preppy"],preferredColors:["Marine"]},
    feedback:{liked:[],saved:[],disliked:[]},
    inspirations:[],
    products
  };
}

test("AI Worker rejects unknown origins before invoking the model", async () => {
  const req = new Request("https://dressopp-agent.example.workers.dev/recommend", {method:"POST",headers:{origin:"https://evil.example","content-type":"application/json"},body:"{}"});
  let called = false;
  const response = await worker.fetch(req,{ALLOWED_ORIGINS:"https://sopp24.github.io",AI:{run:async()=>{called=true;return {};}}});
  assert.equal(response.status,403);
  assert.equal(called,false);
});

test("AI Worker enforces budget and only returns ids from the provided product list", async () => {
  const products = [
    {id:"coat-1",name:"Manteau en laine marine",brand:"Example",merchant:"Shop",price:95,objective:"Vêtements",seasonTags:["Hiver"],styleTags:["Preppy"],colors:["Marine"],materials:["Laine"]},
    {id:"shirt-2",name:"Chemise hors budget",brand:"Other",merchant:"Shop",price:180,objective:"Vêtements",seasonTags:["Hiver"],styleTags:["Preppy"]}
  ];
  const req = request(payload(products),"198.51.100.11");
  let sentInput = "";
  const env = {
    ALLOWED_ORIGINS:"https://sopp24.github.io",
    AI:{run:async(_model,args)=>{sentInput=args.messages[1].content;return {response:JSON.stringify({recommendations:[{productId:"coat-1",reason:"La laine marine reprend ton style preppy."},{productId:"outside-id",reason:"Introuvable."}],message:"J’ai privilégié le manteau dans ton budget.",searchHints:["Manteaux en laine marine"]})};}}
  };
  const response = await worker.fetch(req,env);
  const body = await response.json();
  assert.equal(response.status,200);
  assert.equal(body.recommendations.length,1);
  assert.equal(body.recommendations[0].productId,"coat-1");
  assert.equal(body.candidateCount,1);
  assert.match(sentInput,/Manteau en laine marine/);
  assert.doesNotMatch(sentInput,/Chemise hors budget/);
});

test("AI Worker rejects empty product candidates without calling the model", async () => {
  const req = request(payload([]),"198.51.100.12");
  let called = false;
  const response = await worker.fetch(req,{ALLOWED_ORIGINS:"https://sopp24.github.io",AI:{run:async()=>{called=true;return {};}}});
  assert.equal(response.status,400);
  assert.equal(called,false);
});
