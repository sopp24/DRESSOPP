import test from "node:test";
import assert from "node:assert/strict";
import { inferPinterestFeatures, inferPinterestTags, isMenswearPin, productSlot, outfitTotalPrice, buildOutfitIdeas } from "../modules/outfits.js";

function buildMensOutfitIdeas(pins, wardrobe, catalogue, ...options) {
  const mensPin = pin => Object.assign({},pin,{visualAnalysis:Object.assign({},pin && pin.visualAnalysis || {},{version:3,audience:"men",isFashion:!(pin && pin.visualAnalysis && pin.visualAnalysis.isFashion === false)})});
  const mensProducts = products => (products || []).map(product => Object.assign({gender:"men",genderVerified:true},product));
  return buildOutfitIdeas((pins || []).map(mensPin),mensProducts(wardrobe),mensProducts(catalogue),...options);
}

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
  const ideas = buildMensOutfitIdeas([pin], wardrobe, catalogue, []);
  assert.equal(ideas.length, 1);
  assert.equal(ideas[0].pieces.length, 2);
  assert.equal(ideas[0].suggestions.length, 1);
  assert.equal(ideas[0].suggestions[0].product.id, "bottom-1");
  assert.equal(ideas[0].items.length,3);
  assert.ok(!ideas[0].missingSlots.includes("bottom"));
  assert.equal(ideas[0].totalPrice,null);
});

test("approved outfit references move ahead of rejected ones", function() {
  const rejected = { id: "rejected", title: "Streetwear red oversized outfit", imageUrl:"https://images.example/rejected.jpg" };
  const approved = { id: "approved", title: "Minimalist beige linen outfit", imageUrl:"https://images.example/approved.jpg" };
  const untrained = buildMensOutfitIdeas([rejected, approved], [], [], []);
  assert.deepEqual(untrained.map(function(idea) { return idea.pin.id; }), ["rejected", "approved"]);

  const trained = buildMensOutfitIdeas([rejected, approved], [], [], [], {
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

test("detailed Pinterest piece analysis improves product matching and seasonal filtering", function() {
  const pin = {
    id:"detailed-visual-pin",
    title:"",
    description:"",
    visualAnalysis:{
      version:2,
      isFashion:true,
      summary:"Tenue smart casual avec pantalon beige en laine à pinces.",
      styleTags:["Smart Casual"],
      colors:["beige"],
      materials:["laine"],
      cuts:["wide leg"],
      patterns:[],
      pieces:[{
        type:"pantalon",color:"beige",material:"laine",cut:"wide leg",
        details:["pinces"]
      }],
      details:["pinces"],
      silhouetteTags:["ample"],
      seasonTags:["Automne","Hiver"],
      occasionTags:["Quotidien"],
      paletteTags:["Neutres chauds"],
      layering:"",
      outfitFormula:"Pull en maille + pantalon beige à pinces + mocassins"
    }
  };
  const features = inferPinterestFeatures(pin);
  assert.ok(features.colors.includes("beige"));
  assert.ok(features.materials.includes("laine"));
  assert.ok(features.cuts.includes("wide leg"));

  const products = [
    {
      id:"pleated-wool-trousers",name:"Pantalon en laine beige",objective:"Vêtements",
      category:"Pantalon à pinces",colors:["Beige"],materials:["Laine"],cuts:["Wide leg"],
      description:"Pantalon droit en laine beige avec plis et pinces sur le devant.",
      url:"https://shop.example/pantalon-laine-beige"
    },
    {
      id:"blue-slim-jeans",name:"Jean bleu slim",objective:"Vêtements",
      category:"Jean",colors:["Bleu"],materials:["Coton"],cuts:["Slim"],
      description:"Jean en denim bleu à coupe ajustée.",
      url:"https://shop.example/jean-bleu"
    }
  ];
  const winterIdeas = buildMensOutfitIdeas([pin],[],products,[]);
  assert.equal(winterIdeas.length,1);
  assert.ok(winterIdeas[0].items.some(entry => entry.product.id==="pleated-wool-trousers"));
  assert.ok(!winterIdeas[0].items.some(entry => entry.product.id==="blue-slim-jeans"));

  const summerIdeas = buildMensOutfitIdeas([pin],[],products,[],{},{
    season:"Été",styles:[],profile:{}
  });
  assert.equal(summerIdeas.length,0);
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


test("outfit ideas respect selected Pinterest styles and total budget", function() {
  const pin = {
    id:"pin-street",
    title:"Streetwear black outfit",
    description:"Black oversized hoodie and wide trousers",
    imageUrl:"https://images.example/pin.jpg",
    visualAnalysis:{isFashion:true,summary:"Tenue streetwear noire avec hoodie ample, pantalon large et baskets.",styleTags:["Streetwear"],colors:["noir"],materials:["coton"],cuts:["oversized","wide leg"],patterns:[]}
  };
  const products = [
    {id:"hoodie",name:"Hoodie noir oversized",objective:"Vêtements",styleTags:["Streetwear"],colors:["noir"],cuts:["oversized"],price:60,url:"https://shop.example/hoodie"},
    {id:"trousers",name:"Pantalon large noir",objective:"Vêtements",styleTags:["Streetwear"],colors:["noir"],cuts:["wide leg"],price:70,url:"https://shop.example/trousers"},
    {id:"sneakers",name:"Sneakers noires",objective:"Chaussures",styleTags:["Streetwear"],colors:["noir"],price:90,url:"https://shop.example/sneakers"},
    {id:"blazer",name:"Blazer gris formel",objective:"Vêtements",styleTags:["Classe"],colors:["gris"],price:120,url:"https://shop.example/blazer"}
  ];
  const filtered = buildMensOutfitIdeas([pin],[],products,[],{},{
    styles:["Streetwear"],season:"Toute saison",maxPrice:180,profile:{}
  });
  assert.equal(filtered.length,1);
  assert.deepEqual(filtered[0].items.map(entry=>entry.product.id),["hoodie","trousers"]);
  assert.equal(filtered[0].totalPrice,130);

  const wrongStyle = buildMensOutfitIdeas([pin],[],products,[],{},{
    styles:["Classe"],season:"Toute saison",maxPrice:null,profile:{}
  });
  assert.equal(wrongStyle.length,0);
});

test("saved wardrobe pieces can be included without a merchant URL, but suggestions need real links", function() {
  const pin={id:"pin-saved",title:"Minimalist beige outfit",imageUrl:"https://images.example/pin.jpg"};
  const wardrobe=[{id:"manual-top",name:"Chemise beige",objective:"Vêtements",colors:["beige"]}];
  const catalogue=[
    {id:"linked-bottom",name:"Pantalon beige",objective:"Vêtements",colors:["beige"],url:"https://shop.example/bottom"},
    {id:"unlinked-shoes",name:"Sneakers beige",objective:"Chaussures",colors:["beige"],url:""}
  ];
  const ideas=buildMensOutfitIdeas([pin],wardrobe,catalogue,[]);
  assert.ok(ideas[0].items.some(entry=>entry.product.id==="manual-top"));
  assert.ok(ideas[0].items.some(entry=>entry.product.id==="linked-bottom"));
  assert.ok(!ideas[0].items.some(entry=>entry.product.id==="unlinked-shoes"));
});


test("unknown product prices never become a zero-euro outfit total", function() {
  assert.equal(outfitTotalPrice([
    {product:{price:null}},
    {product:{price:29.99}}
  ]),null);
  assert.equal(outfitTotalPrice([
    {product:{price:0}},
    {product:{price:29.99}}
  ]),29.99);
});

test("season filters ignore generic style tags and only reject explicit conflicting seasons", function() {
  const neutralPin = {
    id:"neutral-season",
    title:"Streetwear capsule outfit",
    tags:["Streetwear","noir"]
  };
  const winterOnly = buildMensOutfitIdeas([neutralPin],[],[],[],{},{
    season:"Hiver",styles:[],profile:{}
  });
  assert.equal(winterOnly.length,1);

  const summerPin = {
    id:"summer-season",
    title:"Summer streetwear outfit",
    tags:["Streetwear","beige"]
  };
  const winterFiltered = buildMensOutfitIdeas([summerPin],[],[],[],{},{
    season:"Hiver",styles:[],profile:{}
  });
  const summerFiltered = buildMensOutfitIdeas([summerPin],[],[],[],{},{
    season:"Été",styles:[],profile:{}
  });
  assert.equal(winterFiltered.length,0);
  assert.equal(summerFiltered.length,1);

  const winterTagged = {
    id:"winter-season",
    title:"Streetwear outfit",
    tags:["Streetwear"],
    seasonTags:["Automne / Hiver"]
  };
  assert.equal(buildMensOutfitIdeas([winterTagged],[],[],[],{},{
    season:"Hiver",styles:[],profile:{}
  }).length,1);
});


test("outfit suggestions exclude products identified for women", function() {
  const pin={id:"pin-gender",title:"Men's minimalist outfit",visualAnalysis:{version:3,audience:"men",isFashion:true}};
  const wardrobe=[
    {id:"men-top",name:"Chemise homme",gender:"men",genderVerified:true,objective:"Vêtements",url:"https://shop.example/men/top"},
    {id:"women-top",name:"Chemise femme",gender:"women",objective:"Vêtements",url:"https://shop.example/women/top"}
  ];
  const ideas=buildOutfitIdeas([pin],wardrobe,[],[]);
  assert.ok(ideas.length);
  assert.ok(ideas[0].items.every(entry=>entry.product.id!=="women-top"));
});


test("Pinterest inspirations are accepted only when their male audience is confirmed", function() {
  assert.equal(isMenswearPin({title:"Men's knitwear outfit"}),true);
  assert.equal(isMenswearPin({title:"Unisex knitwear outfit"}),false);
  assert.equal(isMenswearPin({title:"Women's streetwear outfit"}),false);
  assert.equal(isMenswearPin({title:"Preppy outfit",visualAnalysis:{version:3,audience:"unknown",isFashion:false}}),false);
  assert.equal(isMenswearPin({title:"Preppy outfit",visualAnalysis:{version:3,audience:"men",isFashion:true}}),true);
});
