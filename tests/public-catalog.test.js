import test from "node:test";
import assert from "node:assert/strict";
import { extractProductsFromHtml, mergeCatalog, parseRobots, robotsAllows } from "../scripts/refresh-public-catalog.mjs";

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

test("expires old public listings but preserves editorial seeds", () => {
  const old = [{id:"old",url:"https://example.com/old",sourceType:"public-web",verifiedAt:"2026-10-01T00:00:00.000Z",catalogStatus:"active"}];
  const seed = [{id:"seed",url:"https://shop.example/seed",sourceType:"curated"}];
  const result = mergeCatalog(old,seed,[],new Date("2026-11-06T00:00:00.000Z"));
  assert.equal(result.products.find(item=>item.id==="old").catalogStatus,"stale");
  assert.ok(result.products.some(item=>item.id==="seed"));
});

test("a bot-specific robots group takes precedence over the wildcard group", () => {
  const robots = parseRobots("User-agent: *\\nDisallow: /all\\nUser-agent: DRESSOPPBot\\nDisallow: /private");
  assert.equal(robotsAllows("/private/shoes", robots), false);
  assert.equal(robotsAllows("/all/shoes", robots), true);
});
