import test from 'node:test';
import assert from 'node:assert/strict';
import { getLocalizedTabLabels, getTranslations, isValidLanguage, LANGUAGE_OPTIONS } from './i18n';

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

test('getTranslations returns distinct localized strings for PT-BR, EN, and ES', () => {
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
});

test('getLocalizedTabLabels adapts tab labels to system and language', () => {
  assert.equal(getLocalizedTabLabels('wod', 'es').tab1, '/01 ATRIBUTOS Y COMBATE');
  assert.equal(getLocalizedTabLabels('blank', 'en').tab1, '/01 MAIN SHEET');
  assert.equal(getLocalizedTabLabels('dnd5e', 'pt-BR').tab2, '/02 SPELLS & NOTES');
});
