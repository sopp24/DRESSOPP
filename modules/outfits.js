import { isMenFit } from "./audience.js";

const STYLE_HINTS = {
  "Classique": ["classique", "minimal", "minimaliste", "basique", "timeless", "clean"],
  "Créatif": ["creative", "créatif", "original", "statement", "graphic", "imprimé"],
  "Classe": ["tailoring", "tailleur", "élégant", "elegant", "smart", "chic", "costume", "old money"],
  "Sport": ["sport", "sportswear", "athleisure", "sneaker", "running", "training"],
  "Été": ["summer", "été", "vacances", "beach", "linen", "lin", "estival"],
  "Streetwear": ["streetwear", "street", "skate", "urban", "urbain", "oversized", "baggy"],
  "Vintage": ["vintage", "retro", "rétro", "90s", "2000s", "y2k"],
  "Workwear": ["workwear", "utility", "cargo", "denim", "work jacket"],
  "Preppy": ["preppy", "ivy", "rugby", "cravate", "col v", "polo"],
  "Smart Casual": ["smart casual", "tailoring", "tailleur", "loafer", "loafers", "mocassin", "mocassins", "derby", "derbies", "old money", "quiet luxury", "pantalon a pinces"],
  "Casual": ["casual", "cosy", "hoodie", "jogging", "sneakers"],
  "Heritage": ["heritage", "patine", "vieilli", "classic menswear"]
};
const COLOR_HINTS = ["noir","blanc","écru","crème","beige","gris","anthracite","marron","chocolat","camel","kaki","vert","vert forêt","olive","bleu","bleu ciel","marine","bordeaux","rouge","rose","jaune","orange","violet","prune"];
const COLOR_ALIASES = {
  "noir": ["black"], "blanc": ["white"], "écru": ["cream","off white"],
  "beige": ["sand"], "gris": ["grey","gray"], "marron": ["brown"],
  "marine": ["navy"], "vert": ["green"], "bleu": ["blue"],
  "rouge": ["red"], "rose": ["pink"], "jaune": ["yellow"],
  "orange": ["orange"], "violet": ["purple"], "prune": ["plum"],
  "chocolat": ["chocolate"], "crème": ["cream"], "vert forêt": ["forest green"],
  "bleu ciel": ["sky blue", "light blue"], "bordeaux": ["burgundy", "wine"]
};
const MATERIAL_HINTS = ["coton","lin","laine","cachemire","mohair","alpaga","cuir","daim","moumoute","fourrure","suède","suede","denim","jean","maille","velours","velours côtelé","tweed","flanelle","gabardine","soie","nylon","polyester","viscose","polyamide"];
const CUT_HINTS = ["oversized","oversize","ample","baggy","wide leg","large","droit","straight","slim","regular","cropped","court","long","à pinces","a pinces","pleated","boxy","relaxed","loose","tapered","évasé","fitted","taille haute","taille basse","jambe large","jambe droite","structurée","fluide"]; 
const PATTERN_HINTS = [
  { value: "rayures", terms: ["rayure", "striped", "stripes"] },
  { value: "carreaux", terms: ["carreau", "checked", "checkered", "plaid"] },
  { value: "damier", terms: ["damier", "checkerboard"] },
  { value: "jacquard", terms: ["jacquard"] },
  { value: "zèbre", terms: ["zèbre", "zebra"] },
  { value: "graphique", terms: ["graphique", "graphic", "motif graphique"] },
  { value: "floral", terms: ["floral", "fleuri", "fleurs"] },
  { value: "pied-de-poule", terms: ["pied-de-poule", "houndstooth"] },
  { value: "camouflage", terms: ["camouflage", "camo"] },
  { value: "uni", terms: ["uni", "solid color", "plain"] },
  { value: "logo", terms: ["logo", "logotype", "monogramme"] }
];
const SLOT_TERMS = {
  top: ["t-shirt","tee","shirt","chemise","polo","pull","sweat","hoodie","débardeur","top","cardigan","maille","gilet"],
  bottom: ["pantalon","jean","jeans","trouser","trousers","short","bermuda","cargo","chino"],
  shoes: ["chaussure","sneaker","basket","boot","boots","mocassin","loafer","sandale","shoe","shoes"],
  outerwear: ["veste","manteau","blouson","doudoune","anorak","coat","jacket","parka","surchemise","trench"],
  accessory: ["sac","bag","ceinture","belt","lunette","sunglasses","casquette","cap","montre","watch","bijou","jewellery","jewelry","écharpe","bonnet"]
};

function clean(value) {
  return String(value == null ? "" : value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
export function isMenswearPin(pin) {
  if (!pin) return false;
  const visual = pin.visualAnalysis;
  if (visual && Number(visual.version) >= 3) {
    return visual.isFashion === true && visual.audience === "men";
  }
  if (visual && visual.isFashion === false) return false;
  const evidence = clean([pin.title,pin.description,pin.altText,pin.alt_text,...(Array.isArray(pin.tags) ? pin.tags : [])].filter(Boolean).join(" "));
  const female = /(^|[^a-z])(femme|femmes|woman|women|womens|female|girl|girls|ladies|damen)([^a-z]|$)|pour femme|for women|womenswear/.test(evidence);
  const unisex = /(^|[^a-z])(unisexe|unisex|mixte|gender neutral|all genders)([^a-z]|$)/.test(evidence);
  const male = /(^|[^a-z])(homme|hommes|man|men|mens|menswear|male)([^a-z]|$)|men's|pour homme|for men/.test(evidence);
  return male && !female && !unisex;
}
function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}
// Une analyse peut être partielle ou abîmée : on ne garde que les pièces qui sont de vrais objets.
export function visualPieces(visual) {
  return visual && Array.isArray(visual.pieces) ? visual.pieces.filter(piece => piece && typeof piece === "object") : [];
}
export function pinterestText(pin) {
  return [pin.title, pin.description, pin.altText, pin.alt_text, ...(pin.tags || [])].filter(Boolean).join(" ");
}

function classifyPinterestText(source) {
  const features = { styleTags: [], colors: [], materials: [], cuts: [], patterns: [] };
  Object.entries(STYLE_HINTS).forEach(function(entry) {
    if (entry[1].some(function(term) { return source.includes(clean(term)); })) features.styleTags.push(entry[0]);
  });
  COLOR_HINTS.forEach(function(term) {
    const aliases = COLOR_ALIASES[term] || [];
    if (source.includes(clean(term)) || aliases.some(function(alias) { return source.includes(clean(alias)); })) features.colors.push(term);
  });
  MATERIAL_HINTS.forEach(function(term) { if (source.includes(clean(term))) features.materials.push(term); });
  CUT_HINTS.forEach(function(term) { if (source.includes(clean(term))) features.cuts.push(term); });
  PATTERN_HINTS.forEach(function(pattern) {
    if (pattern.terms.some(function(term) { return source.includes(clean(term)); })) features.patterns.push(pattern.value);
  });
  Object.keys(features).forEach(function(key) { features[key] = unique(features[key]); });
  return features;
}
function mergeVisualValues(target, values, allowed) {
  const lookup = new Map(allowed.map(function(value) { return [clean(value),value]; }));
  const visual = Array.isArray(values) ? values : [];
  target.push(...visual.map(function(value) { return lookup.get(clean(value)); }).filter(Boolean));
  return unique(target);
}
export function inferPinterestFeatures(pin) {
  const visual = pin && pin.visualAnalysis && pin.visualAnalysis.isFashion !== false ? pin.visualAnalysis : null;
  const pieces = visualPieces(visual);
  const pieceText = pieces.flatMap(function(piece) {
    return [piece.type,piece.color,piece.material,piece.cut,piece.pattern,...(Array.isArray(piece.details) ? piece.details : [])];
  });
  const source = clean([
    pinterestText(pin),visual && visual.summary,visual && visual.layering,
    visual && visual.outfitFormula,visual && visual.silhouetteTags,
    visual && visual.details,pieceText
  ].flat().filter(Boolean).join(" "));
  const features = classifyPinterestText(source);
  if (visual) {
    features.styleTags = mergeVisualValues(features.styleTags,visual.styleTags,Object.keys(STYLE_HINTS));
    features.colors = mergeVisualValues(features.colors,[...(visual.colors || []),...pieces.map(piece => piece.color)],COLOR_HINTS);
    features.materials = mergeVisualValues(features.materials,[...(visual.materials || []),...pieces.map(piece => piece.material)],MATERIAL_HINTS);
    features.cuts = mergeVisualValues(features.cuts,[...(visual.cuts || []),...pieces.map(piece => piece.cut)],CUT_HINTS);
    features.patterns = mergeVisualValues(features.patterns,[...(visual.patterns || []),...pieces.map(piece => piece.pattern)],PATTERN_HINTS.map(function(pattern) { return pattern.value; }));
  }
  return features;
}
export function inferPinterestTags(pin) {
  // Les étiquettes visibles restent fondées sur les seuls textes Pinterest.
  // Les signaux visuels sont réservés au moteur de recommandation.
  const features = classifyPinterestText(clean(pinterestText(pin)));
  return unique([].concat(features.styleTags, features.colors, features.materials, features.cuts, features.patterns));
}

export function productSlot(product) {
  const nameText = clean([product.name,product.description].join(" "));
  const metadataText = clean([product.category,product.objective].join(" "));
  // Le nom et la description priment sur les catégories marchandes, parfois mal renseignées.
  if (SLOT_TERMS.shoes.some(term => nameText.includes(clean(term)))) return "shoes";
  if (SLOT_TERMS.bottom.some(term => nameText.includes(clean(term)))) return "bottom";
  if (SLOT_TERMS.outerwear.some(term => nameText.includes(clean(term)))) return "outerwear";
  if (SLOT_TERMS.top.some(term => nameText.includes(clean(term)))) return "top";
  if (SLOT_TERMS.accessory.some(term => nameText.includes(clean(term)))) return "accessory";
  if (metadataText.includes("chauss")) return "shoes";
  if (metadataText.includes("access")) return "accessory";
  for (const slot of ["shoes","bottom","outerwear","top","accessory"]) {
    if (SLOT_TERMS[slot].some(term => metadataText.includes(clean(term)))) return slot;
  }
  return "other";
}

function visualPieceSlot(piece) {
  const explicit = clean(piece && piece.slot);
  if (["top","bottom","shoes","outerwear","accessory"].includes(explicit)) return explicit;
  return productSlot({name:piece && piece.type || ""});
}


// Familles de vêtements : le même vocabulaire sert à lire un titre produit et une pièce repérée sur un Pin.
const GARMENT_FAMILIES = [
  ["tshirt", /\b(t-?shirts?|tee-?shirts?|tees?|debardeurs?|tanks?)\b/],
  ["polo", /\bpolos?\b/],
  ["sweat", /\b(sweats?|sweat-?shirts?|hoodies?|capuche)\b/],
  ["shirt", /\b(chemises?|overshirts?|surchemises?|shirts?)\b/],
  ["knit", /\b(pulls?|pull-?overs?|sweaters?|jumpers?|cardigans?|gilets?|mailles?|knit(?:wear)?|tricots?|col roule)\b/],
  ["jacket", /\b(vestes?|blousons?|bombers?|jackets?|blazers?|harrington|teddy|veston|costumes?)\b/],
  ["coat", /\b(manteaux?|parkas?|trenchs?|trench-?coats?|doudounes?|coats?|puffers?|cabans?|pardessus|impermeables?|anoraks?)\b/],
  ["jeans", /\b(jeans?|denim)\b/],
  ["trousers", /\b(pantalons?|trousers?|chinos?|cargos?|joggings?|joggers?|pants?)\b/],
  ["shorts", /\b(shorts?|bermudas?)\b/],
  ["sneakers", /\b(baskets?|sneakers?|trainers?|air force|chuck|runners?)\b/],
  ["shoes", /\b(chaussures?|derbys?|derbies|mocassins?|loafers?|boots?|bottes?|bottines?|richelieus?|sandales?|shoes?|chelsea)\b/],
  ["accessory", /\b(ceintures?|casquettes?|bonnets?|echarpes?|sacs?|lunettes?|montres?|gants?|cravates?|chaussettes?|boxers?|slips?|calecons?|bijoux|bracelets?|chapeaux?)\b/]
];
const FAMILY_SLOTS = { tshirt:"top", polo:"top", sweat:"top", shirt:"top", knit:"top", jacket:"outerwear", coat:"outerwear", jeans:"bottom", trousers:"bottom", shorts:"bottom", sneakers:"shoes", shoes:"shoes", accessory:"accessory" };
// Famille d'un texte : le premier vêtement cité l'emporte (« Pull en jean » → pull, « Pantalon en maille » → pantalon).
export function garmentFamily(value) {
  const normalized = String(value == null ? "" : value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  let best = "", bestIndex = Infinity;
  GARMENT_FAMILIES.forEach(function(entry) {
    const match = entry[1].exec(normalized);
    if (match && match.index < bestIndex) { best = entry[0]; bestIndex = match.index; }
  });
  return best;
}
export function familySlot(family) { return FAMILY_SLOTS[family] || ""; }
// Familles des pièces visibles sur un Pin analysé.
export function pinGarmentFamilies(pin) {
  const visual = pin && pin.visualAnalysis && pin.visualAnalysis.isFashion !== false ? pin.visualAnalysis : null;
  const pieces = visualPieces(visual);
  return Array.from(new Set(pieces.map(function(piece) { return garmentFamily(piece && piece.type); }).filter(Boolean)));
}

// Familles de couleurs : « bleu marine », « navy » et « bleu nuit » parlent de la même teinte.
const COLOR_FAMILY_RULES = [
  ["black", /noir|black|anthracite|charbon/], ["white", /blanc|white|ecru|creme|cream|ivoire|ivory|naturel/],
  ["grey", /gris|grey|gray|argent|silver/], ["navy", /marine|navy/], ["blue", /bleu|blue|indigo|denim/],
  ["olive", /kaki|khaki|olive|sauge|militaire/], ["green", /vert|green|emeraude/],
  ["brown", /marron|brown|chocolat|camel|cognac|tabac|taupe|moka|caramel/], ["beige", /beige|sable|sand|stone|pierre/],
  ["orange", /orange|terracotta|rouille/], ["red", /rouge|red|bordeaux|burgundy|brique/], ["pink", /rose|pink|fuchsia/],
  ["yellow", /jaune|yellow|moutarde|mustard/], ["purple", /violet|purple|prune|mauve|lilas/]
];
const NEUTRAL_COLOR_FAMILIES = new Set(["black", "white", "grey", "navy", "blue", "olive", "brown", "beige"]);
export function colorFamily(value) {
  const text = clean(value);
  if (!text) return "";
  for (const rule of COLOR_FAMILY_RULES) if (rule[1].test(text)) return rule[0];
  return "";
}
function primaryColorFamily(product) {
  const fromColors = (Array.isArray(product && product.colors) ? product.colors : []).map(colorFamily).filter(Boolean)[0];
  return fromColors || colorFamily(product && product.name);
}

// Poids d'un Pin : un Pin récent compte un peu plus qu'un Pin ancien, une analyse peu sûre un peu moins.
// Un Pin sans date ou sans indice de confiance garde le poids 1 (données historiques inchangées).
export function pinWeight(pin, now) {
  const created = Date.parse(pin && (pin.createdAt || pin.created_at || pin.savedAt) || "");
  const reference = Number.isFinite(Number(now)) ? Number(now) : Date.now();
  let recency = 1;
  if (Number.isFinite(created)) recency = .55 + .45 * Math.pow(.5, Math.max(0, reference - created) / 864e5 / 75);
  const confidence = Number(pin && pin.visualAnalysis && pin.visualAnalysis.confidence);
  const certainty = Number.isFinite(confidence) && confidence > 0 && confidence <= 1 ? .75 + .25 * confidence : 1;
  return recency * certainty;
}

// Pins quasi identiques (même image, même titre et mêmes pièces, ou mêmes pièces sur une analyse complète) :
// un seul compte, le plus récent, pour ne pas surpondérer une même tenue enregistrée deux fois.
const PIN_SIGNATURES = new WeakMap();
function pinSignature(pin) {
  if (pin && typeof pin === "object" && PIN_SIGNATURES.has(pin)) return PIN_SIGNATURES.get(pin);
  const imageMatch = /([0-9a-f]{24,})\.[a-z0-9]+(?:\?|$)/i.exec(String(pin && pin.imageUrl || ""));
  const visual = pin && pin.visualAnalysis && pin.visualAnalysis.isFashion !== false ? pin.visualAnalysis : null;
  const signature = {
    image: imageMatch ? imageMatch[1].toLowerCase() : "",
    title: new Set(clean(pin && pin.title).split(/[^a-z0-9]+/).filter(word => word.length > 2)),
    pieces: new Set(visualPieces(visual).map(piece => (garmentFamily(piece.type) || clean(piece.type)) + "|" + colorFamily(piece.color)).filter(entry => entry !== "|"))
  };
  if (pin && typeof pin === "object") PIN_SIGNATURES.set(pin, signature);
  return signature;
}
function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  a.forEach(value => { if (b.has(value)) shared += 1; });
  return shared / (a.size + b.size - shared);
}
function nearIdenticalPins(a, b) {
  const first = pinSignature(a), second = pinSignature(b);
  if (first.image && first.image === second.image) return true;
  const pieceSimilarity = jaccard(first.pieces, second.pieces);
  if (first.pieces.size >= 3 && second.pieces.size >= 3 && pieceSimilarity >= .8) return true;
  if (first.title.size >= 3 && second.title.size >= 3 && jaccard(first.title, second.title) >= .85) {
    return first.pieces.size && second.pieces.size ? pieceSimilarity >= .5 : true;
  }
  return false;
}
export function dedupePins(pins) {
  const list = (Array.isArray(pins) ? pins : []).filter(Boolean).map((pin, index) => ({
    pin, index, time: Date.parse(pin.createdAt || pin.created_at || "") || 0
  }));
  const kept = [];
  list.slice().sort((a, b) => b.time - a.time || a.index - b.index).forEach(item => {
    if (!kept.some(other => nearIdenticalPins(other.pin, item.pin))) kept.push(item);
  });
  return kept.sort((a, b) => a.index - b.index).map(item => item.pin);
}

// Marques citées dans le texte d'un Pin (titre, description, légende) : à partir d'un lexique fourni (marques du catalogue).
export function pinBrandMentions(pin, brands) {
  const padded = " " + clean([pinterestText(pin), pin && pin.visualAnalysis && pin.visualAnalysis.summary].filter(Boolean).join(" ")).replace(/[^a-z0-9]+/g, " ").trim() + " ";
  return unique((Array.isArray(brands) ? brands : []).filter(brand => {
    const normalized = clean(brand).replace(/[^a-z0-9]+/g, " ").trim();
    return normalized.length >= 4 && padded.includes(" " + normalized + " ");
  }).map(clean));
}

const PRODUCT_TERMS = new WeakMap();
function productTerms(product) {
  if (product && typeof product === "object" && PRODUCT_TERMS.has(product)) return PRODUCT_TERMS.get(product);
  const terms = clean([
    product.name, product.description, product.brand, product.objective, product.category,
    ...(product.styleTags || []), ...(product.colors || []), ...(product.materials || []),
    ...(product.cuts || []), ...(product.patterns || [])
  ].join(" "));
  if (product && typeof product === "object") PRODUCT_TERMS.set(product, terms);
  return terms;
}

const PIN_PROFILES = new WeakMap();
function pinProfile(pin) {
  if (pin && typeof pin === "object" && PIN_PROFILES.has(pin)) return PIN_PROFILES.get(pin);
  const visual = pin && pin.visualAnalysis && pin.visualAnalysis.isFashion !== false ? pin.visualAnalysis : null;
  const pieces = visualPieces(visual);
  const visualText = visual ? [
    visual.summary,visual.layering,visual.outfitFormula,visual.silhouetteTags,
    visual.details,pieces.flatMap(piece => [piece.type,piece.color,piece.material,piece.cut,piece.pattern,...(piece.details || [])])
  ].flat().filter(Boolean) : [];
  const features = inferPinterestFeatures(pin);
  const profile = {
    pieces,
    pinText: clean([pinterestText(pin),...visualText].filter(Boolean).join(" ")),
    tags: unique([].concat(features.styleTags,features.colors,features.materials,features.cuts,features.patterns)).map(clean),
    queries: unique((visual && Array.isArray(visual.searchQueries) ? visual.searchQueries : []).map(clean).filter(Boolean)),
    pieceTypes: unique(pieces.map(piece => clean(piece.type)).filter(Boolean)),
    details: unique([
      ...(visual && Array.isArray(visual.details) ? visual.details : []),
      ...pieces.flatMap(piece => Array.isArray(piece.details) ? piece.details : [])
    ].map(clean))
  };
  if (pin && typeof pin === "object") PIN_PROFILES.set(pin, profile);
  return profile;
}

function matchScore(product, pin) {
  const { pieces, pinText, tags, pieceTypes, details, queries } = pinProfile(pin);
  const fields = [
    ...(product.styleTags || []), ...(product.colors || []),
    ...(product.materials || []), ...(product.cuts || []), ...(product.patterns || [])
  ].map(clean);
  let score = fields.reduce(function(total, field) {
    return total + (tags.includes(field) ? 4 : 0);
  }, 0);
  const terms = productTerms(product);
  tags.forEach(function(tag) {
    if (tag.length > 2 && terms.includes(tag)) score += 2;
  });
  const matchingPieces = pieceTypes.filter(type => type.length > 2 && terms.includes(type));
  score += Math.min(12,matchingPieces.length * 3);
  details.forEach(detail => {
    if (detail.length > 3 && terms.includes(detail)) score += 1.5;
  });

  // Part of the expressions boutique générées par l'IA (« pull col v laine crème homme ») se retrouve dans la fiche ?
  const phraseHit = phrase => {
    const words = String(phrase || "").split(" ").filter(word => word.length > 2 && word !== "homme");
    return words.length < 2 ? 0 : words.filter(word => terms.includes(word)).length / words.length;
  };
  const bestQuery = queries.reduce((best, query) => Math.max(best, phraseHit(query)), 0);
  if (bestQuery >= .6) score += 2 + 4 * bestQuery;

  // Match garment attributes inside their own slot, not across the whole look ; les pièces « hero » comptent davantage.
  const productCategory = productSlot(product);
  pieces.filter(piece => visualPieceSlot(piece) === productCategory).forEach(piece => {
    const before = score;
    const type = clean(piece.type);
    if (type.length > 2 && terms.includes(type)) score += 3.5;
    [["colors","color"],["materials","material"],["cuts","cut"],["patterns","pattern"]].forEach(([field,key]) => {
      const value = clean(piece[key]);
      if (!value) return;
      const productValues = (product[field] || []).map(clean);
      if (productValues.includes(value)) score += 3;
      else if (terms.includes(value)) score += 1.25;
    });
    (Array.isArray(piece.details) ? piece.details : []).forEach(detail => {
      const value = clean(detail);
      if (value.length > 3 && terms.includes(value)) score += 1;
    });
    const keywordHit = (Array.isArray(piece.keywords) ? piece.keywords : []).reduce((best, keyword) => Math.max(best, phraseHit(clean(keyword))), 0);
    if (keywordHit >= .6) score += 2 + 3 * keywordHit;
    if (piece.prominence === "hero") score += (score - before) * .3;
  });
  (product.colors || []).forEach(function(color) {
    if (pinText.includes(clean(color))) score += 2;
  });
  (product.styleTags || []).forEach(function(style) {
    if (pinText.includes(clean(style))) score += 3;
  });
  return score;
}

// Proximité d'une pièce avec les tenues du tableau Pinterest : les meilleures correspondances comptent le plus.
export function pinterestAffinity(product, pins) {
  const scores = (Array.isArray(pins) ? pins : []).map(pin => matchScore(product, pin)).sort((a, b) => b - a);
  if (!scores.length) return 0;
  return scores[0] * .6 + (scores[1] || 0) * .25 + (scores[2] || 0) * .15;
}

// Couleurs, matières, coupes et motifs lus dans le titre / la description d'une fiche quand le marchand ne les renseigne pas.
export function inferTextFeatures(value, colorSource) {
  const features = classifyPinterestText(clean(value));
  const colors = classifyPinterestText(clean(colorSource == null ? value : colorSource)).colors;
  const label = word => word.charAt(0).toUpperCase() + word.slice(1);
  return {
    colors: colors.slice(0, 3).map(label), materials: features.materials.slice(0, 3).map(label),
    cuts: features.cuts.slice(0, 2).map(label), patterns: features.patterns.slice(0, 2).map(label)
  };
}

function pinIdentity(pin) {
  return String(pin && (pin.pinId || pin.id || pin.sourceUrl || pin.pinUrl) || "");
}

function pinterestFeatureTokens(pin) {
  const features = inferPinterestFeatures(pin);
  const tokens = [];
  Object.entries(features).forEach(function(entry) {
    entry[1].forEach(function(value) {
      tokens.push(entry[0] + ":" + clean(value));
    });
  });
  (pin && Array.isArray(pin.tags) ? pin.tags : []).forEach(function(value) {
    if (value) tokens.push("styleTags:" + clean(value));
  });
  return unique(tokens);
}

function buildFeedbackProfile(pins, feedback) {
  const byId = new Map();
  (pins || []).forEach(function(pin) {
    const id = pinIdentity(pin);
    if (id) byId.set(id, pin);
  });

  const profile = {};
  Object.entries(feedback && typeof feedback === "object" ? feedback : {}).forEach(function(entry) {
    const pin = byId.get(String(entry[0]));
    const vote = entry[1] && entry[1].vote;
    if (!pin || (vote !== "yes" && vote !== "no")) return;
    const weight = vote === "yes" ? 5 : -6;
    pinterestFeatureTokens(pin).forEach(function(token) {
      profile[token] = (profile[token] || 0) + weight;
    });
  });
  return profile;
}

function productFeedbackScore(product, profile) {
  const tokens = [];
  ["styleTags", "colors", "materials", "cuts", "patterns"].forEach(function(field) {
    (product[field] || []).forEach(function(value) {
      tokens.push(field + ":" + clean(value));
    });
  });
  if (!tokens.length) return 0;
  const total = tokens.reduce(function(score, token) {
    return score + (profile[token] || 0);
  }, 0);
  return Math.max(-8, Math.min(8, total / tokens.length));
}

function pinFeedbackScore(pin, profile) {
  const tokens = pinterestFeatureTokens(pin);
  if (!tokens.length) return 0;
  return tokens.reduce(function(score, token) {
    return score + (profile[token] || 0);
  }, 0) / tokens.length;
}

function matchesAny(values, expected) {
  const source = (Array.isArray(values) ? values : []).map(clean);
  return expected.some(value => source.includes(clean(value)));
}
function productIsForMen(product) {
  return isMenFit(product);
}
function productExcludedByProfile(product, profile) {
  const p = profile || {};
  const colors = (product.colors || []).map(clean);
  const materials = (product.materials || []).map(clean);
  const cuts = (product.cuts || []).map(clean);
  const brands = [product.brand,product.merchant].map(clean);
  return (p.excludedBrands || []).some(value => brands.includes(clean(value))) ||
    (p.excludedColors || []).some(value => colors.includes(clean(value))) ||
    (p.excludedMaterials || []).some(value => materials.includes(clean(value))) ||
    (p.excludedCuts || []).some(value => cuts.includes(clean(value)));
}
const SEASON_HINTS = {
  printemps:["printemps","spring","mid-season","mid season","mi-saison"],
  ete:["ete","summer","estival"],
  automne:["automne","autumn","fall"],
  hiver:["hiver","winter","cold weather"]
};
function seasonHintsFor(season) {
  return SEASON_HINTS[clean(season)] || [clean(season)];
}
function matchesSeasonValues(values, hints) {
  return (values || []).some(value => {
    const tag = clean(value);
    return tag === "toute saison" || hints.some(hint => tag.includes(clean(hint)));
  });
}
function productMatchesOutfitSeason(product, season) {
  if (!season || clean(season) === "toute saison") return true;
  const tags = (product.seasonTags || []).filter(Boolean);
  return !tags.length || matchesSeasonValues(tags,seasonHintsFor(season));
}
function productSizeMatches(product, profile) {
  const supplied = (product.sizes || []).map(clean);
  if (!supplied.length) return true;
  const slot = productSlot(product), sizes = (profile && profile.sizes) || {};
  const preferred = slot === "shoes" ? sizes.shoes : slot === "bottom" ? sizes.bottoms :
    slot === "outerwear" ? sizes.outerwear : slot === "accessory" ? "" : sizes.tops;
  if (!preferred) return true;
  const wanted = clean(preferred).replace(/^(eu|fr|uk|us)\s*/,"");
  return supplied.some(size => size === clean(preferred) ||
    size.replace(/^(eu|fr|uk|us)\s*/,"") === wanted ||
    (wanted.length >= 2 && size.includes(wanted)));
}
function profileProductScore(product, profile) {
  const p = profile || {};
  let score = 0;
  if (matchesAny(product.styleTags,p.preferredStyles || [])) score += 5;
  if (matchesAny(product.colors,p.preferredColors || [])) score += 3;
  if (matchesAny(product.materials,p.preferredMaterials || [])) score += 3;
  if (matchesAny(product.cuts,p.preferredCuts || [])) score += 3;
  if ([product.brand,product.merchant].some(value => (p.favoriteBrands || []).some(brand => clean(value) === clean(brand)))) score += 4;
  return score;
}
function productMatchesSelectedStyles(product, styles) {
  if (!styles.length) return true;
  const tags = (product.styleTags || []).map(clean);
  return !tags.length || styles.some(style => tags.includes(clean(style)));
}
function pinMatchesOutfitFilters(pin, filters) {
  const styles = (filters.styles || []).filter(Boolean);
  if (styles.length) {
    const features = inferPinterestFeatures(pin);
    const pinStyles = features.styleTags.map(clean);
    const text = clean([pinterestText(pin),features.styleTags.join(" "),features.summary || ""].join(" "));
    const matched = styles.some(style => pinStyles.includes(clean(style)) || text.includes(clean(style)));
    if (!matched) return false;
  }
  const season = filters.season || "Toute saison";
  if (clean(season) !== "toute saison") {
    const hints = seasonHintsFor(season);
    const visualSeasonTags = pin && pin.visualAnalysis && pin.visualAnalysis.isFashion !== false
      ? pin.visualAnalysis.seasonTags || [] : [];
    const seasonTags = (pin && pin.seasonTags || []).concat(pin && pin.season ? [pin.season] : [],visualSeasonTags).filter(Boolean);
    if (seasonTags.length) return matchesSeasonValues(seasonTags,hints);

    const text = clean([
      pin && pin.title,pin && pin.description,pin && pin.altText,pin && pin.alt_text,
      pin && pin.visualAnalysis && pin.visualAnalysis.summary
    ].filter(Boolean).join(" "));
    const allSeasonHints = Object.values(SEASON_HINTS).flat().map(clean);
    const hasExplicitSeason = allSeasonHints.some(hint => text.includes(hint));
    // If Pinterest does not specify a season, keep the Pin eligible; product season tags still apply.
    if (!hasExplicitSeason) return true;
    return hints.some(hint => text.includes(clean(hint)));
  }
  return true;
}

export function outfitTotalPrice(items) {
  const entries = Array.isArray(items) ? items : [];
  if (!entries.length || entries.some(entry => {
    const price = entry && entry.product ? entry.product.price : null;
    return price == null || price === "" || !Number.isFinite(Number(price));
  })) return null;
  return entries.reduce((sum,entry) => sum + Number(entry.product.price),0);
}

export function buildOutfitIdeas(pins, wardrobe, catalogue, dislikedIds, outfitFeedback, filters) {
  const options = filters || {};
  const profile = options.profile || {};
  const selectedStyles = Array.isArray(options.styles) ? options.styles : [];
  const season = options.season || "Toute saison";
  const maxPrice = options.maxPrice == null || options.maxPrice === "" ? null : Number(options.maxPrice);
  const budget = Number.isFinite(maxPrice) && maxPrice >= 0 ? maxPrice : null;
  const disliked = new Set(dislikedIds || []);
  const savedIds = new Set((wardrobe || []).map(product => product.id));
  const feedbackProfile = buildFeedbackProfile(pins, outfitFeedback);
  const hasFeedback = Object.keys(feedbackProfile).length > 0;
  const productMap = new Map();
  (catalogue || []).concat(wardrobe || []).forEach(product => {
    if (product && product.id) productMap.set(product.id,product);
  });
  const candidates = Array.from(productMap.values()).filter(product => {
    const expired = product.catalogStatus === "expired" || (product.expiresAt && Date.parse(product.expiresAt) <= Date.now());
    return productIsForMen(product) && !expired && product.catalogStatus !== "stale" && product.availabilityStatus !== "out_of_stock" &&
      !disliked.has(product.id) && (savedIds.has(product.id) || /^https?:\/\//i.test(String(product.url || ""))) && !productExcludedByProfile(product,profile) &&
      productMatchesOutfitSeason(product,season) && productSizeMatches(product,profile);
  });
  const ideas = [];

  (pins || []).filter(pin => pin && isMenswearPin(pin) && pin.kind !== "detail" && pinMatchesOutfitFilters(pin,options)).forEach(pin => {
    const featureSet = inferPinterestFeatures(pin);
    const ranked = candidates.map(product => {
      const slot = productSlot(product);
      if (slot === "other" || !productMatchesSelectedStyles(product,selectedStyles)) return null;
      const match = matchScore(product,pin);
      const personal = profileProductScore(product,profile);
      const learned = hasFeedback ? productFeedbackScore(product,feedbackProfile) * .35 : 0;
      const score = match + personal + learned + (savedIds.has(product.id) ? 1.25 : 0);
      if (score <= 0) return null;
      if (budget !== null && (product.price == null || Number(product.price) > budget)) return null;
      return {product,slot,score,isSaved:savedIds.has(product.id)};
    }).filter(Boolean);

    const used = new Set();
    const items = [];
    let remainingBudget = budget;
    const coreSlots = ["top","bottom","shoes"];
    const optionalSlots = ["outerwear","accessory"];
    coreSlots.concat(optionalSlots).forEach(slot => {
      const slotCandidates = ranked.filter(entry => entry.slot === slot && !used.has(entry.product.id))
        .sort((a,b) => {
          const affordabilityA = budget !== null ? (Number(a.product.price || 0) / Math.max(1,budget)) * 2 : 0;
          const affordabilityB = budget !== null ? (Number(b.product.price || 0) / Math.max(1,budget)) * 2 : 0;
          return (b.score - affordabilityB) - (a.score - affordabilityA);
        });
      const chosen = slotCandidates.find(entry => {
        if (remainingBudget === null) return true;
        return Number(entry.product.price) <= remainingBudget;
      });
      if (!chosen) return;
      if (remainingBudget !== null) remainingBudget -= Number(chosen.product.price);
      used.add(chosen.product.id);
      items.push(chosen);
    });

    const pieces = items.filter(entry => entry.isSaved);
    const suggestions = items.filter(entry => !entry.isSaved);
    const visibleSlots = unique(visualPieces(pin.visualAnalysis && pin.visualAnalysis.isFashion !== false ? pin.visualAnalysis : null)
      .map(visualPieceSlot).filter(slot => ["top","bottom","shoes","outerwear","accessory"].includes(slot)));
    const expectedSlots = visibleSlots.length ? visibleSlots : coreSlots;
    const missingSlots = expectedSlots.filter(slot => !items.some(entry => entry.slot === slot));
    const totalPrice = outfitTotalPrice(items);
    const matchAverage = items.length ? items.reduce((sum,entry) => sum + entry.score,0) / items.length : 0;
    ideas.push({
      pin,
      tags: Array.from(new Set([].concat(featureSet.styleTags,featureSet.colors,featureSet.materials,featureSet.cuts,featureSet.patterns))),
      pieces,
      suggestions,
      items,
      missingSlots,
      matchCount: items.length,
      totalPrice,
      score: matchAverage,
      feedbackScore: hasFeedback ? pinFeedbackScore(pin,feedbackProfile) : 0
    });
  });

  ideas.sort((a,b) =>
    b.feedbackScore - a.feedbackScore ||
    b.score - a.score ||
    b.matchCount - a.matchCount
  );
  return ideas;
}
