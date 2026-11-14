import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addCardToSheet,
  addFieldToCard,
  addRepeatableRow,
  adjustHealthDamage,
  adjustResourceValue,
  consumeWillpowerForRoll,
  createBlankSheet,
  createDefaultSheet,
  createDnd5ePreset,
  createGenericD20Preset,
  createNewSheetForSystem,
  createPresetBySystemId,
  detectSystemId,
  evaluateSheet,
  fromCanonicalSheet,
  getOrCreateDeviceId,
  isValidIsoDateTime,
  migrateLegacySheetMetadata,
  migrateLegacyWodSheet,
  migrateLocalStorageSheet,
  removeCardFromSheet,
  removeRepeatableRow,
  resolveRollPreview,
  toCanonicalSheet,
  updateCardSchema,
  updateFieldSchema,
  updateFieldValue,
} from './sheetModel';

test('World of Darkness default sheet computes derived traits, Skill/Soak pools, and Willpower (+1 Auto Success)', () => {
  let sheet = createDefaultSheet();
  const eval1 = evaluateSheet(sheet);
  assert.equal(eval1.computedByFieldId['f_blood_potency'].formatted, '3');
  assert.equal(eval1.computedByFieldId['f_initiative'].formatted, '+7');
  assert.equal(eval1.computedByFieldId['f_defense'].formatted, '3');
  assert.equal(eval1.formulaErrors.length, 0);
  assert.equal(resolveRollPreview('pool(strength + brawl, 6)', eval1.variables), '5d10 @ DIFF 6');
  assert.equal(
    resolveRollPreview('pool(stamina + fortitude_armor, 6)', eval1.variables),
    '3d10 @ DIFF 6',
  );

  // Raise Strength 3 -> 4, Fortitude/Armor 0 -> 2, and apply custom Difficulty/Specialty/Mod preview
  sheet = updateFieldValue(sheet, 'f_strength', 4);
  sheet = updateFieldValue(sheet, 'f_fortitude_armor', 2);
  const eval2 = evaluateSheet(sheet);
  assert.equal(
    resolveRollPreview('pool(strength + brawl, 6)', eval2.variables, {
      difficulty: 7,
      modifier: 1,
      specialty: true,
    }),
    '7d10 @ DIFF 7 · SPEC',
  );
  assert.equal(
    resolveRollPreview('pool(stamina + fortitude_armor, 6)', eval2.variables, { difficulty: 5 }),
    '5d10 @ DIFF 5',
  );

  // Activating WILLPOWER (+1 AUTO SUCCESS) does NOT inflate dice pool, subtracts 1 Willpower on roll, and resets toggle
  sheet = updateFieldValue(sheet, 'f_wp_boost', true);
  const evalArmed = evaluateSheet(sheet);
  assert.equal(resolveRollPreview('pool(strength + brawl, 6)', evalArmed.variables), '6d10 @ DIFF 6');
  assert.equal(evalArmed.variables.willpower, 6);

  sheet = consumeWillpowerForRoll(sheet);
  const wpAfter = sheet.cards.flatMap((c) => c.fields).find((f) => f.id === 'f_willpower');
  const toggleAfter = sheet.cards.flatMap((c) => c.fields).find((f) => f.id === 'f_wp_boost');
  assert.equal(wpAfter?.value, 5);
  assert.equal(toggleAfter?.value, false);

  // Lowering Willpower to 0 automatically resets f_wp_boost back to false
  sheet = updateFieldValue(sheet, 'f_wp_boost', true);
  sheet = adjustResourceValue(sheet, 'f_willpower', -5);
  const wpZero = sheet.cards.flatMap((c) => c.fields).find((f) => f.id === 'f_willpower');
  const toggleZero = sheet.cards.flatMap((c) => c.fields).find((f) => f.id === 'f_wp_boost');
  assert.equal(wpZero?.value, 0);
  assert.equal(toggleZero?.value, false);
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

test('WoD Vital Status uses Hunger (0-5) and Health Superficial/Aggravated damage where 1 Agg = full Health in Superficial', () => {
  let sheet = createDefaultSheet();

  // Hunger clamps within [0, 5]
  sheet = adjustResourceValue(sheet, 'f_hunger', -2);
  let hunger = sheet.cards.flatMap((c) => c.fields).find((f) => f.id === 'f_hunger');
  assert.equal(hunger?.value, 0);
  assert.equal(hunger?.max, 5);

  sheet = adjustResourceValue(sheet, 'f_hunger', 99);
  hunger = sheet.cards.flatMap((c) => c.fields).find((f) => f.id === 'f_hunger');
  assert.equal(hunger?.value, 5);

  // Health has max=7; 6 superficial stays superficial
  sheet = adjustHealthDamage(sheet, 'f_health', 'superficial', 6);
  let health = sheet.cards.flatMap((c) => c.fields).find((f) => f.id === 'f_health');
  assert.equal(health?.superficialDamage, 6);
  assert.equal(health?.aggravatedDamage, 0);
  assert.equal(health?.value, 7);

  // Adding +1 more superficial reaches full life (7) -> converts into 1 Aggravated and 0 Superficial
  sheet = adjustHealthDamage(sheet, 'f_health', 'superficial', 1);
  health = sheet.cards.flatMap((c) => c.fields).find((f) => f.id === 'f_health');
  assert.equal(health?.aggravatedDamage, 1);
  assert.equal(health?.superficialDamage, 0);
  assert.equal(health?.value, 6);

  // Adding +1 aggravated adds full life (7 sup eq) directly
  sheet = adjustHealthDamage(sheet, 'f_health', 'aggravated', 1);
  health = sheet.cards.flatMap((c) => c.fields).find((f) => f.id === 'f_health');
  assert.equal(health?.aggravatedDamage, 2);
  assert.equal(health?.superficialDamage, 0);
  assert.equal(health?.value, 5);

  // Legacy migration upgrades old Blood Pool and Health safely
  const legacy = createDefaultSheet();
  const legacyCombate = legacy.cards.find((c) => c.id === 'card_combate')!;
  legacyCombate.title = 'HEALTH · WILLPOWER · BLOOD';
  legacyCombate.fields = legacyCombate.fields.map((f) =>
    f.id === 'f_hunger'
      ? { id: 'f_blood_pool', key: 'blood_pool', label: 'BLOOD POOL', kind: 'resource', value: 9, max: 13 }
      : f.id === 'f_health'
        ? { id: 'f_health', key: 'health', label: 'HEALTH', kind: 'resource', value: 6, max: 7 }
        : f,
  );
  const migrated = migrateLegacyWodSheet(legacy);
  const migCombate = migrated.cards.find((c) => c.id === 'card_combate')!;
  assert.equal(migCombate.title, 'HEALTH · WILLPOWER · HUNGER');
  assert.ok(migCombate.fields.some((f) => f.id === 'f_hunger' && f.max === 5));
  const migHealth = migCombate.fields.find((f) => f.id === 'f_health');
  assert.equal(migHealth?.damageTrack, true);
  assert.equal(migHealth?.aggravatedDamage, 1);
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

test('Sheet metadata contract initializes revision=1, ISO-8601 updatedAt, and persistent deviceId, and migrates legacy localStorage sheets', () => {
  const store = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
  };

  const devId1 = getOrCreateDeviceId(mockStorage);
  const devId2 = getOrCreateDeviceId(mockStorage);
  assert.equal(devId1, devId2);
  assert.ok(devId1.length >= 8);

  const fresh = createDefaultSheet();
  assert.equal(fresh.revision, 1);
  assert.equal(isValidIsoDateTime(fresh.updatedAt), true);
  assert.ok(fresh.deviceId.length >= 1);

  // Local edits update updatedAt and keep revision unchanged (only server increments revision)
  const mutated = updateFieldValue(fresh, 'f_strength', 5);
  assert.equal(mutated.revision, 1);
  assert.equal(isValidIsoDateTime(mutated.updatedAt), true);

  // Migrate legacy localStorage sheet lacking revision/updatedAt/deviceId
  const legacyRaw = {
    characterName: 'LEGACY VAMPIRE',
    systemName: 'WORLD OF DARKNESS // V5',
    tabs: [{ id: 'geral', label: '01. CORE' }],
    cards: [],
  };
  const migrated = migrateLocalStorageSheet(legacyRaw, { storage: mockStorage });
  assert.ok(migrated);
  assert.equal(migrated.revision, 1);
  assert.equal(migrated.deviceId, devId1);
  assert.equal(isValidIsoDateTime(migrated.updatedAt), true);

  // Canonical conversion preserves metadata and round-trips cleanly
  const canonical = toCanonicalSheet(fresh);
  assert.equal(canonical.revision, 1);
  assert.equal(canonical.deviceId, fresh.deviceId);
  assert.equal(canonical.updatedAt, fresh.updatedAt);

  const roundTripped = fromCanonicalSheet(canonical, fresh);
  assert.equal(roundTripped.revision, 1);
  assert.equal(roundTripped.deviceId, fresh.deviceId);
  assert.equal(roundTripped.characterName, fresh.characterName);

  const fallbackMeta = migrateLegacySheetMetadata(
    {
      ...fresh,
      revision: 0,
      updatedAt: 'not-a-date',
      deviceId: '',
    },
    { storage: mockStorage },
  );
  assert.equal(fallbackMeta.revision, 1);
  assert.equal(fallbackMeta.deviceId, devId1);
  assert.equal(isValidIsoDateTime(fallbackMeta.updatedAt), true);
});

test('createNewSheetForSystem creates clean fillable character sheet in existing system, or empty custom sheet for blank', () => {
  const newWod = createNewSheetForSystem('wod');
  assert.equal(detectSystemId(newWod), 'wod');
  assert.equal(newWod.characterName, 'NOVO PERSONAGEM');
  assert.equal(newWod.rollLogs.length, 0);
  assert.equal(newWod.xp?.totalEarned, 0);

  const nameField = newWod.cards.flatMap((c) => c.fields).find((f) => f.id === 'f_nome');
  assert.equal(nameField?.value, '');
  assert.equal(nameField?.placeholder, 'Julian Cross');

  const clanField = newWod.cards.flatMap((c) => c.fields).find((f) => f.id === 'f_clan');
  assert.equal(clanField?.label, 'CLAN / FACTION');
  assert.equal(clanField?.value, '');
  assert.equal(clanField?.placeholder, 'Ventrue');

  const strField = newWod.cards.flatMap((c) => c.fields).find((f) => f.id === 'f_strength');
  const brawlField = newWod.cards.flatMap((c) => c.fields).find((f) => f.id === 'f_brawl');
  const gearField = newWod.cards.flatMap((c) => c.fields).find((f) => f.id === 'f_mochila');
  assert.equal(strField?.value, 1);
  assert.equal(brawlField?.value, 0);
  assert.equal(gearField?.rows?.length, 0);
  assert.equal(evaluateSheet(newWod).formulaErrors.length, 0);

  const newDnd = createNewSheetForSystem('dnd5e');
  assert.equal(detectSystemId(newDnd), 'dnd5e');
  assert.equal(newDnd.characterName, 'NOVO PERSONAGEM');
  assert.equal(newDnd.rollLogs.length, 0);
  assert.ok(newDnd.cards.length > 0);
  assert.equal(evaluateSheet(newDnd).formulaErrors.length, 0);

  const newBlank = createNewSheetForSystem('blank');
  assert.equal(detectSystemId(newBlank), 'blank');
  assert.equal(newBlank.cards.length, 0);
  assert.equal(newBlank.rollLogs.length, 0);

  const customWod = createNewSheetForSystem('wod', {
    characterName: 'Elena Vance',
    secondaryTrait: 'Toreador',
  });
  assert.equal(detectSystemId(customWod), 'wod');
  assert.equal(customWod.characterName, 'ELENA VANCE');
  assert.equal(customWod.rollLogs.length, 0);
  assert.equal(
    customWod.cards.flatMap((c) => c.fields).find((f) => f.id === 'f_nome')?.value,
    'Elena Vance',
  );
  assert.equal(
    customWod.cards.flatMap((c) => c.fields).find((f) => f.id === 'f_clan')?.value,
    'Toreador',
  );
  assert.equal(evaluateSheet(customWod).formulaErrors.length, 0);

  const customDnd = createNewSheetForSystem('dnd5e', {
    characterName: 'Lyra Vance',
    secondaryTrait: 'Ranger · Elf',
  });
  assert.equal(customDnd.characterName, 'LYRA VANCE');
  assert.equal(
    customDnd.cards.flatMap((c) => c.fields).find((f) => f.id === 'f_classe')?.value,
    'Ranger · Elf',
  );
  assert.equal(evaluateSheet(customDnd).formulaErrors.length, 0);
});
