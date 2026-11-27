import test from 'node:test';
import assert from 'node:assert/strict';
import {
  type CharacterSheetState,
  createBlankSheet,
  createCyberpunkPreset,
  createDnd5ePreset,
  createGenericD20Preset,
  createWorldOfDarknessSheet,
  createWorldOfDarknessV5Sheet,
} from '../sheetModel.ts';
import {
  getSystemAdapter,
  listRegisteredSystems,
  registerSystemAdapter,
  unregisterSystemAdapter,
} from './registry.ts';
import type { SystemAdapter } from './types.ts';
import { wodAdapter } from './wodAdapter.ts';

test('registry lists built-in systems', () => {
  assert.deepEqual(listRegisteredSystems(), ['wod', 'dnd5e', 'cyberpunk', 'default']);
});

test('V5 resolves to wod adapter with wod-v5 layout and capabilities', () => {
  const sheet = createWorldOfDarknessV5Sheet();
  const adapter = getSystemAdapter(sheet);
  assert.equal(adapter.id, 'wod');
  assert.equal(adapter.progressionKind, 'wod-xp');
  assert.equal(adapter.i18nNamespace, 'wod');
  assert.equal(adapter.resolvePaperLayout?.(sheet), 'wod-v5');
  assert.deepEqual(adapter.capabilities, {
    supportsXp: true,
    supportsPoolComposer: true,
    supportsD20Advantage: false,
    supportsStructuredDossier: true,
    supportsPaperSheet: true,
  });
});

test('V20 resolves to wod adapter with wod-v20 layout', () => {
  const sheet = createWorldOfDarknessSheet();
  const adapter = getSystemAdapter(sheet);
  assert.equal(adapter.id, 'wod');
  assert.equal(adapter.progressionKind, 'wod-xp');
  assert.equal(adapter.paperLayout, 'wod-v20');
  assert.equal(adapter.resolvePaperLayout?.(sheet), 'wod-v20');
});

test('D&D 5e resolves to dnd5e adapter and capabilities', () => {
  const adapter = getSystemAdapter(createDnd5ePreset());
  assert.equal(adapter.id, 'dnd5e');
  assert.equal(adapter.progressionKind, 'dnd5e-leveling');
  assert.equal(adapter.paperLayout, 'dnd5e');
  assert.equal(adapter.i18nNamespace, 'dnd5e');
  assert.deepEqual(adapter.capabilities, {
    supportsXp: false,
    supportsPoolComposer: false,
    supportsD20Advantage: true,
    supportsStructuredDossier: false,
    supportsPaperSheet: true,
  });
});

test('Cyberpunk resolves to cyberpunk adapter and capabilities', () => {
  const adapter = getSystemAdapter(createCyberpunkPreset());
  assert.equal(adapter.id, 'cyberpunk');
  assert.equal(adapter.progressionKind, 'cyberpunk-ip');
  assert.equal(adapter.paperLayout, 'cyberpunk');
  assert.equal(adapter.i18nNamespace, 'cyberpunk');
  assert.deepEqual(adapter.capabilities, {
    supportsXp: false,
    supportsPoolComposer: false,
    supportsD20Advantage: false,
    supportsExplodingD10: true,
    supportsStructuredDossier: false,
    supportsPaperSheet: true,
  });
});

test('generic and blank sheets fall back to defaultAdapter', () => {
  for (const sheet of [createGenericD20Preset(), createBlankSheet()]) {
    const adapter = getSystemAdapter(sheet);
    assert.equal(adapter.id, 'default');
    assert.equal(adapter.progressionKind, 'generic-xp');
    assert.equal(adapter.paperLayout, 'generic');
    assert.equal(adapter.i18nNamespace, 'generic');
    assert.deepEqual(adapter.capabilities, {
      supportsXp: false,
      supportsPoolComposer: false,
      supportsD20Advantage: false,
      supportsStructuredDossier: false,
      supportsPaperSheet: true,
    });
  }
});

test('unknown system and nullish input fall back safely', () => {
  const unknown = { ...createBlankSheet(), systemId: 'shadowrun' } as unknown as CharacterSheetState;
  assert.equal(getSystemAdapter(unknown).id, 'default');
  assert.equal(getSystemAdapter(null).id, 'default');
  assert.equal(getSystemAdapter(undefined).id, 'default');
});

test('wodAdapter.matches rejects unknown presets and conflicting systemIds', () => {
  assert.equal(wodAdapter.matches('wod'), true);
  assert.equal(wodAdapter.matches('WOD'), true);
  assert.equal(wodAdapter.matches(undefined, 'vampire-v5'), true);
  assert.equal(wodAdapter.matches(undefined, 'vampire_v5'), true);
  assert.equal(wodAdapter.matches(undefined, 'storyteller-v20'), true);
  assert.equal(wodAdapter.matches(undefined, 'cyberpunk-red'), false);
  assert.equal(wodAdapter.matches(undefined, 'custom'), false);
  assert.equal(wodAdapter.matches(undefined, ''), false);
  assert.equal(wodAdapter.matches('blank', 'storyteller-v20'), false);
  assert.equal(wodAdapter.matches('dnd5e', 'vampire-v5'), false);
});

test('registerSystemAdapter adds, replaces, and unregisters custom adapters cleanly', () => {
  const customShadowrun: SystemAdapter = {
    id: 'shadowrun',
    matches: (systemId) => systemId === 'shadowrun',
    progressionKind: 'generic-xp',
    capabilities: {
      supportsXp: true,
      supportsPoolComposer: true,
      supportsD20Advantage: false,
      supportsStructuredDossier: false,
      supportsPaperSheet: true,
    },
    paperLayout: 'generic',
    i18nNamespace: 'shadowrun',
    migrateSheet: (sheet) => sheet,
  };
  const customSheet = { ...createBlankSheet(), systemId: 'shadowrun' } as unknown as CharacterSheetState;

  assert.throws(() => registerSystemAdapter({ ...customShadowrun, id: '   ' }));
  assert.equal(unregisterSystemAdapter('default'), false);

  try {
    registerSystemAdapter(customShadowrun);
    const srAdapter = getSystemAdapter(customSheet);
    assert.equal(srAdapter.id, 'shadowrun');
    assert.equal(srAdapter.progressionKind, 'generic-xp');
    assert.deepEqual(listRegisteredSystems(), ['wod', 'dnd5e', 'cyberpunk', 'default', 'shadowrun']);

    registerSystemAdapter({ ...customShadowrun, i18nNamespace: 'shadowrun-6e' });
    assert.equal(getSystemAdapter(customSheet).i18nNamespace, 'shadowrun-6e');
    assert.deepEqual(listRegisteredSystems(), ['wod', 'dnd5e', 'cyberpunk', 'default', 'shadowrun']);
  } finally {
    assert.equal(unregisterSystemAdapter('shadowrun'), true);
  }

  assert.equal(getSystemAdapter(customSheet).id, 'default');
  assert.deepEqual(listRegisteredSystems(), ['wod', 'dnd5e', 'cyberpunk', 'default']);
});

test('migrateSheet normalizes V5, V20, legacy D&D 5e, legacy Cyberpunk, and blank sheets without changing ownership', () => {
  const legacyDnd5e = {
    ...createDnd5ePreset(),
    id: '',
    systemId: undefined,
    dnd5eState: undefined,
  } as unknown as CharacterSheetState;

  const migratedDnd5e = getSystemAdapter(legacyDnd5e).migrateSheet(legacyDnd5e);
  assert.equal(migratedDnd5e.systemId, 'dnd5e');
  assert.ok(migratedDnd5e.id && migratedDnd5e.id.length > 0);
  assert.ok(migratedDnd5e.dnd5eState);
  assert.deepEqual(migratedDnd5e.dnd5eState.progression, {
    mode: 'xp',
    milestoneStyle: 'sessions',
    xpTotal: 0,
    sessionsCount: 0,
    sessionsPerLevel: 3,
    history: [],
  });
  assert.equal(getSystemAdapter(migratedDnd5e).id, 'dnd5e');

  const legacyCyberpunk = {
    ...createCyberpunkPreset(),
    id: '',
    systemId: undefined,
    cyberpunkState: undefined,
  } as unknown as CharacterSheetState;
  const migratedCyberpunk = getSystemAdapter(legacyCyberpunk).migrateSheet(legacyCyberpunk);
  assert.equal(migratedCyberpunk.systemId, 'cyberpunk');
  assert.ok(migratedCyberpunk.id && migratedCyberpunk.id.length > 0);
  assert.ok(migratedCyberpunk.cyberpunkState);
  assert.equal(migratedCyberpunk.cyberpunkState.armor.head.sp, 11);
  assert.equal(getSystemAdapter(migratedCyberpunk).id, 'cyberpunk');

  for (const sheet of [
    createWorldOfDarknessV5Sheet(),
    createWorldOfDarknessSheet(),
    createBlankSheet(),
  ]) {
    const adapter = getSystemAdapter(sheet);
    const migrated = adapter.migrateSheet(sheet);
    assert.equal(migrated.cards.length, sheet.cards.length);
    assert.equal(getSystemAdapter(migrated).id, adapter.id);
  }
});

test('loadCatalog is optional, absent on defaultAdapter, and resolves lazily on custom adapters', async () => {
  assert.equal(getSystemAdapter(createBlankSheet()).loadCatalog, undefined);
  assert.equal(getSystemAdapter(null).loadCatalog, undefined);

  const customWithCatalog: SystemAdapter = {
    id: 'catalog-test-sys',
    matches: (systemId) => systemId === 'catalog-test-sys',
    progressionKind: 'generic-xp',
    capabilities: {
      supportsXp: false,
      supportsPoolComposer: false,
      supportsD20Advantage: false,
      supportsStructuredDossier: false,
      supportsPaperSheet: true,
    },
    paperLayout: 'generic',
    i18nNamespace: 'generic',
    loadCatalog: async () => ({
      systemId: 'catalog-test-sys',
      attribution: 'Test SRD',
      sections: [
        {
          id: 'gear',
          label: { 'pt-BR': 'Equipamento', en: 'Gear', es: 'Equipo' },
          items: [
            {
              id: 'rope-50',
              sectionId: 'gear',
              name: { 'pt-BR': 'Corda', en: 'Rope', es: 'Cuerda' },
              summary: { 'pt-BR': '15m', en: '50ft', es: '15m' },
            },
          ],
        },
      ],
    }),
    migrateSheet: (sheet) => sheet,
  };

  registerSystemAdapter(customWithCatalog);
  try {
    const adapter = getSystemAdapter({
      ...createBlankSheet(),
      systemId: 'catalog-test-sys',
    } as unknown as CharacterSheetState);
    assert.equal(typeof adapter.loadCatalog, 'function');
    const catalog = await adapter.loadCatalog!();
    assert.equal(catalog.systemId, 'catalog-test-sys');
    assert.equal(catalog.sections[0]?.items[0]?.id, 'rope-50');
  } finally {
    unregisterSystemAdapter('catalog-test-sys');
  }
});
