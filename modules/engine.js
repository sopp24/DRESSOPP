import { inferPinterestFeatures } from "./outfits.js";

const FEATURE_FIELDS = ["styleTags", "colors", "materials", "cuts", "patterns", "categories"];

function text(value) { return String(value == null ? "" : value).trim(); }
function normalizeText(value) { return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }
function arrayOf(value) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  if (typeof value === "string" && value.trim()) return value.split(/[,;|]/).map(text).filter(Boolean);
  return [];
}
function safeHttpUrl(value) {
  if (!value) return "";
  try {
    const url = new URL(String(value), globalThis.location ? location.href : "https://dressopp.app");
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch (error) { return ""; }
}
function hash(value) {
  let result = 2166136261;
  for (let index = 0; index < value.length; index += 1) { result ^= value.charCodeAt(index); result = Math.imul(result, 16777619); }
  return (result >>> 0).toString(36);
}

export function seasonFor(date) {
  const month = Number(new Intl.DateTimeFormat("en-US", { month: "numeric", timeZone: "Europe/Paris" }).format(date || new Date()));
  if (month === 12 || month <= 2) return "Hiver";
  if (month >= 3 && month <= 5) return "Printemps";
  if (month >= 6 && month <= 8) return "Été";
  return "Automne";
}

export function createInitialState(products) {
  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    profile: {
      sizes: { tops: "", bottoms: "", outerwear: "", shoes: "", underwear: "" },
      favoriteBrands: [], excludedBrands: [], preferredColors: [], excludedColors: [],
      preferredMaterials: [], excludedMaterials: [], preferredCuts: [], excludedCuts: [],
      preferredStyles: [], comfort: "Sans préférence", fit: "Sans préférence", notes: ""
    },
    settings: {
      objective: "Vêtements", style: "Classique", season: seasonFor(new Date()), maxPrice: 20,
      discoveryLevel: 30, trainingDiscoveryLevel: 75, discoveryView: "cards", savedFilters: [], wardrobeFilters: { objective: "Tout", style: "Tous", season: "Toute saison", maxPrice: null }, wardrobeSort: "recent"
    },
    products: Array.isArray(products) ? products : [],
    likedProducts: [], removedFavorites: [],
    interactions: { likes: [], dislikes: [], views: [], undoEvents: [] },
    learnedPreferences: {}, inspirations: [],
    integrations: {
      pinterest: { status: "manual", lastSync: null },
      zalando: { status: "catalog-only", lastSync: null },
      instagram: { status: "manual", lastSync: null }
    },
    sync: { method: "local", lastSuccessfulSync: null, lastError: null }
  };
}

export function normalizeProduct(raw) {
  const source = raw || {};
  const name = text(source.name || source.title);
  const brand = text(source.brand);
  const merchant = text(source.merchant || source.shop || source.store);
  const url = safeHttpUrl(source.url || source.productUrl || source.link);
  const imageValue = text(source.imageUrl || source.image || source.photo);
  const imageUrl = imageValue.startsWith("data:image/") ? imageValue : safeHttpUrl(imageValue);
  const canonical = url ? url.split("#")[0].replace(/\/+$/, "").toLowerCase() : "";
  const identity = canonical || [normalizeText(name), normalizeText(brand), normalizeText(merchant)].join("|");
  const suppliedPrice = source.price === "" || source.price == null ? null : Number(source.price);
  const price = Number.isFinite(suppliedPrice) && suppliedPrice >= 0 ? suppliedPrice : null;
  const id = text(source.id) || "prod-" + hash(identity);
  return {
    id: id, name: name, brand: brand, merchant: merchant, url: url, imageUrl: imageUrl,
    price: price,
    originalPrice: source.originalPrice == null || source.originalPrice === "" ? null : Number(source.originalPrice),
    objective: text(source.objective || source.category) || "Vêtements",
    category: text(source.category || source.objective) || "Vêtements",
    styleTags: arrayOf(source.styleTags || source.styles || source.style),
    seasonTags: arrayOf(source.seasonTags || source.seasons || source.season),
    colors: arrayOf(source.colors || source.color),
    materials: arrayOf(source.materials || source.material || source.composition),
    cuts: arrayOf(source.cuts || source.fit || source.silhouette),
    patterns: arrayOf(source.patterns || source.pattern),
    description: text(source.description), sizes: arrayOf(source.sizes),
    availability: text(source.availability) || "Information non disponible",
    source: text(source.source) || merchant || "Import manuel",
    addedAt: text(source.addedAt) || new Date().toISOString(),
    verifiedAt: text(source.verifiedAt),
    productRating: source.productRating == null ? null : Number(source.productRating),
    merchantRating: source.merchantRating == null ? null : Number(source.merchantRating)
  };
}

export function productIdentity(product) {
  const normalized = normalizeProduct(product);
  return normalized.url ? normalized.url.split("?")[0].replace(/\/+$/, "").toLowerCase() : normalized.id;
}

export function matchesFilters(product, filters) {
  const selected = filters || {};
  const category = text(selected.objective || "Tout");
  const style = normalizeText(selected.style || "Tous");
  const season = normalizeText(selected.season || "Toute saison");
  const maxPrice = selected.maxPrice === null || selected.maxPrice === "" ? null : Number(selected.maxPrice);
  if (category !== "Tout" && normalizeText(product.objective || product.category) !== normalizeText(category)) return false;
  if (style && style !== "tous" && product.styleTags.length && !product.styleTags.some(function(tag) { return normalizeText(tag) === style; })) return false;
  if (season && season !== "toute saison") {
    const tags = product.seasonTags.map(normalizeText);
    if (tags.length && !tags.includes("toute saison") && !tags.includes(season)) return false;
  }
  if (Number.isFinite(maxPrice) && (product.price == null || product.price > maxPrice)) return false;
  return true;
}

function featureTokens(product) {
  const tokens = [];
  FEATURE_FIELDS.forEach(function(field) {
    const values = field === "categories" ? [product.objective || product.category] : (product[field] || []);
    values.forEach(function(value) { if (text(value)) tokens.push(field + ":" + normalizeText(value)); });
  });
  if (product.brand) tokens.push("brand:" + normalizeText(product.brand));
  return tokens;
}

export function deriveLearnedPreferences(state) {
  const totals = {};
  const interactions = state && state.interactions ? state.interactions : { likes: [], dislikes: [] };
  (interactions.likes || []).forEach(function(item) {
    const product = (state.products || []).find(function(candidate) { return candidate.id === item.productId; });
    if (product) featureTokens(product).forEach(function(token) { totals[token] = (totals[token] || 0) + 3; });
  });
  (interactions.dislikes || []).forEach(function(item) {
    const product = (state.products || []).find(function(candidate) { return candidate.id === item.productId; });
    if (product) featureTokens(product).forEach(function(token) { totals[token] = (totals[token] || 0) - 4; });
  });
  (state.inspirations || []).concat(state.pinterestPins || []).forEach(function(pin) {
    const features = inferPinterestFeatures(pin);
    Object.entries(features).forEach(function(entry) {
      entry[1].forEach(function(value) {
        const token = entry[0] + ":" + normalizeText(value);
        totals[token] = (totals[token] || 0) + 1.5;
      });
    });
    (pin.tags || []).forEach(function(value) {
      const token = "styleTags:" + normalizeText(value);
      totals[token] = (totals[token] || 0) + 1.5;
    });
  });
  return totals;
}

function explicitProfileScore(product, profile) {
  const values = profile || {};
  let score = 0;
  const comparisons = [
    [product.colors, values.preferredColors, 10],
    [product.materials, values.preferredMaterials, 9],
    [product.cuts, values.preferredCuts, 10],
    [product.styleTags, values.preferredStyles, 8],
    [[product.brand], values.favoriteBrands, 7]
  ];
  comparisons.forEach(function(entry) {
    const left = (entry[0] || []).map(normalizeText);
    const right = (entry[1] || []).map(normalizeText);
    if (left.some(function(item) { return right.includes(item); })) score += entry[2];
  });
  const negative = [
    [product.colors, values.excludedColors], [product.materials, values.excludedMaterials],
    [product.cuts, values.excludedCuts], [[product.brand], values.excludedBrands]
  ];
  negative.forEach(function(entry) {
    const left = (entry[0] || []).map(normalizeText);
    const right = (entry[1] || []).map(normalizeText);
    if (left.some(function(item) { return right.includes(item); })) score -= 30;
  });
  return score;
}
function preferenceScore(product, learned) {
  return featureTokens(product).reduce(function(total, token) { return total + (learned[token] || 0); }, 0);
}
function noveltyScore(product, learned) {
  const tokens = featureTokens(product);
  if (!tokens.length) return 50;
  const known = tokens.filter(function(token) { return Math.abs(learned[token] || 0) >= 3; }).length;
  return 100 - (known / tokens.length) * 100;
}

export function rankProducts(products, state, options) {
  const opts = options || {};
  const config = state.settings || {};
  const training = Boolean(opts.training);
  const learned = deriveLearnedPreferences(state);
  const discovery = Math.max(0, Math.min(100, Number(training ? config.trainingDiscoveryLevel : config.discoveryLevel) || 0));
  const seen = new Set();
  if (!opts.includeSeen) {
    (state.interactions.likes || []).forEach(function(item) { seen.add(item.productId); });
    (state.interactions.dislikes || []).forEach(function(item) { seen.add(item.productId); });
    (state.interactions.saves || []).forEach(function(item) { seen.add(item.productId); });
  }
  const scored = (products || []).filter(function(product) {
    return matchesFilters(product, opts.filters || config) && !seen.has(product.id);
  }).map(function(product) {
    const familiarity = preferenceScore(product, learned) + explicitProfileScore(product, state.profile);
    const novelty = noveltyScore(product, learned);
    const score = familiarity * (1 - discovery / 100) + novelty * (discovery / 100) * (training ? 1.25 : 1);
    return { product: product, score: score };
  });
  scored.sort(function(a, b) { return b.score - a.score; });
  const result = [];
  const brandCounts = new Map();
  scored.forEach(function(entry) {
    const brand = normalizeText(entry.product.brand || entry.product.merchant || "sans marque");
    const count = brandCounts.get(brand) || 0;
    if (count < 2) { result.push(entry.product); brandCounts.set(brand, count + 1); }
  });
  scored.forEach(function(entry) {
    if (!result.some(function(product) { return product.id === entry.product.id; })) result.push(entry.product);
  });
  return result;
}
