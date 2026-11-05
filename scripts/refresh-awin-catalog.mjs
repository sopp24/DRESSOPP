import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { pathToFileURL } from "node:url";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const CATALOG_PATH = resolve(ROOT, "data/catalog.json");
const META_PATH = resolve(ROOT, "data/catalog-meta.json");
const SEEDS_PATH = resolve(ROOT, "data/catalog-seeds.json");
const MAX_FEEDS = 36;
const MAX_PRODUCTS_PER_FEED = 280;
const MAX_PRODUCTS_TOTAL = 3200;
const CONCURRENCY = 3;
const AWIN_HOSTS = new Set(["productdata.awin.com", "datafeed.api.productserve.com", "ui.awin.com", "api.awin.com"]);
const MERCHANT_PATTERNS = [
  ["Zalando", /\bzalando\b/i],
  ["ASOS", /\basos\b/i],
  ["Zara", /\bzara\b/i],
  ["Uniqlo", /\buniqlo\b/i],
  ["BZB", /\bbzb\b/i],
  ["Pull & Bear", /pull\s*(?:&|and)\s*bear|pullandbear/i],
  ["Bershka", /\bbershka\b/i],
  ["H&M", /\bh\s*&\s*m\b|\bhm\b/i],
  ["Mango", /\bmango\b/i],
  ["Massimo Dutti", /massimo[\s-]*dutti/i],
  ["COS", /\bcos\b/i],
  ["ARKET", /\barket\b/i],
  ["Weekday", /\bweekday\b/i],
  ["Levi's", /levi['’]?s/i],
  ["Carhartt WIP", /carhartt[\s-]*wip/i],
  ["Jack & Jones", /jack\s*(?:&|and)\s*jones/i],
  ["Celio", /\bcelio\b/i],
  ["Jules", /\bjules\b/i],
  ["Fred Perry", /fred\s+perry/i],
  ["Lacoste", /\blacoste\b/i],
  ["Tommy Hilfiger", /tommy[\s-]*hilfiger/i],
  ["Polo Ralph Lauren", /polo\s+ralph\s+lauren|ralph\s+lauren/i],
  ["Nike", /\bnike\b/i],
  ["adidas", /\badidas\b/i],
  ["New Balance", /new[\s-]*balance/i],
  ["Puma", /\bpuma\b/i],
  ["ASICS", /\basics\b/i],
  ["Converse", /\bconverse\b/i],
  ["Courir", /\bcourir\b/i],
  ["JD Sports", /jd\s*sports/i],
  ["Foot Locker", /foot\s*locker/i],
  ["Snipes", /\bsnipes\b/i],
  ["Sarenza", /\bsarenza\b/i],
  ["Calvin Klein", /calvin[\s-]*klein/i],
  ["Undiz", /\bundiz\b/i],
  ["Louis Vuitton", /louis[\s-]*vuitton/i],
  ["Dior", /\bdior\b/i],
  ["Lothaire", /\blothaire\b/i],
  ["Charles Tyrwhitt", /charles\s+tyrwhitt/i]
];
const STYLE_HINTS = [
  ["Preppy", /\b(oxford|rugby|polo|college|varsity|cable knit|torsad[eé]|chino)\b/i],
  ["Smart Casual", /\b(merino|m[eé]rinos|tailored|habill[eé]|blazer|laine|chemise|maille fine)\b/i],
  ["Heritage", /\b(heritage|fair isle|jacquard|tweed|velours côtel[eé]|corduroy|daim|su[eè]de|laine)\b/i],
  ["Streetwear", /\b(oversize|oversized|cargo|hoodie|sneaker|streetwear|baggy|graphic)\b/i],
  ["Sport", /\b(running|training|sport|football|basket|fitness|performance)\b/i],
  ["Workwear", /\b(workwear|utility|carpenter|canvas|surchemise|chore)\b/i],
  ["Vintage", /\b(vintage|r[eé]tro|washed|d[eé]lav[eé])\b/i],
  ["Classique", /\b(classique|regular|droit|uni|minimal|essentiel|basique)\b/i]
];
const CUT_HINTS = [
  ["Oversized", /\b(oversize|oversized)\b/i],
  ["Ample", /\b(wide|wide leg|ample|baggy|loose)\b/i],
  ["Relaxed", /\b(relaxed|relax|décontract[eé])\b/i],
  ["Straight", /\b(straight|droit)\b/i],
  ["Slim", /\b(slim|ajust[eé])\b/i],
  ["Regular", /\b(regular|classique)\b/i],
  ["Tapered", /\b(tapered|fus[eé]l[eé])\b/i]
];

function log(message) { process.stdout.write("[DRESSOPP/Awin] " + message + "\n"); }
function key(value) {
  return String(value == null ? "" : value).trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
function text(value) { return String(value == null ? "" : value).replace(/\s+/g, " ").trim(); }
function field(row, ...names) {
  for (const name of names) {
    const target = key(name);
    const found = Object.keys(row).find(candidate => key(candidate) === target);
    if (found && text(row[found])) return text(row[found]);
  }
  return "";
}
export function parseCsv(input, delimiter = ",") {
  const source = String(input == null ? "" : input).replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"') {
        if (source[index + 1] === '"') { cell += '"'; index += 1; }
        else quoted = false;
      } else cell += character;
      continue;
    }
    if (character === '"' && cell.length === 0) { quoted = true; continue; }
    if (character === delimiter) { row.push(cell); cell = ""; continue; }
    if (character === "\n" || character === "\r") {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some(value => text(value))) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += character;
  }
  row.push(cell);
  if (row.some(value => text(value))) rows.push(row);
  return rows;
}
export function objectsFromCsv(input) {
  const normalized = String(input == null ? "" : input).replace(/^\uFEFF/, "").trim();
  if (!normalized) return [];
  if (normalized.startsWith("{")) {
    return normalized.split(/\r?\n/).filter(line => line.trim()).map(line => {
      const value = JSON.parse(line);
      return value && typeof value === "object" && !Array.isArray(value) ? value : null;
    }).filter(Boolean);
  }
  if (normalized.startsWith("[")) {
    const parsed = JSON.parse(normalized);
    return Array.isArray(parsed) ? parsed.filter(value => value && typeof value === "object" && !Array.isArray(value)) : [];
  }
  const sample = normalized.split(/\r?\n/).slice(0, 4).join("\n");
  const candidates = [",", ";", "\t"];
  const delimiter = candidates.sort((a, b) => {
    const count = value => sample.split(value).length - 1;
    return count(b) - count(a);
  })[0];
  const rows = parseCsv(normalized, delimiter);
  if (rows.length < 2) return [];
  const headers = rows[0].map(text);
  return rows.slice(1).map(values => {
    const record = {};
    headers.forEach((header, index) => { record[header] = text(values[index]); });
    return record;
  }).filter(record => Object.values(record).some(Boolean));
}
function decodePayload(buffer) {
  const value = Buffer.from(buffer);
  return value.length > 2 && value[0] === 0x1f && value[1] === 0x8b
    ? gunzipSync(value).toString("utf8")
    : value.toString("utf8");
}
function checkedAwinUrl(value) {
  const url = new URL(String(value || ""));
  if (url.protocol !== "https:" || !AWIN_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error("Hôte Awin inattendu dans une URL de flux : " + url.hostname);
  }
  return url;
}
async function download(url, label) {
  const safeUrl = checkedAwinUrl(url);
  if (safeUrl.hostname === "api.awin.com" && !process.env.AWIN_PUBLISHER_API_TOKEN) {
    throw new Error("Ce flux Google Enhanced demande le secret AWIN_PUBLISHER_API_TOKEN.");
  }
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(safeUrl, {
        headers: {
          "user-agent": "DRESSOPP-CatalogSync/1.0 (+https://sopp24.github.io/DRESSOPP/)",
          "accept": "text/csv,text/plain,application/json,application/x-ndjson,application/octet-stream,*/*",
          ...(safeUrl.hostname === "api.awin.com" && process.env.AWIN_PUBLISHER_API_TOKEN
            ? { "authorization": "Bearer " + process.env.AWIN_PUBLISHER_API_TOKEN }
            : {})
        },
        signal: AbortSignal.timeout(90000)
      });
      if (!response.ok) throw new Error("HTTP " + response.status + " pour " + label);
      return decodePayload(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise(resolve => setTimeout(resolve, attempt * 3500));
    }
  }
  throw lastError || new Error("Téléchargement impossible : " + label);
}
function positive(value) {
  const normalized = key(value);
  return ["1", "true", "yes", "y", "oui", "available", "instock", "in_stock", "en_stock", "disponible", "active"].includes(normalized);
}
function negative(value) {
  const normalized = key(value);
  return ["0", "false", "no", "n", "non", "out_of_stock", "outofstock", "sold_out", "soldout", "rupture", "indisponible", "disabled"].includes(normalized);
}
function inStock(row) {
  const explicit = field(row, "in_stock", "in stock");
  if (explicit) return positive(explicit) ? true : negative(explicit) ? false : false;
  const status = field(row, "stock_status", "availability", "availability_status");
  if (status) {
    if (negative(status) || /out of stock|sold out|rupture|indisponible|épuisé/i.test(status)) return false;
    if (positive(status) || /in stock|available|en stock|disponible/i.test(status)) return true;
  }
  const quantity = field(row, "stock_quantity", "quantity", "number_available");
  if (quantity && Number(quantity) > 0) return true;
  const forSale = field(row, "is_for_sale", "for_sale");
  return forSale ? positive(forSale) : false;
}
export function parsePrice(value) {
  let raw = String(value == null ? "" : value).trim();
  if (!raw) return null;
  raw = raw.replace(/(?:EUR|EURO|GBP|USD|CAD|AUD|CHF)\s*$/i, "").replace(/\s/g, "").replace(/[€$£]/g, "");
  if (raw.includes(",") && raw.includes(".")) {
    raw = raw.lastIndexOf(",") > raw.lastIndexOf(".") ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(/,/g, "");
  } else if (raw.includes(",")) raw = raw.replace(",", ".");
  const number = Number(raw);
  return Number.isFinite(number) && number > 0 ? number : null;
}
export function currencyFromPrice(value) {
  const source = String(value == null ? "" : value).trim();
  const suffix = source.match(/\b(EUR|EURO|GBP|USD|CAD|AUD|CHF)\s*$/i);
  if (suffix) return suffix[1].toLowerCase() === "euro" ? "eur" : suffix[1].toLowerCase();
  if (/[€]$/.test(source)) return "eur";
  return "";
}
function absoluteHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch { return ""; }
}
function splitValues(value) {
  return Array.from(new Set(String(value || "").split(/[|;,/]+/).map(text).filter(Boolean)));
}
function inferCategory(value) {
  const source = key(value);
  if (/shoe|sneaker|footwear|chaussure|basket|boot|bottine|sandale|mocassin|loafer|derby|oxford_shoe/.test(source)) return "Chaussures";
  if (/underwear|underpant|boxer|brief|slip|sous_vetement|lingerie|chaussette/.test(source)) return "Sous-vêtements";
  if (/accessor|belt|bag|wallet|cap|hat|ceinture|sac|casquette|bonnet|montre|jewellery|watch|bracelet|necklace|ring|portefeuille|bijou/.test(source)) return "Accessoires";
  return "Vêtements";
}
function inferStyles(source) {
  return STYLE_HINTS.filter(([, pattern]) => pattern.test(source)).map(([name]) => name);
}
function inferCuts(source) {
  return CUT_HINTS.filter(([, pattern]) => pattern.test(source)).map(([name]) => name);
}
function validDate(value) {
  if (!value) return true;
  const time = Date.parse(value);
  // Une date de fin doit être future (ou absente/inexploitable), pas déjà dépassée.
  return !Number.isFinite(time) || time > Date.now();
}
function validFromDate(value) {
  if (!value) return true;
  const time = Date.parse(value);
  return !Number.isFinite(time) || time <= Date.now();
}
function countFrom(value) {
  const match = String(value || "").replace(/,/g, "").match(/\d+/);
  return match ? Number(match[0]) : null;
}
function merchantGroup(name) {
  const match = MERCHANT_PATTERNS.find(([, pattern]) => pattern.test(name));
  return match ? match[0] : "";
}
function isFrenchFeed(row) {
  const region = key(field(row, "primary_region", "region", "country"));
  const language = key(field(row, "language", "locale"));
  const name = key([field(row, "advertiser_name", "advertiser"), field(row, "feed_name", "name")].join(" "));
  return region === "fr" || region.startsWith("fr_") || region.includes("france") ||
    language === "fr" || language.startsWith("fr_") || language.includes("french") || language.includes("francais") ||
    /\bfr\b/.test(name) || name.includes("france");
}
export function filterFeedRows(rows) {
  return rows.filter(row => {
    const advertiser = field(row, "advertiser_name", "advertiser");
    if (!merchantGroup(advertiser)) return false;
    if (!isFrenchFeed(row)) return false;
    const membership = key(field(row, "membership_status", "membership status", "program_status"));
    if (["inactive", "terminated", "rejected", "declined", "suspended", "revoked"].includes(membership)) return false;
    const url = field(row, "url", "download_url", "feed_url");
    try { checkedAwinUrl(url); } catch { return false; }
    return true;
  }).slice(0, MAX_FEEDS);
}
export function mapFeedProduct(row, feed, syncedAt = new Date().toISOString()) {
  const name = field(row, "product_name", "name", "title");
  const merchant = field(row, "merchant_name", "advertiser_name") || feed.advertiserName || "";
  const brand = field(row, "brand_name", "brand") || merchant;
  const rawPrice = field(row, "search_price", "sale_price", "price", "store_price");
  const currency = key(field(row, "currency", "currency_code")) || currencyFromPrice(rawPrice);
  const price = parsePrice(rawPrice);
  const url = absoluteHttpUrl(field(row, "aw_deep_link", "deep_link", "merchant_deep_link", "product_url", "link"));
  const imageUrl = absoluteHttpUrl(field(row, "large_image", "aw_image_url", "merchant_image_url", "image_url", "merchant_thumb_url", "image_link"));
  if (!name || !merchant || !url || !imageUrl || price == null || !["eur", "euro", "€"].includes(currency)) return null;
  if (!inStock(row) || !validDate(field(row, "valid_to", "expiration_date")) || !validFromDate(field(row, "valid_from", "availability_date"))) return null;
  const categoryRaw = [field(row, "merchant_category"), field(row, "merchant_product_category_path"), field(row, "category_name"), field(row, "google_product_category"), field(row, "product_type")].filter(Boolean).join(" ");
  const suitability = key(field(row, "suitable_for", "gender", "target_gender"));
  const hasMaleTarget = /\bmale\b|\bmen\b|\bunisex\b|\bhomme\b/.test(suitability);
  if ((suitability.includes("female") || suitability.includes("femme") || suitability.includes("woman")) && !hasMaleTarget) return null;
  const fullText = [name, brand, field(row, "description"), field(row, "keywords"), categoryRaw, field(row, "promotional_text")].join(" ");
  if (/\b(adult only|sex toy|pornograph|explicit adult)\b/i.test(fullText)) return null;
  const category = inferCategory(categoryRaw + " " + name);
  const externalId = field(row, "aw_product_id", "merchant_product_id", "product_id", "id", "ean", "product_gtin", "gtin") || url;
  const productRating = parsePrice(field(row, "average_rating", "product_rating", "rating"));
  const ratingCount = countFrom(field(row, "product_review_count", "reviews", "review_count", "rating_count"));
  // Les avis produit et la réputation du marchand restent deux mesures distinctes.
  const merchantRating = parsePrice(field(row, "merchant_rating", "store_rating", "advertiser_rating", "retailer_rating"));
  const merchantRatingCount = countFrom(field(row, "merchant_rating_count", "store_review_count", "advertiser_review_count", "retailer_review_count"));
  const merchantRatingSource = field(row, "merchant_rating_source", "store_rating_source", "advertiser_rating_source", "retailer_rating_source") ||
    (merchantRating != null ? "Note marchand fournie par le flux" : "");
  const popularityScore = parsePrice(field(row, "popularity_score", "trending_score", "trend_score"));
  const isBestSeller = positive(field(row, "is_best_seller", "best_seller", "bestseller", "is_bestseller"));
  const originalPrice = parsePrice(field(row, "rrp_price", "product_price_old", "base_price"));
  const colors = splitValues(field(row, "colour", "color"));
  const materials = splitValues(field(row, "material", "composition"));
  const patterns = splitValues(field(row, "pattern"));
  const sizeValues = splitValues(field(row, "size"));
  const styleTags = inferStyles(fullText);
  const cuts = inferCuts(fullText);
  const lastUpdated = field(row, "last_updated", "last_imported") || feed.lastImported || "";
  const id = "awin-" + String(feed.advertiserId || "merchant") + "-" + String(externalId).replace(/[^a-z0-9]+/gi, "-").slice(0, 100);
  return {
    id, name, brand, merchant, url, imageUrl, price, originalPrice,
    objective: category, category,
    styleTags, seasonTags: [],
    colors, materials, cuts, patterns,
    description: field(row, "product_short_description", "description", "promotional_text").slice(0, 1200),
    sizes: sizeValues, availability: "En stock selon le flux marchand Awin",
    availabilityStatus: "available", source: merchant, sourceType: "awin",
    feedId: String(feed.feedId || ""), advertiserId: String(feed.advertiserId || ""),
    feedLastImported: feed.lastImported || "", syncedAt, priceUpdatedAt: lastUpdated,
    stockVerifiedAt: syncedAt, verifiedAt: syncedAt, catalogStatus: "active",
    productRating: productRating != null && productRating <= 5 ? productRating : null,
    productRatingCount: ratingCount,
    productRatingSource: productRating != null ? "Avis produit · flux Awin" : "",
    merchantRating: merchantRating != null && merchantRating <= 5 ? merchantRating : null,
    merchantRatingCount: merchantRatingCount,
    merchantRatingSource,
    popularityScore: popularityScore != null ? Math.max(0, Math.min(100, popularityScore)) : null,
    isBestSeller
  };
}
function relevance(product) {
  const source = key([product.name, product.description, product.brand, ...(product.colors || []), ...(product.materials || []), ...(product.styleTags || [])].join(" "));
  const terms = ["merino", "merinos", "laine", "wool", "cuir", "leather", "suede", "daim", "maille", "knit", "polo", "oxford", "chino", "plisse", "wide", "ample", "relaxed", "oversize", "oversized", "brown", "marron", "beige", "cream", "creme", "ecru", "burgundy", "bordeaux", "grey", "gris", "navy", "marine", "heritage", "preppy"];
  return terms.reduce((score, term) => score + (source.includes(term) ? 1 : 0), 0) +
    (Number(product.productRating) >= 4.5 ? 2 : 0) +
    (Number(product.productRatingCount) >= 50 ? 1 : 0) +
    (Number(product.merchantRating) >= 4.5 ? 2 : 0) +
    (Number(product.merchantRatingCount) >= 100 ? 1 : 0) +
    (product.isBestSeller ? 1 : 0);
}
function productIdentity(product) {
  const raw = String(product.url || "").split("?")[0].replace(/\/+$/, "").toLowerCase();
  return raw || String(product.id || "");
}
function readJson(path, fallback) {
  return readFile(path, "utf8").then(value => JSON.parse(value)).catch(() => fallback);
}
function stableJson(value) { return JSON.stringify(value, null, 2) + "\n"; }
async function runPool(items, worker, concurrency) {
  const output = new Array(items.length);
  let next = 0;
  async function run() {
    while (true) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      output[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return output;
}
async function writeIfChanged(path, content) {
  const previous = await readFile(path, "utf8").catch(() => "");
  if (previous === content) return false;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
  return true;
}
export async function buildCatalogFromFeeds(feedRows, previousCatalog = [], previousMeta = {}, seeds = []) {
  const syncedAt = new Date().toISOString();
  const prevFeeds = previousMeta.feeds && typeof previousMeta.feeds === "object" ? previousMeta.feeds : {};
  const nextFeedMeta = {};
  const previousAwin = (previousCatalog || []).filter(product => product.sourceType === "awin");
  const retained = new Map(previousAwin.map(product => [productIdentity(product), product]));
  const reports = await runPool(feedRows, async row => {
    const advertiserId = field(row, "advertiser_id", "advertiser id");
    const feedId = field(row, "feed_id", "feed id");
    const advertiserName = field(row, "advertiser_name", "advertiser");
    const feedName = field(row, "feed_name", "name") || "Default";
    const lastImported = field(row, "last_imported", "last updated", "last_update");
    const feedKey = advertiserId + ":" + feedId;
    const old = prevFeeds[feedKey] || {};
    const hasCachedProducts = previousAwin.some(product => String(product.feedId) === String(feedId) && product.catalogStatus !== "stale");
    const unchanged = lastImported && old.lastImported && lastImported === old.lastImported && hasCachedProducts;
    let mapped = [];
    let state = "unchanged";
    let error = "";
    if (!unchanged) {
      try {
        const url = field(row, "url", "download_url", "feed_url");
        const csv = await download(url, advertiserName + " / " + feedName);
        const products = objectsFromCsv(csv).map(record => mapFeedProduct(record, {
          advertiserId, advertiserName, feedId, feedName, lastImported
        }, syncedAt)).filter(Boolean);
        products.sort((a, b) => relevance(b) - relevance(a));
        mapped = products.slice(0, MAX_PRODUCTS_PER_FEED);
        state = "updated";
        for (const [identity, product] of retained.entries()) {
          if (String(product.feedId) === String(feedId)) retained.delete(identity);
        }
        for (const product of mapped) retained.set(productIdentity(product), product);
      } catch (errorValue) {
        error = errorValue.message || String(errorValue);
        state = "error";
        for (const product of previousAwin.filter(item => String(item.feedId) === String(feedId))) {
          const oldProduct = { ...product, catalogStatus: "stale" };
          retained.set(productIdentity(oldProduct), oldProduct);
        }
      }
    } else {
      for (const product of previousAwin.filter(item => String(item.feedId) === String(feedId))) retained.set(productIdentity(product), product);
    }
    nextFeedMeta[feedKey] = {
      advertiserId, advertiserName, feedId, feedName, language: field(row, "language"),
      region: field(row, "primary_region"), vertical: field(row, "vertical"),
      membershipStatus: field(row, "membership_status"), lastImported,
      productCount: mapped.length || old.productCount || 0, status: state, error
    };
    if (state === "updated") log(advertiserName + " : " + mapped.length + " fiche(s) vérifiée(s).");
    else if (state === "error") log("Flux non téléchargé, anciennes fiches conservées : " + advertiserName + " — " + error);
    return nextFeedMeta[feedKey];
  }, CONCURRENCY);
  const currentFeedIds = new Set(feedRows.map(row => field(row, "feed_id", "feed id")));
  previousAwin.forEach(product => {
    if (product.feedId && !currentFeedIds.has(String(product.feedId))) {
      retained.set(productIdentity(product), { ...product, catalogStatus:"stale" });
    }
  });
  const seedProducts = (seeds || []).filter(product => product && product.id && product.url && product.imageUrl && Number.isFinite(Number(product.price)));
  const all = new Map();
  seedProducts.forEach(product => all.set(productIdentity(product), product));
  retained.forEach((product, identity) => all.set(identity, product));
  const products = Array.from(all.values()).sort((a, b) => relevance(b) - relevance(a)).slice(0, MAX_PRODUCTS_TOTAL);
  const sourceNames = Array.from(new Set(products.map(product => product.merchant || product.source).filter(Boolean))).sort((a, b) => a.localeCompare(b, "fr"));
  const updatedFeeds = reports.filter(item => item.status === "updated").length;
  const errorFeeds = reports.filter(item => item.status === "error").length;
  const meta = {
    schemaVersion: 1, provider: "Awin Product Feeds",
    status: errorFeeds ? "partial" : reports.length ? "connected" : "needs-configuration",
    syncedAt, productCount: products.length,
    liveProductCount: products.filter(product => product.sourceType === "awin" && product.catalogStatus === "active").length,
    curatedProductCount: products.filter(product => product.sourceType !== "awin").length,
    feedCount: reports.length, updatedFeeds, errorFeeds,
    sources: sourceNames,
    refreshCadence: "6 synchronisations planifiées par jour ; la fraîcheur dépend de la mise à jour du flux par chaque marchand.",
    feeds: nextFeedMeta
  };
  return { catalog: { schemaVersion: 1, description: "Catalogue vérifié DRESSOPP : articles éditoriaux temporaires et produits importés de flux marchands Awin.", syncedAt, products }, meta };
}
export async function main() {
  const listUrl = process.env.AWIN_PRODUCT_FEED_LIST_URL;
  if (!listUrl) {
    log("AWIN_PRODUCT_FEED_LIST_URL absent : synchronisation ignorée. Le catalogue existant est conservé.");
    return;
  }
  let feedListText;
  try {
    feedListText = await download(listUrl, "liste des flux produits");
  } catch (error) {
    throw new Error("Impossible de lire la liste des flux Awin. Vérifie la clé Data Feed (différente de la clé Publisher API). " + error.message);
  }
  const feedRows = filterFeedRows(objectsFromCsv(feedListText));
  log(feedRows.length + " flux français des enseignes sélectionnées détecté(s).");
  const previousCatalogDoc = await readJson(CATALOG_PATH, { products: [] });
  const previousMeta = await readJson(META_PATH, { feeds: {} });
  const seedsDoc = await readJson(SEEDS_PATH, { products: [] });
  const result = await buildCatalogFromFeeds(feedRows, previousCatalogDoc.products || [], previousMeta, seedsDoc.products || []);
  await writeIfChanged(CATALOG_PATH, stableJson(result.catalog));
  await writeIfChanged(META_PATH, stableJson(result.meta));
  log(result.catalog.products.length + " produits au catalogue (" + result.meta.liveProductCount + " via Awin, " + result.meta.curatedProductCount + " références de départ).");
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
