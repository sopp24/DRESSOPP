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
  outerwear: ["veste","manteau","blouson","coat","jacket","parka","surchemise","trench"],
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
  const category = clean(product.objective || product.category || "");
  if (category.includes("chauss")) return "shoes";
  if (category.includes("access")) return "accessory";
  const text = clean([product.name, product.description, product.category, product.objective].join(" "));
  for (const slot of ["shoes","outerwear","top","bottom","accessory"]) {
    if (SLOT_TERMS[slot].some(function(term) { return text.includes(clean(term)); })) return slot;
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

export function buildOutfitIdeas(pins, wardrobe, catalogue, dislikedIds, outfitFeedback) {
  const disliked = new Set(dislikedIds || []);
  const savedIds = new Set((wardrobe || []).map(function(product) { return product.id; }));
  const feedbackProfile = buildFeedbackProfile(pins, outfitFeedback);
  const hasFeedback = Object.keys(feedbackProfile).length > 0;
  const ideas = [];
  (pins || []).forEach(function(pin) {
    const rankedWardrobe = (wardrobe || []).map(function(product) {
      const personalScore = hasFeedback ? productFeedbackScore(product, feedbackProfile) : 0;
      return {
        product: product,
        score: matchScore(product, pin) + personalScore * 0.35,
        slot: productSlot(product)
      };
    }).sort(function(a, b) { return b.score - a.score; });

    const selected = [];
    const usedSlots = new Set();
    rankedWardrobe.forEach(function(entry) {
      if (selected.length >= 4 || entry.slot === "other" || usedSlots.has(entry.slot) || entry.score <= 0) return;
      selected.push(entry);
      usedSlots.add(entry.slot);
    });

    const missingSlots = ["top","bottom","shoes"].filter(function(slot) { return !usedSlots.has(slot); });
    const suggestions = [];
    missingSlots.forEach(function(slot) {
      const candidate = (catalogue || []).map(function(product) {
        const personalScore = hasFeedback ? productFeedbackScore(product, feedbackProfile) : 0;
        return {
          product: product,
          score: matchScore(product, pin) + personalScore * 0.35,
          slot: productSlot(product)
        };
      }).filter(function(entry) {
        return entry.slot === slot && entry.score > 0 && !savedIds.has(entry.product.id) && !disliked.has(entry.product.id) && Boolean(entry.product.url);
      }).sort(function(a, b) { return b.score - a.score; })[0];
      if (candidate) suggestions.push(candidate);
    });

    ideas.push({
      pin: pin,
      tags: inferPinterestTags(pin),
      pieces: selected,
      missingSlots: missingSlots,
      suggestions: suggestions,
      matchCount: selected.filter(function(entry) { return entry.score > 0; }).length,
      feedbackScore: hasFeedback ? pinFeedbackScore(pin, feedbackProfile) : 0
    });
  });

  if (hasFeedback) {
    ideas.sort(function(a, b) {
      return b.feedbackScore - a.feedbackScore || b.matchCount - a.matchCount;
    });
  }
  return ideas;
}
