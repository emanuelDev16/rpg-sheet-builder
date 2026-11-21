import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addFieldToCard,
  createDefaultSheet,
  createDnd5ePreset,
  createGenericD20Preset,
  createNewSheetForSystem,
  evaluateSheet,
  updateFieldValue,
  validateSheetPayload,
} from './sheetModel';
import {
  awardXp,
  buyBackgroundWithXp,
  buyCatalogAdvantageWithXp,
  buyCatalogDisciplineWithXp,
  buyCatalogSkillWithXp,
  buySpecialtyWithXp,
  calculateUpgradeCost,
  extractAcquirableTraits,
  extractAllTraits,
  getAvailableXp,
  getCheapestBlockedUpgrade,
  getPossibleUpgrades,
  resetXpPricingConfig,
  setTraitDisciplineAffinity,
  setTraitOutOfClan,
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

test('extractAllTraits auto-resolves In-Clan (×5), Out-of-Clan (×7), and Caitiff (×6) Discipline XP across V20 and V5', () => {
  // 1. V20 Brujah: Potence = In-Clan (×5), Dominate = Out-of-Clan (×7), 0->1 = 10 XP
  let v20Brujah = createNewSheetForSystem('wod', {
    edition: 'storyteller-v20',
    clan: 'Brujah',
  });
  resetXpPricingConfig(v20Brujah);
  v20Brujah = addFieldToCard(v20Brujah, 'card_arcano', {
    id: 'f_potence',
    key: 'potence',
    label: 'POTÊNCIA',
    kind: 'number',
    value: 2,
  });
  v20Brujah = updateFieldValue(v20Brujah, 'f_dominate', 2);
  v20Brujah = addFieldToCard(v20Brujah, 'card_arcano', {
    id: 'f_auspex_zero',
    key: 'auspex',
    label: 'AUSPÍCIOS',
    kind: 'number',
    value: 0,
  });

  const v20Traits = extractAllTraits(v20Brujah);
  const potV20 = v20Traits.find((t) => t.key === 'potence');
  const domV20 = v20Traits.find((t) => t.key === 'dominate');
  const ausZeroV20 = v20Traits.find((t) => t.key === 'auspex');
  assert.equal(potV20?.disciplineAffinity, 'discipline_clan');
  assert.equal(potV20?.multiplier, 5);
  assert.equal(potV20?.cost, 10); // 2 * 5
  assert.equal(domV20?.disciplineAffinity, 'discipline_out_of_clan');
  assert.equal(domV20?.isOutOfClan, true);
  assert.equal(domV20?.multiplier, 7);
  assert.equal(domV20?.cost, 14); // 2 * 7
  assert.equal(ausZeroV20?.cost, 10); // V20 0 -> 1 always 10 XP

  // 2. V5 Hecata: Oblivion = In-Clan (×5), Dominate = Out-of-Clan (×7), New Level × Mult
  let v5Hecata = createNewSheetForSystem('wod', {
    edition: 'vampire-v5',
    clan: 'Hecata',
  });
  resetXpPricingConfig(v5Hecata);
  v5Hecata = addFieldToCard(v5Hecata, 'card_arcano', {
    id: 'f_oblivion',
    key: 'oblivion',
    label: 'OBLITERAÇÃO',
    kind: 'number',
    value: 2,
  });
  v5Hecata = updateFieldValue(v5Hecata, 'f_dominate', 2);

  const v5HecataTraits = extractAllTraits(v5Hecata);
  const oblV5 = v5HecataTraits.find((t) => t.key === 'oblivion');
  const domV5 = v5HecataTraits.find((t) => t.key === 'dominate');
  assert.equal(oblV5?.disciplineAffinity, 'discipline_clan');
  assert.equal(oblV5?.multiplier, 5);
  assert.equal(oblV5?.cost, 15); // (2 + 1) * 5
  assert.equal(domV5?.disciplineAffinity, 'discipline_out_of_clan');
  assert.equal(domV5?.multiplier, 7);
  assert.equal(domV5?.cost, 21); // (2 + 1) * 7

  // 3. Caitiff in V20 and V5: all disciplines ×6
  let v20Caitiff = createNewSheetForSystem('wod', {
    edition: 'storyteller-v20',
    clan: 'Caitiff',
  });
  resetXpPricingConfig(v20Caitiff);
  v20Caitiff = updateFieldValue(v20Caitiff, 'f_dominate', 3);
  const caitiffV20Dom = extractAllTraits(v20Caitiff).find((t) => t.key === 'dominate');
  assert.equal(caitiffV20Dom?.disciplineAffinity, 'discipline_caitiff');
  assert.equal(caitiffV20Dom?.multiplier, 6);
  assert.equal(caitiffV20Dom?.cost, 18); // 3 * 6

  let v5Caitiff = createNewSheetForSystem('wod', {
    edition: 'vampire-v5',
    clan: 'Caitiff',
  });
  resetXpPricingConfig(v5Caitiff);
  v5Caitiff = updateFieldValue(v5Caitiff, 'f_presence', 0);
  const caitiffV5Pres = extractAllTraits(v5Caitiff).find((t) => t.key === 'presence');
  assert.equal(caitiffV5Pres?.disciplineAffinity, 'discipline_caitiff');
  assert.equal(caitiffV5Pres?.multiplier, 6);
  assert.equal(caitiffV5Pres?.cost, 6); // (0 + 1) * 6
});

test('Manual field xpCategory and workspace overrides take precedence over automatic clan affinity, with legacy fallbacks', () => {
  // 1. Explicit field.xpCategory override on Brujah (Dominate forced to clan, Potence forced to out-of-clan)
  let sheet = createNewSheetForSystem('wod', {
    edition: 'vampire-v5',
    clan: 'Brujah',
  });
  resetXpPricingConfig(sheet);
  sheet = {
    ...sheet,
    cards: sheet.cards.map((card) =>
      card.id === 'card_arcano'
        ? {
            ...card,
            fields: [
              {
                id: 'f_dominate',
                key: 'dominate',
                label: 'DOMINATE',
                kind: 'number',
                value: 1,
                xpCategory: 'discipline_clan',
              },
              {
                id: 'f_potence_manual',
                key: 'potence',
                label: 'POTENCE',
                kind: 'number',
                value: 1,
                xpCategory: 'discipline_out_of_clan',
              },
              {
                id: 'f_legacy_manual_disc',
                key: 'disc_x9a1',
                label: 'Rapidez',
                kind: 'number',
                value: 2,
              },
            ],
          }
        : card,
    ),
  };

  const traits = extractAllTraits(sheet);
  const dom = traits.find((t) => t.fieldId === 'f_dominate');
  const pot = traits.find((t) => t.fieldId === 'f_potence_manual');
  const legacyCelerity = traits.find((t) => t.fieldId === 'f_legacy_manual_disc');
  assert.equal(dom?.disciplineAffinity, 'discipline_clan');
  assert.equal(dom?.cost, 10); // 2 * 5
  assert.equal(pot?.disciplineAffinity, 'discipline_out_of_clan');
  assert.equal(pot?.cost, 14); // 2 * 7
  // Legacy fallback: random generated key matches localized label 'Rapidez' -> Brujah In-Clan ×5
  assert.equal(legacyCelerity?.disciplineAffinity, 'discipline_clan');
  assert.equal(legacyCelerity?.cost, 15); // 3 * 5

  // 2. Workspace toggle overrides auto-out-of-clan to in-clan without snapping back
  let brujahAuto = createNewSheetForSystem('wod', {
    edition: 'vampire-v5',
    clan: 'Brujah',
  });
  resetXpPricingConfig(brujahAuto);
  brujahAuto = updateFieldValue(brujahAuto, 'f_dominate', 1);
  assert.equal(
    extractAllTraits(brujahAuto).find((t) => t.fieldId === 'f_dominate')?.disciplineAffinity,
    'discipline_out_of_clan',
  );

  setTraitOutOfClan(brujahAuto, 'f_dominate', false);
  const overriddenInClan = extractAllTraits(brujahAuto).find((t) => t.fieldId === 'f_dominate');
  assert.equal(overriddenInClan?.disciplineAffinity, 'discipline_clan');
  assert.equal(overriddenInClan?.cost, 10);

  setTraitDisciplineAffinity(brujahAuto, 'f_dominate', 'discipline_caitiff');
  const overriddenCaitiff = extractAllTraits(brujahAuto).find((t) => t.fieldId === 'f_dominate');
  assert.equal(overriddenCaitiff?.disciplineAffinity, 'discipline_caitiff');
  assert.equal(overriddenCaitiff?.cost, 12); // 2 * 6

  // 3. Unknown/custom clan falls back to default ×5
  let customClanSheet = createNewSheetForSystem('wod', {
    edition: 'vampire-v5',
    clan: 'Baali',
  });
  resetXpPricingConfig(customClanSheet);
  customClanSheet = updateFieldValue(customClanSheet, 'f_dominate', 1);
  const customTrait = extractAllTraits(customClanSheet).find((t) => t.fieldId === 'f_dominate');
  assert.equal(customTrait?.disciplineAffinity, 'discipline_clan');
  assert.equal(customTrait?.cost, 10);
});

test('V20 exposes all 9 attributes, all 3 Virtues, Humanity (×2), and Willpower (×1), supporting Virtue upgrade and Undo', () => {
  const v20 = createDefaultSheet(); // 14 XP, virtues { conscience: 3, selfControl: 3, courage: 4 }
  resetXpPricingConfig(v20);

  const traits = extractAllTraits(v20, 'pt-BR');
  assert.equal(traits.filter((t) => t.category === 'attribute').length, 9);

  const wp = traits.find((t) => t.virtueSubtype === 'willpower');
  const hum = traits.find((t) => t.virtueSubtype === 'humanity');
  const conscience = traits.find((t) => t.fieldId === 'v20_virtue_conscience');
  const selfControl = traits.find((t) => t.fieldId === 'v20_virtue_self_control');
  const courage = traits.find((t) => t.fieldId === 'v20_virtue_courage');

  assert.equal(wp?.currentValue, 8);
  assert.equal(wp?.cost, 8); // 8 * 1
  assert.equal(hum?.currentValue, 7);
  assert.equal(hum?.cost, 14); // 7 * 2
  assert.equal(conscience?.currentValue, 3);
  assert.equal(conscience?.cost, 6); // 3 * 2
  assert.equal(selfControl?.currentValue, 3);
  assert.equal(selfControl?.cost, 6);
  assert.equal(courage?.currentValue, 4);
  assert.equal(courage?.cost, 8);

  const upg = upgradeTraitWithXp(v20, 'v20_virtue_conscience', '22:10', 'xp_virt_1', 'pt-BR');
  assert.equal(upg.ok, true);
  assert.equal(upg.sheet.virtues?.conscience, 4);
  assert.equal(getAvailableXp(upg.sheet.xp), 8);

  const undone = undoLastUpgrade(upg.sheet, 'pt-BR');
  assert.equal(undone.ok, true);
  assert.equal(undone.sheet.virtues?.conscience, 3);
  assert.equal(getAvailableXp(undone.sheet.xp), 14);
});

test('buyCatalogSkillWithXp acquires missing V20 & V5 skills (0 -> 1) and Undo atomically removes both number & roll fields', () => {
  // V20: Awareness missing on default sheet (3 XP, diff 6)
  let v20 = createDefaultSheet();
  resetXpPricingConfig(v20);
  const v20Missing = extractAcquirableTraits(v20, 'pt-BR').filter((t) => t.kind === 'skill');
  assert.ok(v20Missing.some((s) => s.varName === 'awareness' && s.cost === 3));
  assert.equal(v20Missing.some((s) => s.varName === 'brawl'), false);
  assert.equal(v20Missing.some((s) => s.varName === 'occult'), false);

  const v20Bought = buyCatalogSkillWithXp(v20, 'awareness', '22:15', 'xp_sk_v20', 'pt-BR');
  assert.equal(v20Bought.ok, true);
  assert.equal(v20Bought.cost, 3);
  assert.equal(getAvailableXp(v20Bought.sheet.xp), 11);
  const v20Num = v20Bought.sheet.cards.flatMap((c) => c.fields).find((f) => f.id === 'f_awareness');
  const v20Roll = v20Bought.sheet.cards.flatMap((c) => c.fields).find((f) => f.id === 'f_roll_awareness');
  assert.equal(v20Num?.value, 1);
  assert.equal(v20Num?.xpCategory, 'skill');
  assert.equal(v20Roll?.rollDifficulty, 6);
  assert.equal(v20Roll?.rollSpecialty, false);
  assert.equal(validateSheetPayload(v20Bought.sheet).valid, true);

  // Duplicate buy rejected
  const dupV20 = buyCatalogSkillWithXp(v20Bought.sheet, 'awareness', '22:16', 'xp_sk_dup', 'pt-BR');
  assert.equal(dupV20.ok, false);

  // Undo removes BOTH f_awareness and f_roll_awareness
  const v20Undone = undoLastUpgrade(v20Bought.sheet, 'pt-BR');
  assert.equal(v20Undone.ok, true);
  assert.equal(getAvailableXp(v20Undone.sheet.xp), 14);
  assert.equal(
    v20Undone.sheet.cards.flatMap((c) => c.fields).some((f) => f.id === 'f_awareness' || f.id === 'f_roll_awareness'),
    false,
  );

  // V5: Insight missing on V5 sample sheet (3 XP, diff 2, rollDifficultyV5: 2), even if card_skills was removed
  let v5 = createNewSheetForSystem('wod', { edition: 'vampire-v5', clan: 'Lasombra' });
  resetXpPricingConfig(v5);
  v5 = awardXp(v5, 10, 'Session', '22:18', 'xp_v5_init').sheet;
  v5 = { ...v5, cards: v5.cards.filter((c) => c.id !== 'card_skills') };

  const v5Bought = buyCatalogSkillWithXp(v5, 'insight', '22:20', 'xp_sk_v5', 'en');
  assert.equal(v5Bought.ok, true);
  assert.equal(v5Bought.cost, 3);
  assert.equal(getAvailableXp(v5Bought.sheet.xp), 7);
  assert.equal(v5Bought.sheet.cards.some((c) => c.id === 'card_skills'), true);
  const v5Roll = v5Bought.sheet.cards.flatMap((c) => c.fields).find((f) => f.id === 'f_roll_insight');
  assert.equal(v5Roll?.rollDifficulty, 2);
  assert.equal(v5Roll?.rollDifficultyV5, 2);
  assert.equal(validateSheetPayload(v5Bought.sheet).valid, true);

  const v5Undone = undoLastUpgrade(v5Bought.sheet, 'en');
  assert.equal(v5Undone.ok, true);
  assert.equal(getAvailableXp(v5Undone.sheet.xp), 10);
  assert.equal(v5Undone.sheet.cards.some((c) => c.id === 'card_skills'), false);
});

test('buyCatalogDisciplineWithXp respects Clan/Out-of-Clan/Caitiff pricing in V20 & V5, sorts In-Clan first, and Undo reverts', () => {
  // V20 Brujah: 0 -> 1 always 10 XP; In-Clan (celerity/potence/presence) sorted first
  let v20Brujah = createNewSheetForSystem('wod', { edition: 'storyteller-v20', clan: 'Brujah' });
  resetXpPricingConfig(v20Brujah);
  v20Brujah = awardXp(v20Brujah, 20, 'Init', '22:30', 'xp_b1').sheet;
  const v20Discs = extractAcquirableTraits(v20Brujah, 'pt-BR').filter((t) => t.kind === 'discipline');
  assert.ok(v20Discs.length > 0);
  assert.equal(v20Discs[0].isInClan, true);
  const v20Pot = v20Discs.find((d) => d.varName === 'potence');
  const v20Aus = v20Discs.find((d) => d.varName === 'auspex');
  assert.equal(v20Pot?.cost, 10);
  assert.equal(v20Pot?.disciplineAffinity, 'discipline_clan');
  assert.equal(v20Aus?.cost, 10);
  assert.equal(v20Aus?.disciplineAffinity, 'discipline_out_of_clan');

  const boughtV20 = buyCatalogDisciplineWithXp(v20Brujah, 'auspex', '22:31', 'xp_d_v20', 'pt-BR');
  assert.equal(boughtV20.ok, true);
  assert.equal(boughtV20.cost, 10);
  assert.equal(getAvailableXp(boughtV20.sheet.xp), 10);
  const undoneV20 = undoLastUpgrade(boughtV20.sheet, 'pt-BR');
  assert.equal(undoneV20.ok, true);
  assert.equal(getAvailableXp(undoneV20.sheet.xp), 20);
  assert.equal(
    undoneV20.sheet.cards.flatMap((c) => c.fields).some((f) => f.key === 'auspex'),
    false,
  );

  // V5 Brujah: In-Clan (celerity) = 5 XP, Out-of-Clan (auspex) = 7 XP
  let v5Brujah = createNewSheetForSystem('wod', { edition: 'vampire-v5', clan: 'Brujah' });
  resetXpPricingConfig(v5Brujah);
  v5Brujah = awardXp(v5Brujah, 20, 'Init', '22:32', 'xp_b2').sheet;
  const v5Discs = extractAcquirableTraits(v5Brujah, 'en').filter((t) => t.kind === 'discipline');
  assert.equal(v5Discs.find((d) => d.varName === 'celerity')?.cost, 5);
  assert.equal(v5Discs.find((d) => d.varName === 'auspex')?.cost, 7);

  const boughtClan = buyCatalogDisciplineWithXp(v5Brujah, 'celerity', '22:33', 'xp_d_v5_clan', 'en');
  assert.equal(boughtClan.ok, true);
  assert.equal(boughtClan.cost, 5);
  assert.equal(getAvailableXp(boughtClan.sheet.xp), 15);

  const boughtOut = buyCatalogDisciplineWithXp(boughtClan.sheet, 'auspex', '22:34', 'xp_d_v5_out', 'en');
  assert.equal(boughtOut.ok, true);
  assert.equal(boughtOut.cost, 7);
  assert.equal(getAvailableXp(boughtOut.sheet.xp), 8);

  const undoneOut = undoLastUpgrade(boughtOut.sheet, 'en');
  assert.equal(undoneOut.ok, true);
  assert.equal(getAvailableXp(undoneOut.sheet.xp), 15);
  assert.equal(
    undoneOut.sheet.cards.flatMap((c) => c.fields).some((f) => f.key === 'auspex'),
    false,
  );

  // V5 Caitiff: any new discipline = 6 XP
  let v5Caitiff = createNewSheetForSystem('wod', { edition: 'vampire-v5', clan: 'Caitiff' });
  resetXpPricingConfig(v5Caitiff);
  v5Caitiff = awardXp(v5Caitiff, 10, 'Init', '22:35', 'xp_c1').sheet;
  const caitiffDiscs = extractAcquirableTraits(v5Caitiff, 'pt-BR').filter((t) => t.kind === 'discipline');
  assert.equal(caitiffDiscs.find((d) => d.varName === 'celerity')?.cost, 6);
  const boughtCaitiff = buyCatalogDisciplineWithXp(v5Caitiff, 'celerity', '22:36', 'xp_d_caitiff', 'pt-BR');
  assert.equal(boughtCaitiff.ok, true);
  assert.equal(boughtCaitiff.cost, 6);
  assert.equal(getAvailableXp(boughtCaitiff.sheet.xp), 4);
});

test('buyCatalogAdvantageWithXp acquires official V20 & V5 advantages cleanly, preserves f_generation, and Undo reverts', () => {
  // V20 Generation background uses generation_bg without touching f_generation
  const v20 = createDefaultSheet(); // 14 XP
  resetXpPricingConfig(v20);
  const v20Advs = extractAcquirableTraits(v20, 'pt-BR').filter((t) => t.kind === 'advantage');
  assert.equal(v20Advs.length, 13);
  assert.ok(v20Advs.some((a) => a.catalogId === 'generation' && a.varName === 'generation_bg' && a.cost === 3));

  const boughtGen = buyCatalogAdvantageWithXp(v20, 'generation', '22:40', 'xp_adv_gen', 'pt-BR');
  assert.equal(boughtGen.ok, true);
  assert.equal(boughtGen.cost, 3);
  assert.equal(getAvailableXp(boughtGen.sheet.xp), 11);
  assert.equal(
    boughtGen.sheet.cards.flatMap((c) => c.fields).find((f) => f.id === 'f_generation')?.value,
    10,
  );
  const genBgField = boughtGen.sheet.cards
    .flatMap((c) => c.fields)
    .find((f) => f.id === boughtGen.fieldId);
  assert.equal(genBgField?.key, 'generation_bg');
  assert.equal(genBgField?.xpCategory, 'advantage');
  assert.equal(validateSheetPayload(boughtGen.sheet).valid, true);

  const undoneGen = undoLastUpgrade(boughtGen.sheet, 'pt-BR');
  assert.equal(undoneGen.ok, true);
  assert.equal(getAvailableXp(undoneGen.sheet.xp), 14);
  assert.equal(undoneGen.sheet.cards.some((c) => c.id === 'card_backgrounds'), false);

  // V5 Loresheet / Mawla (18 advantages total)
  let v5 = createNewSheetForSystem('wod', { edition: 'vampire-v5', clan: 'Lasombra' });
  resetXpPricingConfig(v5);
  v5 = awardXp(v5, 12, 'Session', '22:41', 'xp_v5_adv').sheet;
  const v5Advs = extractAcquirableTraits(v5, 'en').filter((t) => t.kind === 'advantage');
  assert.equal(v5Advs.length, 18);

  const boughtLore = buyCatalogAdvantageWithXp(v5, 'loresheet', '22:42', 'xp_adv_lore', 'en');
  assert.equal(boughtLore.ok, true);
  assert.equal(boughtLore.cost, 3);
  assert.equal(validateSheetPayload(boughtLore.sheet).valid, true);

  // Upgraded 1 -> 2 costs 2 * 3 = 6 XP in V5
  const upgLore = upgradeTraitWithXp(boughtLore.sheet, boughtLore.fieldId!, '22:43', 'xp_adv_lore_2', 'en');
  assert.equal(upgLore.ok, true);
  assert.equal(upgLore.trait?.cost, 6);
  assert.equal(getAvailableXp(upgLore.sheet.xp), 3);

  const undoUpgrade = undoLastUpgrade(upgLore.sheet, 'en');
  assert.equal(undoUpgrade.ok, true);
  assert.equal(getAvailableXp(undoUpgrade.sheet.xp), 9);

  const undoAcquire = undoLastUpgrade(undoUpgrade.sheet, 'en');
  assert.equal(undoAcquire.ok, true);
  assert.equal(getAvailableXp(undoAcquire.sheet.xp), 12);
  assert.equal(undoAcquire.sheet.cards.some((c) => c.id === 'card_backgrounds'), false);
});

test('V5 Blood Potency lists with New Level x 10 XP (1->2 = 20 XP, max 10), updates evaluated variables, and Undo reverts', () => {
  let v5 = createNewSheetForSystem('wod', { edition: 'vampire-v5', clan: 'Lasombra' });
  resetXpPricingConfig(v5);
  v5 = awardXp(v5, 55, 'Elder Vitae', '22:50', 'xp_bp_init').sheet;

  const traits1 = extractAllTraits(v5, 'pt-BR');
  const bp1 = traits1.find((t) => t.virtueSubtype === 'blood_potency');
  assert.ok(bp1, 'Expected Blood Potency in V5 traits');
  assert.equal(bp1.currentValue, 1);
  assert.equal(bp1.nextValue, 2);
  assert.equal(bp1.maxCap, 10);
  assert.equal(bp1.cost, 20); // 2 * 10
  assert.equal(bp1.isPossible, true);

  // Willpower & Humanity stay blocked in V5
  assert.equal(traits1.find((t) => t.virtueSubtype === 'willpower')?.isBlockedByRule, true);
  assert.equal(traits1.find((t) => t.virtueSubtype === 'humanity')?.isBlockedByRule, true);

  // V20 does NOT expose Blood Potency upgrade
  const v20Traits = extractAllTraits(createDefaultSheet(), 'pt-BR');
  assert.equal(v20Traits.some((t) => t.virtueSubtype === 'blood_potency'), false);

  const upg1 = upgradeTraitWithXp(v5, bp1.fieldId, '22:51', 'xp_bp_1', 'pt-BR');
  assert.equal(upg1.ok, true);
  assert.equal(getAvailableXp(upg1.sheet.xp), 35);
  assert.equal(evaluateSheet(upg1.sheet).variables.blood_potency, 2);
  assert.equal(validateSheetPayload(upg1.sheet).valid, true);

  const bp2 = extractAllTraits(upg1.sheet, 'pt-BR').find((t) => t.virtueSubtype === 'blood_potency');
  assert.equal(bp2?.currentValue, 2);
  assert.equal(bp2?.cost, 30); // 3 * 10

  const undone = undoLastUpgrade(upg1.sheet, 'pt-BR');
  assert.equal(undone.ok, true);
  assert.equal(getAvailableXp(undone.sheet.xp), 55);
  assert.equal(evaluateSheet(undone.sheet).variables.blood_potency, 1);
});

test('extractAcquirableTraits returns empty for non-WoD and custom preset sheets', () => {
  assert.deepEqual(extractAcquirableTraits(createDnd5ePreset()), []);
  assert.deepEqual(extractAcquirableTraits(createGenericD20Preset()), []);
  assert.deepEqual(extractAcquirableTraits(createNewSheetForSystem('blank')), []);

  const customWod = setXpRulePreset(createDefaultSheet(), 'custom');
  assert.deepEqual(extractAcquirableTraits(customWod), []);
});
