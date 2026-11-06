import { loadState, saveState, clearState } from "./modules/store.js";
import { createInitialState, normalizeProduct, productIdentity, seasonFor, rankProducts, deriveLearnedPreferences, matchesFilters } from "./modules/engine.js";
import { INTEGRATIONS, getPersistenceNotice, PINTEREST_BOARD_URL } from "./modules/integrations.js";
import { inferPinterestTags, buildOutfitIdeas } from "./modules/outfits.js";
import { syncCommunityProfile, deleteCommunityProfile, buildCommunitySignals } from "./modules/community.js";
import { requestAgentRecommendations, orderProductsByAgent } from "./modules/agent.js";

const main = document.querySelector("#app-main");
const modalRoot = document.querySelector("#modal-root");
const toastRoot = document.querySelector("#toast-root");
const saveStatus = document.querySelector("#save-status");
let state = null;
let currentView = "discover";
let currentModalProduct = null;
let toastTimer = null;
let persistPending = false;
let persistRevision = 0;
let persistPromise = Promise.resolve();
let pinterestFeed = { privacy: "UNKNOWN", pins: [], lastSync: null, newPinIds: [] };
let lookbookFeed = { source: "lookbook", season: "Automne / Hiver", pins: [] };
let catalogMeta = {
  status: "needs-configuration", productCount: 0, liveProductCount: 0,
  curatedProductCount: 0, sources: [], syncedAt: null,
  message: "Catalogue multi-sources gratuit prêt à être actualisé."
};
let communityConfig = { enabled:false, apiKey:"", projectId:"" };
let communitySignals = { positive:{}, negative:{}, neighbors:0 };
let communityStatus = "Partage désactivé";
let lastCommunitySyncCount = 0;
let communitySyncPending = false;
let aiAgentConfig = { enabled:false, endpoint:"" };
let aiAgentState = { status:"unconfigured", recommendations:[], message:"", searchHints:[], candidateCount:0 };
let aiAgentPending = false;
let aiAgentLastActionCount = 0;
let aiAgentController = null;


const RETAILER_GROUPS = [
  { title: "Multimarques & essentiels", items: [
    ["Zalando", "https://www.zalando.fr/catalogue/"], ["ASOS", "https://www.asos.com/fr/"],
    ["ABOUT YOU", "https://www.aboutyou.fr/"], ["La Redoute", "https://www.laredoute.fr/"],
    ["Galeries Lafayette", "https://www.galerieslafayette.com/"], ["Printemps", "https://www.printemps.com/"]
  ]},
  { title: "Accessible & casual", items: [
    ["UNIQLO", "https://www.uniqlo.com/fr/fr/"], ["Zara", "https://www.zara.com/fr/"],
    ["BZB", "https://www.b-z-b.com/"], ["Pull & Bear", "https://www.pullandbear.com/fr/"],
    ["Bershka", "https://www.bershka.com/fr/"], ["H&M", "https://www2.hm.com/fr_fr/index.html"],
    ["Mango", "https://shop.mango.com/fr/homme"], ["Celio", "https://www.celio.com/"],
    ["Jules", "https://www.jules.com/"], ["Weekday", "https://www.weekday.com/"],
    ["Kiabi", "https://www.kiabi.com/"], ["C&A", "https://www.c-and-a.com/fr/fr/shop"]
  ]},
  { title: "Premium, casual & heritage", items: [
    ["COS", "https://www.cos.com/fr-fr/"], ["ARKET", "https://www.arket.com/fr-fr/"],
    ["Massimo Dutti", "https://www.massimodutti.com/fr/"], ["Levi's", "https://www.levi.com/FR/fr_FR/"],
    ["Carhartt WIP", "https://www.carhartt-wip.com/fr"], ["Jack & Jones", "https://www.jackjones.com/fr-fr/"],
    ["Charles Tyrwhitt", "https://www.charlestyrwhitt.com/fr/"], ["Lacoste", "https://www.lacoste.com/fr/"],
    ["Fred Perry", "https://www.fredperry.com/"], ["Tommy Hilfiger", "https://fr.tommy.com/"],
    ["Polo Ralph Lauren", "https://www.ralphlauren.fr/"], ["Lothaire", "https://www.lothaire.fr/"]
  ]},
  { title: "Luxe & seconde main", items: [
    ["Louis Vuitton", "https://fr.louisvuitton.com/"], ["Dior", "https://www.dior.com/fr_fr/"],
    ["24S", "https://www.24s.com/"], ["Vestiaire Collective", "https://fr.vestiairecollective.com/"]
  ]},
  { title: "Sneakers & sport", items: [
    ["Nike", "https://www.nike.com/fr/"], ["adidas", "https://www.adidas.fr/"],
    ["New Balance", "https://www.newbalance.fr/"], ["Puma", "https://eu.puma.com/fr/fr"],
    ["ASICS", "https://www.asics.com/fr/fr-fr/"], ["Converse", "https://www.converse.com/fr/"],
    ["Courir", "https://www.courir.com/fr/"], ["JD Sports", "https://www.jdsports.fr/"],
    ["Foot Locker", "https://www.footlocker.fr/"], ["Snipes", "https://www.snipes.com/"],
    ["Decathlon", "https://www.decathlon.fr/"]
  ]},
  { title: "Chaussures & sous-vêtements", items: [
    ["Sarenza", "https://www.sarenza.com/"], ["Spartoo", "https://www.spartoo.com/"],
    ["Calvin Klein", "https://www.calvinklein.fr/"], ["Undiz", "https://www.undiz.com/"]
  ]}
];

const OBJECTIVES = ["Vêtements", "Chaussures", "Sous-vêtements", "Accessoires"];
const STYLES = ["Classique", "Créatif", "Classe", "Sport", "Été", "Preppy", "Smart Casual", "Casual", "Streetwear", "Vintage", "Workwear", "Heritage"];
const SEASONS = ["Printemps", "Automne", "Été", "Hiver", "Toute saison"];

function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, function(character) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
  });
}
function normalizeWords(value) {
  return String(value || "").split(/[,;|]/).map(function(item) { return item.trim(); }).filter(Boolean);
}
function formatPrice(value) {
  if (value == null || !Number.isFinite(Number(value))) return "Information non disponible";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(Number(value));
}
function productById(id) {
  return state.products.find(function(product) { return product.id === id; }) || null;
}
function isLiked(id) {
  return state.likedProducts.some(function(item) { return item.productId === id; });
}
function hasRated(id) {
  return state.interactions.likes.concat(state.interactions.dislikes).some(function(item) { return item.productId === id; });
}
function safeExternalUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch (error) { return ""; }
}
function updateSaveStatus(message, status) {
  if (!saveStatus) return;
  saveStatus.classList.toggle("is-saving", status === "saving");
  saveStatus.classList.toggle("is-error", status === "error");
  const label = saveStatus.querySelector("span");
  if (label) label.textContent = message;
}
function communityActionCount() {
  return (state && state.interactions ? state.interactions.likes.length + state.interactions.dislikes.length : 0) +
    (state && state.likedProducts ? state.likedProducts.length : 0);
}
async function refreshCommunity(showFeedback) {
  if (!state || !state.settings.communitySharing) return;
  if (!communityConfig.enabled || !communityConfig.apiKey || !communityConfig.projectId) {
    communityStatus = "À configurer · voir le guide communautaire gratuit";
    if (showFeedback) showToast("Configure d'abord Firebase gratuit en suivant le guide communautaire.", false);
    return;
  }
  if (communitySyncPending) return;
  communitySyncPending = true;
  try {
    const result = await syncCommunityProfile(state, communityConfig);
    if (!result.configured) {
      communityStatus = "Configuration Firebase manquante";
      return;
    }
    if (!result.synced) {
      communityStatus = result.message || "Quelques décisions supplémentaires sont nécessaires.";
      return;
    }
    communitySignals = buildCommunitySignals(result.profiles, state);
    lastCommunitySyncCount = communityActionCount();
    communityStatus = "Profil de goûts pseudonymisé actualisé · " + communitySignals.neighbors + " profil(s) similaire(s)";
    if (showFeedback) showToast("Recommandations communautaires activées.", false);
    if (currentView === "settings") render();
  } catch (error) {
    communityStatus = "Synchronisation indisponible · " + error.message;
    if (showFeedback) showToast("La communauté n'a pas pu être synchronisée : " + error.message, false);
  } finally {
    communitySyncPending = false;
  }
}
function aiAgentActionCount() {
  if (!state) return 0;
  const interactions = state.interactions || {};
  const saveCount = Array.isArray(interactions.saves) && interactions.saves.length
    ? interactions.saves.length : (state.likedProducts ? state.likedProducts.length : 0);
  return (Array.isArray(interactions.likes) ? interactions.likes.length : 0) +
    (Array.isArray(interactions.dislikes) ? interactions.dislikes.length : 0) + saveCount;
}
function aiAgentInspirations() {
  return pinterestPinCards().slice(0,12).map(function(pin) {
    return { title:pin.title || "", tags:Array.isArray(pin.tags) ? pin.tags : [] };
  });
}
function aiAgentContextSignature(training) {
  const settings = state.settings || {}, profile = state.profile || {};
  const products = rankProducts(state.products,state,{training:training,communitySignals:communitySignals}).slice(0,50);
  return JSON.stringify({
    objective:settings.objective, style:settings.style, season:settings.season, maxPrice:settings.maxPrice,
    discoveryLevel:training ? settings.trainingDiscoveryLevel : settings.discoveryLevel,
    sizes:profile.sizes || {}, preferredStyles:profile.preferredStyles || [], excludedStyles:profile.excludedStyles || [],
    favoriteBrands:profile.favoriteBrands || [], excludedBrands:profile.excludedBrands || [],
    preferredColors:profile.preferredColors || [], excludedColors:profile.excludedColors || [],
    preferredMaterials:profile.preferredMaterials || [], excludedMaterials:profile.excludedMaterials || [],
    preferredCuts:profile.preferredCuts || [], excludedCuts:profile.excludedCuts || [], comfort:profile.comfort, fit:profile.fit,
    candidateIds:products.map(product => product.id), inspirations:aiAgentInspirations()
  });
}
async function runAiAgent(showFeedback) {
  if (!state || !state.settings.aiAgentConsent) {
    if (showFeedback) showToast("Lis les informations et accepte le partage facultatif pour activer le personal shopper IA.",false);
    return;
  }
  if (!aiAgentConfig.enabled || !aiAgentConfig.endpoint) {
    aiAgentState = { status:"unconfigured", recommendations:[], message:"Le Worker IA gratuit doit d’abord être déployé et son URL renseignée.", searchHints:[], candidateCount:0 };
    if (showFeedback) showToast("Configure le Worker Cloudflare en suivant le guide IA.",false);
    render();
    return;
  }
  if (aiAgentPending) return;
  const training = currentView === "training";
  const candidates = rankProducts(state.products,state,{training:training,communitySignals:communitySignals}).slice(0,50);
  if (!candidates.length) {
    aiAgentState = { status:"empty", recommendations:[], message:"Aucun article disponible dans cette catégorie et avec ces filtres. Élargis la recherche ou attends la prochaine collecte.", searchHints:[], candidateCount:0 };
    render();
    return;
  }
  const requestActionCount = aiAgentActionCount();
  const requestContext = aiAgentContextSignature(training);
  aiAgentPending = true;
  aiAgentState = { status:"loading", recommendations:[], message:"L’agent compare tes références, tes dernières décisions et les articles disponibles…", searchHints:[], candidateCount:candidates.length };
  aiAgentLastActionCount = requestActionCount;
  render();
  try {
    const controller = new AbortController();
    aiAgentController = controller;
    const result = await requestAgentRecommendations(aiAgentConfig.endpoint,state,candidates,aiAgentInspirations(),{signal:controller.signal});
    const contextChanged = !state.settings.aiAgentConsent || aiAgentActionCount() !== requestActionCount ||
      (currentView === "training") !== training || aiAgentContextSignature(training) !== requestContext;
    if (contextChanged) {
      aiAgentState = { status:"stale", recommendations:[], message:"Tes filtres ou tes derniers retours ont changé pendant l’analyse. Relance l’agent pour obtenir un classement à jour.", searchHints:[], candidateCount:result.candidateCount };
      if (showFeedback) showToast("Tes choix ont changé pendant l’analyse. Relance le personal shopper.",false);
    } else {
      aiAgentState = { status:"ready", recommendations:result.recommendations, message:result.message, searchHints:result.searchHints, candidateCount:result.candidateCount };
      if (showFeedback) showToast(result.recommendations.length + " recommandations sélectionnées par ton personal shopper IA.",false);
    }
  } catch (error) {
    if (!state.settings.aiAgentConsent || (error && error.name === "AbortError")) {
      aiAgentState = { status:"unconfigured", recommendations:[], message:"Partage IA désactivé. Le classement local continue de fonctionner.", searchHints:[], candidateCount:0 };
    } else {
      aiAgentState = { status:"error", recommendations:[], message:error.message + " Le classement local reste actif.", searchHints:[], candidateCount:candidates.length };
      if (showFeedback) showToast("Le personal shopper IA est indisponible : " + error.message,false);
    }
  } finally {
    aiAgentController = null;
    aiAgentPending = false;
    const actionDelta = aiAgentActionCount() - aiAgentLastActionCount;
    const autoEnabled = state && state.settings.aiAgentAutoRefresh && state.settings.aiAgentConsent && aiAgentConfig.enabled;
    const shouldRefresh = Boolean(autoEnabled && actionDelta >= 3);
    if (shouldRefresh && (currentView === "discover" || currentView === "training")) {
      aiAgentLastActionCount = aiAgentActionCount();
      runAiAgent(false);
    } else if (currentView === "discover" || currentView === "training") render();
  }
}
function renderAiAgentPanel() {
  const configured = Boolean(aiAgentConfig.enabled && aiAgentConfig.endpoint);
  const consent = Boolean(state.settings.aiAgentConsent);
  const ready = aiAgentState.status === "ready";
  const status = aiAgentPending ? "Analyse en cours" : ready ? "Sélection personnalisée prête" : aiAgentState.status === "error" ? "Service indisponible" : configured ? (consent ? "Prêt à analyser" : "En attente de ton accord") : "À déployer";
  const consentControl = configured
    ? '<label class="ai-agent-consent"><input id="ai-agent-consent" type="checkbox" ' + (consent ? "checked" : "") + '><span>J’accepte d’envoyer temporairement mes préférences générales, mes derniers retours et les résumés des articles candidats à Cloudflare pour générer des recommandations. Les tailles, notes personnelles, e-mail, URL et images ne sont pas transmis.</span></label>'
    : '<p class="ai-agent-help">Le service IA n’est pas encore déployé. Le moteur local fonctionne déjà. Le guide explique comment activer gratuitement le Worker sans clé secrète dans le navigateur.</p>';
  const autoControl = configured && consent
    ? '<label class="ai-agent-auto"><input id="ai-agent-auto" type="checkbox" ' + (state.settings.aiAgentAutoRefresh ? "checked" : "") + '> Actualiser l’analyse après trois nouvelles décisions</label>' : "";
  const button = configured && consent
    ? '<button class="button-primary button-small" type="button" data-action="run-ai-agent" ' + (aiAgentPending ? "disabled" : "") + '>' + (aiAgentPending ? "Analyse…" : ready ? "Actualiser mes recommandations" : "Faire analyser ma sélection") + '</button>' : "";
  const hints = ready && aiAgentState.searchHints.length
    ? '<div class="ai-agent-hints"><span>Prochaines pistes :</span>' + aiAgentState.searchHints.map(function(item) { return "<span>" + esc(item) + "</span>"; }).join("") + "</div>" : "";
  const note = ready ? '<p class="ai-agent-result-note">' + aiAgentState.recommendations.length + " articles classés parmi " + aiAgentState.candidateCount + " candidats réels du catalogue.</p>" : "";
  return '<section class="panel ai-agent-panel" aria-label="Personal shopper IA"><div class="ai-agent-top"><div><span class="eyebrow">Ton personal shopper</span><h2>Agent IA DRESSOPP</h2><p>Il interprète tes références et tes décisions pour choisir les prochains articles à découvrir.</p></div><span class="ai-agent-status ' + (ready ? "is-ready" : aiAgentPending ? "is-loading" : "") + '">' + esc(status) + '</span></div>' +
    consentControl +
    '<div class="ai-agent-controls">' + button + autoControl + '</div>' +
    (aiAgentState.message ? '<p class="ai-agent-message">' + esc(aiAgentState.message) + '</p>' : "") + note + hints +
    '<p class="ai-agent-disclaimer">L’IA classe uniquement des fiches déjà présentes dans le catalogue ; elle ne crée pas de produits ni de prix. Les inspirations visuelles sont exploitées via leurs titres et tags, pas par l’envoi de photos. Sans configuration ou si le quota gratuit est atteint, le moteur local prend le relais.</p>' +
    '<a class="ai-agent-guide" href="https://github.com/sopp24/DRESSOPP/blob/main/docs/AI-AGENT.md" target="_blank" rel="noopener noreferrer">Guide d’installation et confidentialité ↗</a></section>';
}
function aiAgentReason(productId) {
  if (aiAgentState.status !== "ready") return "";
  const item = aiAgentState.recommendations.find(function(entry) { return entry.productId === productId; });
  return item && item.reason ? '<p class="ai-agent-product-reason"><strong>Pourquoi l’IA le propose :</strong> ' + esc(item.reason) + '</p>' : "";
}
function invalidateAiAgentResults() {
  if (aiAgentState.status !== "ready" && !aiAgentPending) return;
  aiAgentState = {
    status:"stale", recommendations:[],
    message:"Ton dernier choix a été pris en compte. Relance l’agent pour obtenir une sélection actualisée.",
    searchHints:[], candidateCount:aiAgentState.candidateCount
  };
}
function persist() {
  persistRevision += 1;
  if (persistPending) return persistPromise;

  persistPending = true;
  updateSaveStatus("Sauvegarde…", "saving");
  persistPromise = (async function() {
    let result = null;
    try {
      let savedRevision = -1;
      do {
        savedRevision = persistRevision;
        result = await saveState(state);
        if (!result.ok) {
          updateSaveStatus("Échec de la sauvegarde locale", "error");
          showToast("La sauvegarde locale a échoué. Exporte tes données avant de quitter.", false);
          return result;
        }
        state.updatedAt = result.updatedAt;
        const communityCount = communityActionCount();
        if (state.settings.communitySharing && communityConfig.enabled &&
            communityCount >= 3 && communityCount - lastCommunitySyncCount >= 3) {
          lastCommunitySyncCount = communityCount;
          refreshCommunity(false);
        }
        const agentCount = aiAgentActionCount();
        if (state.settings.aiAgentAutoRefresh && state.settings.aiAgentConsent &&
            aiAgentConfig.enabled && agentCount >= 3 &&
            agentCount - aiAgentLastActionCount >= 3) {
          if (aiAgentPending) { /* L'agent vérifiera le compteur à la fin de l'analyse. */ }
          else {
            aiAgentLastActionCount = agentCount;
            runAiAgent(false);
          }
        }
      } while (savedRevision !== persistRevision);

      updateSaveStatus(result.warning ? "Sauvegarde locale de secours" : "Données enregistrées sur cet appareil", "ok");
      return result;
    } catch (error) {
      updateSaveStatus("Échec de la sauvegarde", "error");
      showToast("Erreur de sauvegarde : " + error.message, false);
      return { ok: false, error: error.message };
    } finally {
      persistPending = false;
    }
  })();
  return persistPromise;
}
function imageMarkup(url, label) {
  if (url) return '<img class="product-photo" src="' + esc(url) + '" alt="' + esc(label || "Photo du produit") + '" loading="lazy">';
  return '<div class="image-fallback"><span class="hanger" aria-hidden="true">⌁</span><small>Photo non renseignée</small></div>';
}
function renderPageHeading(eyebrow, title, description, actions) {
  return '<div class="page-heading"><div><span class="eyebrow">' + esc(eyebrow) + '</span><h1>' + esc(title) + '</h1><p>' + esc(description) + '</p></div><div class="heading-actions">' + (actions || "") + '</div></div>';
}
function selectOption(value, current, label) {
  return '<option value="' + esc(value) + '"' + (value === current ? " selected" : "") + ">" + esc(label || value) + "</option>";
}
function renderFilterBar(training) {
  const settings = state.settings;
  const saved = settings.savedFilters || [];
  const selectedLevel = training ? settings.trainingDiscoveryLevel : settings.discoveryLevel;
  return '<section class="panel filter-bar" aria-label="Filtres de découverte">' +
    '<div class="field"><label for="objective-filter">Objectif</label><select id="objective-filter" data-filter="objective">' +
      OBJECTIVES.map(function(item) { return selectOption(item, settings.objective); }).join("") +
      selectOption("Tout", settings.objective, "Toutes les catégories") + '</select></div>' +
    '<div class="field"><label for="style-filter">Style</label><select id="style-filter" data-filter="style">' +
      selectOption("Tous", settings.style, "Tous les styles") + STYLES.map(function(item) { return selectOption(item, settings.style); }).join("") +
      '</select></div>' +
    '<div class="field"><label for="season-filter">Saison</label><select id="season-filter" data-filter="season">' +
      selectOption(seasonFor(new Date()), settings.season, "Saison actuelle · " + seasonFor(new Date())) +
      SEASONS.map(function(item) { return selectOption(item, settings.season); }).join("") +
      '</select></div>' +
    '<div class="field"><label for="price-filter">Budget maximum (€)</label><input id="price-filter" data-filter="maxPrice" type="number" min="0" step="1" value="' + (settings.maxPrice == null ? "" : esc(settings.maxPrice)) + '" placeholder="Sans limite"></div>' +
    '<div class="field"><label for="preset-filter">Mes filtres enregistrés</label><select id="preset-filter" data-filter="preset">' +
      selectOption("", "", saved.length ? "Charger un filtre" : "Aucun filtre enregistré") +
      saved.map(function(item, index) { return selectOption(String(index), "", item.name || ("Filtre " + (index + 1))); }).join("") +
      '</select></div></section>' +
    '<div class="filter-footer"><label class="discovery-level"><span>Mes goûts</span><input type="range" min="0" max="100" step="1" data-filter="' + (training ? "trainingDiscoveryLevel" : "discoveryLevel") + '" value="' + esc(selectedLevel) + '"><span>Découverte</span><output id="discovery-output">' + esc(selectedLevel) + '%</output></label>' +
    '<div class="filter-tools"><button class="button-quiet button-small" type="button" data-action="save-filters">＋ Enregistrer ces filtres</button></div></div>';
}
function renderEmptyProducts(training) {
  const title = state.products.length ? "Aucun article ne correspond à ces filtres" : "Ton dressing commence ici";
  const body = state.products.length
    ? "Élargis ton budget, change de style ou sélectionne une autre saison pour relancer la découverte."
    : "Ajoute des fiches produits vérifiables ou importe un catalogue JSON. DRESSOPP ne remplit pas ton dressing avec des articles ou des prix inventés.";
  return '<div class="empty-state"><div class="empty-mark">＋</div><h2>' + title + '</h2><p>' + body + '</p><div class="empty-actions">' +
    '<button class="button-primary" type="button" data-action="add-product">Ajouter un article</button>' +
    '<button class="button-secondary" type="button" data-action="import-catalog">Importer un catalogue JSON</button></div></div>';
}
function productColorSwatch(value) {
  const key = String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const palette = {
    "noir":"#171717","black":"#171717","blanc":"#ffffff","white":"#ffffff",
    "ecru":"#eee9db","creme":"#eee9db","cream":"#eee9db","beige":"#d9c6a5",
    "gris":"#929292","grey":"#929292","gray":"#929292","anthracite":"#454545",
    "marron":"#76513b","brown":"#76513b","chocolat":"#563a2b","camel":"#b58a5b",
    "bordeaux":"#6b1832","burgundy":"#6b1832","rouge":"#c51d32","red":"#c51d32",
    "rose":"#d99ba9","pink":"#d99ba9","vert":"#55704d","green":"#55704d",
    "olive":"#77764a","kaki":"#77764a","bleu":"#526f91","blue":"#526f91",
    "marine":"#243a58","navy":"#243a58","bleu ciel":"#a8c9df","jaune":"#e4c75b",
    "orange":"#d9863e","violet":"#80628f","prune":"#67405f"
  };
  return palette[key] || "#a5a5a5";
}
function renderProductAttributes(product) {
  const colors = Array.isArray(product.colors) ? product.colors.filter(Boolean).slice(0, 4) : [];
  const materials = Array.isArray(product.materials) ? product.materials.filter(Boolean).slice(0, 4) : [];
  const colorValues = colors.length
    ? colors.map(function(color) {
        return '<span class="product-color-value"><i aria-hidden="true" style="background:' + productColorSwatch(color) + '"></i>' + esc(color) + '</span>';
      }).join("")
    : '<span class="product-attribute-missing">Non renseignée</span>';
  const materialValues = materials.length
    ? materials.map(function(material) { return esc(material); }).join('<span class="attribute-separator">·</span>')
    : '<span class="product-attribute-missing">Non renseignée</span>';
  return '<div class="product-attributes">' +
    '<div class="product-attribute-group"><strong>Couleurs (' + colors.length + ') :</strong><span class="product-attribute-values">' + colorValues + '</span></div>' +
    '<div class="product-attribute-group"><strong>Matière (' + materials.length + ') :</strong><span class="product-attribute-values">' + materialValues + '</span></div>' +
    '</div>';
}
function renderProductReview(product) {
  const rating = Number(product.productRating);
  const hasRating = Number.isFinite(rating) && rating > 0 && rating <= 5;
  const count = Number(product.productRatingCount);
  const ratingSource = product.productRatingSource || "Source marchand";
  const ratingText = hasRating
    ? '<p class="product-review-note"><strong>★ ' + rating.toFixed(1).replace(".", ",") + '/5</strong>' +
      (Number.isFinite(count) && count > 0 ? ' · ' + count.toLocaleString("fr-FR") + ' avis' : '') +
      ' <span>· ' + esc(ratingSource) + '</span></p>'
    : '';
  const merchantRating = Number(product.merchantRating);
  const hasMerchantRating = Number.isFinite(merchantRating) && merchantRating > 0 && merchantRating <= 5;
  const merchantCount = Number(product.merchantRatingCount);
  const merchantSource = product.merchantRatingSource || "Source marchand";
  const merchantRatingText = hasMerchantRating
    ? '<p class="product-review-note merchant-review-note"><strong>Fiabilité marchand : ★ ' + merchantRating.toFixed(1).replace(".", ",") + '/5</strong>' +
      (Number.isFinite(merchantCount) && merchantCount > 0 ? ' · ' + merchantCount.toLocaleString("fr-FR") + ' avis' : '') +
      ' <span>· ' + esc(merchantSource) + '</span></p>'
    : '';
  const verified = product.verifiedAt ? new Date(product.verifiedAt).toLocaleDateString("fr-FR") : "";
  let freshness = "";
  if (product.catalogStatus === "stale") {
    freshness = '<p class="product-freshness is-stale">Flux marchand non actualisé · fiche conservée dans ta liste</p>';
  } else if (product.sourceType === "curated") {
    freshness = '<p class="product-freshness">Prix relevé le ' + esc(verified || "5 novembre 2026") + ' · disponibilité à confirmer sur la boutique</p>';
  } else if (product.sourceType === "public-web") {
    freshness = '<p class="product-freshness">Fiche publique vérifiée le ' + esc(verified) + ' · prix et stock à confirmer sur la boutique</p>';
  }
  return ratingText + merchantRatingText + freshness;
}
function renderCatalogStatus() {
  const liveCount = Number(catalogMeta.liveProductCount) ||
    state.products.filter(product => product.sourceType === "public-web" && product.catalogStatus === "active").length;
  const curatedCount = Number(catalogMeta.curatedProductCount) ||
    state.products.filter(product => product.sourceType === "curated").length;
  const syncedAt = catalogMeta.syncedAt ? new Date(catalogMeta.syncedAt).toLocaleString("fr-FR") : "Pas encore actualisé";
  const connected = catalogMeta.status === "connected" || catalogMeta.status === "partial";
  const sourceLabel = Array.isArray(catalogMeta.sources) && catalogMeta.sources.length
    ? catalogMeta.sources.slice(0, 8).join(" · ") + (catalogMeta.sources.length > 8 ? " · +" + (catalogMeta.sources.length - 8) : "")
    : "Les boutiques accessibles seront détectées automatiquement";
  const message = connected
    ? "Dernière exploration : " + syncedAt + " · " + Number(catalogMeta.sourceCount || 0) + " boutique(s) ayant fourni des produits"
    : "Catalogue gratuit sans compte marchand. La première exploration automatique est à lancer depuis GitHub Actions.";
  return '<section class="catalog-status panel ' + (connected ? "is-connected" : "is-pending") + '" aria-label="État du catalogue public">' +
    '<div class="catalog-status-main"><span class="eyebrow">Catalogue public multi-boutiques</span><strong>' + liveCount + ' article(s) publics exploitables</strong>' +
    '<p>' + esc(message) + '</p><small>' + esc(sourceLabel) + '</small></div><div class="catalog-status-side"><span>' +
    curatedCount + ' référence(s) éditoriale(s)</span><a class="button-quiet button-small" href="https://github.com/sopp24/DRESSOPP/blob/main/docs/SOURCES.md" target="_blank" rel="noopener noreferrer">Sources & fonctionnement ↗</a></div></section>';
}
function renderRetailerDirectory() {
  const groups = RETAILER_GROUPS.map(function(group) {
    return '<div class="retailer-group"><h3>' + esc(group.title) + '</h3><div class="retailer-links">' +
      group.items.map(function(item) {
        return '<a class="retailer-link" href="' + esc(item[1]) + '" target="_blank" rel="noopener noreferrer"><span>' + esc(item[0]) + '</span><i aria-hidden="true">↗</i></a>';
      }).join("") + '</div></div>';
  }).join("");
  return '<section class="panel retailer-directory"><div class="retailer-directory-heading"><div><span class="eyebrow">Tes sources</span><h2>Explorer les boutiques</h2>' +
    '<p>Les flux autorisés alimentent le swipe. Ces raccourcis te laissent aussi consulter les boutiques qui ne proposent pas de flux accessible.</p></div>' +
    '<a class="button-quiet button-small" href="https://www.facebook.com/ads/library/?active_status=active&ad_type=ALL&country=FR" target="_blank" rel="noopener noreferrer">Meta Ad Library ↗</a></div>' +
    '<div class="retailer-groups">' + groups + '</div>' +
    '<p class="retailer-disclaimer">La Meta Ad Library donne accès à des publicités publiques, pas à ton fil publicitaire Instagram personnalisé. Les avis d’article ne sont pas assimilés à une note de fiabilité de la boutique.</p></section>';
}
function renderDeckCard(product, training) {
  const brand = product.brand || product.merchant || product.source || "Marque non renseignée";
  const price = formatPrice(product.price);
  const articleUrl = safeExternalUrl(product.url);
  const saved = isLiked(product.id);
  const originalLink = articleUrl
    ? '<a class="product-original-link" href="' + esc(articleUrl) + '" target="_blank" rel="noopener noreferrer"><span>Voir l’article original</span><i aria-hidden="true">↗</i></a>'
    : '<button class="product-original-link" type="button" data-action="details" data-id="' + esc(product.id) + '"><span>Voir la fiche produit</span><i aria-hidden="true">↗</i></button>';
  return '<div class="deck-card-wrap"><article class="product-card" id="active-product-card" data-product-id="' + esc(product.id) + '">' +
    '<div class="product-visual">' + imageMarkup(product.imageUrl, product.name) + '</div>' +
    '<div class="product-info"><div class="product-copy">' +
      '<h2 class="product-title">' + esc(product.name) + '</h2>' +
      '<div class="product-brand-price"><span>' + esc(brand) + '</span><i aria-hidden="true">•</i><strong>' + esc(price) + '</strong></div>' +
      aiAgentReason(product.id) + renderProductAttributes(product) + renderProductReview(product) +
    '</div>' + originalLink + '</div>' +
    '</article><div class="deck-actions" aria-label="Actions sur cet article">' +
    '<button class="deck-action deck-action-undo" type="button" data-action="undo" ' + (state.interactions.lastAction ? "" : "disabled") + ' aria-label="Annuler la dernière action" title="Annuler la dernière action"><span aria-hidden="true">↶</span></button>' +
    '<button class="deck-action deck-action-no" type="button" data-action="vote" data-vote="no" data-id="' + esc(product.id) + '" aria-label="Non" title="Non"><span aria-hidden="true">×</span></button>' +
    '<button class="deck-action deck-action-save' + (saved ? ' is-selected' : '') + '" type="button" data-action="save-list" data-id="' + esc(product.id) + '" aria-label="' + (saved ? 'Déjà dans ma liste' : 'Ajouter à ma liste') + '" aria-pressed="' + String(saved) + '" title="' + (saved ? 'Dans ma liste' : 'Ajouter à ma liste') + '"><span aria-hidden="true">★</span></button>' +
    '<button class="deck-action deck-action-yes" type="button" data-action="vote" data-vote="yes" data-id="' + esc(product.id) + '" aria-label="Oui" title="Oui"><span aria-hidden="true">♥</span></button>' +
    '<button class="deck-action deck-action-share" type="button" data-action="share-product" data-id="' + esc(product.id) + '" aria-label="Partager cet article" title="Partager"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 3 10.8 13.2M21 3l-6.5 18-3.7-7.5L3 9.5 21 3Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
    '</div><p class="deck-hint">Glisse à gauche pour dire Non · à droite pour dire Oui</p></div>';
}
function renderGridCards(products, options) {
  const opts = options || {};
  if (!products.length) return renderEmptyProducts(false);
  return '<div class="product-grid">' + products.map(function(product) {
    const liked = isLiked(product.id);
    return '<article class="grid-card"><div class="grid-image" role="button" tabindex="0" data-action="details" data-id="' + esc(product.id) + '">' +
      imageMarkup(product.imageUrl, product.name) + '</div><div class="grid-content"><span class="product-brand">' + esc(product.brand || "Marque non renseignée") + '</span>' +
      '<h3 class="product-title">' + esc(product.name) + '</h3>' + aiAgentReason(product.id) + '<div class="product-meta"><span>' + esc(product.merchant || product.source) + '</span><i class="meta-dot"></i><span>' + esc(product.objective) + '</span></div>' +
      '<div class="grid-bottom"><span class="grid-price">' + esc(formatPrice(product.price)) + '</span><div class="grid-actions">' +
      '<button class="mini-icon-button" type="button" data-action="details" data-id="' + esc(product.id) + '" aria-label="Voir les détails">↗</button>' +
      (opts.wardrobe ? '<button class="mini-icon-button" type="button" data-action="remove-favorite" data-id="' + esc(product.id) + '" aria-label="Retirer de ma liste">−</button>' :
        '<button class="mini-icon-button ' + (liked ? "is-liked" : "") + '" type="button" data-action="' + (liked ? "remove-favorite" : "save-list") + '" data-id="' + esc(product.id) + '" aria-label="' + (liked ? "Retirer de ma liste" : "Ajouter à ma liste") + '">' + (liked ? "♥" : "♡") + '</button>') +
      '</div></div></div></article>';
  }).join("") + '</div>';
}
function renderDiscover(training) {
  const heading = training
    ? renderPageHeading("Élargis ton univers", "Entraînement", "Explore volontairement de nouvelles coupes, matières et associations. Tes réponses Oui et Non affinent le profil, sans ajout automatique à ta liste.", '<button class="button-secondary" type="button" data-view="discover">Retour à Découvrir</button>')
    : renderPageHeading("Ton œil, tes règles", "Découvrir", "Des pièces sélectionnées selon tes préférences. Glisse à gauche pour dire Non, à droite pour dire Oui, ou utilise les cinq actions sous la carte.", '<button class="button-secondary" type="button" data-action="toggle-discovery-view">' + (state.settings.discoveryView === "grid" ? "Vue cartes" : "Explorer la grille") + '</button>');
  const locallyRanked = rankProducts(state.products, state, { training: training, communitySignals: communitySignals });
  const products = aiAgentState.status === "ready"
    ? orderProductsByAgent(locallyRanked, aiAgentState.recommendations)
    : locallyRanked;
  const yesCount = state.interactions.likes.length;
  const savedCount = state.likedProducts.length;
  const rejected = state.interactions.dislikes.length;
  const isGrid = state.settings.discoveryView === "grid" && !training;
  const body = isGrid ? renderGridCards(products) : (products.length ? renderDeckCard(products[0], training) : renderEmptyProducts(training));
  const searchToolbar = isGrid ? '<div class="toolbar"><div class="toolbar-left"><input class="search-input" type="search" data-search="discover" placeholder="Rechercher un vêtement, une marque, une couleur…" aria-label="Rechercher dans le catalogue"></div><span class="result-count">' + products.length + ' article(s)</span></div>' : "";
  return heading + renderCatalogStatus() + renderFilterBar(training) + renderAiAgentPanel() + searchToolbar + '<div class="discovery-layout' + (isGrid ? '' : ' discovery-layout--swipe') + '"><section class="deck-column">' +
    '<div class="deck-topline"><span><strong>' + (training ? "Exploration active" : "Ta sélection") + '</strong> <span>· ' + products.length + ' article(s) à découvrir</span></span>' +
    '<span>' + (training ? "Nouveauté prioritaire" : "Personnalisation active") + '</span></div>' + body +
    '</section><aside class="deck-aside"><section class="panel aside-card"><h2 class="aside-title">Ton évolution <span>en direct</span></h2>' +
    '<p>Chaque décision affine ton profil. Une consultation reste un signal léger ; tes réponses Oui et Non comptent davantage.</p>' +
    '<div class="aside-stat"><div class="stat-box"><strong>' + yesCount + '</strong><small>Oui</small></div><div class="stat-box"><strong>' + rejected + '</strong><small>Non</small></div><div class="stat-box"><strong>' + savedCount + '</strong><small>Dans ma liste</small></div></div></section>' +
    '<section class="panel aside-card"><h2 class="aside-title">Équilibre du moment <span>' + esc(training ? state.settings.trainingDiscoveryLevel : state.settings.discoveryLevel) + '% découverte</span></h2>' +
    '<p>' + (training ? "Le mode Entraînement donne plus de poids à la nouveauté pour élargir ton terrain de jeu." : "Le curseur mélange tes goûts déjà identifiés et des propositions plus inattendues. Ajuste-le à tout moment.") + '</p></section>' +
    '<div class="source-note">Le classement combine les caractéristiques du lookbook, tes votes, la fraîcheur du flux et les avis d’article vérifiables. Les notes d’article ne représentent pas la fiabilité globale du marchand.</div>' +
    '</aside></div>' + renderRetailerDirectory();
}
function renderWardrobe() {
  const heading = renderPageHeading("Tes pièces retenues", "Ma garde-robe", "Tous tes coups de cœur au même endroit. Retirer un favori ne crée pas de rejet dans ton profil de style.", '<button class="button-primary" type="button" data-action="add-product">＋ Ajouter un article</button>');
  const wardrobeFilters = state.settings.wardrobeFilters || { objective: "Tout", style: "Tous", season: "Toute saison", maxPrice: null };
  const favorites = state.likedProducts.map(function(item) { return productById(item.productId); }).filter(Boolean).filter(function(product) { return matchesFilters(product, wardrobeFilters); });
  const sorted = favorites.slice().sort(function(a, b) {
    const sort = state.settings.wardrobeSort || "recent";
    if (sort === "price-asc") return (a.price == null ? Infinity : a.price) - (b.price == null ? Infinity : b.price);
    if (sort === "price-desc") return (b.price == null ? -Infinity : b.price) - (a.price == null ? -Infinity : a.price);
    if (sort === "name") return a.name.localeCompare(b.name, "fr");
    const dateA = state.likedProducts.find(function(item) { return item.productId === a.id; });
    const dateB = state.likedProducts.find(function(item) { return item.productId === b.id; });
    return new Date(dateB ? dateB.addedAt : 0) - new Date(dateA ? dateA.addedAt : 0);
  });
  const cards = renderGridCards(sorted, { wardrobe: true });
  return heading + '<div class="toolbar"><div class="toolbar-left"><input class="search-input" type="search" data-search="wardrobe" placeholder="Nom, marque, matière, couleur…" aria-label="Rechercher dans ma garde-robe"></div>' +
    '<div class="toolbar-right"><select data-wardrobe-filter="objective" aria-label="Filtrer par catégorie">' + selectOption("Tout", wardrobeFilters.objective, "Toutes catégories") + OBJECTIVES.map(function(item) { return selectOption(item, wardrobeFilters.objective); }).join("") + '</select>' +
    '<select data-wardrobe-filter="style" aria-label="Filtrer par style">' + selectOption("Tous", wardrobeFilters.style, "Tous les styles") + STYLES.map(function(item) { return selectOption(item, wardrobeFilters.style); }).join("") + '</select>' +
    '<select data-wardrobe-filter="season" aria-label="Filtrer par saison">' + selectOption("Toute saison", wardrobeFilters.season) + SEASONS.map(function(item) { return selectOption(item, wardrobeFilters.season); }).join("") + '</select>' +
    '<input type="number" min="0" step="1" data-wardrobe-filter="maxPrice" aria-label="Prix maximum" placeholder="Prix max €" value="' + (wardrobeFilters.maxPrice == null ? "" : esc(wardrobeFilters.maxPrice)) + '">' +
    '<span class="result-count">' + favorites.length + ' pièce(s)</span><select data-sort="wardrobe" aria-label="Trier les favoris">' +
    selectOption("recent", state.settings.wardrobeSort || "recent", "Ajouts récents") + selectOption("price-asc", state.settings.wardrobeSort || "recent", "Prix croissant") +
    selectOption("price-desc", state.settings.wardrobeSort || "recent", "Prix décroissant") + selectOption("name", state.settings.wardrobeSort || "recent", "Nom") + '</select></div></div>' +
    '<div id="wardrobe-grid">' + (favorites.length ? cards : '<div class="empty-state"><div class="empty-mark">♡</div><h2>Ta garde-robe est encore vide</h2><p>Les articles que tu ajoutes à ta liste dans Découvrir apparaîtront ici. Tu peux aussi ajouter un produit manuellement.</p><div class="empty-actions"><button class="button-primary" type="button" data-view="discover">Commencer à découvrir</button><button class="button-secondary" type="button" data-action="add-product">Ajouter un article</button></div></div>') + '</div>';
}
function pinterestPinCards() {
  const curated = (lookbookFeed.pins || []).map(function(pin) {
    const id = String(pin.id || "");
    return {
      id: id, pinId: id, title: pin.title || "Référence du lookbook",
      description: pin.description || "", imageUrl: pin.imageUrl || "",
      sourceUrl: "", tags: inferPinterestTags(pin), importedAt: null,
      fromFeed: false, origin: "lookbook", kind: pin.kind || "outfit",
      season: pin.season || lookbookFeed.season || "Automne / Hiver"
    };
  });
  const remote = (pinterestFeed.pins || []).map(function(pin) {
    const id = String(pin.id);
    return {
      id: id, pinId: id, title: pin.title || pin.description || pin.altText || "Épingle Pinterest",
      description: pin.description || pin.altText || "",
      imageUrl: pin.imageUrl || "", sourceUrl: pin.pinUrl || "https://www.pinterest.com/pin/" + encodeURIComponent(id) + "/",
      tags: inferPinterestTags(pin), importedAt: pin.createdAt || null,
      fromFeed: true, origin: "Pinterest", kind: "outfit"
    };
  });
  const local = (state.inspirations || []).filter(function(pin) { return pin.source === "Pinterest"; }).map(function(pin) {
    return Object.assign({ origin: "Pinterest", kind: "outfit" }, pin);
  });
  const seen = new Set();
  return curated.concat(remote, local).filter(function(pin) {
    const key = pin.pinId || pin.sourceUrl || pin.id;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function renderInspirations() {
  const items = pinterestPinCards().slice(0, 80);
  const unseen = items.filter(function(item) {
    return item.fromFeed && !(state.seenPinterestPins || []).includes(String(item.pinId));
  });
  const lookCount = items.filter(function(item) { return item.origin === "lookbook"; }).length;
  const lastSync = pinterestFeed.lastSync ? new Date(pinterestFeed.lastSync).toLocaleString("fr-FR") : "API Pinterest non synchronisée";
  const heading = renderPageHeading("20 références · Automne / Hiver", "Pinterest & Lookbook", "Ton lookbook importé et les nouvelles épingles Pinterest nourrissent le moteur de style. Les références restent consultables même sans connexion à l’API Pinterest.",
    '<a class="button-secondary" href="' + esc(PINTEREST_BOARD_URL) + '" target="_blank" rel="noopener noreferrer">Ouvrir mon tableau ↗</a><button class="button-primary" type="button" data-action="add-inspiration">＋ Ajouter un Pin</button>');
  const cards = items.length ? '<div class="inspiration-grid">' + items.map(function(item) {
    const seen = item.fromFeed && (state.seenPinterestPins || []).includes(String(item.pinId));
    const newBadge = item.fromFeed && !seen ? '<span class="pin-new-badge">NOUVEAU</span>' : '';
    const sourceLabel = item.origin === "lookbook" ? "Lookbook · " + (item.season || "Automne / Hiver") : "Pinterest · " + (item.importedAt ? new Date(item.importedAt).toLocaleDateString("fr-FR") : "Ajout manuel");
    const link = safeExternalUrl(item.sourceUrl)
      ? '<a class="button-quiet button-small" data-mark-seen-on-open="' + esc(item.pinId || item.id) + '" href="' + esc(safeExternalUrl(item.sourceUrl)) + '" target="_blank" rel="noopener noreferrer">Voir le Pin ↗</a>'
      : '<span class="button-quiet button-small">Référence du lookbook</span>';
    return '<article class="inspiration-card"><div class="inspiration-image">' + imageMarkup(item.imageUrl, item.title) + newBadge + '</div><div class="inspiration-copy"><strong>' + esc(item.title || "Référence vestimentaire") + '</strong><small>' + esc(sourceLabel) + '</small>' +
      '<div class="inspiration-tags">' + (item.tags || []).slice(0, 8).map(function(tag) { return '<span>' + esc(tag) + '</span>'; }).join("") + '</div>' +
      '<div class="grid-bottom">' + link +
      (item.fromFeed && !seen ? '<button class="button-secondary button-small" type="button" data-action="mark-pin-seen" data-id="' + esc(item.pinId) + '">Marquer vu</button>' : '') +
      (item.kind !== "detail" ? '<button class="mini-icon-button" type="button" data-action="use-pin-outfit" data-id="' + esc(item.pinId || item.id) + '" aria-label="Composer une tenue depuis cette référence">✦</button>' : '') +
      '</div></div></article>';
  }).join("") + '</div>' : '<div class="empty-state"><div class="empty-mark">⌁</div><h2>Aucune inspiration chargée</h2><p>Le lookbook local ou les Pins Pinterest pourront être ajoutés ici. Tu peux aussi importer des références depuis ton tableau.</p><div class="empty-actions"><a class="button-primary" href="' + esc(PINTEREST_BOARD_URL) + '" target="_blank" rel="noopener noreferrer">Ouvrir mon tableau Pinterest ↗</a><button class="button-secondary" type="button" data-action="add-inspiration">Ajouter une référence</button></div></div>';
  const pinterestStatus = pinterestFeed.privacy === "PUBLIC" ? "Tableau Pinterest public confirmé par l’API" : "API Pinterest non vérifiée (non nécessaire pour le lookbook)";
  return heading +
    '<div class="pinterest-status-strip"><div><strong>' + lookCount + '</strong><span>références du lookbook intégrées</span><strong>' + unseen.length + '</strong><span>nouvelle(s) épingle(s) Pinterest</span></div><div><small>Lookbook local · ' + esc(lookbookFeed.season || "Automne / Hiver") + '</small><small>' + esc(pinterestStatus) + '</small><small>Dernière synchronisation : ' + esc(lastSync) + '</small></div></div>' +
    '<div class="source-note pinterest-notice">Les 20 références du book sont intégrées avec leurs visuels et leurs caractéristiques. Elles servent à apprendre tes préférences et à composer des tenues ; elles ne sont pas présentées comme des articles marchands ni associées à de faux prix ou liens.</div>' +
    cards;
}
function outfitPinKey(pin) {
  return String(pin && (pin.pinId || pin.id || pin.sourceUrl || pin.pinUrl) || "");
}
function renderOutfits() {
  const pins = pinterestPinCards().filter(function(pin) { return pin.kind !== "detail"; }).slice(0, 40);
  const wardrobe = state.likedProducts.map(function(item) { return productById(item.productId); }).filter(Boolean);
  const dislikedIds = (state.interactions.dislikes || []).map(function(item) { return item.productId; });
  const feedbacks = state.outfitFeedback && typeof state.outfitFeedback === "object" ? state.outfitFeedback : {};
  const ideas = buildOutfitIdeas(pins, wardrobe, state.products, dislikedIds, feedbacks);
  if (state.selectedPinterestPin) {
    ideas.sort(function(a, b) {
      const selected = String(state.selectedPinterestPin);
      return Number(outfitPinKey(b.pin) === selected) - Number(outfitPinKey(a.pin) === selected);
    });
  }

  const feedbackValues = Object.values(feedbacks);
  const approvedCount = feedbackValues.filter(function(item) { return item && item.vote === "yes"; }).length;
  const rejectedCount = feedbackValues.filter(function(item) { return item && item.vote === "no"; }).length;
  const heading = renderPageHeading("De Pinterest à ton dressing", "Tenues", "Des compositions inspirées de tes références, rapprochées des pièces de ta garde-robe et complétées uniquement avec des produits vérifiables.",
    '<a class="button-secondary" href="' + esc(PINTEREST_BOARD_URL) + '" target="_blank" rel="noopener noreferrer">Voir Pinterest ↗</a>');

  if (!ideas.length) {
    return heading + '<div class="empty-state"><div class="empty-mark">✦</div><h2>Les tenues viendront de tes inspirations</h2><p>Ajoute des Pins depuis la rubrique Pinterest pour commencer à composer des propositions à partir de ta garde-robe et du catalogue disponible.</p><div class="empty-actions"><button class="button-primary" type="button" data-view="inspirations">Voir mes inspirations</button><button class="button-secondary" type="button" data-view="wardrobe">Voir ma garde-robe</button></div></div>';
  }

  const cards = ideas.map(function(idea) {
    const pin = idea.pin;
    const pinId = outfitPinKey(pin);
    const feedback = feedbacks[pinId] && feedbacks[pinId].vote || "";
    const pinLink = safeExternalUrl(pin.sourceUrl || pin.pinUrl);
    const saved = idea.pieces.map(function(entry) {
      const product = entry.product;
      return '<article class="outfit-piece"><div class="outfit-piece-image">' + imageMarkup(product.imageUrl, product.name) + '</div><div><small>Dans ta liste · ' + esc(product.objective || product.category) + '</small><strong>' + esc(product.name) + '</strong><span>' + esc(formatPrice(product.price)) + '</span><button class="button-quiet button-small" type="button" data-action="details" data-id="' + esc(product.id) + '">Détails</button></div></article>';
    }).join("");
    const suggested = idea.suggestions.map(function(entry) {
      const product = entry.product;
      return '<article class="outfit-piece is-suggestion"><div class="outfit-piece-image">' + imageMarkup(product.imageUrl, product.name) + '</div><div><small>À compléter · ' + esc(entry.slot === "top" ? "Haut" : entry.slot === "bottom" ? "Bas" : "Chaussures") + '</small><strong>' + esc(product.name) + '</strong><span>' + esc(formatPrice(product.price)) + '</span><button class="button-quiet button-small" type="button" data-action="details" data-id="' + esc(product.id) + '">Voir la pièce</button></div></article>';
    }).join("");
    const missing = idea.missingSlots.filter(function(slot) {
      return !idea.suggestions.some(function(entry) { return entry.slot === slot; });
    });
    const approved = feedback === "yes";
    const rejected = feedback === "no";

    return '<article class="panel outfit-card' + (approved ? ' is-approved' : rejected ? ' is-rejected' : '') + '">' +
      '<div class="outfit-feedback"><span>Cette tenue te plaît ?</span><div class="outfit-feedback-actions">' +
      '<button class="outfit-rate-button is-positive' + (approved ? ' is-selected' : '') + '" type="button" data-action="rate-outfit" data-id="' + esc(pinId) + '" data-vote="yes" aria-pressed="' + String(approved) + '" aria-label="Valider cette tenue" title="Valider cette tenue"><span aria-hidden="true">✓</span><small>Valider</small></button>' +
      '<button class="outfit-rate-button is-negative' + (rejected ? ' is-selected' : '') + '" type="button" data-action="rate-outfit" data-id="' + esc(pinId) + '" data-vote="no" aria-pressed="' + String(rejected) + '" aria-label="Refuser cette tenue" title="Refuser cette tenue"><span aria-hidden="true">✕</span><small>Refuser</small></button>' +
      '</div></div>' +
      '<div class="outfit-reference"><div class="outfit-reference-image">' + imageMarkup(pin.imageUrl, pin.title) + '</div>' +
      '<div class="outfit-reference-copy"><span class="eyebrow">' + (pin.origin === "lookbook" ? "Référence lookbook · " + esc(pin.season || "Automne / Hiver") : "Inspiration Pinterest") + '</span><h2>' + esc(pin.title || "Tenue de référence") + '</h2>' +
      (pin.description ? '<p>' + esc(String(pin.description).slice(0, 180)) + '</p>' : '') +
      (pinLink ? '<a href="' + esc(pinLink) + '" target="_blank" rel="noopener noreferrer">Ouvrir le Pin ↗</a>' : '') +
      '<div class="inspiration-tags">' + idea.tags.map(function(tag) { return '<span>' + esc(tag) + '</span>'; }).join("") + '</div></div></div>' +
      '<div class="outfit-pieces"><div class="outfit-column"><h3>Tes pièces qui s’en rapprochent</h3>' +
      (saved || '<p class="field-hint">Aucune pièce enregistrée ne correspond encore aux métadonnées de cette épingle.</p>') + '</div>' +
      '<div class="outfit-column"><h3>Pour compléter la tenue</h3>' +
      (suggested || '<p class="field-hint">' + (missing.length ? "Pas encore d’article correspondant dans le catalogue. Ajoute ou importe des produits pour obtenir des compléments." : "Ta sélection couvre déjà les catégories principales identifiées.") + '</p>') +
      '</div></div></article>';
  }).join("");

  return heading +
    '<div class="outfit-intro panel"><div><strong>' + wardrobe.length + ' pièce(s) dans ta liste</strong><p>Les 19 silhouettes du lookbook sont prêtes à être évaluées. Les associations reposent sur les descriptions et caractéristiques structurées ; les images ne sont pas analysées automatiquement. Valide ou refuse chaque tenue : tes retours affinent progressivement ton profil de style et les correspondances avec les pièces de ta garde-robe.</p><div class="outfit-feedback-summary"><span>' + approvedCount + ' validée(s)</span><span>' + rejectedCount + ' refusée(s)</span></div></div><button class="button-secondary button-small" type="button" data-view="wardrobe">Voir ma liste</button></div>' +
    '<div class="outfit-board">' + cards + '</div>';
}

function renderProfile() {
  const profile = state.profile;
  const sizes = profile.sizes || {};
  return renderPageHeading("Personnalisation", "Mon profil", "Décris librement tes préférences. Tous les champs sont facultatifs et les changements influencent le classement des prochaines pièces.", "") +
    '<form id="profile-form"><section class="panel section-panel"><h2 class="section-title">Mes tailles</h2><div class="form-grid three">' +
    profileField("Tops", "size-tops", sizes.tops) + profileField("Bas", "size-bottoms", sizes.bottoms) + profileField("Vestes & manteaux", "size-outerwear", sizes.outerwear) +
    profileField("Chaussures", "size-shoes", sizes.shoes) + profileField("Sous-vêtements", "size-underwear", sizes.underwear) + '</div></section>' +
    '<section class="panel section-panel"><h2 class="section-title">Mes préférences</h2><div class="preference-columns">' +
    preferenceField("Marques appréciées", "favoriteBrands", profile.favoriteBrands) + preferenceField("Marques à éviter", "excludedBrands", profile.excludedBrands) +
    preferenceField("Couleurs préférées", "preferredColors", profile.preferredColors) + preferenceField("Couleurs à éviter", "excludedColors", profile.excludedColors) +
    preferenceField("Matières appréciées", "preferredMaterials", profile.preferredMaterials) + preferenceField("Matières à éviter", "excludedMaterials", profile.excludedMaterials) +
    preferenceField("Coupes préférées", "preferredCuts", profile.preferredCuts) + preferenceField("Coupes à éviter", "excludedCuts", profile.excludedCuts) +
    preferenceField("Styles favoris", "preferredStyles", profile.preferredStyles) + '</div></section>' +
    '<section class="panel section-panel"><h2 class="section-title">Confort & silhouette</h2><div class="form-grid">' +
    '<div class="field"><label for="profile-comfort">Confort souhaité</label><select id="profile-comfort" name="comfort">' + ["Sans préférence","Confort prioritaire","Équilibré","Structure et maintien"].map(function(item) { return selectOption(item, profile.comfort); }).join("") + '</select></div>' +
    '<div class="field"><label for="profile-fit">Coupe préférée</label><select id="profile-fit" name="fit">' + ["Sans préférence","Ample","Ajustée","Classique","Oversized","Variable selon la pièce"].map(function(item) { return selectOption(item, profile.fit); }).join("") + '</select></div></div>' +
    '<div class="field" style="margin-top:15px"><label for="profile-notes">Notes personnelles</label><textarea id="profile-notes" name="notes" placeholder="Ce que tu recherches, ce que tu souhaites éviter…">' + esc(profile.notes) + '</textarea></div>' +
    '<div class="form-actions"><button class="button-primary" type="submit">Enregistrer mon profil</button><button class="button-quiet" type="button" data-action="reset-profile">Réinitialiser le profil algorithmique</button></div></section></form>';
}
function profileField(label, name, value) {
  return '<div class="field"><label for="' + name + '">' + esc(label) + '</label><input id="' + name + '" name="' + name + '" value="' + esc(value) + '" placeholder="Non renseigné"></div>';
}
function preferenceField(label, name, values) {
  return '<div class="preference-block"><h3>' + esc(label) + '</h3><div class="field"><input name="' + esc(name) + '" value="' + esc((values || []).join(", ")) + '" placeholder="Sépare les valeurs par des virgules"></div></div>';
}
function renderSettings() {
  const updated = state.updatedAt ? new Date(state.updatedAt).toLocaleString("fr-FR") : "Pas encore enregistrée";
  const lastPinterestSync = pinterestFeed.lastSync ? new Date(pinterestFeed.lastSync).toLocaleString("fr-FR") : "Aucune synchronisation réussie";
  const pinterestStatus = pinterestFeed.privacy === "PUBLIC" ? "Tableau public détecté" : "Connexion à configurer";
  const publicCount = Number(catalogMeta.liveProductCount) ||
    state.products.filter(product => product.sourceType === "public-web" && product.catalogStatus === "active").length;
  const storeCount = Number(catalogMeta.sourceCount) || 0;
  const syncText = catalogMeta.syncedAt ? new Date(catalogMeta.syncedAt).toLocaleString("fr-FR") : "Pas encore lancée";
  const communityConfigured = communityConfig.enabled && communityConfig.apiKey && communityConfig.projectId;
  const communityLabel = state.settings.communitySharing ? communityStatus : "Partage désactivé";
  return renderPageHeading("Contrôle & confidentialité", "Paramètres", "Gère tes inspirations, le catalogue multi-boutiques et les données utilisées par ton algorithme.", "") +
    '<section class="panel section-panel"><h2 class="section-title">Pinterest · mon tableau mode</h2><div class="connector-item pinterest-connector"><div><strong>Pinterest</strong><small>' + esc(pinterestStatus) + '</small></div><p>Le tableau sopppx24/mode reste la référence stylistique principale. La synchronisation quotidienne utilise l’API officielle Pinterest v5 lorsque l’application est autorisée et ses secrets sont configurés sur GitHub.</p><a class="button-secondary button-small" href="' + esc(PINTEREST_BOARD_URL) + '" target="_blank" rel="noopener noreferrer">Ouvrir le tableau ↗</a></div>' +
    '<p class="field-hint">Dernière synchronisation : ' + esc(lastPinterestSync) + '</p><div class="form-actions"><a class="button-primary button-small" href="https://github.com/sopp24/DRESSOPP/actions/workflows/pinterest-daily.yml" target="_blank" rel="noopener noreferrer">Voir / lancer le workflow ↗</a><a class="button-quiet button-small" href="https://github.com/sopp24/DRESSOPP/blob/main/docs/PINTEREST.md" target="_blank" rel="noopener noreferrer">Guide Pinterest ↗</a></div></section>' +
    '<section class="panel section-panel"><h2 class="section-title">Catalogue gratuit multi-boutiques</h2><div class="connector-item"><div><strong>' + (catalogMeta.status === "connected" ? "Exploration terminée" : catalogMeta.status === "partial" ? "Certaines boutiques accessibles" : "Prêt à explorer les sources publiques") + '</strong><small>' + publicCount + ' fiche(s) produit publique(s) · ' + storeCount + ' boutique(s) productive(s)</small></div><p>DRESSOPP explore un répertoire de boutiques françaises et internationales, sans compte éditeur, affiliation, abonnement ni clé API payante. Le robot respecte robots.txt et importe uniquement les pages publiques qui exposent un prix en euros, une photo HTTPS et un lien produit exploitable. Les boutiques qui bloquent l’accès restent consultables par leurs liens officiels.</p><p class="field-hint">Dernière exploration : ' + esc(syncText) + '</p><p class="field-hint">Boutiques ayant fourni des produits : ' + esc((catalogMeta.sources || []).join(" · ") || "En attente du premier passage") + '</p><div class="form-actions"><a class="button-primary button-small" href="https://github.com/sopp24/DRESSOPP/actions/workflows/refresh-public-catalog.yml" target="_blank" rel="noopener noreferrer">Lancer / consulter l’exploration ↗</a><a class="button-quiet button-small" href="https://github.com/sopp24/DRESSOPP/blob/main/docs/SOURCES.md" target="_blank" rel="noopener noreferrer">Liste des sources & limites ↗</a></div></section>' +
    '<section class="panel section-panel"><h2 class="section-title">Recommandations communautaires</h2><div class="connector-item"><div><strong>' + (communityConfigured ? "Firebase gratuit configuré" : "Configuration gratuite facultative") + '</strong><small>' + esc(communityLabel) + '</small></div><p>Avec ton accord, DRESSOPP compare des étiquettes générales de goûts et des identifiants hachés de fiches publiques aimées ou refusées par d’autres membres. Cela aide à recommander les mêmes articles aux profils proches. Aucun nom, e-mail, taille, budget, historique brut, URL de produit ou lien Pinterest n’est envoyé. Attention : ces identifiants ne sont pas chiffrés ; un membre qui connaît le code peut les rapprocher du catalogue public et déduire certains articles évalués. Sans Firebase, ton apprentissage individuel reste local.</p><label class="field-hint" style="display:flex;align-items:center;gap:10px;margin-top:12px"><input id="community-sharing" type="checkbox" ' + (state.settings.communitySharing ? "checked" : "") + '> J’accepte de partager mes goûts et des identifiants d’articles évalués</label><div class="form-actions"><a class="button-quiet button-small" href="https://github.com/sopp24/DRESSOPP/blob/main/docs/COMMUNITY.md" target="_blank" rel="noopener noreferrer">Guide Firebase gratuit & confidentialité ↗</a></div></div></section>' +
    '<section class="panel section-panel"><h2 class="section-title">Fiabilité et avis</h2><p class="field-hint">DRESSOPP conserve séparément les notes d’un produit et les avis concernant une boutique. Les notes sont affichées uniquement lorsqu’elles sont publiées dans une source produit autorisée. Les scores Trustpilot, Google, Avis Vérifiés, Trusted Shops et Custplace ne sont jamais inventés ni extraits par contournement.</p></section>' +
    '<section class="panel section-panel"><h2 class="section-title">Publicités Instagram</h2><p class="field-hint">L’application ne peut pas lire ton fil publicitaire personnalisé. La Meta Ad Library permet uniquement de consulter des campagnes publiques. Les produits repérés manuellement peuvent être ajoutés à tes inspirations ou à ton catalogue.</p><div class="form-actions"><a class="button-secondary button-small" href="https://www.facebook.com/ads/library/?active_status=active&ad_type=ALL&country=FR" target="_blank" rel="noopener noreferrer">Ouvrir Meta Ad Library ↗</a></div></section>' +
    '<section class="panel section-panel"><h2 class="section-title">Sauvegarde des données</h2><div class="source-note">' + esc(getPersistenceNotice()) + '</div>' +
    '<div class="form-grid" style="margin-top:16px"><div class="preference-block"><h3>État local</h3><p class="field-hint">Dernière modification : ' + esc(updated) + '</p><p class="field-hint">Produits : ' + state.products.length + ' · Articles dans ma liste : ' + state.likedProducts.length + ' · Décisions Oui : ' + state.interactions.likes.length + ' · Décisions Non : ' + state.interactions.dislikes.length + '</p></div>' +
    '<div class="preference-block"><h3>Copie de sécurité</h3><p class="field-hint">Exporte régulièrement ton fichier JSON. Il contient tes articles, préférences, votes, avis sur les tenues et Pins ajoutés manuellement.</p><div class="form-actions"><button class="button-primary button-small" type="button" data-action="export">Exporter mes données</button><button class="button-secondary button-small" type="button" data-action="import-backup">Importer une sauvegarde</button></div></div></div>' +
    '<input id="backup-file" type="file" accept=".json,application/json" hidden></section>' +
    '<section class="panel section-panel"><h2 class="section-title">Catalogue personnel</h2><p class="field-hint">Les compléments de tenues proviennent uniquement de fiches produit vérifiables ou de tes importations manuelles.</p><div class="form-actions"><button class="button-secondary" type="button" data-action="import-catalog">Importer un catalogue JSON</button></div><input id="catalog-file" type="file" accept=".json,application/json" hidden></section>' +
    '<section class="panel section-panel"><h2 class="section-title">Zone sensible</h2><p class="field-hint">La réinitialisation supprime les données enregistrées sur cet appareil. Exporte d’abord une copie de sécurité.</p><div class="form-actions"><button class="button-danger button-small" type="button" data-action="delete-data">Supprimer toutes mes données locales</button></div></section>';
}
function render() {
  document.querySelectorAll("[data-view]").forEach(function(button) {
    button.classList.toggle("is-active", button.dataset.view === currentView);
  });
  const count = document.querySelector("#wardrobe-count");
  if (count) count.textContent = String(state.likedProducts.length);
  if (currentView === "wardrobe") main.innerHTML = renderWardrobe();
  else if (currentView === "training") main.innerHTML = renderDiscover(true);
  else if (currentView === "inspirations") main.innerHTML = renderInspirations();
  else if (currentView === "outfits") main.innerHTML = renderOutfits();
  else if (currentView === "profile") main.innerHTML = renderProfile();
  else if (currentView === "settings") main.innerHTML = renderSettings();
  else main.innerHTML = renderDiscover(false);
  attachSwipe();
  main.querySelectorAll("[data-mark-seen-on-open]").forEach(function(link) {
    link.addEventListener("click", function() {
      const pinId = String(link.dataset.markSeenOnOpen || "");
      state.seenPinterestPins = Array.isArray(state.seenPinterestPins) ? state.seenPinterestPins : [];
      if (pinId && !state.seenPinterestPins.includes(pinId)) {
        state.seenPinterestPins.push(pinId);
        persist();
      }
    });
  });
  main.querySelectorAll("img.product-photo").forEach(function(image) {
    image.addEventListener("error", function() {
      const fallback = document.createElement("div");
      fallback.className = "image-fallback";
      fallback.innerHTML = '<span class="hanger" aria-hidden="true">⌁</span><small>Image indisponible</small>';
      image.replaceWith(fallback);
    }, { once: true });
  });
}
function showToast(message, undoAvailable) {
  toastRoot.innerHTML = '<div class="toast"><span>' + esc(message) + '</span>' +
    (undoAvailable ? '<button type="button" data-action="undo">Annuler</button>' : "") + '</div>';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function() { toastRoot.innerHTML = ""; }, 5000);
}
function vote(productId, value) {
  const product = productById(productId);
  if (!product || hasRated(productId)) return;
  invalidateAiAgentResults();
  const event = { productId: productId, createdAt: new Date().toISOString(), view: currentView };
  if (value === "yes" || value === "like") {
    state.interactions.likes.push(event);
    showToast("Réponse Oui enregistrée : tes préférences sont affinées", true);
  } else {
    state.interactions.dislikes.push(event);
    showToast("Réponse Non enregistrée : cette piste sera moins proposée", true);
  }
  state.interactions.lastAction = { productId: productId, action: value, createdAt: event.createdAt };
  state.learnedPreferences = deriveLearnedPreferences(state);
  persist();
  render();
}
function saveToList(productId) {
  const product = productById(productId);
  if (!product || isLiked(productId)) return;
  invalidateAiAgentResults();
  const createdAt = new Date().toISOString();
  state.likedProducts.push({ productId: productId, addedAt: createdAt });
  state.interactions.saves = Array.isArray(state.interactions.saves) ? state.interactions.saves : [];
  state.interactions.saves.push({ productId: productId, createdAt: createdAt, view: currentView });
  state.interactions.lastAction = { productId: productId, action: "save", createdAt: createdAt };
  persist();
  render();
  showToast("Article ajouté à ta liste", true);
}
async function shareProduct(productId) {
  const product = productById(productId);
  if (!product) return;
  const url = safeExternalUrl(product.url);
  const description = [product.brand || product.merchant, formatPrice(product.price)].filter(Boolean).join(" · ");
  const shareData = {
    title: product.name,
    text: [product.name, description].filter(Boolean).join(" — "),
    url: url || window.location.href
  };
  if (navigator.share) {
    try {
      await navigator.share(shareData);
      showToast("Article partagé", false);
      return;
    } catch (error) {
      if (error && error.name === "AbortError") return;
    }
  }
  try {
    const copyValue = url || shareData.text;
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(copyValue);
    } else {
      const field = document.createElement("textarea");
      field.value = copyValue;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      const copied = document.execCommand("copy");
      field.remove();
      if (!copied) throw new Error("Copie indisponible");
    }
    showToast(url ? "Lien de l’article copié" : "Informations de l’article copiées", false);
  } catch (error) {
    showToast("Le partage n’est pas disponible sur ce navigateur.", false);
  }
}
function rateOutfit(pinId, vote) {
  const id = String(pinId || "");
  if (!id || (vote !== "yes" && vote !== "no")) return;
  state.outfitFeedback = state.outfitFeedback && typeof state.outfitFeedback === "object" ? state.outfitFeedback : {};
  const current = state.outfitFeedback[id] && state.outfitFeedback[id].vote;
  if (current === vote) {
    delete state.outfitFeedback[id];
    showToast("Ton avis sur cette tenue a été retiré", false);
  } else {
    state.outfitFeedback[id] = { vote: vote, createdAt: new Date().toISOString() };
    showToast(vote === "yes" ? "Tenue validée : ce style sera davantage privilégié" : "Tenue refusée : ce style sera moins proposé", false);
  }
  state.learnedPreferences = deriveLearnedPreferences(state);
  persist();
  render();
}
function undoLast() {
  const action = state.interactions.lastAction;
  if (!action) return;
  if (action.action === "save" || action.action === "save-list") {
    state.interactions.saves = (state.interactions.saves || []).filter(function(item) { return item.productId !== action.productId || item.createdAt !== action.createdAt; });
    state.likedProducts = state.likedProducts.filter(function(item) { return item.productId !== action.productId || item.addedAt !== action.createdAt; });
  } else if (action.action === "yes" || action.action === "like") {
    state.interactions.likes = state.interactions.likes.filter(function(item) { return item.productId !== action.productId || item.createdAt !== action.createdAt; });
    if (action.action === "like") state.likedProducts = state.likedProducts.filter(function(item) { return item.productId !== action.productId || item.addedAt !== action.createdAt; });
  } else {
    state.interactions.dislikes = state.interactions.dislikes.filter(function(item) { return item.productId !== action.productId || item.createdAt !== action.createdAt; });
  }
  state.interactions.undoEvents.push({ productId: action.productId, action: action.action, undoneAt: new Date().toISOString() });
  state.interactions.lastAction = null;
  state.learnedPreferences = deriveLearnedPreferences(state);
  persist();
  render();
  showToast("Dernière action annulée", false);
}
function removeFavorite(productId) {
  state.likedProducts = state.likedProducts.filter(function(item) { return item.productId !== productId; });
  state.interactions.saves = (state.interactions.saves || []).filter(function(item) { return item.productId !== productId; });
  if (state.interactions.lastAction && state.interactions.lastAction.productId === productId &&
      ["save", "save-list"].includes(state.interactions.lastAction.action)) {
    state.interactions.lastAction = null;
  }
  state.removedFavorites = Array.isArray(state.removedFavorites) ? state.removedFavorites : [];
  state.removedFavorites.push({ productId: productId, removedAt: new Date().toISOString() });
  persist();
  render();
  showToast("Article retiré de ta garde-robe", false);
}
function openProductDetails(productId) {
  const product = productById(productId);
  if (!product) return;
  state.interactions.views.push({ productId: productId, viewedAt: new Date().toISOString() });
  persist();
  const details = [
    ["Catégorie", product.objective || product.category],
    ["Style", (product.styleTags || []).join(", ") || "Information non disponible"],
    ["Couleur", (product.colors || []).join(", ") || "Information non disponible"],
    ["Matière", (product.materials || []).join(", ") || "Information non disponible"],
    ["Coupe", (product.cuts || []).join(", ") || "Information non disponible"],
    ["Saison", (product.seasonTags || []).join(", ") || "Information non disponible"],
    ["Tailles", (product.sizes || []).join(", ") || "Information non disponible"],
    ["Disponibilité", product.availability || "Information non disponible"],
    ["Marchand", product.merchant || "Information non disponible"],
    ["Source", product.source || "Information non disponible"],
    ["Dernière vérification", product.verifiedAt ? new Date(product.verifiedAt).toLocaleDateString("fr-FR") : "Information non disponible"]
  ];
  const sourceLink = safeExternalUrl(product.url);
  modalRoot.innerHTML = '<div class="modal-backdrop"><section class="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="product-modal-title" data-modal-content>' +
    '<div class="modal-head"><div><span class="eyebrow">Fiche produit</span><h2 id="product-modal-title">Détails de la pièce</h2><p>Informations issues de la fiche enregistrée. Les données manquantes sont indiquées explicitement.</p></div><button class="close-button" type="button" data-action="close-modal" aria-label="Fermer">×</button></div>' +
    '<div class="details-layout"><div class="details-image">' + imageMarkup(product.imageUrl, product.name) + '</div><div class="details-copy">' +
    '<span class="detail-brand">' + esc(product.brand || "Marque non renseignée") + '</span><h3>' + esc(product.name) + '</h3><div class="details-price">' + esc(formatPrice(product.price)) + '</div>' +
    '<p class="field-hint">' + esc(product.description || "Aucune description enregistrée.") + '</p><div class="details-list">' +
    details.map(function(row) { return '<div class="detail-row"><span>' + esc(row[0]) + '</span><span>' + esc(row[1]) + '</span></div>'; }).join("") +
    '</div>' + (sourceLink ? '<a class="button-primary" href="' + esc(sourceLink) + '" target="_blank" rel="noopener noreferrer">Voir chez le marchand ↗</a>' : '<span class="status-pill pending">Lien marchand non renseigné</span>') +
    '<p class="modal-note">Les prix, les tailles et la disponibilité ne sont pas actualisés automatiquement. Vérifie les informations sur le site d’origine avant achat.</p></div></div></section></div>';
  modalRoot.querySelector(".modal-backdrop").addEventListener("click", function(event) {
    if (event.target.classList.contains("modal-backdrop")) closeModal();
  });
  attachImageFallbacks(modalRoot);
}
function closeModal() { modalRoot.innerHTML = ""; currentModalProduct = null; }
function attachImageFallbacks(scope) {
  scope.querySelectorAll("img.product-photo").forEach(function(image) {
    image.addEventListener("error", function() {
      const fallback = document.createElement("div");
      fallback.className = "image-fallback";
      fallback.innerHTML = '<span class="hanger" aria-hidden="true">⌁</span><small>Image indisponible</small>';
      image.replaceWith(fallback);
    }, { once: true });
  });
}
function openProductForm() {
  modalRoot.innerHTML = '<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="add-product-title" data-modal-content>' +
    '<div class="modal-head"><div><span class="eyebrow">Catalogue personnel</span><h2 id="add-product-title">Ajouter un article</h2><p>Renseigne les informations connues depuis la page du marchand. DRESSOPP ne devine pas les prix ni les compositions.</p></div><button class="close-button" type="button" data-action="close-modal" aria-label="Fermer">×</button></div>' +
    '<form id="product-form"><div class="form-grid"><div class="field"><label for="product-name">Nom du produit *</label><input id="product-name" name="name" required placeholder="Ex. Chemise en popeline"></div>' +
    '<div class="field"><label for="product-brand">Marque</label><input id="product-brand" name="brand" placeholder="Marque"></div>' +
    '<div class="field"><label for="product-merchant">Marchand *</label><input id="product-merchant" name="merchant" required placeholder="Boutique ou enseigne"></div>' +
    '<div class="field"><label for="product-price">Prix actuel (€)</label><input id="product-price" name="price" type="number" min="0" step="0.01" placeholder="Non renseigné"></div>' +
    '<div class="field"><label for="product-category">Objectif *</label><select id="product-category" name="objective">' + OBJECTIVES.map(function(item) { return selectOption(item, "Vêtements"); }).join("") + '</select></div>' +
    '<div class="field"><label for="product-styles">Style(s)</label><input id="product-styles" name="styleTags" placeholder="Classique, Classe…"></div>' +
    '<div class="field"><label for="product-season">Saison</label><input id="product-season" name="seasonTags" placeholder="Toute saison, Hiver…"></div>' +
    '<div class="field"><label for="product-colors">Couleur(s)</label><input id="product-colors" name="colors" placeholder="Noir, écru…"></div>' +
    '<div class="field"><label for="product-materials">Matière(s)</label><input id="product-materials" name="materials" placeholder="Coton, laine…"></div>' +
    '<div class="field"><label for="product-cuts">Coupe / silhouette</label><input id="product-cuts" name="cuts" placeholder="Ample, droite…"></div>' +
    '<div class="field" style="grid-column:1/-1"><label for="product-url">Lien marchand *</label><input id="product-url" name="url" type="url" required placeholder="https://…"></div>' +
    '<div class="field"><label for="product-image">URL de l’image</label><input id="product-image" name="imageUrl" type="url" placeholder="https://…"></div>' +
    '<div class="field"><label for="product-file">Ou importer une image</label><input id="product-file" name="imageFile" type="file" accept="image/*"><span class="field-hint">L’image importée reste sur cet appareil.</span></div>' +
    '<div class="field" style="grid-column:1/-1"><label for="product-description">Description / composition</label><textarea id="product-description" name="description" placeholder="Informations relevées sur le site marchand…"></textarea></div></div>' +
    '<div class="form-actions"><button class="button-primary" type="submit">Enregistrer l’article</button><button class="button-quiet" type="button" data-action="close-modal">Annuler</button></div></form></section></div>';
  modalRoot.querySelector(".modal-backdrop").addEventListener("click", function(event) {
    if (event.target.classList.contains("modal-backdrop")) closeModal();
  });
}
function openInspirationForm() {
  modalRoot.innerHTML = '<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="add-inspiration-title" data-modal-content>' +
    '<div class="modal-head"><div><span class="eyebrow">Pinterest uniquement</span><h2 id="add-inspiration-title">Ajouter un Pin</h2><p>Ajoute une épingle de ton tableau ou une référence Pinterest. Les tags manuels aident à relier la tenue à tes pièces.</p></div><button class="close-button" type="button" data-action="close-modal" aria-label="Fermer">×</button></div>' +
    '<form id="inspiration-form"><div class="form-grid"><div class="field" style="grid-column:1/-1"><label for="inspiration-url">Lien du Pin Pinterest *</label><input id="inspiration-url" name="sourceUrl" type="url" required placeholder="https://www.pinterest.com/pin/…"></div>' +
    '<div class="field" style="grid-column:1/-1"><label for="inspiration-title">Titre (facultatif)</label><input id="inspiration-title" name="title" placeholder="Une silhouette, une ambiance…"></div>' +
    '<div class="field" style="grid-column:1/-1"><label for="inspiration-tags">Tags esthétiques (facultatif)</label><input id="inspiration-tags" name="tags" placeholder="Oversized, tons neutres, tailoring…"></div></div>' +
    '<div class="form-actions"><button class="button-primary" type="submit">Enregistrer le Pin</button><button class="button-quiet" type="button" data-action="close-modal">Annuler</button></div></form></section></div>';
  modalRoot.querySelector(".modal-backdrop").addEventListener("click", function(event) {
    if (event.target.classList.contains("modal-backdrop")) closeModal();
  });
}
function fileToDataUrl(file) {
  return new Promise(function(resolve, reject) {
    if (!file) { resolve(""); return; }
    if (!file.type.startsWith("image/")) { reject(new Error("Le fichier doit être une image.")); return; }
    if (file.size > 5 * 1024 * 1024) { reject(new Error("Image trop volumineuse : 5 Mo maximum.")); return; }
    const reader = new FileReader();
    reader.onload = function() { resolve(String(reader.result)); };
    reader.onerror = function() { reject(new Error("Lecture de l’image impossible.")); };
    reader.readAsDataURL(file);
  });
}
function readJsonFile(file) {
  return new Promise(function(resolve, reject) {
    const reader = new FileReader();
    reader.onload = function() {
      try { resolve(JSON.parse(String(reader.result))); }
      catch (error) { reject(new Error("Le fichier JSON est invalide.")); }
    };
    reader.onerror = function() { reject(new Error("Lecture du fichier impossible.")); };
    reader.readAsText(file);
  });
}
async function submitProduct(form) {
  const data = new FormData(form);
  const imageFile = data.get("imageFile");
  const uploadedImage = imageFile && imageFile.size ? await fileToDataUrl(imageFile) : "";
  const product = normalizeProduct({
    name: data.get("name"), brand: data.get("brand"), merchant: data.get("merchant"),
    price: data.get("price"), objective: data.get("objective"), category: data.get("objective"),
    styleTags: normalizeWords(data.get("styleTags")), seasonTags: normalizeWords(data.get("seasonTags")),
    colors: normalizeWords(data.get("colors")), materials: normalizeWords(data.get("materials")),
    cuts: normalizeWords(data.get("cuts")), url: data.get("url"),
    imageUrl: uploadedImage || data.get("imageUrl"), description: data.get("description"),
    source: data.get("merchant")
  });
  if (!product.name || !product.merchant || !safeExternalUrl(product.url)) throw new Error("Le nom, le marchand et un lien HTTP(S) valide sont obligatoires.");
  const identity = productIdentity(product);
  if (state.products.some(function(item) { return productIdentity(item) === identity; })) {
    showToast("Cet article est déjà présent dans ton catalogue.", false);
    closeModal();
    return;
  }
  state.products.unshift(product);
  persist();
  closeModal();
  currentView = "discover";
  render();
  showToast("Article ajouté au catalogue", false);
}
async function submitInspiration(form) {
  const data = new FormData(form);
  const sourceUrl = safeExternalUrl(data.get("sourceUrl"));
  let host = "";
  try { host = new URL(sourceUrl).hostname.toLowerCase(); } catch (error) {}
  if (!sourceUrl || !(host === "pinterest.com" || host.endsWith(".pinterest.com") || host === "pin.it")) {
    throw new Error("Seuls les liens Pinterest sont acceptés comme inspirations.");
  }
  if (!sourceUrl.includes("/pin/") && host !== "pin.it") {
    throw new Error("Ajoute le lien d’une épingle précise (Pinterest.com/pin/…), pas seulement celui du tableau.");
  }
  if ((state.inspirations || []).some(function(item) { return item.sourceUrl === sourceUrl; })) {
    showToast("Cette épingle est déjà dans tes inspirations.", false);
    closeModal();
    return;
  }
  const item = {
    id: "pinterest-" + Date.now().toString(36),
    title: String(data.get("title") || "Épingle Pinterest").trim(),
    source: "Pinterest",
    sourceUrl: sourceUrl,
    imageUrl: "",
    tags: normalizeWords(data.get("tags")),
    importedAt: new Date().toISOString()
  };
  state.inspirations.unshift(item);
  state.learnedPreferences = deriveLearnedPreferences(state);
  persist();
  closeModal();
  currentView = "inspirations";
  render();
  showToast("Pin Pinterest enregistré", false);
}
function saveProfile(form) {
  const data = new FormData(form);
  state.profile.sizes = {
    tops: data.get("size-tops") || "", bottoms: data.get("size-bottoms") || "",
    outerwear: data.get("size-outerwear") || "", shoes: data.get("size-shoes") || "",
    underwear: data.get("size-underwear") || ""
  };
  ["favoriteBrands","excludedBrands","preferredColors","excludedColors","preferredMaterials","excludedMaterials","preferredCuts","excludedCuts","preferredStyles"].forEach(function(key) {
    state.profile[key] = normalizeWords(data.get(key));
  });
  state.profile.comfort = data.get("comfort") || "Sans préférence";
  state.profile.fit = data.get("fit") || "Sans préférence";
  state.profile.notes = data.get("notes") || "";
  state.learnedPreferences = deriveLearnedPreferences(state);
  persist();
  render();
  showToast("Profil enregistré", false);
}
function saveFilters() {
  const name = window.prompt("Nom de cette combinaison de filtres :", "Ma sélection");
  if (!name || !name.trim()) return;
  state.settings.savedFilters = state.settings.savedFilters || [];
  state.settings.savedFilters.push({
    name: name.trim(),
    objective: state.settings.objective,
    style: state.settings.style,
    season: state.settings.season,
    maxPrice: state.settings.maxPrice
  });
  persist();
  render();
  showToast("Combinaison de filtres enregistrée", false);
}
function exportData() {
  const payload = JSON.stringify(state, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "dressopp-sauvegarde-" + new Date().toISOString().slice(0, 10) + ".json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
  showToast("Export JSON préparé", false);
}
async function importCatalogFile(file) {
  const raw = await readJsonFile(file);
  const input = Array.isArray(raw) ? raw : (Array.isArray(raw.products) ? raw.products : []);
  if (!input.length) throw new Error("Aucun produit trouvé dans ce fichier.");
  let added = 0;
  input.forEach(function(item) {
    const product = normalizeProduct(item);
    if (!product.name || !safeExternalUrl(product.url)) return;
    const identity = productIdentity(product);
    if (state.products.some(function(existing) { return productIdentity(existing) === identity; })) return;
    state.products.push(product);
    added += 1;
  });
  if (!added) throw new Error("Aucun nouvel article valide. Chaque produit doit avoir un nom et un lien marchand.");
  persist();
  currentView = "discover";
  render();
  showToast(added + " article(s) importé(s)", false);
}
async function importBackupFile(file) {
  const imported = await readJsonFile(file);
  if (!imported || !Array.isArray(imported.products) || !imported.profile || !imported.settings) throw new Error("Cette sauvegarde ne correspond pas au format DRESSOPP.");
  if (!window.confirm("Remplacer les données actuelles par cette sauvegarde ? Exporte d’abord une copie de sécurité si nécessaire.")) return;
  const base = createInitialState([]);
  state = Object.assign(base, imported);
  state.profile = Object.assign(base.profile, imported.profile || {});
  state.settings = Object.assign(base.settings, imported.settings || {});
  state.interactions = Object.assign(base.interactions, imported.interactions || {});
  state.likedProducts = Array.isArray(imported.likedProducts) ? imported.likedProducts : [];
  state.inspirations = Array.isArray(imported.inspirations) ? imported.inspirations : [];
  state.outfitFeedback = imported.outfitFeedback && typeof imported.outfitFeedback === "object" && !Array.isArray(imported.outfitFeedback) ? imported.outfitFeedback : {};
  state.products = imported.products.map(normalizeProduct);
  state.learnedPreferences = deriveLearnedPreferences(state);
  await persist();
  currentView = "discover";
  render();
  showToast("Sauvegarde restaurée", false);
}
function resetProfile() {
  if (!window.confirm("Réinitialiser les préférences apprises, le profil et les avis sur les tenues ? Les favoris et le catalogue seront conservés.")) return;
  const base = createInitialState(state.products);
  state.profile = base.profile;
  const previousInteractions = state.interactions || {};
  state.interactions = {
    likes: [],
    dislikes: [],
    views: Array.isArray(previousInteractions.views) ? previousInteractions.views : [],
    saves: Array.isArray(previousInteractions.saves) ? previousInteractions.saves : [],
    undoEvents: [],
    lastAction: null
  };
  state.outfitFeedback = {};
  state.learnedPreferences = {};
  persist();
  render();
  showToast("Profil algorithmique réinitialisé", false);
}
async function deleteAllData() {
  if (!window.confirm("Supprimer définitivement toutes les données DRESSOPP enregistrées sur cet appareil ? Exporte une sauvegarde avant de continuer.")) return;
  await persistPromise.catch(function() {});
  if (aiAgentController) aiAgentController.abort();
  let communityRemovalFailed = false;
  if (communityConfig.enabled) {
    try { await deleteCommunityProfile(communityConfig); }
    catch (error) { communityRemovalFailed = true; }
  }
  await clearState();
  state = createInitialState([]);
  communitySignals = { positive:{}, negative:{}, neighbors:0 };
  communityStatus = "Partage désactivé";
  currentView = "discover";
  render();
  updateSaveStatus("Données locales supprimées", "ok");
  showToast(communityRemovalFailed
    ? "Données locales supprimées. Le profil communautaire distant n'a pas pu être supprimé."
    : "Les données locales ont été supprimées", false);
}
function setView(nextView) {
  currentView = nextView;
  closeModal();
  render();
  main.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function toggleDiscoveryView() {
  state.settings.discoveryView = state.settings.discoveryView === "grid" ? "cards" : "grid";
  persist();
  render();
}
function handleClick(event) {
  const viewButton = event.target.closest("[data-view]");
  if (viewButton) {
    event.preventDefault();
    setView(viewButton.dataset.view);
    return;
  }
  const actionButton = event.target.closest("[data-action]");
  if (!actionButton) return;
  const action = actionButton.dataset.action;
  if (action === "run-ai-agent") runAiAgent(true);
  else if (action === "add-product") openProductForm();
  else if (action === "add-inspiration") openInspirationForm();
  else if (action === "close-modal") closeModal(); else if (action === "details") openProductDetails(actionButton.dataset.id);
  else if (action === "vote") vote(actionButton.dataset.id, actionButton.dataset.vote || "no");
  else if (action === "save-list") saveToList(actionButton.dataset.id);
  else if (action === "share-product") shareProduct(actionButton.dataset.id);
  else if (action === "undo") undoLast();
  else if (action === "rate-outfit") rateOutfit(actionButton.dataset.id, actionButton.dataset.vote);
  else if (action === "remove-favorite") removeFavorite(actionButton.dataset.id);
  else if (action === "toggle-discovery-view") toggleDiscoveryView();
  else if (action === "save-filters") saveFilters();
  else if (action === "export") exportData();
  else if (action === "import-backup") document.querySelector("#backup-file").click();
  else if (action === "import-catalog") document.querySelector("#catalog-file")?.click();
  else if (action === "reset-profile") resetProfile();
  else if (action === "delete-data") deleteAllData();
  else if (action === "mark-pin-seen") {
    state.seenPinterestPins = Array.isArray(state.seenPinterestPins) ? state.seenPinterestPins : [];
    if (!state.seenPinterestPins.includes(String(actionButton.dataset.id))) state.seenPinterestPins.push(String(actionButton.dataset.id));
    persist(); render(); showToast("Épingle marquée comme parcourue", false);
  } else if (action === "use-pin-outfit") {
    state.selectedPinterestPin = String(actionButton.dataset.id);
    persist(); setView("outfits");
  } else if (action === "remove-inspiration") {
    state.inspirations = state.inspirations.filter(function(item) { return item.id !== actionButton.dataset.id; });
    persist(); render(); showToast("Inspiration supprimée", false);
  }
}
function handleChange(event) {
  const target = event.target;
  if (target.id === "ai-agent-consent") {
    state.settings.aiAgentConsent = Boolean(target.checked);
    if (!target.checked) {
      if (aiAgentController) aiAgentController.abort();
      state.settings.aiAgentAutoRefresh = false;
      aiAgentState = { status:"unconfigured", recommendations:[], message:"Partage IA désactivé. Le classement local continue de fonctionner.", searchHints:[], candidateCount:0 };
    }
    persist();
    render();
    return;
  }
  if (target.id === "ai-agent-auto") {
    state.settings.aiAgentAutoRefresh = Boolean(target.checked);
    persist();
    render();
    return;
  }
  if (target.id === "community-sharing") {
    state.settings.communitySharing = Boolean(target.checked);
    persist();
    if (target.checked) {
      communityStatus = "Activation en cours";
      refreshCommunity(true);
    } else {
      communitySignals = { positive:{}, negative:{}, neighbors:0 };
      communityStatus = "Partage désactivé";
      if (communityConfig.enabled) deleteCommunityProfile(communityConfig)
        .then(() => { communityStatus = "Profil communautaire supprimé"; })
        .catch(error => { communityStatus = "Suppression impossible · " + error.message; });
    }
    render();
    return;
  }
  if (target.matches("[data-filter]")) {
    const key = target.dataset.filter;
    if (key === "preset") {
      const presets = Array.isArray(state.settings.savedFilters) ? state.settings.savedFilters : [];
      const preset = presets[Number(target.value)];
      if (preset) {
        ["objective","style","season","maxPrice"].forEach(function(field) { state.settings[field] = preset[field]; });
      }
    } else if (key === "maxPrice") {
      state.settings.maxPrice = target.value.trim() === "" ? null : Math.max(0, Number(target.value));
    } else state.settings[key] = key.toLowerCase().includes("level") ? Number(target.value) : target.value;
    if (aiAgentState.status === "ready") {
      aiAgentState.status = "stale";
      aiAgentState.message = "Tes filtres ont changé. Relance l’agent pour actualiser la sélection.";
      aiAgentState.recommendations = [];
    }
    persist();
    render();
  }
  if (target.matches("[data-wardrobe-filter]")) {
    const key = target.dataset.wardrobeFilter;
    state.settings.wardrobeFilters = state.settings.wardrobeFilters || { objective: "Tout", style: "Tous", season: "Toute saison", maxPrice: null };
    state.settings.wardrobeFilters[key] = key === "maxPrice" ? (target.value.trim() === "" ? null : Math.max(0, Number(target.value))) : target.value;
    persist();
    render();
  }
  if (target.matches("[data-sort='wardrobe']")) {
    state.settings.wardrobeSort = target.value;
    persist();
    render();
  }
  if (target.id === "catalog-file" && target.files && target.files[0]) {
    importCatalogFile(target.files[0]).catch(function(error) { showToast(error.message, false); });
    target.value = "";
  }
  if (target.id === "backup-file" && target.files && target.files[0]) {
    importBackupFile(target.files[0]).catch(function(error) { showToast(error.message, false); });
    target.value = "";
  }
}
function handleInput(event) {
  const target = event.target;
  if (target.matches("[data-filter='discoveryLevel'],[data-filter='trainingDiscoveryLevel']")) {
    const output = document.querySelector("#discovery-output");
    if (output) output.textContent = target.value + "%";
  }
  if (target.matches("[data-search='wardrobe'],[data-search='discover']")) {
    const query = target.value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const selector = target.dataset.search === "discover" ? ".deck-column .grid-card" : "#wardrobe-grid .grid-card";
    document.querySelectorAll(selector).forEach(function(card) {
      const haystack = card.textContent.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      card.hidden = !haystack.includes(query);
    });
  }
}
function handleSubmit(event) {
  const form = event.target;
  if (form.id === "product-form") {
    event.preventDefault();
    submitProduct(form).catch(function(error) { showToast(error.message, false); });
  } else if (form.id === "inspiration-form") {
    event.preventDefault();
    submitInspiration(form).catch(function(error) { showToast(error.message, false); });
  } else if (form.id === "profile-form") {
    event.preventDefault();
    saveProfile(form);
  }
}
function attachSwipe() {
  const card = document.querySelector("#active-product-card");
  if (!card) return;
  let startX = 0;
  let startY = 0;
  let deltaX = 0;
  let dragging = false;
  card.addEventListener("pointerdown", function(event) {
    if (event.target.closest("button, a")) return;
    startX = event.clientX;
    startY = event.clientY;
    deltaX = 0;
    dragging = true;
    card.classList.add("is-dragging");
    try { card.setPointerCapture(event.pointerId); } catch (error) {}
  });
  card.addEventListener("pointermove", function(event) {
    if (!dragging) return;
    deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;
    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaX) < 22) return;
    card.style.transform = "translateX(" + deltaX + "px) rotate(" + (deltaX / 22) + "deg)";
    card.style.borderColor = deltaX > 45 ? "rgba(255,0,0,.8)" : (deltaX < -45 ? "rgba(255,255,255,.6)" : "");
  });
  card.addEventListener("pointerup", function(event) {
    if (!dragging) return;
    dragging = false;
    card.classList.remove("is-dragging");
    card.style.transform = "";
    card.style.borderColor = "";
    if (Math.abs(deltaX) > 95) vote(card.dataset.productId, deltaX > 0 ? "yes" : "no");
    else if (Math.abs(deltaX) < 12 && Math.abs(event.clientY - startY) < 12) openProductDetails(card.dataset.productId);
  });
  card.addEventListener("pointercancel", function() {
    dragging = false;
    card.classList.remove("is-dragging");
    card.style.transform = "";
    card.style.borderColor = "";
  });
}
document.addEventListener("click", handleClick);
document.addEventListener("change", handleChange);
document.addEventListener("input", handleInput);
document.addEventListener("submit", handleSubmit);
document.addEventListener("keydown", function(event) {
  if (modalRoot.innerHTML) {
    if (event.key === "Escape") closeModal();
    return;
  }
  if (["INPUT","TEXTAREA","SELECT"].includes(document.activeElement.tagName)) return;
  if (currentView === "discover" || currentView === "training") {
    const card = document.querySelector("#active-product-card");
    if (!card) return;
    if (event.key === "ArrowRight") vote(card.dataset.productId, "yes");
    else if (event.key === "ArrowLeft") vote(card.dataset.productId, "no");
    else if (event.key.toLowerCase() === "z" && (event.metaKey || event.ctrlKey)) undoLast();
  }
});
async function boot() {
  let catalog = [];
  let catalogLoaded = false;
  try {
    const pinResponse = await fetch("./data/pinterest-pins.json", { cache: "no-store" });
    if (pinResponse.ok) {
      const payload = await pinResponse.json();
      if (payload.privacy === "PUBLIC" && Array.isArray(payload.pins)) pinterestFeed = payload;
    }
  } catch (error) { console.warn("Flux Pinterest non chargé.", error); }
  try {
    const lookbookResponse = await fetch("./data/lookbook-pins.json", { cache: "no-store" });
    if (lookbookResponse.ok) {
      const payload = await lookbookResponse.json();
      if (Array.isArray(payload.pins)) lookbookFeed = payload;
    }
  } catch (error) { console.warn("Lookbook local non chargé.", error); }
  try {
    const response = await fetch("./data/catalog.json", { cache: "no-store" });
    if (response.ok) {
      const payload = await response.json();
      catalog = (payload.products || []).map(normalizeProduct);
      catalogLoaded = true;
    }
  } catch (error) { console.warn("Catalogue distant non chargé.", error); }
  try {
    const response = await fetch("./data/catalog-meta.json", { cache: "no-store" });
    if (response.ok) catalogMeta = await response.json();
  } catch (error) { console.warn("État du catalogue marchand non chargé.", error); }
  try {
    const response = await fetch("./data/community-config.json", { cache: "no-store" });
    if (response.ok) communityConfig = await response.json();
  } catch (error) { console.warn("Configuration communautaire non chargée.", error); }
  try {
    const response = await fetch("./data/ai-agent-config.json", { cache: "no-store" });
    if (response.ok) aiAgentConfig = await response.json();
  } catch (error) { console.warn("Configuration du personal shopper IA non chargée.", error); }
  const stored = await loadState();
  const base = createInitialState(catalog);
  state = stored ? Object.assign(base, stored) : base;
  state.profile = Object.assign(base.profile, state.profile || {});
  state.profile.sizes = Object.assign(base.profile.sizes, state.profile.sizes || {});
  state.settings = Object.assign(base.settings, state.settings || {});
  const migrateLegacyPriceCeiling = state.settings.catalogBudgetMigration !== "multi-shop-v1";
  if (migrateLegacyPriceCeiling && state.settings.maxPrice === 20) state.settings.maxPrice = null;
  state.settings.catalogBudgetMigration = "multi-shop-v1";
  state.interactions = Object.assign(base.interactions, state.interactions || {});
  state.interactions.likes = Array.isArray(state.interactions.likes) ? state.interactions.likes : [];
  state.interactions.dislikes = Array.isArray(state.interactions.dislikes) ? state.interactions.dislikes : [];
  state.interactions.views = Array.isArray(state.interactions.views) ? state.interactions.views : [];
  state.interactions.saves = Array.isArray(state.interactions.saves) ? state.interactions.saves : [];
  state.interactions.undoEvents = Array.isArray(state.interactions.undoEvents) ? state.interactions.undoEvents : [];
  state.likedProducts = Array.isArray(state.likedProducts) ? state.likedProducts : [];
  state.outfitFeedback = state.outfitFeedback && typeof state.outfitFeedback === "object" && !Array.isArray(state.outfitFeedback) ? state.outfitFeedback : {};
  const localProducts = Array.isArray(state.products) ? state.products.map(normalizeProduct) : [];
  if (!catalogLoaded) {
    state.products = localProducts.length ? localProducts : catalog;
  } else {
    const currentIds = new Set(catalog.map(function(product) { return product.id; }));
    const currentIdentities = new Set(catalog.map(productIdentity));
    const savedIds = new Set((state.likedProducts || []).map(function(item) { return item.productId; }));
    (state.interactions.likes || []).concat(state.interactions.dislikes || [], state.interactions.saves || []).forEach(function(item) { savedIds.add(item.productId); });
    const localManual = localProducts.filter(function(product) {
      const isFeedProduct = product.sourceType === "public-web" || product.sourceType === "awin" || product.feedId || product.advertiserId;
      return !isFeedProduct && !currentIdentities.has(productIdentity(product));
    });
    const savedWithdrawn = localProducts.filter(function(product) {
      const isFeedProduct = product.sourceType === "public-web" || product.sourceType === "awin" || product.feedId || product.advertiserId;
      return isFeedProduct && !currentIds.has(product.id) && savedIds.has(product.id);
    }).map(function(product) {
      return Object.assign({}, product, {
        catalogStatus: "stale",
        availabilityStatus: "out_of_stock",
        availability: "Fiche absente du dernier flux marchand · à revérifier"
      });
    });
    const merged = new Map();
    catalog.forEach(function(product) { merged.set(product.id, product); });
    localManual.forEach(function(product) { merged.set(product.id, product); });
    savedWithdrawn.forEach(function(product) { merged.set(product.id, product); });
    state.products = Array.from(merged.values());
  }
  state.inspirations = Array.isArray(state.inspirations) ? state.inspirations.filter(function(item) { return item.source === "Pinterest"; }) : [];
  state.seenPinterestPins = Array.isArray(state.seenPinterestPins) ? state.seenPinterestPins : [];
  state.pinterestPins = (pinterestFeed.pins || []).concat(lookbookFeed.pins || []);
  state.learnedPreferences = deriveLearnedPreferences(state);
  render();
  updateSaveStatus("Stockage local prêt", "ok");
  if (state.settings.communitySharing) refreshCommunity(false);
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./sw.js").catch(function(error) { console.warn("Service worker non activé.", error); });
  }
}
boot().catch(function(error) {
  console.error("Initialisation DRESSOPP impossible :", error);
  main.innerHTML = '<div class="empty-state"><h2>Impossible de charger DRESSOPP</h2><p>' + esc(error.message) + '</p><button class="button-primary" type="button" onclick="location.reload()">Réessayer</button></div>';
});
