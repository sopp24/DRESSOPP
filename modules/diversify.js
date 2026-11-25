import { garmentFamily } from "./outfits.js";

// Diversification du paquet de cartes : la pertinence reste le critère principal, la diversité est une
// contrainte posée par-dessus. À chaque position, on ne choisit que parmi les pièces proches du meilleur
// score restant (la « bande de pertinence »), puis on pénalise ce qui ressemble à ce qui vient d'être
// montré ou décidé (marque, boutique, type de pièce, style, couleur, tranche de prix), façon MMR.

function text(value) { return String(value == null ? "" : value).trim(); }
function normalizeText(value) { return text(value).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }
function alnum(value) { return normalizeText(value).replace(/[^a-z0-9]+/g, ""); }
function hashString(value) {
  let result = 2166136261;
  const source = String(value);
  for (let index = 0; index < source.length; index += 1) { result ^= source.charCodeAt(index); result = Math.imul(result, 16777619); }
  return result >>> 0;
}

// Générateur pseudo-aléatoire déterministe (mulberry32) : même graine, même suite.
export function createRng(seed) {
  let state = hashString(seed == null ? "dressopp" : seed) || 1;
  return function() {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const COLOR_FAMILIES = [
  ["black", /noir|black|anthracite|charbon/], ["white", /blanc|white|ecru|creme|cream|ivoire|ivory|naturel/],
  ["grey", /gris|grey|gray|argent|silver/], ["blue", /bleu|blue|marine|navy|indigo|denim/],
  ["green", /vert|green|kaki|khaki|olive|sauge/], ["brown", /marron|brown|chocolat|camel|cognac|tabac|taupe|moka/],
  ["beige", /beige|sable|sand|stone|pierre/], ["red", /rouge|red|bordeaux|burgundy|brique/],
  ["pink", /rose|pink|fuchsia/], ["yellow", /jaune|yellow|moutarde|mustard/],
  ["orange", /orange|rouille|terracotta/], ["purple", /violet|purple|prune|mauve|lilas/]
];
const GENERIC_CATEGORIES = new Set(["vetements", "vetement", "accessoires", "chaussures", "sous-vetements", "autre", ""]);

export function colorKey(product) {
  const colors = Array.isArray(product && product.colors) ? product.colors : [];
  for (const color of colors) {
    const value = normalizeText(color);
    for (const entry of COLOR_FAMILIES) if (entry[1].test(value)) return entry[0];
  }
  return "";
}
export function merchantKey(product) {
  const label = normalizeText(product && (product.merchant || product.source || product.brand) || "");
  return alnum(label.split(" · ")[0]) || "sans-boutique";
}
// Certaines fiches mettent le titre du produit dans le champ marque : dans ce cas, la boutique fait foi.
export function brandKey(product) {
  const brand = normalizeText(product && product.brand);
  const words = brand.split(/[^a-z0-9]+/).filter(Boolean);
  if (!words.length || words.length > 3) return "shop:" + merchantKey(product);
  return alnum(brand);
}
export function familyKey(product) {
  const family = garmentFamily(text(product && product.name) + " " + text(product && product.category));
  if (family) return family;
  const category = normalizeText(product && (product.category || product.objective));
  return GENERIC_CATEGORIES.has(category) ? "autre" : category;
}
export function priceBand(product) {
  const price = Number(product && product.price);
  if (product == null || product.price == null || product.price === "" || !Number.isFinite(price)) return "unknown";
  return price < 40 ? "budget" : price < 100 ? "mid" : "premium";
}
function styleKey(product) {
  const tags = Array.isArray(product && product.styleTags) ? product.styleTags : [];
  return tags.length ? normalizeText(tags[0]) : "";
}
export function productKeys(product) {
  return {
    brand: brandKey(product), merchant: merchantKey(product), family: familyKey(product),
    style: styleKey(product), color: colorKey(product), price: priceBand(product)
  };
}

const DEFAULTS = {
  limit: 60,          // nombre de positions réellement réordonnées ; la suite reste classée par score
  poolSize: 400,      // candidats les plus pertinents pris en compte
  windowSize: 10,     // mémoire glissante (cartes récentes montrées ou décidées)
  band: 1.15,         // largeur de la bande de pertinence, en « écarts » de score
  exploration: 0,     // part d'exploration hors profil (0 à 1)
  caps: { brand: 2, merchant: 3, family: 3 }, // plafonds sur les 8 dernières cartes
  capWindow: 8
};
const REPEAT_WEIGHTS = { brand: .5, merchant: .22, family: .28, style: .1, color: .1, price: .07 };

function quantile(sorted, q) {
  if (!sorted.length) return 0;
  const position = (sorted.length - 1) * q, lower = Math.floor(position), upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}
function distanceWeight(distance) { return distance <= 3 ? 1 : Math.pow(.78, distance - 3); }

// entries : [{ product, score, affinity?, blocked? }] triées ou non (elles sont triées ici, stable).
// options : { history, seed, rng, limit, exploration, windowSize, band, caps, now }
//   history : produits déjà décidés, du plus ancien au plus récent ; { product, at } pour dater la décision.
export function diversifyDeck(entries, options) {
  const opts = Object.assign({}, DEFAULTS, options || {});
  opts.caps = Object.assign({}, DEFAULTS.caps, options && options.caps);
  const rng = typeof opts.rng === "function" ? opts.rng : createRng(opts.seed);
  const all = (Array.isArray(entries) ? entries : []).map(function(entry, index) {
    const product = entry && entry.product ? entry.product : entry;
    return { entry: entry, index: index, product: product, score: Number(entry && entry.score) || 0,
      affinity: Number.isFinite(Number(entry && entry.affinity)) ? Number(entry.affinity) : 0,
      blocked: Boolean(entry && entry.blocked), keys: productKeys(product), explored: false };
  });
  all.sort(function(a, b) { return b.score - a.score || a.index - b.index; });
  const poolSize = Math.max(1, Math.floor(opts.poolSize));
  const pool = all.slice(0, poolSize), rest = all.slice(poolSize);
  const limit = Math.max(0, Math.min(pool.length, Math.floor(Number(opts.limit))));
  if (pool.length < 2 || !limit) return all.map(function(item) { return item.entry; });

  const sortedScores = pool.map(function(item) { return item.score; }).sort(function(a, b) { return a - b; });
  const spread = Number(opts.spread) > 0 ? Number(opts.spread) : Math.max(6, 1.6 * (quantile(sortedScores, .9) - quantile(sortedScores, .5)));
  const exploreFloor = quantile(sortedScores, .35);

  // Mémoire : décisions récentes (hors paquet) puis cartes choisies dans ce paquet.
  const startOfDay = new Date(opts.now == null ? Date.now() : opts.now); startOfDay.setHours(0, 0, 0, 0);
  const history = (Array.isArray(opts.history) ? opts.history : []).map(function(item) {
    const product = item && item.product ? item.product : item;
    return { keys: productKeys(product), at: Number(item && item.at) || 0 };
  });
  const recent = history.slice(-opts.windowSize).map(function(item) { return item.keys; });
  const dayCounts = new Map(); let dayTotal = 0;
  history.forEach(function(item) {
    if (item.at >= startOfDay.getTime()) { dayTotal += 1; dayCounts.set(item.keys.brand, (dayCounts.get(item.keys.brand) || 0) + 1); }
  });
  const positiveBrands = new Set(history.slice(-30).map(function(item) { return item.keys.brand; }));

  const remaining = pool.slice();
  const selected = [];
  let lastExplored = false;

  function windowCounts(field, size) {
    const counts = new Map();
    recent.slice(-size).forEach(function(keys) { counts.set(keys[field], (counts.get(keys[field]) || 0) + 1); });
    return counts;
  }
  function penalty(item) {
    const keys = item.keys;
    let total = 0;
    for (let distance = 1; distance <= recent.length && distance <= opts.windowSize; distance += 1) {
      const other = recent[recent.length - distance], weight = distanceWeight(distance);
      Object.keys(REPEAT_WEIGHTS).forEach(function(field) {
        if (keys[field] && keys[field] === other[field]) total += REPEAT_WEIGHTS[field] * weight;
      });
    }
    const previous = recent[recent.length - 1];
    if (previous && keys.brand === previous.brand) total += .6;
    const beforePrevious = recent[recent.length - 2];
    if (previous && beforePrevious && keys.family !== "autre" && keys.family === previous.family && keys.family === beforePrevious.family) total += .4;
    if (dayTotal >= 6) total += 2.2 * Math.max(0, ((dayCounts.get(keys.brand) || 0) + 1) / (dayTotal + 1) - .2);
    return total;
  }
  function withinCaps(item, counts) {
    return (counts.brand.get(item.keys.brand) || 0) < opts.caps.brand &&
      (counts.merchant.get(item.keys.merchant) || 0) < opts.caps.merchant &&
      (item.keys.family === "autre" || (counts.family.get(item.keys.family) || 0) < opts.caps.family);
  }
  function takeFrom(list, item) {
    const position = remaining.indexOf(item);
    if (position >= 0) remaining.splice(position, 1);
    return item;
  }

  while (selected.length < limit && remaining.length) {
    const best = remaining[0]; // `remaining` reste trié par score décroissant
    let choice = null;

    // Exploration : de temps en temps, une pièce hors du profil courant mais jamais rejetée ni mal classée.
    if (opts.exploration > 0 && !lastExplored && rng() < opts.exploration) {
      const lastBrands = new Set(recent.slice(-6).map(function(keys) { return keys.brand; }));
      const lastFamilies = new Set(recent.slice(-3).map(function(keys) { return keys.family; }));
      const lastMerchants = new Set(recent.slice(-3).map(function(keys) { return keys.merchant; }));
      const candidates = remaining.filter(function(item) {
        return !item.blocked && item.affinity >= -4 && item.score >= exploreFloor &&
          !lastBrands.has(item.keys.brand) && !lastMerchants.has(item.keys.merchant) &&
          (item.keys.family === "autre" || !lastFamilies.has(item.keys.family));
      });
      if (candidates.length) {
        const weights = candidates.map(function(item) {
          return .4 + (item.score - exploreFloor) / spread + (positiveBrands.has(item.keys.brand) ? 0 : .8);
        });
        let draw = rng() * weights.reduce(function(sum, value) { return sum + value; }, 0);
        choice = candidates[candidates.length - 1];
        for (let index = 0; index < candidates.length; index += 1) {
          draw -= weights[index];
          if (draw <= 0) { choice = candidates[index]; break; }
        }
        choice.explored = true;
      }
    }

    if (!choice) {
      const floor = best.score - opts.band * spread;
      const band = remaining.filter(function(item) { return item.score >= floor; });
      const counts = { brand: windowCounts("brand", opts.capWindow), merchant: windowCounts("merchant", opts.capWindow), family: windowCounts("family", opts.capWindow) };
      const allowed = band.filter(function(item) { return withinCaps(item, counts); });
      const candidates = allowed.length ? allowed : band;
      let bestAdjusted = -Infinity;
      candidates.forEach(function(item) {
        const adjusted = (item.score - best.score) / spread - penalty(item) + (rng() - .5) * .06;
        if (adjusted > bestAdjusted) { bestAdjusted = adjusted; choice = item; }
      });
    }

    takeFrom(remaining, choice);
    selected.push(choice);
    lastExplored = choice.explored;
    recent.push(choice.keys);
    dayTotal += 1;
    dayCounts.set(choice.keys.brand, (dayCounts.get(choice.keys.brand) || 0) + 1);
  }
  return selected.concat(remaining, rest).map(function(item) { return item.entry; });
}

// Même chose pour une simple liste de produits déjà classés (par exemple après l'ordre de l'agent IA).
export function diversifyProducts(products, options) {
  const list = Array.isArray(products) ? products : [];
  const entries = list.map(function(product, index) { return { product: product, score: -index }; });
  // Le rang fait office de score : une pièce ne remonte que de quelques places (spread = 8 rangs).
  return diversifyDeck(entries, Object.assign({ spread: 8 }, options)).map(function(entry) { return entry.product; });
}
