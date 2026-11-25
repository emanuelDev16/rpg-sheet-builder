import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPaperSheetModel,
  detectPaperSheetLayout,
  resolvePaperCharacterName,
  resolvePrintTitleCharacterName,
} from './paperSheetModel.ts';
import {
  adjustSheetHumanityStains,
  adjustV20HealthDamage,
  adjustV5WillpowerDamage,
  createBlankSheet,
  createCyberpunkPreset,
  createDnd5ePreset,
  createGenericD20Preset,
  createWorldOfDarknessSheet,
  createWorldOfDarknessV5Sheet,
  type SheetCard,
} from './sheetModel.ts';

test('detectPaperSheetLayout classifies wod-v5, wod-v20, dnd5e, and generic correctly', () => {
  assert.equal(detectPaperSheetLayout(createWorldOfDarknessV5Sheet()), 'wod-v5');
  assert.equal(detectPaperSheetLayout(createWorldOfDarknessSheet()), 'wod-v20');
  assert.equal(detectPaperSheetLayout(createDnd5ePreset()), 'dnd5e');
  assert.equal(detectPaperSheetLayout(createCyberpunkPreset()), 'generic');
  assert.equal(detectPaperSheetLayout(createGenericD20Preset()), 'generic');
  assert.equal(detectPaperSheetLayout(createBlankSheet()), 'generic');
});

test('buildPaperSheetModel builds complete 2-page WoD V5 layout across all tabs and preserves custom labels & cards', () => {
  let v5 = createWorldOfDarknessV5Sheet();
  v5 = adjustSheetHumanityStains(v5, 2).sheet;
  v5 = adjustV5WillpowerDamage(v5, 'aggravated', 1);
  v5 = adjustV5WillpowerDamage(v5, 'superficial', 4);
  v5 = {
    ...v5,
    cards: [
      ...v5.cards.map((card) => {
        if (card.id === 'card_identidade') {
          return {
            ...card,
            fields: [
              ...card.fields.map((f) =>
                f.id === 'f_blood_potency'
                  ? { id: 'f_blood_potency', key: 'blood_potency', label: 'BLOOD_POTENCY', kind: 'number' as const, value: 3, max: 10 }
                  : f,
              ),
              { id: 'f_custom_alias', key: 'custom_alias', label: 'Codinome Secreto', kind: 'text' as const, value: 'Sombra do Cais' },
            ],
          };
        }
        if (card.id === 'card_skills') {
          return {
            ...card,
            fields: card.fields.map((f) =>
              f.key === 'subterfuge' ? { ...f, label: 'Lábia Customizada', hint: 'Seduction' } : f,
            ),
          };
        }
        return card;
      }),
      {
        id: 'card_custom_p2',
        tab: 'magias',
        code: '//REDE_CONTATOS',
        title: 'Rede de Informantes',
        colSpan: 1,
        fields: [
          { id: 'f_custom_contato', key: 'informante', label: 'Contato Principal', kind: 'text', value: 'Corvo' },
        ],
      },
    ],
    xp: {
      totalEarned: 25,
      spent: 10,
      ledger: [
        { id: 'xp_1', timestamp: '2026-11-24T12:00:00Z', kind: 'award', delta: 25, label: 'Sessão 1' },
        { id: 'xp_2', timestamp: '2026-11-24T13:00:00Z', kind: 'upgrade', delta: -10, xpSpent: 10, label: 'Dominação 3' },
      ],
    },
  };

  const model = buildPaperSheetModel(v5, 'pt-BR');
  assert.equal(model.layout, 'wod-v5');
  assert.equal(model.pageCount, 2);
  assert.ok(model.wodV5);

  const { page1, page2 } = model.wodV5;
  assert.equal(page1.header3x3.length, 9);
  assert.equal(page1.attributes3x3.length, 3);
  assert.equal(page1.skills3Col.length, 3);
  assert.equal(page1.skills3Col.reduce((acc, g) => acc + g.items.length, 0), 27);

  const subterfuge = page1.skills3Col.flatMap((g) => g.items).find((s) => s.key === 'subterfuge');
  assert.equal(subterfuge?.label, 'Lábia Customizada');
  assert.equal(subterfuge?.specialty, 'Seduction');

  assert.match(page1.middleStrip3Col.bane.severityBadge, /SEVERIDADE 3/);
  assert.equal(page1.disciplines.length, 6);
  assert.equal(page1.disciplines.filter((d) => d.label.length > 0).length, 2);
  assert.equal(page1.disciplines[0].slots.length, 5);
  assert.equal(page1.vitalColumn.willpower.badge, 'IMPAIRED (-2)');
  assert.equal(page1.vitalColumn.bloodPotency.level, 3);
  assert.equal(page1.vitalColumn.bloodPotency.stats.length, 6);

  // Page 2 extracts Tab 2/3 & preserves custom fields/cards
  assert.equal(page2.touchstones.items.length, 1);
  assert.equal(page2.meritsFlaws.items.length, 2);
  assert.equal(page2.havens.items.length, 1);
  assert.equal(page2.xpSummary.available, 15);
  assert.equal(page2.xpSummary.recentEntries.length, 2);
  assert.ok(page2.notes.some((n) => n.value.includes('Elysium')));
  assert.ok(page2.extraCards.some((c) => c.id === 'card_custom_p2' && c.title === 'Rede de Informantes'));
  assert.ok(
    page2.extraCards.some((c) => c.fields.some((f) => f.id === 'f_custom_alias' && f.value === 'Sombra do Cais')),
  );
});

test('buildPaperSheetModel builds 2-page WoD V20 layout without touchstones and with 7 health levels', () => {
  let v20 = createWorldOfDarknessSheet();
  v20 = adjustV20HealthDamage(v20, 'f_health', 'aggravated', 1);
  v20 = adjustV20HealthDamage(v20, 'f_health', 'lethal', 1);
  v20 = adjustV20HealthDamage(v20, 'f_health', 'bashing', 1);

  const model = buildPaperSheetModel(v20, 'en');
  assert.equal(model.layout, 'wod-v20');
  assert.equal(model.pageCount, 2);
  assert.ok(model.wodV20);

  const { page1, page2 } = model.wodV20;
  assert.equal(page1.header3x3.length, 9);
  assert.equal(page1.abilities3Col.map((c) => c.id).join(','), 'talents,skills,knowledges');
  assert.equal(page1.abilities3Col.reduce((acc, g) => acc + g.items.length, 0), 30);
  assert.equal(page1.advantages3Col.virtues.items.length, 3);
  assert.equal(page1.bottom3Col.health.levels.length, 7);
  assert.equal(page1.bottom3Col.health.levels[0].box.symbol, '*');
  assert.equal(page1.bottom3Col.health.levels[1].box.symbol, 'X');
  assert.equal(page1.bottom3Col.health.levels[2].box.symbol, '/');
  assert.equal(page1.bottom3Col.bloodPool.maxPerTurn, 1);
  assert.ok(page2.powersRituals.length > 0);
  assert.ok(page2.combatEquipment.some((f) => f.table && f.table.rows.length > 0));
});

test('buildPaperSheetModel builds 3-page D&D 5e with spellcasting and 2-page without spellcasting', () => {
  const dnd = createDnd5ePreset();
  const fullModel = buildPaperSheetModel(dnd, 'es');
  assert.equal(fullModel.layout, 'dnd5e');
  assert.equal(fullModel.pageCount, 3);
  assert.ok(fullModel.dnd5e?.page3);
  assert.equal(fullModel.dnd5e?.page1.col1.abilities.length, 6);
  assert.equal(fullModel.dnd5e?.page1.col1.skills18.length, 18);
  assert.equal(fullModel.dnd5e?.page1.col2.deathSaves.successes, 0);
  assert.equal(fullModel.dnd5e?.page3?.slots.length, 2);

  const customDnd = {
    ...dnd,
    dnd5eState: {
      ...dnd.dnd5eState!,
      level: 9,
      inspiration: false,
      tempHp: 12,
      hitDice: { die: 'd12' as const, current: 7, max: 9 },
      deathSaves: { successes: 2, failures: 1 },
      saveProficiencies: { str: false, dex: true, con: true, int: false, wis: true, cha: false },
      skillProficiencies: {
        ...dnd.dnd5eState!.skillProficiencies,
        perception: 'expertise' as const,
        stealth: 'proficient' as const,
      },
      spellcasting: {
        ability: 'wis' as const,
        slots: dnd.dnd5eState!.spellcasting.slots.map((s) =>
          s.level === 1 ? { level: 1, max: 4, used: 2 } : s.level === 3 ? { level: 3, max: 2, used: 1 } : s,
        ),
      },
    },
  };
  const customModel = buildPaperSheetModel(customDnd, 'pt-BR');
  assert.equal(customModel.dnd5e?.page1.identityBanner.proficiencyBonus, '+4');
  assert.equal(customModel.dnd5e?.page1.col1.passivePerception, 19); // 10 + 1(wis) + 2*4(PB)
  assert.equal(customModel.dnd5e?.page1.col1.skills18.find((s) => s.key === 'perception')?.proficiency, 'expertise');
  assert.equal(customModel.dnd5e?.page1.col1.savingThrows.find((s) => s.key === 'wisdom')?.proficient, true);
  assert.equal(customModel.dnd5e?.page1.col2.hitPoints.temp, '12');
  assert.equal(customModel.dnd5e?.page1.col2.hitDice.current, 7);
  assert.deepEqual(customModel.dnd5e?.page1.col2.deathSaves, { successes: 2, failures: 1 });
  assert.equal(customModel.dnd5e?.page1.col3.inspiration, false);
  assert.equal(customModel.dnd5e?.page3?.spellDc, '13'); // 8 + 4 + 1
  assert.equal(customModel.dnd5e?.page3?.spellAtk, '+5'); // 4 + 1
  assert.equal(customModel.dnd5e?.page3?.slots.length, 3);

  // Strip spellcasting cards -> conditional Page 3 disappears
  const martialOnly = {
    ...dnd,
    cards: dnd.cards.filter((c) => c.id !== 'card_arcano' && c.id !== 'card_grimorio'),
  };
  const twoPageModel = buildPaperSheetModel(martialOnly, 'en');
  assert.equal(twoPageModel.pageCount, 2);
  assert.equal(twoPageModel.dnd5e?.page3, null);
});

test('buildPaperSheetModel builds generic multi-page layout for Cyberpunk, Default, and Blank across locales', () => {
  const cyber = createCyberpunkPreset();
  const customCard: SheetCard = {
    id: 'card_xp_custom',
    tab: 'xp',
    code: '//CYBERWARE',
    title: 'Implantes Neurais',
    colSpan: 2,
    fields: [{ id: 'f_deck', key: 'deck', label: 'Cyberdeck', kind: 'text', value: 'Raven Microcyb' }],
  };
  const cyberWithCustom = { ...cyber, cards: [...cyber.cards, customCard] };

  const ptModel = buildPaperSheetModel(cyberWithCustom, 'pt-BR');
  assert.equal(ptModel.layout, 'generic');
  assert.equal(ptModel.pageCount, 2);
  assert.ok(ptModel.generic);
  assert.ok(ptModel.generic.pages[1].cards.some((c) => c.id === 'card_xp_custom'));

  const enDefault = buildPaperSheetModel(createGenericD20Preset(), 'en');
  assert.equal(enDefault.layout, 'generic');
  assert.equal(enDefault.pageCount, 2);
  assert.equal(enDefault.labels.xpSection, 'EXPERIENCE');

  const blank = buildPaperSheetModel(createBlankSheet(), 'es');
  assert.equal(blank.layout, 'generic');
  assert.equal(blank.pageCount, 1);
  assert.equal(blank.labels.notes, 'BIOGRAFÍA Y NOTAS');
});

test('buildPaperSheetModel enforces V5 27 skills, 6 discipline slots, real character name priority, and strict system separation', () => {
  const baseV5 = createWorldOfDarknessV5Sheet();
  const renamedV5 = {
    ...baseV5,
    characterName: 'NOVO PERSONAGEM',
    cards: baseV5.cards.map((c) => {
      if (c.id === 'card_identidade') {
        return {
          ...c,
          fields: c.fields.map((f) => (f.key === 'character_name' ? { ...f, value: 'Elena Moretti' } : f)),
        };
      }
      if (c.id === 'card_skills') {
        return {
          ...c,
          fields: c.fields.filter((f) => f.key === 'brawl'),
        };
      }
      return c;
    }),
  };

  assert.equal(resolvePaperCharacterName(renamedV5), 'Elena Moretti');
  assert.equal(resolvePrintTitleCharacterName(renamedV5), 'Elena Moretti');

  const v5Model = buildPaperSheetModel(renamedV5, 'pt-BR');
  assert.equal(v5Model.characterName, 'Elena Moretti');
  assert.equal(v5Model.sheetTitle, 'VAMPIRO · A MÁSCARA');
  assert.deepEqual(
    v5Model.wodV5?.page1.header3x3.map((c) => c.key),
    ['character_name', 'ambition', 'clan', 'concept', 'desire', 'generation', 'chronicle', 'predator_type', 'sire'],
  );
  assert.deepEqual(
    v5Model.wodV5?.page1.skills3Col.map((g) => g.items.length),
    [9, 9, 9],
  );
  assert.equal(v5Model.wodV5?.page1.disciplines.length, 6);
  for (const disc of v5Model.wodV5?.page1.disciplines ?? []) {
    assert.equal(disc.slots.length, 5);
  }
  assert.equal(v5Model.wodV5?.page1.middleStrip3Col.chronicleTenets.length, 3);
  assert.equal(v5Model.wodV5?.page1.middleStrip3Col.convictionsSummary.length, 3);
  assert.ok(v5Model.wodV5?.page1.vitalColumn.resonance.label);
  assert.ok(v5Model.wodV5?.page1.vitalColumn.hunting.label);
  assert.equal(v5Model.wodV20, undefined);
  assert.equal(v5Model.dnd5e, undefined);

  const dndPt = buildPaperSheetModel(createDnd5ePreset(), 'pt-BR');
  assert.deepEqual(
    dndPt.dnd5e?.page1.col3.currency.map((c) => c.code),
    ['PC', 'PP', 'PE', 'PO', 'PL'],
  );
  assert.equal(dndPt.wodV5, undefined);
  assert.equal(dndPt.wodV20, undefined);
});
