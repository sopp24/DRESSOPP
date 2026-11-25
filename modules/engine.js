import { inferPinterestFeatures, isMenswearPin, inferTextFeatures, pinterestAffinity, garmentFamily, familySlot, pinGarmentFamilies } from "./outfits.js";
import { inferProductGender, inferMenFit, isMenFit, registerMenMerchants, isMenMerchant } from "./audience.js";
import { diversifyDeck, diversifyProducts, createRng, brandKey, familyKey } from "./diversify.js";

export { inferProductGender, inferMenFit, isMenFit, registerMenMerchants, isMenMerchant, diversifyDeck, diversifyProducts, createRng };

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
    const url = new URL(String(value).trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch (error) { return ""; }
}
function safeImageUrl(value) {
  const candidate = text(value);
  if (/^data:image\/(?:png|jpe?g|webp|gif|avif);base64,/i.test(candidate)) return candidate;
  if (/^\.\/assets\/product-images\/[a-z0-9_-]+\.(?:jpe?g|png|webp|avif)$/i.test(candidate)) return candidate;
  return safeHttpUrl(candidate);
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
      objective: "Vêtements", style: "Tous", season: seasonFor(new Date()), seasonAuto: true, maxPrice: null,
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
  const imageUrl = safeImageUrl(imageValue);
  const imageFallbackUrl = safeImageUrl(source.imageFallbackUrl);
  const canonical = url ? url.split("#")[0].replace(/\/+$/, "").toLowerCase() : "";
  const identity = canonical || [normalizeText(name), normalizeText(brand), normalizeText(merchant)].join("|");
  const suppliedPrice = source.price === "" || source.price == null ? null : Number(source.price);
  const price = Number.isFinite(suppliedPrice) && suppliedPrice >= 0 ? suppliedPrice : null;
  const id = text(source.id) || "prod-" + hash(identity);
  let gender = inferProductGender(source);
  const menFit = inferMenFit(source, gender);
  if (gender === "unknown" && menFit === "men") gender = "men";
  const colors = arrayOf(source.colors || source.color);
  const materials = arrayOf(source.materials || source.material || source.composition);
  const cuts = arrayOf(source.cuts || source.fit || source.silhouette);
  const patterns = arrayOf(source.patterns || source.pattern);
  const inferred = (!colors.length || !materials.length || !cuts.length || !patterns.length)
    ? inferTextFeatures([name, text(source.description)].join(" "), name) : null;
  return {
    id: id, name: name, brand: brand, merchant: merchant, url: url, imageUrl: imageUrl, imageFallbackUrl: imageFallbackUrl,
    gender: gender, genderVerified: gender === "men", menFit: menFit,
    price: price,
    originalPrice: source.originalPrice == null || source.originalPrice === "" ? null : Number(source.originalPrice),
    objective: text(source.objective || source.category) || "Vêtements",
    category: text(source.category || source.objective) || "Vêtements",
    styleTags: arrayOf(source.styleTags || source.styles || source.style),
    seasonTags: arrayOf(source.seasonTags || source.seasons || source.season),
    colors: colors.length ? colors : (inferred ? inferred.colors : []),
    materials: materials.length ? materials : (inferred ? inferred.materials : []),
    cuts: cuts.length ? cuts : (inferred ? inferred.cuts : []),
    patterns: patterns.length ? patterns : (inferred ? inferred.patterns : []),
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

const KEYWORD_STOPWORDS = new Set(["avec","pour","sans","dans","homme","hommes","mens","femme","coupe","taille","collection","nouveau","nouvelle","edition","modele","article","produit","original","classique","basique","regular","fit"]);
// Mots-clés du titre (coupe, détail, motif…) : ce que le marchand écrit vraiment sur la pièce.
function nameKeywords(name, family) {
  const seen = new Set();
  return normalizeText(name).split(/[^a-z0-9]+/).filter(function(word) {
    if (word.length < 4 || KEYWORD_STOPWORDS.has(word) || /^\d+$/.test(word)) return false;
    if (family && garmentFamily(word) === family) return false;
    if (seen.has(word)) return false;
    seen.add(word);
    return true;
  }).slice(0, 6);
}

function featureTokens(product) {
  const tokens = [];
  FEATURE_FIELDS.forEach(function(field) {
    const values = field === "categories" ? [product.objective || product.category] : (product[field] || []);
    values.forEach(function(value) { if (text(value)) tokens.push(field + ":" + normalizeText(value)); });
  });
  if (product.brand) tokens.push("brand:" + normalizeText(product.brand));
  const family = garmentFamily(text(product.name) + " " + text(product.category));
  if (family) {
    tokens.push("family:" + family);
    if (familySlot(family)) tokens.push("slot:" + familySlot(family));
  }
  nameKeywords(product.name, family).forEach(function(word) { tokens.push("kw:" + word); });
  return tokens;
}

// Poids de chaque famille de signaux : le type de pièce compte plus que la marque ou un mot isolé.
const TOKEN_WEIGHTS = { family: 2.2, slot: .7, kw: .7, brand: .5, categories: .3, patterns: .8 };
function tokenWeight(token) { return TOKEN_WEIGHTS[String(token).split(":")[0]] || 1; }

const LEARN_SCALE = 9, LEARN_PRIOR = 1.2, PIN_PRIOR_WEIGHT = .2;
const SIGNAL_STRENGTH = { like: 1.3, save: 2, dislike: 1.6 };

// Préférences apprises : chaque jeton reçoit un score entre -9 et +9 qui dépend du rapport entre « oui » et « non ».
// Le tableau Pinterest fournit le point de départ ; les swipes (les plus récents pèsent plus) le corrigent vite.
export function deriveLearnedPreferences(state) {
  const source = state || {};
  const positive = {}, negative = {};
  const add = function(map, tokens, weight) { tokens.forEach(function(token) { map[token] = (map[token] || 0) + weight; }); };
  const interactions = source.interactions || {};
  const byId = new Map((source.products || []).map(function(product) { return [product.id, product]; }));

  const events = [];
  [["like", interactions.likes], ["dislike", interactions.dislikes], ["save", interactions.saves]].forEach(function(entry) {
    (Array.isArray(entry[1]) ? entry[1] : []).forEach(function(item, index) {
      events.push({ kind: entry[0], productId: item && item.productId, at: Date.parse(item && (item.createdAt || item.addedAt) || "") || 0, order: index });
    });
  });
  events.sort(function(a, b) { return a.at - b.at || a.order - b.order; });
  const last = events.length - 1;
  events.forEach(function(event, position) {
    const product = byId.get(event.productId);
    if (!isMenFit(product)) return;
    const recency = .5 + .5 * Math.pow(.94, last - position);
    add(event.kind === "dislike" ? negative : positive, featureTokens(product), SIGNAL_STRENGTH[event.kind] * recency);
  });

  const pins = (source.inspirations || []).concat(source.pinterestPins || []).filter(isMenswearPin);
  const pinsById = new Map();
  function pinTokens(pin) {
    const tokens = [];
    Object.entries(inferPinterestFeatures(pin)).forEach(function(entry) {
      entry[1].forEach(function(value) { tokens.push(entry[0] + ":" + normalizeText(value)); });
    });
    (pin.tags || []).forEach(function(value) { tokens.push("styleTags:" + normalizeText(value)); });
    pinGarmentFamilies(pin).forEach(function(family) { tokens.push("family:" + family); if (familySlot(family)) tokens.push("slot:" + familySlot(family)); });
    return Array.from(new Set(tokens));
  }
  pins.forEach(function(pin) {
    const id = String(pin.pinId || pin.id || pin.sourceUrl || pin.pinUrl || "");
    if (id) pinsById.set(id, pin);
    add(positive, pinTokens(pin), PIN_PRIOR_WEIGHT);
  });
  Object.entries(source.outfitFeedback && typeof source.outfitFeedback === "object" ? source.outfitFeedback : {}).forEach(function(entry) {
    const pin = pinsById.get(String(entry[0]));
    const vote = entry[1] && entry[1].vote;
    if (!pin || (vote !== "yes" && vote !== "no")) return;
    add(vote === "yes" ? positive : negative, pinTokens(pin), vote === "yes" ? 2.2 : 2.6);
  });

  const totals = {};
  new Set(Object.keys(positive).concat(Object.keys(negative))).forEach(function(token) {
    const plus = positive[token] || 0, minus = negative[token] || 0;
    totals[token] = LEARN_SCALE * (plus - minus) / (plus + minus + LEARN_PRIOR);
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
  const sum = featureTokens(product).reduce(function(total, token) { return total + tokenWeight(token) * (learned[token] || 0); }, 0);
  return Math.max(-60, Math.min(60, sum));
}
// Proximité d'une pièce avec ce que les swipes ont appris (type de pièce, matière, mots-clés…), entre -60 et +60.
export function learnedAffinity(product, learned) { return preferenceScore(product, learned || {}); }
function noveltyScore(product, learned) {
  const tokens = featureTokens(product);
  if (!tokens.length) return 50;
  const known = tokens.filter(function(token) { return Math.abs(learned[token] || 0) >= 3; }).length;
  return 100 - (known / tokens.length) * 100;
}

// Conservé pour l'agent local : mêmes critères que le paquet de cartes, sans hasard ni historique.
export function diversifyScoredProducts(entries, limit) {
  const list = Array.isArray(entries) ? entries : [];
  const cap = Number.isFinite(Number(limit)) ? Math.max(0, Math.floor(Number(limit))) : list.length;
  return diversifyDeck(list, { limit: Math.max(cap, 0), poolSize: Math.max(list.length, 1), band: 1e9 }).slice(0, cap);
}

// Décisions récentes (Oui, Non, ajouts), de la plus ancienne à la plus récente, pour que la diversité
// tienne compte de ce que l'utilisateur vient de voir, y compris lors d'une session précédente.
export function decisionHistory(state, limit) {
  const source = state || {};
  const interactions = source.interactions || {};
  const byId = new Map((source.products || []).map(function(product) { return [product.id, product]; }));
  const events = [];
  [["like", interactions.likes], ["dislike", interactions.dislikes], ["save", interactions.saves]].forEach(function(entry) {
    (Array.isArray(entry[1]) ? entry[1] : []).forEach(function(item, order) {
      const product = byId.get(item && item.productId);
      if (!product) return;
      events.push({ kind: entry[0], product: product, at: Date.parse(item.createdAt || item.addedAt || "") || 0, order: order });
    });
  });
  events.sort(function(a, b) { return a.at - b.at || a.order - b.order; });
  return events.slice(-Math.max(1, Number(limit) || 80));
}

// Marques et types de pièces que l'utilisateur a refusés sans jamais en accepter : on ne les remet pas en avant.
function rejectionProfile(history) {
  const brands = new Map(), families = new Map();
  history.forEach(function(event) {
    const delta = event.kind === "dislike" ? [1, 0] : [0, 1];
    [[brands, brandKey(event.product)], [families, familyKey(event.product)]].forEach(function(pair) {
      const row = pair[0].get(pair[1]) || [0, 0];
      row[0] += delta[0]; row[1] += delta[1];
      pair[0].set(pair[1], row);
    });
  });
  function penaltyFor(row, threshold, unit) {
    if (!row || row[1] > 0 || row[0] < threshold) return 0;
    return -unit * Math.min(3, row[0] - threshold + 1);
  }
  return function(product) {
    return penaltyFor(brands.get(brandKey(product)), 2, 8) + penaltyFor(families.get(familyKey(product)), 4, 5);
  };
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
  const pins = (state.inspirations || []).concat(state.pinterestPins || []).filter(isMenswearPin);
  const pinterestWeight = training ? 1 : 1.8;
  const interactionCounts = state.interactions || {};
  const swipeConfidence = Math.min(1, ((interactionCounts.likes || []).length + (interactionCounts.dislikes || []).length + (interactionCounts.saves || []).length) / 10);
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
  const activeFilters = opts.filters || config;
  const history = decisionHistory(state, 120);
  const rejectionPenalty = rejectionProfile(history);
  const styleFilter = normalizeText(activeFilters.style || "Tous");
  const seasonFilter = normalizeText(activeFilters.season || "Toute saison");
  // Dans un jeu de filtres, les pièces qui portent explicitement le style ou la saison choisis passent avant celles dont l'étiquette est vide.
  function filterBoost(product) {
    let boost = 0;
    if (styleFilter && styleFilter !== "tous" && (product.styleTags || []).some(function(tag) { return normalizeText(tag) === styleFilter; })) boost += 10;
    if (seasonFilter && seasonFilter !== "toute saison" && (product.seasonTags || []).some(function(tag) { return normalizeText(tag) === seasonFilter; })) boost += 4;
    return boost;
  }
  const scored = (products || []).filter(function(product) {
    const expired = product.catalogStatus === "expired" ||
      (product.sourceType !== "curated" && product.expiresAt && Date.parse(product.expiresAt) <= Date.now());
    const stale = product.catalogStatus === "stale";
    const unavailable = product.availabilityStatus === "out_of_stock";
    return isMenFit(product) && !expired && !stale && !unavailable && sizeMatches(product) &&
      matchesFilters(product, activeFilters) && !seen.has(product.id);
  }).map(function(product) {
    // Plus tu swipes, plus le profil appris pèse : 10 décisions suffisent à lui donner presque deux fois plus d'influence.
    const affinity = preferenceScore(product, learned);
    const explicit = explicitProfileScore(product, profile);
    const familiarity = affinity * (1 + .8 * swipeConfidence) + explicit;
    const novelty = noveltyScore(product, learned);
    const baseScore = familiarity * (1 - discovery / 100) + novelty * (discovery / 100) * (training ? 1.25 : 1);
    // Le tableau Pinterest guide le classement : plus une pièce ressemble aux tenues analysées, plus elle monte.
    const pinterest = Math.min(36, pinterestAffinity(product, pins) * pinterestWeight) + (product.menFit === "men" ? 1.5 : 0);
    const rejected = rejectionPenalty(product);
    const score = baseScore + pinterest + freshnessBoost(product) + reviewBoost(product) +
      merchantTrustBoost(product) + popularityBoost(product) + communityBoost(product) + filterBoost(product) + rejected;
    return { product: product, score: score, affinity: affinity, blocked: rejected < 0 || explicit < 0 };
  });
  scored.sort(function(a, b) { return b.score - a.score; });
  let ordered = scored;
  if (!opts.skipDiversify) {
    const seed = opts.seed == null || opts.seed === "" ? null : String(opts.seed) + ":" + history.length;
    ordered = diversifyDeck(scored, {
      history: history.map(function(event) { return { product: event.product, at: event.at }; }),
      seed: seed, rng: typeof opts.rng === "function" ? opts.rng : (seed == null ? undefined : createRng(seed)),
      exploration: opts.exploration != null ? Number(opts.exploration) : (seed == null && typeof opts.rng !== "function" ? 0 : .18),
      limit: opts.diversityDepth || 60
    });
  }
  const result = ordered.map(function(entry) { return entry.product; });
  // Après un « Annuler », la pièce défaite revient en tête du paquet.
  if (opts.pinFirstId) {
    const position = result.findIndex(function(product) { return product.id === opts.pinFirstId; });
    if (position > 0) result.unshift(result.splice(position, 1)[0]);
  }
  return result;
}
