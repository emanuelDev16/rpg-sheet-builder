import test from 'node:test';
import assert from 'node:assert/strict';
import {
  V20_SKILLS_CATALOG,
  V5_SKILLS_CATALOG,
  buildCatalogSkillFields,
  getGroupedWodSkillsCatalog,
  isCatalogSkillPresent,
  isOfficialVampireSheet,
} from './wodSkillsCatalog.ts';

test('Official WoD catalog exposes 30 V20 abilities (10/10/10) and 27 V5 skills (9/9/9)', () => {
  assert.equal(V20_SKILLS_CATALOG.length, 30);
  const v20Groups = getGroupedWodSkillsCatalog('storyteller-v20');
  assert.deepEqual(
    v20Groups.map((g) => [g.category, g.skills.length]),
    [
      ['talents', 10],
      ['skills', 10],
      ['knowledges', 10],
    ],
  );

  assert.equal(V5_SKILLS_CATALOG.length, 27);
  const v5Groups = getGroupedWodSkillsCatalog('vampire-v5');
  assert.deepEqual(
    v5Groups.map((g) => [g.category, g.skills.length]),
    [
      ['physical', 9],
      ['social', 9],
      ['mental', 9],
    ],
  );
});

test('Official catalog routing enables only for WoD V20/V5 and stays off for Custom or Blank sheets', () => {
  assert.equal(isOfficialVampireSheet('wod', 'storyteller-v20'), true);
  assert.equal(isOfficialVampireSheet('wod', 'vampire-v5'), true);
  assert.equal(isOfficialVampireSheet('wod', 'custom'), false);
  assert.equal(isOfficialVampireSheet('blank', 'storyteller-v20'), false);
  assert.equal(isOfficialVampireSheet('dnd5e', 'storyteller-v20'), false);
});

test('Official catalog search, duplicate detection, and edition field generation', () => {
  const filteredV5 = getGroupedWodSkillsCatalog('vampire-v5', 'sagacidade');
  assert.equal(filteredV5.length, 1);
  assert.equal(filteredV5[0].skills[0].varName, 'insight');

  const brawlV20 = V20_SKILLS_CATALOG.find((s) => s.varName === 'brawl');
  assert.ok(brawlV20);
  assert.equal(isCatalogSkillPresent(brawlV20, ['strength', 'brawl', 'stealth']), true);
  assert.equal(isCatalogSkillPresent(brawlV20, ['strength', 'stealth']), false);

  const v20Fields = buildCatalogSkillFields(brawlV20, 'storyteller-v20', 'pt-BR', {
    strength: 3,
  });
  assert.equal(v20Fields.length, 2);
  assert.equal(v20Fields[0].xpCategory, 'skill');
  assert.equal(v20Fields[1].rollDifficulty, 6);
  assert.equal(v20Fields[1].rollSpecialty, false);
  assert.equal(v20Fields[1].rollExpr, 'pool(strength + brawl, 6)');

  const insightV5 = V5_SKILLS_CATALOG.find((s) => s.varName === 'insight');
  assert.ok(insightV5);
  const v5Fields = buildCatalogSkillFields(insightV5, 'vampire-v5', 'pt-BR', {
    wits: 3,
  });
  assert.equal(v5Fields.length, 2);
  assert.equal(v5Fields[0].xpCategory, 'skill');
  assert.equal(v5Fields[1].rollDifficulty, 2);
  assert.equal(v5Fields[1].rollDifficultyV5, 2);
  assert.equal(v5Fields[1].rollSpecialty, false);
  assert.equal(v5Fields[1].rollExpr, 'pool(wits + insight, 2)');
});
