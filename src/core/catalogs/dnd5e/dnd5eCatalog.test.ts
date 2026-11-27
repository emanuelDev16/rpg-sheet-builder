import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesCatalogFilters, matchesCatalogQuery, normalizeCatalogText } from '../../systems/catalogTypes.ts';
import type { SystemCatalogItem } from '../../systems/catalogTypes.ts';
import {
  DND5E_SPELL_CLASSES, DND5E_SPELL_RESOLUTIONS, DND5E_SPELL_SCHOOLS,
  formatDnd5eGrimoireRow, loadDnd5eCatalog, parseDnd5eGrimoireMeta, tupleToDnd5eSpell,
} from './index.ts';
import { DND5E_SPELLS_LOW } from './spellsLow.ts';
import { DND5E_SPELLS_MID } from './spellsMid.ts';

const LANGS = ['pt-BR', 'en', 'es'] as const;
const ALL_SPELLS = [...DND5E_SPELLS_LOW, ...DND5E_SPELLS_MID];

function assertSpellBatch(
  tuples: readonly (typeof DND5E_SPELLS_LOW)[number][],
  minLevel: number,
  maxLevel: number,
  ids: Set<string>,
  namesByLang: Record<(typeof LANGS)[number], Set<string>>,
): Map<number, number> {
  const byLevel = new Map<number, number>();
  const classSet = new Set<string>(DND5E_SPELL_CLASSES);
  const schoolSet = new Set<string>(DND5E_SPELL_SCHOOLS);
  const resSet = new Set<string>(DND5E_SPELL_RESOLUTIONS);

  for (const tuple of tuples) {
    const s = tupleToDnd5eSpell(tuple);
    assert.match(s.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `invalid slug: ${s.id}`);
    assert.equal(ids.has(s.id), false, `duplicate spell id: ${s.id}`);
    ids.add(s.id);
    assert.ok(s.level >= minLevel && s.level <= maxLevel, `unexpected level for ${s.id}: ${s.level}`);
    byLevel.set(s.level, (byLevel.get(s.level) ?? 0) + 1);
    assert.ok(schoolSet.has(s.school), `invalid school for ${s.id}`);
    assert.ok(s.classes.length > 0 && new Set(s.classes).size === s.classes.length, `bad classes for ${s.id}`);
    for (const c of s.classes) assert.ok(classSet.has(c), `invalid class ${c} on ${s.id}`);
    assert.equal(typeof s.concentration, 'boolean');
    assert.equal(typeof s.ritual, 'boolean');
    assert.ok(resSet.has(s.resolution), `invalid resolution for ${s.id}`);
    for (const lang of LANGS) {
      const name = s.name[lang].trim();
      assert.ok(name.length > 0, `empty name.${lang} on ${s.id}`);
      assert.equal(name.includes('('), false, `parenthetical disambiguation in ${s.id} (${lang}): ${name}`);
      const normName = normalizeCatalogText(name);
      assert.equal(namesByLang[lang].has(normName), false, `duplicate name.${lang}: ${name}`);
      namesByLang[lang].add(normName);
      assert.ok(s.summary[lang].trim().length > 0, `empty summary.${lang} on ${s.id}`);
    }
  }
  return byLevel;
}

test('DND5E_SPELLS_LOW and DND5E_SPELLS_MID cover exact SRD 5.1 counts (0-5) without duplicates', () => {
  const ids = new Set<string>();
  const namesByLang: Record<(typeof LANGS)[number], Set<string>> = { 'pt-BR': new Set(), en: new Set(), es: new Set() };

  const lowByLevel = assertSpellBatch(DND5E_SPELLS_LOW, 0, 2, ids, namesByLang);
  assert.equal(lowByLevel.get(0), 24);
  assert.equal(lowByLevel.get(1), 49);
  assert.equal(lowByLevel.get(2), 54);
  assert.equal(DND5E_SPELLS_LOW.length, 127);

  const midByLevel = assertSpellBatch(DND5E_SPELLS_MID, 3, 5, ids, namesByLang);
  assert.equal(midByLevel.get(3), 42);
  assert.equal(midByLevel.get(4), 31);
  assert.equal(midByLevel.get(5), 37);
  assert.equal(DND5E_SPELLS_MID.length, 110);
  assert.equal(ids.size, 237);

  for (const required of [
    'eldritch-blast', 'hideous-laughter', 'acid-arrow', 'arcanists-magic-aura', 'floating-disk',
    'fireball', 'counterspell', 'tiny-hut', 'black-tentacles', 'faithful-hound',
    'private-sanctum', 'resilient-sphere', 'secret-chest', 'arcane-hand', 'telepathic-bond',
    'polymorph', 'wall-of-force',
  ]) {
    assert.ok(ids.has(required), `missing SRD spell ${required}`);
  }
  for (const nonSrd of [
    'hex', 'booming-blade', 'chromatic-orb', 'witch-bolt',
    'hunger-of-hadar', 'aura-of-vitality', 'feign-death', 'aura-of-life',
    'charm-monster', 'destructive-wave', 'synaptic-static',
  ]) {
    assert.equal(ids.has(nonSrd), false, `non-SRD spell leaked: ${nonSrd}`);
  }
});

test('loadDnd5eCatalog builds SystemCatalog lazily and supports search & filters', async () => {
  const cat = await loadDnd5eCatalog();
  assert.equal(cat.systemId, 'dnd5e');
  assert.ok(cat.attribution?.includes('SRD 5.1'));
  assert.equal(cat.sections.length, 1);
  const sec = cat.sections[0]!;
  assert.equal(sec.id, 'spells');
  assert.equal(sec.items.length, 237);
  assert.deepEqual(sec.filterGroups?.[0]?.options.map((o) => o.value), ['0', '1', '2', '3', '4', '5']);

  const warlockCantrips = sec.items.filter((i) => matchesCatalogFilters(i, { level: '0', classes: 'warlock' }));
  assert.ok(warlockCantrips.some((i) => i.id === 'eldritch-blast'));
  assert.equal(warlockCantrips.some((i) => i.id === 'fire-bolt'), false);

  const wizardLvl3 = sec.items.filter((i) => matchesCatalogFilters(i, { level: '3', classes: 'wizard' }));
  assert.ok(wizardLvl3.some((i) => i.id === 'fireball'));
  assert.equal(wizardLvl3.some((i) => i.id === 'spirit-guardians'), false);

  const qEs = normalizeCatalogText('Inmovilizar persona');
  assert.ok(sec.items.some((i) => i.id === 'hold-person' && matchesCatalogQuery(i, qEs)));
  assert.ok(sec.items.some((i) => i.id === 'wall-of-force' && matchesCatalogQuery(i, normalizeCatalogText('Muro de fuerza'))));
});

test('formatDnd5eGrimoireRow and parseDnd5eGrimoireMeta round-trip all spells in 3 languages', async () => {
  const cat = await loadDnd5eCatalog();
  const byId = new Map(cat.sections[0]!.items.map((i) => [i.id, i]));

  const fireBolt = tupleToDnd5eSpell(DND5E_SPELLS_LOW.find((t) => t[0] === 'fire-bolt')!);
  assert.deepEqual(formatDnd5eGrimoireRow(fireBolt, 'pt-BR'), { col1: 'Raio de Fogo', col2: 'TRUQUE · ATK' });
  assert.deepEqual(formatDnd5eGrimoireRow(byId.get('hold-person')!, 'en'), { col1: 'Hold Person', col2: '2ND · CONC · DC WIS' });
  assert.deepEqual(formatDnd5eGrimoireRow(byId.get('silence')!, 'es'), { col1: 'Silencio', col2: '2º · CONC · RITUAL' });
  assert.deepEqual(formatDnd5eGrimoireRow(byId.get('fireball')!, 'pt-BR'), { col1: 'Bola de Fogo', col2: '3º · CD DES' });
  assert.deepEqual(formatDnd5eGrimoireRow(byId.get('tiny-hut')!, 'es'), { col1: 'Choza diminuta', col2: '3º · RITUAL' });

  for (const tuple of ALL_SPELLS) {
    const entry = tupleToDnd5eSpell(tuple);
    for (const lang of LANGS) {
      const row = formatDnd5eGrimoireRow(entry, lang);
      const parsed = parseDnd5eGrimoireMeta(row.col2);
      assert.equal(parsed.spellLevel, entry.level, `level mismatch for ${entry.id} (${lang}): ${row.col2}`);
      assert.equal(parsed.isCantrip, entry.level === 0);
      assert.equal(parsed.requiresConcentration, entry.concentration);
      if (entry.resolution === 'attack') assert.equal(parsed.resolution, 'attack');
      else if (entry.resolution.startsWith('save_')) {
        assert.equal(parsed.resolution, 'save');
        assert.equal(parsed.saveAbility, entry.resolution.slice(5));
      } else {
        assert.equal(parsed.resolution, 'none');
      }
    }
  }
});

test('parseDnd5eGrimoireMeta handles manual/legacy strings, edge formats, and untrusted inputs safely', () => {
  assert.deepEqual(parseDnd5eGrimoireMeta('1 SLOT'), { spellLevel: 1, isCantrip: false, requiresConcentration: false, resolution: 'none' });
  assert.deepEqual(parseDnd5eGrimoireMeta('2 SLOTS'), { spellLevel: 2, isCantrip: false, requiresConcentration: false, resolution: 'none' });
  assert.deepEqual(parseDnd5eGrimoireMeta('3rd · CONC · DEX'), { spellLevel: 3, isCantrip: false, requiresConcentration: true, resolution: 'save', saveAbility: 'dex' });
  assert.deepEqual(parseDnd5eGrimoireMeta('Nivel 4 · Concentración · CD FUE'), { spellLevel: 4, isCantrip: false, requiresConcentration: true, resolution: 'save', saveAbility: 'str' });
  assert.deepEqual(parseDnd5eGrimoireMeta('1º · TS SAB'), { spellLevel: 1, isCantrip: false, requiresConcentration: false, resolution: 'save', saveAbility: 'wis' });
  assert.deepEqual(parseDnd5eGrimoireMeta('2ND · DC 14 DEX'), { spellLevel: 2, isCantrip: false, requiresConcentration: false, resolution: 'save', saveAbility: 'dex' });
  assert.deepEqual(parseDnd5eGrimoireMeta('1ST · REACT'), { spellLevel: 1, isCantrip: false, requiresConcentration: false, resolution: 'none' });
  assert.deepEqual(parseDnd5eGrimoireMeta('1/REST'), { spellLevel: null, isCantrip: false, requiresConcentration: false, resolution: 'none' });
  assert.deepEqual(parseDnd5eGrimoireMeta('2/DAY'), { spellLevel: null, isCantrip: false, requiresConcentration: false, resolution: 'none' });
  assert.deepEqual(parseDnd5eGrimoireMeta('PASSIVE'), { spellLevel: null, isCantrip: false, requiresConcentration: false, resolution: 'none' });
  assert.deepEqual(parseDnd5eGrimoireMeta('FOR 1 MIN'), { spellLevel: null, isCantrip: false, requiresConcentration: false, resolution: 'none' });
  assert.deepEqual(parseDnd5eGrimoireMeta(`1ST · ${'A'.repeat(2000)}`), { spellLevel: 1, isCantrip: false, requiresConcentration: false, resolution: 'none' });
  assert.deepEqual(parseDnd5eGrimoireMeta(0), { spellLevel: 0, isCantrip: true, requiresConcentration: false, resolution: 'none' });
  const partialItem: SystemCatalogItem = {
    id: 'custom-lvl2', sectionId: 'spells', level: 2,
    name: { 'pt-BR': 'Teste', en: 'Test', es: 'Prueba' },
    summary: { 'pt-BR': 'Resumo', en: 'Summary', es: 'Resumen' },
    meta: Object.create({ level: 9, concentration: true, resolution: 'attack' }),
  };
  assert.deepEqual(formatDnd5eGrimoireRow(partialItem, 'en'), { col1: 'Test', col2: '2ND' });
  const hostile = { toString() { throw new Error('must not coerce'); } };
  assert.deepEqual(parseDnd5eGrimoireMeta(hostile), { spellLevel: null, isCantrip: false, requiresConcentration: false, resolution: 'none' });
});
