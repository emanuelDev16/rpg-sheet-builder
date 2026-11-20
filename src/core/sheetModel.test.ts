import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
  addCardToSheet,
  addFieldToCard,
  addRepeatableRow,
  adjustHealthDamage,
  adjustResourceValue,
  adjustSheetBloodPool,
  adjustV20HealthDamage,
  adjustV5HealthDamage,
  applyV5SuperficialHalving,
  applyV5WillpowerSuperficialDamage,
  computeWoundPenalty,
  consumeWillpowerForRoll,
  createBlankSheet,
  createDefaultSheet,
  createDnd5ePreset,
  createGenericD20Preset,
  createNewSheetForSystem,
  createPresetBySystemId,
  createWorldOfDarknessV5Sheet,
  cycleV20HealthCell,
  detectSystemId,
  evaluateSheet,
  fromCanonicalSheet,
  getBloodPoolMaxByGeneration,
  getOrCreateDeviceId,
  getSheetBloodPool,
  getSheetVirtues,
  getV20HealthBreakdown,
  getV5HealthBreakdown,
  isValidIsoDateTime,
  migrateLegacySheetMetadata,
  migrateLegacyWodSheet,
  migrateLocalStorageSheet,
  removeCardFromSheet,
  removeRepeatableRow,
  resolveRollPreview,
  resolveRulePreset,
  setSheetRulePreset,
  toCanonicalSheet,
  updateCardSchema,
  updateFieldSchema,
  updateFieldValue,
  updateSheetVirtue,
  validateSheetPayload,
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

test('shared/presets/presets.v2.json presets pass shared/presets/schema.v2.json and validateSheetPayload rejects malformed/prototype-polluting payloads', () => {
  const schemaRaw = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'shared/presets/schema.v2.json'), 'utf8'),
  ) as Record<string, unknown>;
  const bundleRaw = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'shared/presets/presets.v2.json'), 'utf8'),
  ) as { version: string; presets: Record<string, unknown> };

  const AjvCtor = (Ajv2020 as unknown as { default?: typeof Ajv2020 }).default ?? Ajv2020;
  const ajv = new AjvCtor({ allErrors: true, strict: false });
  const applyFormats = (addFormats as unknown as { default?: typeof addFormats }).default ?? addFormats;
  applyFormats(ajv);
  const validateAjv = ajv.compile(schemaRaw);

  assert.equal(bundleRaw.version, '2.0');
  const presetEntries = Object.entries(bundleRaw.presets);
  assert.equal(presetEntries.length, 6);

  for (const [presetKey, presetPayload] of presetEntries) {
    const ajvOk = validateAjv(presetPayload);
    assert.equal(
      ajvOk,
      true,
      `Ajv failed for preset ${presetKey}: ${JSON.stringify(validateAjv.errors)}`,
    );
    const localRes = validateSheetPayload(presetPayload);
    assert.equal(
      localRes.valid,
      true,
      `validateSheetPayload failed for preset ${presetKey}: ${localRes.errors.join('; ')}`,
    );
  }

  const v20Preset = bundleRaw.presets.wod as { cards: Array<{ id: string; fields: Array<{ id: string; key: string; kind: string; attributeGroup?: string }> }> };
  const v20PresetAttrs = v20Preset.cards
    .find((c) => c.id === 'card_atributos')!
    .fields.filter((f) => f.kind === 'number');
  assert.deepEqual(
    v20PresetAttrs.map((f) => `${f.key}:${f.attributeGroup}`),
    [
      'strength:physical',
      'dexterity:physical',
      'stamina:physical',
      'charisma:social',
      'manipulation:social',
      'appearance:social',
      'perception:mental',
      'intelligence:mental',
      'wits:mental',
    ],
  );
  const v20PresetIdKeys = v20Preset.cards.find((c) => c.id === 'card_identidade')!.fields.map((f) => f.key);
  for (const k of ['concept', 'sire', 'chronicle', 'nature', 'demeanor', 'clan_weakness']) {
    assert.ok(v20PresetIdKeys.includes(k), `Missing presets.wod identity key: ${k}`);
  }

  const v5Preset = bundleRaw.presets.wod_v5 as {
    cards: Array<{ id: string; fields: Array<{ id: string; key: string; kind: string; attributeGroup?: string; maxFormula?: string }> }>;
  };
  const v5PresetAttrs = v5Preset.cards
    .find((c) => c.id === 'card_atributos')!
    .fields.filter((f) => f.kind === 'number');
  assert.deepEqual(
    v5PresetAttrs.map((f) => `${f.key}:${f.attributeGroup}`),
    [
      'strength:physical',
      'dexterity:physical',
      'stamina:physical',
      'charisma:social',
      'manipulation:social',
      'composure:social',
      'intelligence:mental',
      'wits:mental',
      'resolve:mental',
    ],
  );
  const v5PresetIdKeys = v5Preset.cards.find((c) => c.id === 'card_identidade')!.fields.map((f) => f.key);
  for (const k of ['concept', 'sire', 'chronicle', 'predator_type', 'ambition', 'desire', 'clan_bane', 'clan_compulsion']) {
    assert.ok(v5PresetIdKeys.includes(k), `Missing presets.wod_v5 identity key: ${k}`);
  }
  const v5PresetCombat = v5Preset.cards.find((c) => c.id === 'card_combate')!.fields;
  assert.equal(v5PresetCombat.find((f) => f.id === 'f_health')?.maxFormula, 'stamina + 3');
  assert.equal(v5PresetCombat.find((f) => f.id === 'f_willpower')?.maxFormula, 'composure + resolve');

  // Rejects Prototype Pollution and unknown properties (additionalProperties: false) on root, card, field
  const polluted = JSON.parse('{"systemName":"WOD","systemCode":"/WOD","characterName":"X","cards":[],"__proto__":{"polluted":true}}') as unknown;
  const pollutedRes = validateSheetPayload(polluted);
  assert.equal(pollutedRes.valid, false);
  assert.ok(pollutedRes.errors.some((e) => e.includes('__proto__') || e.includes('não permitida')));

  const unknownPropsAndBadGroup = {
    systemName: 'WOD',
    systemCode: '/WOD',
    characterName: 'X',
    unexpectedRootProp: true,
    cards: [
      {
        id: 'c1',
        tab: 'geral',
        code: '//A',
        title: 'CARD',
        colSpan: 1,
        unexpectedCardProp: 42,
        fields: [
          {
            id: 'f_strength',
            key: 'strength',
            label: 'STRENGTH',
            kind: 'number',
            value: 3,
            attributeGroup: 'arcane',
            unexpectedFieldProp: 'nope',
          },
        ],
      },
    ],
  };
  assert.equal(validateAjv(unknownPropsAndBadGroup), false);
  const unknownPropsRes = validateSheetPayload(unknownPropsAndBadGroup);
  assert.equal(unknownPropsRes.valid, false);
  assert.ok(unknownPropsRes.errors.some((e) => e.includes('unexpectedRootProp')));
  assert.ok(unknownPropsRes.errors.some((e) => e.includes('unexpectedCardProp')));
  assert.ok(unknownPropsRes.errors.some((e) => e.includes('attributeGroup')));
  assert.ok(unknownPropsRes.errors.some((e) => e.includes('unexpectedFieldProp')));

  // Rejects invalid bounds (revision: 0, rollDifficulty: 99, colSpan: 8)
  const invalidBounds = {
    systemName: 'WOD',
    systemCode: '/WOD',
    characterName: 'X',
    revision: 0,
    cards: [
      {
        id: 'c1',
        tab: 'geral',
        code: '//A',
        title: 'CARD',
        colSpan: 8,
        fields: [
          {
            id: 'f1',
            key: 'k1',
            label: 'ROLL',
            kind: 'roll',
            rollDifficulty: 99,
          },
        ],
      },
    ],
  };
  const boundsRes = validateSheetPayload(invalidBounds);
  assert.equal(boundsRes.valid, false);
  assert.ok(boundsRes.errors.length >= 3);
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

test('Rule preset root promotion, V20 Blood Pool by Generation, Virtues, 3-state V20 Health & Wound Penalties', () => {
  let sheet = createDefaultSheet();
  assert.equal(resolveRulePreset(sheet), 'storyteller-v20');

  // Switch preset cleanly and verify both rulePreset & xpRulePreset sync
  sheet = setSheetRulePreset(sheet, 'vampire-v5');
  assert.equal(resolveRulePreset(sheet), 'vampire-v5');
  assert.equal(sheet.rulePreset, 'vampire-v5');
  assert.equal(sheet.xpRulePreset, 'vampire-v5');
  sheet = setSheetRulePreset(sheet, 'storyteller-v20');

  // Blood Pool generation caps (Gen 10 = 13, Gen 8 = 15, Gen 13 = 10)
  assert.equal(getBloodPoolMaxByGeneration(10), 13);
  assert.equal(getBloodPoolMaxByGeneration(8), 15);
  assert.equal(getBloodPoolMaxByGeneration(13), 10);

  let bp = getSheetBloodPool(sheet);
  assert.equal(bp.current, 10);
  assert.equal(bp.max, 13);
  sheet = adjustSheetBloodPool(sheet, -3);
  bp = getSheetBloodPool(sheet);
  assert.equal(bp.current, 7);

  // Virtues clamp [1, 5]
  sheet = updateSheetVirtue(sheet, 'courage', 5);
  sheet = updateSheetVirtue(sheet, 'conscience', 0);
  const virtues = getSheetVirtues(sheet);
  assert.equal(virtues.courage, 5);
  assert.equal(virtues.conscience, 1);

  // V20 3-state health & wound penalties (Bruised 0, Hurt/Injured -1, Wounded/Mauled -2, Crippled/Incap -5)
  assert.equal(computeWoundPenalty(sheet, 'storyteller-v20'), 0);
  sheet = adjustV20HealthDamage(sheet, 'f_health', 'bashing', 1); // 1 total -> 0
  assert.equal(computeWoundPenalty(sheet, 'storyteller-v20'), 0);
  sheet = adjustV20HealthDamage(sheet, 'f_health', 'lethal', 1); // 2 total -> -1
  assert.equal(computeWoundPenalty(sheet, 'storyteller-v20'), -1);
  sheet = adjustV20HealthDamage(sheet, 'f_health', 'aggravated', 2); // 4 total -> -2
  assert.equal(computeWoundPenalty(sheet, 'storyteller-v20'), -2);
  sheet = adjustV20HealthDamage(sheet, 'f_health', 'bashing', 2); // 6 total -> -5
  assert.equal(computeWoundPenalty(sheet, 'storyteller-v20'), -5);

  // Overflow bashing converts bashing -> lethal
  sheet = adjustV20HealthDamage(sheet, 'f_health', 'bashing', 2); // reaches 7 max, then 1 bashing -> lethal
  const healthField = sheet.cards.flatMap((c) => c.fields).find((f) => f.id === 'f_health')!;
  const breakdown = getV20HealthBreakdown(healthField);
  assert.equal(breakdown.totalDamage, 7);
  assert.equal(breakdown.aggravated, 2);
  assert.equal(breakdown.lethal, 2);
  assert.equal(breakdown.bashing, 3);

  // Cell cycling on fresh sheet: empty -> bashing -> lethal -> aggravated -> cleared
  let cycleSheet = createDefaultSheet();
  cycleSheet = cycleV20HealthCell(cycleSheet, 'f_health', 0);
  assert.equal(getV20HealthBreakdown(cycleSheet.cards.flatMap((c) => c.fields).find((f) => f.id === 'f_health')!).bashing, 1);
  cycleSheet = cycleV20HealthCell(cycleSheet, 'f_health', 0);
  assert.equal(getV20HealthBreakdown(cycleSheet.cards.flatMap((c) => c.fields).find((f) => f.id === 'f_health')!).lethal, 1);
  cycleSheet = cycleV20HealthCell(cycleSheet, 'f_health', 0);
  assert.equal(getV20HealthBreakdown(cycleSheet.cards.flatMap((c) => c.fields).find((f) => f.id === 'f_health')!).aggravated, 1);
  cycleSheet = cycleV20HealthCell(cycleSheet, 'f_health', 0);
  assert.equal(getV20HealthBreakdown(cycleSheet.cards.flatMap((c) => c.fields).find((f) => f.id === 'f_health')!).totalDamage, 0);
});

test('V5 Health halving/overflow, Impaired (-2) wound penalty, V5 WP Superficial damage, and schema validation of new V20/V5 fields', () => {
  let sheet = setSheetRulePreset(createDefaultSheet(), 'vampire-v5');

  // Halving rounds up (Math.ceil)
  const halved = applyV5SuperficialHalving(sheet, 'f_health', 5);
  assert.equal(halved.appliedDamage, 3);
  sheet = halved.sheet;
  let health = getV5HealthBreakdown(sheet.cards.flatMap((c) => c.fields).find((f) => f.id === 'f_health')!);
  assert.equal(health.superficial, 3);
  assert.equal(computeWoundPenalty(sheet, 'vampire-v5'), 0);

  // Fill remaining 4 boxes -> total 7 = Impaired (-2)
  sheet = adjustV5HealthDamage(sheet, 'f_health', 'superficial', 4);
  health = getV5HealthBreakdown(sheet.cards.flatMap((c) => c.fields).find((f) => f.id === 'f_health')!);
  assert.equal(health.superficial, 7);
  assert.equal(computeWoundPenalty(sheet, 'vampire-v5'), -2);

  // +1 more superficial overflows -> converts 1 superficial into aggravated
  sheet = adjustV5HealthDamage(sheet, 'f_health', 'superficial', 1);
  health = getV5HealthBreakdown(sheet.cards.flatMap((c) => c.fields).find((f) => f.id === 'f_health')!);
  assert.equal(health.aggravated, 1);
  assert.equal(health.superficial, 6);

  // V5 Willpower superficial damage marks '/' and decreases remaining WP
  sheet = applyV5WillpowerSuperficialDamage(sheet, 1);
  const wpField = sheet.cards.flatMap((c) => c.fields).find((f) => f.id === 'f_willpower')!;
  assert.equal(wpField.value, 5);
  assert.equal(wpField.superficialDamage, 1);

  // Schema & local payload validation accept mutated V20/V5 fields (rulePreset, bloodPool, virtues, V5 rollLog fields)
  sheet = {
    ...sheet,
    bloodPool: 9,
    bloodSurge: true,
    virtues: { conscience: 3, selfControl: 4, courage: 5 },
    rollLogs: [
      ...sheet.rollLogs,
      {
        id: 'log_v5_test',
        timestamp: '23:59',
        label: 'ROLL BRAWL',
        total: 4,
        formula: '5d10 (DIFF 6 · V5 · HUNGER 1)',
        breakdown: '5d10[10, 8, 6, 4, 10] ≥6 → 4 SUCESSOS',
        rolls: [10, 8, 6, 4, 10],
        rulePreset: 'vampire-v5',
        woundPenalty: -2,
        hungerDice: 1,
        hungerRolls: [10],
        messyCritical: true,
        bestialFailure: false,
        critPairsCount: 1,
        isBloodSurge: true,
        isWillpowerReroll: true,
        rerolledIndices: [3],
      },
    ],
  };

  const schemaRaw = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'shared/presets/schema.v2.json'), 'utf8'),
  ) as Record<string, unknown>;
  const AjvCtor = (Ajv2020 as unknown as { default?: typeof Ajv2020 }).default ?? Ajv2020;
  const ajv = new AjvCtor({ allErrors: true, strict: false });
  const applyFormats = (addFormats as unknown as { default?: typeof addFormats }).default ?? addFormats;
  applyFormats(ajv);
  const validateAjv = ajv.compile(schemaRaw);

  assert.equal(validateAjv(sheet), true, `AJV errors: ${JSON.stringify(validateAjv.errors)}`);
  const localVal = validateSheetPayload(sheet);
  assert.equal(localVal.valid, true, `validateSheetPayload errors: ${localVal.errors.join('; ')}`);
});

test('WoD V20 and V5 expose full 9-attribute 3x3 grids, chronicle identity fields, and V5 derived Health/Willpower maxes', () => {
  const schemaRaw = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'shared/presets/schema.v2.json'), 'utf8'),
  ) as Record<string, unknown>;
  const AjvCtor = (Ajv2020 as unknown as { default?: typeof Ajv2020 }).default ?? Ajv2020;
  const ajv = new AjvCtor({ allErrors: true, strict: false });
  const applyFormats = (addFormats as unknown as { default?: typeof addFormats }).default ?? addFormats;
  applyFormats(ajv);
  const validateAjv = ajv.compile(schemaRaw);

  // 1. Default WoD V20 sheet has all 9 V20 attributes and V20 chronicle identity
  const v20 = createDefaultSheet();
  const v20AttrKeys = v20.cards
    .find((c) => c.id === 'card_atributos')!
    .fields.filter((f) => f.kind === 'number')
    .map((f) => f.key);
  assert.deepEqual(v20AttrKeys, [
    'strength',
    'dexterity',
    'stamina',
    'charisma',
    'manipulation',
    'appearance',
    'perception',
    'intelligence',
    'wits',
  ]);
  const v20IdKeys = v20.cards
    .find((c) => c.id === 'card_identidade')!
    .fields.map((f) => f.key);
  for (const key of ['concept', 'sire', 'chronicle', 'nature', 'demeanor', 'clan_weakness']) {
    assert.ok(v20IdKeys.includes(key), `Missing V20 identity key: ${key}`);
  }
  assert.equal(validateAjv(v20), true, `V20 AJV errors: ${JSON.stringify(validateAjv.errors)}`);
  assert.equal(validateSheetPayload(v20).valid, true);

  // 2. Fresh V5 sheet via rulePreset has all 9 V5 attributes, V5 identity fields, derived maxes & diff 2
  let v5 = createNewSheetForSystem('wod', {
    rulePreset: 'vampire-v5',
    characterName: 'Nadia Voss',
    secondaryTrait: 'Lasombra',
  });
  assert.equal(resolveRulePreset(v5), 'vampire-v5');
  assert.equal(v5.xpRulePreset, 'vampire-v5');

  const v5AttrFields = v5.cards
    .find((c) => c.id === 'card_atributos')!
    .fields.filter((f) => f.kind === 'number');
  assert.deepEqual(
    v5AttrFields.map((f) => f.key),
    [
      'strength',
      'dexterity',
      'stamina',
      'charisma',
      'manipulation',
      'composure',
      'intelligence',
      'wits',
      'resolve',
    ],
  );
  assert.equal(
    v5AttrFields.every((f) => f.value === 1),
    true,
  );
  assert.equal(v5AttrFields.some((f) => f.key === 'appearance' || f.key === 'perception'), false);

  const v5IdKeys = v5.cards
    .find((c) => c.id === 'card_identidade')!
    .fields.map((f) => f.key);
  for (const key of ['concept', 'sire', 'chronicle', 'predator_type', 'ambition', 'desire', 'clan_bane', 'clan_compulsion']) {
    assert.ok(v5IdKeys.includes(key), `Missing V5 identity key: ${key}`);
  }
  assert.equal(v5IdKeys.includes('nature'), false);

  const v5Combat = v5.cards.find((c) => c.id === 'card_combate')!.fields;
  const v5HealthInit = v5Combat.find((f) => f.id === 'f_health');
  const v5WpInit = v5Combat.find((f) => f.id === 'f_willpower');
  assert.equal(v5HealthInit?.max, 4);
  assert.equal(v5HealthInit?.maxFormula, 'stamina + 3');
  assert.equal(v5HealthInit?.value, 4);
  assert.equal(v5WpInit?.max, 2);
  assert.equal(v5WpInit?.maxFormula, 'composure + resolve');
  assert.equal(v5WpInit?.value, 2);

  const v5EvalInit = evaluateSheet(v5);
  assert.equal(v5EvalInit.variables.health_max, 4);
  assert.equal(v5EvalInit.variables.willpower_max, 2);
  assert.equal(v5EvalInit.formulaErrors.length, 0);

  // Sample V5 sheet helper matches presets.wod_v5 contract and computes health_max / willpower_max
  const v5Sample = createWorldOfDarknessV5Sheet();
  const v5SampleEval = evaluateSheet(v5Sample);
  assert.equal(v5SampleEval.variables.health_max, 6);
  assert.equal(v5SampleEval.variables.willpower_max, 5);
  assert.equal(v5SampleEval.formulaErrors.length, 0);
  assert.equal(validateAjv(v5Sample), true, `V5 sample AJV errors: ${JSON.stringify(validateAjv.errors)}`);
  assert.equal(validateSheetPayload(v5Sample).valid, true);

  // Broken maxFormula surfaces formula error without throwing
  const brokenMaxSheet = {
    ...v5Sample,
    cards: v5Sample.cards.map((card) =>
      card.id === 'card_combate'
        ? {
            ...card,
            fields: card.fields.map((f) =>
              f.id === 'f_health' ? { ...f, maxFormula: 'stamina + missing_var' } : f,
            ),
          }
        : card,
    ),
  };
  assert.ok(evaluateSheet(brokenMaxSheet).formulaErrors.some((e) => e.fieldId === 'f_health'));

  const nonSoakRoll = v5.cards
    .flatMap((c) => c.fields)
    .find((f) => f.kind === 'roll' && !f.isSoak);
  assert.equal(nonSoakRoll?.rollDifficulty, 2);
  assert.equal(nonSoakRoll?.rollDifficultyV5, 2);
  assert.equal(evaluateSheet(v5).formulaErrors.length, 0);
  assert.equal(validateAjv(v5), true, `V5 AJV errors: ${JSON.stringify(validateAjv.errors)}`);
  assert.equal(validateSheetPayload(v5).valid, true);

  // 3. Updating Stamina, Composure, and Resolve updates V5 derived Health and Willpower maxes
  v5 = updateFieldValue(v5, 'f_stamina', 3);
  v5 = updateFieldValue(v5, 'f_composure', 3);
  v5 = updateFieldValue(v5, 'f_resolve', 2);
  const v5CombatUpdated = v5.cards.find((c) => c.id === 'card_combate')!.fields;
  assert.equal(v5CombatUpdated.find((f) => f.id === 'f_health')?.max, 6);
  assert.equal(v5CombatUpdated.find((f) => f.id === 'f_health')?.value, 6);
  assert.equal(v5CombatUpdated.find((f) => f.id === 'f_willpower')?.max, 5);
  assert.equal(v5CombatUpdated.find((f) => f.id === 'f_willpower')?.value, 5);
  const v5UpdatedEval = evaluateSheet(v5);
  assert.equal(v5UpdatedEval.variables.health_max, 6);
  assert.equal(v5UpdatedEval.variables.willpower_max, 5);
});

test('migrateLegacyWodSheet safely upcasts legacy 6-attribute V20 and V5 sheets without overwriting user data', () => {
  const schemaRaw = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'shared/presets/schema.v2.json'), 'utf8'),
  ) as Record<string, unknown>;
  const AjvCtor = (Ajv2020 as unknown as { default?: typeof Ajv2020 }).default ?? Ajv2020;
  const ajv = new AjvCtor({ allErrors: true, strict: false });
  const applyFormats = (addFormats as unknown as { default?: typeof addFormats }).default ?? addFormats;
  applyFormats(ajv);
  const validateAjv = ajv.compile(schemaRaw);

  // 1. Legacy 6-attribute V20 sheet missing appearance/perception/intelligence and chronicle identity fields
  const legacyV20 = createDefaultSheet();
  const v20IdentCard = legacyV20.cards.find((c) => c.id === 'card_identidade')!;
  v20IdentCard.fields = [
    { id: 'f_nome', key: 'character_name', label: 'NAME', kind: 'text', value: 'Viktor Drakon' },
    { id: 'f_clan', key: 'clan', label: 'CLAN / FACTION', kind: 'text', value: 'Tzimisce' },
    { id: 'f_generation', key: 'generation', label: 'GENERATION', kind: 'number', value: 8 },
  ];
  const v20AttrCard = legacyV20.cards.find((c) => c.id === 'card_atributos')!;
  v20AttrCard.fields = [
    { id: 'f_strength', key: 'strength', label: 'STRENGTH', kind: 'number', value: 5 },
    { id: 'f_dexterity', key: 'dexterity', label: 'DEXTERITY', kind: 'number', value: 2 },
    { id: 'f_stamina', key: 'stamina', label: 'STAMINA', kind: 'number', value: 4 },
    { id: 'f_charisma', key: 'charisma', label: 'CHARISMA', kind: 'number', value: 3 },
    { id: 'f_manipulation', key: 'manipulation', label: 'MANIPULATION', kind: 'number', value: 4 },
    { id: 'f_wits', key: 'wits', label: 'WITS', kind: 'number', value: 3 },
    { id: 'f_initiative', key: 'initiative', label: 'INITIATIVE_MOD', kind: 'calculated', formula: 'dexterity + wits', showPlus: true },
  ];

  const migratedV20 = migrateLegacyWodSheet(legacyV20, { storage: null });
  const migV20Attrs = migratedV20.cards.find((c) => c.id === 'card_atributos')!.fields;
  assert.equal(migV20Attrs.find((f) => f.key === 'strength')?.value, 5);
  assert.equal(migV20Attrs.find((f) => f.key === 'appearance')?.value, 1);
  assert.equal(migV20Attrs.find((f) => f.key === 'perception')?.value, 1);
  assert.equal(migV20Attrs.find((f) => f.key === 'intelligence')?.value, 1);
  assert.equal(migV20Attrs[migV20Attrs.length - 1]?.id, 'f_initiative');
  const migV20Ident = migratedV20.cards.find((c) => c.id === 'card_identidade')!.fields;
  assert.equal(migV20Ident.find((f) => f.key === 'clan')?.value, 'Tzimisce');
  for (const k of ['concept', 'sire', 'chronicle', 'nature', 'demeanor', 'clan_weakness']) {
    assert.ok(migV20Ident.some((f) => f.key === k), `Missing upcast V20 identity key: ${k}`);
  }
  assert.equal(validateAjv(migratedV20), true, `Migrated V20 AJV errors: ${JSON.stringify(validateAjv.errors)}`);
  assert.equal(validateSheetPayload(migratedV20).valid, true);

  // 2. Legacy 6-attribute V5 sheet without maxFormula or V5 chronicle identity fields
  const legacyV5 = createDefaultSheet();
  legacyV5.rulePreset = 'vampire-v5';
  legacyV5.xpRulePreset = 'vampire-v5';
  const v5IdentCard = legacyV5.cards.find((c) => c.id === 'card_identidade')!;
  v5IdentCard.fields = [
    { id: 'f_nome', key: 'character_name', label: 'NAME', kind: 'text', value: 'Soren Reyes' },
    { id: 'f_clan', key: 'clan', label: 'CLAN / FACTION', kind: 'text', value: 'Brujah' },
  ];
  const v5AttrCard = legacyV5.cards.find((c) => c.id === 'card_atributos')!;
  v5AttrCard.fields = [
    { id: 'f_strength', key: 'strength', label: 'STRENGTH', kind: 'number', value: 4 },
    { id: 'f_dexterity', key: 'dexterity', label: 'DEXTERITY', kind: 'number', value: 3 },
    { id: 'f_stamina', key: 'stamina', label: 'STAMINA', kind: 'number', value: 3 },
    { id: 'f_charisma', key: 'charisma', label: 'CHARISMA', kind: 'number', value: 3 },
    { id: 'f_manipulation', key: 'manipulation', label: 'MANIPULATION', kind: 'number', value: 2 },
    { id: 'f_wits', key: 'wits', label: 'WITS', kind: 'number', value: 3 },
  ];
  const v5CombatCard = legacyV5.cards.find((c) => c.id === 'card_combate')!;
  v5CombatCard.fields = [
    { id: 'f_health', key: 'health', label: 'HEALTH', kind: 'resource', value: 5, max: 6, damageTrack: true, superficialDamage: 1, aggravatedDamage: 0 },
    { id: 'f_willpower', key: 'willpower', label: 'WILLPOWER', kind: 'resource', value: 4, max: 5, superficialDamage: 1, aggravatedDamage: 0 },
  ];

  const migratedV5 = migrateLegacyWodSheet(legacyV5, { storage: null });
  const migV5Attrs = migratedV5.cards.find((c) => c.id === 'card_atributos')!.fields;
  assert.equal(migV5Attrs.find((f) => f.key === 'strength')?.value, 4);
  assert.equal(migV5Attrs.find((f) => f.key === 'composure')?.value, 1);
  assert.equal(migV5Attrs.find((f) => f.key === 'composure')?.attributeGroup, 'social');
  assert.equal(migV5Attrs.find((f) => f.key === 'intelligence')?.value, 1);
  assert.equal(migV5Attrs.find((f) => f.key === 'resolve')?.value, 1);
  assert.equal(migV5Attrs.find((f) => f.key === 'resolve')?.attributeGroup, 'mental');
  assert.equal(migV5Attrs.some((f) => f.key === 'appearance' || f.key === 'perception'), false);

  const migV5Combat = migratedV5.cards.find((c) => c.id === 'card_combate')!.fields;
  const migV5Health = migV5Combat.find((f) => f.id === 'f_health');
  const migV5Wp = migV5Combat.find((f) => f.id === 'f_willpower');
  assert.equal(migV5Health?.max, 6);
  assert.equal(migV5Health?.value, 5);
  assert.equal(migV5Health?.maxFormula, 'stamina + 3');
  assert.equal(migV5Wp?.max, 5);
  assert.equal(migV5Wp?.value, 4);
  assert.equal(migV5Wp?.maxFormula, 'composure + resolve');

  const migV5Ident = migratedV5.cards.find((c) => c.id === 'card_identidade')!.fields;
  assert.equal(migV5Ident.find((f) => f.key === 'character_name')?.value, 'Soren Reyes');
  for (const k of ['concept', 'sire', 'chronicle', 'predator_type', 'ambition', 'desire', 'clan_bane', 'clan_compulsion']) {
    assert.ok(migV5Ident.some((f) => f.key === k), `Missing upcast V5 identity key: ${k}`);
  }
  assert.equal(validateAjv(migratedV5), true, `Migrated V5 AJV errors: ${JSON.stringify(validateAjv.errors)}`);
  assert.equal(validateSheetPayload(migratedV5).valid, true);
  assert.deepEqual(migrateLegacyWodSheet(migratedV5, { storage: null }), migratedV5);
});

