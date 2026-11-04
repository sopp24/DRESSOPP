import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { inferPinterestFeatures, inferPinterestTags, buildOutfitIdeas } from "../modules/outfits.js";
import { createInitialState, deriveLearnedPreferences } from "../modules/engine.js";

const root = new URL("../", import.meta.url);
const lookbook = JSON.parse(readFileSync(new URL("../data/lookbook-pins.json", import.meta.url), "utf8"));
const outfits = lookbook.pins.filter(pin => pin.kind === "outfit");

test("the imported lookbook contains 20 references, including 19 outfits and one detail", function() {
  assert.equal(lookbook.totalLooks, 20);
  assert.equal(lookbook.pins.length, 20);
  assert.equal(outfits.length, 19);
  assert.equal(lookbook.pins.filter(pin => pin.kind === "detail").length, 1);
  assert.equal(lookbook.season, "Automne / Hiver");
});

test("all lookbook visual assets are present in the repository", function() {
  lookbook.pins.forEach(function(pin) {
    const path = new URL("../" + pin.imageUrl.replace(/^\.\//, ""), import.meta.url);
    assert.ok(existsSync(fileURLToPath(path)), "Missing image for " + pin.id);
  });
});

test("lookbook descriptions expose the intended preppy, tailoring and heritage signals", function() {
  const features = inferPinterestFeatures(lookbook.pins[0]);
  assert.ok(features.styleTags.includes("Preppy"));
  assert.ok(features.styleTags.includes("Smart Casual"));
  assert.ok(features.colors.includes("chocolat"));
  assert.ok(features.materials.includes("cuir"));
  assert.ok(features.cuts.includes("à pinces"));
});

test("patterned looks are classified and represented in the feature model", function() {
  const stripes = inferPinterestFeatures(lookbook.pins[4]);
  const checker = inferPinterestFeatures(lookbook.pins[11]);
  const jacquard = inferPinterestFeatures(lookbook.pins[13]);
  assert.ok(stripes.patterns.includes("rayures"));
  assert.ok(checker.patterns.includes("damier"));
  assert.ok(jacquard.patterns.includes("jacquard"));
  assert.ok(inferPinterestTags(lookbook.pins[4]).includes("rayures"));
});

test("the app can build all 19 outfit ideas directly from the local lookbook", function() {
  const ideas = buildOutfitIdeas(outfits, [], [], []);
  assert.equal(ideas.length, 19);
  assert.equal(ideas.some(idea => idea.pin.kind === "detail"), false);
});

test("the complete lookbook contributes learned preferences and outfit feedback changes their weight", function() {
  const state = createInitialState([]);
  state.pinterestPins = lookbook.pins;
  const baseline = deriveLearnedPreferences(state);
  assert.ok(baseline["colors:chocolat"] > 0);
  assert.ok(baseline["patterns:rayures"] > 0);
  assert.ok(baseline["styleTags:preppy"] > 0);

  state.outfitFeedback = { "lookbook-05": { vote: "yes" } };
  const approved = deriveLearnedPreferences(state);
  assert.ok(approved["patterns:rayures"] > baseline["patterns:rayures"]);

  state.outfitFeedback = { "lookbook-05": { vote: "no" } };
  const rejected = deriveLearnedPreferences(state);
  assert.ok(rejected["patterns:rayures"] < baseline["patterns:rayures"]);
});
