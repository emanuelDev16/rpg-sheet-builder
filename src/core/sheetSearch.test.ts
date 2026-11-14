import test from 'node:test';
import assert from 'node:assert/strict';
import { filterCardsByQuery, normalizeSearchText } from './sheetSearch';
import { createWorldOfDarknessSheet } from './sheetModel';

test('normalizeSearchText strips accents and lowercases cleanly', () => {
  assert.equal(normalizeSearchText('  Força / Percepção  '), 'forca / percepcao');
});

test('filterCardsByQuery returns all cards when query is blank and narrows fields when filtering', () => {
  const wod = createWorldOfDarknessSheet();
  const tab1Cards = wod.cards.filter((c) => c.tab === 'geral');

  const all = filterCardsByQuery(tab1Cards, '   ');
  assert.equal(all.length, tab1Cards.length);
  assert.equal(all.every((entry) => !entry.isFiltered), true);

  // Filter for a specific skill ("brawl") -> matches BRAWL and MELEE / BRAWL inside Abilities card
  const brawlMatches = filterCardsByQuery(tab1Cards, 'brawl');
  assert.equal(brawlMatches.length, 1);
  assert.equal(brawlMatches[0].card.id, 'card_skills');
  assert.equal(brawlMatches[0].isFiltered, true);
  assert.deepEqual(
    brawlMatches[0].matchedFields.map((f) => f.id),
    ['f_brawl', 'f_roll_brawl'],
  );

  // Filter for "hunger" or "superficial" inside Vital Status card
  const hungerMatches = filterCardsByQuery(tab1Cards, 'hunger');
  assert.equal(hungerMatches.length, 1);
  assert.equal(hungerMatches[0].card.id, 'card_combate');
  // Card title 'HEALTH · WILLPOWER · HUNGER' matches, so full card stays visible
  assert.equal(hungerMatches[0].matchedFields.length, hungerMatches[0].totalFieldCount);

  const supMatches = filterCardsByQuery(tab1Cards, 'superficial');
  assert.equal(supMatches.length, 1);
  assert.equal(supMatches[0].card.id, 'card_combate');
  assert.equal(supMatches[0].isFiltered, true);
  assert.deepEqual(
    supMatches[0].matchedFields.map((f) => f.id),
    ['f_health'],
  );

  // Filter for non-existent term returns empty array
  const none = filterCardsByQuery(tab1Cards, 'nonexistent_xyz');
  assert.equal(none.length, 0);
});
