import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveDotClickValue,
  resolveDotKeyboardValue,
  resolveWodDotRatingConfig,
} from './dotRating.ts';
import type { SheetCard, SheetField } from '../core/sheetModel.ts';

test('resolveDotClickValue handles increasing, decreasing, active decrement, and min guards', () => {
  // Increase from 0 -> 3 and decrease from 4 -> 2
  assert.equal(resolveDotClickValue(0, 3, 0, 5), 3);
  assert.equal(resolveDotClickValue(4, 2, 0, 5), 2);

  // Clicking the currently active dot decrements N -> N-1
  assert.equal(resolveDotClickValue(3, 3, 0, 5), 2);
  assert.equal(resolveDotClickValue(5, 5, 0, 5), 4);
  assert.equal(resolveDotClickValue(1, 1, 0, 5), 0);

  // Protect min = 1 (e.g. V20 virtues or minimum 1 attributes)
  assert.equal(resolveDotClickValue(1, 1, 1, 5), 1);
  assert.equal(resolveDotClickValue(2, 2, 1, 5), 1);
  assert.equal(resolveDotClickValue(2, 0, 1, 5), 1);

  // Scale 0-10 and out-of-range clamping
  assert.equal(resolveDotClickValue(10, 10, 0, 10), 9);
  assert.equal(resolveDotClickValue(2, 8, 0, 5), 5);
  assert.equal(resolveDotClickValue(2, -3, 0, 5), 0);
});

test('resolveDotKeyboardValue handles arrow keys, Home, End, bounds, and ignores unrelated keys', () => {
  assert.equal(resolveDotKeyboardValue(2, 'ArrowRight', 0, 5), 3);
  assert.equal(resolveDotKeyboardValue(2, 'ArrowUp', 0, 5), 3);
  assert.equal(resolveDotKeyboardValue(5, 'ArrowRight', 0, 5), 5);

  assert.equal(resolveDotKeyboardValue(2, 'ArrowLeft', 0, 5), 1);
  assert.equal(resolveDotKeyboardValue(2, 'ArrowDown', 0, 5), 1);
  assert.equal(resolveDotKeyboardValue(0, 'ArrowLeft', 0, 5), 0);
  assert.equal(resolveDotKeyboardValue(1, 'ArrowLeft', 1, 5), 1);

  assert.equal(resolveDotKeyboardValue(4, 'Home', 0, 5), 0);
  assert.equal(resolveDotKeyboardValue(4, 'Home', 1, 5), 1);
  assert.equal(resolveDotKeyboardValue(2, 'End', 0, 5), 5);
  assert.equal(resolveDotKeyboardValue(2, 'End', 0, 10), 10);

  assert.equal(resolveDotKeyboardValue(3, 'Tab', 0, 5), null);
  assert.equal(resolveDotKeyboardValue(3, 'Enter', 0, 5), null);
  assert.equal(resolveDotKeyboardValue(3, ' ', 0, 5), null);
  assert.equal(resolveDotKeyboardValue(3, 'Escape', 0, 5), null);
  assert.equal(resolveDotKeyboardValue(3, 'a', 0, 5), null);
});

test('resolveWodDotRatingConfig enables 0-5 for V5/V20 Attributes, Skills, Disciplines, Virtues, and Backgrounds', () => {
  const attrCard: Pick<SheetCard, 'id' | 'code' | 'title'> = {
    id: 'card_atributos',
    code: '//ATTRIBUTES',
    title: 'PHYSICAL · SOCIAL · MENTAL',
  };
  const skillCard: Pick<SheetCard, 'id' | 'code' | 'title'> = {
    id: 'card_skills',
    code: '//SKILLS_&_POOLS',
    title: 'ABILITIES & DICE POOLS',
  };
  const discCard: Pick<SheetCard, 'id' | 'code' | 'title'> = {
    id: 'card_arcano',
    code: '//DISCIPLINES',
    title: 'DISCIPLINES & OCCULT',
  };
  const bgCard: Pick<SheetCard, 'id' | 'code' | 'title'> = {
    id: 'card_backgrounds',
    code: '//ANTECEDENTES',
    title: 'ANTECEDENTES & VANTAGENS',
  };

  const strength: SheetField = {
    id: 'f_strength',
    key: 'strength',
    label: 'STRENGTH',
    kind: 'number',
    attributeGroup: 'physical',
    value: 3,
  };
  const brawl: SheetField = {
    id: 'f_brawl',
    key: 'brawl',
    label: 'BRAWL',
    kind: 'number',
    value: 2,
  };
  const dominate: SheetField = {
    id: 'f_dominate',
    key: 'dominate',
    label: 'DOMINATE',
    kind: 'number',
    value: 3,
  };
  const conscience: SheetField = {
    id: 'f_conscience',
    key: 'conscience',
    label: 'CONSCIENCE',
    kind: 'number',
    value: 3,
  };
  const resourcesBg: SheetField = {
    id: 'f_bg_resources',
    key: 'resources',
    label: 'RESOURCES',
    kind: 'number',
    value: 2,
    max: 5,
  };

  for (const preset of ['storyteller-v20', 'vampire-v5'] as const) {
    assert.deepEqual(
      resolveWodDotRatingConfig(strength, attrCard, preset, 'wod'),
      { enabled: true, min: 0, max: 5 },
    );
    assert.deepEqual(
      resolveWodDotRatingConfig(brawl, skillCard, preset, 'wod'),
      { enabled: true, min: 0, max: 5 },
    );
    assert.deepEqual(
      resolveWodDotRatingConfig(dominate, discCard, preset, 'wod'),
      { enabled: true, min: 0, max: 5 },
    );
    assert.deepEqual(
      resolveWodDotRatingConfig(conscience, null, preset, 'wod'),
      { enabled: true, min: 0, max: 5 },
    );
    assert.deepEqual(
      resolveWodDotRatingConfig(resourcesBg, bgCard, preset, 'wod'),
      { enabled: true, min: 0, max: 5 },
    );
  }
});

test('resolveWodDotRatingConfig resolves 0-10 scale for Humanity, base Willpower, and Elder traits with max 6..10', () => {
  const combatCard: Pick<SheetCard, 'id' | 'code' | 'title'> = {
    id: 'card_combate',
    code: '//VITAL_STATUS',
    title: 'HEALTH · WILLPOWER · HUNGER',
  };
  const attrCard: Pick<SheetCard, 'id' | 'code' | 'title'> = {
    id: 'card_atributos',
    code: '//ATTRIBUTES',
    title: 'PHYSICAL · SOCIAL · MENTAL',
  };
  const discCard: Pick<SheetCard, 'id' | 'code' | 'title'> = {
    id: 'card_arcano',
    code: '//DISCIPLINES',
    title: 'DISCIPLINES & OCCULT',
  };

  const humanityResource: SheetField = {
    id: 'f_humanity',
    key: 'humanity',
    label: 'HUMANITY',
    kind: 'resource',
    value: 7,
    max: 10,
  };
  const pathNumeric: SheetField = {
    id: 'f_path_ent',
    key: 'trilha',
    label: 'TRILHA',
    kind: 'number',
    value: 6,
  };
  const willpowerBaseNumeric: SheetField = {
    id: 'f_wp_base',
    key: 'willpower_base',
    label: 'WILLPOWER BASE',
    kind: 'number',
    value: 7,
  };
  const elderAttr: SheetField = {
    id: 'f_strength',
    key: 'strength',
    label: 'STRENGTH',
    kind: 'number',
    attributeGroup: 'physical',
    value: 7,
    max: 8,
  };
  const elderDisc: SheetField = {
    id: 'f_dominate',
    key: 'dominate',
    label: 'DOMINATE',
    kind: 'number',
    value: 6,
    max: 6,
  };

  assert.deepEqual(
    resolveWodDotRatingConfig(humanityResource, combatCard, 'vampire-v5', 'wod'),
    { enabled: true, min: 0, max: 10 },
  );
  assert.deepEqual(
    resolveWodDotRatingConfig(humanityResource, combatCard, 'storyteller-v20', 'wod'),
    { enabled: true, min: 0, max: 10 },
  );
  assert.deepEqual(
    resolveWodDotRatingConfig(pathNumeric, combatCard, 'storyteller-v20', 'wod'),
    { enabled: true, min: 0, max: 10 },
  );
  assert.deepEqual(
    resolveWodDotRatingConfig(willpowerBaseNumeric, combatCard, 'storyteller-v20', 'wod'),
    { enabled: true, min: 0, max: 10 },
  );
  assert.deepEqual(
    resolveWodDotRatingConfig(elderAttr, attrCard, 'storyteller-v20', 'wod'),
    { enabled: true, min: 0, max: 10 },
  );
  assert.deepEqual(
    resolveWodDotRatingConfig(elderDisc, discCard, 'storyteller-v20', 'wod'),
    { enabled: true, min: 0, max: 10 },
  );
});

test('resolveWodDotRatingConfig excludes custom, non-WoD systems, text/calculated/repeatable, tracks, and max > 10', () => {
  const attrCard: Pick<SheetCard, 'id' | 'code' | 'title'> = {
    id: 'card_atributos',
    code: '//ATTRIBUTES',
    title: 'PHYSICAL · SOCIAL · MENTAL',
  };
  const dndAttrCard: Pick<SheetCard, 'id' | 'code' | 'title'> = {
    id: 'card_atributos',
    code: '//ABILITY_SCORES',
    title: 'ATTRIBUTES & MODIFIERS',
  };

  const strength: SheetField = {
    id: 'f_strength',
    key: 'strength',
    label: 'STRENGTH',
    kind: 'number',
    value: 3,
  };

  // Non-WoD presets & systems
  assert.equal(resolveWodDotRatingConfig(strength, attrCard, 'custom', 'wod').enabled, false);
  assert.equal(
    resolveWodDotRatingConfig(strength, attrCard, 'storyteller-v20', 'dnd5e').enabled,
    false,
  );
  assert.equal(
    resolveWodDotRatingConfig(strength, attrCard, 'storyteller-v20', 'cyberpunk').enabled,
    false,
  );
  assert.equal(
    resolveWodDotRatingConfig(strength, attrCard, 'storyteller-v20', 'blank').enabled,
    false,
  );
  assert.equal(
    resolveWodDotRatingConfig(strength, dndAttrCard, 'storyteller-v20').enabled,
    false,
  );

  // Non-rating field kinds & ignored WoD fields
  const textField: SheetField = { id: 'f_concept', key: 'concept', label: 'CONCEPT', kind: 'text', value: 'Fixer' };
  const calcField: SheetField = { id: 'f_init', key: 'initiative', label: 'INITIATIVE', kind: 'calculated', formula: 'dexterity + wits' };
  const repField: SheetField = { id: 'f_powers', key: 'powers', label: 'POWERS', kind: 'repeatable', rows: [] };
  const boolField: SheetField = { id: 'f_wp_boost', key: 'wp_boost', label: 'WP', kind: 'boolean', value: false };
  const rollField: SheetField = { id: 'f_roll_brawl', key: 'roll_brawl', label: 'BRAWL', kind: 'roll', rollExpr: 'pool(strength + brawl, 6)' };
  const generationField: SheetField = { id: 'f_generation', key: 'generation', label: 'GENERATION', kind: 'number', value: 10 };
  const armorField: SheetField = { id: 'f_fortitude_armor', key: 'fortitude_armor', label: 'FORTITUDE / ARMOR', kind: 'number', value: 0 };
  const healthTrack: SheetField = { id: 'f_health', key: 'health', label: 'HEALTH', kind: 'resource', value: 7, max: 7, damageTrack: true };
  const hungerTrack: SheetField = { id: 'f_hunger', key: 'hunger', label: 'HUNGER', kind: 'resource', value: 1, max: 5 };
  const willpowerResource: SheetField = { id: 'f_willpower', key: 'willpower', label: 'WILLPOWER', kind: 'resource', value: 6, max: 8 };
  const bloodPoolLarge: SheetField = { id: 'f_bp', key: 'blood_pool', label: 'BLOOD POOL', kind: 'resource', value: 10, max: 13 };
  const elderBloodPool: SheetField = { id: 'f_bp2', key: 'custom_pool', label: 'CUSTOM POOL', kind: 'number', value: 12, max: 50 };

  for (const field of [
    textField,
    calcField,
    repField,
    boolField,
    rollField,
    generationField,
    armorField,
    healthTrack,
    hungerTrack,
    willpowerResource,
    bloodPoolLarge,
    elderBloodPool,
  ]) {
    assert.equal(
      resolveWodDotRatingConfig(field, attrCard, 'vampire-v5', 'wod').enabled,
      false,
      `Expected ${field.id} to be excluded`,
    );
  }
});
