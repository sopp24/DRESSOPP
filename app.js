import { loadState, saveState, clearState } from "./modules/store.js";
import { createInitialState, normalizeProduct, productIdentity, seasonFor, rankProducts, deriveLearnedPreferences, matchesFilters } from "./modules/engine.js";
import { INTEGRATIONS, getPersistenceNotice, PINTEREST_BOARD_URL } from "./modules/integrations.js";
import { inferPinterestTags, inferPinterestFeatures, buildOutfitIdeas, productSlot, outfitTotalPrice } from "./modules/outfits.js";
import { syncCommunityProfile, deleteCommunityProfile, buildCommunitySignals } from "./modules/community.js";
import { requestAgentRecommendations, orderProductsByAgent, selectAgentCandidates, recommendLocally } from "./modules/agent.js";

const main = document.querySelector("#app-main");
const modalRoot = document.querySelector("#modal-root");
const toastRoot = document.querySelector("#toast-root");
const saveStatus = document.querySelector("#save-status");

const LIQUID_GLASS_TARGETS = ".topbar, .mobile-nav, .mobile-nav button, .filter-menu-trigger, .deck-action";
function updateLiquidGlassLight(event) {
  const target = event.target;
  if (!target || typeof target.closest !== "function") return;
  const surface = target.closest(LIQUID_GLASS_TARGETS);
  if (!surface) return;
  const bounds = surface.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  const x = Math.max(0, Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100));
  const y = Math.max(0, Math.min(100, ((event.clientY - bounds.top) / bounds.height) * 100));
  surface.style.setProperty("--glass-x", x.toFixed(1) + "%");
  surface.style.setProperty("--glass-y", y.toFixed(1) + "%");
}
document.addEventListener("pointermove", updateLiquidGlassLight, { passive:true });
document.addEventListener("pointerdown", updateLiquidGlassLight, { passive:true });
let state = null;
let currentView = "discover";
let deckActionPending = false;
let currentOutfitIdeas = [];
let discoveryFiltersOpen = false;
let currentModalProduct = null;
let toastTimer = null;
let persistPending = false;
let persistRevision = 0;
let persistPromise = Promise.resolve();
let pinterestFeed = { privacy: "UNKNOWN", pins: [], lastSync: null, newPinIds: [] };
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
let catalogManifest = null;
let catalogDirectory = [];
let catalogLoadedPages = new Set();
let catalogPagePending = false;
let catalogNextPending = false;
let catalogLastManifestCheck = 0;
let catalogRetryAfter = 0;


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
    const visualFeatures = inferPinterestFeatures(pin);
    const hiddenSignals = Object.values(visualFeatures).flat();
    return { title:pin.title || "", tags:Array.from(new Set([...(Array.isArray(pin.tags) ? pin.tags : []),...hiddenSignals])) };
  });
}
function aiAgentContextSignature(training) {
  const settings = state.settings || {}, profile = state.profile || {};
  const products = selectAgentCandidates(rankProducts(state.products,state,{training:training,communitySignals:communitySignals}),50);
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
  if (!state || aiAgentPending) return;
  const training = currentView === "training";
  const ranked = rankProducts(state.products,state,{training:training,communitySignals:communitySignals});
  const candidates = selectAgentCandidates(ranked,50);
  if (!candidates.length) {
    aiAgentState = { status:"empty", recommendations:[], message:"Aucun article n'est disponible avec ces filtres. Élargis la catégorie, le style ou le budget, ou attends la prochaine collecte.", searchHints:[], candidateCount:0, provider:"local" };
    render();
    return;
  }

  const requestActionCount = aiAgentActionCount();
  const requestContext = aiAgentContextSignature(training);
  const inspirations = aiAgentInspirations();
  const localResult = recommendLocally(state,candidates,inspirations,14);
  aiAgentPending = true;
  aiAgentState = { status:"loading", recommendations:[], message:"Analyse locale de tes goûts, votes et inspirations…", searchHints:[], candidateCount:candidates.length, provider:"local" };
  aiAgentLastActionCount = requestActionCount;
  render();

  try {
    let result = localResult;
    let provider = "local";
    let remoteNotice = "";
    const remoteConfigured = Boolean(aiAgentConfig.enabled && aiAgentConfig.endpoint);
    if (state.settings.aiAgentConsent && remoteConfigured) {
      try {
        const controller = new AbortController();
        aiAgentController = controller;
        result = await requestAgentRecommendations(aiAgentConfig.endpoint,state,candidates,inspirations,{signal:controller.signal});
        provider = "cloudflare";
      } catch (error) {
        if (error && error.name === "AbortError") throw error;
        remoteNotice = " Le service Cloudflare n’a pas répondu (" + error.message + ") ; la sélection locale prend le relais.";
        result = localResult;
        provider = "local";
      } finally {
        aiAgentController = null;
      }
    }
    const contextChanged = aiAgentActionCount() !== requestActionCount ||
      (currentView === "training") !== training || aiAgentContextSignature(training) !== requestContext;
    if (contextChanged) {
      aiAgentState = { status:"stale", recommendations:[], message:"Tes filtres ou tes derniers retours ont changé pendant l’analyse. Relance le personal shopper.", searchHints:[], candidateCount:result.candidateCount, provider:provider };
      if (showFeedback) showToast("Tes choix ont changé pendant l’analyse. Relance le personal shopper.",false);
    } else {
      aiAgentState = {
        status:"ready", recommendations:result.recommendations, message:(result.message || "") + remoteNotice,
        searchHints:result.searchHints || [], candidateCount:result.candidateCount || candidates.length, provider:provider
      };
      if (showFeedback) showToast(result.recommendations.length + " recommandations préparées par " + (provider === "cloudflare" ? "l’IA Cloudflare" : "l’agent local") + ".",false);
    }
  } catch (error) {
    if (!state.settings.aiAgentConsent || (error && error.name === "AbortError")) {
      aiAgentState = {
        status:"ready", recommendations:localResult.recommendations,
        message:localResult.message, searchHints:localResult.searchHints,
        candidateCount:localResult.candidateCount, provider:"local"
      };
    } else {
      aiAgentState = { status:"error", recommendations:[], message:"L’analyse locale a rencontré un problème : " + error.message + ". Le classement normal reste actif.", searchHints:[], candidateCount:candidates.length, provider:"local" };
      if (showFeedback) showToast("L’agent n’a pas pu terminer l’analyse : " + error.message,false);
    }
  } finally {
    aiAgentController = null;
    aiAgentPending = false;
    const actionDelta = aiAgentActionCount() - aiAgentLastActionCount;
    const autoEnabled = state && state.settings.aiAgentAutoRefresh;
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
  const status = aiAgentPending ? "Analyse en cours" :
    ready ? (aiAgentState.provider === "cloudflare" ? "IA Cloudflare prête" : "Agent local prêt") :
    aiAgentState.status === "error" ? "Erreur d’analyse" :
    configured ? (consent ? "Cloudflare autorisé · mode hybride" : "Mode local privé") : "Mode local privé";
  const consentControl = configured
    ? '<label class="ai-agent-consent"><input id="ai-agent-consent" type="checkbox" ' + (consent ? "checked" : "") + '><span>Autoriser aussi l’envoi temporaire de mes préférences générales, de mes derniers retours et des résumés des articles candidats à Cloudflare pour utiliser le modèle génératif. Sans cette case, l’analyse reste entièrement sur cet appareil.</span></label>'
    : '<p class="ai-agent-help">Le personal shopper local est actif sans compte, clé API ni transfert de données. Le modèle génératif distant n’est pas configuré ; tu peux déjà utiliser l’agent local.</p>';
  const autoControl = '<label class="ai-agent-auto"><input id="ai-agent-auto" type="checkbox" ' + (state.settings.aiAgentAutoRefresh ? "checked" : "") + '> Actualiser l’analyse après trois nouvelles décisions (localement, ou avec Cloudflare si autorisé)</label>';
  const button = '<button class="button-primary button-small" type="button" data-action="run-ai-agent" ' + (aiAgentPending ? "disabled" : "") + '>' + (aiAgentPending ? "Analyse…" : ready ? "Actualiser mes recommandations" : "Lancer mon personal shopper") + '</button>';
  const hints = ready && aiAgentState.searchHints.length
    ? '<div class="ai-agent-hints"><span>Signaux retenus :</span>' + aiAgentState.searchHints.map(function(item) { return "<span>" + esc(item) + "</span>"; }).join("") + "</div>" : "";
  const note = ready ? '<p class="ai-agent-result-note">' + aiAgentState.recommendations.length + " articles classés parmi " + aiAgentState.candidateCount + " candidats · " + (aiAgentState.provider === "cloudflare" ? "modèle génératif Cloudflare" : "analyse locale privée") + ".</p>" : "";
  return '<section class="panel ai-agent-panel" aria-label="Personal shopper IA"><div class="ai-agent-top"><div><span class="eyebrow">Ton personal shopper</span><h2>Agent IA DRESSOPP</h2><p>Il croise tes inspirations, ton profil, ta garde-robe et tes décisions pour sélectionner les prochaines pièces.</p></div><span class="ai-agent-status ' + (ready ? "is-ready" : aiAgentPending ? "is-loading" : "") + '">' + esc(status) + '</span></div>' +
    consentControl +
    '<div class="ai-agent-controls">' + button + autoControl + '</div>' +
    (aiAgentState.message ? '<p class="ai-agent-message">' + esc(aiAgentState.message) + '</p>' : "") + note + hints +
    '<p class="ai-agent-disclaimer">Le mode local ne transmet aucune donnée. Le mode Cloudflare est facultatif et n’est utilisé qu’après ton accord. L’agent classe uniquement des produits réels déjà présents dans DRESSOPP : il ne fabrique ni article, ni prix, ni disponibilité.</p>' +
    '<a class="ai-agent-guide" href="https://github.com/sopp24/DRESSOPP/blob/main/docs/AI-AGENT.md" target="_blank" rel="noopener noreferrer">Détails de l’agent et confidentialité ↗</a></section>';
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
  return '<div class="discovery-filter-menu">' +
    '<button class="filter-menu-trigger" type="button" data-action="toggle-filters" aria-expanded="' + (discoveryFiltersOpen ? "true" : "false") + '" aria-controls="discovery-filter-panel"><span aria-hidden="true">☷</span><span>Filtres</span>' +
    ((settings.objective !== "Vêtements" || settings.style !== "Tous" || settings.season !== seasonFor(new Date()) || settings.maxPrice != null) ? '<i class="filter-active-dot" aria-label="Filtres actifs"></i>' : '') + '</button>' +
    '<section id="discovery-filter-panel" class="panel filter-bar' + (discoveryFiltersOpen ? ' is-open' : '') + '" aria-label="Filtres de découverte" ' + (discoveryFiltersOpen ? '' : 'hidden') + '>' +
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
    '<div class="field"><label for="price-filter">Budget maximum</label><div class="price-input-wrap"><input id="price-filter" data-filter="maxPrice" type="number" min="0" step="1" value="' + (settings.maxPrice == null ? "" : esc(settings.maxPrice)) + '" placeholder="Sans limite"><span class="price-input-currency" aria-hidden="true">€</span></div></div>' +
    '<div class="field"><label for="preset-filter">Mes filtres enregistrés</label><select id="preset-filter" data-filter="preset">' +
      selectOption("", "", saved.length ? "Charger un filtre" : "Aucun filtre enregistré") +
      saved.map(function(item, index) { return selectOption(String(index), "", item.name || ("Filtre " + (index + 1))); }).join("") +
      '</select></div>' +
    '<div class="filter-footer"><label class="discovery-level"><span>Mes goûts</span><input type="range" min="0" max="100" step="1" data-filter="' + (training ? "trainingDiscoveryLevel" : "discoveryLevel") + '" value="' + esc(selectedLevel) + '"><span>Découverte</span><output id="discovery-output">' + esc(selectedLevel) + '%</output></label>' +
    '<div class="filter-tools"><button class="button-quiet button-small" type="button" data-action="save-filters">＋ Enregistrer ces filtres</button><button class="button-primary button-small" type="button" data-action="toggle-filters">Appliquer</button></div></div></section></div>';
}
function renderEmptyProducts(training) {
  const title = catalogPagePending ? "On prépare la suite" : (state.products.length ? "Aucun article ne correspond à ces filtres" : "Ton dressing commence ici");
  const body = catalogPagePending
    ? "DRESSOPP charge le prochain lot de produits vérifiés."
    : (state.products.length
      ? "Élargis ton budget, change de style ou sélectionne une autre saison pour relancer la découverte."
      : "Le catalogue se remplit par rotations de boutiques et se charge par pages. Tu peux aussi ajouter une fiche vérifiable manuellement.");
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

async function refreshCatalogManifest(force) {
  if (!force && Date.now() - catalogLastManifestCheck < 90000) return catalogManifest;
  catalogLastManifestCheck = Date.now();
  try {
    const response = await fetch("./data/catalog-manifest.json", { cache:"no-store" });
    if (!response.ok) return catalogManifest;
    const incoming = await response.json();
    if (!incoming || !Array.isArray(incoming.pages)) return catalogManifest;
    if (!catalogManifest || incoming.generatedAt !== catalogManifest.generatedAt) {
      catalogManifest = incoming;
      // Les produits des nouvelles collectes sont append-only : recharger les pages
      // permet de récupérer les fiches récentes sans effacer l'historique local.
      catalogLoadedPages = new Set();
    } else {
      catalogManifest = incoming;
    }
  } catch (error) {
    console.warn("Manifeste du catalogue non actualisé.", error);
  }
  try {
    const response = await fetch("./data/catalog-meta.json", { cache:"no-store" });
    if (response.ok) catalogMeta = await response.json();
  } catch (error) { console.warn("Métadonnées du catalogue non actualisées.", error); }
  return catalogManifest;
}
function mergeCatalogPageProducts(items) {
  const byIdentity = new Map();
  (state.products || []).forEach(function(product) {
    byIdentity.set(productIdentity(product), product);
  });
  let added = 0;
  (items || []).forEach(function(raw) {
    const product = normalizeProduct(raw);
    if (!product.id || !product.name || !product.url) return;
    const identity = productIdentity(product);
    const existing = byIdentity.get(identity);
    if (existing && existing.sourceType !== "public-web") return;
    if (!existing) added += 1;
    byIdentity.set(identity, product);
  });
  state.products = Array.from(byIdentity.values());
  return added;
}
async function loadCatalogPage(pageIndex) {
  if (!catalogManifest || !Array.isArray(catalogManifest.pages) || catalogPagePending) return 0;
  const page = catalogManifest.pages[pageIndex];
  if (!page || catalogLoadedPages.has(page.file)) return 0;
  catalogPagePending = true;
  try {
    const response = await fetch("./data/" + page.file.replace(/^data\//, ""), { cache:"no-store" });
    if (!response.ok) throw new Error("Page catalogue HTTP " + response.status);
    const payload = await response.json();
    const added = mergeCatalogPageProducts(payload.products || []);
    catalogLoadedPages.add(page.file);
    catalogRetryAfter = 0;
    if (added) await persist();
    return added;
  } catch (error) {
    console.warn("Chargement d'une page catalogue impossible.", error);
    catalogRetryAfter = Date.now() + 30000;
    return 0;
  } finally {
    catalogPagePending = false;
  }
}
async function loadNextCatalogPage() {
  if (!state || catalogPagePending || catalogNextPending || Date.now() < catalogRetryAfter) return false;
  catalogNextPending = true;
  let totalAdded = 0;
  try {
    await refreshCatalogManifest(false);
    if (!catalogManifest || !Array.isArray(catalogManifest.pages)) return false;
    while (true) {
      let index = catalogManifest.pages.findIndex(page => !catalogLoadedPages.has(page.file));
      if (index < 0) {
        await refreshCatalogManifest(false);
        if (!catalogManifest || !Array.isArray(catalogManifest.pages)) break;
        index = catalogManifest.pages.findIndex(page => !catalogLoadedPages.has(page.file));
      }
      if (index < 0) break;

      const added = await loadCatalogPage(index);
      totalAdded += added;
      const isDiscovering = currentView === "discover" || currentView === "training";
      if (isDiscovering && added) render();

      // En grille, un lot suffit dès qu'il apporte des fiches nouvelles.
      if (currentView === "discover" && state.settings.discoveryView === "grid" && added) break;

      // En mode swipe, continuer au-delà des lots vides ou déjà vus jusqu'à
      // ce qu'il reste un vrai tampon de propositions, ou que les pages soient épuisées.
      if (isDiscovering) {
        const available = rankProducts(state.products,state,{
          training:currentView === "training",communitySignals:communitySignals
        }).length;
        if (available >= 8) break;
      } else if (added) {
        render();
        break;
      }
    }
    return totalAdded > 0;
  } finally {
    catalogNextPending = false;
  }
}
function maybePrefetchCatalog() {
  if (!state || (currentView !== "discover" && currentView !== "training") || catalogPagePending || catalogNextPending) return;
  const available = rankProducts(state.products,state,{
    training:currentView === "training",communitySignals:communitySignals
  }).length;
  if (available <= 8) loadNextCatalogPage();
}

function renderCatalogStatus() {
  const liveCount = Number(catalogMeta.liveProductCount) ||
    state.products.filter(product => product.sourceType === "public-web" && product.catalogStatus === "active").length;
  const curatedCount = Number(catalogMeta.curatedProductCount) ||
    state.products.filter(product => product.sourceType === "curated").length;
  const syncedAt = catalogMeta.syncedAt ? new Date(catalogMeta.syncedAt).toLocaleString("fr-FR") : "Pas encore actualisé";
  const directoryCount = Number(catalogMeta.directoryCount) || 200;
  const pageCount = Number(catalogMeta.pageCount) || (catalogManifest && catalogManifest.pageCount) || 0;
  const connected = catalogMeta.status === "connected" || catalogMeta.status === "partial";
  const sourceLabel = Array.isArray(catalogMeta.sources) && catalogMeta.sources.length
    ? catalogMeta.sources.slice(0, 8).join(" · ") + (catalogMeta.sources.length > 8 ? " · +" + (catalogMeta.sources.length - 8) : "")
    : "Les boutiques accessibles seront détectées automatiquement";
  const message = connected
    ? "Dernière rotation : " + syncedAt + " · " + Number(catalogMeta.scannedSourceCount || catalogMeta.attemptedSourceCount || 0) + " boutique(s) explorée(s) sur " + directoryCount
    : "Catalogue de 200 enseignes en rotation ; les premières collectes sont publiées progressivement.";
  return '<section class="catalog-status panel ' + (connected ? "is-connected" : "is-pending") + '" aria-label="État du catalogue public">' +
    '<div class="catalog-status-main"><span class="eyebrow">Catalogue public multi-boutiques</span><strong>' + liveCount + ' article(s) publics exploitables</strong>' +
    '<p>' + esc(message) + '</p><small>' + esc(sourceLabel) + '</small></div><div class="catalog-status-side"><span>' +
    curatedCount + ' référence(s) éditoriale(s) · ' + pageCount + ' page(s) de catalogue</span><a class="button-quiet button-small" href="https://github.com/sopp24/DRESSOPP/blob/main/data/merchant-directory.json" target="_blank" rel="noopener noreferrer">Répertoire des 200 enseignes ↗</a></div></section>';
}
function renderRetailerDirectory() {
  const groups = RETAILER_GROUPS.map(function(group) {
    return '<div class="retailer-group"><h3>' + esc(group.title) + '</h3><div class="retailer-links">' +
      group.items.map(function(item) {
        return '<a class="retailer-link" href="' + esc(item[1]) + '" target="_blank" rel="noopener noreferrer"><span>' + esc(item[0]) + '</span><i aria-hidden="true">↗</i></a>';
      }).join("") + '</div></div>';
  }).join("");
  const allDirectory = Array.isArray(catalogDirectory) && catalogDirectory.length
    ? Array.from(new Set(catalogDirectory.map(item => item.segment))).map(function(segment) {
        const items = catalogDirectory.filter(item => item.segment === segment);
        return '<div class="retailer-group"><h3>' + esc(segment) + '</h3><div class="retailer-links">' +
          items.map(function(item) {
            return '<a class="retailer-link" href="' + esc(item.url) + '" target="_blank" rel="noopener noreferrer"><span>' + esc(item.name) + '</span><i aria-hidden="true">↗</i></a>';
          }).join("") + '</div></div>';
      }).join("")
    : '<p class="retailer-disclaimer">Le répertoire complet de 200 enseignes est disponible dans data/merchant-directory.json.</p>';
  return '<section class="panel retailer-directory"><div class="retailer-directory-heading"><div><span class="eyebrow">Tes sources</span><h2>Explorer les boutiques</h2>' +
    '<p>Les flux autorisés alimentent le swipe. Les 200 enseignes du répertoire sont classées par univers et par gamme de prix.</p></div>' +
    '<a class="button-quiet button-small" href="https://www.facebook.com/ads/library/?active_status=active&ad_type=ALL&country=FR" target="_blank" rel="noopener noreferrer">Meta Ad Library ↗</a></div>' +
    '<div class="retailer-groups">' + groups + '</div>' +
    '<details class="retailer-directory-expanded"><summary>Voir les 200 enseignes du répertoire</summary><div class="retailer-groups">' + allDirectory + '</div></details>' +
    '<p class="retailer-disclaimer">La Meta Ad Library donne accès à des publicités publiques, pas à ton fil publicitaire Instagram personnalisé. Les avis d’article ne sont pas assimilés à une note de fiabilité du marchand.</p></section>';
}
function renderDeckCard(product, training) {
  const brand = product.brand || product.merchant || product.source || "Marque non renseignée";
  const price = formatPrice(product.price);
  const articleUrl = safeExternalUrl(product.url);
  const saved = isLiked(product.id);
  const originalLink = articleUrl
    ? '<a class="product-original-link" href="' + esc(articleUrl) + '" target="_blank" rel="noopener noreferrer"><span>Voir l’article original</span><i aria-hidden="true">↗</i></a>'
    : '<button class="product-original-link" type="button" data-action="details" data-id="' + esc(product.id) + '"><span>Voir la fiche produit</span><i aria-hidden="true">↗</i></button>';
  return '<div class="deck-card-wrap"><article class="product-card" id="active-product-card" data-product-id="' + esc(product.id) + '" aria-label="' + esc(product.name) + '">' +
    '<div class="product-visual">' + imageMarkup(product.imageUrl, product.name) + '</div>' +
    '<div class="swipe-tint" aria-hidden="true"></div>' +
    '<div class="swipe-stamp swipe-stamp-nope" aria-hidden="true">NON</div><div class="swipe-stamp swipe-stamp-like" aria-hidden="true">OUI</div><div class="swipe-stamp swipe-stamp-save" aria-hidden="true">AJOUTÉ</div>' +
    '<div class="product-info"><div class="product-copy">' +
      '<span class="swipe-category">' + esc(product.objective || "Sélection DRESSOPP") + '</span>' +
      '<h2 class="product-title">' + esc(product.name) + '</h2>' +
      '<div class="product-brand-price"><span>' + esc(brand) + '</span><i aria-hidden="true">•</i><strong>' + esc(price) + '</strong></div>' +
    '</div><div class="product-card-links"><button class="product-details-pill" type="button" data-action="details" data-id="' + esc(product.id) + '">Détails <span aria-hidden="true">↗</span></button>' + originalLink + '</div></div>' +
    '<div class="deck-actions" aria-label="Actions sur cet article">' +
    '<button class="deck-action deck-action-undo" type="button" data-action="undo" ' + (state.interactions.lastAction ? "" : "disabled") + ' aria-label="Annuler la dernière action" title="Annuler la dernière action"><img class="deck-action-icon" src="./assets/rewind.webp" alt="" aria-hidden="true" draggable="false"></button>' +
    '<button class="deck-action deck-action-no" type="button" data-action="vote" data-vote="no" data-id="' + esc(product.id) + '" aria-label="Passer" title="Passer"><img class="deck-action-icon" src="./assets/cross.webp" alt="" aria-hidden="true" draggable="false"></button>' +
    '<button class="deck-action deck-action-save' + (saved ? ' is-selected' : '') + '" type="button" data-action="save-list" data-id="' + esc(product.id) + '" aria-label="' + (saved ? 'Déjà dans ma liste' : 'Ajouter à ma liste') + '" aria-pressed="' + String(saved) + '" title="' + (saved ? 'Dans ma liste' : 'Ajouter à ma liste') + '"><img class="deck-action-icon" src="./assets/star.webp" alt="" aria-hidden="true" draggable="false"></button>' +
    '<button class="deck-action deck-action-yes" type="button" data-action="vote" data-vote="yes" data-id="' + esc(product.id) + '" aria-label="J’aime" title="J’aime"><img class="deck-action-icon" src="./assets/fav.webp" alt="" aria-hidden="true" draggable="false"></button>' +
    '<button class="deck-action deck-action-share" type="button" data-action="share-product" data-id="' + esc(product.id) + '" aria-label="Partager cet article" title="Partager"><img class="deck-action-icon" src="./assets/share.webp" alt="" aria-hidden="true" draggable="false"></button>' +
    '</div><span class="deck-hint">Gauche : passer · Droite : j’aime · Bas : ajouter à ma liste</span>' +
    '</article></div>';
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
  const locallyRanked = rankProducts(state.products, state, { training: training, communitySignals: communitySignals });
  const products = aiAgentState.status === "ready"
    ? orderProductsByAgent(locallyRanked, aiAgentState.recommendations)
    : locallyRanked;
  const yesCount = state.interactions.likes.length;
  const savedCount = state.likedProducts.length;
  const rejected = state.interactions.dislikes.length;
  const heading = training
    ? renderPageHeading("Élargis ton univers", "Entraînement", "Explore volontairement de nouvelles coupes, matières et associations. Tes réponses Oui et Non affinent le profil, sans ajout automatique à ta liste.", '<button class="button-secondary" type="button" data-view="discover">Retour à Pour toi</button>')
    : "";
  const appToolbar = !training
    ? '<div class="discovery-app-toolbar"><div class="discovery-app-controls">' + renderFilterBar(false) + '</div></div>'
    : "";
  const body = products.length ? renderDeckCard(products[0],training) : renderEmptyProducts(training);
  const trainingFilter = training ? renderFilterBar(true) : "";
  const trainingExtras = training
    ? '<div class="deck-topline"><span><strong>Exploration active</strong> · ' + products.length + ' article(s) à découvrir</span><span>Nouveauté prioritaire</span></div>' +
      '<aside class="deck-aside"><section class="panel aside-card"><h2 class="aside-title">Ton évolution <span>en direct</span></h2>' +
      '<p>Chaque décision affine ton profil. Une consultation reste un signal léger ; tes réponses Oui et Non comptent davantage.</p>' +
      '<div class="aside-stat"><div class="stat-box"><strong>' + yesCount + '</strong><small>Oui</small></div><div class="stat-box"><strong>' + rejected + '</strong><small>Non</small></div><div class="stat-box"><strong>' + savedCount + '</strong><small>Dans ma liste</small></div></div></section>' +
      '<section class="panel aside-card"><h2 class="aside-title">Équilibre du moment <span>' + esc(state.settings.trainingDiscoveryLevel) + '% découverte</span></h2>' +
      '<p>Le mode Entraînement donne plus de poids à la nouveauté pour élargir ton terrain de jeu.</p></section></aside>' +
      '<section class="panel training-pins-panel"><div class="training-pins-heading"><span class="eyebrow">Tes références visuelles</span><h2>Pins Pinterest</h2><p>Les épingles synchronisées nourrissent ton exploration et tes propositions de tenues.</p></div>' + renderInspirations() + '</section>' +
      renderCatalogStatus() + renderRetailerDirectory() + renderAiAgentPanel()
    : "";
  return '<div class="discovery-page' + (!training ? ' discovery-page--app' : '') + '">' +
    (training ? heading + trainingFilter : appToolbar) +
    '<div class="discovery-layout discovery-layout--swipe"><section class="deck-column">' +
    (training ? trainingExtras.split('<aside')[0] : "") + body + '</section>' +
    (training ? '<div class="training-support">' + trainingExtras.slice(trainingExtras.indexOf('<aside')) + '</div>' : "") +
    '</div></div>';
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
  const remote = (pinterestFeed.pins || []).map(function(pin) {
    const id = String(pin.id);
    return {
      id: id, pinId: id, title: pin.title || pin.description || pin.altText || "Épingle Pinterest",
      description: pin.description || pin.altText || "",
      imageUrl: pin.imageUrl || "", sourceUrl: pin.pinUrl || "https://www.pinterest.com/pin/" + encodeURIComponent(id) + "/",
      visualAnalysis: pin.visualAnalysis || null, tags: inferPinterestTags(pin), importedAt: pin.createdAt || null,
      fromFeed: true, origin: "Pinterest", kind: "outfit"
    };
  });
  const local = (state.inspirations || []).filter(function(pin) { return pin.source === "Pinterest"; }).map(function(pin) {
    return Object.assign({ origin: "Pinterest", kind: "outfit" }, pin);
  });
  const seen = new Set();
  return remote.concat(local).filter(function(pin) {
    const key = pin.pinId || pin.sourceUrl || pin.id;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function renderInspirations() {
  const items = pinterestPinCards().slice(0,80);
  const unseen = items.filter(function(item) {
    return item.fromFeed && !(state.seenPinterestPins || []).includes(String(item.pinId));
  });
  const lastSync = pinterestFeed.lastSync ? new Date(pinterestFeed.lastSync).toLocaleString("fr-FR") : "Aucune synchronisation réussie";
  const heading = renderPageHeading("Tes inspirations de style", "Pinterest", "Les épingles synchronisées et celles que tu ajoutes servent à apprendre tes préférences et à composer des tenues.",
    '<a class="button-secondary" href="' + esc(PINTEREST_BOARD_URL) + '" target="_blank" rel="noopener noreferrer">Ouvrir mon tableau ↗</a><button class="button-primary" type="button" data-action="add-inspiration">＋ Ajouter un Pin</button>');
  const cards = items.length ? '<div class="inspiration-grid">' + items.map(function(item) {
    const seen = item.fromFeed && (state.seenPinterestPins || []).includes(String(item.pinId));
    const newBadge = item.fromFeed && !seen ? '<span class="pin-new-badge">NOUVEAU</span>' : '';
    const sourceLabel = "Pinterest · " + (item.importedAt ? new Date(item.importedAt).toLocaleDateString("fr-FR") : "Ajout manuel");
    const link = safeExternalUrl(item.sourceUrl)
      ? '<a class="button-quiet button-small" data-mark-seen-on-open="' + esc(item.pinId || item.id) + '" href="' + esc(safeExternalUrl(item.sourceUrl)) + '" target="_blank" rel="noopener noreferrer">Voir le Pin ↗</a>'
      : '<span class="button-quiet button-small">Pin ajouté manuellement</span>';
    return '<article class="inspiration-card"><div class="inspiration-image">' + imageMarkup(item.imageUrl,item.title) + newBadge + '</div><div class="inspiration-copy"><strong>' + esc(item.title || "Inspiration Pinterest") + '</strong><small>' + esc(sourceLabel) + '</small>' +
      '<div class="inspiration-tags">' + (item.tags || []).slice(0,8).map(function(tag) { return '<span>' + esc(tag) + '</span>'; }).join("") + '</div>' +
      '<div class="grid-bottom">' + link +
      (item.fromFeed && !seen ? '<button class="button-secondary button-small" type="button" data-action="mark-pin-seen" data-id="' + esc(item.pinId) + '">Marquer vu</button>' : '') +
      (item.kind !== "detail" ? '<button class="mini-icon-button" type="button" data-action="use-pin-outfit" data-id="' + esc(item.pinId || item.id) + '" aria-label="Composer une tenue depuis cette référence">✦</button>' : '') +
      '</div></div></article>';
  }).join("") + '</div>' : '<div class="empty-state"><div class="empty-mark">⌁</div><h2>Aucune épingle Pinterest chargée</h2><p>Synchronise ton tableau mode ou ajoute directement une inspiration pour commencer à personnaliser tes propositions.</p><div class="empty-actions"><a class="button-primary" href="' + esc(PINTEREST_BOARD_URL) + '" target="_blank" rel="noopener noreferrer">Ouvrir mon tableau Pinterest ↗</a><button class="button-secondary" type="button" data-action="add-inspiration">Ajouter un Pin</button></div></div>';
  const pinterestStatus = pinterestFeed.privacy === "PUBLIC"
    ? "Tableau Pinterest confirmé par l’API"
    : "En attente de la prochaine synchronisation Pinterest";
  return heading +
    '<div class="pinterest-status-strip"><div><strong>' + items.length + '</strong><span>épingle(s) disponibles</span><strong>' + unseen.length + '</strong><span>nouvelle(s) épingle(s)</span></div><div><small>' + esc(pinterestStatus) + '</small><small>Dernière synchronisation : ' + esc(lastSync) + '</small></div></div>' +
    '<div class="source-note pinterest-notice">Les photos, descriptions et caractéristiques visuelles des Pins servent à personnaliser les propositions. Les inspirations ne sont pas présentées comme des articles marchands et ne reçoivent jamais de faux prix ou liens.</div>' +
    cards;
}
function outfitPinKey(pin) {
  return String(pin && (pin.pinId || pin.id || pin.sourceUrl || pin.pinUrl) || "");
}
function getOutfitFilters() {
  const saved = state.settings.outfitFilters || {};
  const fallbackStyles = state.settings.style && state.settings.style !== "Tous"
    ? [state.settings.style]
    : (state.profile.preferredStyles || []);
  return {
    styles:Array.isArray(saved.styles) ? saved.styles : fallbackStyles,
    season:saved.season || "Toute saison",
    maxPrice:saved.maxPrice == null || saved.maxPrice === "" ? null : Number(saved.maxPrice)
  };
}
function renderOutfitFilters() {
  const filters = getOutfitFilters();
  const selected = new Set(filters.styles);
  return '<section class="panel outfit-filter-panel">' +
    '<div class="outfit-filter-heading"><div><span class="eyebrow">Personnalise les propositions</span><strong>Quels looks te correspondent ?</strong><small>Pinterest reste la seule source d’inspiration des tenues.</small></div>' +
    '<button class="button-quiet button-small" type="button" data-action="reset-outfit-filters">Réinitialiser</button></div>' +
    '<div class="outfit-filter-row"><div class="outfit-style-filter"><span class="outfit-filter-label">Styles</span><div class="outfit-style-options">' +
    STYLES.map(function(style) {
      return '<label class="outfit-style-option' + (selected.has(style) ? ' is-selected' : '') + '"><input type="checkbox" data-outfit-style value="' + esc(style) + '"' + (selected.has(style) ? ' checked' : '') + '><span>' + esc(style) + '</span></label>';
    }).join("") +
    '</div></div><div class="outfit-extra-filters"><div class="field"><label for="outfit-season">Saison</label><select id="outfit-season" data-outfit-filter="season">' +
    selectOption("Toute saison",filters.season) + SEASONS.map(function(item) { return selectOption(item,filters.season); }).join("") +
    '</select></div><div class="field outfit-budget-field"><label for="outfit-budget">Budget total du look</label><div class="price-input-wrap"><input id="outfit-budget" data-outfit-filter="maxPrice" type="number" min="0" step="1" value="' + (filters.maxPrice == null ? "" : esc(filters.maxPrice)) + '" placeholder="Sans limite"><span class="price-input-currency" aria-hidden="true">€</span></div></div></div></div>' +
    '<p class="field-hint outfit-filter-note">Tes inspirations Pinterest, tes préférences de profil, tes tailles et ton budget servent à sélectionner les pièces. Les filtres ne remplacent jamais les caractéristiques réellement disponibles dans les fiches produit.</p>' +
    '</section>';
}
function renderOutfitProposalCard(idea) {
  const pin = idea.pin;
  const pinId = outfitPinKey(pin);
  const savedOutfit = (state.savedOutfits || []).some(function(item) { return item.pinId === pinId; });
  const feedback = state.outfitFeedback && state.outfitFeedback[pinId] && state.outfitFeedback[pinId].vote || "";
  const summary = pin.visualAnalysis && pin.visualAnalysis.summary || pin.description || "";
  const productPreviews = idea.items.slice(0,3).map(function(entry) {
    return '<div class="outfit-proposal-piece">' + imageMarkup(entry.product.imageUrl,entry.product.name) + '</div>';
  }).join("");
  const tags = idea.tags.slice(0,5).map(function(tag) { return '<span>' + esc(tag) + '</span>'; }).join("");
  const missingLabels = (idea.missingSlots || []).map(outfitSlotLabel).join(", ");
  const total = idea.totalPrice == null ? "Prix total à confirmer" : formatPrice(idea.totalPrice);
  return '<article class="panel outfit-proposal-card">' +
    '<button class="outfit-proposal-open" type="button" data-action="show-outfit" data-id="' + esc(pinId) + '" aria-label="Voir la tenue ' + esc(pin.title || "inspirée de Pinterest") + '">' +
    '<div class="outfit-proposal-image">' + imageMarkup(pin.imageUrl,pin.title || summary || "Inspiration Pinterest") + '<span class="outfit-source-pill">Pinterest</span><span class="outfit-piece-count">' + idea.items.length + ' pièces</span></div>' +
    '<div class="outfit-proposal-copy"><span class="eyebrow">' + esc(idea.tags.slice(0,2).join(" · ") || "Inspiration de ton tableau") + '</span><h2>' + esc(pin.title || "Une silhouette à adopter") + '</h2>' +
    (summary ? '<p>' + esc(String(summary).slice(0,130)) + '</p>' : '') +
    '<div class="inspiration-tags">' + tags + '</div><div class="outfit-proposal-preview">' + productPreviews + '</div>' +
    '<div class="outfit-proposal-meta"><strong>' + esc(total) + '</strong><span>' + idea.items.length + ' articles associés</span></div>' +
    (missingLabels ? '<small class="outfit-missing-note">À compléter : ' + esc(missingLabels) + '</small>' : '<small class="outfit-missing-note is-complete">✓ Les 3 pièces essentielles sont réunies</small>') +
    '</div></button>' +
    '<div class="outfit-proposal-actions">' +
    '<button class="button-primary button-small" type="button" data-action="show-outfit" data-id="' + esc(pinId) + '">Voir la tenue <span aria-hidden="true">↗</span></button>' +
    (savedOutfit ? '<span class="outfit-saved-label">✓ Dans Mes tenues</span>' : '<button class="button-secondary button-small" type="button" data-action="save-full-outfit" data-id="' + esc(pinId) + '">♡ Enregistrer le look</button>') +
    '<div class="outfit-quick-feedback"><button type="button" data-action="rate-outfit" data-id="' + esc(pinId) + '" data-vote="yes" aria-label="J’aime ce style" aria-pressed="' + String(feedback === "yes") + '" class="' + (feedback === "yes" ? "is-selected" : "") + '">✓</button><button type="button" data-action="rate-outfit" data-id="' + esc(pinId) + '" data-vote="no" aria-label="Ce style ne me plaît pas" aria-pressed="' + String(feedback === "no") + '" class="' + (feedback === "no" ? "is-selected" : "") + '">×</button></div>' +
    '</div></article>';
}
function renderSavedOutfitCard(saved, pinsById) {
  const pin = pinsById.get(saved.pinId) || saved.reference || {};
  const products = (saved.productIds || []).map(productById).filter(Boolean);
  return '<article class="panel outfit-proposal-card outfit-saved-card">' +
    '<button class="outfit-proposal-open" type="button" data-action="open-saved-outfit" data-id="' + esc(saved.pinId) + '">' +
    '<div class="outfit-proposal-image">' + imageMarkup(pin.imageUrl || saved.imageUrl,pin.title || saved.title || "Tenue enregistrée") + '<span class="outfit-source-pill">Favori</span><span class="outfit-piece-count">' + products.length + ' pièces</span></div>' +
    '<div class="outfit-proposal-copy"><span class="eyebrow">Enregistrée le ' + esc(saved.savedAt ? new Date(saved.savedAt).toLocaleDateString("fr-FR") : "—") + '</span><h2>' + esc(pin.title || saved.title || "Ma tenue") + '</h2>' +
    '<div class="outfit-proposal-preview">' + products.slice(0,3).map(function(product) { return '<div class="outfit-proposal-piece">' + imageMarkup(product.imageUrl,product.name) + '</div>'; }).join("") + '</div>' +
    '<div class="outfit-proposal-meta"><strong>' + esc(products.length + " articles dans ta garde-robe") + '</strong><span>Tenue sauvegardée</span></div></div></button>' +
    '<div class="outfit-proposal-actions"><button class="button-primary button-small" type="button" data-action="open-saved-outfit" data-id="' + esc(saved.pinId) + '">Ouvrir la tenue ↗</button>' +
    '<button class="button-quiet button-small" type="button" data-action="remove-saved-outfit" data-id="' + esc(saved.pinId) + '">Retirer des favoris</button></div></article>';
}
function renderOutfits() {
  const pinterestPins = pinterestPinCards().filter(function(pin) { return pin.origin === "Pinterest" && pin.kind !== "detail" && pin.imageUrl; });
  const pinsById = new Map(pinterestPins.map(function(pin) { return [outfitPinKey(pin),pin]; }));
  const wardrobe = state.likedProducts.map(function(item) { return productById(item.productId); }).filter(Boolean);
  const dislikedIds = (state.interactions.dislikes || []).map(function(item) { return item.productId; });
  const feedbacks = state.outfitFeedback && typeof state.outfitFeedback === "object" ? state.outfitFeedback : {};
  const filters = getOutfitFilters();
  const ideas = buildOutfitIdeas(pinterestPins,wardrobe,state.products,dislikedIds,feedbacks,{
    styles:filters.styles,season:filters.season,maxPrice:filters.maxPrice,profile:state.profile
  }).filter(function(idea) { return idea.items.length >= 2; });
  currentOutfitIdeas = ideas;
  if (state.selectedPinterestPin) {
    ideas.sort(function(a,b) {
      const selected = String(state.selectedPinterestPin);
      return Number(outfitPinKey(b.pin) === selected) - Number(outfitPinKey(a.pin) === selected);
    });
  }
  const savedOutfits = Array.isArray(state.savedOutfits) ? state.savedOutfits : [];
  const savedView = state.settings.outfitLibraryView === "saved";
  const feedbackValues = Object.values(feedbacks);
  const approvedCount = feedbackValues.filter(function(item) { return item && item.vote === "yes"; }).length;
  const rejectedCount = feedbackValues.filter(function(item) { return item && item.vote === "no"; }).length;
  const heading = renderPageHeading("Des looks guidés par tes inspirations", "Tenues", "Chaque proposition part d’un Pin Pinterest, puis sélectionne des pièces du catalogue et de ta garde-robe selon ton style, tes préférences et ton budget.",
    '<a class="button-secondary" href="' + esc(PINTEREST_BOARD_URL) + '" target="_blank" rel="noopener noreferrer">Voir Pinterest ↗</a>');
  const tabs = '<div class="outfit-library-tabs" role="tablist" aria-label="Tenues proposées et favorites">' +
    '<button type="button" role="tab" data-action="toggle-outfit-library" data-view-mode="discover" aria-selected="' + String(!savedView) + '" class="' + (!savedView ? "is-active" : "") + '">Pour toi <span>' + ideas.length + '</span></button>' +
    '<button type="button" role="tab" data-action="toggle-outfit-library" data-view-mode="saved" aria-selected="' + String(savedView) + '" class="' + (savedView ? "is-active" : "") + '">Mes tenues <span>' + savedOutfits.length + '</span></button></div>';
  if (savedView) {
    return heading + tabs + (savedOutfits.length
      ? '<div class="outfit-proposal-grid">' + savedOutfits.slice().sort(function(a,b) { return new Date(b.savedAt || 0) - new Date(a.savedAt || 0); }).map(function(saved) { return renderSavedOutfitCard(saved,pinsById); }).join("") + '</div>'
      : '<div class="empty-state"><div class="empty-mark">♡</div><h2>Pas encore de tenue favorite</h2><p>Ouvre un look dans « Pour toi », puis enregistre la tenue complète. Ses pièces rejoindront aussi ta garde-robe.</p><div class="empty-actions"><button class="button-primary" type="button" data-action="toggle-outfit-library" data-view-mode="discover">Découvrir les tenues</button></div></div>');
  }
  if (!pinterestPins.length) {
    return heading + tabs + '<div class="empty-state"><div class="empty-mark">⌁</div><h2>Aucune inspiration Pinterest disponible</h2><p>Les propositions de tenues sont exclusivement générées depuis les épingles Pinterest synchronisées ou ajoutées manuellement dans tes inspirations. </p><div class="empty-actions"><button class="button-primary" type="button" data-view="inspirations">Voir mes inspirations Pinterest</button><a class="button-secondary" href="' + esc(PINTEREST_BOARD_URL) + '" target="_blank" rel="noopener noreferrer">Ouvrir Pinterest ↗</a></div></div>';
  }
  const intro = '<div class="outfit-intro panel"><div><strong>' + ideas.length + ' look(s) correspondant aux critères</strong><p>' +
    (filters.styles.length ? "Styles : " + esc(filters.styles.join(", ")) + " · " : "Tous les styles · ") +
    esc(filters.season) + (filters.maxPrice == null ? " · Sans budget maximum" : " · " + esc(formatPrice(filters.maxPrice)) + " maximum par tenue") +
    '</p><div class="outfit-feedback-summary"><span>' + approvedCount + ' style(s) aimé(s)</span><span>' + rejectedCount + ' à éviter</span></div></div><button class="button-secondary button-small" type="button" data-view="wardrobe">Voir mes vêtements · ' + wardrobe.length + '</button></div>';
  const cards = ideas.map(renderOutfitProposalCard).join("");
  const noMatches = '<div class="empty-state"><div class="empty-mark">✦</div><h2>Aucune composition ne passe ces critères</h2><p>Essaie un autre style, une autre saison ou un budget plus souple. Les inspirations restent exclusivement issues de Pinterest.</p><button class="button-secondary" type="button" data-action="reset-outfit-filters">Élargir les critères</button></div>';
  return heading + tabs + renderOutfitFilters() + intro +
    (ideas.length ? '<div class="outfit-proposal-grid">' + cards + '</div>' : noMatches);
}
function outfitSlotLabel(slot) {
  return ({top:"Haut",bottom:"Bas",shoes:"Chaussures",outerwear:"Veste / manteau",accessory:"Accessoire"})[slot] || "Pièce";
}
function openOutfitDetail(idea) {
  if (!idea || !idea.pin) return;
  const pin = idea.pin;
  const pinId = outfitPinKey(pin);
  const items = (idea.items || []).filter(function(entry) { return entry && entry.product; });
  const existingFavorite = (state.savedOutfits || []).find(function(item) { return item.pinId === pinId; });
  const isSaved = Boolean(existingFavorite);
  const totalAmount = outfitTotalPrice(items);
  const total = totalAmount == null ? "Prix total à confirmer" : formatPrice(totalAmount);
  const summary = pin.visualAnalysis && pin.visualAnalysis.summary || pin.description || "";
  const missingLabels = (idea.missingSlots || []).map(outfitSlotLabel).join(", ");
  const slides = items.map(function(entry,index) {
    const product = entry.product;
    const liked = isLiked(product.id);
    const url = safeExternalUrl(product.url);
    return '<article class="outfit-carousel-card" data-outfit-slide="' + index + '">' +
      '<div class="outfit-carousel-image">' + imageMarkup(product.imageUrl,product.name) + '<span class="outfit-carousel-slot">' + esc(outfitSlotLabel(entry.slot)) + '</span><span class="outfit-carousel-index">' + (index+1) + ' / ' + items.length + '</span></div>' +
      '<div class="outfit-carousel-copy"><span class="product-brand">' + esc(product.brand || product.merchant || "Marque non renseignée") + '</span><h3>' + esc(product.name) + '</h3>' +
      '<strong class="outfit-carousel-price">' + esc(formatPrice(product.price)) + '</strong><p>' + esc(product.description || (product.colors || []).join(" · ") || "Fiche produit enregistrée dans le catalogue.") + '</p>' +
      '<div class="outfit-carousel-actions">' +
      (liked ? '<span class="outfit-in-wardrobe">✓ Dans Vêtements</span>' : '<button class="button-primary button-small" type="button" data-action="save-outfit-piece" data-id="' + esc(product.id) + '" data-pin-id="' + esc(pinId) + '">＋ Ajouter à Vêtements</button>') +
      '<button class="button-secondary button-small" type="button" data-action="details" data-id="' + esc(product.id) + '">Détails</button>' +
      (url ? '<a class="button-quiet button-small" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">Boutique ↗</a>' : '') +
      '</div></div></article>';
  }).join("");
  modalRoot.innerHTML = '<div class="modal-backdrop outfit-modal-backdrop"><section class="modal modal-wide outfit-detail-modal" role="dialog" aria-modal="true" aria-labelledby="outfit-detail-title" data-modal-content>' +
    '<div class="modal-head outfit-detail-head"><div class="outfit-detail-reference">' + imageMarkup(pin.imageUrl,pin.title || "Inspiration Pinterest") +
    '<div><span class="eyebrow">Inspiration Pinterest</span><h2 id="outfit-detail-title">' + esc(pin.title || "Une tenue inspirée de ton tableau") + '</h2>' +
    (summary ? '<p>' + esc(String(summary).slice(0,220)) + '</p>' : '') +
    '<div class="inspiration-tags">' + (idea.tags || []).slice(0,6).map(function(tag) { return '<span>' + esc(tag) + '</span>'; }).join("") + '</div>' +
    '<strong class="outfit-detail-total">' + esc(total) + '</strong>' +
    (missingLabels ? '<p class="outfit-missing-note">Pièces essentielles à compléter : ' + esc(missingLabels) + '.</p>' : '<p class="outfit-missing-note is-complete">✓ Haut, bas et chaussures réunis</p>') +
    '</div></div>' +
    '<button class="close-button" type="button" data-action="close-modal" aria-label="Fermer">×</button></div>' +
    '<div class="outfit-detail-toolbar"><div><strong>Les pièces de ce look</strong><small>' + items.length + ' article(s) · fais défiler pour les découvrir</small></div><div class="outfit-carousel-controls">' +
    '<button type="button" data-action="outfit-carousel-prev" aria-label="Articles précédents">‹</button><button type="button" data-action="outfit-carousel-next" aria-label="Articles suivants">›</button></div></div>' +
    (items.length ? '<div class="outfit-product-carousel" id="outfit-product-carousel">' + slides + '</div>' : '<div class="empty-state"><h2>Aucune pièce disponible</h2><p>Le catalogue ne contient pas encore d’article suffisamment proche de cette inspiration.</p></div>') +
    '<div class="outfit-detail-footer"><p>Enregistrer le look ajoute la tenue à <strong>Mes tenues</strong> et chaque article à <strong>Vêtements</strong>. Tu peux aussi ne garder que certaines pièces.</p>' +
    (isSaved ? '<button class="button-secondary" type="button" data-action="remove-saved-outfit" data-id="' + esc(pinId) + '">Retirer de Mes tenues</button>' :
      '<button class="button-primary" type="button" data-action="save-full-outfit" data-id="' + esc(pinId) + '"' + (items.length < 2 ? " disabled" : "") + '>♡ Ajouter toute la tenue aux favoris</button>') +
    '</div></section></div>';
  const backdrop = modalRoot.querySelector(".modal-backdrop");
  backdrop.addEventListener("click",function(event) { if(event.target === backdrop) closeModal(); });
  attachImageFallbacks(modalRoot);
}
function saveOutfitPiece(productId, pinId) {
  const product = productById(productId);
  if (!product) return;
  if (isLiked(productId)) { showToast("Cette pièce est déjà dans Vêtements",false); return; }
  const createdAt = new Date().toISOString();
  state.likedProducts.push({productId:productId,addedAt:createdAt});
  state.interactions.saves = Array.isArray(state.interactions.saves) ? state.interactions.saves : [];
  state.interactions.saves.push({productId:productId,createdAt:createdAt,view:"outfits"});
  state.interactions.lastAction = {productId:productId,action:"save",createdAt:createdAt};
  persist();
  render();
  const idea = currentOutfitIdeas.find(item => outfitPinKey(item.pin) === String(pinId));
  if (idea) openOutfitDetail(idea);
  showToast("Pièce ajoutée à Vêtements",true);
}
function saveFullOutfit(pinId) {
  const idea = currentOutfitIdeas.find(item => outfitPinKey(item.pin) === String(pinId));
  if (!idea || !idea.items || idea.items.length < 2) return;
  state.savedOutfits = Array.isArray(state.savedOutfits) ? state.savedOutfits : [];
  if (state.savedOutfits.some(item => item.pinId === String(pinId))) {
    showToast("Cette tenue est déjà dans Mes tenues",false);
    return;
  }
  const savedAt = new Date().toISOString();
  const productIds = [];
  let addedCount = 0;
  idea.items.forEach(function(entry) {
    const product = entry.product;
    if (!product || productIds.includes(product.id)) return;
    productIds.push(product.id);
    if (!isLiked(product.id)) {
      state.likedProducts.push({productId:product.id,addedAt:savedAt});
      state.interactions.saves = Array.isArray(state.interactions.saves) ? state.interactions.saves : [];
      state.interactions.saves.push({productId:product.id,createdAt:savedAt,view:"outfits"});
      addedCount += 1;
    }
  });
  state.savedOutfits.push({
    pinId:String(pinId),title:idea.pin.title || "Tenue Pinterest",description:idea.pin.description || "",
    imageUrl:idea.pin.imageUrl || "",sourceUrl:idea.pin.sourceUrl || "",
    tags:idea.tags || [],productIds:productIds,savedAt:savedAt
  });
  state.interactions.lastAction = null;
  persist();
  render();
  const updatedIdea = currentOutfitIdeas.find(item => outfitPinKey(item.pin) === String(pinId)) || idea;
  openOutfitDetail(updatedIdea);
  showToast("Tenue ajoutée à Mes tenues et " + addedCount + " pièce(s) ajoutée(s) à Vêtements",false);
}
function openSavedOutfit(pinId) {
  const saved = (state.savedOutfits || []).find(item => item.pinId === String(pinId));
  if (!saved) return;
  const liveIdea = currentOutfitIdeas.find(item => outfitPinKey(item.pin) === String(pinId));
  const pin = liveIdea && liveIdea.pin || Object.assign({
    id:saved.pinId,pinId:saved.pinId,origin:"Pinterest",kind:"outfit"
  },saved.reference || {},{
    title:saved.title,imageUrl:saved.imageUrl,description:saved.description,sourceUrl:saved.sourceUrl
  });
  const products = (saved.productIds || []).map(productById).filter(Boolean);
  const idea = liveIdea ? Object.assign({},liveIdea,{items:products.map(product => ({
    product,slot:productSlot(product),isSaved:true
  }))}) : {
    pin:pin,tags:saved.tags || [],items:products.map(product => ({product,slot:productSlot(product),isSaved:true}))
  };
  openOutfitDetail(idea);
}
function removeSavedOutfit(pinId) {
  state.savedOutfits = (state.savedOutfits || []).filter(item => item.pinId !== String(pinId));
  persist();
  render();
  closeModal();
  showToast("Tenue retirée de Mes tenues ; les pièces restent dans Vêtements",false);
}
function scrollOutfitCarousel(direction) {
  const track = modalRoot.querySelector("#outfit-product-carousel");
  if (!track) return;
  const slide = track.querySelector(".outfit-carousel-card");
  const distance = slide ? slide.getBoundingClientRect().width + 14 : track.clientWidth * .8;
  track.scrollBy({left:direction * distance,behavior:"smooth"});
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
function renderDiscoveryInsights() {
  const yesCount = state.interactions.likes.length;
  const rejectedCount = state.interactions.dislikes.length;
  const savedCount = state.likedProducts.length;
  const level = state.settings.discoveryLevel;
  return '<section class="discovery-insights-settings"><div class="discovery-insights-heading"><span class="eyebrow">Toutes les informations de Pour toi</span><h2>Ton expérience de découverte</h2><p>Retrouve ici les statistiques, le fonctionnement du personal shopper, l’état du catalogue et les boutiques disponibles. Ces informations ne prennent plus de place dans le swipe.</p></div>' +
    '<div class="discovery-insights-grid"><section class="panel aside-card"><h2 class="aside-title">Ton évolution <span>en direct</span></h2>' +
    '<p>Chaque décision affine ton profil. Une consultation reste un signal léger ; tes réponses Oui et Non comptent davantage.</p>' +
    '<div class="aside-stat"><div class="stat-box"><strong>' + yesCount + '</strong><small>Oui</small></div><div class="stat-box"><strong>' + rejectedCount + '</strong><small>Non</small></div><div class="stat-box"><strong>' + savedCount + '</strong><small>Dans ma liste</small></div></div></section>' +
    '<section class="panel aside-card"><h2 class="aside-title">Équilibre du moment <span>' + esc(level) + '% découverte</span></h2>' +
    '<p>Le curseur mélange tes goûts identifiés et des propositions plus inattendues. Ajuste-le depuis les filtres de Pour toi.</p></section></div>' +
    '<div class="source-note">Le classement combine ton profil, tes votes, les caractéristiques des Pins Pinterest analysés, la fraîcheur du catalogue et les avis d’article vérifiables. Les notes d’article ne représentent pas la fiabilité globale du marchand.</div>' +
    renderAiAgentPanel() + renderCatalogStatus() + renderRetailerDirectory() +
    '</section>';
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
    '<section class="panel section-panel"><h2 class="section-title">Zone sensible</h2><p class="field-hint">La réinitialisation supprime les données enregistrées sur cet appareil. Exporte d’abord une copie de sécurité.</p><div class="form-actions"><button class="button-danger button-small" type="button" data-action="delete-data">Supprimer toutes mes données locales</button></div></section>' + renderDiscoveryInsights();
}
function render() {
  document.body.classList.toggle("is-discovery-app", currentView === "discover");
  document.querySelectorAll("[data-view]").forEach(function(button) {
    button.classList.toggle("is-active", button.dataset.view === currentView);
  });
  const count = document.querySelector("#wardrobe-count");
  if (count) count.textContent = String(state.likedProducts.length);
  const outfitCount = document.querySelector("#outfit-count");
  if (outfitCount) { outfitCount.textContent = String((state.savedOutfits || []).length); outfitCount.hidden = !(state.savedOutfits || []).length; }
  const outfitCountMobile = document.querySelector("#outfit-count-mobile");
  if (outfitCountMobile) { outfitCountMobile.textContent = String((state.savedOutfits || []).length); outfitCountMobile.hidden = !(state.savedOutfits || []).length; }
  if (currentView === "wardrobe") main.innerHTML = renderWardrobe();
  else if (currentView === "training") main.innerHTML = renderDiscover(true);
  else if (currentView === "outfits") main.innerHTML = renderOutfits();
  else if (currentView === "profile") main.innerHTML = renderProfile();
  else if (currentView === "settings") main.innerHTML = renderSettings();
  else main.innerHTML = renderDiscover(false);
  attachSwipe();
  maybePrefetchCatalog();
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
  if (state && state.settings.aiAgentAutoRefresh && !aiAgentPending &&
      (currentView === "discover" || currentView === "training")) {
    const actionCount = aiAgentActionCount();
    if (actionCount - aiAgentLastActionCount >= 3) {
      aiAgentLastActionCount = actionCount;
      runAiAgent(false);
    }
  }
}
function showToast(message, undoAvailable) {
  toastRoot.innerHTML = '<div class="toast"><span>' + esc(message) + '</span>' +
    (undoAvailable ? '<button type="button" data-action="undo">Annuler</button>' : "") + '</div>';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function() { toastRoot.innerHTML = ""; }, 5000);
}
function animateDeckDecision(productId, action) {
  if (deckActionPending) return;
  const card = document.querySelector("#active-product-card");
  if (!card || card.dataset.productId !== String(productId)) {
    if (action === "save") saveToList(productId);
    else vote(productId, action);
    return;
  }
  deckActionPending = true;
  const directionClass = action === "yes" ? "is-like" : action === "no" ? "is-nope" : "is-save";
  card.classList.remove("is-dragging", "swipe-preview-like", "swipe-preview-nope", "swipe-preview-save");
  card.classList.add("is-committing", directionClass);
  card.style.removeProperty("transform");
  card.style.removeProperty("border-color");
  card.style.removeProperty("--swipe-tint-opacity");
  window.setTimeout(function() {
    deckActionPending = false;
    if (action === "save") saveToList(productId);
    else vote(productId, action);
  }, 340);
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
  state.savedOutfits = Array.isArray(imported.savedOutfits) ? imported.savedOutfits : [];
  state.settings.outfitFilters = Object.assign(base.settings.outfitFilters,state.settings.outfitFilters || {});
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
  else if (action === "vote") animateDeckDecision(actionButton.dataset.id, actionButton.dataset.vote || "no");
  else if (action === "save-list") animateDeckDecision(actionButton.dataset.id, "save");
  else if (action === "share-product") shareProduct(actionButton.dataset.id);
  else if (action === "undo") undoLast();
  else if (action === "rate-outfit") rateOutfit(actionButton.dataset.id, actionButton.dataset.vote);
  else if (action === "show-outfit") {
    const idea = currentOutfitIdeas.find(function(item) { return outfitPinKey(item.pin) === String(actionButton.dataset.id); });
    if (idea) openOutfitDetail(idea);
  }
  else if (action === "open-saved-outfit") openSavedOutfit(actionButton.dataset.id);
  else if (action === "save-full-outfit") saveFullOutfit(actionButton.dataset.id);
  else if (action === "save-outfit-piece") saveOutfitPiece(actionButton.dataset.id,actionButton.dataset.pinId);
  else if (action === "remove-saved-outfit") removeSavedOutfit(actionButton.dataset.id);
  else if (action === "toggle-outfit-library") {
    state.settings.outfitLibraryView = actionButton.dataset.viewMode === "saved" ? "saved" : "discover";
    persist(); render();
  }
  else if (action === "reset-outfit-filters") {
    state.settings.outfitFilters = {styles:[],season:"Toute saison",maxPrice:null};
    persist(); render();
  }
  else if (action === "outfit-carousel-prev") scrollOutfitCarousel(-1);
  else if (action === "outfit-carousel-next") scrollOutfitCarousel(1);
  else if (action === "remove-favorite") removeFavorite(actionButton.dataset.id);
  else if (action === "toggle-discovery-view") toggleDiscoveryView();
  else if (action === "toggle-filters") { discoveryFiltersOpen = !discoveryFiltersOpen; render(); }
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
  if (target.matches("[data-outfit-style]")) {
    const filters = getOutfitFilters();
    const selected = new Set(filters.styles);
    if (target.checked) selected.add(target.value);
    else selected.delete(target.value);
    state.settings.outfitFilters = Object.assign({},filters,{styles:Array.from(selected)});
    persist();
    render();
    return;
  }
  if (target.matches("[data-outfit-filter]")) {
    const filters = getOutfitFilters();
    const key = target.dataset.outfitFilter;
    if (key === "maxPrice") filters.maxPrice = target.value.trim() === "" ? null : Math.max(0,Number(target.value));
    else filters[key] = target.value;
    state.settings.outfitFilters = filters;
    persist();
    render();
    return;
  }
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
  if (!card || card.dataset.swipeBound === "true") return;
  card.dataset.swipeBound = "true";
  let startX = 0;
  let startY = 0;
  let startTime = 0;
  let deltaX = 0;
  let deltaY = 0;
  let dragging = false;
  let horizontalIntent = false;
  let verticalSaveIntent = false;
  let pointerId = null;

  function clearPreview(animateBack) {
    dragging = false;
    horizontalIntent = false;
    card.classList.remove("is-dragging", "swipe-preview-like", "swipe-preview-nope", "swipe-preview-save");
    card.style.removeProperty("--swipe-tint-opacity");
    card.style.removeProperty("border-color");
    if (animateBack) card.classList.add("is-returning");
    card.style.removeProperty("transform");
    if (animateBack) window.setTimeout(function() { card.classList.remove("is-returning"); }, 360);
  }

  card.addEventListener("pointerdown", function(event) {
    if (deckActionPending || event.button !== 0 || event.target.closest("button, a")) return;
    startX = event.clientX;
    startY = event.clientY;
    startTime = performance.now();
    deltaX = 0;
    deltaY = 0;
    horizontalIntent = false;
    verticalSaveIntent = false;
    dragging = true;
    pointerId = event.pointerId;
    card.classList.remove("is-returning");
    card.classList.add("is-dragging");
    try { card.setPointerCapture(pointerId); } catch (error) {}
  });

  card.addEventListener("pointermove", function(event) {
    if (!dragging || event.pointerId !== pointerId) return;
    deltaX = event.clientX - startX;
    deltaY = event.clientY - startY;
    if (!horizontalIntent && !verticalSaveIntent) {
      if (deltaY > 14 && deltaY > Math.abs(deltaX) * 1.08) verticalSaveIntent = true;
      else if (Math.abs(deltaY) > 14 && Math.abs(deltaY) > Math.abs(deltaX) * 1.08) {
        dragging = false;
        clearPreview(false);
        return;
      }
      else if (Math.abs(deltaX) > 8 && Math.abs(deltaX) > Math.abs(deltaY) * 1.12) horizontalIntent = true;
      else return;
    }
    if (event.cancelable) event.preventDefault();
    const width = Math.max(1, card.getBoundingClientRect().width);
    const progress = Math.min(1, Math.abs(deltaX) / (width * .42));
    const rotation = Math.max(-15, Math.min(15, deltaX / width * 19));
    const lift = Math.min(9, Math.abs(deltaX) / width * 10);
    card.style.transform = "translate3d(" + deltaX.toFixed(1) + "px," + (-lift).toFixed(1) + "px,0) rotate(" + rotation.toFixed(2) + "deg)";
    card.style.setProperty("--swipe-tint-opacity", (progress * .58).toFixed(3));
    card.classList.toggle("swipe-preview-like", horizontalIntent && deltaX > 0);
    card.classList.toggle("swipe-preview-nope", horizontalIntent && deltaX < 0);
    card.classList.toggle("swipe-preview-save", verticalSaveIntent);
    if (verticalSaveIntent) {
      const saveProgress = Math.min(1, Math.max(0, deltaY) / Math.max(1, card.getBoundingClientRect().height * .35));
      card.style.setProperty("--swipe-tint-opacity", (saveProgress * .72).toFixed(3));
      card.style.borderColor = "rgba(255,203,37," + (saveProgress * .9).toFixed(2) + ")";
      card.style.transform = "translate3d(0," + Math.min(70,deltaY * .35).toFixed(1) + "px,0)";
    } else {
      card.style.borderColor = deltaX > 0 ? "rgba(255,55,75," + (progress * .92).toFixed(2) + ")" : "rgba(255,255,255," + (progress * .8).toFixed(2) + ")";
    }
  });

  function finishSwipe(event) {
    if (!dragging || event.pointerId !== pointerId) return;
    dragging = false;
    const width = Math.max(1, card.getBoundingClientRect().width);
    const elapsed = Math.max(1, performance.now() - startTime);
    const velocity = deltaX / elapsed;
    const threshold = Math.max(78, Math.min(132, width * .22));
    const accepted = horizontalIntent && (Math.abs(deltaX) >= threshold || (Math.abs(deltaX) > 46 && Math.abs(velocity) > .58));
    const saveThreshold = Math.max(82, Math.min(150, card.getBoundingClientRect().height * .18));
    const acceptedSave = verticalSaveIntent && deltaY >= saveThreshold;
    const productId = card.dataset.productId;
    pointerId = null;
    if (accepted || acceptedSave) {
      card.classList.remove("is-dragging", "swipe-preview-like", "swipe-preview-nope", "swipe-preview-save");
      card.style.removeProperty("--swipe-tint-opacity");
      card.style.removeProperty("border-color");
      animateDeckDecision(productId, acceptedSave ? "save" : (deltaX > 0 ? "yes" : "no"));
      return;
    }
    const wasTap = Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10 && !horizontalIntent && !verticalSaveIntent;
    clearPreview(true);
    if (wasTap) openProductDetails(productId);
  }

  card.addEventListener("pointerup", finishSwipe);
  card.addEventListener("pointercancel", function(event) {
    if (!dragging || (pointerId !== null && event.pointerId !== pointerId)) return;
    pointerId = null;
    clearPreview(true);
  });
  card.addEventListener("lostpointercapture", function() {
    if (dragging) { pointerId = null; clearPreview(true); }
  });
}
document.addEventListener("click", handleClick);
document.addEventListener("change", handleChange);
document.addEventListener("input", handleInput);
document.addEventListener("submit", handleSubmit);
window.setInterval(async function() {
  if (!state || (currentView !== "discover" && currentView !== "training") || catalogPagePending ||
      !catalogManifest || catalogLoadedPages.size < catalogManifest.pages.length) return;
  const previousGeneratedAt = catalogManifest.generatedAt;
  await refreshCatalogManifest(true);
  if (catalogManifest && catalogManifest.generatedAt !== previousGeneratedAt) loadNextCatalogPage();
}, 90000);
window.addEventListener("scroll", function() {
  if (currentView === "discover" && state && state.settings.discoveryView === "grid" &&
      window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 900) {
    loadNextCatalogPage();
  }
}, { passive:true });
document.addEventListener("keydown", function(event) {
  if (modalRoot.innerHTML) {
    if (event.key === "Escape") closeModal();
    return;
  }
  if (["INPUT","TEXTAREA","SELECT"].includes(document.activeElement.tagName)) return;
  if (currentView === "discover" || currentView === "training") {
    const card = document.querySelector("#active-product-card");
    if (!card) return;
    if (event.key === "ArrowRight") animateDeckDecision(card.dataset.productId, "yes");
    else if (event.key === "ArrowLeft") animateDeckDecision(card.dataset.productId, "no");
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
    await refreshCatalogManifest(true);
    if (catalogManifest && Array.isArray(catalogManifest.pages) && catalogManifest.pages.length) {
      const first = catalogManifest.pages.findIndex(page => !catalogLoadedPages.has(page.file));
      if (first >= 0) {
        const response = await fetch("./data/" + catalogManifest.pages[first].file.replace(/^data\//, ""), { cache:"no-store" });
        if (response.ok) {
          const payload = await response.json();
          catalog = (payload.products || []).map(normalizeProduct);
          catalogLoadedPages.add(catalogManifest.pages[first].file);
          catalogLoaded = true;
        }
      }
    }
    if (!catalogLoaded) {
      const response = await fetch("./data/catalog.json", { cache:"no-store" });
      if (response.ok) {
        const payload = await response.json();
        catalog = (payload.products || []).map(normalizeProduct);
        catalogLoaded = true;
      }
    }
  } catch (error) { console.warn("Catalogue distant non chargé.", error); }
  try {
    const directoryResponse = await fetch("./data/merchant-directory.json", { cache:"no-store" });
    if (directoryResponse.ok) {
      const directoryPayload = await directoryResponse.json();
      catalogDirectory = Array.isArray(directoryPayload.entries) ? directoryPayload.entries : [];
    }
  } catch (error) { console.warn("Répertoire des enseignes non chargé.", error); }
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
  state.settings.discoveryView = "cards";
  state.settings.outfitFilters = Object.assign(base.settings.outfitFilters || {},state.settings.outfitFilters || {});
  state.settings.outfitFilters.styles = Array.isArray(state.settings.outfitFilters.styles) ? state.settings.outfitFilters.styles : (state.profile.preferredStyles || []);
  state.settings.outfitFilters.season = state.settings.outfitFilters.season || "Toute saison";
  state.savedOutfits = Array.isArray(state.savedOutfits) ? state.savedOutfits : [];
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
    const cachedFeed = localProducts.filter(function(product) {
      const isFeedProduct = product.sourceType === "public-web" || product.sourceType === "awin" || product.feedId || product.advertiserId;
      const expiry = Date.parse(product.expiresAt || "");
      return isFeedProduct && !currentIds.has(product.id) && product.catalogStatus !== "stale" &&
        (!Number.isFinite(expiry) || expiry > Date.now());
    });
    const savedWithdrawn = localProducts.filter(function(product) {
      const isFeedProduct = product.sourceType === "public-web" || product.sourceType === "awin" || product.feedId || product.advertiserId;
      return isFeedProduct && !currentIds.has(product.id) && savedIds.has(product.id) &&
        !cachedFeed.some(cached => cached.id === product.id);
    }).map(function(product) {
      return Object.assign({}, product, {
        catalogStatus: "stale",
        availabilityStatus: "out_of_stock",
        availability: "Fiche absente du dernier flux marchand · à revérifier"
      });
    });
    const merged = new Map();
    catalog.forEach(function(product) { merged.set(productIdentity(product), product); });
    cachedFeed.forEach(function(product) { if (!merged.has(productIdentity(product))) merged.set(productIdentity(product), product); });
    localManual.forEach(function(product) { if (!merged.has(productIdentity(product))) merged.set(productIdentity(product), product); });
    savedWithdrawn.forEach(function(product) { if (!merged.has(productIdentity(product))) merged.set(productIdentity(product), product); });
    state.products = Array.from(merged.values());
  }
  state.inspirations = Array.isArray(state.inspirations) ? state.inspirations.filter(function(item) { return item.source === "Pinterest"; }) : [];
  state.seenPinterestPins = Array.isArray(state.seenPinterestPins) ? state.seenPinterestPins : [];
  state.pinterestPins = (pinterestFeed.pins || []).slice();
  state.learnedPreferences = deriveLearnedPreferences(state);
  aiAgentLastActionCount = aiAgentActionCount();
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
