const TOKEN_KEY = "dressopp-community-auth-v1";
const API_ROOT = "https://identitytoolkit.googleapis.com/v1";
const FIRESTORE_ROOT = "https://firestore.googleapis.com/v1";

function normalize(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}
function readToken() {
  try { return JSON.parse(localStorage.getItem(TOKEN_KEY) || "null"); } catch { return null; }
}
function saveToken(value) {
  try { localStorage.setItem(TOKEN_KEY, JSON.stringify(value)); } catch {}
}
function productFeatures(product) {
  const features = [];
  const add = (type, value) => {
    const clean = normalize(value);
    if (clean) features.push(type + ":" + clean.slice(0, 48));
  };
  add("category", product.objective || product.category);
  add("brand", product.brand);
  (product.styleTags || []).forEach(value => add("style", value));
  (product.colors || []).forEach(value => add("color", value));
  (product.materials || []).forEach(value => add("material", value));
  (product.cuts || []).forEach(value => add("cut", value));
  return features;
}
export function buildCommunityFeatures(state) {
  const positive = new Set(), negative = new Set();
  const byId = new Map((state.products || []).map(product => [product.id, product]));
  const add = (target, productId) => {
    const product = byId.get(productId);
    if (product) productFeatures(product).forEach(feature => target.add(feature));
  };
  (state.interactions && state.interactions.likes || []).forEach(item => add(positive, item.productId));
  (state.likedProducts || []).forEach(item => add(positive, item.productId));
  (state.interactions && state.interactions.dislikes || []).forEach(item => add(negative, item.productId));
  const profile = state.profile || {};
  (profile.preferredStyles || []).forEach(value => positive.add("style:" + normalize(value)));
  (profile.preferredColors || []).forEach(value => positive.add("color:" + normalize(value)));
  (profile.preferredMaterials || []).forEach(value => positive.add("material:" + normalize(value)));
  (profile.favoriteBrands || []).forEach(value => positive.add("brand:" + normalize(value)));
  (profile.excludedColors || []).forEach(value => negative.add("color:" + normalize(value)));
  (profile.excludedMaterials || []).forEach(value => negative.add("material:" + normalize(value)));
  (profile.excludedBrands || []).forEach(value => negative.add("brand:" + normalize(value)));
  return {
    positive: Array.from(positive).filter(value => value.length <= 70).slice(0, 60),
    negative: Array.from(negative).filter(value => value.length <= 70).slice(0, 40)
  };
}

async function authRequest(path, body, apiKey) {
  const response = await fetch(API_ROOT + path + "?key=" + encodeURIComponent(apiKey), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error && payload.error.message || "Authentification communautaire indisponible.");
  return payload;
}
async function getAuth(config) {
  if (!config || !config.enabled || !config.apiKey || !config.projectId) throw new Error("La communauté gratuite n'est pas encore configurée.");
  let token = readToken();
  if (token && token.expiresAt > Date.now() + 60000 && token.idToken && token.localId) return token;
  if (token && token.refreshToken) {
    const response = await fetch("https://securetoken.googleapis.com/v1/token?key=" + encodeURIComponent(config.apiKey), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: token.refreshToken })
    });
    const payload = await response.json().catch(() => ({}));
    if (response.ok && payload.id_token) {
      token = {
        idToken: payload.id_token, refreshToken: payload.refresh_token || token.refreshToken,
        localId: payload.user_id || token.localId, expiresAt: Date.now() + Number(payload.expires_in || 3600) * 1000
      };
      saveToken(token);
      return token;
    }
  }
  const payload = await authRequest("/accounts:signUp", { returnSecureToken: true }, config.apiKey);
  token = {
    idToken: payload.idToken, refreshToken: payload.refreshToken,
    localId: payload.localId, expiresAt: Date.now() + Number(payload.expiresIn || 3600) * 1000
  };
  saveToken(token);
  return token;
}
function firestoreUrl(config, path) {
  return FIRESTORE_ROOT + "/projects/" + encodeURIComponent(config.projectId) +
    "/databases/(default)/documents/" + path;
}
async function firestoreRequest(url, token, options = {}) {
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: { authorization: "Bearer " + token, "content-type": "application/json" },
    ...(options.body ? { body: JSON.stringify(options.body) } : {})
  });
  if (response.status === 404 && options.allow404) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error && payload.error.message || "Base communautaire temporairement indisponible.");
  return payload;
}
export async function deleteCommunityProfile(config) {
  const token = readToken();
  if (!token || !config || !config.enabled || !config.projectId || !config.apiKey) return { ok: true, removed: false };
  const auth = await getAuth(config);
  const url = firestoreUrl(config, "communityProfiles/" + encodeURIComponent(auth.localId));
  await firestoreRequest(url, auth.idToken, { method: "DELETE", allow404: true });
  return { ok: true, removed: true };
}
export async function syncCommunityProfile(state, config) {
  const features = buildCommunityFeatures(state);
  const amount = (state.interactions && state.interactions.likes || []).length +
    (state.interactions && state.interactions.dislikes || []).length + (state.likedProducts || []).length;
  if (!config || !config.enabled || !config.apiKey || !config.projectId) return { configured: false, profiles: [], count: amount };
  if (features.positive.length + features.negative.length < 4 || amount < 3) {
    return { configured: true, synced: false, profiles: [], count: amount, message: "Encore quelques décisions nécessaires avant de partager un profil utile." };
  }
  const auth = await getAuth(config);
  const path = "communityProfiles/" + encodeURIComponent(auth.localId);
  const document = {
    fields: {
      schemaVersion: { integerValue: "1" },
      updatedAt: { timestampValue: new Date().toISOString() },
      positive: { arrayValue: { values: features.positive.map(value => ({ stringValue: value })) } },
      negative: { arrayValue: { values: features.negative.map(value => ({ stringValue: value })) } }
    }
  };
  await firestoreRequest(firestoreUrl(config, path), auth.idToken, { method: "PATCH", body: document });
  const data = await firestoreRequest(firestoreUrl(config, "communityProfiles?pageSize=150"), auth.idToken);
  const profiles = (data.documents || []).filter(item => item.name && !item.name.endsWith("/" + auth.localId)).map(item => {
    const fields = item.fields || {};
    return {
      positive: ((fields.positive && fields.positive.arrayValue && fields.positive.arrayValue.values) || []).map(value => value.stringValue).filter(Boolean),
      negative: ((fields.negative && fields.negative.arrayValue && fields.negative.arrayValue.values) || []).map(value => value.stringValue).filter(Boolean)
    };
  });
  return { configured: true, synced: true, profiles, count: amount, neighbors: profiles.length };
}
export function buildCommunitySignals(profiles, state) {
  const own = new Set(buildCommunityFeatures(state).positive);
  const positive = Object.create(null), negative = Object.create(null);
  let neighbors = 0;
  for (const profile of profiles || []) {
    const other = new Set(profile.positive || []);
    const shared = Array.from(own).filter(value => other.has(value)).length;
    const union = new Set([...own, ...other]).size || 1;
    const similarity = shared / union;
    if (shared < 1 || similarity < 0.035) continue;
    neighbors++;
    const weight = Math.min(1.8, similarity * 8);
    (profile.positive || []).forEach(feature => { positive[feature] = (positive[feature] || 0) + weight; });
    (profile.negative || []).forEach(feature => { negative[feature] = (negative[feature] || 0) + weight; });
  }
  return { positive, negative, neighbors };
}
