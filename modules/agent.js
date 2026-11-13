const MAX_CANDIDATES = 50;
const MAX_HISTORY = 15;

export function selectAgentCandidates(rankedProducts, limit = MAX_CANDIDATES) {
  const products = Array.isArray(rankedProducts) ? rankedProducts : [];
  const cap = Math.max(0, Math.min(MAX_CANDIDATES, Math.floor(Number(limit) || MAX_CANDIDATES)));
  if (products.length <= cap) return products.slice();
  const curated = products.filter(product => product && product.sourceType === "curated");
  const curatedIds = new Set(curated.map(product => product.id));
  return curated.slice(0, cap).concat(products.filter(product => product && !curatedIds.has(product.id)).slice(0, Math.max(0, cap - Math.min(curated.length, cap))));
}
function clean(value, limit = 140) { return String(value == null ? "" : value).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, limit); }
function list(value, max = 10) { return (Array.isArray(value) ? value : []).map(item => clean(item, 48)).filter(Boolean).slice(0, max); }
function productSummary(product) {
  return { id:clean(product.id,128), name:clean(product.name), brand:clean(product.brand,80), merchant:clean(product.merchant || product.source,80), gender:clean(product.gender,20), genderVerified:product.genderVerified === true, price:product.price == null ? null : Number(product.price), objective:clean(product.objective || product.category,40), category:clean(product.category,60), styleTags:list(product.styleTags,6), colors:list(product.colors,5), materials:list(product.materials,5), cuts:list(product.cuts,4), patterns:list(product.patterns,4), seasonTags:list(product.seasonTags,4), description:clean(product.description,240) };
}
function feedbackProducts(state, key) {
  const products = new Map((state.products || []).map(product => [product.id, product]));
  const events = Array.isArray(state.interactions && state.interactions[key]) ? state.interactions[key] : [];
  const seen = new Set();
  return events.slice(-MAX_HISTORY).reverse().map(event => { const product = products.get(event.productId); if (!product || product.gender !== "men" || product.genderVerified !== true || seen.has(product.id)) return null; seen.add(product.id); return productSummary(product); }).filter(Boolean);
}
function savedProducts(state) {
  const products = new Map((state.products || []).map(product => [product.id, product]));
  const saved = Array.isArray(state.likedProducts) ? state.likedProducts : [];
  const seen = new Set();
  return saved.slice(-MAX_HISTORY).reverse().map(item => { const product = products.get(item.productId); if (!product || product.gender !== "men" || product.genderVerified !== true || seen.has(product.id)) return null; seen.add(product.id); return productSummary(product); }).filter(Boolean);
}
export function createAgentPayload(state, candidates, inspirations) {
  const settings = state.settings || {}, profile = state.profile || {};
  return {
    filters:{ objective:settings.objective || "Tout", style:settings.style || "Tous", season:settings.season || "Toute saison", maxPrice:settings.maxPrice == null ? null : Number(settings.maxPrice) },
    profile:{ preferredStyles:list(profile.preferredStyles,12), excludedStyles:list(profile.excludedStyles,12), favoriteBrands:list(profile.favoriteBrands,12), excludedBrands:list(profile.excludedBrands,12), preferredColors:list(profile.preferredColors,12), excludedColors:list(profile.excludedColors,12), preferredMaterials:list(profile.preferredMaterials,12), excludedMaterials:list(profile.excludedMaterials,12), preferredCuts:list(profile.preferredCuts,12), excludedCuts:list(profile.excludedCuts,12), comfort:clean(profile.comfort,50), fit:clean(profile.fit,50) },
    feedback:{ liked:feedbackProducts(state,"likes"), saved:savedProducts(state), disliked:feedbackProducts(state,"dislikes") },
    inspirations:(Array.isArray(inspirations) ? inspirations : []).slice(0,12).map(item => ({
      title:clean(item.title,100), summary:clean(item.summary,320), layering:clean(item.layering,180),
      outfitFormula:clean(item.outfitFormula,220), tags:list(item.tags,18),
      styleTags:list(item.styleTags,8), colors:list(item.colors,8), materials:list(item.materials,8),
      cuts:list(item.cuts,8), patterns:list(item.patterns,8),
      pieces:(Array.isArray(item.pieces) ? item.pieces : []).slice(0,12).map(piece => ({
        type:clean(piece.type,48), slot:clean(piece.slot,20), color:clean(piece.color,32),
        material:clean(piece.material,32), cut:clean(piece.cut,40), pattern:clean(piece.pattern,32),
        details:list(piece.details,6)
      }))
    })),
    products:(Array.isArray(candidates) ? candidates : []).filter(product => product && product.gender === "men" && product.genderVerified === true).slice(0,MAX_CANDIDATES).map(productSummary)
  };
}
export async function requestAgentRecommendations(endpoint, state, candidates, inspirations, options = {}) {
  const base = String(endpoint || "").trim().replace(/\/+$/, "");
  if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(base)) throw new Error("URL du Worker IA invalide. Elle doit commencer par https://.");
  const payload = createAgentPayload(state,candidates,inspirations);
  if (!payload.products.length) throw new Error("Aucun article candidat à analyser.");
  const response = await fetch(base + "/recommend", { method:"POST", mode:"cors", credentials:"omit", headers:{"content-type":"application/json"}, body:JSON.stringify(payload), signal:options.signal });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) throw new Error(data.error || "Le service de recommandations IA est indisponible.");
  const known = new Set(payload.products.map(product => product.id)), seen = new Set();
  const recommendations = (Array.isArray(data.recommendations) ? data.recommendations : []).filter(item => item && known.has(item.productId) && !seen.has(item.productId)).map(item => { seen.add(item.productId); return {productId:item.productId,reason:clean(item.reason,150)}; });
  if (!recommendations.length) throw new Error("Aucun article du catalogue n’a été sélectionné par l’agent.");
  return { recommendations, message:clean(data.message,260), searchHints:list(data.searchHints,3), candidateCount:Number(data.candidateCount) || payload.products.length };
}
export function orderProductsByAgent(products, recommendations) {
  const order = new Map((recommendations || []).map((item,index) => [item.productId,index]));
  return (products || []).slice().sort((a,b) => { const aOrder=order.has(a.id)?order.get(a.id):Number.MAX_SAFE_INTEGER; const bOrder=order.has(b.id)?order.get(b.id):Number.MAX_SAFE_INTEGER; return aOrder-bOrder; });
}

function localNormalize(value) {
  return String(value == null ? "" : value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
}
function localValues(product, field) {
  const value = product && product[field];
  return (Array.isArray(value) ? value : value ? [value] : []).map(item => String(item).trim()).filter(Boolean);
}
function addLocalSignal(weights, field, value, amount) {
  const normalized = localNormalize(value);
  if (!normalized) return;
  const key = field + ":" + normalized;
  weights.set(key,(weights.get(key) || 0) + amount);
}
function localProductSignals(weights, product, amount) {
  if (!product || product.gender !== "men" || product.genderVerified !== true) return;
  ["styleTags","colors","materials","cuts","patterns"].forEach(field => {
    localValues(product,field).forEach(value => addLocalSignal(weights,field,value,amount));
  });
  if (product.brand) addLocalSignal(weights,"brand",product.brand,amount);
}
function localFeatureNames(product) {
  const result = [];
  [["styleTags","style"],["colors","couleur"],["materials","matière"],["cuts","coupe"],["patterns","motif"]].forEach(([field,label]) => {
    localValues(product,field).forEach(value => result.push({field,label,value}));
  });
  if (product.brand) result.push({field:"brand",label:"marque",value:String(product.brand)});
  return result;
}

/**
 * On-device personal shopper. It uses only the current catalogue, profile,
 * Pinterest titles/tags and votes already stored in the browser. Nothing is
 * sent over the network by this function.
 */
export function recommendLocally(state, rankedCandidates, inspirations = [], limit = 14) {
  const source = state || {};
  const candidates = Array.isArray(rankedCandidates) ? rankedCandidates.filter(product => product && product.gender === "men" && product.genderVerified === true) : [];
  if (!candidates.length) return { recommendations:[], message:"Aucun article candidat à classer.", searchHints:[], candidateCount:0, provider:"local" };

  const weights = new Map();
  const byId = new Map((source.products || []).map(product => [product.id,product]));
  const interactions = source.interactions || {};
  const addHistory = (events,amount) => {
    (Array.isArray(events) ? events : []).slice(-15).forEach(event => localProductSignals(weights,byId.get(event.productId),amount));
  };
  addHistory(interactions.likes,4);
  addHistory(interactions.saves,5);
  addHistory(source.likedProducts,5);
  addHistory(interactions.dislikes,-7);

  const profile = source.profile || {};
  const profileFields = [
    ["preferredStyles","styleTags",5],["excludedStyles","styleTags",-12],
    ["favoriteBrands","brand",5],["excludedBrands","brand",-14],
    ["preferredColors","colors",4],["excludedColors","colors",-10],
    ["preferredMaterials","materials",4],["excludedMaterials","materials",-10],
    ["preferredCuts","cuts",4],["excludedCuts","cuts",-10]
  ];
  profileFields.forEach(([profileKey,featureField,amount]) => {
    (Array.isArray(profile[profileKey]) ? profile[profileKey] : []).forEach(value => addLocalSignal(weights,featureField,value,amount));
  });

  const pinTokens = new Set();
  (Array.isArray(inspirations) ? inspirations : []).slice(0,40).forEach(pin => {
    const pieces = Array.isArray(pin && pin.pieces) ? pin.pieces.slice(0,12) : [];
    const pieceText = pieces.flatMap(piece => [piece.type,piece.slot,piece.color,piece.material,piece.cut,piece.pattern,...(Array.isArray(piece.details) ? piece.details : [])]);
    const text = [pin && pin.title,pin && pin.summary,pin && pin.layering,pin && pin.outfitFormula,
      ...(Array.isArray(pin && pin.tags) ? pin.tags : []),...(Array.isArray(pin && pin.styleTags) ? pin.styleTags : []),
      ...(Array.isArray(pin && pin.colors) ? pin.colors : []),...(Array.isArray(pin && pin.materials) ? pin.materials : []),
      ...(Array.isArray(pin && pin.cuts) ? pin.cuts : []),...(Array.isArray(pin && pin.patterns) ? pin.patterns : []),...pieceText
    ].filter(Boolean).join(" ");
    localNormalize(text).split(/[^a-z0-9]+/).filter(token => token.length > 3).forEach(token => pinTokens.add(token));
    ["styleTags","colors","materials","cuts","patterns"].forEach(field => {
      (Array.isArray(pin && pin[field]) ? pin[field] : []).forEach(value => addLocalSignal(weights,field,value,2.5));
    });
    pieces.forEach(piece => {
      if (piece.color) addLocalSignal(weights,"colors",piece.color,2.5);
      if (piece.material) addLocalSignal(weights,"materials",piece.material,2.5);
      if (piece.cut) addLocalSignal(weights,"cuts",piece.cut,2.5);
      if (piece.pattern) addLocalSignal(weights,"patterns",piece.pattern,2.5);
    });
  });

  const scored = candidates.map((product,index) => {
    let score = Math.max(0,8 - index * 0.12);
    const matched = [];
    localFeatureNames(product).forEach(feature => {
      const weight = weights.get(feature.field + ":" + localNormalize(feature.value)) || 0;
      score += weight;
      if (weight >= 2) matched.push({value:feature.value,label:feature.label,weight});
      const tokens = localNormalize(feature.value).split(/[^a-z0-9]+/).filter(token => token.length > 3);
      if (tokens.some(token => pinTokens.has(token))) {
        score += 2.5;
        matched.push({value:feature.value,label:feature.label,weight:2.5});
      }
    });
    const text = localNormalize([product.name,product.description,product.category].join(" "));
    let pinMatches = 0;
    pinTokens.forEach(token => { if (text.includes(token)) pinMatches += 1; });
    score += Math.min(8,pinMatches * 1.2);
    return {product,score,index,matched};
  }).sort((a,b) => b.score-a.score || a.index-b.index);

  const selected = [];
  const merchantCounts = new Map();
  const categoryCounts = new Map();
  const cap = Math.max(1,Math.min(14,Math.floor(Number(limit) || 14)));
  while (selected.length < cap && scored.length) {
    let bestIndex = 0, bestAdjusted = -Infinity;
    scored.forEach((item,index) => {
      const merchant = localNormalize(item.product.merchant || item.product.source || "");
      const category = localNormalize(item.product.objective || item.product.category || "");
      const diversityPenalty = (merchantCounts.get(merchant) || 0) * 2.5 + (categoryCounts.get(category) || 0) * 0.8;
      const adjusted = item.score - diversityPenalty;
      if (adjusted > bestAdjusted) { bestAdjusted=adjusted; bestIndex=index; }
    });
    const chosen = scored.splice(bestIndex,1)[0];
    selected.push(chosen);
    const merchant = localNormalize(chosen.product.merchant || chosen.product.source || "");
    const category = localNormalize(chosen.product.objective || chosen.product.category || "");
    merchantCounts.set(merchant,(merchantCounts.get(merchant) || 0)+1);
    categoryCounts.set(category,(categoryCounts.get(category) || 0)+1);
  }

  const recommendations = selected.map(item => {
    const evidence = Array.from(new Map(item.matched.sort((a,b)=>b.weight-a.weight).map(match => [localNormalize(match.value),match])).values()).slice(0,2);
    const reason = evidence.length
      ? "Correspond à tes préférences de " + evidence.map(match => match.label + " " + match.value).join(" et ") + "."
      : "Cette pièce respecte tes filtres et reste pertinente dans la sélection actuelle.";
    return {productId:item.product.id,reason};
  });
  const hints = [];
  profileFields.filter(([, ,amount]) => amount > 0).forEach(([profileKey]) => {
    (Array.isArray(profile[profileKey]) ? profile[profileKey] : []).slice(0,2).forEach(value => {
      if (value && !hints.includes(String(value))) hints.push(String(value));
    });
  });
  (Array.isArray(inspirations) ? inspirations : []).slice(0,3).forEach(pin => {
    (Array.isArray(pin && pin.tags) ? pin.tags : []).slice(0,2).forEach(value => {
      if (value && !hints.includes(String(value))) hints.push(String(value));
    });
  });
  return {
    recommendations,
    message:"J’ai analysé localement tes votes, ta garde-robe, ton profil et tes inspirations. Aucune donnée personnelle n’a quitté ton appareil.",
    searchHints:hints.slice(0,3),
    candidateCount:candidates.length,
    provider:"local"
  };
}
