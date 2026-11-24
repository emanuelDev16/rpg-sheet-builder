import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
  evaluateSheet,
  getSheetBloodPool,
  getSheetVirtues,
  validateSheetPayload,
} from '../core/sheetModel.ts';
import {
  parsePowerActivationCost,
} from '../core/wodClansDisciplinesCatalog.ts';
import { extractWodRollableTraits } from './wodPoolComposer.ts';
import {
  assignV20AttributePriority,
  assignV20SkillPriority,
  buildSheetFromWodWizard,
  canAdvanceFromStep,
  canCompleteWizard,
  createInitialWodWizardState,
  getStep2AttributeSummary,
  getStep3SkillSummary,
  getStep4DossierSummary,
  getSuggestedFreeSpecialtySkills,
  getV5InitialBloodPotency,
  getV5InitialHumanity,
  setWizardAttribute,
  setWizardBackground,
  setWizardClan,
  setWizardDiscipline,
  setWizardEdition,
  setWizardSkill,
  setWizardSkillSpecialty,
  toggleWizardDisciplinePower,
  toggleWizardHavenTrait,
  validateWizardStep,
  WOD_V5_PREDATOR_TYPES,
  WOD_WIZARD_CUSTOM_VALUE,
  type WodCreationWizardState,
} from './wodCreationWizard.ts';

function compileSchemaV2Validator() {
  const schemaRaw = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'shared/presets/schema.v2.json'), 'utf8'),
  ) as Record<string, unknown>;
  const AjvCtor = (Ajv2020 as unknown as { default?: typeof Ajv2020 }).default ?? Ajv2020;
  const ajv = new AjvCtor({ allErrors: true, strict: false });
  const applyFormats =
    (addFormats as unknown as { default?: typeof addFormats }).default ?? addFormats;
  applyFormats(ajv);
  return ajv.compile(schemaRaw);
}

function buildValidV5WizardState(): WodCreationWizardState {
  let state = createInitialWodWizardState('vampire-v5');
  state = setWizardClan(state, 'lasombra');
  state = {
    ...state,
    name: 'Nadia Voss',
    concept: 'Harbor Broker',
    sire: 'Marcus Vane',
    chronicle: 'Nocturne Harbor',
    generation: 13,
    predatorTypeId: 'consensualist', // +1 Humanity -> 8
    ambition: 'Control the Harbor Elysium',
    desire: 'Expose the rival Primogen',
  };

  // Step 2: 4 / 3×3 / 2×4 / 1×1
  const attrValues: Record<string, number> = {
    strength: 2,
    dexterity: 3,
    stamina: 3, // Health = 6
    charisma: 2,
    manipulation: 4,
    composure: 3, // + Resolve 2 -> Willpower = 5
    intelligence: 2,
    wits: 1,
    resolve: 2,
  };
  for (const [k, v] of Object.entries(attrValues)) {
    state = setWizardAttribute(state, k, v);
  }

  // Step 3: Balanced (3×3, 2×5, 1×7 = 15 skills)
  const balancedSkills: Record<string, number> = {
    athletics: 2,
    brawl: 1,
    stealth: 3,
    survival: 1,
    etiquette: 2,
    insight: 2,
    intimidation: 3,
    leadership: 1,
    persuasion: 2,
    subterfuge: 3,
    academics: 1,
    finance: 2,
    investigation: 1,
    occult: 1,
    politics: 1,
  };
  for (const [k, v] of Object.entries(balancedSkills)) {
    state = setWizardSkill(state, k, v);
  }
  state = setWizardSkillSpecialty(state, 'academics', 'Architectural History');

  // Step 4: Disciplines 2+1 (Oblivion 2, Dominate 1) + 3 V5 powers
  state = setWizardDiscipline(state, 'oblivion', 2);
  state = setWizardDiscipline(state, 'dominate', 1);
  state = toggleWizardDisciplinePower(state, 'oblivion', 'v5_oblivion_shadow_cloak');
  state = toggleWizardDisciplinePower(state, 'oblivion', 'v5_oblivion_shadow_cast');
  state = toggleWizardDisciplinePower(state, 'dominate', 'v5_dominate_compel');

  // Advantages = 7 (Backgrounds 3 + Merit 2 + Haven rating 2)
  state = setWizardBackground(state, 'contacts', 2);
  state = setWizardBackground(state, 'resources', 1);
  state = {
    ...state,
    meritsFlaws: [
      {
        id: 'mf_1',
        kind: 'merit',
        name: 'Linguistics',
        rating: 2,
        catalogId: 'linguistics',
        notes: 'Latin & Venetian',
      },
      {
        id: 'mf_2',
        kind: 'flaw',
        name: 'Dark Secret',
        rating: 1,
        catalogId: 'dark_secret',
        notes: 'Unauthorized fledgling',
      },
    ],
    haven: {
      name: 'Harbor Sub-Vault',
      location: 'Pier 14',
      rating: 2,
      traits: ['postern', 'creepy'], // creepy is a haven flaw (+1 flaw -> total flaws = 2)
      notes: 'Floodgate tunnel',
    },
    touchstones: [
      {
        id: 'ts_1',
        conviction: 'Never break a blood oath',
        touchstone: 'Mateo Voss',
        notes: 'Archivist cousin',
      },
      {
        id: 'ts_2',
        conviction: 'Protect the innocent from hunger',
        touchstone: 'Sister Clara',
      },
    ],
  };

  return state;
}

function buildValidV20WizardState(): WodCreationWizardState {
  let state = createInitialWodWizardState('storyteller-v20');
  state = setWizardClan(state, 'ventrue');
  state = {
    ...state,
    name: 'Julian Cross',
    concept: 'Corporate Fixer',
    sire: 'Helena Vance',
    chronicle: 'Nocturne Harbor',
    nature: 'Director',
    demeanor: 'Architect',
    generation: 11, // Blood Pool max = 12
  };

  // Step 2: Primary Social (7), Secondary Mental (5), Tertiary Physical (3)
  state = assignV20AttributePriority(state, 'social', 'primary');
  state = assignV20AttributePriority(state, 'mental', 'secondary');
  state = assignV20AttributePriority(state, 'physical', 'tertiary');

  const v20Attrs: Record<string, number> = {
    strength: 2,
    dexterity: 2,
    stamina: 2, // +3 extra = 3
    charisma: 3,
    manipulation: 4,
    appearance: 3, // +7 extra = 7
    perception: 2,
    intelligence: 3,
    wits: 3, // +5 extra = 5
  };
  for (const [k, v] of Object.entries(v20Attrs)) {
    state = setWizardAttribute(state, k, v);
  }

  // Step 3: Talents 13, Skills 9, Knowledges 5 (all <= 3)
  const v20Skills: Record<string, number> = {
    // Talents = 13
    alertness: 2,
    brawl: 1,
    empathy: 2,
    expression: 2,
    intimidation: 2,
    leadership: 2,
    subterfuge: 2,
    // Skills = 9
    drive: 1,
    etiquette: 3,
    firearms: 2,
    melee: 1,
    stealth: 2,
    // Knowledges = 5
    academics: 2,
    finance: 2,
    politics: 1,
  };
  for (const [k, v] of Object.entries(v20Skills)) {
    state = setWizardSkill(state, k, v);
  }
  state = setWizardSkillSpecialty(state, 'etiquette', 'Elysium Protocol');

  // Step 4: 3 Clan Discipline dots (Dominate 2, Presence 1), 5 Backgrounds, 7 extra Virtues
  state = setWizardDiscipline(state, 'dominate', 2);
  state = setWizardDiscipline(state, 'presence', 1);
  state = toggleWizardDisciplinePower(state, 'dominate', 'v20_dominate_command');
  state = setWizardBackground(state, 'resources', 3);
  state = setWizardBackground(state, 'status', 2);
  state = {
    ...state,
    virtues: {
      conscience: 3, // +2
      selfControl: 4, // +3
      courage: 3, // +2 => total extra = 7; Humanity = 7, Willpower = 3
    },
    meritsFlaws: [
      { id: 'mf_v20_1', kind: 'merit', name: 'Natural Linguist', rating: 2 },
      { id: 'mf_v20_2', kind: 'flaw', name: 'Enemy', rating: 2, catalogId: 'enemy' },
    ],
    haven: {
      name: 'Old Observatory',
      location: 'Nocturne Heights',
      rating: 2,
      traits: ['library'],
      notes: 'Reinforced shutters',
    },
  };

  return state;
}

test('WOD_V5_PREDATOR_TYPES exposes all 10 official V5 predator types with discipline options and humanity modifiers', () => {
  assert.equal(WOD_V5_PREDATOR_TYPES.length, 10);
  const ids = WOD_V5_PREDATOR_TYPES.map((p) => p.id);
  assert.deepEqual(ids, [
    'alleycat',
    'bagger',
    'blood_leech',
    'cleaver',
    'consensualist',
    'farmer',
    'osiris',
    'sandman',
    'scene_queen',
    'siren',
  ]);
  assert.equal(getV5InitialHumanity({ predatorTypeId: 'consensualist' }), 8);
  assert.equal(getV5InitialHumanity({ predatorTypeId: 'alleycat' }), 6);
  assert.equal(getV5InitialHumanity({ predatorTypeId: 'siren' }), 7);
});

test('Complete V5 wizard state passes all strict validations and builds a schema-v2-valid sheet without Haven duplication', () => {
  const validateAjv = compileSchemaV2Validator();
  const state = buildValidV5WizardState();

  assert.equal(validateWizardStep(state, 1).valid, true);
  assert.equal(validateWizardStep(state, 2).valid, true);
  assert.equal(validateWizardStep(state, 3).valid, true);
  assert.equal(validateWizardStep(state, 4).valid, true);
  assert.equal(canCompleteWizard(state), true);

  assert.deepEqual(getSuggestedFreeSpecialtySkills(state), ['academics']);
  assert.equal(getV5InitialBloodPotency(state), 1);

  const sheet = buildSheetFromWodWizard(state, 'pt-BR');
  assert.equal(validateAjv(sheet), true, `Ajv errors: ${JSON.stringify(validateAjv.errors)}`);
  const localValidation = validateSheetPayload(sheet);
  assert.equal(
    localValidation.valid,
    true,
    `validateSheetPayload errors: ${localValidation.errors.join('; ')}`,
  );

  // Derived V5 values
  const evalRes = evaluateSheet(sheet);
  assert.equal(evalRes.variables.blood_potency, 1);
  assert.equal(evalRes.variables.humanity, 8);
  assert.equal(evalRes.variables.health, 6); // stamina 3 + 3
  assert.equal(evalRes.variables.willpower, 5); // composure 3 + resolve 2

  const healthField = sheet.cards
    .find((c) => c.id === 'card_combate')!
    .fields.find((f) => f.id === 'f_health')!;
  const wpField = sheet.cards
    .find((c) => c.id === 'card_combate')!
    .fields.find((f) => f.id === 'f_willpower')!;
  assert.equal(healthField.max, 6);
  assert.equal(wpField.max, 5);

  // Skill specialty stored via hint + rollSpecialty without unknown Schema fields
  const academicsField = sheet.cards
    .find((c) => c.id === 'card_skills')!
    .fields.find((f) => f.key === 'academics')!;
  assert.equal(academicsField.value, 1);
  assert.equal(academicsField.rollSpecialty, true);
  assert.equal(academicsField.hint, 'Architectural History');

  const rollableTraits = extractWodRollableTraits(sheet, 'pt-BR');
  const acTrait = rollableTraits.skills.find((s) => s.key === 'academics');
  assert.equal(acTrait?.specialty, true);
  assert.equal(acTrait?.specialtyLabel, 'Architectural History');

  // Disciplines have resolved clan affinity & V5 powers trigger ROUSE parsing
  const arcanoFields = sheet.cards.find((c) => c.id === 'card_arcano')!.fields;
  assert.equal(arcanoFields.find((f) => f.key === 'oblivion')?.value, 2);
  assert.equal(arcanoFields.find((f) => f.key === 'oblivion')?.xpCategory, 'discipline_clan');
  assert.equal(arcanoFields.find((f) => f.key === 'dominate')?.value, 1);
  assert.equal(arcanoFields.find((f) => f.key === 'dominate')?.xpCategory, 'discipline_clan');

  const powersRows = sheet.cards
    .find((c) => c.id === 'card_grimorio')!
    .fields.find((f) => f.id === 'f_lista_magias')!.rows!;
  assert.equal(powersRows.length, 3);
  assert.equal(
    powersRows.some((r) => parsePowerActivationCost(r.col2, 'vampire-v5').costType === 'rouse'),
    true,
  );

  // Clean separation: Backgrounds in card_backgrounds WITHOUT haven; Haven in sheet.havens
  const bgCard = sheet.cards.find((c) => c.id === 'card_backgrounds')!;
  assert.ok(bgCard);
  assert.equal(bgCard.fields.some((f) => f.key === 'haven' || f.id === 'f_adv_haven'), false);
  assert.equal(bgCard.fields.find((f) => f.key === 'contacts')?.value, 2);
  assert.equal(bgCard.fields.find((f) => f.key === 'resources')?.value, 1);

  assert.equal(sheet.havens?.length, 1);
  assert.equal(sheet.havens?.[0].name, 'Harbor Sub-Vault');
  assert.equal(sheet.havens?.[0].rating, 2);
  assert.deepEqual(sheet.havens?.[0].traits, ['postern', 'creepy']);
  assert.equal(sheet.meritsFlaws?.length, 2);
  assert.equal(sheet.touchstones?.length, 2);
});

test('Complete V20 wizard state passes all strict validations and builds a schema-v2-valid sheet with Blood Pool, Virtues, and no touchstones', () => {
  const validateAjv = compileSchemaV2Validator();
  const state = buildValidV20WizardState();

  assert.equal(validateWizardStep(state, 1).valid, true);
  assert.equal(validateWizardStep(state, 2).valid, true);
  assert.equal(validateWizardStep(state, 3).valid, true);
  assert.equal(validateWizardStep(state, 4).valid, true);
  assert.equal(canCompleteWizard(state), true);

  const sheet = buildSheetFromWodWizard(state, 'en');
  assert.equal(validateAjv(sheet), true, `Ajv errors: ${JSON.stringify(validateAjv.errors)}`);
  const localValidation = validateSheetPayload(sheet);
  assert.equal(
    localValidation.valid,
    true,
    `validateSheetPayload errors: ${localValidation.errors.join('; ')}`,
  );

  assert.equal(sheet.rulePreset, 'storyteller-v20');
  assert.equal(sheet.touchstones, undefined);
  assert.deepEqual(getSheetVirtues(sheet), { conscience: 3, selfControl: 4, courage: 3 });
  assert.deepEqual(getSheetBloodPool(sheet), { current: 12, max: 12 });

  const evalRes = evaluateSheet(sheet);
  assert.equal(evalRes.variables.humanity, 7); // 3 + 4
  assert.equal(evalRes.variables.willpower, 3); // courage 3

  const bgCard = sheet.cards.find((c) => c.id === 'card_backgrounds')!;
  assert.equal(bgCard.fields.some((f) => f.key === 'haven' || f.id === 'f_adv_haven'), false);
  assert.equal(bgCard.fields.find((f) => f.key === 'resources')?.value, 3);
  assert.equal(bgCard.fields.find((f) => f.key === 'status')?.value, 2);
  assert.equal(sheet.havens?.length, 1);
  assert.equal(sheet.meritsFlaws?.length, 2);
});

test('Strict rules enforce RAW budgets per step while strictRules: false (Free Mode) allows advancing and still produces schema-valid sheets', () => {
  const validateAjv = compileSchemaV2Validator();
  let state = createInitialWodWizardState('vampire-v5');

  // Step 1 incomplete
  assert.equal(canAdvanceFromStep(state, 1), false);
  assert.deepEqual(
    validateWizardStep(state, 1).issues.map((i) => i.code),
    ['name_required', 'clan_required'],
  );

  // Step 2 incomplete in V5
  assert.equal(canAdvanceFromStep(state, 2), false);
  assert.equal(validateWizardStep(state, 2).issues[0].code, 'v5_attributes_mismatch');

  // Step 3 mismatch in V5
  assert.equal(canAdvanceFromStep(state, 3), false);
  assert.equal(validateWizardStep(state, 3).issues[0].code, 'v5_skills_mismatch');

  // Step 4 invalid V5 split (3 in one discipline for standard clan) and missing powers/advantages/flaws/touchstones
  state = setWizardClan(state, 'brujah');
  state = { ...state, name: 'Rook', strictRules: false };
  state = setWizardDiscipline(state, 'potence', 3);
  assert.equal(canAdvanceFromStep(state, 4), true);
  assert.equal(canCompleteWizard(state), true);

  // Turning strictRules back ON surfaces all strict violations
  const strictState = { ...state, strictRules: true };
  assert.equal(canAdvanceFromStep(strictState, 4), false);
  const step4Codes = new Set(validateWizardStep(strictState, 4).issues.map((i) => i.code));
  assert.equal(step4Codes.has('v5_disciplines_clan_split'), true);
  assert.equal(step4Codes.has('v5_powers_mismatch'), true);
  assert.equal(step4Codes.has('v5_advantages_mismatch'), true);
  assert.equal(step4Codes.has('v5_flaws_mismatch'), true);
  assert.equal(step4Codes.has('v5_touchstones_mismatch'), true);

  // Free Mode sheet still passes schema.v2.json even with partial selections
  const freeSheet = buildSheetFromWodWizard(state, 'es');
  assert.equal(validateAjv(freeSheet), true, `Ajv errors: ${JSON.stringify(validateAjv.errors)}`);
  assert.equal(validateSheetPayload(freeSheet).valid, true);
});

test('V20 strict validation rejects skills above creation cap 3 and virtue/background mismatches', () => {
  let state = createInitialWodWizardState('storyteller-v20');
  state = setWizardClan(state, 'tremere');
  state = { ...state, name: 'Alden', strictRules: false };
  state = setWizardSkill(state, 'occult', 4);
  state = setWizardDiscipline(state, 'celerity', 3); // out of clan for Tremere

  const strictCheck = { ...state, strictRules: true };
  const s3Codes = new Set(validateWizardStep(strictCheck, 3).issues.map((i) => i.code));
  assert.equal(s3Codes.has('v20_skills_over_cap'), true);
  assert.equal(s3Codes.has('v20_skills_mismatch'), true);

  const s4Codes = new Set(validateWizardStep(strictCheck, 4).issues.map((i) => i.code));
  assert.equal(s4Codes.has('v20_disciplines_out_of_clan'), true);
  assert.equal(s4Codes.has('v20_backgrounds_mismatch'), true);
  assert.equal(s4Codes.has('v20_virtues_mismatch'), true);
});

test('Caitiff and Thin-Blood rules support free discipline allocation, Gen 14 auto-default, and Blood Potency 0', () => {
  let thinBlood = createInitialWodWizardState('vampire-v5');
  thinBlood = setWizardClan(thinBlood, 'thin_blood');
  assert.equal(thinBlood.generation, 14);
  assert.equal(getV5InitialBloodPotency(thinBlood), 0);

  thinBlood = setWizardDiscipline(thinBlood, 'thin_blood_alchemy', 3);
  thinBlood = toggleWizardDisciplinePower(thinBlood, 'thin_blood_alchemy', 'v5_tba_far_reach');
  thinBlood = toggleWizardDisciplinePower(thinBlood, 'thin_blood_alchemy', 'v5_tba_envelop');
  thinBlood = toggleWizardDisciplinePower(thinBlood, 'thin_blood_alchemy', 'v5_tba_profane_hieros_gamos');
  const tbSummary = getStep4DossierSummary(thinBlood);
  assert.equal(tbSummary.allowsFreeDisciplines, true);
  assert.equal(tbSummary.hasValidV5Split, true);
  assert.equal(tbSummary.powerGaps.length, 0);

  const tbSheet = buildSheetFromWodWizard(thinBlood, 'en');
  assert.equal(evaluateSheet(tbSheet).variables.blood_potency, 0);

  let caitiff = createInitialWodWizardState('vampire-v5');
  caitiff = setWizardClan(caitiff, 'caitiff');
  caitiff = setWizardDiscipline(caitiff, 'celerity', 2);
  caitiff = setWizardDiscipline(caitiff, 'obfuscate', 1);
  const caitiffSheet = buildSheetFromWodWizard(caitiff, 'en');
  const celerityField = caitiffSheet.cards
    .find((c) => c.id === 'card_arcano')!
    .fields.find((f) => f.key === 'celerity');
  assert.equal(celerityField?.xpCategory, 'discipline_caitiff');
});

test('Edition switching, custom clans, and V20 priority swapping maintain invariant state', () => {
  let state = createInitialWodWizardState('vampire-v5');
  state = setWizardClan(state, WOD_WIZARD_CUSTOM_VALUE);
  state = { ...state, customClanName: 'Bloodline Solaris' };
  state = setWizardAttribute(state, 'composure', 3);
  state = setWizardSkill(state, 'insight', 2);
  state = toggleWizardHavenTrait(state, 'library');

  // Switch V5 -> V20
  const v20State = setWizardEdition(state, 'storyteller-v20');
  assert.equal(v20State.edition, 'storyteller-v20');
  assert.equal(v20State.clanId, WOD_WIZARD_CUSTOM_VALUE);
  assert.equal(v20State.customClanName, 'Bloodline Solaris');
  assert.equal(v20State.attributes.appearance, 1);
  assert.equal(v20State.attributes.perception, 1);
  assert.equal(v20State.attributes.composure, undefined);
  assert.deepEqual(v20State.skills, {});

  // V20 priority bijection swap
  const swapped = assignV20AttributePriority(v20State, 'mental', 'primary');
  assert.deepEqual(swapped.v20AttributePriorities, {
    physical: 'tertiary',
    social: 'secondary',
    mental: 'primary',
  });

  const skillSwapped = assignV20SkillPriority(swapped, 'knowledges', 'primary');
  assert.deepEqual(skillSwapped.v20SkillPriorities, {
    talents: 'tertiary',
    skills: 'secondary',
    knowledges: 'primary',
  });

  // Summaries remain finite
  assert.equal(getStep2AttributeSummary(swapped).v20Groups[2].budget, 7);
  assert.equal(getStep3SkillSummary(skillSwapped).v20Groups[2].budget, 13);
});
