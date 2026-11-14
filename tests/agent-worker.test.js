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
    {id:"coat-1",name:"Manteau en laine marine",gender:"men",genderVerified:true,brand:"Example",merchant:"Shop",price:95,objective:"Vêtements",seasonTags:["Hiver"],styleTags:["Preppy"],colors:["Marine"],materials:["Laine"]},
    {id:"shirt-2",name:"Chemise hors budget",gender:"men",brand:"Other",merchant:"Shop",price:180,objective:"Vêtements",seasonTags:["Hiver"],styleTags:["Preppy"]},
    {id:"unisex-3",name:"Pull mixte",gender:"unisex",brand:"Other",merchant:"Shop",price:45,objective:"Vêtements"},
    {id:"unknown-4",name:"Pull sans public précisé",gender:"men",genderVerified:false,brand:"Other",merchant:"Shop",price:45,objective:"Vêtements"}
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


test("Pinterest image analysis requires the private sync token", async () => {
  const req = new Request("https://dressopp-agent.example.workers.dev/analyze-pins", {
    method:"POST",
    headers:{"content-type":"application/json"},
    body:JSON.stringify({pins:[{id:"pin-1",imageUrl:"https://i.pinimg.com/test.jpg"}]})
  });
  let imageRequested = false, modelCalled = false;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { imageRequested = true; return new Response(new Uint8Array([1,2,3]),{headers:{"content-type":"image/jpeg"}}); };
  try {
    const response = await worker.fetch(req,{
      PINTEREST_SYNC_TOKEN:"expected-secret",
      AI:{run:async()=>{modelCalled=true;return {response:"{}"};}}
    });
    assert.equal(response.status,403);
    assert.equal(imageRequested,false);
    assert.equal(modelCalled,false);
  } finally { globalThis.fetch = originalFetch; }
});

test("Pinterest image analysis uses the vision model and returns hidden structured features", async () => {
  const req = new Request("https://dressopp-agent.example.workers.dev/analyze-pins", {
    method:"POST",
    headers:{"content-type":"application/json","authorization":"Bearer sync-secret"},
    body:JSON.stringify({pins:[{id:"pin-vision-1",title:"",description:"",imageUrl:"https://i.pinimg.com/1200x/test.jpg"}]})
  });
  const originalFetch = globalThis.fetch;
  let modelName = "", modelInput = null;
  globalThis.fetch = async url => {
    assert.equal(new URL(url).hostname,"i.pinimg.com");
    return new Response(new Uint8Array([255,216,255,217]),{headers:{"content-type":"image/jpeg","content-length":"4"}});
  };
  try {
    const response = await worker.fetch(req,{
      PINTEREST_SYNC_TOKEN:"sync-secret",
      AI:{run:async(model,input)=>{
        modelName=model; modelInput=input;
        return {response:JSON.stringify({
          audience:"men",
          isFashion:true,
          summary:"Veste en cuir noire portée sur un sweat gris, avec un pantalon ample et des baskets.",
          styleTags:["Streetwear"],colors:["noir","gris"],materials:["cuir"],
          cuts:["oversized","wide leg"],patterns:[],
          pieces:[
            {type:"veste",color:"noir",material:"cuir",cut:"oversized",details:["fermeture zippée","col montant"]},
            {type:"pantalon",color:"gris",material:"coton",cut:"wide leg",details:["pinces"]},
            {type:"baskets",color:"blanc",material:"cuir",cut:"regular",details:["semelle épaisse"]}
          ],
          details:["fermeture zippée","col montant","pinces"],
          silhouetteTags:["ample","superposée"],
          seasonTags:["Automne","Hiver"],
          occasionTags:["Quotidien"],
          paletteTags:["Monochrome"],
          layering:"Un sweat gris est porté sous la veste en cuir noire.",
          outfitFormula:"Veste en cuir + sweat gris + pantalon ample + baskets blanches",
          confidence:0.94
        })};
      }}
    });
    const body = await response.json();
    assert.equal(response.status,200);
    assert.equal(body.ok,true);
    assert.equal(body.analyses[0].id,"pin-vision-1");
    const analysis = body.analyses[0].visualAnalysis;
    assert.equal(analysis.version,3);
    assert.equal(analysis.audience,"men");
    assert.equal(analysis.styleTags[0],"Streetwear");
    assert.deepEqual(analysis.colors,["noir","gris"]);
    assert.deepEqual(analysis.pieces.map(piece => piece.type),["veste","pantalon","baskets"]);
    assert.deepEqual(analysis.pieces[0].details,["fermeture zippée","col montant"]);
    assert.deepEqual(analysis.seasonTags,["Automne","Hiver"]);
    assert.deepEqual(analysis.paletteTags,["Monochrome"]);
    assert.match(analysis.outfitFormula,/Veste en cuir/);
    assert.match(modelInput.messages[1].content.find(part => part.type==="text").text,/mode masculine uniquement/);
    assert.match(modelInput.messages[1].content.find(part => part.type==="text").text,/audience/);
    assert.match(modelInput.messages[1].content.find(part => part.type==="text").text,/vêtement, chaussure et accessoire/);
    assert.match(modelInput.messages[1].content.find(part => part.type==="text").text,/jusqu’à 8 objets/);
    assert.equal(modelName,"@cf/google/gemma-4-26b-a4b-it");
    const imagePart = modelInput.messages[1].content.find(part => part.type==="image_url");
    assert.match(imagePart.image_url.url,/^data:image\/jpeg;base64,/);
  } finally { globalThis.fetch = originalFetch; }
});

test("Pinterest image analysis refuses image URLs outside Pinterest CDN", async () => {
  const req = new Request("https://dressopp-agent.example.workers.dev/analyze-pins", {
    method:"POST",
    headers:{"content-type":"application/json","authorization":"Bearer sync-secret"},
    body:JSON.stringify({pins:[{id:"pin-evil",imageUrl:"https://attacker.example/image.jpg"}]})
  });
  let modelCalled = false;
  const response = await worker.fetch(req,{
    PINTEREST_SYNC_TOKEN:"sync-secret",
    AI:{run:async()=>{modelCalled=true;return {response:"{}"};}}
  });
  const body = await response.json();
  assert.equal(response.status,200);
  assert.match(body.analyses[0].error,/i.pinimg.com/);
  assert.equal(modelCalled,false);
});


test("Pinterest image analysis excludes unisex references from men's inspirations", async () => {
  const req = new Request("https://dressopp-agent.example.workers.dev/analyze-pins", {
    method:"POST",
    headers:{"content-type":"application/json","authorization":"Bearer sync-secret"},
    body:JSON.stringify({pins:[{id:"pin-unisex",title:"",description:"",imageUrl:"https://i.pinimg.com/1200x/test.jpg"}]})
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(new Uint8Array([255,216,255,217]),{headers:{"content-type":"image/jpeg","content-length":"4"}});
  try {
    const response = await worker.fetch(req,{
      PINTEREST_SYNC_TOKEN:"sync-secret",
      AI:{run:async()=>({response:JSON.stringify({
        audience:"unisex",isFashion:true,summary:"Pull en maille mixte.",
        styleTags:["Casual"],colors:["beige"],materials:["laine"],cuts:["regular"],
        patterns:[],pieces:[],details:[],seasonTags:["Hiver"],confidence:0.9
      })})}
    });
    const body = await response.json();
    const analysis = body.analyses[0].visualAnalysis;
    assert.equal(response.status,200);
    assert.equal(analysis.audience,"unisex");
    assert.equal(analysis.isFashion,false);
    assert.equal(analysis.summary,"");
    assert.deepEqual(analysis.styleTags,[]);
    assert.deepEqual(analysis.colors,[]);
  } finally { globalThis.fetch = originalFetch; }
});

test("Pinterest visual analysis requires an explicit positive fashion decision", async () => {
  const req = new Request("https://dressopp-agent.example.workers.dev/analyze-pins", {
    method:"POST",
    headers:{"content-type":"application/json","authorization":"Bearer sync-secret"},
    body:JSON.stringify({pins:[{id:"pin-incomplete",imageUrl:"https://i.pinimg.com/1200x/test.jpg"}]})
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(new Uint8Array([255,216,255,217]),{headers:{"content-type":"image/jpeg","content-length":"4"}});
  try {
    const response = await worker.fetch(req,{
      PINTEREST_SYNC_TOKEN:"sync-secret",
      AI:{run:async()=>({response:JSON.stringify({audience:"men",summary:"",styleTags:["Streetwear"],colors:["noir"],confidence:0.8})})}
    });
    const body = await response.json();
    const analysis = body.analyses[0].visualAnalysis;
    assert.equal(response.status,200);
    assert.equal(analysis.audience,"men");
    assert.equal(analysis.isFashion,false);
    assert.equal(analysis.summary,"");
    assert.deepEqual(analysis.styleTags,[]);
    assert.deepEqual(analysis.colors,[]);
  } finally { globalThis.fetch = originalFetch; }
});
