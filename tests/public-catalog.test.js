import test from "node:test";
import assert from "node:assert/strict";
import { extractProductsFromHtml, mergeCatalog, parseRobots, robotsAllows, selectSourceBatch } from "../scripts/refresh-public-catalog.mjs";

const source = { name:"Boutique test", domain:"example.com" };

test("robots.txt rules use the most specific matching path", () => {
  const robots = parseRobots("User-agent: *\nDisallow: /private\nAllow: /private/product\nDisallow: /checkout");
  assert.equal(robotsAllows("/private/page",robots),false);
  assert.equal(robotsAllows("/private/product/1",robots),true);
  assert.equal(robotsAllows("/checkout",robots),false);
  assert.equal(robotsAllows("/catalogue",robots),true);
});

test("imports official EUR products and keeps product ratings separate from merchant trust", () => {
  const html = '<script type="application/ld+json">{"@type":"Product","name":"Pull mérinos","url":"https://example.com/pull","image":"https://cdn.example.com/pull.jpg","brand":{"name":"Exemple"},"size":["S","M"],"offers":{"price":"89.90","priceCurrency":"EUR","availability":"https://schema.org/InStock"},"aggregateRating":{"ratingValue":"4.7","reviewCount":"83"}}</script>';
  const products = extractProductsFromHtml(html,source,"https://example.com/pull","2026-11-06T10:00:00.000Z");
  assert.equal(products.length,1);
  assert.equal(products[0].price,89.9);
  assert.equal(products[0].productRating,4.7);
  assert.equal(products[0].merchantRating,null);
  assert.equal(products[0].sourceType,"public-web");
});

test("rejects non-EUR, out-of-stock and incomplete records", () => {
  const html = '<script type="application/ld+json">[' +
    '{"@type":"Product","name":"USD","image":"https://cdn.example.com/a.jpg","offers":{"price":"90","priceCurrency":"USD"}},' +
    '{"@type":"Product","name":"Rupture","image":"https://cdn.example.com/b.jpg","offers":{"price":"90","priceCurrency":"EUR","availability":"https://schema.org/OutOfStock"}},' +
    '{"@type":"Product","name":"Sans photo","offers":{"price":"90","priceCurrency":"EUR"}}]</script>';
  assert.deepEqual(extractProductsFromHtml(html,source,"https://example.com/p"),[]);
});

test("legacy public products need explicit men's evidence before retaining a men's label", () => {
  const previous = [
    {id:"legacy-ambiguous",name:"Pull col roulé",description:"Maille douce et chaude",gender:"men",sourceType:"public-web",url:"https://example.com/p/1"},
    {id:"legacy-explicit",name:"Chemise homme Oxford",gender:"men",sourceType:"public-web",url:"https://example.com/homme/chemise"},
    {id:"verified",name:"Pull en laine",gender:"men",genderVerified:true,sourceType:"public-web",url:"https://example.com/p/3"}
  ];
  const result = mergeCatalog(previous,[],[],new Date("2026-11-12T12:00:00.000Z"));
  const byId = new Map(result.products.map(item=>[item.id,item]));
  assert.equal(byId.get("legacy-ambiguous").gender,"unknown");
  assert.equal(byId.get("legacy-ambiguous").genderVerified,false);
  assert.equal(byId.get("legacy-explicit").gender,"men");
  assert.equal(byId.get("legacy-explicit").genderVerified,true);
  assert.equal(byId.get("verified").gender,"men");
  assert.equal(byId.get("verified").genderVerified,true);
});

test("expires old public listings but preserves editorial seeds", () => {
  const old = [{id:"old",url:"https://example.com/old",sourceType:"public-web",verifiedAt:"2026-10-01T00:00:00.000Z",catalogStatus:"active"}];
  const seed = [{id:"seed",url:"https://shop.example/seed",sourceType:"curated"}];
  const result = mergeCatalog(old,seed,[],new Date("2026-11-06T00:00:00.000Z"));
  assert.equal(result.products.find(item=>item.id==="old").catalogStatus,"stale");
  assert.ok(result.products.some(item=>item.id==="seed"));
});


test("robots.txt terminal dollar anchors a rule and wildcards match paths", () => {
  const robots = parseRobots("User-agent: *\nDisallow: /exact$\nDisallow: /images/*.jpg$");
  assert.equal(robotsAllows("/exact", robots), false);
  assert.equal(robotsAllows("/exactly", robots), true);
  assert.equal(robotsAllows("/images/look.jpg", robots), false);
  assert.equal(robotsAllows("/images/look.jpg/extra", robots), true);
});

test("a bot-specific robots group takes precedence over the wildcard group", () => {
  const robots = parseRobots("User-agent: *\nDisallow: /all\nUser-agent: DRESSOPPBot\nDisallow: /private");
  assert.equal(robotsAllows("/private/shoes", robots), false);
  assert.equal(robotsAllows("/all/shoes", robots), true);
});


test("product title overrides a misleading merchant category breadcrumb", () => {
  const html = '<script type="application/ld+json">' +
    '{"@type":"Product","name":"Doudoune à capuche waterproof","category":"Chaussures > Bottes","image":"https://cdn.example.com/coat.jpg","offers":{"price":"99.99","priceCurrency":"EUR","availability":"https://schema.org/InStock"}}' +
    '</script>';
  const products = extractProductsFromHtml(html,source,"https://example.com/doudoune","2026-11-06T10:00:00.000Z");
  assert.equal(products.length,1);
  assert.equal(products[0].objective,"Vêtements");
  assert.equal(products[0].category,"Veste");
});

test("products removed from a successfully refreshed merchant are marked stale", () => {
  const previous = [{
    id:"old", name:"Old product", merchant:"Shop", source:"Shop", sourceType:"public-web",
    url:"https://example.com/old", verifiedAt:"2026-11-06T09:00:00.000Z", catalogStatus:"active"
  }];
  const fresh = {
    name:"Shop", status:"ok", pages:3, reason:"",
    products:[{
      id:"new", name:"New product", merchant:"Shop", source:"Shop", sourceType:"public-web",
      url:"https://example.com/new", verifiedAt:"2026-11-06T10:00:00.000Z", catalogStatus:"active"
    }]
  };
  const result = mergeCatalog(previous,[],[fresh],new Date("2026-11-06T10:05:00.000Z"));
  assert.equal(result.products.find(item=>item.id==="old").catalogStatus,"stale");
  assert.equal(result.products.find(item=>item.id==="new").catalogStatus,"active");
  assert.equal(result.meta.liveProductCount,1);
});


test("the 200-store directory rotates across batches and keeps priority sources", () => {
  const stores = Array.from({length:200},(_,index)=>({
    name:"Store "+index,domain:"store"+index+".example",priority:index<24?1:2
  }));
  const first = selectSourceBatch(stores,{},36,12);
  const second = selectSourceBatch(stores,first.nextCursors,36,12);
  assert.equal(first.sources.length,36);
  assert.equal(second.sources.length,36);
  assert.equal(first.sources.filter(source=>source.priority===1).length,12);
  assert.equal(second.sources.filter(source=>source.priority===1).length,12);
  assert.equal(new Set(first.sources.concat(second.sources).map(source=>source.name)).size,72);
});


test("catalogue extraction labels men's, mixed and women's product departments", function() {
  const html = '<script type="application/ld+json">[' +
    '{"@type":"Product","name":"Chemise homme","url":"https://example.com/homme/chemise","image":"https://cdn.example.com/m.jpg","offers":{"price":"40","priceCurrency":"EUR"}},' +
    '{"@type":"Product","name":"T-shirt unisexe","url":"https://example.com/unisex/tee","image":"https://cdn.example.com/u.jpg","offers":{"price":"25","priceCurrency":"EUR"}},' +
    '{"@type":"Product","name":"Blouse femme","url":"https://example.com/femme/blouse","image":"https://cdn.example.com/w.jpg","offers":{"price":"35","priceCurrency":"EUR"}},' +
    '{"@type":"Product","name":"Pull en laine","url":"https://example.com/pull","image":"https://cdn.example.com/x.jpg","offers":{"price":"55","priceCurrency":"EUR"}}' +
    ']</script>';
  const products=extractProductsFromHtml(html,source,"https://example.com/catalogue","2026-11-10T08:00:00.000Z");
  assert.deepEqual(products.map(item=>item.gender),["men","unisex","women","unknown"]);
  assert.deepEqual(products.map(item=>item.genderVerified),[true,false,false,false]);
});

test("catalogue gender detection ignores case and accents and honours men-only merchants", async () => {
  const { extractProductsFromHtml } = await import("../scripts/refresh-public-catalog.mjs");
  const html = name => '<script type="application/ld+json">' + JSON.stringify({ "@type":"Product", name, image:"https://shop.example/i.jpg", offers:{ price:"40", priceCurrency:"EUR", availability:"InStock" } }) + "</script>";
  const page = "https://shop.example/p/1";
  const women = extractProductsFromHtml(html("Women's Haydon Jacket"), { name:"Shop", domain:"shop.example" }, page);
  assert.equal(women[0].gender, "women");
  const men = extractProductsFromHtml(html("Pull Homme col V"), { name:"Shop", domain:"shop.example" }, page);
  assert.equal(men[0].gender, "men");
  const menShop = { name:"Jules", domain:"shop.example", audience:"men" };
  const unlabelled = extractProductsFromHtml(html("Pull col rond"), menShop, page);
  assert.equal(unlabelled[0].gender, "men");
  assert.equal(unlabelled[0].audienceEvidence, "merchant");
  assert.equal(extractProductsFromHtml(html("Robe fluide"), menShop, page)[0].gender, "unknown");
});

test("candidate pages favour men's pieces close to the Pinterest board and demote women's sections", async () => {
  const { rankCandidateUrls, pinterestInterestTerms } = await import("../scripts/refresh-public-catalog.mjs");
  const terms = pinterestInterestTerms([{ visualAnalysis:{ isFashion:true, audience:"men", materials:["laine"], colors:["marron"], pieces:[{ type:"pantalon", color:"marron", material:"" }, { type:"pull", color:"crème", material:"laine" }] } }]);
  assert.ok(terms.includes("pantalon") && terms.includes("trouser") && terms.includes("laine"));
  const ranked = rankCandidateUrls([
    "https://shop.example/femme/p/robe-12345.html",
    "https://shop.example/p/casquette-12345.html",
    "https://shop.example/homme/p/pull-laine-12345.html"
  ], terms);
  assert.equal(ranked[0], "https://shop.example/homme/p/pull-laine-12345.html");
  assert.equal(ranked[2], "https://shop.example/femme/p/robe-12345.html");
});
