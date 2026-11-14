import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addCardToSheet,
  addFieldToCard,
  addRepeatableRow,
  adjustResourceValue,
  createBlankSheet,
  createDefaultSheet,
  createDnd5ePreset,
  createGenericD20Preset,
  createPresetBySystemId,
  detectSystemId,
  evaluateSheet,
  removeCardFromSheet,
  removeRepeatableRow,
  resolveRollPreview,
  updateCardSchema,
  updateFieldSchema,
  updateFieldValue,
} from './sheetModel';

test('World of Darkness default sheet computes derived traits and d10 pools dynamically', () => {
  let sheet = createDefaultSheet();
  const eval1 = evaluateSheet(sheet);
  assert.equal(eval1.computedByFieldId['f_blood_potency'].formatted, '3');
  assert.equal(eval1.computedByFieldId['f_initiative'].formatted, '+7');
  assert.equal(eval1.computedByFieldId['f_defense'].formatted, '3');
  assert.equal(eval1.formulaErrors.length, 0);
  assert.equal(resolveRollPreview('pool(strength + brawl + wp_boost, 6)', eval1.variables), '5d10 @ DIFF 6');

  // Spend Willpower (+1 die) and raise Strength from 3 -> 4
  sheet = updateFieldValue(sheet, 'f_strength', 4);
  sheet = updateFieldValue(sheet, 'f_wp_boost', true);
  const eval2 = evaluateSheet(sheet);
  assert.equal(resolveRollPreview('pool(strength + brawl + wp_boost, 6)', eval2.variables), '7d10 @ DIFF 6');
});

test('D&D 5e preset computes ability modifiers, AC, spell DC, and switches cleanly', () => {
  const dnd = createDnd5ePreset();
  assert.equal(detectSystemId(dnd), 'dnd5e');
  const evalDnd = evaluateSheet(dnd);
  assert.equal(evalDnd.formulaErrors.length, 0);
  assert.equal(evalDnd.computedByFieldId['f_prof'].formatted, '+3');
  assert.equal(evalDnd.computedByFieldId['f_mod_str'].formatted, '+3');
  assert.equal(evalDnd.computedByFieldId['f_ac'].formatted, '18');
  assert.equal(evalDnd.computedByFieldId['f_spell_dc'].formatted, '13');
  assert.equal(resolveRollPreview('1d20 + mod_str + prof', evalDnd.variables), '1d20 + 3 + 3');

  assert.equal(detectSystemId(createPresetBySystemId('wod')), 'wod');
  assert.equal(detectSystemId(createPresetBySystemId('dnd5e')), 'dnd5e');
  assert.equal(detectSystemId(createPresetBySystemId('cyberpunk')), 'cyberpunk');
});

test('adjustResourceValue clamps Blood Pool and Health within [0, max]', () => {
  let sheet = createDefaultSheet();
  sheet = adjustResourceValue(sheet, 'f_blood_pool', -4);
  const bloodAfterSpend = sheet.cards
    .flatMap((c) => c.fields)
    .find((f) => f.id === 'f_blood_pool');
  assert.equal(bloodAfterSpend?.value, 5);

  sheet = adjustResourceValue(sheet, 'f_blood_pool', 99);
  const bloodAfterFeed = sheet.cards
    .flatMap((c) => c.fields)
    .find((f) => f.id === 'f_blood_pool');
  assert.equal(bloodAfterFeed?.value, 13);

  sheet = adjustResourceValue(sheet, 'f_health', -50);
  const healthZero = sheet.cards
    .flatMap((c) => c.fields)
    .find((f) => f.id === 'f_health');
  assert.equal(healthZero?.value, 0);
});

test('repeatable gear rows add, remove, and recalculate weight', () => {
  let sheet = createDefaultSheet();
  const initialEval = evaluateSheet(sheet);
  assert.equal(initialEval.totalCargoWeight, 4.5);

  sheet = addRepeatableRow(sheet, 'f_mochila', 'r_new');
  const evalAfterAdd = evaluateSheet(sheet);
  assert.equal(evalAfterAdd.totalCargoWeight, 5.5);

  sheet = removeRepeatableRow(sheet, 'f_mochila', 'r_2');
  const evalAfterRemove = evaluateSheet(sheet);
  assert.equal(evalAfterRemove.totalCargoWeight, 3);
});

test('Generic D20 preset computes MOD_FORCA and surfaces formula errors when broken', () => {
  let sheet = createGenericD20Preset();
  sheet = updateFieldValue(sheet, 'f_forca', 18);
  const evalOk = evaluateSheet(sheet);
  assert.equal(evalOk.computedByFieldId['f_mod_forca'].formatted, '+4');

  sheet = updateFieldSchema(sheet, 'f_mod_forca', { formula: 'forca + invalido' });
  const evalErr = evaluateSheet(sheet);
  assert.ok(evalErr.formulaErrors.length >= 1);
  assert.equal(evalErr.computedByFieldId['f_mod_forca'].ok, false);
});

test('Custom blank sheet starts empty without D&D defaults and supports building custom cards and fields', () => {
  let sheet = createBlankSheet();
  assert.equal(detectSystemId(sheet), 'blank');
  assert.equal(sheet.cards.length, 0);

  sheet = addCardToSheet(sheet, {
    id: 'c_custom_1',
    tab: 'geral',
    code: '//PILAR_CUSTOM',
    title: 'ATRIBUTOS DO SISTEMA',
    colSpan: 1,
    fields: [],
  });
  sheet = addFieldToCard(sheet, 'c_custom_1', {
    id: 'f_coragem',
    key: 'coragem',
    label: 'CORAGEM',
    kind: 'number',
    value: 4,
  });
  sheet = addFieldToCard(sheet, 'c_custom_1', {
    id: 'f_dobro',
    key: 'dobro_coragem',
    label: 'IMPACTO',
    kind: 'calculated',
    formula: 'coragem * 2',
    showPlus: false,
  });
  sheet = updateCardSchema(sheet, 'c_custom_1', { colSpan: 2, title: 'PILARES' });

  const evalCustom = evaluateSheet(sheet);
  assert.equal(sheet.cards[0].colSpan, 2);
  assert.equal(sheet.cards[0].title, 'PILARES');
  assert.equal(evalCustom.computedByFieldId['f_dobro'].formatted, '8');
  assert.equal(evalCustom.formulaErrors.length, 0);

  sheet = removeCardFromSheet(sheet, 'c_custom_1');
  assert.equal(sheet.cards.length, 0);
});
