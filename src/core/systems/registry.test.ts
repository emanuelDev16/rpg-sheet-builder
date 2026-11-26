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
  assert.deepEqual(listRegisteredSystems(), ['wod', 'dnd5e', 'default']);
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

test('Cyberpunk, generic, and blank sheets fall back to defaultAdapter', () => {
  for (const sheet of [createCyberpunkPreset(), createGenericD20Preset(), createBlankSheet()]) {
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
  const customCyberpunk: SystemAdapter = {
    id: 'cyberpunk',
    matches: (systemId) => systemId === 'cyberpunk',
    progressionKind: 'cyberpunk-ip',
    capabilities: {
      supportsXp: true,
      supportsPoolComposer: false,
      supportsD20Advantage: false,
      supportsStructuredDossier: false,
      supportsPaperSheet: true,
    },
    paperLayout: 'generic',
    i18nNamespace: 'cyberpunk',
    migrateSheet: (sheet) => sheet,
  };

  assert.throws(() => registerSystemAdapter({ ...customCyberpunk, id: '   ' }));
  assert.equal(unregisterSystemAdapter('default'), false);

  try {
    registerSystemAdapter(customCyberpunk);
    const cpAdapter = getSystemAdapter(createCyberpunkPreset());
    assert.equal(cpAdapter.id, 'cyberpunk');
    assert.equal(cpAdapter.progressionKind, 'cyberpunk-ip');
    assert.deepEqual(listRegisteredSystems(), ['wod', 'dnd5e', 'default', 'cyberpunk']);

    registerSystemAdapter({ ...customCyberpunk, i18nNamespace: 'cyberpunk-red' });
    assert.equal(getSystemAdapter(createCyberpunkPreset()).i18nNamespace, 'cyberpunk-red');
    assert.deepEqual(listRegisteredSystems(), ['wod', 'dnd5e', 'default', 'cyberpunk']);
  } finally {
    assert.equal(unregisterSystemAdapter('cyberpunk'), true);
  }

  assert.equal(getSystemAdapter(createCyberpunkPreset()).id, 'default');
  assert.deepEqual(listRegisteredSystems(), ['wod', 'dnd5e', 'default']);
});

test('migrateSheet normalizes V5, V20, legacy D&D 5e, and blank sheets without changing ownership', () => {
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
