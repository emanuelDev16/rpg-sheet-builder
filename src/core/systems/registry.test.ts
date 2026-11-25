import test from 'node:test';
import assert from 'node:assert/strict';
import {
  type CharacterSheetState,
  createBlankSheet,
  createCyberpunkPreset,
  createDnd5ePreset,
  createWorldOfDarknessSheet,
  createWorldOfDarknessV5Sheet,
} from '../sheetModel.ts';
import { getSystemAdapter, listRegisteredSystems } from './registry.ts';

test('registry lists built-in systems', () => {
  assert.deepEqual(listRegisteredSystems(), ['wod', 'dnd5e', 'default']);
});

test('V5 resolves to wod adapter with wod-v5 layout', () => {
  const sheet = createWorldOfDarknessV5Sheet();
  const adapter = getSystemAdapter(sheet);
  assert.equal(adapter.id, 'wod');
  assert.equal(adapter.resolvePaperLayout?.(sheet), 'wod-v5');
  assert.equal(adapter.capabilities.supportsPoolComposer, true);
});

test('V20 resolves to wod adapter with wod-v20 layout', () => {
  const sheet = createWorldOfDarknessSheet();
  const adapter = getSystemAdapter(sheet);
  assert.equal(adapter.id, 'wod');
  assert.equal(adapter.resolvePaperLayout?.(sheet), 'wod-v20');
});

test('D&D 5e resolves to dnd5e adapter', () => {
  const adapter = getSystemAdapter(createDnd5ePreset());
  assert.equal(adapter.id, 'dnd5e');
  assert.equal(adapter.paperLayout, 'dnd5e');
  assert.equal(adapter.capabilities.supportsD20Advantage, true);
});

test('Cyberpunk still falls back to defaultAdapter', () => {
  assert.equal(getSystemAdapter(createCyberpunkPreset()).id, 'default');
});

test('blank sheet falls back to defaultAdapter', () => {
  assert.equal(getSystemAdapter(createBlankSheet()).id, 'default');
});

test('unknown system and nullish input fall back safely', () => {
  const unknown = { ...createBlankSheet(), systemId: 'shadowrun' } as unknown as CharacterSheetState;
  assert.equal(getSystemAdapter(unknown).id, 'default');
  assert.equal(getSystemAdapter(null).id, 'default');
});

test('migrateSheet delegates without throwing for each adapter', () => {
  for (const sheet of [createWorldOfDarknessV5Sheet(), createDnd5ePreset(), createBlankSheet()]) {
    const migrated = getSystemAdapter(sheet).migrateSheet(sheet);
    assert.equal(migrated.cards.length, sheet.cards.length);
  }
});
