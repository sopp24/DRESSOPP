import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const agent = readFileSync(new URL("../modules/agent.js", import.meta.url), "utf8");
const outfits = readFileSync(new URL("../modules/outfits.js", import.meta.url), "utf8");
const visionWorker = readFileSync(new URL("../workers/dressopp-agent/src/index.js", import.meta.url), "utf8");
const pinterestSync = readFileSync(new URL("../scripts/sync-pinterest.mjs", import.meta.url), "utf8");
const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const board = readFileSync(new URL("../board.html", import.meta.url), "utf8");
const workflow = readFileSync(new URL("../.github/workflows/deploy-pages.yml", import.meta.url), "utf8");
const boardPdfScript = readFileSync(new URL("../scripts/generate-board-pdf.mjs", import.meta.url), "utf8");
const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const sw = readFileSync(new URL("../sw.js", import.meta.url), "utf8");
const visualQA = readFileSync(new URL("../scripts/visual-qa.mjs", import.meta.url), "utf8");
const root = new URL("../", import.meta.url);

test("the discovery deck exposes the five Tinder-style actions", function() {
  for (const action of ["undo", "vote", "save-list", "share-product"]) {
    assert.ok(app.includes('data-action="' + action + '"') || app.includes('data-action="' + action + '"'), "Missing " + action);
  }
  assert.ok(app.includes('data-vote="no"'));
  assert.ok(app.includes('data-vote="yes"'));
  assert.ok(app.includes("deck-action-share"));
  assert.ok(app.includes("aria-label=\"Ajouter à ma liste\"") || app.includes("Ajouter à ma liste"));
});

test("the product card includes the product details and original merchant link", function() {
  assert.ok(app.includes("product-brand-price"));
  assert.ok(app.includes("renderProductAttributes(product)"));
  assert.ok(!app.includes('class="product-details-pill" type="button" data-action="details"'));
  assert.ok(app.includes("product-attributes"));
  assert.ok(app.includes("product-original-link"));
  assert.ok(app.includes("Voir l’article original"));
  assert.ok(app.includes("navigator.share"));
  assert.ok(app.includes("navigator.clipboard"));
  assert.ok(app.includes('./assets/rewind.webp'));
  assert.ok(app.includes('./assets/cross.webp'));
  assert.ok(app.includes('./assets/star.webp'));
  assert.ok(app.includes('./assets/fav.webp'));
  assert.ok(app.includes('./assets/share.webp'));
  assert.ok(css.includes(".deck-action-icon"));
});

test("the restored Tinder card styling keeps responsive tablet and mobile layouts", function() {
  assert.ok(css.includes(".discovery-layout--swipe"));
  assert.ok(css.includes("@media (max-width: 850px)"));
  assert.ok(css.includes("@media (max-width: 600px)"));
  assert.ok(css.includes(".deck-action-yes"));
  assert.ok(css.includes(".product-visual"));
  assert.ok(css.includes("object-fit: cover"));
});


test("the Tenues view is Pinterest-only and exposes outfit favorites and a product carousel", function() {
  assert.ok(app.includes('pin.origin === "Pinterest"'));
  assert.ok(app.includes("data-outfit-style"));
  assert.ok(app.includes("outfitFilters"));
  assert.ok(app.includes("save-full-outfit"));
  assert.ok(app.includes("save-outfit-piece"));
  assert.ok(app.includes("open-saved-outfit"));
  assert.ok(app.includes("outfit-product-carousel"));
  assert.ok(app.includes("outfit-count"));
  assert.ok(css.includes(".outfit-proposal-grid"));
  assert.ok(css.includes(".outfit-product-carousel"));
  assert.ok(css.includes("@media (max-width: 600px)"));
});


test("saved outfit dependencies and total-price handling are imported by the application", function() {
  assert.ok(app.includes("productSlot, outfitTotalPrice"));
  assert.ok(app.includes("outfitTotalPrice(items)"));
});

test("all local files referenced by the application shell exist", function() {
  for (const match of index.matchAll(/(?:src|href)="\.\/([^"]+)"/g)) {
    assert.ok(existsSync(new URL(match[1],root)),"Missing local file: " + match[1]);
  }
  assert.ok(index.includes("https://sopp24.github.io/SOPP-agents/assets/brand-mark.webp"));
});

test("the PWA refreshes its cache and preloads the app icons and first catalogue page", function() {
  assert.ok(sw.includes('dressopp-static-v21'));
  for (const path of [
    "./assets/logo-horizontal.png",
    "./assets/logo-square.png",
    "./assets/rewind.webp",
    "./assets/cross.webp",
    "./assets/star.webp",
    "./assets/fav.webp",
    "./assets/share.webp",
    "./data/catalog-pages/page-0001.json"
  ]) {
    assert.ok(sw.includes('"' + path + '"'),"Missing offline cache entry: " + path);
    assert.ok(existsSync(new URL(path,root)),"Cached file does not exist: " + path);
  }
});

test("mobile navigation and outfit details retain compact responsive breakpoints", function() {
  assert.ok(css.includes("left: 50%;"));
  assert.ok(css.includes("transform: translateX(-50%)"));
  assert.ok(css.includes("@media (max-width: 850px)"));
  assert.ok(css.includes("@media (max-width: 600px)"));
  assert.ok(css.includes("@media (max-width: 390px)"));
  assert.ok(css.includes(".outfit-carousel-card"));
});


test("Pour toi is swipe-first and moves all secondary discovery panels to Settings", function() {
  const discover=app.slice(app.indexOf("function renderDiscover(training)"),app.indexOf("function renderWardrobe()"));
  const settings=app.slice(app.indexOf("function renderDiscoveryInsights()"),app.indexOf("function renderSettings()"));
  assert.ok(discover.includes("renderDeckCard(products[0],training)"));
  assert.ok(discover.includes("renderFilterBar(false)"));
  const primaryBranch=discover.slice(0,discover.indexOf("const trainingExtras = training"));
  assert.ok(primaryBranch.includes("const appToolbar = !training"));
  assert.ok(!primaryBranch.includes("renderAiAgentPanel()"));
  assert.ok(!primaryBranch.includes("renderCatalogStatus()"));
  assert.ok(!primaryBranch.includes("renderRetailerDirectory()"));
  assert.ok(discover.includes("const trainingExtras = training"));
  assert.ok(settings.includes("renderAiAgentPanel()"));
  assert.ok(settings.includes("renderCatalogStatus()"));
  assert.ok(settings.includes("renderRetailerDirectory()"));
  assert.ok(app.includes('currentView === "discover"'));
  assert.ok(css.includes("height: 100dvh"));
  assert.ok(css.includes(".discovery-page--app .deck-card-wrap"));
});

test("Pinterest is the sole inspiration source and the old local lookbook is absent", function() {
  assert.ok(!app.toLowerCase().includes("lookbook"));
  assert.ok(!sw.toLowerCase().includes("lookbook"));
  assert.ok(app.includes('fromFeed: true, origin: "Pinterest"'));
  assert.ok(app.includes('source === "Pinterest"'));
  assert.ok(app.includes("function renderInspirations()"));
  assert.ok(index.includes("https://sopp24.github.io/SOPP-agents/assets/brand-mark.webp"));
});


test("swiping down on the discovery card saves it reliably on touch devices", function() {
  assert.ok(app.includes("verticalSaveIntent"));
  assert.ok(app.includes("const acceptedSave=!horizontalIntent && deltaY>=saveThreshold"));
  assert.ok(app.includes('animateDeckDecision(productId,acceptedSave?"save"'));
  assert.ok(app.includes('surface.addEventListener("touchstart"'));
  assert.ok(app.includes('document.addEventListener("touchmove"'));
  assert.ok(app.includes('document.addEventListener("touchend"'));
  assert.ok(app.includes("deltaY=y-startY"));
  assert.ok(css.includes("#active-product-card"));
  assert.ok(css.includes("touch-action: none;"));
  assert.ok(visualQA.includes("await frame();"));
  assert.ok(visualQA.includes("swipe-save-failure.png"));
});

test("Pinterest pins are inside Training and no standalone Pins navigation remains", function() {
  assert.ok(!index.includes('data-view="inspirations"'));
  assert.ok(app.includes("training-pins-panel"));
  assert.ok(app.includes("renderInspirations()"));
  assert.ok(app.includes("renderCatalogStatus() + renderRetailerDirectory() + renderAiAgentPanel()"));
  assert.ok(css.includes(".training-support .ai-agent-panel"));
});

test("the original-article pill keeps the maquette's circular arrow on every screen size", function() {
  assert.ok(css.includes("Carte swipable — direction artistique de la maquette"));
  assert.ok(css.includes(".discovery-layout--swipe .deck-card-wrap .product-original-link > i"));
  assert.ok(css.includes("font-family: Poppins"));
  for (const weight of [400, 500, 600, 700, 800]) assert.ok(existsSync(new URL("assets/fonts/poppins-latin-" + weight + "-normal.woff2", root)));
});

test("the final mobile UX layer reserves space for the swipe deck and prevents nav/header overlap", function() {
  assert.ok(css.includes("Mobile UX pass — reserve independent zones"));
  assert.ok(css.includes("grid-template-columns: minmax(0,1fr) auto;"));
  assert.ok(css.includes("body.is-discovery-app .main-content"));
  assert.ok(css.includes("calc(78px + env(safe-area-inset-bottom))"));
  assert.ok(css.includes("max-height: min(68dvh,560px)"));
  assert.ok(css.includes("@media (max-width: 350px)"));
  assert.ok(css.includes("orientation: landscape) and (max-height: 520px"));
  assert.ok(css.includes("body.is-discovery-app .top-actions .icon-button { display: none; }"));
});


test("stored products are re-normalized before strict men's-only discovery", function() {
  assert.ok(app.includes("state.products = (Array.isArray(state.products) ? state.products : []).map(normalizeProduct)"));
});


test("swipe cards do not display gesture instructions inside the product card", function() {
  assert.ok(!app.includes("Gauche : passer"));
  assert.ok(!app.includes("Droite : j’aime"));
  assert.ok(app.includes('data-vote="no"'));
  assert.ok(app.includes('data-vote="yes"'));
  assert.ok(app.includes('data-action="save-list"'));
});


test("the restored swipe layout keeps the product card separate from the action row", function() {
  const cardRenderer = app.slice(app.indexOf("function renderDeckCard"),app.indexOf("function renderGridCards"));
  assert.ok(cardRenderer.indexOf("'<div class=\"product-visual\">'") < cardRenderer.indexOf("'<div class=\"product-info\">"));
  assert.ok(cardRenderer.indexOf("'<div class=\"product-info\">") < cardRenderer.indexOf("'</article>'"));
  assert.ok(cardRenderer.indexOf("'</article>'") < cardRenderer.indexOf("'<div class=\"deck-actions\""));
  assert.ok(cardRenderer.endsWith("    '</div>';\n}\n"));
  assert.ok(app.includes("renderProductAttributes(product)"));
  assert.ok(app.includes('const surface = card.closest(".deck-card-wrap") || card;'));
  assert.ok(app.includes("surface.setPointerCapture(event.pointerId)"));
  assert.ok(css.includes(".product-card {"));
  assert.ok(css.includes(".product-visual img"));
  assert.ok(css.includes(".product-info {"));
  assert.ok(css.includes(".deck-actions {"));
  assert.ok(css.includes("min-width: 44px"));
  assert.ok(!css.includes("Maquette DRESSOPP — carte mobile verticale"));
  assert.ok(app.includes("isMenswearPin(pin)"));
  assert.ok(app.includes('name="menswear" required'));
  assert.ok(app.includes('if (data.get("menswear") !== "on") throw new Error("Confirme que la fiche source classe explicitement cet article dans la collection homme.")'));
  assert.ok(app.includes('gender: "men", genderVerified: true'));
});

test("voter ou ajouter à la liste ne déclenche aucune notification de confirmation", function() {
  const voteHandler = app.slice(app.indexOf("function vote(productId, value)"), app.indexOf("function saveToList(productId)"));
  const saveHandler = app.slice(app.indexOf("function saveToList(productId)"), app.indexOf("async function shareProduct(productId)"));
  assert.ok(!voteHandler.includes("showToast("), "Un vote ne doit afficher aucune confirmation.");
  assert.ok(!saveHandler.includes("showToast("), "Un ajout à la liste ne doit afficher aucune confirmation.");
  assert.ok(app.includes("state.interactions.likes.push(event)"));
  assert.ok(app.includes("state.interactions.dislikes.push(event)"));
  assert.ok(app.includes("state.likedProducts.push({ productId: productId, addedAt: createdAt })"));
});

test("la photo active recherche sa source dans le catalogue courant et expose un diagnostic", function() {
  assert.ok(app.includes("let catalogProducts = [];"));
  assert.ok(app.includes("function productImageCandidates(product)"));
  assert.ok(app.includes("matchFound: Boolean(catalogProduct)"));
  assert.ok(app.includes("data-image-debug=\"' + imageDebug + '\""));
  assert.ok(app.includes('imageMarkup(productImageUrl, product.name, {eager:true,fallbackUrls:productImages.slice(1)})'));
  assert.ok(app.includes('data-fallback-srcs="'));
  assert.ok(app.includes("fallbackIndex++"));
  assert.ok(app.includes('fetchpriority="high"'));
  assert.ok(app.includes("attachImageFallbacks(main);"));
  assert.ok(visualQA.includes("imageDebug"));
  assert.ok(visualQA.includes("la photo principale du produit ne s'est pas chargée"));
});

test("la carte de découverte sépare physiquement photo, fiche et commandes", function() {
  assert.ok(css.includes(".discovery-layout--swipe .deck-card-wrap .product-info {"));
  assert.ok(css.includes(".discovery-layout--swipe .deck-card-wrap .product-visual {"));
  assert.ok(css.includes(".discovery-layout--swipe .deck-card-wrap .deck-actions {\n  position: static;"));
  assert.ok(css.includes("object-fit: contain;"));
  assert.ok(css.includes("touch-action: none;"));
});
// Responsive QA guardrails: keep this suite attached to the current PR revision.

test("the product card, action row and touch targets stay in separate layout rows", function() {
  assert.ok(css.includes(".discovery-layout--swipe .deck-card-wrap .deck-actions .deck-action {"));
  assert.ok(css.includes("width: max(44px, calc(var(--u) * 13.2));"));
  assert.ok(css.includes("min-width: 44px;"));
  assert.ok(visualQA.includes("cardSectionsOverlap"));
  assert.ok(visualQA.includes("requestedSrc"));
  assert.ok(visualQA.includes("ensureAppReady(page, targetUrl)"));
  assert.ok(visualQA.includes("page.goto(targetUrl || baseUrl"));
  assert.ok(visualQA.includes("runViewport(browser, viewport, target)"));
});

test("la fiche produit reste distincte de la photo en paysage", function() {
  const landscape = css.slice(css.lastIndexOf("@media (orientation: landscape) and (max-height: 600px) and (max-width: 850px)"));
  assert.ok(landscape.includes("flex-direction: row;"));
  assert.ok(landscape.includes(".discovery-layout--swipe .deck-card-wrap .product-info { flex: 1 1 50%;"));
  assert.ok(landscape.includes(".discovery-layout--swipe .deck-card-wrap .product-visual { min-height: 0; flex: 1 1 50%;"));
});


test("les gestes tactiles et les gestes souris utilisent des flux distincts", function() {
  assert.ok(app.includes('surface.addEventListener("touchstart"'));
  assert.ok(app.includes('document.addEventListener("touchmove"'));
  assert.ok(app.includes('document.addEventListener("touchend"'));
  assert.ok(app.includes('event.pointerType==="touch"'));
  assert.ok(app.includes('document.addEventListener("pointermove"'));
  assert.ok(app.includes('document.addEventListener("pointerup"'));
  assert.ok(app.includes("activeSwipeCleanup"));
});


test("all product-card thumbnails use catalogue photo resolution and fallbacks", function() {
  const grid = app.slice(app.indexOf("function renderGridCards"),app.indexOf("function renderDiscover"));
  assert.ok(app.includes("function productImageMarkup(product, label, options)"));
  assert.ok(grid.includes("productImageMarkup(product, product.name)"));
  assert.ok(app.includes("productImageMarkup(entry.product,entry.product.name)"));
  assert.ok(app.includes('referrerpolicy="strict-origin-when-cross-origin"'));
  assert.ok(app.includes("product-images"));
  assert.ok(app.includes("imageFallbackUrl"));
  assert.ok(app.includes("await loadCatalogPage(pageIndex)"));
  assert.ok(app.includes("function productImageCandidates(product)"));
  assert.ok(app.includes("fallbackUrls: lookup.urls.slice(1).concat(extraFallbacks)"));
});

test("Pinterest inspiration cards expose a separate inventory of visible outfit pieces", function() {
  assert.ok(app.includes("function renderPinterestPieceAnalysis(pin)"));
  assert.ok(app.includes("Pièces repérées dans la photo"));
  assert.ok(app.includes("renderPinterestPieceAnalysis(item)"));
  assert.ok(app.includes("const pieces = (Array.isArray(visual.pieces) ? visual.pieces : []).slice(0,12)"));
  assert.ok(app.includes("slot:piece.slot || productSlot({name:piece.type || \"\"})"));
});

test("local and Cloudflare recommendation agents receive the full structured Pinterest outfit", function() {
  assert.ok(agent.includes("summary:clean(item.summary,320)"));
  assert.ok(agent.includes("pieces:(Array.isArray(item.pieces) ? item.pieces : []).slice(0,12)"));
  assert.ok(agent.includes("pin && pin.summary"));
  assert.ok(agent.includes("piece.slot"));
  assert.ok(visionWorker.includes("normalizeInspirations(body.inspirations)"));
  assert.ok(visionWorker.includes("inventaire pièce par pièce"));
});

test("Pinterest vision analyses each visible garment in its own outfit slot", function() {
  assert.ok(visionWorker.includes('const PIECE_SLOT_VALUES = ["outerwear","top","bottom","shoes","accessory"]'));
  assert.ok(visionWorker.includes("function inferVisualPieceSlot(type)"));
  assert.ok(visionWorker.includes("version:5"));
  assert.ok(visionWorker.includes("raw.pieces.slice(0,12)"));
  assert.ok(visionWorker.includes("jusqu’à 12 pièces séparées"));
  assert.ok(pinterestSync.includes("const ANALYSIS_VERSION = 5"));
  assert.ok(outfits.includes("function visualPieceSlot(piece)"));
  assert.ok(outfits.includes("const productCategory = productSlot(product)"));
  assert.ok(outfits.includes("const expectedSlots = visibleSlots.length ? visibleSlots : coreSlots"));
});

test("the selected discovery layout is retained across reloads", function() {
  assert.ok(!app.includes('state.settings.discoveryView = "cards";'));
});


test("les vues de démonstration du board n'écrivent jamais dans le stockage personnel", function() {
  const persistStart = app.indexOf("function persist()");
  const persistEnd = app.indexOf("function imageMarkup", persistStart);
  const persistBody = app.slice(persistStart, persistEnd);
  assert.ok(app.includes('const stored = showcaseView ? null : await loadState();'));
  assert.ok(persistBody.indexOf("if (showcaseView)") >= 0);
  assert.ok(persistBody.indexOf("if (showcaseView)") < persistBody.indexOf("saveState(state)"));
  assert.ok(persistBody.includes("persisted:false"));
  assert.ok(app.includes("if (showcaseView || !state || !state.settings.communitySharing) return;"));
  assert.ok(app.includes("if (!showcaseView && state.settings.aiAgentConsent && remoteConfigured)"));
  assert.ok(app.includes('communityConfig = { enabled:false, apiKey:"", projectId:"" };'));
  assert.ok(app.includes('aiAgentConfig = { enabled:false, endpoint:"" };'));

});

test("le libellé MODE DÉMO reste visible une seule fois au-dessus du board", function() {
  assert.ok(css.includes("body.showcase-embed #save-status"));
  assert.ok(board.includes('<strong>MODE DÉMO</strong>'));
  assert.equal((board.match(/MODE DÉMO/g) || []).length, 1);
  assert.ok(board.includes("10 articles et 6 inspirations fixes"));
  assert.ok(board.includes(".board-toolbar,.demo-mode-banner{display:none!important}"));
  const boardMarkup = board.slice(board.indexOf('<main class="board"'), board.indexOf("</main>"));
  assert.ok(!/mode démo/i.test(boardMarkup));
});


test("la démonstration utilise une base fixe de dix articles et six inspirations", function() {
  const demoCatalog = JSON.parse(readFileSync(new URL("../data/demo-catalog.json", import.meta.url), "utf8"));
  const demoPins = JSON.parse(readFileSync(new URL("../data/demo-pinterest-pins.json", import.meta.url), "utf8"));
  assert.equal(demoCatalog.products.length, 10);
  assert.equal(new Set(demoCatalog.products.map(product => product.id)).size, 10);
  assert.ok(demoCatalog.products.every(product => product.imageUrl && product.url && Number.isFinite(Number(product.price))));
  assert.ok(demoCatalog.products.every(product => product.gender === "men" && product.catalogStatus === "active"));
  assert.ok(new Set(demoCatalog.products.map(product => product.category)).size >= 9);
  assert.equal(demoPins.pins.length, 6);
  assert.equal(new Set(demoPins.pins.map(pin => String(pin.id))).size, 6);
});

test("les aperçus du board ne chargent que les fichiers démo et ne paginent jamais le catalogue réel", function() {
  const start = app.indexOf("async function boot()");
  const end = app.indexOf("boot().catch", start);
  const boot = app.slice(start, end);
  const demoStart = boot.indexOf("if (showcaseView) {");
  const demoEnd = boot.indexOf("} else {", demoStart);
  const demoBranch = boot.slice(demoStart, demoEnd);
  assert.ok(demoBranch.includes('fetch("./data/demo-catalog.json"'));
  assert.ok(demoBranch.includes('fetch("./data/demo-pinterest-pins.json"'));
  assert.ok(demoBranch.includes("catalogManifest = null;"));
  assert.ok(!demoBranch.includes("refreshCatalogManifest("));
  assert.ok(!demoBranch.includes("catalog-pages/"));
  assert.ok(app.includes("state.products = state.products.slice(0, 10);"));
  assert.ok(app.includes('state.settings.objective = "Tout";'));
  assert.ok(app.includes('state.settings.season = "Toute saison";'));
  assert.ok(!app.includes("showcase-demo-badge"));
});


test("le nombre de marques affiché correspond au catalogue réel actif, hors base démo", function() {
  const directory = JSON.parse(readFileSync(new URL("../data/merchant-directory.json", import.meta.url), "utf8")).entries;
  const normalizeBrand = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const directoryNames = new Set(directory.map(entry => normalizeBrand(entry.name)));
  const pageFiles = Array.from({length:5}, (_, index) => "../data/catalog-pages/page-" + String(index + 1).padStart(4, "0") + ".json");
  const products = pageFiles.flatMap(file => JSON.parse(readFileSync(new URL(file, import.meta.url), "utf8")).products || []);
  const brands = new Set(products
    .filter(product => product.catalogStatus !== "stale" && product.availabilityStatus !== "out_of_stock")
    .map(product => normalizeBrand(product.brand))
    .filter(brand => brand && directoryNames.has(brand)));
  assert.equal(brands.size, 24);
  assert.ok(board.includes("<strong>24</strong>"));
  assert.ok(board.includes("MARQUES<br>REPRÉSENTÉES"));
});

test("le board est allégé et ne présente plus de statistiques en pied de page", function() {
  const boardMarkup = board.slice(board.indexOf('<main class="board"'), board.indexOf("</main>"));
  assert.ok(!boardMarkup.includes('class="head-facts"'));
  assert.ok(!boardMarkup.includes('class="board-foot"'));
  assert.ok(!boardMarkup.includes('class="foot-stats"'));
  assert.equal((boardMarkup.match(/class="proof-card"/g) || []).length, 3);
});


test("les trois écrans du board ouvrent les vues de démonstration normales", function() {
  assert.ok(board.includes('src="./?showcase=discover"'));
  assert.ok(board.includes('src="./?showcase=training"'));
  assert.ok(board.includes('src="./?showcase=outfits"'));
  assert.ok(!board.includes("demoProductId="));
  assert.ok(app.includes('const showcaseView = ["discover", "training", "wardrobe", "outfits"]'));
  assert.ok(app.includes('fetch("./data/demo-catalog.json"'));
  assert.ok(app.includes('fetch("./data/demo-pinterest-pins.json"'));
});

test("le board reprend la composition du document A3 fourni", function() {
  const markup = board.slice(board.indexOf('<main class="board"'), board.indexOf("</main>"));
  assert.ok(markup.includes("Ton style.<br>Pas une<br>tendance."));
  assert.ok(markup.includes(">Contexte</span>"));
  assert.ok(markup.includes(">L’idée</span>"));
  assert.ok(markup.includes("Moins chercher.<br>Mieux choisir."));
  assert.ok(markup.includes("Le swipe sur ordinateur"));
  assert.ok(markup.includes("Affiner ses goûts"));
  assert.ok(markup.includes("Composer un look"));
  assert.equal((markup.match(/<iframe /g) || []).length, 3);
  assert.ok(markup.includes('class="copy-col"'));
  assert.ok(markup.includes('class="screen-area"'));
  assert.ok(markup.includes('class="phone-area"'));
  assert.ok(markup.includes("La sélection s’affine"));
  assert.ok(markup.includes("Les inspirations prennent vie"));
  assert.ok(markup.includes("Les tenues se composent"));
});


test("la vue ordinateur et les vues mobiles gardent leurs largeurs propres", function() {
  assert.ok(board.includes("width:950px;height:950px;transform:scale(var(--desktop-scale))"));
  assert.ok(board.includes("width:390px;height:844px;transform:scale(var(--phone-scale))"));
  assert.ok(board.includes("--desktop-scale:.505"));
  assert.ok(board.includes("--phone-scale:.64"));
  assert.ok(board.includes("@media (max-width:760px)"));
  assert.ok(boardPdfScript.includes("async function verifyShowcaseViews"));
  assert.ok(boardPdfScript.includes('const expected = ["discover","training","outfits"]'));
});


test("les boutons PDF du header pointent vers les fichiers canoniques à la racine", function() {
  assert.ok(board.includes('href="./board.pdf"'));
  assert.ok(board.includes('href="./board-print-a3.pdf"'));
  assert.ok(board.includes('class="pdf-reader-button"'));
  assert.ok(board.includes('class="pdf-crop-button"'));
});


test("le board web conserve le format de référence A3 paysage", function() {
  assert.ok(board.includes("@page{size:A3 landscape;margin:0}"));
  assert.ok(board.includes("flex:0 0 80%;height:80%"));
  assert.ok(board.includes("grid-template-columns:18.2fr 36.5fr 41.7fr"));
});

test("le workflow préserve les PDF personnalisés, même s'ils sont déposés séparément", function() {
  assert.ok(workflow.includes('backup_dir="$(mktemp -d)"'));
  assert.ok(workflow.includes("for file in board.pdf board-print-a3.pdf"));
  assert.ok(workflow.includes('if [ -f "$file" ]; then cp "$file" "$backup_dir/$file"; fi'));
  assert.ok(workflow.includes('if [ -f "$backup_dir/$file" ]; then cp "$backup_dir/$file" "$file"; fi'));
});


test("les cadres du board adaptent les aperçus ordinateur et téléphone à leur largeur réelle", function() {
  assert.ok(board.includes("transform:scale(var(--preview-scale,.48))"));
  assert.ok(board.includes(".phone-screen{position:relative;"));
  assert.ok(board.includes("transform:scale(var(--preview-scale,.58))"));
  assert.ok(board.includes("container.clientWidth"));
  assert.ok(board.includes("Math.min(1, availableWidth / viewportWidth)"));
  assert.ok(board.includes("new ResizeObserver(fit)"));
  assert.ok(!board.includes("--desktop-scale"));
  assert.ok(!board.includes("--phone-scale"));
});
