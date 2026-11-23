import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeWodComposedPool,
  extractWodRollableTraits,
} from './wodPoolComposer.ts';
import {
  createWorldOfDarknessSheet,
  createWorldOfDarknessV5Sheet,
} from '../core/sheetModel.ts';

test('extractWodRollableTraits extracts grouped V20 3x3 attributes, skills, disciplines, and virtues while ignoring resources/text/calculated', () => {
  const sheet = createWorldOfDarknessSheet();
  const brawlRoll = sheet.cards
    .flatMap((c) => c.fields)
    .find((f) => f.id === 'f_roll_brawl')!;
  brawlRoll.rollSpecialty = true;
  brawlRoll.hint = 'Grappling';

  // Add a background card to verify backgrounds are not mixed into virtues
  sheet.cards.push({
    id: 'card_backgrounds',
    tab: 'geral',
    code: '//ANTECEDENTES',
    title: 'ANTECEDENTES & VANTAGENS',
    colSpan: 1,
    fields: [{ id: 'f_bg_resources', key: 'resources', label: 'RESOURCES', kind: 'number', value: 3, max: 5 }],
  });

  const groups = extractWodRollableTraits(sheet, 'pt-BR');
  assert.deepEqual(
    groups.attributes.map((t) => t.key),
    [
      'strength',
      'dexterity',
      'stamina',
      'charisma',
      'manipulation',
      'appearance',
      'perception',
      'intelligence',
      'wits',
    ],
  );
  assert.deepEqual(
    groups.skills.map((t) => t.key),
    ['brawl', 'firearms', 'stealth', 'subterfuge', 'occult'],
  );
  assert.deepEqual(
    groups.disciplines.map((t) => t.key),
    ['dominate', 'presence'],
  );
  assert.deepEqual(
    groups.virtues.map((t) => ({ key: t.key, label: t.label, value: t.value })),
    [
      { key: 'conscience', label: 'CONSCIÊNCIA', value: 3 },
      { key: 'self_control', label: 'AUTOCONTROLE', value: 3 },
      { key: 'courage', label: 'CORAGEM', value: 4 },
    ],
  );

  const brawl = groups.skills.find((t) => t.key === 'brawl');
  assert.equal(brawl?.specialty, true);
  assert.equal(brawl?.specialtyLabel, 'Grappling');

  const allKeys = new Set(groups.all.map((t) => t.key));
  for (const excludedKey of [
    'character_name',
    'clan',
    'generation',
    'blood_potency',
    'health',
    'willpower',
    'hunger',
    'humanity',
    'fortitude_armor',
    'wp_boost',
    'soak_roll',
    'gear',
    'powers',
    'resources',
  ]) {
    assert.equal(allKeys.has(excludedKey), false, `Expected ${excludedKey} to be excluded`);
  }
});

test('extractWodRollableTraits extracts V5 traits without synthetic V20 virtues', () => {
  const v5Sheet = createWorldOfDarknessV5Sheet();
  const groups = extractWodRollableTraits(v5Sheet, 'en');

  assert.equal(groups.attributes.length, 9);
  assert.equal(groups.attributes.some((t) => t.key === 'composure'), true);
  assert.equal(groups.attributes.some((t) => t.key === 'resolve'), true);
  assert.equal(groups.virtues.length, 0);
  assert.ok(groups.skills.length >= 4);
  assert.ok(groups.disciplines.length >= 2);
});

test('computeWodComposedPool handles V20 wound penalties, ignoreWoundPenalty, clamp to 0, specialty, and willpower', () => {
  const dex = { label: 'DEXTERITY', value: 3 };
  const stealth = { label: 'STEALTH', value: 2 };

  // Wound penalty -1, -2, -5
  const hurt = computeWodComposedPool({
    rulePreset: 'storyteller-v20',
    primaryTrait: dex,
    secondaryTrait: stealth,
    woundPenalty: -1,
  });
  assert.equal(hurt.rawPool, 5);
  assert.equal(hurt.appliedWoundPenalty, -1);
  assert.equal(hurt.effectivePool, 4);
  assert.equal(hurt.hungerDiceCount, 0);
  assert.equal(hurt.normalDiceCount, 4);
  assert.equal(hurt.difficulty, 6);
  assert.equal(hurt.formulaSummary, '4d10 @ DIFF 6');

  const mauled = computeWodComposedPool({
    rulePreset: 'storyteller-v20',
    primaryTrait: dex,
    secondaryTrait: stealth,
    woundPenalty: -2,
    modifier: 2,
    specialty: true,
    useWillpower: true,
    willpowerAvailable: 4,
    difficulty: 7,
  });
  assert.equal(mauled.rawPool, 7);
  assert.equal(mauled.effectivePool, 5);
  assert.equal(mauled.specialty, true);
  assert.equal(mauled.useWillpower, true);
  assert.equal(mauled.formulaSummary, '5d10 @ DIFF 7 · SPEC · +1 WP');

  // Crippled -5 reduces 4 -> 0, unless ignoreWoundPenalty is enabled
  const crippledBlocked = computeWodComposedPool({
    rulePreset: 'storyteller-v20',
    primaryTrait: { label: 'WITS', value: 2 },
    secondaryTrait: { label: 'ALERTNESS', value: 2 },
    woundPenalty: -5,
    useWillpower: false,
  });
  assert.equal(crippledBlocked.effectivePool, 0);
  assert.equal(crippledBlocked.isIncapacitated, true);
  assert.equal(crippledBlocked.canRoll, false);

  const crippledWithWp = computeWodComposedPool({
    rulePreset: 'storyteller-v20',
    primaryTrait: { label: 'WITS', value: 2 },
    secondaryTrait: { label: 'ALERTNESS', value: 2 },
    woundPenalty: -5,
    useWillpower: true,
    willpowerAvailable: 1,
  });
  assert.equal(crippledWithWp.effectivePool, 0);
  assert.equal(crippledWithWp.useWillpower, true);
  assert.equal(crippledWithWp.canRoll, true);

  const wpEmpty = computeWodComposedPool({
    rulePreset: 'storyteller-v20',
    primaryTrait: { label: 'WITS', value: 2 },
    secondaryTrait: { label: 'ALERTNESS', value: 2 },
    woundPenalty: -5,
    useWillpower: true,
    willpowerAvailable: 0,
  });
  assert.equal(wpEmpty.useWillpower, false);
  assert.equal(wpEmpty.canRoll, false);

  const exempted = computeWodComposedPool({
    rulePreset: 'storyteller-v20',
    primaryTrait: { label: 'COURAGE', value: 4 },
    secondaryTrait: null,
    woundPenalty: -5,
    ignoreWoundPenalty: true,
  });
  assert.equal(exempted.appliedWoundPenalty, 0);
  assert.equal(exempted.effectivePool, 4);
  assert.equal(exempted.canRoll, true);
});

test('computeWodComposedPool handles V5 Blood Surge, Impaired (-2), and Hunger Dice splitting/capping', () => {
  const poolWithSurge = computeWodComposedPool({
    rulePreset: 'vampire-v5',
    primaryTrait: { label: 'STRENGTH', value: 4, group: 'attributes', attributeGroup: 'physical' },
    secondaryTrait: { label: 'BRAWL', value: 3, group: 'skills' },
    modifier: -1,
    woundPenalty: -2,
    bloodSurgeActive: true,
    bloodPotency: 3, // +3 dice
    hunger: 2,
    difficulty: 3,
    specialty: true, // ignored in V5
    useWillpower: true, // ignored in V5
  });

  // 4 + 3 - 1 + 3 (surge) = 9 raw - 2 health impaired (physical) = 7 effective; 2 hunger + 5 normal
  assert.equal(poolWithSurge.bloodSurgeApplied, true);
  assert.equal(poolWithSurge.bloodSurgeBonus, 3);
  assert.equal(poolWithSurge.powerBonusDiceApplied, 0);
  assert.equal(poolWithSurge.rawPool, 9);
  assert.equal(poolWithSurge.appliedWoundPenalty, -2);
  assert.equal(poolWithSurge.effectivePool, 7);
  assert.equal(poolWithSurge.hungerDiceCount, 2);
  assert.equal(poolWithSurge.normalDiceCount, 5);
  assert.equal(poolWithSurge.specialty, false);
  assert.equal(poolWithSurge.useWillpower, false);
  assert.equal(poolWithSurge.difficulty, 3);
  assert.equal(poolWithSurge.formulaSummary, '7d10 (2 FOME) · META 3');

  // When hunger exceeds effectivePool, hungerDiceCount is capped at effectivePool
  const cappedHunger = computeWodComposedPool({
    rulePreset: 'vampire-v5',
    primaryTrait: { label: 'STRENGTH', value: 2 },
    secondaryTrait: null,
    hunger: 4,
    difficulty: 2,
  });
  assert.equal(cappedHunger.effectivePool, 2);
  assert.equal(cappedHunger.hungerDiceCount, 2);
  assert.equal(cappedHunger.normalDiceCount, 0);
});

test('computeWodComposedPool supports all free trait combinations, single trait, and clamped modifiers', () => {
  const attrDisc = computeWodComposedPool({
    rulePreset: 'storyteller-v20',
    primaryTrait: { label: 'MANIPULATION', value: 4 },
    secondaryTrait: { label: 'DOMINATE', value: 3 },
    modifier: 1,
  });
  assert.equal(attrDisc.effectivePool, 8);
  assert.equal(attrDisc.displayLabel, 'MANIPULATION (4) + DOMINATE (3) +1');

  const attrVirtue = computeWodComposedPool({
    rulePreset: 'storyteller-v20',
    primaryTrait: { label: 'STAMINA', value: 3 },
    secondaryTrait: { label: 'CORAGEM', value: 4 },
    modifier: -2,
  });
  assert.equal(attrVirtue.effectivePool, 5);
  assert.equal(attrVirtue.displayLabel, 'STAMINA (3) + CORAGEM (4) -2');

  const singleClamped = computeWodComposedPool({
    rulePreset: 'vampire-v5',
    primaryTrait: { label: 'RESOLVE', value: 3 },
    secondaryTrait: null,
    modifier: -15, // clamped to -10
    hunger: 1,
  });
  assert.equal(singleClamped.modifier, -10);
  assert.equal(singleClamped.effectivePool, 0);
  assert.equal(singleClamped.hungerDiceCount, 0);
  assert.equal(singleClamped.displayLabel, 'RESOLVE (3) -10');
});

test('computeWodComposedPool handles V5 isWillpowerImpaired without double-stacking Health Impaired', () => {
  // 1) Willpower Impaired alone applies -2 in V5 Social/Mental pools
  const wpOnly = computeWodComposedPool({
    rulePreset: 'vampire-v5',
    primaryTrait: { label: 'CHARISMA', value: 3 },
    secondaryTrait: { label: 'PERSUASION', value: 3 },
    woundPenalty: 0,
    isWillpowerImpaired: true,
    hunger: 1,
  });
  assert.equal(wpOnly.rawPool, 6);
  assert.equal(wpOnly.isWillpowerImpaired, true);
  assert.equal(wpOnly.willpowerImpairedApplied, true);
  assert.equal(wpOnly.impairedPenaltySource, 'willpower');
  assert.equal(wpOnly.appliedWoundPenalty, -2);
  assert.equal(wpOnly.effectivePool, 4);

  // 2) On mixed Physical + Social/Mental pools, Health Impaired (-2) + Willpower Impaired MUST NOT stack to -4
  const bothImpaired = computeWodComposedPool({
    rulePreset: 'vampire-v5',
    primaryTrait: { label: 'DEXTERITY', value: 3, group: 'attributes', attributeGroup: 'physical' },
    secondaryTrait: { label: 'PERSUASION', value: 3, group: 'skills' },
    woundPenalty: -2,
    isWillpowerImpaired: true,
    hunger: 1,
  });
  assert.equal(bothImpaired.poolDomain, 'mixed');
  assert.equal(bothImpaired.isWillpowerImpaired, true);
  assert.equal(bothImpaired.healthImpairedApplied, true);
  assert.equal(bothImpaired.willpowerImpairedApplied, false);
  assert.equal(bothImpaired.impairedPenaltySource, 'both');
  assert.equal(bothImpaired.appliedWoundPenalty, -2);
  assert.equal(bothImpaired.effectivePool, 4);

  // 3) Exemption clears both penalties
  const exemptedBoth = computeWodComposedPool({
    rulePreset: 'vampire-v5',
    primaryTrait: { label: 'DEXTERITY', value: 3, group: 'attributes', attributeGroup: 'physical' },
    secondaryTrait: { label: 'PERSUASION', value: 3, group: 'skills' },
    woundPenalty: -2,
    isWillpowerImpaired: true,
    ignoreWoundPenalty: true,
  });
  assert.equal(exemptedBoth.appliedWoundPenalty, 0);
  assert.equal(exemptedBoth.healthImpairedApplied, false);
  assert.equal(exemptedBoth.willpowerImpairedApplied, false);
  assert.equal(exemptedBoth.impairedPenaltySource, 'both');
  assert.equal(exemptedBoth.effectivePool, 6);

  // 4) V20 ignores isWillpowerImpaired
  const v20Ignored = computeWodComposedPool({
    rulePreset: 'storyteller-v20',
    primaryTrait: { label: 'CHARISMA', value: 3 },
    secondaryTrait: { label: 'SUBTERFUGE', value: 3 },
    woundPenalty: 0,
    isWillpowerImpaired: true,
  });
  assert.equal(v20Ignored.isWillpowerImpaired, false);
  assert.equal(v20Ignored.willpowerImpairedApplied, false);
  assert.equal(v20Ignored.impairedPenaltySource, 'none');
  assert.equal(v20Ignored.appliedWoundPenalty, 0);
  assert.equal(v20Ignored.effectivePool, 6);
});

test('computeWodComposedPool adds V5 powerBonusDice only for Discipline pools in vampire-v5', () => {
  const manipulation = {
    key: 'manipulation',
    label: 'MANIPULAÇÃO',
    value: 4,
    group: 'attributes' as const,
    attributeGroup: 'social' as const,
  };
  const dominate = {
    key: 'dominate',
    label: 'DOMINAÇÃO',
    value: 3,
    group: 'disciplines' as const,
  };

  const bp0 = computeWodComposedPool({
    rulePreset: 'vampire-v5',
    primaryTrait: manipulation,
    secondaryTrait: dominate,
    bloodPotency: 0,
  });
  assert.equal(bp0.powerBonusDiceApplied, 0);
  assert.equal(bp0.rawPool, 7);
  assert.equal(bp0.effectivePool, 7);
  assert.equal(bp0.displayLabel, 'MANIPULAÇÃO (4) + DOMINAÇÃO (3)');

  const bp2 = computeWodComposedPool({
    rulePreset: 'vampire-v5',
    primaryTrait: manipulation,
    secondaryTrait: dominate,
    bloodPotency: 2,
  });
  assert.equal(bp2.powerBonusDiceApplied, 1);
  assert.equal(bp2.rawPool, 8);
  assert.equal(bp2.effectivePool, 8);
  assert.equal(bp2.displayLabel, 'MANIPULAÇÃO (4) + DOMINAÇÃO (3) +1 PODER');

  const bp4 = computeWodComposedPool({
    rulePreset: 'vampire-v5',
    primaryTrait: manipulation,
    secondaryTrait: dominate,
    bloodPotency: 4,
    labels: { powerTag: 'POWER' },
  });
  assert.equal(bp4.powerBonusDiceApplied, 2);
  assert.equal(bp4.rawPool, 9);
  assert.equal(bp4.effectivePool, 9);
  assert.equal(bp4.displayLabel, 'MANIPULAÇÃO (4) + DOMINAÇÃO (3) +2 POWER');

  // Attribute + Skill without disciplines must receive 0 power bonus even at high Blood Potency
  const nonDiscipline = computeWodComposedPool({
    rulePreset: 'vampire-v5',
    primaryTrait: { key: 'charisma', label: 'CARISMA', value: 3, group: 'attributes', attributeGroup: 'social' },
    secondaryTrait: { key: 'persuasion', label: 'PERSUASÃO', value: 3, group: 'skills' },
    bloodPotency: 4,
  });
  assert.equal(nonDiscipline.powerBonusDiceApplied, 0);
  assert.equal(nonDiscipline.effectivePool, 6);

  // V20 ignores V5 Blood Potency powerBonusDice even when discipline is selected
  const v20Discipline = computeWodComposedPool({
    rulePreset: 'storyteller-v20',
    primaryTrait: manipulation,
    secondaryTrait: dominate,
    bloodPotency: 4,
  });
  assert.equal(v20Discipline.powerBonusDiceApplied, 0);
  assert.equal(v20Discipline.effectivePool, 7);
});

test('computeWodComposedPool scopes V5 Willpower Impaired (-2) to Social/Mental and Health Impaired (-2) to Physical', () => {
  // Social pool penalized by Willpower Impaired
  const socialWpImpaired = computeWodComposedPool({
    rulePreset: 'vampire-v5',
    primaryTrait: { key: 'charisma', label: 'CARISMA', value: 3, group: 'attributes', attributeGroup: 'social' },
    secondaryTrait: { key: 'persuasion', label: 'PERSUASÃO', value: 2, group: 'skills' },
    woundPenalty: 0,
    isWillpowerImpaired: true,
  });
  assert.equal(socialWpImpaired.poolDomain, 'social_mental');
  assert.equal(socialWpImpaired.appliedWoundPenalty, -2);
  assert.equal(socialWpImpaired.willpowerImpairedApplied, true);
  assert.equal(socialWpImpaired.effectivePool, 3);

  // Mental pool penalized by Willpower Impaired
  const mentalWpImpaired = computeWodComposedPool({
    rulePreset: 'vampire-v5',
    primaryTrait: { key: 'intelligence', label: 'INTELIGÊNCIA', value: 4, group: 'attributes', attributeGroup: 'mental' },
    secondaryTrait: { key: 'investigation', label: 'INVESTIGAÇÃO', value: 2, group: 'skills' },
    woundPenalty: 0,
    isWillpowerImpaired: true,
  });
  assert.equal(mentalWpImpaired.poolDomain, 'social_mental');
  assert.equal(mentalWpImpaired.appliedWoundPenalty, -2);
  assert.equal(mentalWpImpaired.willpowerImpairedApplied, true);
  assert.equal(mentalWpImpaired.effectivePool, 4);

  // Purely Physical pools (Força + Briga, Destreza + Furtividade) must NOT receive -2 from Willpower Impaired
  const strengthBrawl = computeWodComposedPool({
    rulePreset: 'vampire-v5',
    primaryTrait: { key: 'strength', label: 'FORÇA', value: 4, group: 'attributes', attributeGroup: 'physical' },
    secondaryTrait: { key: 'brawl', label: 'BRIGA', value: 3, group: 'skills' },
    woundPenalty: 0,
    isWillpowerImpaired: true,
  });
  assert.equal(strengthBrawl.poolDomain, 'physical');
  assert.equal(strengthBrawl.appliedWoundPenalty, 0);
  assert.equal(strengthBrawl.willpowerImpairedApplied, false);
  assert.equal(strengthBrawl.impairedPenaltySource, 'none');
  assert.equal(strengthBrawl.effectivePool, 7);

  const dexStealthByLabelsOnly = computeWodComposedPool({
    rulePreset: 'vampire-v5',
    primaryTrait: { label: 'DESTREZA', value: 3 },
    secondaryTrait: { label: 'FURTIVIDADE', value: 2 },
    woundPenalty: 0,
    isWillpowerImpaired: true,
  });
  assert.equal(dexStealthByLabelsOnly.poolDomain, 'physical');
  assert.equal(dexStealthByLabelsOnly.appliedWoundPenalty, 0);
  assert.equal(dexStealthByLabelsOnly.effectivePool, 5);

  // Purely Social/Mental pool must NOT receive -2 from Health Impaired alone
  const socialWithHealthImpairedOnly = computeWodComposedPool({
    rulePreset: 'vampire-v5',
    primaryTrait: { key: 'charisma', label: 'CARISMA', value: 3, group: 'attributes', attributeGroup: 'social' },
    secondaryTrait: { key: 'persuasion', label: 'PERSUASÃO', value: 2, group: 'skills' },
    woundPenalty: -2,
    isWillpowerImpaired: false,
  });
  assert.equal(socialWithHealthImpairedOnly.poolDomain, 'social_mental');
  assert.equal(socialWithHealthImpairedOnly.appliedWoundPenalty, 0);
  assert.equal(socialWithHealthImpairedOnly.healthImpairedApplied, false);
  assert.equal(socialWithHealthImpairedOnly.effectivePool, 5);
});
