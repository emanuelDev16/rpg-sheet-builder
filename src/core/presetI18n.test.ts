import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { AppLanguage } from './i18n.ts';
import {
  localizeCardTag,
  localizeCardTitle,
  localizeFieldLabel,
  localizeFieldRollLabel,
  localizeSystemName,
  localizeTableColumn,
  localizeTabTitle,
  PRESET_I18N_STATS,
} from './presetI18n.ts';
import {
  CARD_TAG_ENTRIES,
  CARD_TITLE_ENTRIES,
  ROLL_LABEL_ENTRIES,
  SYSTEM_NAME_ENTRIES,
  TAB_TITLE_ENTRIES,
  TABLE_COLUMN_ENTRIES,
} from './presetI18nMeta.ts';
import { FIELD_LABEL_ENTRIES } from './presetI18nFields.ts';
import {
  createCyberpunkPreset,
  createDnd5ePreset,
  createWorldOfDarknessSheet,
  createWorldOfDarknessV5Sheet,
} from './sheetModel.ts';

const LANGS: readonly AppLanguage[] = ['pt-BR', 'en', 'es'];

test('all presetI18n tables maintain strict non-empty parity across pt-BR, en, and es', () => {
  const allGroups = [
    SYSTEM_NAME_ENTRIES,
    TAB_TITLE_ENTRIES,
    CARD_TITLE_ENTRIES,
    CARD_TAG_ENTRIES,
    FIELD_LABEL_ENTRIES,
    ROLL_LABEL_ENTRIES,
    TABLE_COLUMN_ENTRIES,
  ];
  for (const group of allGroups) {
    for (const [canonical, pt, en, es] of group) {
      assert.ok(canonical.trim().length > 0, 'Empty canonical entry');
      assert.ok(pt.trim().length > 0, `Empty pt-BR for ${canonical}`);
      assert.ok(en.trim().length > 0, `Empty en for ${canonical}`);
      assert.ok(es.trim().length > 0, `Empty es for ${canonical}`);
    }
  }
  assert.ok(PRESET_I18N_STATS.fieldLabels >= 120);
});

test('covers 100% of presets.v2.json labels across WoD V20/V5, D&D 5e, Cyberpunk, Default, and Blank', () => {
  const presetsPath = path.resolve('shared/presets/presets.v2.json');
  const raw = JSON.parse(fs.readFileSync(presetsPath, 'utf8')) as {
    presets: Record<string, {
      systemId: string;
      systemName: string;
      systemCode: string;
      cards: Array<{
        id: string;
        code: string;
        title: string;
        fields: Array<{ id: string; key: string; label: string; rollLabel?: string; columns?: [string, string] }>;
      }>;
    }>;
  };

  for (const preset of Object.values(raw.presets)) {
    for (const lang of LANGS) {
      assert.ok(localizeSystemName(preset.systemId, preset.systemName, lang).trim().length > 0);
      assert.ok(localizeSystemName(preset.systemId, preset.systemCode, lang).trim().length > 0);
      for (const card of preset.cards) {
        assert.ok(localizeCardTitle(card, lang).trim().length > 0, `Empty card title for ${card.id}`);
        assert.ok(localizeCardTag(card, lang).trim().length > 0, `Empty card tag for ${card.id}`);
        for (const field of card.fields) {
          assert.ok(localizeFieldLabel(field, lang).trim().length > 0, `Empty field label for ${field.key}`);
          if (field.rollLabel) {
            assert.ok(localizeFieldRollLabel(field, lang).trim().length > 0);
          }
          if (field.columns) {
            assert.ok(localizeTableColumn(field.columns[0], lang).trim().length > 0);
            assert.ok(localizeTableColumn(field.columns[1], lang).trim().length > 0);
          }
        }
      }
    }
  }
});

test('translates WoD V5/V20, D&D 5e, and Cyberpunk labels across pt-BR, en, and es', () => {
  assert.equal(localizeSystemName('wod', 'VAMPIRE: THE MASQUERADE // V5', 'pt-BR'), 'VAMPIRO: A MÁSCARA // V5');
  assert.equal(localizeSystemName('wod', 'VAMPIRE: THE MASQUERADE // V5', 'es'), 'VAMPIRO: LA MASCARADA // V5');
  assert.equal(localizeTabTitle({ id: 'geral', title: '/01 ATRIBUTOS & COMBATE', systemId: 'wod' }, 'en'), '/01 ATTRIBUTES & COMBAT');
  assert.equal(localizeTabTitle({ id: 'geral', title: '', systemId: 'dnd5e' }, 'es'), '/01 CARACTERÍSTICAS Y COMBATE');

  assert.equal(localizeCardTag({ code: '//VITAL_STATUS' }, 'pt-BR'), '//STATUS_VITAL');
  assert.equal(localizeCardTag({ code: '//VITAL_STATUS' }, 'es'), '//ESTADO_VITAL');
  assert.equal(localizeCardTitle({ title: 'IDENTITY & LINEAGE' }, 'pt-BR'), 'IDENTIDADE & LINHAGEM');
  assert.equal(localizeCardTitle({ title: 'IDENTITY & CLASS' }, 'es'), 'IDENTIDAD Y CLASE');
  assert.equal(localizeCardTitle({ title: 'PERFIL DO PERSONAGEM' }, 'en'), 'CHARACTER PROFILE');

  assert.equal(localizeFieldLabel({ key: 'strength', label: 'STRENGTH' }, 'pt-BR'), 'FORÇA');
  assert.equal(localizeFieldLabel({ key: 'strength', label: 'STRENGTH' }, 'es'), 'FUERZA');
  assert.equal(localizeFieldLabel({ key: 'blood_potency', label: 'BLOOD_POTENCY' }, 'pt-BR'), 'POTÊNCIA DE SANGUE');
  assert.equal(localizeFieldLabel({ key: 'composure', label: 'COMPOSURE' }, 'pt-BR'), 'COMPOSTURA');
  assert.equal(localizeFieldLabel({ key: 'hp', label: 'HIT POINTS' }, 'es'), 'PUNTOS DE GOLPE');
  assert.equal(localizeFieldLabel({ key: 'forca', label: 'REFLEXOS' }, 'en'), 'REFLEXES');
  assert.equal(localizeFieldRollLabel({ key: 'roll_destreza', label: 'INVASÃO ICE', rollLabel: 'HACKEAR NÓ' }, 'en'), 'HACK NODE');
  assert.equal(localizeTableColumn('WEIGHT (KG)', 'pt-BR'), 'PESO (KG)');
});

test('preserves user-renamed labels verbatim and never alters field.key for formulas', () => {
  const customField = { id: 'f_str', key: 'strength', label: 'FORÇA BRUTA DA NOITE', rollLabel: 'SOCO BRUTAL' };
  for (const lang of LANGS) {
    assert.equal(localizeFieldLabel(customField, lang), 'FORÇA BRUTA DA NOITE');
    assert.equal(localizeFieldRollLabel(customField, lang), 'SOCO BRUTAL');
    assert.equal(customField.key, 'strength');
  }

  assert.equal(localizeCardTitle({ id: 'card_atributos', title: 'MEUS ATRIBUTOS SECRETOS' }, 'en'), 'MEUS ATRIBUTOS SECRETOS');
  assert.equal(localizeCardTag({ id: 'card_atributos', code: '//MINHA_TAG' }, 'es'), '//MINHA_TAG');
  assert.equal(localizeTabTitle({ id: 'geral', title: '/01 MINHA ABA', systemId: 'wod' }, 'en'), '/01 MINHA ABA');
  assert.equal(localizeSystemName('wod', 'CRÔNICA DE SÃO PAULO', 'en'), 'CRÔNICA DE SÃO PAULO');
  assert.equal(localizeTableColumn('CRÉDITOS', 'en'), 'CRÉDITOS');

  // Empty label falls back safely by canonical key
  assert.equal(localizeFieldLabel({ id: 'f_str', key: 'strength', label: '' }, 'es'), 'FUERZA');
});

test('handles IndexedDB-saved sheets across language switches without mutating keys, plus WoD catalog traits', () => {
  const sheets = [
    createWorldOfDarknessSheet(),
    createWorldOfDarknessV5Sheet(),
    createDnd5ePreset(),
    createCyberpunkPreset(),
  ];
  for (const sheet of sheets) {
    const originalKeys = sheet.cards.flatMap((c) => c.fields.map((f) => f.key));
    for (const lang of LANGS) {
      const renderedLabels = sheet.cards.flatMap((c) => c.fields.map((f) => localizeFieldLabel(f, lang)));
      assert.ok(renderedLabels.every((l) => l.trim().length > 0));
    }
    const postKeys = sheet.cards.flatMap((c) => c.fields.map((f) => f.key));
    assert.deepEqual(postKeys, originalKeys);
  }

  // Dynamic catalog-added skills/disciplines translate cleanly; custom ones remain intact
  assert.equal(localizeFieldLabel({ key: 'athletics', label: 'Esportes' }, 'en'), 'ATHLETICS');
  assert.equal(localizeFieldLabel({ key: 'auspex', label: 'Auspícios' }, 'es'), 'AUSPEX');
  assert.equal(localizeFieldLabel({ key: 'custom_hunt', label: 'Caça Urbana' }, 'en'), 'Caça Urbana');
});
