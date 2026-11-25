import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
  addFieldToCard,
  createDefaultSheet,
  createWorldOfDarknessV5Sheet,
  validateSheetPayload,
} from './sheetModel.ts';
import {
  WOD_ADVANTAGES_CATALOG,
  WOD_ADVANTAGE_GROUP_LABELS,
  WOD_FLAWS_CATALOG,
  WOD_HAVEN_TRAITS_CATALOG,
  buildCatalogAdvantageField,
  findAdvantageByIdOrName,
  findFlawByIdOrName,
  findHavenTraitByIdOrName,
  getAdvantagesForEdition,
  getFlawsForEdition,
  getHavenTraitsForEdition,
  isAdvantageCardCandidate,
  isCatalogAdvantagePresent,
} from './wodAdvantagesCatalog.ts';

const LANGUAGES = ['pt-BR', 'en', 'es'] as const;

const EXPECTED_V20_IDS = [
  'allies',
  'contacts',
  'domain',
  'fame',
  'generation',
  'herd',
  'influence',
  'mentor',
  'resources',
  'retainers',
  'status',
  'haven',
  'alternate_identity',
] as const;

const EXPECTED_V5_BACKGROUND_IDS = [
  'allies',
  'contacts',
  'fame',
  'influence',
  'haven',
  'herd',
  'mask',
  'mawla',
  'resources',
  'retainers',
  'status',
] as const;

const EXPECTED_V5_MERIT_IDS = [
  'linguistics',
  'looks',
  'bond_merit',
  'feeding_merit',
  'mythic_merit',
  'loresheet',
  'thin_blood_merit',
] as const;

test('Official WoD Advantages catalog exposes exact V20 (13) and V5 (11 backgrounds + 7 merits) rosters with pt-BR/en/es parity', () => {
  assert.equal(WOD_ADVANTAGES_CATALOG.length, 22);

  for (const group of ['background', 'merit', 'flaw'] as const) {
    for (const lang of LANGUAGES) {
      assert.ok(WOD_ADVANTAGE_GROUP_LABELS[group][lang].trim().length > 0);
    }
  }

  const v20All = getAdvantagesForEdition('storyteller-v20');
  assert.equal(v20All.length, 13);
  assert.deepEqual(
    v20All.map((e) => e.id).sort(),
    [...EXPECTED_V20_IDS].sort(),
  );
  assert.equal(getAdvantagesForEdition('storyteller-v20', 'merit').length, 0);

  const v5Backgrounds = getAdvantagesForEdition('vampire-v5', 'background');
  const v5Merits = getAdvantagesForEdition('vampire-v5', 'merit');
  const v5All = getAdvantagesForEdition('vampire-v5');
  assert.equal(v5Backgrounds.length, 11);
  assert.equal(v5Merits.length, 7);
  assert.equal(v5All.length, 18);
  assert.deepEqual(
    v5Backgrounds.map((e) => e.id).sort(),
    [...EXPECTED_V5_BACKGROUND_IDS].sort(),
  );
  assert.deepEqual(
    v5Merits.map((e) => e.id).sort(),
    [...EXPECTED_V5_MERIT_IDS].sort(),
  );

  for (const entry of WOD_ADVANTAGES_CATALOG) {
    assert.equal(entry.maxDots, 5);
    assert.ok(entry.editions.length >= 1);
    for (const lang of LANGUAGES) {
      assert.ok(entry.name[lang].trim().length > 0, `Missing name (${lang}) for ${entry.id}`);
      assert.ok(
        entry.summary[lang].trim().length > 0,
        `Missing summary (${lang}) for ${entry.id}`,
      );
    }
  }
});

test('findAdvantageByIdOrName handles accents, casing, all 3 languages, and edition boundaries', () => {
  assert.equal(findAdvantageByIdOrName('Refúgio', 'storyteller-v20')?.id, 'haven');
  assert.equal(findAdvantageByIdOrName('haven', 'vampire-v5')?.id, 'haven');
  assert.equal(findAdvantageByIdOrName('REFUGIO', 'vampire-v5')?.id, 'haven');
  assert.equal(findAdvantageByIdOrName('Geração', 'storyteller-v20')?.id, 'generation');
  assert.equal(findAdvantageByIdOrName('Generación', 'storyteller-v20')?.id, 'generation');
  assert.equal(
    findAdvantageByIdOrName('Identidade Alternativa', 'storyteller-v20')?.id,
    'alternate_identity',
  );
  assert.equal(findAdvantageByIdOrName('Máscara', 'vampire-v5')?.id, 'mask');
  assert.equal(findAdvantageByIdOrName('Mawla', 'vampire-v5')?.id, 'mawla');
  assert.equal(findAdvantageByIdOrName('Linguística', 'vampire-v5')?.id, 'linguistics');
  assert.equal(findAdvantageByIdOrName('Hoja de Trasfondo', 'vampire-v5')?.id, 'loresheet');
  assert.equal(findAdvantageByIdOrName('Sangue-Fraco', 'vampire-v5')?.id, 'thin_blood_merit');

  // Edition isolation
  assert.equal(findAdvantageByIdOrName('mawla', 'storyteller-v20'), null);
  assert.equal(findAdvantageByIdOrName('mask', 'storyteller-v20'), null);
  assert.equal(findAdvantageByIdOrName('loresheet', 'storyteller-v20'), null);
  assert.equal(findAdvantageByIdOrName('mentor', 'vampire-v5'), null);
  assert.equal(findAdvantageByIdOrName('generation', 'vampire-v5'), null);
  assert.equal(findAdvantageByIdOrName('', 'vampire-v5'), null);
});

test('isAdvantageCardCandidate identifies background/advantage cards without hijacking discipline power cards', () => {
  assert.equal(
    isAdvantageCardCandidate({ id: 'card_backgrounds', code: '//ANTECEDENTES', title: 'ANTECEDENTES & VANTAGENS' }),
    true,
  );
  assert.equal(
    isAdvantageCardCandidate({ id: 'c_custom', code: '//TRASFONDOS', title: 'TRASFONDOS Y VENTAJAS' }),
    true,
  );
  assert.equal(
    isAdvantageCardCandidate({ id: 'c_merits', code: '//MERITS', title: 'MERITS & FLAWS' }),
    true,
  );
  assert.equal(
    isAdvantageCardCandidate({ id: 'card_grimorio', code: '//MERITS_&_POWERS', title: 'DISCIPLINE POWERS & MERITS' }),
    false,
  );
  assert.equal(
    isAdvantageCardCandidate({ id: 'card_arcano', code: '//DISCIPLINES', title: 'DISCIPLINES & OCCULT' }),
    false,
  );
  assert.equal(
    isAdvantageCardCandidate({ id: 'card_skills', code: '//SKILLS_&_POOLS', title: 'ABILITIES & DICE POOLS' }),
    false,
  );
});

test('isCatalogAdvantagePresent avoids f_generation false positive and buildCatalogAdvantageField validates against schema.v2.json', () => {
  const schemaRaw = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'shared/presets/schema.v2.json'), 'utf8'),
  ) as Record<string, unknown>;
  const AjvCtor = (Ajv2020 as unknown as { default?: typeof Ajv2020 }).default ?? Ajv2020;
  const ajv = new AjvCtor({ allErrors: true, strict: false });
  const applyFormats = (addFormats as unknown as { default?: typeof addFormats }).default ?? addFormats;
  applyFormats(ajv);
  const validateAjv = ajv.compile(schemaRaw);

  const v20 = createDefaultSheet();
  assert.equal(isCatalogAdvantagePresent(v20, 'generation', 'storyteller-v20'), false);
  assert.equal(isCatalogAdvantagePresent(v20, 'resources', 'storyteller-v20'), false);

  const genEntry = findAdvantageByIdOrName('generation', 'storyteller-v20')!;
  const genField = buildCatalogAdvantageField(genEntry, 'pt-BR', 2);
  assert.equal(genField.key, 'generation_bg');
  assert.equal(genField.xpCategory, 'advantage');
  assert.equal(genField.max, 5);
  assert.equal(genField.value, 2);

  const v20WithBgCard = {
    ...v20,
    cards: [
      ...v20.cards,
      {
        id: 'card_backgrounds',
        tab: 'geral' as const,
        code: '//ANTECEDENTES',
        title: 'ANTECEDENTES & VANTAGENS',
        colSpan: 1 as const,
        fields: [genField],
      },
    ],
  };
  assert.equal(isCatalogAdvantagePresent(v20WithBgCard, 'generation', 'storyteller-v20'), true);
  assert.equal(validateAjv(v20WithBgCard), true, `AJV errors: ${JSON.stringify(validateAjv.errors)}`);
  assert.equal(validateSheetPayload(v20WithBgCard).valid, true);

  const v5 = createWorldOfDarknessV5Sheet();
  const loresheetEntry = findAdvantageByIdOrName('loresheet', 'vampire-v5')!;
  const loreField = buildCatalogAdvantageField(loresheetEntry, 'es', 99);
  assert.equal(loreField.value, 5);
  assert.equal(loreField.max, 5);
  assert.equal(loreField.xpCategory, 'advantage');
  assert.equal(loreField.label, 'HOJA DE TRASFONDO (LORESHEET)');

  const v5Mutated = addFieldToCard(
    {
      ...v5,
      cards: [
        ...v5.cards,
        {
          id: 'card_backgrounds',
          tab: 'geral' as const,
          code: '//ANTECEDENTES',
          title: 'ANTECEDENTES & VANTAGENS',
          colSpan: 1 as const,
          fields: [],
        },
      ],
    },
    'card_backgrounds',
    loreField,
  );
  assert.equal(isCatalogAdvantagePresent(v5Mutated, 'loresheet', 'vampire-v5'), true);
  assert.equal(validateAjv(v5Mutated), true, `V5 AJV errors: ${JSON.stringify(validateAjv.errors)}`);
  assert.equal(validateSheetPayload(v5Mutated).valid, true);
});

const EXPECTED_V5_FLAW_IDS = [
  'prey_exclusion',
  'methuselahs_thirst',
  'folkloric_bane',
  'folkloric_block',
  'stigmata',
  'known_blankbody',
  'adversary',
  'dark_secret',
  'despised',
  'suspect',
  'haunted',
  'compromised_haven',
] as const;

const EXPECTED_V20_FLAW_IDS = [
  'prey_exclusion',
  'dark_secret',
  'enemy',
  'hunted',
  'nightmares',
  'short_fuse',
  'bad_sight',
  'repulsive',
  'cursed',
  'notoriety',
] as const;

const EXPECTED_HAVEN_TRAIT_IDS = [
  'hidden_armory',
  'cell',
  'watchmen',
  'laboratory',
  'library',
  'location',
  'luxury',
  'postern',
  'security_system',
  'surgery',
  'warding',
  'creepy',
  'haunted',
] as const;

test('Official WoD Flaws & Haven Traits catalogs expose complete V5/V20 rosters with pt-BR/en/es parity', () => {
  assert.equal(WOD_FLAWS_CATALOG.length, 20);
  const v5Flaws = getFlawsForEdition('vampire-v5');
  const v20Flaws = getFlawsForEdition('storyteller-v20');

  assert.equal(v5Flaws.length, 12);
  assert.equal(v20Flaws.length, 10);
  assert.deepEqual(
    v5Flaws.map((f) => f.id).sort(),
    [...EXPECTED_V5_FLAW_IDS].sort(),
  );
  assert.deepEqual(
    v20Flaws.map((f) => f.id).sort(),
    [...EXPECTED_V20_FLAW_IDS].sort(),
  );
  assert.deepEqual(getAdvantagesForEdition('vampire-v5', 'flaw'), v5Flaws);
  assert.deepEqual(getAdvantagesForEdition('storyteller-v20', 'flaw'), v20Flaws);

  for (const flaw of WOD_FLAWS_CATALOG) {
    assert.equal(flaw.group, 'flaw');
    assert.equal(flaw.maxDots, 5);
    for (const lang of LANGUAGES) {
      assert.ok(flaw.name[lang].trim().length > 0, `Missing flaw name (${lang}) for ${flaw.id}`);
      assert.ok(
        flaw.summary[lang].trim().length > 0,
        `Missing flaw summary (${lang}) for ${flaw.id}`,
      );
    }
  }

  assert.equal(findFlawByIdOrName('Sede de Matusalém', 'vampire-v5')?.id, 'methuselahs_thirst');
  assert.equal(findFlawByIdOrName('methuselahs_thirst', 'storyteller-v20'), null);
  assert.equal(findFlawByIdOrName('Pavio Curto', 'storyteller-v20')?.id, 'short_fuse');
  assert.equal(findFlawByIdOrName('short_fuse', 'vampire-v5'), null);
  assert.equal(findFlawByIdOrName('Exclusión de Presa', 'vampire-v5')?.id, 'prey_exclusion');
  assert.equal(findFlawByIdOrName('Segredo Sombrio', 'storyteller-v20')?.id, 'dark_secret');

  assert.equal(WOD_HAVEN_TRAITS_CATALOG.length, 13);
  for (const edition of ['vampire-v5', 'storyteller-v20'] as const) {
    const allTraits = getHavenTraitsForEdition(edition);
    const merits = getHavenTraitsForEdition(edition, 'merit');
    const flaws = getHavenTraitsForEdition(edition, 'flaw');
    assert.equal(allTraits.length, 13);
    assert.equal(merits.length, 11);
    assert.equal(flaws.length, 2);
    assert.deepEqual(
      allTraits.map((t) => t.id).sort(),
      [...EXPECTED_HAVEN_TRAIT_IDS].sort(),
    );
  }

  for (const trait of WOD_HAVEN_TRAITS_CATALOG) {
    assert.ok(trait.maxDots >= 1 && trait.maxDots <= 5);
    for (const lang of LANGUAGES) {
      assert.ok(trait.name[lang].trim().length > 0, `Missing haven trait name (${lang}) for ${trait.id}`);
      assert.ok(
        trait.summary[lang].trim().length > 0,
        `Missing haven trait summary (${lang}) for ${trait.id}`,
      );
    }
  }

  assert.equal(findHavenTraitByIdOrName('Arsenal Oculto', 'vampire-v5')?.id, 'hidden_armory');
  assert.equal(findHavenTraitByIdOrName('Protección Mística', 'storyteller-v20')?.id, 'warding');
  assert.equal(findHavenTraitByIdOrName('Sinistro', 'vampire-v5')?.kind, 'flaw');

  assert.equal(
    isAdvantageCardCandidate({
      id: 'card_wod_dossier',
      code: '//CHRONICLE_TRAITS',
      title: 'CONVICTIONS, QUALITIES & HAVENS',
    }),
    false,
  );
});
