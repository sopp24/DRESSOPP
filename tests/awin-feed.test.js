import test from "node:test";
import assert from "node:assert/strict";
import {
  parseCsv,
  objectsFromCsv,
  parsePrice,
  currencyFromPrice,
  filterFeedRows,
  mapFeedProduct,
  buildCatalogFromFeeds
} from "../scripts/refresh-awin-catalog.mjs";

test("parseCsv handles quoted commas, escaped quotes and embedded newlines", function() {
  const rows = parseCsv('Advertiser,Name,URL\r\n"Shop, France","Pull ""heritage""",https://productdata.awin.com/feed\r\n"Second shop","Line one\nLine two",https://productdata.awin.com/feed2');
  assert.equal(rows.length, 3);
  assert.equal(rows[1][0], "Shop, France");
  assert.equal(rows[1][1], 'Pull "heritage"');
  assert.equal(rows[2][1], "Line one\nLine two");
});

test("filterFeedRows keeps only supported French fashion merchants and safe Awin URLs", function() {
  const rows = [
    { "Advertiser Name":"BZB FR", "Primary Region":"FR", "Language":"French", "Datafeed Format":"Awin", "URL":"https://productdata.awin.com/datafeed/download/apikey/key/fid/1" },
    { "Advertiser Name":"Nike FR", "Primary Region":"FR", "Language":"French", "Datafeed Format":"Awin", "URL":"https://datafeed.api.productserve.com/datafeed/download/apikey/key/fid/2" },
    { "Advertiser Name":"Unknown shop", "Primary Region":"FR", "Language":"French", "Datafeed Format":"Awin", "URL":"https://productdata.awin.com/feed/3" },
    { "Advertiser Name":"Zalando DE", "Primary Region":"DE", "Language":"German", "Datafeed Format":"Awin", "URL":"https://productdata.awin.com/feed/4" },
    { "Advertiser Name":"ASOS FR", "Primary Region":"FR", "Language":"French", "Datafeed Format":"Google Enhanced", "URL":"https://productdata.awin.com/feed/5" },
    { "Advertiser Name":"UNIQLO FR", "Primary Region":"FR", "Language":"French", "Datafeed Format":"Awin", "URL":"https://example.com/private-feed" }
  ];
  const result = filterFeedRows(rows);
  assert.deepEqual(result.map(row => row["Advertiser Name"]), ["BZB FR", "Nike FR", "ASOS FR"]);
});

test("mapFeedProduct maps a real in-stock EUR fashion row with provenance and ratings", function() {
  const row = {
    product_name:"Pull col polo marron",
    brand_name:"BZB",
    merchant_name:"BZB FR",
    aw_deep_link:"https://www.b-z-b.com/p/pull-polo.html",
    large_image:"https://cdn.b-z-b.com/images/pull-polo.jpg",
    search_price:"35.99",
    currency:"EUR",
    in_stock:"1",
    suitable_for:"male",
    merchant_category:"Men > Clothing > Knitwear",
    colour:"Marron foncé",
    material:"Coton",
    size:"S|M|L|XL",
    average_rating:"4.7",
    reviews:"128",
    last_updated:"2026-11-05 08:00:00"
  };
  const product = mapFeedProduct(row, {
    advertiserId:"12231", advertiserName:"BZB FR", feedId:"456",
    feedName:"Mode Homme", lastImported:"2026-11-05 08:00:00"
  }, "2026-11-05T12:00:00.000Z");
  assert.ok(product);
  assert.equal(product.price, 35.99);
  assert.equal(product.objective, "Vêtements");
  assert.deepEqual(product.colors, ["Marron foncé"]);
  assert.deepEqual(product.sizes, ["S", "M", "L", "XL"]);
  assert.equal(product.productRating, 4.7);
  assert.equal(product.productRatingCount, 128);
  assert.equal(product.sourceType, "awin");
  assert.equal(product.advertiserId, "12231");
  assert.equal(product.availabilityStatus, "available");
});

test("mapFeedProduct rejects items with no stock, non-EUR prices or no usable image", function() {
  const base = {
    product_name:"Pantalon large",
    brand_name:"Brand",
    merchant_name:"BZB FR",
    aw_deep_link:"https://www.b-z-b.com/p/pantalon.html",
    large_image:"https://cdn.b-z-b.com/pantalon.jpg",
    search_price:"39.99",
    currency:"EUR",
    in_stock:"1",
    suitable_for:"male",
    merchant_category:"Men > Trousers"
  };
  assert.equal(mapFeedProduct({ ...base, in_stock:"0" }, { advertiserId:"1", feedId:"1" }), null);
  assert.equal(mapFeedProduct({ ...base, currency:"GBP" }, { advertiserId:"1", feedId:"1" }), null);
  assert.equal(mapFeedProduct({ ...base, large_image:"" }, { advertiserId:"1", feedId:"1" }), null);
  assert.equal(mapFeedProduct({ ...base, aw_deep_link:"javascript:alert(1)" }, { advertiserId:"1", feedId:"1" }), null);
});

test("mapFeedProduct excludes female-only, expired and not-yet-started feed items", function() {
  const base = {
    product_name:"Pull en laine",
    merchant_name:"Uniqlo FR",
    aw_deep_link:"https://www.uniqlo.com/fr/pull.html",
    large_image:"https://image.uniqlo.com/pull.jpg",
    search_price:"49.90",
    currency:"EUR",
    in_stock:"1",
    merchant_category:"Knitwear"
  };
  assert.equal(mapFeedProduct({ ...base, suitable_for:"female" }, { advertiserId:"1", feedId:"1" }), null);
  assert.equal(mapFeedProduct({ ...base, valid_to:"2020-01-01" }, { advertiserId:"1", feedId:"1" }), null);
  assert.equal(mapFeedProduct({ ...base, valid_from:"2099-01-01" }, { advertiserId:"1", feedId:"1" }), null);
  assert.ok(mapFeedProduct({ ...base, valid_to:"2099-01-01" }, { advertiserId:"1", feedId:"1" }));
});

test("buildCatalogFromFeeds reuses unchanged feeds without downloading them", async function() {
  const previousProduct = {
    id:"awin-12231-bzb-old", name:"Old but still current feed product",
    merchant:"BZB FR", source:"BZB FR", sourceType:"awin",
    feedId:"456", advertiserId:"12231",
    url:"https://www.b-z-b.com/p/old.html",
    imageUrl:"https://cdn.b-z-b.com/old.jpg", price:35.99,
    verifiedAt:"2026-11-05T10:00:00.000Z", catalogStatus:"active"
  };
  const row = {
    "Advertiser ID":"12231", "Advertiser Name":"BZB FR", "Primary Region":"FR",
    "Membership Status":"active", "Datafeed Format":"Awin",
    "Feed ID":"456", "Feed Name":"Mode Homme", "Language":"French",
    "Last Imported":"2026-11-05 08:00:00",
    "URL":"https://productdata.awin.com/datafeed/download/apikey/key/fid/456"
  };
  const result = await buildCatalogFromFeeds(
    [row],
    [previousProduct],
    { feeds:{ "12231:456":{ lastImported:"2026-11-05 08:00:00", productCount:1 } } },
    []
  );
  assert.equal(result.catalog.products.length, 1);
  assert.equal(result.catalog.products[0].id, previousProduct.id);
  assert.equal(result.meta.status, "connected");
  assert.equal(result.meta.liveProductCount, 1);
});

test("objectsFromCsv reads Awin Google Enhanced JSON Lines and Google currency strings", function() {
  const jsonl = [
    JSON.stringify({ id:"one", title:"Men's wool knit", price:"49.90 EUR", availability:"in_stock", link:"https://shop.example/p/one", image_link:"https://shop.example/i/one.jpg", gender:"male", color:"Cream" }),
    JSON.stringify({ id:"two", title:"Men's cotton polo", price:"35,00 EUR", availability:"in_stock", link:"https://shop.example/p/two", image_link:"https://shop.example/i/two.jpg", gender:"male", color:"Navy" })
  ].join("\n");
  const rows = objectsFromCsv(jsonl);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].title, "Men's wool knit");
  assert.equal(parsePrice(rows[0].price), 49.9);
  assert.equal(parsePrice(rows[1].price), 35);
  assert.equal(currencyFromPrice(rows[0].price), "eur");
});
test("parseCsv delimiter selection supports semicolon and tab-separated Awin feeds", function() {
  const semicolon = objectsFromCsv("product_name;search_price;currency\nPull;49,90;EUR");
  const tab = objectsFromCsv("product_name\tsearch_price\tcurrency\nSweat\t35.00\tEUR");
  assert.equal(semicolon[0].product_name, "Pull");
  assert.equal(semicolon[0].search_price, "49,90");
  assert.equal(tab[0].currency, "EUR");
});

test("mapFeedProduct maps Google Enhanced JSONL products with currency in the price field", function() {
  const product = mapFeedProduct({
    id:"google-42",
    title:"Men's merino sweater",
    brand:"UNIQLO",
    link:"https://www.uniqlo.com/fr/fr/products/123456",
    image_link:"https://image.uniqlo.com/product.jpg",
    price:"49.90 EUR",
    availability:"in_stock",
    gender:"male",
    google_product_category:"Apparel & Accessories > Clothing",
    product_type:"Men > Knitwear",
    color:"Cream",
    material:"Wool",
    pattern:"Plain",
    size:"M"
  }, { advertiserId:"777", advertiserName:"UNIQLO FR", feedId:"42", feedName:"Google Enhanced" }, "2026-11-05T12:00:00.000Z");
  assert.ok(product);
  assert.equal(product.name, "Men's merino sweater");
  assert.equal(product.merchant, "UNIQLO FR");
  assert.equal(product.price, 49.9);
  assert.equal(product.availabilityStatus, "available");
  assert.equal(product.url, "https://www.uniqlo.com/fr/fr/products/123456");
  assert.equal(product.imageUrl, "https://image.uniqlo.com/product.jpg");
  assert.deepEqual(product.colors, ["Cream"]);
  assert.deepEqual(product.materials, ["Wool"]);
});


test("filterFeedRows recognises additional French retailers and rejects inactive programs", function() {
  const rows = [
    { "Advertiser Name":"Bershka FR", "Primary Region":"FR", "Language":"French", "Membership Status":"active", "URL":"https://productdata.awin.com/feed/1" },
    { "Advertiser Name":"Polo Ralph Lauren FR", "Primary Region":"FR", "Language":"French", "Membership Status":"active", "URL":"https://productdata.awin.com/feed/2" },
    { "Advertiser Name":"ASOS FR", "Primary Region":"FR", "Language":"French", "Membership Status":"rejected", "URL":"https://productdata.awin.com/feed/3" }
  ];
  assert.deepEqual(filterFeedRows(rows).map(row => row["Advertiser Name"]), ["Bershka FR", "Polo Ralph Lauren FR"]);
});

test("mapFeedProduct keeps merchant trust ratings separate from product reviews", function() {
  const product = mapFeedProduct({
    product_name:"Pull mérinos",
    merchant_name:"UNIQLO FR",
    aw_deep_link:"https://www.uniqlo.com/fr/pull.html",
    large_image:"https://image.uniqlo.com/pull.jpg",
    search_price:"49.90",
    currency:"EUR",
    in_stock:"1",
    average_rating:"4.2",
    product_review_count:"80",
    merchant_rating:"4.8",
    merchant_rating_count:"1250",
    merchant_rating_source:"Trustpilot",
    popularity_score:"92",
    is_best_seller:"1"
  }, { advertiserId:"4", feedId:"4" }, "2026-11-05T15:45:00.000Z");
  assert.ok(product);
  assert.equal(product.productRating, 4.2);
  assert.equal(product.productRatingCount, 80);
  assert.equal(product.merchantRating, 4.8);
  assert.equal(product.merchantRatingCount, 1250);
  assert.equal(product.merchantRatingSource, "Trustpilot");
  assert.equal(product.popularityScore, 92);
  assert.equal(product.isBestSeller, true);
});
