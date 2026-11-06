import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const CONFIG = resolve(ROOT, "data/public-sources.json");
const CATALOG = resolve(ROOT, "data/catalog.json");
const META = resolve(ROOT, "data/catalog-meta.json");
const SEEDS = resolve(ROOT, "data/catalog-seeds.json");
const BOT = "DRESSOPPBot";
const UA = "DRESSOPPBot/1.0 (+https://sopp24.github.io/DRESSOPP/)";
const TTL = 7 * 86400000;
const MAX_SITEMAPS = 6, MAX_PAGES = 18, MAX_STORE_PRODUCTS = 12, MAX_TOTAL = 2400;
const GAP = 700, lastRequest = new Map();

const clean = value => String(value == null ? "" : value).replace(/<[^>]*>/g," ")
  .replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"')
  .replace(/&#39;|&apos;/gi,"'").replace(/&lt;/gi,"<").replace(/&gt;/gi,">")
  .replace(/\s+/g," ").trim();
const list = value => value == null ? [] : Array.isArray(value) ? value : [value];
const host = value => String(value || "").toLowerCase().replace(/^www\./,"");
const belongs = (candidate, root) => host(candidate) === host(root) || host(candidate).endsWith("." + host(root));
function hash(value) {
  let h = 2166136261;
  for (const char of String(value)) { h ^= char.charCodeAt(0); h = Math.imul(h,16777619); }
  return (h >>> 0).toString(36);
}
function safePage(value, base, domain) {
  try {
    const url = new URL(String(value || ""),base);
    if (url.protocol !== "https:" || url.username || url.password || !belongs(url.hostname,domain)) return null;
    url.hash = ""; return url;
  } catch { return null; }
}
function safeImage(value, base) {
  if (!value) return "";
  try { const url = new URL(String(value),base); return url.protocol === "https:" ? url.href : ""; }
  catch { return ""; }
}
function pathScore(path) {
  const p = String(path || "").toLowerCase();
  return (/\/products?\//.test(p) ? 5 : 0) + (/\/p\/|\/prd\/|\/product\/|\/item\/|\/dp\//.test(p) ? 4 : 0) +
    (/-\d{5,}(?:\.html?)?(?:$|[/?])/.test(p) ? 3 : 0) + (/\.html?(?:$|[/?])/.test(p) ? 2 : 0);
}
export function parseRobots(text) {
  const groups = [];
  let current = null;
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (!match) continue;
    const key = match[1].trim().toLowerCase();
    const value = match[2].trim();
    if (key === "user-agent") {
      if (!current || current.hasRules) {
        current = { agents: [], rules: [], sitemaps: [], hasRules: false };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if (key === "allow" || key === "disallow") {
      if (current) {
        current.hasRules = true;
        if (value) current.rules.push({ allow: key === "allow", path: value });
      }
    } else if (key === "sitemap" && value) {
      if (current) current.sitemaps.push(value);
      else groups.push({ agents: [], rules: [], sitemaps: [value], hasRules: false });
    }
  }

  const exact = groups.filter(group => group.agents.some(agent =>
    agent !== "*" && BOT.toLowerCase().startsWith(agent)
  ));
  const selected = exact.length ? exact : groups.filter(group => group.agents.includes("*"));
  return {
    rules: selected.flatMap(group => group.rules),
    sitemaps: Array.from(new Set(groups.flatMap(group => group.sitemaps)))
  };
}

function ruleMatch(pattern, path) {
  const value = String(pattern || "");
  const anchored = value.endsWith("$");
  const body = anchored ? value.slice(0, -1) : value;
  let expression = "";
  for (const character of body) {
    if (character === "*") expression += ".*";
    else if (character === "$") expression += "\\$";
    else if (/[.+?^()|[\]\\]/.test(character)) expression += "\\" + character;
    else expression += character;
  }
  try {
    return new RegExp("^" + expression + (anchored ? "$" : "")).test(String(path || ""));
  } catch {
    return false;
  }
}
export function robotsAllows(path, robots) {
  let best = null;
  for (const rule of (robots && robots.rules) || []) {
    if (!ruleMatch(rule.path,path)) continue;
    const length = rule.path.replace(/\*/g,"").replace(/\$$/,"").length;
    if (!best || length > best.length || (length === best.length && rule.allow)) best = { ...rule, length };
  }
  return !best || best.allow;
}
function meta(html,name) {
  const tags = String(html || "").match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const property = (tag.match(/\b(?:property|name)\s*=\s*["']([^"']+)["']/i) || [])[1];
    if (String(property || "").toLowerCase() === name.toLowerCase()) return clean((tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i) || [])[1] || "");
  }
  return "";
}
function flattenProducts(value) {
  if (Array.isArray(value)) return value.flatMap(flattenProducts);
  if (!value || typeof value !== "object") return [];
  const type = list(value["@type"]).map(item => String(item).split(/[\/#]/).pop().toLowerCase());
  const found = type.includes("product") ? [value] : [];
  return found.concat(flattenProducts(value["@graph"]),flattenProducts(value.mainEntity),flattenProducts(value.itemListElement),flattenProducts(value.item));
}
function productRecord(item,source,pageUrl,checkedAt) {
  const offers = list(item.offers).flatMap(offer => offer && Array.isArray(offer.offers) ? offer.offers : [offer]).filter(Boolean);
  const offer = offers.find(value => value.price != null || value.lowPrice != null || value.priceSpecification) || {};
  const spec = offer.priceSpecification || {};
  const currency = String(offer.priceCurrency || spec.priceCurrency || "").toUpperCase();
  const price = Number(String(offer.price || offer.lowPrice || spec.price || "").replace(",","."));
  const availability = String(offer.availability || "").toLowerCase();
  if (!item.name || currency !== "EUR" || !Number.isFinite(price) || price <= 0 || /outofstock|soldout|discontinued/.test(availability)) return null;
  const page = safePage(item.url || pageUrl,pageUrl,source.domain);
  const imageValue = list(item.image)[0];
  const image = safeImage(typeof imageValue === "string" ? imageValue : imageValue && (imageValue.url || imageValue.contentUrl),pageUrl);
  if (!page || !image) return null;
  const name = clean(item.name); if (!name || name.length > 220) return null;
  const brand = clean(item.brand && item.brand.name || item.brand || source.name);
  const description = clean(item.description || "").slice(0,900);
  const terms = name + " " + description + " " + brand;
  const categoryTerms = String(item.category || "") + " " + terms;
  const category = /sneaker|chauss|basket|boot|bottine|sandale|mocassin/i.test(categoryTerms) ? "Chaussures"
    : /underwear|boxer|brief|slip|sous-vêtement|lingerie|chaussette/i.test(categoryTerms) ? "Sous-vêtements"
    : /bag|wallet|belt|sac|portefeuille|ceinture|casquette|montre|accessoir/i.test(categoryTerms) ? "Accessoires"
    : /pantalon|jean|trouser/i.test(categoryTerms) ? "Pantalon"
    : /pull|sweater|cardigan|hoodie/i.test(categoryTerms) ? "Pull" : "Vêtements";
  const rules = [
    ["Preppy",/\b(oxford|rugby|polo|college|varsity|chino|torsad[eé])\b/i],
    ["Smart Casual",/\b(merino|m[eé]rinos|tailored|blazer|laine|chemise)\b/i],
    ["Heritage",/\b(heritage|tweed|corduroy|daim|su[eè]de|jacquard)\b/i],
    ["Streetwear",/\b(oversize|oversized|cargo|hoodie|sneaker|streetwear|baggy)\b/i],
    ["Sport",/\b(running|training|sport|basket|fitness|performance)\b/i],
    ["Workwear",/\b(workwear|utility|carpenter|canvas|chore)\b/i],
    ["Vintage",/\b(vintage|r[eé]tro|washed|d[eé]lav[eé])\b/i],
    ["Classique",/\b(classique|regular|droit|minimal|essentiel|basique)\b/i]
  ];
  const checked = new Date(checkedAt).toISOString();
  const rating = Number(item.aggregateRating && item.aggregateRating.ratingValue);
  const aggregate = item.aggregateRating || {};
  return {
    id:"web-" + hash(page.href.split("?")[0].toLowerCase()), name, brand, merchant:source.name,
    url:page.href, imageUrl:image, price, originalPrice:Number(offer.highPrice) || null,
    objective:category, category:clean(item.category) || category,
    styleTags:rules.filter(([,pattern]) => pattern.test(terms)).map(([label]) => label),
    seasonTags:[], colors:list(item.color).map(clean).filter(Boolean), materials:list(item.material).map(clean).filter(Boolean),
    cuts:[], patterns:[], description, sizes:list(item.size).map(clean).filter(Boolean),
    availability:/instock|limitedavailability/.test(availability) ? "En stock lors du dernier contrôle" : "Disponibilité à confirmer sur la boutique",
    availabilityStatus:/instock|limitedavailability/.test(availability) ? "available" : "unknown",
    source:source.name, sourceType:"public-web", catalogStatus:"active",
    verifiedAt:checked, syncedAt:checked, priceUpdatedAt:checked, stockVerifiedAt:checked,
    expiresAt:new Date(Date.parse(checked) + TTL).toISOString(),
    productRating:Number.isFinite(rating) && rating > 0 && rating <= 5 ? rating : null,
    productRatingCount:Number(aggregate.reviewCount || aggregate.ratingCount) || null,
    productRatingSource:Number.isFinite(rating) ? "Avis produit · fiche officielle" : "",
    merchantRating:null, merchantRatingCount:null, merchantRatingSource:"",
    popularityScore:null, isBestSeller:false
  };
}
export function extractProductsFromHtml(html,source,pageUrl,checkedAt = new Date().toISOString()) {
  const products = [], scripts = String(html || "").match(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const block of scripts) {
    const raw = block.replace(/^<script\b[^>]*>/i,"").replace(/<\/script>$/i,"").trim();
    try { for (const item of flattenProducts(JSON.parse(raw))) { const product = productRecord(item,source,pageUrl,checkedAt); if (product) products.push(product); } }
    catch { /* Passer les blocs structurés mal formés. */ }
  }
  if (products.length) return products;
  const title = meta(html,"og:title"), image = safeImage(meta(html,"og:image"),pageUrl);
  const price = Number(meta(html,"product:price:amount"));
  if (meta(html,"og:type") === "product" && title && image && meta(html,"product:price:currency").toUpperCase() === "EUR" && price > 0) {
    const checked = new Date(checkedAt).toISOString();
    products.push({
      id:"web-" + hash(pageUrl), name:title, brand:meta(html,"product:brand") || source.name, merchant:source.name,
      url:pageUrl, imageUrl:image, price, originalPrice:null, objective:"Vêtements", category:"Vêtements",
      styleTags:[], seasonTags:[], colors:[], materials:[], cuts:[], patterns:[], description:meta(html,"og:description"), sizes:[],
      availability:"Disponibilité à confirmer sur la boutique", availabilityStatus:"unknown",
      source:source.name, sourceType:"public-web", catalogStatus:"active", verifiedAt:checked, syncedAt:checked,
      priceUpdatedAt:checked, stockVerifiedAt:checked, expiresAt:new Date(Date.parse(checked) + TTL).toISOString(),
      productRating:null, productRatingCount:null, productRatingSource:"", merchantRating:null,
      merchantRatingCount:null, merchantRatingSource:"", popularityScore:null, isBestSeller:false
    });
  }
  return products;
}
function getLocs(xml) { return Array.from(String(xml || "").matchAll(/<loc>\s*([\s\S]*?)\s*<\/loc>/gi),m => m[1].trim().replace(/&amp;/g,"&")); }
function links(html,page,domain) {
  const anchors = String(html || "").match(/<a\b[^>]*href\s*=\s*["'][^"']+["'][^>]*>/gi) || [];
  return Array.from(new Set(anchors.map(anchor => {
    const href = (anchor.match(/\bhref\s*=\s*["']([^"']+)["']/i) || [])[1];
    const url = safePage(href,page,domain); return url ? url.href : "";
  }).filter(Boolean)));
}
async function request(url,timeout = 15000) {
  const currentHost = new URL(url).hostname;
  const wait = GAP - (Date.now() - (lastRequest.get(currentHost) || 0));
  if (wait > 0) await new Promise(resolve => setTimeout(resolve,wait));
  lastRequest.set(currentHost,Date.now());
  const response = await fetch(url,{
    headers:{"user-agent":UA,accept:"text/html,application/xml,text/plain;q=0.9,*/*;q=0.4"},
    redirect:"follow",signal:AbortSignal.timeout(timeout)
  });
  if (!response.ok) throw new Error("HTTP " + response.status);
  return { text:await response.text(), url:new URL(response.url || url) };
}
async function robotsFor(source,base) {
  try {
    const result = await request(new URL("/robots.txt",base).href,9000);
    return belongs(result.url.hostname,source.domain) ? parseRobots(result.text) : null;
  } catch (error) {
    const status = Number((String(error.message).match(/HTTP (\d+)/) || [])[1] || 0);
    if (status >= 400 && status < 500 && ![401,403,429].includes(status)) return {rules:[],sitemaps:[]};
    return null;
  }
}
function safeAllowed(value,base,source,robots) {
  const url = safePage(value,base,source.domain);
  return url && robotsAllows(url.pathname + url.search,robots) ? url : null;
}
async function scan(source) {
  const base = new URL("https://" + source.domain + "/"), robots = await robotsFor(source,base);
  if (!robots) return {name:source.name,status:"blocked",products:[],pages:0,reason:"robots.txt inaccessible ou accès refusé"};
  const sitemapQueue = (robots.sitemaps.length ? robots.sitemaps : [new URL("/sitemap.xml",base).href,new URL("/sitemap_index.xml",base).href]).slice(0,MAX_SITEMAPS);
  const seen = new Set(), urls = new Set();
  while (sitemapQueue.length && seen.size < MAX_SITEMAPS) {
    const map = safeAllowed(sitemapQueue.shift(),base,source,robots); if (!map || seen.has(map.href)) continue;
    seen.add(map.href);
    try {
      const result = await request(map.href);
      if (!belongs(result.url.hostname,source.domain)) continue;
      const found = getLocs(result.text);
      if (/<sitemapindex\b/i.test(result.text)) {
        for (const child of found) if (sitemapQueue.length + seen.size < MAX_SITEMAPS) sitemapQueue.push(child);
      } else found.forEach(url => { if (safeAllowed(url,base,source,robots)) urls.add(url); });
    } catch { /* Continuer même si un sitemap est indisponible. */ }
  }
  let pages = 0; const categoryUrls = new Set();
  const home = safeAllowed(base.href,base,source,robots);
  if (home) {
    try {
      const result = await request(home.href); pages++;
      for (const link of links(result.text,result.url.href,source.domain)) {
        const path = new URL(link).pathname;
        if (pathScore(path) >= 3) urls.add(link);
        else if (/homme|men|femme|women|chauss|sneaker|vetement|clothing|collection|accessoire|underwear|lingerie/i.test(path)) categoryUrls.add(link);
      }
    } catch { /* Le sitemap peut suffire. */ }
  }
  for (const category of Array.from(categoryUrls).slice(0,2)) {
    if (urls.size >= MAX_PAGES * 2) break;
    const page = safeAllowed(category,base,source,robots); if (!page) continue;
    try {
      const result = await request(page.href); pages++;
      links(result.text,result.url.href,source.domain).filter(link => pathScore(new URL(link).pathname) >= 3).forEach(link => urls.add(link));
    } catch { /* Ignorer une catégorie inaccessible. */ }
  }
  const candidates = Array.from(urls).sort((a,b) => pathScore(b) - pathScore(a)).slice(0,MAX_PAGES);
  const products = [];
  for (const candidate of candidates) {
    const page = safeAllowed(candidate,base,source,robots); if (!page) continue;
    try {
      const result = await request(page.href);
      if (!belongs(result.url.hostname,source.domain)) continue;
      pages++;
      products.push(...extractProductsFromHtml(result.text,source,result.url.href));
      if (products.length >= MAX_STORE_PRODUCTS) break;
    } catch { /* Reprise au prochain passage quotidien. */ }
  }
  const unique = Array.from(new Map(products.map(p => [p.url.split("?")[0],p])).values()).slice(0,MAX_STORE_PRODUCTS);
  return {name:source.name,status:unique.length ? "ok" : pages ? "no-structured-products" : "unavailable",products:unique,pages,reason:unique.length ? "" : "Aucune fiche produit publique exploitable."};
}
async function readJson(path,fallback) { try { return JSON.parse(await readFile(path,"utf8")); } catch { return fallback; } }
async function writeJson(path,value) {
  const output = JSON.stringify(value,null,2) + "\n";
  if ((await readFile(path,"utf8").catch(() => "")) === output) return;
  await mkdir(dirname(path),{recursive:true}); await writeFile(path,output,"utf8");
}
export function mergeCatalog(previous,seeds,results,now = new Date()) {
  const products = new Map();
  const identity = item => { try { return new URL(item.url).href.split("?")[0].replace(/\/+$/,"").toLowerCase(); } catch { return item.id; } };
  (previous || []).filter(p => p && p.sourceType === "public-web" && p.url).forEach(p => products.set(identity(p),{...p}));
  (seeds || []).filter(p => p && p.url).forEach(p => { if (!products.has(identity(p))) products.set(identity(p),p); });
  (results || []).forEach(result => (result.products || []).forEach(p => products.set(identity(p),p)));
  for (const [id,p] of products.entries()) {
    if (p.sourceType !== "public-web") continue;
    const verified = Date.parse(p.verifiedAt || "");
    products.set(id,{...p,catalogStatus:!Number.isFinite(verified) || now.getTime() - verified > TTL ? "stale" : "active"});
  }
  const items = Array.from(products.values()).slice(0,MAX_TOTAL);
  const fresh = items.filter(p => p.sourceType === "public-web" && p.catalogStatus === "active");
  return {
    products:items,
    meta:{
      schemaVersion:2,provider:"Pages produits publiques autorisées (Schema.org / Open Graph)",
      status:fresh.length ? (results.some(r => ["blocked","error","unavailable"].includes(r.status)) ? "partial" : "connected") : "needs-configuration",
      syncedAt:now.toISOString(),productCount:items.length,liveProductCount:fresh.length,publicProductCount:fresh.length,
      curatedProductCount:items.filter(p => p.sourceType !== "public-web").length,staleProductCount:items.filter(p => p.catalogStatus === "stale").length,
      sourceCount:results.filter(r => r.status === "ok").length,attemptedSourceCount:results.length,
      pagesChecked:results.reduce((n,r) => n + (r.pages || 0),0),
      sources:Array.from(new Set(fresh.map(p => p.merchant || p.source))).sort(),
      sourceResults:results.map(r => ({name:r.name,status:r.status,products:r.products.length,pages:r.pages,reason:r.reason || ""})),
      refreshCadence:"Actualisation quotidienne gratuite via GitHub Actions.",
      notes:[
        "Aucun compte éditeur, réseau d'affiliation, API payante ou abonnement requis.",
        "Le robot respecte robots.txt et n'accède qu'aux pages publiques autorisées.",
        "Prix EUR, lien produit HTTPS et image HTTPS obligatoires.",
        "Prix et stock datés : vérification finale sur la boutique avant achat.",
        "Les notes produit ne sont jamais présentées comme une note de fiabilité du marchand."
      ]
    }
  };
}
export async function main() {
  const config = await readJson(CONFIG,{sources:[]}), sources = Array.isArray(config.sources) ? config.sources : [];
  if (!sources.length) throw new Error("Aucune boutique configurée dans data/public-sources.json.");
  console.log("[DRESSOPP] " + sources.length + " boutiques configurées ; robots.txt respecté.");
  const results = []; let cursor = 0;
  async function worker() {
    while (cursor < sources.length) {
      const source = sources[cursor++];
      try {
        const result = await scan(source); results.push(result);
        console.log("[DRESSOPP] " + result.name + " : " + result.status + ", " + result.products.length + " produit(s), " + result.pages + " page(s).");
      } catch (error) {
        results.push({name:source.name,status:"error",products:[],pages:0,reason:error.message || String(error)});
        console.log("[DRESSOPP] " + source.name + " : " + (error.message || String(error)));
      }
    }
  }
  await Promise.all(Array.from({length:4},worker));
  const previous = await readJson(CATALOG,{products:[]}), seeds = await readJson(SEEDS,{products:[]});
  const merged = mergeCatalog(previous.products || [],seeds.products || [],results);
  await writeJson(CATALOG,{schemaVersion:2,description:"Catalogue multi-boutiques DRESSOPP : pages officielles publiques autorisées et références éditoriales vérifiées.",syncedAt:merged.meta.syncedAt,products:merged.products});
  await writeJson(META,merged.meta);
  console.log("[DRESSOPP] " + merged.meta.liveProductCount + " fiche(s) publiques actives ; " + merged.meta.curatedProductCount + " référence(s) éditoriale(s).");
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error("::error::" + error.message); process.exitCode = 1; });
}
