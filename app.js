import { loadState, saveState, clearState } from "./modules/store.js";
import { createInitialState, normalizeProduct, productIdentity, seasonFor, rankProducts, deriveLearnedPreferences, matchesFilters } from "./modules/engine.js";
import { INTEGRATIONS, getPersistenceNotice } from "./modules/integrations.js";

const main = document.querySelector("#app-main");
const modalRoot = document.querySelector("#modal-root");
const toastRoot = document.querySelector("#toast-root");
const saveStatus = document.querySelector("#save-status");
let state = null;
let currentView = "discover";
let currentModalProduct = null;
let toastTimer = null;
let isSaving = false;

const OBJECTIVES = ["Vêtements", "Chaussures", "Sous-vêtements", "Accessoires"];
const STYLES = ["Classique", "Créatif", "Classe", "Sport", "Été"];
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
async function persist() {
  if (isSaving) return;
  isSaving = true;
  updateSaveStatus("Sauvegarde…", "saving");
  try {
    const result = await saveState(state);
    if (result.ok) {
      state.updatedAt = result.updatedAt;
      updateSaveStatus(result.warning ? "Sauvegarde locale de secours" : "Données enregistrées sur cet appareil", "ok");
    } else {
      updateSaveStatus("Échec de la sauvegarde locale", "error");
      showToast("La sauvegarde locale a échoué. Exporte tes données avant de quitter.", false);
    }
  } catch (error) {
    updateSaveStatus("Échec de la sauvegarde", "error");
    showToast("Erreur de sauvegarde : " + error.message, false);
  } finally { isSaving = false; }
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
function renderDeckCard(product, training) {
  const sourceName = product.merchant || product.source || "Marchand non renseigné";
  const price = formatPrice(product.price);
  return '<div class="deck-card-wrap"><article class="product-card" id="active-product-card" data-product-id="' + esc(product.id) + '">' +
    '<div class="product-visual">' + imageMarkup(product.imageUrl, product.name) +
      '<div class="photo-gradient"></div><span class="photo-label">' + (training ? "Mode entraînement" : "Sélection personnalisée") + '</span>' +
      '<span class="photo-price">' + esc(price) + '</span></div>' +
    '<div class="product-info"><div class="product-copy"><span class="product-brand">' + esc(product.brand || "Marque non renseignée") + '</span>' +
      '<h2 class="product-title">' + esc(product.name) + '</h2><div class="product-meta"><span>' + esc(product.objective || product.category) + '</span><i class="meta-dot"></i><span>' + esc(sourceName) + '</span></div></div>' +
      '<button class="button-quiet button-small" type="button" data-action="details" data-id="' + esc(product.id) + '">Détails ↗</button></div>' +
    '</article><div class="deck-actions"><button class="vote-button undo" type="button" data-action="undo" aria-label="Annuler la dernière action" title="Annuler la dernière action" ' + (state.interactions.lastAction ? "" : "disabled") + '>↶</button>' +
    '<button class="vote-button dislike" type="button" data-action="vote" data-vote="dislike" data-id="' + esc(product.id) + '" aria-label="Je n’aime pas">×</button>' +
    '<button class="vote-button like" type="button" data-action="vote" data-vote="like" data-id="' + esc(product.id) + '" aria-label="J’aime">♡</button></div>' +
    '<p class="deck-hint">Glisse à gauche pour passer · à droite pour ajouter à ta garde-robe</p></div>';
}
function renderGridCards(products, options) {
  const opts = options || {};
  if (!products.length) return renderEmptyProducts(false);
  return '<div class="product-grid">' + products.map(function(product) {
    const liked = isLiked(product.id);
    return '<article class="grid-card"><div class="grid-image" role="button" tabindex="0" data-action="details" data-id="' + esc(product.id) + '">' +
      imageMarkup(product.imageUrl, product.name) + '</div><div class="grid-content"><span class="product-brand">' + esc(product.brand || "Marque non renseignée") + '</span>' +
      '<h3 class="product-title">' + esc(product.name) + '</h3><div class="product-meta"><span>' + esc(product.merchant || product.source) + '</span><i class="meta-dot"></i><span>' + esc(product.objective) + '</span></div>' +
      '<div class="grid-bottom"><span class="grid-price">' + esc(formatPrice(product.price)) + '</span><div class="grid-actions">' +
      '<button class="mini-icon-button" type="button" data-action="details" data-id="' + esc(product.id) + '" aria-label="Voir les détails">↗</button>' +
      (opts.wardrobe ? '<button class="mini-icon-button" type="button" data-action="remove-favorite" data-id="' + esc(product.id) + '" aria-label="Retirer des favoris">−</button>' :
        '<button class="mini-icon-button ' + (liked ? "is-liked" : "") + '" type="button" data-action="' + (liked ? "remove-favorite" : "vote") + '" data-vote="like" data-id="' + esc(product.id) + '" aria-label="' + (liked ? "Retirer des favoris" : "Ajouter aux favoris") + '">' + (liked ? "♥" : "♡") + '</button>') +
      '</div></div></div></article>';
  }).join("") + '</div>';
}
function renderDiscover(training) {
  const heading = training
    ? renderPageHeading("Élargis ton univers", "Entraînement", "Explore volontairement de nouvelles coupes, matières et associations. Tes likes enrichissent ton profil comme dans Découvrir, sans ajout automatique à la garde-robe.", '<button class="button-secondary" type="button" data-view="discover">Retour à Découvrir</button>')
    : renderPageHeading("Ton œil, tes règles", "Découvrir", "Des pièces sélectionnées selon tes préférences. Like, passe, compare et laisse ton style se préciser au fil des découvertes.", '<button class="button-secondary" type="button" data-action="toggle-discovery-view">' + (state.settings.discoveryView === "grid" ? "Vue cartes" : "Explorer la grille") + '</button>');
  const products = rankProducts(state.products, state, { training: training });
  const liked = state.likedProducts.length;
  const rejected = state.interactions.dislikes.length;
  const body = state.settings.discoveryView === "grid" && !training
    ? renderGridCards(products)
    : (products.length ? renderDeckCard(products[0], training) : renderEmptyProducts(training));
  return heading + renderFilterBar(training) + '<div class="discovery-layout"><section class="deck-column">' +
    '<div class="deck-topline"><span><strong>' + (training ? "Exploration active" : "Ta sélection") + '</strong> <span>· ' + products.length + ' article(s) à découvrir</span></span>' +
    '<span>' + (training ? "Nouveauté prioritaire" : "Personnalisation active") + '</span></div>' + body +
    '</section><aside class="deck-aside"><section class="panel aside-card"><h2 class="aside-title">Ton évolution <span>en direct</span></h2>' +
    '<p>Chaque décision affine ton profil. Une consultation reste un signal léger ; un like ou un dislike compte davantage.</p>' +
    '<div class="aside-stat"><div class="stat-box"><strong>' + liked + '</strong><small>Coups de cœur</small></div><div class="stat-box"><strong>' + rejected + '</strong><small>Articles passés</small></div></div></section>' +
    '<section class="panel aside-card"><h2 class="aside-title">Équilibre du moment <span>' + esc(training ? state.settings.trainingDiscoveryLevel : state.settings.discoveryLevel) + '% découverte</span></h2>' +
    '<p>' + (training ? "Le mode Entraînement donne plus de poids à la nouveauté pour élargir ton terrain de jeu." : "Le curseur mélange tes goûts déjà identifiés et des propositions plus inattendues. Ajuste-le à tout moment.") + '</p></section>' +
    '<div class="source-note">Le catalogue initial est volontairement vide. Les articles ajoutés sont conservés avec leurs liens marchands ; les informations absentes restent signalées.</div>' +
    '</aside></div>';
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
    '<div id="wardrobe-grid">' + (favorites.length ? cards : '<div class="empty-state"><div class="empty-mark">♡</div><h2>Ta garde-robe est encore vide</h2><p>Les articles que tu likes dans Découvrir apparaîtront ici. Tu peux aussi ajouter un produit manuellement.</p><div class="empty-actions"><button class="button-primary" type="button" data-view="discover">Commencer à découvrir</button><button class="button-secondary" type="button" data-action="add-product">Ajouter un article</button></div></div>') + '</div>';
}
function renderInspirations() {
  const heading = renderPageHeading("Ton univers visuel", "Inspirations", "Enregistre les références qui t’inspirent, qu’il s’agisse d’une tenue, d’une silhouette, d’une couleur ou d’une ambiance.", '<button class="button-primary" type="button" data-action="add-inspiration">＋ Ajouter une inspiration</button>');
  const items = state.inspirations || [];
  const grid = items.length ? '<div class="inspiration-grid">' + items.map(function(item) {
    return '<article class="inspiration-card"><div class="inspiration-image">' + imageMarkup(item.imageUrl, item.title) + '</div><div class="inspiration-copy"><strong>' + esc(item.title || "Inspiration sans titre") + '</strong><small>' + esc(item.source || "Import personnel") + '</small>' +
      '<div class="inspiration-tags">' + (item.tags || []).map(function(tag) { return '<span>' + esc(tag) + '</span>'; }).join("") + '</div>' +
      '<div class="grid-bottom"><a class="button-quiet button-small" href="' + esc(safeExternalUrl(item.sourceUrl) || "#") + '" target="_blank" rel="noopener noreferrer">Ouvrir la source ↗</a><button class="mini-icon-button" type="button" data-action="remove-inspiration" data-id="' + esc(item.id) + '" aria-label="Supprimer cette inspiration">×</button></div></div></article>';
  }).join("") + '</div>' : '<div class="empty-state"><div class="empty-mark">⌁</div><h2>Garde une trace de ce qui t’inspire</h2><p>Ajoute un lien Pinterest, une image ou une capture. Les tags renseignés peuvent ensuite enrichir tes recommandations.</p><div class="empty-actions"><button class="button-primary" type="button" data-action="add-inspiration">Ajouter une inspiration</button></div></div>';
  return heading + '<div class="source-note" style="margin-bottom:18px">Import manuel actif. Une image Pinterest est conservée comme inspiration, pas comme un produit disponible à l’achat.</div>' + grid;
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
  const integrationMarkup = INTEGRATIONS.map(function(item) {
    const pending = item.id === "pinterest" || item.id === "instagram";
    return '<article class="connector-item"><div><strong>' + esc(item.name) + '</strong><small>' + esc(item.status) + '</small></div><p>' + esc(item.detail) + '</p><span class="status-pill ' + (pending ? "pending" : "") + '">' + (pending ? "À configurer" : "Manuel") + '</span></article>';
  }).join("");
  const updated = state.updatedAt ? new Date(state.updatedAt).toLocaleString("fr-FR") : "Pas encore enregistrée";
  return renderPageHeading("Contrôle & confidentialité", "Paramètres", "Gère tes données, tes imports et les connexions qui pourront être activées lorsque les accès sécurisés seront disponibles.", "") +
    '<section class="panel section-panel"><h2 class="section-title">Sauvegarde des données</h2><div class="source-note">' + esc(getPersistenceNotice()) + '</div>' +
    '<div class="form-grid" style="margin-top:16px"><div class="preference-block"><h3>État local</h3><p class="field-hint">Dernière modification : ' + esc(updated) + '</p><p class="field-hint">Produits : ' + state.products.length + ' · Favoris : ' + state.likedProducts.length + ' · Inspirations : ' + state.inspirations.length + '</p></div>' +
    '<div class="preference-block"><h3>Copie de sécurité</h3><p class="field-hint">Exporte régulièrement ton fichier JSON. Il contient les produits importés, tes préférences et ton historique.</p><div class="form-actions"><button class="button-primary button-small" type="button" data-action="export">Exporter mes données</button><button class="button-secondary button-small" type="button" data-action="import-backup">Importer une sauvegarde</button></div></div></div>' +
    '<input id="backup-file" type="file" accept=".json,application/json" hidden></section>' +
    '<section class="panel section-panel"><h2 class="section-title">Sources & intégrations</h2><div class="connector-list">' + integrationMarkup + '</div></section>' +
    '<section class="panel section-panel"><h2 class="section-title">Catalogue marchand</h2><p class="field-hint">Tu peux importer un fichier JSON contenant une liste de produits normalisables. Chaque fiche doit comporter un nom et, pour être considérée comme achetable, un lien marchand vérifiable.</p>' +
    '<div class="form-actions"><button class="button-secondary" type="button" data-action="import-catalog">Importer un catalogue JSON</button></div><input id="catalog-file" type="file" accept=".json,application/json" hidden></section>' +
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
  else if (currentView === "profile") main.innerHTML = renderProfile();
  else if (currentView === "settings") main.innerHTML = renderSettings();
  else main.innerHTML = renderDiscover(false);
  attachSwipe();
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
  const event = { productId: productId, createdAt: new Date().toISOString(), view: currentView };
  if (value === "like") {
    state.interactions.likes.push(event);
    state.likedProducts.push({ productId: productId, addedAt: event.createdAt });
    showToast("Article ajouté à ta garde-robe", true);
  } else {
    state.interactions.dislikes.push(event);
    showToast("Article retiré de ta sélection", true);
  }
  state.interactions.lastAction = { productId: productId, action: value, createdAt: event.createdAt };
  state.learnedPreferences = deriveLearnedPreferences(state);
  persist();
  render();
}
function undoLast() {
  const action = state.interactions.lastAction;
  if (!action) return;
  if (action.action === "like") {
    state.interactions.likes = state.interactions.likes.filter(function(item) { return item.productId !== action.productId || item.createdAt !== action.createdAt; });
    state.likedProducts = state.likedProducts.filter(function(item) { return item.productId !== action.productId || item.addedAt !== action.createdAt; });
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
  modalRoot.innerHTML = '<div class="modal-backdrop" data-action="close-modal"><section class="modal modal-wide" role="dialog" aria-modal="true" aria-labelledby="product-modal-title" data-modal-content>' +
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
  modalRoot.innerHTML = '<div class="modal-backdrop" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="add-product-title" data-modal-content>' +
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
  modalRoot.innerHTML = '<div class="modal-backdrop" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="add-inspiration-title" data-modal-content>' +
    '<div class="modal-head"><div><span class="eyebrow">Moodboard personnel</span><h2 id="add-inspiration-title">Ajouter une inspiration</h2><p>Un pin ou une photo peut nourrir ton univers esthétique sans être traité comme un produit à acheter.</p></div><button class="close-button" type="button" data-action="close-modal" aria-label="Fermer">×</button></div>' +
    '<form id="inspiration-form"><div class="form-grid"><div class="field"><label for="inspiration-title">Titre</label><input id="inspiration-title" name="title" placeholder="Une silhouette, une ambiance…"></div>' +
    '<div class="field"><label for="inspiration-source">Source</label><select id="inspiration-source" name="source"><option>Pinterest</option><option>Instagram</option><option>Photo personnelle</option><option>Autre</option></select></div>' +
    '<div class="field" style="grid-column:1/-1"><label for="inspiration-url">Lien de la source</label><input id="inspiration-url" name="sourceUrl" type="url" placeholder="https://…"></div>' +
    '<div class="field"><label for="inspiration-image-url">URL de l’image</label><input id="inspiration-image-url" name="imageUrl" type="url" placeholder="https://…"></div>' +
    '<div class="field"><label for="inspiration-file">Ou importer une image</label><input id="inspiration-file" name="imageFile" type="file" accept="image/*"><span class="field-hint">L’image reste sur cet appareil.</span></div>' +
    '<div class="field" style="grid-column:1/-1"><label for="inspiration-tags">Tags esthétiques</label><input id="inspiration-tags" name="tags" placeholder="Oversized, tons neutres, tailoring…"></div></div>' +
    '<div class="form-actions"><button class="button-primary" type="submit">Enregistrer l’inspiration</button><button class="button-quiet" type="button" data-action="close-modal">Annuler</button></div></form></section></div>';
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
  const imageFile = data.get("imageFile");
  const uploadedImage = imageFile && imageFile.size ? await fileToDataUrl(imageFile) : "";
  const item = {
    id: "inspo-" + Date.now().toString(36),
    title: String(data.get("title") || "Inspiration").trim(),
    source: String(data.get("source") || "Import personnel"),
    sourceUrl: safeExternalUrl(data.get("sourceUrl")),
    imageUrl: uploadedImage || safeExternalUrl(data.get("imageUrl")),
    tags: normalizeWords(data.get("tags")),
    importedAt: new Date().toISOString()
  };
  if (!item.sourceUrl && !item.imageUrl) throw new Error("Ajoute au moins un lien ou une image.");
  state.inspirations.unshift(item);
  persist();
  closeModal();
  render();
  showToast("Inspiration enregistrée", false);
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
  state.products = imported.products.map(normalizeProduct);
  state.learnedPreferences = deriveLearnedPreferences(state);
  await persist();
  currentView = "discover";
  render();
  showToast("Sauvegarde restaurée", false);
}
function resetProfile() {
  if (!window.confirm("Réinitialiser les préférences apprises et le profil ? Les favoris et le catalogue seront conservés.")) return;
  const base = createInitialState(state.products);
  state.profile = base.profile;
  state.interactions = { likes: [], dislikes: [], views: [], undoEvents: [], lastAction: null };
  state.learnedPreferences = {};
  persist();
  render();
  showToast("Profil algorithmique réinitialisé", false);
}
async function deleteAllData() {
  if (!window.confirm("Supprimer définitivement toutes les données DRESSOPP enregistrées sur cet appareil ? Exporte une sauvegarde avant de continuer.")) return;
  await clearState();
  state = createInitialState([]);
  currentView = "discover";
  render();
  updateSaveStatus("Données locales supprimées", "ok");
  showToast("Les données locales ont été supprimées", false);
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
  if (action === "add-product") openProductForm();
  else if (action === "add-inspiration") openInspirationForm();
  else if (action === "close-modal") closeModal(); else if (action === "details") openProductDetails(actionButton.dataset.id);
  else if (action === "vote") vote(actionButton.dataset.id, actionButton.dataset.vote || "like");
  else if (action === "undo") undoLast();
  else if (action === "remove-favorite") removeFavorite(actionButton.dataset.id);
  else if (action === "toggle-discovery-view") toggleDiscoveryView();
  else if (action === "save-filters") saveFilters();
  else if (action === "export") exportData();
  else if (action === "import-backup") document.querySelector("#backup-file").click();
  else if (action === "import-catalog") document.querySelector("#catalog-file")?.click();
  else if (action === "reset-profile") resetProfile();
  else if (action === "delete-data") deleteAllData();
  else if (action === "remove-inspiration") {
    state.inspirations = state.inspirations.filter(function(item) { return item.id !== actionButton.dataset.id; });
    persist(); render(); showToast("Inspiration supprimée", false);
  }
}
function handleChange(event) {
  const target = event.target;
  if (target.matches("[data-filter]")) {
    const key = target.dataset.filter;
    if (key === "preset") {
      const preset = state.settings.savedFilters[Number(target.value)];
      if (preset) {
        ["objective","style","season","maxPrice"].forEach(function(field) { state.settings[field] = preset[field]; });
      }
    } else if (key === "maxPrice") {
      state.settings.maxPrice = target.value.trim() === "" ? null : Math.max(0, Number(target.value));
    } else state.settings[key] = key.toLowerCase().includes("level") ? Number(target.value) : target.value;
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
  if (target.matches("[data-search='wardrobe']")) {
    const query = target.value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    document.querySelectorAll("#wardrobe-grid .grid-card").forEach(function(card) {
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
    if (event.target.closest("button")) return;
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
    if (Math.abs(deltaX) > 95) vote(card.dataset.productId, deltaX > 0 ? "like" : "dislike");
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
    if (event.key === "ArrowRight") vote(card.dataset.productId, "like");
    else if (event.key === "ArrowLeft") vote(card.dataset.productId, "dislike");
    else if (event.key.toLowerCase() === "z" && (event.metaKey || event.ctrlKey)) undoLast();
  }
});
async function boot() {
  let catalog = [];
  try {
    const response = await fetch("./data/catalog.json", { cache: "no-store" });
    if (response.ok) {
      const payload = await response.json();
      catalog = (payload.products || []).map(normalizeProduct);
    }
  } catch (error) { console.warn("Catalogue distant non chargé.", error); }
  const stored = await loadState();
  const base = createInitialState(catalog);
  state = stored ? Object.assign(base, stored) : base;
  state.profile = Object.assign(base.profile, state.profile || {});
  state.profile.sizes = Object.assign(base.profile.sizes, state.profile.sizes || {});
  state.settings = Object.assign(base.settings, state.settings || {});
  state.interactions = Object.assign(base.interactions, state.interactions || {});
  state.interactions.likes = Array.isArray(state.interactions.likes) ? state.interactions.likes : [];
  state.interactions.dislikes = Array.isArray(state.interactions.dislikes) ? state.interactions.dislikes : [];
  state.interactions.views = Array.isArray(state.interactions.views) ? state.interactions.views : [];
  state.interactions.undoEvents = Array.isArray(state.interactions.undoEvents) ? state.interactions.undoEvents : [];
  state.likedProducts = Array.isArray(state.likedProducts) ? state.likedProducts : [];
  state.products = Array.isArray(state.products) ? state.products.map(normalizeProduct) : catalog;
  if (!state.products.length && catalog.length) state.products = catalog;
  state.inspirations = Array.isArray(state.inspirations) ? state.inspirations : [];
  state.learnedPreferences = deriveLearnedPreferences(state);
  render();
  updateSaveStatus("Stockage local prêt", "ok");
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./sw.js").catch(function(error) { console.warn("Service worker non activé.", error); });
  }
}
boot().catch(function(error) {
  console.error("Initialisation DRESSOPP impossible :", error);
  main.innerHTML = '<div class="empty-state"><h2>Impossible de charger DRESSOPP</h2><p>' + esc(error.message) + '</p><button class="button-primary" type="button" onclick="location.reload()">Réessayer</button></div>';
});
