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
  return { id:clean(product.id,128), name:clean(product.name), brand:clean(product.brand,80), merchant:clean(product.merchant || product.source,80), price:product.price == null ? null : Number(product.price), objective:clean(product.objective || product.category,40), category:clean(product.category,60), styleTags:list(product.styleTags,6), colors:list(product.colors,5), materials:list(product.materials,5), cuts:list(product.cuts,4), patterns:list(product.patterns,4), seasonTags:list(product.seasonTags,4), description:clean(product.description,240) };
}
function feedbackProducts(state, key) {
  const products = new Map((state.products || []).map(product => [product.id, product]));
  const events = Array.isArray(state.interactions && state.interactions[key]) ? state.interactions[key] : [];
  const seen = new Set();
  return events.slice(-MAX_HISTORY).reverse().map(event => { const product = products.get(event.productId); if (!product || seen.has(product.id)) return null; seen.add(product.id); return productSummary(product); }).filter(Boolean);
}
function savedProducts(state) {
  const products = new Map((state.products || []).map(product => [product.id, product]));
  const saved = Array.isArray(state.likedProducts) ? state.likedProducts : [];
  const seen = new Set();
  return saved.slice(-MAX_HISTORY).reverse().map(item => { const product = products.get(item.productId); if (!product || seen.has(product.id)) return null; seen.add(product.id); return productSummary(product); }).filter(Boolean);
}
export function createAgentPayload(state, candidates, inspirations) {
  const settings = state.settings || {}, profile = state.profile || {};
  return {
    filters:{ objective:settings.objective || "Tout", style:settings.style || "Tous", season:settings.season || "Toute saison", maxPrice:settings.maxPrice == null ? null : Number(settings.maxPrice) },
    profile:{ preferredStyles:list(profile.preferredStyles,12), excludedStyles:list(profile.excludedStyles,12), favoriteBrands:list(profile.favoriteBrands,12), excludedBrands:list(profile.excludedBrands,12), preferredColors:list(profile.preferredColors,12), excludedColors:list(profile.excludedColors,12), preferredMaterials:list(profile.preferredMaterials,12), excludedMaterials:list(profile.excludedMaterials,12), preferredCuts:list(profile.preferredCuts,12), excludedCuts:list(profile.excludedCuts,12), comfort:clean(profile.comfort,50), fit:clean(profile.fit,50) },
    feedback:{ liked:feedbackProducts(state,"likes"), saved:savedProducts(state), disliked:feedbackProducts(state,"dislikes") },
    inspirations:(Array.isArray(inspirations) ? inspirations : []).slice(0,12).map(item => ({ title:clean(item.title,100), tags:list(item.tags,10) })),
    products:(Array.isArray(candidates) ? candidates : []).slice(0,MAX_CANDIDATES).map(productSummary)
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