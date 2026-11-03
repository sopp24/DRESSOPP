const STYLE_HINTS = {
  "Classique": ["classique", "minimal", "minimaliste", "basique", "timeless", "clean"],
  "Créatif": ["creative", "créatif", "original", "statement", "graphic", "imprimé"],
  "Classe": ["tailoring", "tailleur", "élégant", "elegant", "smart", "chic", "costume", "old money"],
  "Sport": ["sport", "sportswear", "athleisure", "sneaker", "running", "training"],
  "Été": ["summer", "été", "vacances", "beach", "linen", "lin", "estival"],
  "Streetwear": ["streetwear", "street", "skate", "urban", "urbain", "oversized", "baggy"],
  "Vintage": ["vintage", "retro", "rétro", "90s", "2000s", "y2k"],
  "Workwear": ["workwear", "utility", "cargo", "denim", "work jacket"]
};
const COLOR_HINTS = ["noir","blanc","écru","beige","gris","anthracite","marron","chocolat","camel","kaki","vert","olive","bleu","marine","bordeaux","rouge","rose","jaune","orange","violet"];
const MATERIAL_HINTS = ["coton","lin","laine","cuir","suède","suede","denim","jean","maille","velours","soie","nylon"];
const CUT_HINTS = ["oversized","oversize","ample","baggy","wide leg","large","droit","straight","slim","regular","cropped","court","long"];
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

export function inferPinterestFeatures(pin) {
  const source = clean(pinterestText(pin));
  const features = { styleTags: [], colors: [], materials: [], cuts: [] };
  Object.entries(STYLE_HINTS).forEach(function(entry) {
    if (entry[1].some(function(term) { return source.includes(clean(term)); })) features.styleTags.push(entry[0]);
  });
  COLOR_HINTS.forEach(function(term) { if (source.includes(clean(term))) features.colors.push(term); });
  MATERIAL_HINTS.forEach(function(term) { if (source.includes(clean(term))) features.materials.push(term); });
  CUT_HINTS.forEach(function(term) { if (source.includes(clean(term))) features.cuts.push(term); });
  Object.keys(features).forEach(function(key) { features[key] = unique(features[key]); });
  return features;
}
export function inferPinterestTags(pin) {
  const features = inferPinterestFeatures(pin);
  return unique([].concat(features.styleTags, features.colors, features.materials, features.cuts));
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
  const pinText = clean(pinterestText(pin));
  const tags = inferPinterestTags(pin).map(clean);
  const fields = [
    ...(product.styleTags || []), ...(product.colors || []),
    ...(product.materials || []), ...(product.cuts || [])
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

export function buildOutfitIdeas(pins, wardrobe, catalogue, dislikedIds) {
  const disliked = new Set(dislikedIds || []);
  const savedIds = new Set((wardrobe || []).map(function(product) { return product.id; }));
  const ideas = [];
  (pins || []).forEach(function(pin) {
    const rankedWardrobe = (wardrobe || []).map(function(product) {
      return { product: product, score: matchScore(product, pin), slot: productSlot(product) };
    }).sort(function(a, b) { return b.score - a.score; });

    const selected = [];
    const usedSlots = new Set();
    rankedWardrobe.forEach(function(entry) {
      if (selected.length >= 4 || entry.slot === "other" || usedSlots.has(entry.slot)) return;
      selected.push(entry);
      usedSlots.add(entry.slot);
    });

    const missingSlots = ["top","bottom","shoes"].filter(function(slot) { return !usedSlots.has(slot); });
    const suggestions = [];
    missingSlots.forEach(function(slot) {
      const candidate = (catalogue || []).map(function(product) {
        return { product: product, score: matchScore(product, pin), slot: productSlot(product) };
      }).filter(function(entry) {
        return entry.slot === slot && !savedIds.has(entry.product.id) && !disliked.has(entry.product.id) && Boolean(entry.product.url);
      }).sort(function(a, b) { return b.score - a.score; })[0];
      if (candidate) suggestions.push(candidate);
    });

    ideas.push({
      pin: pin,
      tags: inferPinterestTags(pin),
      pieces: selected,
      missingSlots: missingSlots,
      suggestions: suggestions,
      matchCount: selected.filter(function(entry) { return entry.score > 0; }).length
    });
  });
  return ideas;
}
