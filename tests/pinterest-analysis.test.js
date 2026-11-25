import test from "node:test";
import assert from "node:assert/strict";
import { dedupePins, pinWeight, visualPieces, pinBrandMentions, colorFamily, inferPinterestFeatures, buildOutfitIdeas, outfitCoherenceAdjustment, pinterestAffinity } from "../modules/outfits.js";
import { deriveLearnedPreferences, createInitialState, normalizeProduct as normalizeRawProduct } from "../modules/engine.js";

function normalizeProduct(raw) { return normalizeRawProduct(Object.assign({ gender: "men", genderVerified: true, seasonTags: ["Toute saison"] }, raw || {})); }
function menPin(pin, pieces, extra) {
  return Object.assign({ createdAt: "2026-11-12T10:00:00" }, pin, {
    visualAnalysis: Object.assign({ version: 5, audience: "men", isFashion: true, confidence: .95, pieces: pieces || [] }, extra || {})
  });
}
const KNIT_JEANS_SNEAKERS = [
  { slot: "top", type: "pull", color: "crème", prominence: "hero" },
  { slot: "bottom", type: "jean", color: "noir", prominence: "hero" },
  { slot: "shoes", type: "baskets", color: "noir", prominence: "supporting" }
];

test("dedupePins keeps one pin for near-identical outfits and keeps distinct ones", function() {
  const original = menPin({ id: "a", title: "Men's long sleeve casual colorblock striped sweater outfit", imageUrl: "https://i.pinimg.com/1200x/aa/bb/cc/aabbccddeeff00112233445566778899.jpg", createdAt: "2026-11-10T10:00:00" }, KNIT_JEANS_SNEAKERS);
  const resaved = menPin({ id: "b", title: "Men's long sleeve casual colorblock striped sweater outfit", imageUrl: "https://i.pinimg.com/1200x/11/22/33/1122334455667788990011223344556677.jpg", createdAt: "2026-11-13T10:00:00" }, KNIT_JEANS_SNEAKERS);
  const sameGenericTitleOtherLook = menPin({ id: "c", title: "Men's long sleeve casual colorblock striped sweater outfit", createdAt: "2026-11-11T10:00:00" }, [
    { slot: "top", type: "chemise", color: "bleu" }, { slot: "bottom", type: "pantalon", color: "beige" }, { slot: "shoes", type: "mocassins", color: "marron" }
  ]);
  const sameImage = menPin({ id: "d", title: "Autre titre", imageUrl: "https://i.pinimg.com/236x/aa/bb/cc/aabbccddeeff00112233445566778899.jpg", createdAt: "2026-11-01T10:00:00" }, []);
  const kept = dedupePins([resaved, original, sameGenericTitleOtherLook, sameImage]);
  assert.deepEqual(kept.map(pin => pin.id), ["b", "c"], "le plus récent des doublons est conservé, l'ordre d'origine aussi");
  assert.deepEqual(dedupePins([]), []);
  assert.deepEqual(dedupePins(null), []);
});

test("pinWeight favours recent pins, tolerates missing dates and lowers uncertain analyses", function() {
  const now = Date.parse("2026-11-25T00:00:00Z");
  const fresh = pinWeight({ createdAt: "2026-11-24T10:00:00" }, now), old = pinWeight({ createdAt: "2025-01-01T10:00:00" }, now);
  assert.ok(fresh > old && old >= .55 && fresh <= 1);
  assert.equal(pinWeight({ id: "x" }, now), 1, "un Pin sans date garde le poids historique");
  assert.ok(pinWeight({ visualAnalysis: { confidence: .2 } }, now) < pinWeight({ visualAnalysis: { confidence: 1 } }, now));
  assert.equal(pinWeight(null, now), 1);
});

test("damaged or partial visual analyses never throw", function() {
  const broken = { id: "broken", title: "Men's outfit", visualAnalysis: { version: 5, audience: "men", isFashion: true, pieces: [null, "pull", 42, { type: "jean", details: "délavé" }, { slot: "shoes" }] } };
  assert.equal(visualPieces(broken.visualAnalysis).length, 2);
  assert.doesNotThrow(() => inferPinterestFeatures(broken));
  assert.doesNotThrow(() => buildOutfitIdeas([broken], [], [normalizeProduct({ id: "p", name: "Jean noir", url: "https://shop.example/p", colors: ["noir"] })], []));
  assert.doesNotThrow(() => pinterestAffinity(normalizeProduct({ name: "Jean" }), [broken, null, undefined]));
  assert.equal(visualPieces(null).length, 0);
});

test("brands named in a pin's text become a signal, short names and partial words do not", function() {
  const pin = menPin({ id: "brand", title: "Carhartt WIP jacket with Nike sneakers", description: "A look with Edwin denim, no GAP, Jules or Les Nikesque" });
  const lexicon = ["Carhartt WIP", "Nike", "Edwin", "GAP", "Nikes", "Armor-Lux"];
  assert.deepEqual(pinBrandMentions(pin, lexicon).sort(), ["carhartt wip", "edwin", "nike"]);
  const mentioned = normalizeProduct({ id: "m", name: "Veste", brand: "Carhartt WIP", url: "https://shop.example/m" });
  const other = normalizeProduct({ id: "o", name: "Veste", brand: "Autre Marque", url: "https://shop.example/o" });
  assert.ok(pinterestAffinity(mentioned, [pin]) > pinterestAffinity(other, [pin]));
});

test("near-duplicate pins count once in the learned starting point and hero pieces weigh more", function() {
  const hero = menPin({ id: "hero", title: "Cream knit and black jeans outfit", imageUrl: "https://i.pinimg.com/1200x/a1/a1/a1/a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1.jpg" }, [
    { slot: "top", type: "pull", color: "crème", prominence: "hero" },
    { slot: "top", type: "chemise", color: "blanc", prominence: "supporting" },
    { slot: "bottom", type: "jean", color: "noir", prominence: "hero" }
  ]);
  const twin = Object.assign({}, hero, { id: "twin", imageUrl: "https://i.pinimg.com/1200x/b2/b2/b2/b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2.jpg" });
  const single = createInitialState([]); single.pinterestPins = [hero];
  const double = createInitialState([]); double.pinterestPins = [hero, twin];
  const learnedSingle = deriveLearnedPreferences(single), learnedDouble = deriveLearnedPreferences(double);
  assert.deepEqual(Object.keys(learnedDouble).sort(), Object.keys(learnedSingle).sort());
  Object.keys(learnedSingle).forEach(token => assert.ok(Math.abs(learnedDouble[token] - learnedSingle[token]) < 1e-6, "un doublon ne double pas le signal : " + token));
  assert.ok(learnedSingle["family:knit"] > learnedSingle["family:shirt"], "la pièce principale pèse plus que la pièce d'appoint");
  assert.ok(learnedSingle["colors:creme"] > 0);
});

test("a recent pin teaches slightly more than an old one", function() {
  const recent = menPin({ id: "r", title: "Navy jacket outfit", createdAt: new Date().toISOString() }, [{ slot: "outerwear", type: "veste", color: "marine", prominence: "hero" }]);
  const old = menPin({ id: "o", title: "Navy jacket outfit", createdAt: "2023-01-01T10:00:00" }, [{ slot: "outerwear", type: "veste", color: "marine", prominence: "hero" }]);
  const a = createInitialState([]); a.pinterestPins = [recent];
  const b = createInitialState([]); b.pinterestPins = [old];
  assert.ok(deriveLearnedPreferences(a)["family:jacket"] > deriveLearnedPreferences(b)["family:jacket"]);
});

test("colour families group synonyms and tell neutral from loud colours apart", function() {
  assert.equal(colorFamily("Bleu marine"), "navy");
  assert.equal(colorFamily("NAVY"), "navy");
  assert.equal(colorFamily("Vert kaki"), "olive");
  assert.equal(colorFamily("Bordeaux"), "red");
  assert.equal(colorFamily("Écru"), "white");
  assert.equal(colorFamily(""), "");
});

test("outfit composition avoids two clashing loud colours and keeps a neutral base", function() {
  const pin = menPin({ id: "look", title: "Casual look" }, [
    { slot: "top", type: "pull", color: "rouge", prominence: "hero" },
    { slot: "shoes", type: "baskets", color: "blanc", prominence: "supporting" }
  ]);
  const catalogue = [
    normalizeProduct({ id: "top-red", name: "Pull rouge", url: "https://shop.example/1", colors: ["Rouge"], category: "Pull", styleTags: ["Casual"] }),
    normalizeProduct({ id: "bottom-green", name: "Pantalon vert vif", url: "https://shop.example/2", colors: ["Vert"], category: "Pantalon", styleTags: ["Casual"] }),
    normalizeProduct({ id: "bottom-beige", name: "Pantalon beige", url: "https://shop.example/3", colors: ["Beige"], category: "Pantalon", styleTags: ["Casual"] }),
    normalizeProduct({ id: "shoes-white", name: "Baskets blanches", url: "https://shop.example/4", colors: ["Blanc"], category: "Chaussures", objective: "Chaussures", styleTags: ["Casual"] })
  ];
  const [idea] = buildOutfitIdeas([pin], [], catalogue, []);
  const ids = idea.items.map(entry => entry.product.id);
  assert.ok(ids.includes("top-red"));
  assert.ok(ids.includes("bottom-beige") && !ids.includes("bottom-green"), "rouge et vert vif ne se combinent pas : " + ids.join(","));
  // Si le look d'origine assume deux couleurs vives, le faux pas disparaît.
  const colourful = menPin({ id: "colourful", title: "Casual look" }, [
    { slot: "top", type: "pull", color: "rouge" }, { slot: "bottom", type: "pantalon", color: "vert" }
  ]);
  const red = { product: catalogue[0], slot: "top" }, green = { product: catalogue[1], slot: "bottom" };
  assert.ok(outfitCoherenceAdjustment(green, [red], {}) < -5);
  assert.ok(outfitCoherenceAdjustment(green, [red], { colorBlock: true }) > outfitCoherenceAdjustment(green, [red], {}));
  assert.equal(buildOutfitIdeas([colourful], [], catalogue, [])[0].items.map(entry => entry.product.id).includes("bottom-green"), true);
});

test("outfit composition keeps registers and seasons coherent and skips pieces the look does not show", function() {
  const catalogue = [
    normalizeProduct({ id: "top", name: "T-shirt blanc", url: "https://shop.example/t", colors: ["Blanc"], category: "T-shirt", styleTags: ["Classique"] }),
    normalizeProduct({ id: "short", name: "Short bermuda", url: "https://shop.example/s", colors: ["Beige"], category: "Short", styleTags: ["Classique"] }),
    normalizeProduct({ id: "jean", name: "Jean droit", url: "https://shop.example/j", colors: ["Bleu"], category: "Pantalon", styleTags: ["Classique"] }),
    normalizeProduct({ id: "shoes", name: "Sneakers blanches", url: "https://shop.example/sn", colors: ["Blanc"], category: "Chaussures", objective: "Chaussures", styleTags: ["Classique"] }),
    normalizeProduct({ id: "coat", name: "Manteau long", url: "https://shop.example/c", colors: ["Noir"], category: "Manteau", styleTags: ["Classique"] })
  ];
  const winter = menPin({ id: "winter", title: "Casual outfit" }, [
    { slot: "top", type: "t-shirt", color: "blanc" }, { slot: "bottom", type: "pantalon", color: "bleu" }, { slot: "shoes", type: "baskets", color: "blanc" }
  ], { seasonTags: ["Hiver"] });
  const [idea] = buildOutfitIdeas([winter], [], catalogue, []);
  const ids = idea.items.map(entry => entry.product.id);
  assert.ok(!ids.includes("short"), "pas de short pour un look d'hiver : " + ids.join(","));
  assert.ok(!ids.includes("coat"), "pas de manteau si la tenue d'origine n'en montre pas : " + ids.join(","));
  assert.ok(ids.includes("jean"));
  const hot = { colorBlock: false, season: "hot" };
  assert.ok(outfitCoherenceAdjustment({ product: catalogue[4], slot: "outerwear" }, [], hot) < 0);
  assert.ok(outfitCoherenceAdjustment({ product: catalogue[1], slot: "bottom" }, [], { season: "cold" }) < 0);
  const sporty = normalizeProduct({ id: "sp", name: "Sweat sport", url: "https://shop.example/sp", styleTags: ["Sport"] });
  const formal = normalizeProduct({ id: "fo", name: "Pantalon de costume", url: "https://shop.example/fo", styleTags: ["Classe"] });
  assert.ok(outfitCoherenceAdjustment({ product: formal, slot: "bottom" }, [{ product: sporty, slot: "top" }], {}) < 0);
  assert.equal(outfitCoherenceAdjustment({ product: formal, slot: "bottom" }, [{ product: sporty, slot: "top" }], { mixedStyle: true }), 0);
});

test("near-identical pins produce a single outfit idea", function() {
  const a = menPin({ id: "a", title: "Cream knit with black jeans outfit idea", imageUrl: "https://i.pinimg.com/1200x/c3/c3/c3/c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3.jpg" }, KNIT_JEANS_SNEAKERS);
  const b = Object.assign({}, a, { id: "b", imageUrl: "https://i.pinimg.com/1200x/d4/d4/d4/d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4.jpg" });
  const ideas = buildOutfitIdeas([a, b], [], [], []);
  assert.equal(ideas.length, 1);
});
