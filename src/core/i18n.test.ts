import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EN,
  ES,
  getLocalizedSystemOptions,
  getLocalizedTabLabels,
  getTranslations,
  isValidLanguage,
  LANGUAGE_OPTIONS,
  normalizeLanguage,
  PT_BR,
  translate,
} from './i18n';
import { getCostRulesSummary, awardXp } from './xpSystem';
import { formatRoomSyncIndicator } from './roomSync';
import { validateRulesQuery } from './rulesSearch';
import { createWorldOfDarknessSheet } from './sheetModel';

test('LANGUAGE_OPTIONS exposes PT-BR, English, and Spanish cleanly', () => {
  assert.deepEqual(
    LANGUAGE_OPTIONS.map((o) => o.id),
    ['pt-BR', 'en', 'es'],
  );
  assert.equal(isValidLanguage('pt-BR'), true);
  assert.equal(isValidLanguage('en'), true);
  assert.equal(isValidLanguage('es'), true);
  assert.equal(isValidLanguage('fr'), false);
});

test('normalizeLanguage maps legacy and regional locale codes safely', () => {
  assert.equal(normalizeLanguage('pt'), 'pt-BR');
  assert.equal(normalizeLanguage('pt_BR'), 'pt-BR');
  assert.equal(normalizeLanguage('en-US'), 'en');
  assert.equal(normalizeLanguage('es-419'), 'es');
  assert.equal(normalizeLanguage('fr-FR'), 'pt-BR');
  assert.equal(normalizeLanguage(null), 'pt-BR');
});

test('PT_BR, EN, and ES dictionaries share strict key parity and non-empty strings', () => {
  const ptKeys = Object.keys(PT_BR).sort();
  const enKeys = Object.keys(EN).sort();
  const esKeys = Object.keys(ES).sort();

  assert.deepEqual(enKeys, ptKeys);
  assert.deepEqual(esKeys, ptKeys);

  for (const key of ptKeys as Array<keyof typeof PT_BR>) {
    assert.ok(PT_BR[key].trim().length > 0, `Empty PT_BR value for ${key}`);
    assert.ok(EN[key].trim().length > 0, `Empty EN value for ${key}`);
    assert.ok(ES[key].trim().length > 0, `Empty ES value for ${key}`);
  }
});

test('getTranslations and translate interpolate variables in PT-BR, EN, and ES', () => {
  const pt = getTranslations('pt-BR');
  const en = getTranslations('en');
  const es = getTranslations('es');

  assert.equal(pt.topBar.newSheet, 'NOVA FICHA');
  assert.equal(en.topBar.newSheet, 'NEW SHEET');
  assert.equal(es.topBar.newSheet, 'NUEVA HOJA');

  assert.equal(pt.cards.superficialDmg, 'DANO SUPERFICIAL');
  assert.equal(en.cards.superficialDmg, 'SUPERFICIAL DMG');
  assert.equal(es.cards.superficialDmg, 'DAÑO SUPERFICIAL');

  assert.equal(pt.cards.aggravatedDmg, 'DANO AGRAVADO');
  assert.equal(en.cards.aggravatedDmg, 'AGGRAVATED DMG');
  assert.equal(es.cards.aggravatedDmg, 'DAÑO AGRAVADO');

  assert.equal(translate('es', 'xp.upgradeBtn', { cost: 12 }), 'MEJORA · 12 XP ↗');
  assert.equal(translate('en', 'xp.upgradeBtn', { cost: 12 }), 'UPGRADE · 12 XP ↗');
});

test('getLocalizedTabLabels and getLocalizedSystemOptions adapt to system and language', () => {
  assert.equal(getLocalizedTabLabels('wod', 'es').tab1, '/01 ATRIBUTOS Y COMBATE');
  assert.equal(getLocalizedTabLabels('blank', 'en').tab1, '/01 MAIN SHEET');
  assert.equal(getLocalizedTabLabels('dnd5e', 'pt-BR').tab2, '/02 MAGIAS & NOTAS');

  const enBlank = getLocalizedSystemOptions('en').find((o) => o.id === 'blank');
  const esBlank = getLocalizedSystemOptions('es').find((o) => o.id === 'blank');
  assert.equal(enBlank?.shortLabel, 'CUSTOM · SCRATCH');
  assert.equal(esBlank?.shortLabel, 'CUSTOM · DESDE CERO');
});

test('core helpers honor language parameter across xpSystem, roomSync, and rulesSearch', () => {
  const sheet = createWorldOfDarknessSheet();
  assert.match(getCostRulesSummary(sheet, 'en').join(' '), /ATTR.*×4/i);
  assert.match(getCostRulesSummary(sheet, 'es').join(' '), /ATRIB.*×4/i);

  const badAward = awardXp(sheet, 0, '', '12:00', 'x1', 'en');
  assert.equal(badAward.ok, false);
  assert.match(badAward.error ?? '', /non-zero/i);

  const syncEn = formatRoomSyncIndicator({ phase: 'syncing', nextSyncAtMillis: null, lastSyncedAtMillis: null }, 0, 'en');
  assert.equal(syncEn.label, 'ROOM SYNC: ...');
  assert.match(syncEn.tooltip, /local Room Database/i);

  const queryEs = validateRulesQuery('a', 'es');
  assert.equal(queryEs.ok, false);
  assert.match(queryEs.error ?? '', /al menos 2 caracteres/i);
});

