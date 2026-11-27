import type {
  LocalizedText, SystemCatalog, SystemCatalogFilterGroup, SystemCatalogFilterOption,
} from '../../systems/catalogTypes.ts';
import {
  DND5E_SPELL_CLASSES, DND5E_SPELL_SCHOOLS, type Dnd5eSpellClass, type Dnd5eSpellSchool,
  formatOrdinalEn, spellEntryToCatalogItem, tupleToDnd5eSpell,
} from './types.ts';

export * from './types.ts';

export const DND5E_SRD_ATTRIBUTION = 'D&D 5e SRD 5.1 (CC-BY-4.0 — Wizards of the Coast LLC)';

const SCHOOL_LABELS: Record<Dnd5eSpellSchool, LocalizedText> = {
  abj: { 'pt-BR': 'Abjuração', en: 'Abjuration', es: 'Abjuración' },
  con: { 'pt-BR': 'Conjuração', en: 'Conjuration', es: 'Conjuración' },
  div: { 'pt-BR': 'Adivinhação', en: 'Divination', es: 'Adivinación' },
  enc: { 'pt-BR': 'Encantamento', en: 'Enchantment', es: 'Encantamiento' },
  evo: { 'pt-BR': 'Evocação', en: 'Evocation', es: 'Evocación' },
  ill: { 'pt-BR': 'Ilusão', en: 'Illusion', es: 'Ilusión' },
  nec: { 'pt-BR': 'Necromancia', en: 'Necromancy', es: 'Necromancia' },
  trs: { 'pt-BR': 'Transmutação', en: 'Transmutation', es: 'Transmutación' },
};

const CLASS_LABELS: Record<Dnd5eSpellClass, LocalizedText> = {
  bard: { 'pt-BR': 'Bardo', en: 'Bard', es: 'Bardo' },
  cleric: { 'pt-BR': 'Clérigo', en: 'Cleric', es: 'Clérigo' },
  druid: { 'pt-BR': 'Druida', en: 'Druid', es: 'Druida' },
  paladin: { 'pt-BR': 'Paladino', en: 'Paladin', es: 'Paladín' },
  ranger: { 'pt-BR': 'Patrulheiro', en: 'Ranger', es: 'Explorador' },
  sorcerer: { 'pt-BR': 'Feiticeiro', en: 'Sorcerer', es: 'Hechicero' },
  warlock: { 'pt-BR': 'Bruxo', en: 'Warlock', es: 'Brujo' },
  wizard: { 'pt-BR': 'Mago', en: 'Wizard', es: 'Mago' },
};

function levelOption(level: number): SystemCatalogFilterOption {
  return {
    value: `${level}`,
    label: level === 0
      ? { 'pt-BR': 'Truque', en: 'Cantrip', es: 'Truco' }
      : { 'pt-BR': `${level}º`, en: formatOrdinalEn(level).toLowerCase(), es: `${level}º` },
  };
}

let cachedCatalogPromise: Promise<SystemCatalog> | null = null;

/** Lazily loads and converts D&D 5e SRD 5.1 modules into a unified SystemCatalog. */
export function loadDnd5eCatalog(): Promise<SystemCatalog> {
  if (!cachedCatalogPromise) {
    cachedCatalogPromise = Promise.all([
      import('./spellsLow.ts'),
      import('./spellsMid.ts'),
    ]).then(([{ DND5E_SPELLS_LOW }, { DND5E_SPELLS_MID }]) => {
      const entries = [...DND5E_SPELLS_LOW, ...DND5E_SPELLS_MID].map(tupleToDnd5eSpell);
      const levels = Array.from(new Set(entries.map((e) => e.level))).sort((a, b) => a - b);
      const filterGroups: SystemCatalogFilterGroup[] = [
        {
          id: 'level',
          label: { 'pt-BR': 'Círculo', en: 'Level', es: 'Nivel' },
          options: levels.map(levelOption),
        },
        {
          id: 'classes',
          label: { 'pt-BR': 'Classe', en: 'Class', es: 'Clase' },
          options: DND5E_SPELL_CLASSES.map((c) => ({ value: c, label: CLASS_LABELS[c] })),
        },
        {
          id: 'school',
          label: { 'pt-BR': 'Escola', en: 'School', es: 'Escuela' },
          options: DND5E_SPELL_SCHOOLS.map((s) => ({ value: s, label: SCHOOL_LABELS[s] })),
        },
      ];
      return {
        systemId: 'dnd5e',
        attribution: DND5E_SRD_ATTRIBUTION,
        sections: [{
          id: 'spells',
          label: { 'pt-BR': 'Magias (SRD 5.1)', en: 'Spells (SRD 5.1)', es: 'Conjuros (SRD 5.1)' },
          filterGroups,
          items: entries.map(spellEntryToCatalogItem),
        }],
      };
    }).catch((err) => {
      cachedCatalogPromise = null;
      throw err;
    });
  }
  return cachedCatalogPromise;
}
