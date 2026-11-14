import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultSheet,
  createDnd5ePreset,
  createGenericD20Preset,
  updateFieldValue,
} from './sheetModel';
import {
  awardXp,
  calculateUpgradeCost,
  extractAllTraits,
  getAvailableXp,
  getCheapestBlockedUpgrade,
  getPossibleUpgrades,
  undoLastUpgrade,
  upgradeTraitWithXp,
} from './xpSystem';

test('calculateUpgradeCost applies World of Darkness costs for attributes, skills, and disciplines', () => {
  assert.equal(calculateUpgradeCost('attribute', 3).cost, 12);
  assert.equal(calculateUpgradeCost('attribute', 0).cost, 4);

  assert.equal(calculateUpgradeCost('skill', 2).cost, 4);
  assert.equal(calculateUpgradeCost('skill', 0).cost, 3);

  assert.equal(calculateUpgradeCost('discipline', 2).cost, 10);
  assert.equal(calculateUpgradeCost('discipline', 3).cost, 15);
  assert.equal(calculateUpgradeCost('discipline', 0).cost, 10);
});

test('getPossibleUpgrades reads current sheet ratings and filters out unaffordable or maxed traits', () => {
  let sheet = createDefaultSheet(); // starts with 14 available XP
  assert.equal(getAvailableXp(sheet.xp), 14);

  const possibleAt14 = getPossibleUpgrades(sheet);
  const keysAt14 = new Set(possibleAt14.map((t) => t.key));

  // Affordable at 14 XP: Strength (3->4 = 12), Brawl (2->3 = 4), Presence (2->3 = 10)
  assert.equal(keysAt14.has('strength'), true);
  assert.equal(keysAt14.has('brawl'), true);
  assert.equal(keysAt14.has('occult'), true);
  assert.equal(keysAt14.has('presence'), true);

  // Unaffordable at 14 XP: Dexterity (4->5 = 16), Manipulation (4->5 = 16), Dominate (3->4 = 15)
  assert.equal(keysAt14.has('dexterity'), false);
  assert.equal(keysAt14.has('manipulation'), false);
  assert.equal(keysAt14.has('dominate'), false);
  assert.equal(keysAt14.has('generation'), false);

  // If player directly edits Brawl from 2 -> 5 on sheet, Brawl is maxed and excluded
  sheet = updateFieldValue(sheet, 'f_brawl', 5);
  const possibleAfterMax = getPossibleUpgrades(sheet, 'skill');
  assert.equal(possibleAfterMax.some((t) => t.key === 'brawl'), false);

  // Increasing XP by +2 (to 16) unlocks Dominate (15) and Dexterity (16)
  const awardRes = awardXp(sheet, 2, 'Bonus XP', '23:00', 'xp_bonus');
  assert.equal(awardRes.ok, true);
  const possibleAt16 = getPossibleUpgrades(awardRes.sheet);
  assert.equal(possibleAt16.some((t) => t.key === 'dominate'), true);
  assert.equal(possibleAt16.some((t) => t.key === 'dexterity'), true);
});

test('upgradeTraitWithXp updates sheet field, deducts XP, updates possible list, and undo restores state', () => {
  const sheet = createDefaultSheet(); // 14 XP available
  const upg = upgradeTraitWithXp(sheet, 'f_strength', '23:10', 'xp_upg_1');
  assert.equal(upg.ok, true);
  assert.equal(upg.trait?.cost, 12);
  assert.equal(getAvailableXp(upg.sheet.xp), 2);
  assert.equal(upg.sheet.xp?.spent, 12);

  // Strength on the actual sheet is now 4
  const strengthField = upg.sheet.cards
    .flatMap((c) => c.fields)
    .find((f) => f.id === 'f_strength');
  assert.equal(strengthField?.value, 4);

  // With only 2 XP remaining, no traits are possible (cheapest is Brawl 2->3 at 4 XP)
  assert.equal(getPossibleUpgrades(upg.sheet).length, 0);
  const cheapest = getCheapestBlockedUpgrade(upg.sheet);
  assert.equal(cheapest?.key, 'brawl');
  assert.equal(cheapest?.cost, 4);

  // Undo restores Strength -> 3 and refunds 12 XP
  const reverted = undoLastUpgrade(upg.sheet);
  assert.equal(reverted.ok, true);
  assert.equal(getAvailableXp(reverted.sheet.xp), 14);
  const restoredStrength = reverted.sheet.cards
    .flatMap((c) => c.fields)
    .find((f) => f.id === 'f_strength');
  assert.equal(restoredStrength?.value, 3);
});

test('awardXp prevents lowering totalEarned below already spent XP and handles D20 / D&D 5e presets', () => {
  const sheet = createDefaultSheet();
  const upg = upgradeTraitWithXp(sheet, 'f_presence', '23:15', 'xp_upg_p');
  assert.equal(upg.ok, true); // spent = 10, totalEarned = 14

  const badDeduct = awardXp(upg.sheet, -6, 'Penalty', '23:16', 'xp_bad');
  assert.equal(badDeduct.ok, false);
  assert.match(badDeduct.error ?? '', /gasto/i);

  const d20 = createGenericD20Preset();
  const d20Traits = extractAllTraits(d20);
  assert.equal(d20Traits.some((t) => t.key === 'forca' && t.maxCap === 20), true);

  const dnd = createDnd5ePreset(); // 1800 XP available
  const dndTraits = extractAllTraits(dnd);
  const perception = dndTraits.find((t) => t.key === 'perception');
  assert.equal(perception?.category, 'skill');
  assert.equal(perception?.cost, 150);

  // Upgrade Strength (16 -> 17 costs 1600 XP) -> 200 XP remains -> only skills remain possible
  const upgStr = upgradeTraitWithXp(dnd, 'f_strength', '21:10', 'xp_dnd_str');
  assert.equal(upgStr.ok, true);
  assert.equal(getAvailableXp(upgStr.sheet.xp), 200);
  const remaining = getPossibleUpgrades(upgStr.sheet);
  assert.equal(remaining.every((t) => t.category === 'skill'), true);
});
