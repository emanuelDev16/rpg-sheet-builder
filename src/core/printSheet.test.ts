import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPrintDocumentTitle,
  getActiveTabSectionLabel,
  getTabLabelsForSystem,
  printActiveSheetView,
} from './printSheet';
import { createDnd5ePreset, createWorldOfDarknessSheet } from './sheetModel';

test('getTabLabelsForSystem and getActiveTabSectionLabel match system and active tab', () => {
  assert.deepEqual(getTabLabelsForSystem('wod'), {
    tab1: '/01 ATTRIBUTES & COMBAT',
    tab2: '/02 DISCIPLINES & NOTES',
    tab3: '/03 XP & UPGRADES',
  });
  assert.equal(getActiveTabSectionLabel('dnd5e', 'magias'), '/02 SPELLS & NOTES');
  assert.equal(getActiveTabSectionLabel('blank', 'geral'), '/01 FICHA PRINCIPAL');
  assert.equal(getActiveTabSectionLabel('wod', 'xp'), '/03 XP & UPGRADES');
});

test('buildPrintDocumentTitle produces a clean OS-safe PDF filename title', () => {
  const wod = createWorldOfDarknessSheet();
  const title = buildPrintDocumentTitle(wod, 'geral');
  assert.equal(title, 'GRID_SHEET-JULIAN_CROSS_NEONATE_VENTRUE-01_ATTRIBUTES_COMBAT');

  const dnd = createDnd5ePreset();
  const xpTitle = buildPrintDocumentTitle(dnd, 'xp');
  assert.equal(xpTitle, 'GRID_SHEET-LYRA_VANCE_ELDRITCH_KNIGHT_LV_5-03_XP_UPGRADES');
});

test('printActiveSheetView sets PDF title, invokes print, and restores previous title on afterprint', () => {
  const wod = createWorldOfDarknessSheet();
  const mockDoc = { title: 'GRID//SHEET' };
  const listeners: Record<string, Array<() => void>> = {};
  let printed = false;
  let titleDuringPrint = '';

  const mockWin = {
    print: () => {
      printed = true;
      titleDuringPrint = mockDoc.title;
    },
    addEventListener: (event: string, cb: () => void) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(cb);
    },
    removeEventListener: (event: string, cb: () => void) => {
      listeners[event] = (listeners[event] || []).filter((fn) => fn !== cb);
    },
    setTimeout: (() => 0) as unknown as typeof window.setTimeout,
  };

  const result = printActiveSheetView(wod, 'magias', { doc: mockDoc, win: mockWin });
  assert.equal(result.ok, true);
  assert.equal(printed, true);
  assert.equal(titleDuringPrint, 'GRID_SHEET-JULIAN_CROSS_NEONATE_VENTRUE-02_DISCIPLINES_NOTES');
  assert.equal(mockDoc.title, titleDuringPrint);

  // Simulate browser afterprint event
  for (const cb of listeners['afterprint'] || []) cb();
  assert.equal(mockDoc.title, 'GRID//SHEET');
});
