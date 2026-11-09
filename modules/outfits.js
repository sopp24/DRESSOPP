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
const MATERIAL_HINTS = ["coton","lin","laine","cuir","daim","moumoute","fourrure","suède","suede","denim","jean","maille","velours","soie","nylon"];
const CUT_HINTS = ["oversized","oversize","ample","baggy","wide leg","large","droit","straight","slim","regular","cropped","court","long","à pinces","a pinces","pleated"]; 
const PATTERN_HINTS = [
  { value: "rayures", terms: ["rayure", "striped", "stripes"] },
  { value: "carreaux", terms: ["carreau", "checked", "checkered", "plaid"] },
  { value: "damier", terms: ["damier", "checkerboard"] },
  { value: "jacquard", terms: ["jacquard"] },
  { value: "zèbre", terms: ["zèbre", "zebra"] },
  { value: "graphique", terms: ["graphique", "graphic", "motif graphique"] }
];
const SLOT_TERMS = {
  top: ["t-shirt","tee","shirt","chemise","polo","pull","sweat","hoodie","débardeur","top","cardigan","maille"],
  bottom: ["pantalon","jean","jeans","trouser","trousers","short","bermuda","cargo","chino"],
  shoes: ["chaussure","sneaker","basket","boot","boots","mocassin","loafer","sandale","shoe","shoes"],
  outerwear: ["veste","manteau","blouson","doudoune","anorak","coat","jacket","parka","surchemise","trench"],
  accessory: ["sac","bag","ceinture","belt","lunette","sunglasses","casquette","cap","montre","watch","bijou","jewellery","jewelry","écharpe","bonnet"]
};

function clean(value) {
  return String(value == null ? "" : value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
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
  const source = clean([pinterestText(pin), visual && visual.summary].filter(Boolean).join(" "));
  const features = classifyPinterestText(source);
  if (visual) {
    features.styleTags = mergeVisualValues(features.styleTags,visual.styleTags,Object.keys(STYLE_HINTS));
    features.colors = mergeVisualValues(features.colors,visual.colors,COLOR_HINTS);
    features.materials = mergeVisualValues(features.materials,visual.materials,MATERIAL_HINTS);
    features.cuts = mergeVisualValues(features.cuts,visual.cuts,CUT_HINTS);
    features.patterns = mergeVisualValues(features.patterns,visual.patterns,PATTERN_HINTS.map(function(pattern) { return pattern.value; }));
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

function productTerms(product) {
  return clean([
    product.name, product.description, product.brand, product.objective, product.category,
    ...(product.styleTags || []), ...(product.colors || []), ...(product.materials || []),
    ...(product.cuts || []), ...(product.patterns || [])
  ].join(" "));
}

function matchScore(product, pin) {
  const pinText = clean([pinterestText(pin),pin && pin.visualAnalysis && pin.visualAnalysis.isFashion !== false ? pin.visualAnalysis.summary : ""].filter(Boolean).join(" "));
  const features = inferPinterestFeatures(pin);
  const tags = unique([].concat(features.styleTags,features.colors,features.materials,features.cuts,features.patterns)).map(clean);
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
  (product.colors || []).forEach(function(color) {
    if (pinText.includes(clean(color))) score += 2;
  });
  (product.styleTags || []).forEach(function(style) {
    if (pinText.includes(clean(style))) score += 3;
  });
  return score;
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
    const seasonTags = (pin && pin.seasonTags || []).concat(pin && pin.season ? [pin.season] : []).filter(Boolean);
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
    return !expired && product.catalogStatus !== "stale" && product.availabilityStatus !== "out_of_stock" &&
      !disliked.has(product.id) && (savedIds.has(product.id) || /^https?:\/\//i.test(String(product.url || ""))) && !productExcludedByProfile(product,profile) &&
      productMatchesOutfitSeason(product,season) && productSizeMatches(product,profile);
  });
  const ideas = [];

  (pins || []).filter(pin => pin && pin.kind !== "detail" && pinMatchesOutfitFilters(pin,options)).forEach(pin => {
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
    const missingSlots = coreSlots.filter(slot => !items.some(entry => entry.slot === slot));
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
