import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultSheet,
  createDnd5ePreset,
  createGenericD20Preset,
  createNewSheetForSystem,
  updateFieldValue,
} from './sheetModel';
import {
  awardXp,
  buyBackgroundWithXp,
  buySpecialtyWithXp,
  calculateUpgradeCost,
  extractAllTraits,
  getAvailableXp,
  getCheapestBlockedUpgrade,
  getPossibleUpgrades,
  resetXpPricingConfig,
  setXpRulePreset,
  undoLastUpgrade,
  upgradeTraitWithXp,
} from './xpSystem';

test('calculateUpgradeCost applies World of Darkness V20 costs for attributes, skills, disciplines, and virtues', () => {
  assert.equal(calculateUpgradeCost(3, 'attribute', 'storyteller-v20'), 12);
  assert.equal(calculateUpgradeCost(2, 'attribute', 'storyteller-v20'), 8);
  assert.equal(calculateUpgradeCost(0, 'attribute', 'storyteller-v20'), 4);

  assert.equal(calculateUpgradeCost(2, 'skill', 'storyteller-v20'), 4);
  assert.equal(calculateUpgradeCost(0, 'skill', 'storyteller-v20'), 3);

  assert.equal(calculateUpgradeCost(2, 'discipline', 'storyteller-v20'), 10);
  assert.equal(calculateUpgradeCost(3, 'discipline', 'storyteller-v20'), 15);
  assert.equal(calculateUpgradeCost(0, 'discipline', 'storyteller-v20'), 10);
  assert.equal(calculateUpgradeCost(2, 'discipline', 'storyteller-v20', { isOutOfClan: true }), 14);
  assert.equal(calculateUpgradeCost(0, 'discipline', 'storyteller-v20', { isOutOfClan: true }), 10);

  assert.equal(calculateUpgradeCost(5, 'virtue', 'storyteller-v20', { virtueSubtype: 'willpower' }), 5);
  assert.equal(calculateUpgradeCost(0, 'virtue', 'storyteller-v20', { virtueSubtype: 'willpower' }), 1);
  assert.equal(calculateUpgradeCost(7, 'virtue', 'storyteller-v20', { virtueSubtype: 'humanity' }), 14);
});

test('calculateUpgradeCost applies Vampire V5 costs and blocks Willpower and Humanity direct purchases', () => {
  // Attribute 2 -> 3 = (2 + 1) * 5 = 15 XP (vs 8 XP in V20)
  assert.equal(calculateUpgradeCost(2, 'attribute', 'vampire-v5'), 15);
  // Skill 0 -> 1 = (0 + 1) * 3 = 3 XP
  assert.equal(calculateUpgradeCost(0, 'skill', 'vampire-v5'), 3);
  assert.equal(calculateUpgradeCost(2, 'skill', 'vampire-v5'), 9);
  // Clan Discipline 0 -> 1 = (0 + 1) * 5 = 5 XP (vs 10 XP in V20)
  assert.equal(calculateUpgradeCost(0, 'discipline', 'vampire-v5'), 5);
  assert.equal(calculateUpgradeCost(2, 'discipline', 'vampire-v5'), 15);
  // Out-of-Clan Discipline 0 -> 1 = 7 XP, 2 -> 3 = 21 XP
  assert.equal(calculateUpgradeCost(0, 'discipline', 'vampire-v5', { isOutOfClan: true }), 7);
  assert.equal(calculateUpgradeCost(2, 'discipline', 'vampire-v5', { isOutOfClan: true }), 21);
  // Advantages / Virtues = (current + 1) * 3
  assert.equal(calculateUpgradeCost(2, 'virtue', 'vampire-v5', { virtueSubtype: 'virtue' }), 9);

  // Willpower & Humanity return null in V5
  assert.equal(calculateUpgradeCost(6, 'virtue', 'vampire-v5', { virtueSubtype: 'willpower' }), null);
  assert.equal(calculateUpgradeCost(7, 'virtue', 'vampire-v5', { virtueSubtype: 'humanity' }), null);
});

test('calculateUpgradeCost custom preset supports base switching (current vs next) and custom multipliers', () => {
  assert.equal(
    calculateUpgradeCost(2, 'attribute', 'custom', { customMultiplier: 6, useNewLevelBase: false }),
    12,
  );
  assert.equal(
    calculateUpgradeCost(2, 'attribute', 'custom', { customMultiplier: 6, useNewLevelBase: true }),
    18,
  );
  assert.equal(
    calculateUpgradeCost(0, 'discipline', 'custom', { customMultiplier: 8, useNewLevelBase: true }),
    8,
  );
});

test('createNewSheetForSystem auto-detects vampire-v5 for v5 systemId and storyteller-v20 otherwise', () => {
  const wodV20 = createNewSheetForSystem('wod');
  assert.equal(wodV20.xpRulePreset, 'storyteller-v20');

  const wodV5 = createNewSheetForSystem('wod-v5');
  assert.equal(wodV5.systemId, 'wod');
  assert.equal(wodV5.xpRulePreset, 'vampire-v5');

  const dnd = createNewSheetForSystem('dnd5e');
  assert.equal(dnd.xpRulePreset, 'storyteller-v20');
});

test('getPossibleUpgrades reads current sheet ratings and filters out unaffordable or maxed traits', () => {
  let sheet = createDefaultSheet(); // starts with 14 available XP
  resetXpPricingConfig(sheet);
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

test('upgradeTraitWithXp blocks Willpower/Humanity in V5 and Undo refunds exact original XP after switching presets', () => {
  // Start with Strength = 2 and 20 XP under V20
  let sheet = updateFieldValue(createDefaultSheet(), 'f_strength', 2);
  resetXpPricingConfig(sheet);
  sheet = awardXp(sheet, 6, 'Session', '21:00', 'xp_s1').sheet; // 20 XP available

  // Under V20, upgrading Strength 2 -> 3 costs 8 XP
  const v20Upgrade = upgradeTraitWithXp(sheet, 'f_strength', '21:05', 'xp_upg_v20');
  assert.equal(v20Upgrade.ok, true);
  assert.equal(v20Upgrade.trait?.cost, 8);
  assert.equal(v20Upgrade.sheet.xp?.spent, 8);
  assert.equal(v20Upgrade.sheet.xp?.ledger[0]?.xpSpent, 8);
  assert.equal(getAvailableXp(v20Upgrade.sheet.xp), 12);

  // Switch rule preset to Vampire V5 mid-campaign (Strength 3->4 would cost 20 XP, 2->3 would cost 15 XP)
  const v5Sheet = setXpRulePreset(v20Upgrade.sheet, 'vampire-v5');
  const v5Traits = extractAllTraits(v5Sheet, 'pt-BR');
  const wpTrait = v5Traits.find((t) => t.virtueSubtype === 'willpower');
  const humTrait = v5Traits.find((t) => t.virtueSubtype === 'humanity');
  assert.equal(wpTrait?.cost, null);
  assert.equal(wpTrait?.isBlockedByRule, true);
  assert.equal(wpTrait?.isPossible, false);
  assert.equal(humTrait?.cost, null);
  assert.equal(humTrait?.isBlockedByRule, true);
  assert.equal(humTrait?.isPossible, false);

  // Direct purchase of Willpower/Humanity is rejected in V5
  const blockedPurchase = upgradeTraitWithXp(v5Sheet, 'f_willpower', '21:10', 'xp_wp_fail', 'pt-BR');
  assert.equal(blockedPurchase.ok, false);
  assert.match(blockedPurchase.error ?? '', /V5/i);

  // Undo after switching preset still refunds the exact 8 XP spent originally (not 15 XP!)
  const reverted = undoLastUpgrade(v5Sheet);
  assert.equal(reverted.ok, true);
  assert.equal(reverted.sheet.xp?.spent, 0);
  assert.equal(getAvailableXp(reverted.sheet.xp), 20);
  const restoredStrength = reverted.sheet.cards
    .flatMap((c) => c.fields)
    .find((f) => f.id === 'f_strength');
  assert.equal(restoredStrength?.value, 2);
});

test('upgradeTraitWithXp updates sheet field, deducts XP, updates possible list, and undo restores state', () => {
  const sheet = createDefaultSheet(); // 14 XP available
  resetXpPricingConfig(sheet);
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
  resetXpPricingConfig(sheet);
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

test('buySpecialtyWithXp injects specialty onto skill and linked roll field, and undo reverts it', () => {
  const sheet = createDefaultSheet(); // 14 XP available
  const res = buySpecialtyWithXp(
    sheet,
    'f_firearms',
    'Armas de Fogo: Precisão',
    '20:00',
    'xp_spec_1',
  );
  assert.equal(res.ok, true);
  assert.equal(getAvailableXp(res.sheet.xp), 11);

  const firearms = res.sheet.cards.flatMap((c) => c.fields).find((f) => f.id === 'f_firearms');
  assert.equal(firearms?.rollSpecialty, true);
  assert.equal(firearms?.hint, 'Armas de Fogo: Precisão');

  const rollFirearms = res.sheet.cards
    .flatMap((c) => c.fields)
    .find((f) => f.id === 'f_roll_firearms');
  assert.equal(rollFirearms?.rollSpecialty, true);

  const undone = undoLastUpgrade(res.sheet);
  assert.equal(undone.ok, true);
  assert.equal(getAvailableXp(undone.sheet.xp), 14);
  const restored = undone.sheet.cards.flatMap((c) => c.fields).find((f) => f.id === 'f_firearms');
  assert.equal(restored?.rollSpecialty, false);
  assert.equal(restored?.hint, undefined);
});

test('buyBackgroundWithXp auto-creates card, allows subsequent upgrade, and undo removes empty card & field', () => {
  const base = createDefaultSheet(); // 14 XP available
  const sheet = {
    ...base,
    cards: base.cards.filter(
      (c) => !/ANTECEDENT|BACKGROUND|VANTAG|ADVANTAGE|MERIT|MÉRITO/i.test(`${c.code} ${c.title}`),
    ),
  };
  assert.equal(sheet.cards.some((c) => c.id === 'card_backgrounds'), false);

  const created = buyBackgroundWithXp(sheet, 'Recursos', '20:05', 'xp_bg_1');
  assert.equal(created.ok, true);
  assert.equal(getAvailableXp(created.sheet.xp), 11);
  assert.equal(created.sheet.cards.some((c) => c.id === 'card_backgrounds'), true);

  const bgFieldId = created.fieldId!;
  const bgTraits = extractAllTraits(created.sheet);
  const bgTrait = bgTraits.find((t) => t.fieldId === bgFieldId);
  assert.equal(bgTrait?.currentValue, 1);

  // Subsequent upgrade 1 -> 2 costs 2 XP
  const upgraded = upgradeTraitWithXp(created.sheet, bgFieldId, '20:06', 'xp_bg_2');
  assert.equal(upgraded.ok, true);
  assert.equal(getAvailableXp(upgraded.sheet.xp), 9);

  // Undo 1 -> 2 restores 11 XP and keeps field at 1
  const undo2 = undoLastUpgrade(upgraded.sheet);
  assert.equal(undo2.ok, true);
  assert.equal(getAvailableXp(undo2.sheet.xp), 11);
  assert.equal(
    undo2.sheet.cards.flatMap((c) => c.fields).find((f) => f.id === bgFieldId)?.value,
    1,
  );

  // Undo initial 0 -> 1 removes field and empty card_backgrounds, restoring 14 XP
  const undo1 = undoLastUpgrade(undo2.sheet);
  assert.equal(undo1.ok, true);
  assert.equal(getAvailableXp(undo1.sheet.xp), 14);
  assert.equal(undo1.sheet.cards.some((c) => c.id === 'card_backgrounds'), false);
});

test('extractAllTraits classifies all 9 V5 attributes and all 9 V20 attributes with accurate pricing', () => {
  const v5 = createNewSheetForSystem('wod', { rulePreset: 'vampire-v5' });
  const v5Traits = extractAllTraits(v5);
  const v5AttrTraits = v5Traits.filter((t) => t.category === 'attribute');
  assert.equal(v5AttrTraits.length, 9);
  for (const key of ['composure', 'resolve', 'intelligence']) {
    const trait = v5AttrTraits.find((t) => t.key === key);
    assert.ok(trait, `Expected V5 attribute ${key} to classify as attribute`);
    assert.equal(trait.currentValue, 1);
    assert.equal(trait.cost, 10); // nextLevel (2) * 5
  }

  const v20 = createDefaultSheet();
  const v20Traits = extractAllTraits(v20);
  const v20AttrTraits = v20Traits.filter((t) => t.category === 'attribute');
  assert.equal(v20AttrTraits.length, 9);
  for (const key of ['appearance', 'perception', 'intelligence']) {
    const trait = v20AttrTraits.find((t) => t.key === key);
    assert.ok(trait, `Expected V20 attribute ${key} to classify as attribute`);
    assert.equal(trait.currentValue, 3);
    assert.equal(trait.cost, 12); // currentLevel (3) * 4
  }
});
