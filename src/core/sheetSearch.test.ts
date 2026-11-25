import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countStructuredWodMatches,
  filterCardsByQuery,
  normalizeSearchText,
} from './sheetSearch';
import {
  createDnd5ePreset,
  createWorldOfDarknessSheet,
  createWorldOfDarknessV5Sheet,
} from './sheetModel';

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

test('filterCardsByQuery indexes V5 touchstones, V5/V20 meritsFlaws, and havens (including localized traits) while isolating non-WoD/custom', () => {
  const v5 = createWorldOfDarknessV5Sheet();
  const v5Tab2Cards = v5.cards.filter((c) => c.tab === 'magias');
  const v5Ctx = {
    systemId: 'wod' as const,
    rulePreset: 'vampire-v5' as const,
    touchstones: v5.touchstones,
    meritsFlaws: v5.meritsFlaws,
    havens: [
      {
        id: 'hv_search_1',
        name: 'Cripta Portuária',
        location: 'Cais 14',
        rating: 3,
        traits: ['hidden_armory', 'security_system'],
        notes: 'Túnel secreto para fuga noturna.',
      },
    ],
  };

  // Matches V5 Touchstone / Conviction / Notes
  const touchMatch = filterCardsByQuery(v5Tab2Cards, 'Mateo Voss', v5Ctx);
  assert.equal(touchMatch.length, 1);
  assert.equal(touchMatch[0].card.id, 'card_wod_dossier');
  assert.equal(touchMatch[0].structuredMatchesCount, 1);

  const convMatch = filterCardsByQuery(v5Tab2Cards, 'oath sealed in blood', v5Ctx);
  assert.equal(convMatch.length, 1);
  assert.equal(convMatch[0].card.id, 'card_wod_dossier');

  // Matches Merit/Flaw by localized name / catalog alias / notes (accent-insensitive)
  const flawMatch = filterCardsByQuery(v5Tab2Cards, 'Segredo Sombrio', v5Ctx);
  assert.equal(flawMatch.length, 1);
  assert.equal(flawMatch[0].card.id, 'card_wod_dossier');
  assert.equal(flawMatch[0].structuredMatchesCount, 1);

  const meritMatch = filterCardsByQuery(v5Tab2Cards, 'Venetian', v5Ctx);
  assert.equal(meritMatch.length, 1);
  assert.equal(meritMatch[0].card.id, 'card_wod_dossier');

  // Matches Haven by name, location, and localized trait name ("Arsenal Oculto" / "Security System")
  const havenTraitPt = filterCardsByQuery(v5Tab2Cards, 'Arsenal Oculto', v5Ctx);
  assert.equal(havenTraitPt.length, 1);
  assert.equal(havenTraitPt[0].card.id, 'card_wod_dossier');
  assert.equal(havenTraitPt[0].structuredMatchesCount, 1);

  const havenLoc = filterCardsByQuery(v5Tab2Cards, 'Cais 14', v5Ctx);
  assert.equal(havenLoc.length, 1);
  assert.equal(havenLoc[0].card.id, 'card_wod_dossier');

  // V20 ignores touchstones even if present in context, while still indexing meritsFlaws & havens
  const v20 = createWorldOfDarknessSheet();
  const v20Tab2Cards = v20.cards.filter((c) => c.tab === 'magias');
  const v20Ctx = {
    systemId: 'wod' as const,
    rulePreset: 'storyteller-v20' as const,
    touchstones: v5.touchstones,
    meritsFlaws: v20.meritsFlaws,
    havens: v20.havens,
  };
  assert.equal(filterCardsByQuery(v20Tab2Cards, 'Mateo Voss', v20Ctx).length, 0);
  const v20HavenMatch = filterCardsByQuery(v20Tab2Cards, 'Nocturne Heights', v20Ctx);
  assert.equal(v20HavenMatch.length, 1);
  assert.equal(v20HavenMatch[0].card.id, 'card_wod_dossier');

  // Non-WoD and custom rulePreset return 0 structured matches
  const dnd = createDnd5ePreset();
  assert.equal(
    countStructuredWodMatches(
      {
        systemId: 'dnd5e',
        rulePreset: 'storyteller-v20',
        touchstones: v5.touchstones,
        meritsFlaws: v5.meritsFlaws,
        havens: v5Ctx.havens,
      },
      normalizeSearchText('Mateo Voss'),
    ),
    0,
  );
  assert.equal(
    countStructuredWodMatches(
      {
        systemId: 'wod',
        rulePreset: 'custom',
        touchstones: v5.touchstones,
        meritsFlaws: v5.meritsFlaws,
        havens: v5Ctx.havens,
      },
      normalizeSearchText('Arsenal Oculto'),
    ),
    0,
  );
  assert.equal(dnd.cards.some((c) => c.id === 'card_wod_dossier'), false);
});
