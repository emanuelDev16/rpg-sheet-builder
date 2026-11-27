import type { Dnd5eAbilityKey } from '../../dnd5eRules.ts';
import type { AppLanguage } from '../../i18n.ts';
import type { LocalizedText, SystemCatalogItem } from '../../systems/catalogTypes.ts';

export const DND5E_SPELL_SCHOOLS = ['abj', 'con', 'div', 'enc', 'evo', 'ill', 'nec', 'trs'] as const;
export const DND5E_SPELL_CLASSES = [
  'bard', 'cleric', 'druid', 'paladin', 'ranger', 'sorcerer', 'warlock', 'wizard',
] as const;
export const DND5E_SPELL_RESOLUTIONS = [
  'attack', 'save_str', 'save_dex', 'save_con', 'save_int', 'save_wis', 'save_cha', 'utility',
] as const;

export type Dnd5eSpellSchool = (typeof DND5E_SPELL_SCHOOLS)[number];
export type Dnd5eSpellClass = (typeof DND5E_SPELL_CLASSES)[number];
export type Dnd5eSpellLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
export type Dnd5eSpellResolution = (typeof DND5E_SPELL_RESOLUTIONS)[number];

export type Dnd5eSpellTuple = readonly [
  id: string,
  level: Dnd5eSpellLevel,
  school: Dnd5eSpellSchool,
  classes: readonly Dnd5eSpellClass[],
  concentration: boolean,
  ritual: boolean,
  resolution: Dnd5eSpellResolution,
  name: LocalizedText,
  summary: LocalizedText,
];

export interface Dnd5eSpellEntry {
  id: string;
  level: Dnd5eSpellLevel;
  school: Dnd5eSpellSchool;
  classes: readonly Dnd5eSpellClass[];
  concentration: boolean;
  ritual: boolean;
  resolution: Dnd5eSpellResolution;
  name: LocalizedText;
  summary: LocalizedText;
}

export type Dnd5eFeatureKind = 'class_feature' | 'racial_trait' | 'feat';
export type Dnd5eFeatureTuple = readonly [
  id: string, kind: Dnd5eFeatureKind, source: string, costBadge: LocalizedText, name: LocalizedText, summary: LocalizedText,
];
export interface Dnd5eFeatureEntry {
  id: string; kind: Dnd5eFeatureKind; source: string; costBadge: LocalizedText; name: LocalizedText; summary: LocalizedText;
}
export interface Dnd5eGrimoireRow { col1: string; col2: string; }
export interface ParsedDnd5eGrimoireMeta {
  spellLevel: number | null;
  isCantrip: boolean;
  requiresConcentration: boolean;
  resolution: 'attack' | 'save' | 'none';
  saveAbility?: Dnd5eAbilityKey;
}

const SAVE_EXACT_MAP: ReadonlyMap<string, Dnd5eAbilityKey> = new Map([
  ['STR', 'str'], ['FOR', 'str'], ['FUE', 'str'], ['STRENGTH', 'str'], ['FORCA', 'str'], ['FUERZA', 'str'],
  ['DEX', 'dex'], ['DES', 'dex'], ['DEXTERITY', 'dex'], ['DESTREZA', 'dex'],
  ['CON', 'con'], ['CONSTITUTION', 'con'], ['CONSTITUICAO', 'con'], ['CONSTITUCION', 'con'],
  ['INT', 'int'], ['INTELLIGENCE', 'int'], ['INTELIGENCIA', 'int'],
  ['WIS', 'wis'], ['SAB', 'wis'], ['WISDOM', 'wis'], ['SABEDORIA', 'wis'], ['SABIDURIA', 'wis'],
  ['CHA', 'cha'], ['CAR', 'cha'], ['CHARISMA', 'cha'], ['CARISMA', 'cha'],
]);
const SAVE_EXPLICIT_RE = /\b(?:(?:CD|DC|SAVE|SAV|TR|ST|TS)\s*[:.-]?\s*(?:\d{1,2}\s+)?([A-Z]+)|([A-Z]+)\s+(?:SAVE|SAV|CD|DC|TR|ST|TS))\b/g;

const SAVE_AB_LABELS: Record<AppLanguage, Record<Dnd5eAbilityKey, string>> = {
  'pt-BR': { str: 'CD FOR', dex: 'CD DES', con: 'CD CON', int: 'CD INT', wis: 'CD SAB', cha: 'CD CAR' },
  en: { str: 'DC STR', dex: 'DC DEX', con: 'DC CON', int: 'DC INT', wis: 'DC WIS', cha: 'DC CHA' },
  es: { str: 'CD FUE', dex: 'CD DES', con: 'CD CON', int: 'CD INT', wis: 'CD SAB', cha: 'CD CAR' },
};

export const formatOrdinalEn = (n: number): string => (n === 1 ? '1ST' : n === 2 ? '2ND' : n === 3 ? '3RD' : `${n}TH`);

function formatLevelToken(level: number, lang: AppLanguage): string {
  if (level === 0) return lang === 'pt-BR' ? 'TRUQUE' : lang === 'es' ? 'TRUCO' : 'CANTRIP';
  return lang === 'en' ? formatOrdinalEn(level) : `${level}º`;
}

export function tupleToDnd5eSpell(t: Dnd5eSpellTuple): Dnd5eSpellEntry {
  return {
    id: t[0], level: t[1], school: t[2], classes: t[3],
    concentration: t[4], ritual: t[5], resolution: t[6], name: t[7], summary: t[8],
  };
}

export function spellEntryToCatalogItem(entry: Dnd5eSpellEntry): SystemCatalogItem {
  const badges = [entry.school.toUpperCase()];
  if (entry.concentration) badges.push('CONC');
  if (entry.ritual) badges.push('RITUAL');
  const tags: string[] = [entry.school, ...entry.classes, entry.resolution];
  if (entry.concentration) tags.push('concentration');
  if (entry.ritual) tags.push('ritual');
  return {
    id: entry.id,
    sectionId: 'spells',
    name: entry.name,
    summary: entry.summary,
    level: entry.level,
    costLabel: {
      'pt-BR': entry.level === 0 ? 'Truque' : `${entry.level}º Círculo`,
      en: entry.level === 0 ? 'Cantrip' : `${formatOrdinalEn(entry.level).toLowerCase()} Level`,
      es: entry.level === 0 ? 'Truco' : `${entry.level}º Nivel`,
    },
    badges,
    tags,
    meta: {
      level: entry.level,
      school: entry.school,
      classes: [...entry.classes],
      concentration: entry.concentration,
      ritual: entry.ritual,
      resolution: entry.resolution,
    },
  };
}

export function formatDnd5eGrimoireRow(item: Dnd5eSpellEntry | SystemCatalogItem, lang: AppLanguage): Dnd5eGrimoireRow {
  const meta = 'meta' in item && item.meta && typeof item.meta === 'object' ? item.meta : null;
  const rawLevel = meta && Object.hasOwn(meta, 'level') ? meta.level : item.level;
  const level = typeof rawLevel === 'number' && Number.isInteger(rawLevel) && rawLevel >= 0 && rawLevel <= 9 ? rawLevel : 0;
  const concentration = meta && Object.hasOwn(meta, 'concentration') ? meta.concentration === true : 'concentration' in item && item.concentration === true;
  const ritual = meta && Object.hasOwn(meta, 'ritual') ? meta.ritual === true : 'ritual' in item && item.ritual === true;
  const rawRes = meta && Object.hasOwn(meta, 'resolution') ? meta.resolution : 'resolution' in item ? item.resolution : undefined;
  const resolution: Dnd5eSpellResolution =
    typeof rawRes === 'string' && (DND5E_SPELL_RESOLUTIONS as readonly string[]).includes(rawRes)
      ? (rawRes as Dnd5eSpellResolution)
      : 'utility';

  const parts = [formatLevelToken(level, lang)];
  if (concentration) parts.push('CONC');
  if (ritual) parts.push('RITUAL');
  if (resolution === 'attack') parts.push('ATK');
  else if (resolution.startsWith('save_')) {
    const ab = resolution.slice(5) as Dnd5eAbilityKey;
    parts.push(SAVE_AB_LABELS[lang][ab]);
  }
  const col1 = typeof item.name?.[lang] === 'string' ? item.name[lang] : '';
  return { col1, col2: parts.join(' · ') };
}

function detectSaveAbility(norm: string): Dnd5eAbilityKey | undefined {
  for (const m of norm.matchAll(SAVE_EXPLICIT_RE)) {
    const ab = SAVE_EXACT_MAP.get(m[1] ?? m[2] ?? '');
    if (ab) return ab;
  }
  for (const raw of norm.split(/[·•|/,;]+/)) {
    const ab = SAVE_EXACT_MAP.get(raw.trim());
    if (ab) return ab;
  }
  return undefined;
}

export function parseDnd5eGrimoireMeta(col2: unknown): ParsedDnd5eGrimoireMeta {
  if (typeof col2 === 'number') {
    const valid = Number.isInteger(col2) && col2 >= 0 && col2 <= 9;
    return {
      spellLevel: valid ? col2 : null,
      isCantrip: valid && col2 === 0,
      requiresConcentration: false,
      resolution: 'none',
    };
  }
  if (typeof col2 !== 'string') {
    return { spellLevel: null, isCantrip: false, requiresConcentration: false, resolution: 'none' };
  }
  const bounded = col2.length > 256 ? col2.slice(0, 256) : col2;
  const norm = bounded.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (!norm) {
    return { spellLevel: null, isCantrip: false, requiresConcentration: false, resolution: 'none' };
  }

  const isCantrip =
    /\b(?:TRUQUE|CANTRIP|TRUCO)\b/.test(norm) ||
    /\b(?:0\s*[º°ª]|0TH\b|(?:LVL|LEVEL|NIVEL|NV|CIRCULO)\s*0\b)/.test(norm);

  let spellLevel: number | null = isCantrip ? 0 : null;
  if (spellLevel === null) {
    const m =
      norm.match(/\b([1-9])\s*(?:[º°ª]|(?:ST|ND|RD|TH)\b)/) ||
      norm.match(/\b(?:SLOT|SLOTS|LVL|LEVEL|NIVEL|NV|CIRCULO|CIRCLE)\s*[:#-]?\s*([1-9])\b/) ||
      norm.match(/\b([1-9])\s*(?:SLOT|SLOTS|LVL|LEVEL|NIVEL|CIRCULO|CIRCLE)\b/) ||
      norm.match(/^([1-9])(?:\s*[·•|,]|$)/);
    if (m) spellLevel = Number(m[1]);
  }

  const requiresConcentration = /\bCONC(?:ENTRA(?:CAO|TION|CION))?\b/.test(norm);
  const saveAbility = detectSaveAbility(norm);
  if (saveAbility) {
    return { spellLevel, isCantrip, requiresConcentration, resolution: 'save', saveAbility };
  }
  const resolution = /\b(?:ATK|ATT|ATTACK|ATAQUE|ATQ)\b/.test(norm) ? 'attack' : 'none';
  return { spellLevel, isCantrip, requiresConcentration, resolution };
}
