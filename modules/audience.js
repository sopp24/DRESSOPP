// Public masculin des fiches : un seul endroit décide si une pièce peut être proposée.
// « men »    : homme confirmé (texte de la fiche, déclaration vérifiée ou boutique 100 % homme) ;
// « unisex » : pièce unisexe qui se porte aussi bien côté homme ;
// ""         : femme, pièce typiquement féminine ou public inconnu → jamais proposée.
function text(value) { return String(value == null ? "" : value).trim(); }
function normalizeText(value) { return text(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }

const FEMININE_ITEM = /(^|[^a-z])(robes?|jupes?|dress|skirt|soutien|brassiere|bustier|corset|culottes?|bikini|lingerie|escarpins?|talons?|ballerines?|collants?|combinaisons?|jumpsuit|crop top|top court|sac a main|handbag)([^a-z]|$)/;

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

let menMerchants = new Set();
export function registerMenMerchants(entries) {
  const keys = [];
  (Array.isArray(entries) ? entries : []).forEach(function(entry) {
    if (!entry || entry.audience !== "men") return;
    keys.push(normalizeText(entry.name), normalizeText(entry.domain).replace(/^www\./, ""));
  });
  menMerchants = new Set(keys.filter(Boolean));
}
function hostOf(value) {
  try { return new URL(String(value)).hostname.toLowerCase().replace(/^www\./, ""); } catch (error) { return ""; }
}
export function isMenMerchant(source) {
  const item = source || {};
  if (!menMerchants.size) return false;
  const names = [item.merchant, item.shop, item.store, item.source, item.brand].map(normalizeText);
  if (names.some(function(name) { return name && menMerchants.has(name); })) return true;
  const host = hostOf(item.url || item.productUrl || item.link);
  return Boolean(host) && Array.from(menMerchants).some(function(key) { return host === key || host.endsWith("." + key); });
}

export function inferMenFit(source, knownGender) {
  const item = source || {};
  const gender = knownGender || inferProductGender(item);
  if (gender === "women") return "";
  const title = normalizeText([item.name, item.title, item.category, item.objective].filter(Boolean).join(" "));
  const feminine = FEMININE_ITEM.test(title);
  if (gender === "men") return "men";
  if (feminine) return "";
  if (gender === "unisex") return "unisex";
  return isMenMerchant(item) ? "men" : "";
}

export function isMenFit(product) {
  if (!product) return false;
  if (product.menFit !== undefined) return product.menFit === "men" || product.menFit === "unisex";
  return product.gender === "men" && product.genderVerified === true;
}
