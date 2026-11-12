import { inferPinterestFeatures, isMenswearPin } from "./outfits.js";

const FEATURE_FIELDS = ["styleTags", "colors", "materials", "cuts", "patterns", "details", "paletteTags", "categories"];

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
    const url = new URL(String(value).trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch (error) { return ""; }
}
export function inferProductGender(source) {
  const item = source || {};
  const audience = item.audience && typeof item.audience === "object"
    ? [item.audience.name, item.audience.suggestedGender, item.audience.genderType].filter(Boolean).join(" ")
    : item.audience;
  const evidence = normalizeText([
    audience, item.name, item.title, item.description,
    item.category, item.objective, item.url, item.productUrl
  ].filter(Boolean).join(" "));
  const declared = normalizeText(item.gender);
  const women = /(^|[^a-z])(femme|femmes|woman|women|womens|female|girl|girls|ladies|damen|feminin)([^a-z]|$)/.test(evidence) ||
    /pour femme|for women|womenswear|collection femme/.test(evidence) || declared === "women";
  const men = /(^|[^a-z])(homme|hommes|man|men|mens|masculin|male)([^a-z]|$)/.test(evidence) ||
    /pour homme|for men|menswear|collection homme/.test(evidence) ||
    (declared === "men" && item.genderVerified === true);
  const unisex = /(^|[^a-z])(unisexe|unisex|mixte)([^a-z]|$)/.test(evidence) ||
    /gender.?neutral|tous les genres|all genders/.test(evidence) || declared === "unisex";
  if (unisex || (women && men)) return "unisex";
  if (women) return "women";
  if (men) return "men";
  return "unknown";
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
      objective: "Vêtements", style: "Tous", season: seasonFor(new Date()), maxPrice: null,
      communitySharing: false, aiAgentConsent: false, aiAgentAutoRefresh: false, discoveryLevel: 30, trainingDiscoveryLevel: 75, discoveryView: "cards", savedFilters: [], wardrobeFilters: { objective: "Tout", style: "Tous", season: "Toute saison", maxPrice: null }, wardrobeSort: "recent",
      outfitFilters: { styles: [], season: "Toute saison", maxPrice: null }, outfitLibraryView: "discover"
    },
    products: Array.isArray(products) ? products : [],
    likedProducts: [], removedFavorites: [], savedOutfits: [],
    interactions: { likes: [], dislikes: [], views: [], saves: [], undoEvents: [] },
    learnedPreferences: {}, inspirations: [], outfitFeedback: {},
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
  const gender = inferProductGender(source);
  return {
    id: id, name: name, brand: brand, merchant: merchant, url: url, imageUrl: imageUrl,
    gender: gender, genderVerified: gender === "men",
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
    details: arrayOf(source.details || source.designDetails),
    paletteTags: arrayOf(source.paletteTags || source.colorHarmony),
    description: text(source.description), sizes: arrayOf(source.sizes),
    availability: text(source.availability) || "Information non disponible",
    source: text(source.source) || merchant || "Import manuel",
    addedAt: text(source.addedAt) || new Date().toISOString(),
    verifiedAt: text(source.verifiedAt),
    productRating: source.productRating == null ? null : Number(source.productRating),
    productRatingCount: source.productRatingCount == null ? null : Number(source.productRatingCount),
    productRatingSource: text(source.productRatingSource),
    merchantRating: source.merchantRating == null ? null : Number(source.merchantRating),
    merchantRatingCount: source.merchantRatingCount == null ? null : Number(source.merchantRatingCount),
    merchantRatingSource: text(source.merchantRatingSource),
    popularityScore: source.popularityScore == null || source.popularityScore === "" ? null : Number(source.popularityScore),
    isBestSeller: source.isBestSeller === true || source.isBestSeller === 1 || source.isBestSeller === "true",
    sourceType: text(source.sourceType),
    feedId: text(source.feedId),
    advertiserId: text(source.advertiserId),
    feedLastImported: text(source.feedLastImported),
    syncedAt: text(source.syncedAt),
    priceUpdatedAt: text(source.priceUpdatedAt),
    stockVerifiedAt: text(source.stockVerifiedAt),
    availabilityStatus: text(source.availabilityStatus),
    catalogStatus: text(source.catalogStatus) || "active",
    expiresAt: text(source.expiresAt)
  };
}

export function productIdentity(product) {
  const normalized = normalizeProduct(product);
  return normalized.url ? normalized.url.split("?")[0].replace(/\/+$/, "").toLowerCase() : normalized.id;
}

export function productCommunityToken(product) {
  const normalized = normalizeProduct(product);
  if (!normalized.url || !["public-web", "curated"].includes(normalized.sourceType)) return "";
  const identity = productIdentity(normalized);
  return "item:" + hash("dressopp-public-item-a:" + identity) + hash("dressopp-public-item-b:" + identity);
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

function productFeatureValues(product) {
  const inferred = inferPinterestFeatures({
    title:product.name,
    name:product.name,
    description:product.description,
    category:product.category,
    objective:product.objective,
    styleTags:product.styleTags,
    colors:product.colors,
    materials:product.materials,
    cuts:product.cuts,
    patterns:product.patterns,
    details:product.details,
    paletteTags:product.paletteTags
  });
  const result = {};
  ["styleTags","colors","materials","cuts","patterns","details","paletteTags"].forEach(function(field) {
    result[field] = Array.from(new Set([...(product[field] || []),...(inferred[field] || [])].map(text).filter(Boolean)));
  });
  result.categories = [product.objective || product.category].filter(Boolean);
  return result;
}
function featureTokens(product) {
  const tokens = [];
  const features = productFeatureValues(product);
  FEATURE_FIELDS.forEach(function(field) {
    const values = features[field] || [];
    values.forEach(function(value) { if (text(value)) tokens.push(field + ":" + normalizeText(value)); });
  });
  if (product.brand) tokens.push("brand:" + normalizeText(product.brand));
  return Array.from(new Set(tokens));
}
const PIN_FEATURE_WEIGHTS = {
  styleTags:3.4, colors:3.8, materials:2.1, cuts:4.3,
  patterns:4.2, details:2.8, paletteTags:3.2
};
const ACCENT_COLORS = new Set([
  "rose","rose pale","rose vif","fuchsia","bordeaux","rouge","rouge cerise",
  "bleu ciel","bleu cobalt","bleu electrique","vert","vert foret","vert sauge",
  "vert emeraude","olive","jaune","jaune beurre","orange","orange brule","violet","lilas","lavande","prune"
]);
const MODERN_CUTS = new Set([
  "oversized","oversize","boxy","wide leg","jambe large","baggy","barrel leg",
  "jambe ballon","cropped","court","taille basse","over fit","over-fit","flared","flare","balloon leg"
]);
const STATEMENT_STYLES = new Set(["creatif","streetwear","vintage","avant garde","eclectique","sport heritage","retro sport","maille graphique"]);
function pinterestAffinityScore(product,state) {
  const productFeatures = productFeatureValues(product);
  const pins = (state.inspirations || []).concat(state.pinterestPins || []).filter(isMenswearPin);
  if (!pins.length) return 0;
  const pinScores = pins.map(function(pin) {
    const features = inferPinterestFeatures(pin);
    let score = 0;
    Object.entries(PIN_FEATURE_WEIGHTS).forEach(function(entry) {
      const field = entry[0];
      const pinValues = Array.from(new Set((features[field] || []).map(normalizeText)));
      const productValues = new Set((productFeatures[field] || []).map(normalizeText));
      if (!pinValues.length) return;
      const matches = pinValues.filter(function(value) { return productValues.has(value); });
      const denominator = Math.min(2,pinValues.length);
      score += entry[1] * Math.min(1,matches.length / denominator);
    });
    return score;
  }).filter(score => score > 0).sort((a,b) => b-a);
  if (!pinScores.length) return 0;
  const best = pinScores[0];
  const next = pinScores.slice(1,3);
  const consistency = next.length ? next.reduce((sum,value) => sum + value,0) / next.length : 0;
  return best * .82 + consistency * .38;
}
function pinterestExpressionBoost(product) {
  const features = productFeatureValues(product);
  let score = 0;
  const accent = (features.colors || []).some(value => ACCENT_COLORS.has(normalizeText(value)));
  const pattern = (features.patterns || []).some(value => normalizeText(value) !== "uni");
  const modernCut = (features.cuts || []).some(value => MODERN_CUTS.has(normalizeText(value)));
  const statementStyle = (features.styleTags || []).some(value => STATEMENT_STYLES.has(normalizeText(value)));
  const designDetail = (features.details || []).length > 0;
  if (accent) score += 2.2;
  if (pattern) score += 2.4;
  if (modernCut) score += 3.0;
  if (statementStyle) score += 2.0;
  if (designDetail) score += Math.min(2.0,features.details.length * .6);
  return Math.min(9,score);
}
function basicItemPenalty(product) {
  const textValue = normalizeText([product.name,product.description].join(" "));
  if (!/(^|[^a-z])(basique|basic|essentiel|essential)([^a-z]|$)/.test(textValue)) return 0;
  const features = productFeatureValues(product);
  const hasVisualInterest = (features.colors || []).some(value => ACCENT_COLORS.has(normalizeText(value))) ||
    (features.cuts || []).some(value => MODERN_CUTS.has(normalizeText(value))) ||
    (features.patterns || []).some(value => normalizeText(value) !== "uni") ||
    (features.details || []).length > 0;
  return hasVisualInterest ? 0 : -6;
}

export function deriveLearnedPreferences(state) {
  const source = state || {};
  const totals = {};
  const interactions = source.interactions || { likes: [], dislikes: [] };
  (interactions.likes || []).forEach(function(item) {
    const product = (source.products || []).find(function(candidate) { return candidate.id === item.productId; });
    if (product) featureTokens(product).forEach(function(token) { totals[token] = (totals[token] || 0) + 3; });
  });
  (interactions.dislikes || []).forEach(function(item) {
    const product = (source.products || []).find(function(candidate) { return candidate.id === item.productId; });
    if (product) featureTokens(product).forEach(function(token) { totals[token] = (totals[token] || 0) - 4; });
  });

  const pins = (source.inspirations || []).concat(source.pinterestPins || []).filter(isMenswearPin);
  const pinsById = new Map();
  pins.forEach(function(pin) {
    const id = String(pin.pinId || pin.id || pin.sourceUrl || pin.pinUrl || "");
    if (id) pinsById.set(id, pin);
    const features = inferPinterestFeatures(pin);
    const confidence = Number.isFinite(Number(pin.visualAnalysis && pin.visualAnalysis.confidence))
      ? Math.max(.65,Math.min(1,Number(pin.visualAnalysis.confidence))) : .85;
    Object.entries(features).forEach(function(entry) {
      const fieldWeight = PIN_FEATURE_WEIGHTS[entry[0]] || 2.5;
      entry[1].forEach(function(value) {
        const token = entry[0] + ":" + normalizeText(value);
        const accentMultiplier = entry[0] === "colors" && ACCENT_COLORS.has(normalizeText(value)) ? 1.2 : 1;
        totals[token] = (totals[token] || 0) + fieldWeight * confidence * accentMultiplier;
      });
    });
    (pin.tags || []).forEach(function(value) {
      const token = "styleTags:" + normalizeText(value);
      totals[token] = (totals[token] || 0) + 2.5;
    });
  });

  Object.entries(source.outfitFeedback && typeof source.outfitFeedback === "object" ? source.outfitFeedback : {}).forEach(function(entry) {
    const pin = pinsById.get(String(entry[0]));
    const vote = entry[1] && entry[1].vote;
    if (!pin || (vote !== "yes" && vote !== "no")) return;
    const weight = vote === "yes" ? 5 : -6;
    const features = inferPinterestFeatures(pin);
    Object.entries(features).forEach(function(feature) {
      feature[1].forEach(function(value) {
        const token = feature[0] + ":" + normalizeText(value);
        totals[token] = (totals[token] || 0) + weight;
      });
    });
    (pin.tags || []).forEach(function(value) {
      const token = "styleTags:" + normalizeText(value);
      totals[token] = (totals[token] || 0) + weight;
    });
  });

  return totals;
}

function explicitProfileScore(product, profile) {
  const values = profile || {};
  let score = 0;
  const features = productFeatureValues(product);
  const comparisons = [
    [features.colors, values.preferredColors, 10],
    [features.materials, values.preferredMaterials, 9],
    [features.cuts, values.preferredCuts, 10],
    [features.styleTags, values.preferredStyles, 8],
    [features.patterns, values.preferredPatterns, 8],
    [features.paletteTags, values.preferredPalettes, 7],
    [[product.brand], values.favoriteBrands, 7]
  ];
  comparisons.forEach(function(entry) {
    const left = (entry[0] || []).map(normalizeText);
    const right = (entry[1] || []).map(normalizeText);
    if (left.some(function(item) { return right.includes(item); })) score += entry[2];
  });
  const negative = [
    [features.colors, values.excludedColors], [features.materials, values.excludedMaterials],
    [features.cuts, values.excludedCuts], [features.patterns, values.excludedPatterns],
    [[product.brand], values.excludedBrands]
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
    (state.likedProducts || []).forEach(function(item) { seen.add(item.productId); });
  }
  const profile = state.profile || {};
  function sizeMatches(product) {
    const suppliedSizes = (product.sizes || []).map(normalizeText);
    if (!suppliedSizes.length) return true;
    const categoryText = normalizeText([product.name, product.category, product.objective].join(" "));
    let preferredSize = "";
    if (normalizeText(product.objective || product.category).includes("chauss")) preferredSize = profile.sizes && profile.sizes.shoes;
    else if (/pantalon|jean|short|jupe|bas/.test(categoryText)) preferredSize = profile.sizes && profile.sizes.bottoms;
    else if (/veste|manteau|blouson|outerwear/.test(categoryText)) preferredSize = profile.sizes && profile.sizes.outerwear;
    else if (/sous|boxer|slip|chaussette|underwear/.test(categoryText)) preferredSize = profile.sizes && profile.sizes.underwear;
    else preferredSize = profile.sizes && profile.sizes.tops;
    if (!text(preferredSize)) return true;
    const wanted = normalizeText(preferredSize).replace(/^(eu|fr|uk|us)\s*/, "");
    return suppliedSizes.some(function(size) {
      return size === normalizeText(preferredSize) ||
        size.replace(/^(eu|fr|uk|us)\s*/, "") === wanted ||
        (wanted.length >= 2 && size.includes(wanted));
    });
  }
  function freshnessBoost(product) {
    const verified = Date.parse(product.verifiedAt || product.syncedAt || product.stockVerifiedAt || "");
    if (!Number.isFinite(verified)) return 0;
    const ageHours = Math.max(0, (Date.now() - verified) / 3600000);
    if (ageHours <= 6) return 8;
    if (ageHours <= 24) return 6;
    if (ageHours <= 72) return 3;
    if (ageHours <= 168) return 0;
    return -Math.min(12, Math.floor(ageHours / 168) * 2);
  }
  function reviewBoost(product) {
    const rating = Number(product.productRating);
    if (!Number.isFinite(rating) || rating <= 0 || rating > 5) return 0;
    const count = Number(product.productRatingCount) || 0;
    return (rating - 3) * 1.5 + (count >= 100 ? 3 : count >= 20 ? 1.5 : 0);
  }
  function merchantTrustBoost(product) {
    const rating = Number(product.merchantRating);
    if (!Number.isFinite(rating) || rating <= 0 || rating > 5) return 0;
    const count = Number(product.merchantRatingCount) || 0;
    const ratingSignal = (rating - 3.5) * 1.5;
    const confidenceSignal = count >= 500 ? 2 : count >= 100 ? 1.2 : count >= 20 ? 0.5 : 0;
    return Math.max(-3, Math.min(4, ratingSignal + confidenceSignal));
  }
  function popularityBoost(product) {
    const raw = Number(product.popularityScore);
    const measured = Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) / 40 : 0;
    return Math.min(2.5, measured) + (product.isBestSeller ? 1.25 : 0);
  }
  function communityBoost(product) {
    const signals = opts.communitySignals || {};
    const features = featureTokens(product);
    let score = 0;
    features.forEach(function(token) {
      score += (signals.positive && signals.positive[token] || 0) * 1.8;
      score -= (signals.negative && signals.negative[token] || 0) * 2.2;
    });
    const itemToken = productCommunityToken(product);
    if (itemToken) {
      score += (signals.positiveItems && signals.positiveItems[itemToken] || 0) * 4;
      score -= (signals.negativeItems && signals.negativeItems[itemToken] || 0) * 5;
    }
    return Math.max(-14, Math.min(14, score));
  }
  const scored = (products || []).filter(function(product) {
    const expired = product.catalogStatus === "expired" ||
      (product.expiresAt && Date.parse(product.expiresAt) <= Date.now());
    const stale = product.catalogStatus === "stale";
    const unavailable = product.availabilityStatus === "out_of_stock";
    return product.gender === "men" && product.genderVerified !== false && !expired && !stale && !unavailable && sizeMatches(product) &&
      matchesFilters(product, opts.filters || config) && !seen.has(product.id);
  }).map(function(product) {
    const familiarity = preferenceScore(product, learned) + explicitProfileScore(product, profile);
    const novelty = noveltyScore(product, learned);
    const baseScore = familiarity * (1 - discovery / 100) + novelty * (discovery / 100) * (training ? 1.25 : 1);
    const PinterestFit = pinterestAffinityScore(product,state);
    const visualInterest = pinterestExpressionBoost(product);
    const basicPenalty = basicItemPenalty(product);
    const score = baseScore + PinterestFit + visualInterest + basicPenalty + freshnessBoost(product) + reviewBoost(product) +
      merchantTrustBoost(product) + popularityBoost(product) + communityBoost(product);
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
