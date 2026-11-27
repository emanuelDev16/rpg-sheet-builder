import { type AppLanguage, getLocalizedTabLabels } from './i18n.ts';
import {
  CARD_TAG_ENTRIES,
  CARD_TITLE_ENTRIES,
  type PresetLocaleEntry,
  type PresetLocaleTuple,
  ROLL_LABEL_ENTRIES,
  SYSTEM_DEFAULT_BY_ID,
  SYSTEM_NAME_ENTRIES,
  TAB_TITLE_ENTRIES,
  TABLE_COLUMN_ENTRIES,
} from './presetI18nMeta.ts';
import { DEFAULT_FIELD_LABEL_BY_KEY, FIELD_LABEL_ENTRIES } from './presetI18nFields.ts';
import type { SystemId, TabId } from './sheetModel.ts';
import { V20_SKILLS_CATALOG, V5_SKILLS_CATALOG } from './wodSkillsCatalog.ts';
import { WOD_DISCIPLINES_CATALOG } from './wodClansDisciplinesCatalog.ts';
import { WOD_ADVANTAGES_CATALOG, WOD_FLAWS_CATALOG } from './wodAdvantagesCatalog.ts';

type LocaleRecord = Record<AppLanguage, string>;

export function normalizePresetKey(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toUpperCase();
}

function toLocaleRecord(tuple: PresetLocaleTuple): LocaleRecord {
  return { 'pt-BR': tuple[0], en: tuple[1], es: tuple[2] };
}

function buildLookupMap(entries: readonly PresetLocaleEntry[]): ReadonlyMap<string, LocaleRecord> {
  const map = new Map<string, LocaleRecord>();
  for (const [canonical, ptBR, en, es] of entries) {
    const rec: LocaleRecord = { 'pt-BR': ptBR, en, es };
    for (const variant of [canonical, ptBR, en, es]) {
      const norm = normalizePresetKey(variant);
      if (norm && !map.has(norm)) {
        map.set(norm, rec);
      }
    }
  }
  return map;
}

function buildWodCatalogLabelMap(): ReadonlyMap<string, LocaleRecord> {
  const map = new Map<string, LocaleRecord>();
  const register = (labels: Readonly<Record<AppLanguage, string>>) => {
    const rec: LocaleRecord = {
      'pt-BR': labels['pt-BR'].toUpperCase(),
      en: labels.en.toUpperCase(),
      es: labels.es.toUpperCase(),
    };
    for (const val of Object.values(rec)) {
      const norm = normalizePresetKey(val);
      if (norm && !map.has(norm)) {
        map.set(norm, rec);
      }
    }
  };
  for (const skill of V20_SKILLS_CATALOG) register(skill.labels);
  for (const skill of V5_SKILLS_CATALOG) register(skill.labels);
  for (const disc of WOD_DISCIPLINES_CATALOG) register(disc.name);
  for (const adv of WOD_ADVANTAGES_CATALOG) register(adv.name);
  for (const flaw of WOD_FLAWS_CATALOG) register(flaw.name);
  return map;
}

const CYBERPUNK_CARD_TITLE_ENTRIES: readonly PresetLocaleEntry[] = [
  ['TACTICAL COMBAT & ARMOR', 'COMBATE TÁTICO & BLINDAGEM', 'TACTICAL COMBAT & ARMOR', 'COMBATE TÁCTICO Y BLINDAJE'],
  ['ARSENAL & WEAPONS', 'ARSENAL & ARMAS', 'ARSENAL & WEAPONS', 'ARSENAL Y ARMAS'],
  ['CYBERWARE & HUMANITY', 'CYBERWARE & HUMANIDADE', 'CYBERWARE & HUMANITY', 'CYBERWARE Y HUMANIDAD'],
];

const CYBERPUNK_CARD_TAG_ENTRIES: readonly PresetLocaleEntry[] = [
  ['//ARMOR_SP', '//BLINDAGEM_SP', '//ARMOR_SP', '//BLINDAJE_SP'],
  ['//ARSENAL', '//ARSENAL', '//ARSENAL', '//ARSENAL'],
  ['//CYBERWARE', '//CYBERWARE', '//CYBERWARE', '//CYBERWARE'],
  ['//NETRUNNING', '//NETRUNNING', '//NETRUNNING', '//NETRUNNING'],
];

const CYBERPUNK_FIELD_LABEL_ENTRIES: readonly PresetLocaleEntry[] = [
  ['ARMOR SP (HEAD)', 'SP CABEÇA', 'ARMOR SP (HEAD)', 'SP CABEZA'],
  ['ARMOR SP (BODY)', 'SP CORPO', 'ARMOR SP (BODY)', 'SP CUERPO'],
  ['EFFECTIVE EMP', 'EMP EFETIVA', 'EFFECTIVE EMP', 'EMP EFECTIVA'],
  ['CRITICAL INJURIES', 'FERIMENTOS CRÍTICOS', 'CRITICAL INJURIES', 'HERIDAS CRÍTICAS'],
  ['CYBERWARE', 'CYBERWARE', 'CYBERWARE', 'CYBERWARE'],
  ['WEAPONS', 'ARMAS', 'WEAPONS', 'ARMAS'],
  ['AMMO', 'MUNIÇÃO', 'AMMO', 'MUNICIÓN'],
  ['HUMANITY LOSS', 'PERDA DE HUMANIDADE', 'HUMANITY LOSS', 'PÉRDIDA DE HUMANIDAD'],
  ['EXPLODING 1D10', '1D10 EXPLOSIVO', 'EXPLODING 1D10', '1D10 EXPLOSIVO'],
];

const CYBERPUNK_ROLL_LABEL_ENTRIES: readonly PresetLocaleEntry[] = [
  ['ROLL EXPLODING 1D10', 'ROLAR 1D10 EXPLOSIVO', 'ROLL EXPLODING 1D10', 'TIRAR 1D10 EXPLOSIVO'],
];

const CYBERPUNK_TABLE_COLUMN_ENTRIES: readonly PresetLocaleEntry[] = [
  ['WEAPON', 'ARMA', 'WEAPON', 'ARMA'],
  ['DAMAGE', 'DANO', 'DAMAGE', 'DAÑO'],
  ['AMMO', 'MUNIÇÃO', 'AMMO', 'MUNICIÓN'],
  ['IMPLANT', 'IMPLANTE', 'IMPLANT', 'IMPLANTE'],
  ['HUMANITY LOSS', 'PERDA HUM.', 'HUMANITY LOSS', 'PÉRD. HUM.'],
];

const CYBERPUNK_DEFAULT_FIELD_LABEL_BY_KEY: Readonly<Record<string, PresetLocaleTuple>> = {
  armor_head: ['SP CABEÇA', 'ARMOR SP (HEAD)', 'SP CABEZA'],
  armor_body: ['SP CORPO', 'ARMOR SP (BODY)', 'SP CUERPO'],
  effective_emp: ['EMP EFETIVA', 'EFFECTIVE EMP', 'EMP EFECTIVA'],
  cyberware: ['CYBERWARE', 'CYBERWARE', 'CYBERWARE'],
  critical_injuries: ['FERIMENTOS CRÍTICOS', 'CRITICAL INJURIES', 'HERIDAS CRÍTICAS'],
  ammo: ['MUNIÇÃO', 'AMMO', 'MUNICIÓN'],
  weapons: ['ARMAS', 'WEAPONS', 'ARMAS'],
};

const SYSTEM_LOOKUP = buildLookupMap(SYSTEM_NAME_ENTRIES);
const TAB_LOOKUP = buildLookupMap(TAB_TITLE_ENTRIES);
const CARD_TITLE_LOOKUP = buildLookupMap([...CARD_TITLE_ENTRIES, ...CYBERPUNK_CARD_TITLE_ENTRIES]);
const CARD_TAG_LOOKUP = buildLookupMap([...CARD_TAG_ENTRIES, ...CYBERPUNK_CARD_TAG_ENTRIES]);
const FIELD_LABEL_LOOKUP = buildLookupMap([...FIELD_LABEL_ENTRIES, ...CYBERPUNK_FIELD_LABEL_ENTRIES]);
const ROLL_LABEL_LOOKUP = buildLookupMap([...ROLL_LABEL_ENTRIES, ...CYBERPUNK_ROLL_LABEL_ENTRIES]);
const TABLE_COLUMN_LOOKUP = buildLookupMap([...TABLE_COLUMN_ENTRIES, ...CYBERPUNK_TABLE_COLUMN_ENTRIES]);
const WOD_CATALOG_LOOKUP = buildWodCatalogLabelMap();

const DEFAULT_CARD_TITLE_BY_ID: Readonly<Record<string, PresetLocaleTuple>> = {
  card_identidade: ['IDENTIDADE & LINHAGEM', 'IDENTITY & LINEAGE', 'IDENTIDAD Y LINAJE'],
  card_atributos: ['FÍSICOS · SOCIAIS · MENTAIS', 'PHYSICAL · SOCIAL · MENTAL', 'FÍSICOS · SOCIALES · MENTALES'],
  card_combate: ['VITALIDADE · VONTADE · FOME', 'HEALTH · WILLPOWER · HUNGER', 'SALUD · VOLUNTAD · ANSIA'],
  card_skills: ['HABILIDADES & PARADAS', 'ABILITIES & DICE POOLS', 'HABILIDADES Y RESERVAS'],
  card_inventario: ['EQUIPAMENTO & OCULTAÇÃO', 'GEAR & CONCEALMENT', 'EQUIPO Y OCULTACIÓN'],
  card_arcano: ['DISCIPLINAS & OCULTISMO', 'DISCIPLINES & OCCULT', 'DISCIPLINAS Y OCULTISMO'],
  card_grimorio: ['PODERES & MÉRITOS', 'DISCIPLINE POWERS & MERITS', 'PODERES Y MÉRITOS'],
  card_wod_dossier: ['CONVICÇÕES, QUALIDADES & REFÚGIOS', 'CONVICTIONS, QUALITIES & HAVENS', 'CONVICCIONES, MÉRITOS Y REFUGIOS'],
  card_notas: ['COTERIE & NOTAS DE SESSÃO', 'COTERIE & SESSION NOTES', 'COTERIE Y NOTAS DE SESIÓN'],
  card_cyberpunk_combat: ['COMBATE TÁTICO & BLINDAGEM', 'TACTICAL COMBAT & ARMOR', 'COMBATE TÁCTICO Y BLINDAJE'],
  card_cyberpunk_weapons: ['ARSENAL & ARMAS', 'ARSENAL & WEAPONS', 'ARSENAL Y ARMAS'],
  card_cyberpunk_cyberware: ['CYBERWARE & HUMANIDADE', 'CYBERWARE & HUMANITY', 'CYBERWARE Y HUMANIDAD'],
};

const DEFAULT_CARD_TAG_BY_ID: Readonly<Record<string, PresetLocaleTuple>> = {
  card_identidade: ['//ID_CRÔNICA', '//CHRONICLE_ID', '//ID_CRÓNICA'],
  card_atributos: ['//ATRIBUTOS', '//ATTRIBUTES', '//ATRIBUTOS'],
  card_combate: ['//STATUS_VITAL', '//VITAL_STATUS', '//ESTADO_VITAL'],
  card_skills: ['//PERÍCIAS_&_PARADAS', '//SKILLS_&_POOLS', '//HABILIDADES_&_RESERVAS'],
  card_inventario: ['//INVENTÁRIO', '//INVENTORY', '//INVENTARIO'],
  card_arcano: ['//DISCIPLINAS', '//DISCIPLINES', '//DISCIPLINAS'],
  card_grimorio: ['//PODERES_&_MÉRITOS', '//MERITS_&_POWERS', '//PODERES_&_MÉRITOS'],
  card_wod_dossier: ['//TRAÇOS_CRÔNICA', '//CHRONICLE_TRAITS', '//RASGOS_CRÓNICA'],
  card_notas: ['//DIÁRIO_CRÔNICA', '//CHRONICLE_LOG', '//DIARIO_CRÓNICA'],
  card_cyberpunk_combat: ['//BLINDAGEM_SP', '//ARMOR_SP', '//BLINDAJE_SP'],
  card_cyberpunk_weapons: ['//ARSENAL', '//ARSENAL', '//ARSENAL'],
  card_cyberpunk_cyberware: ['//CYBERWARE', '//CYBERWARE', '//CYBERWARE'],
};

export const PRESET_I18N_STATS = {
  systems: SYSTEM_NAME_ENTRIES.length,
  tabs: TAB_TITLE_ENTRIES.length,
  cardTitles: CARD_TITLE_ENTRIES.length + CYBERPUNK_CARD_TITLE_ENTRIES.length,
  cardTags: CARD_TAG_ENTRIES.length + CYBERPUNK_CARD_TAG_ENTRIES.length,
  fieldLabels: FIELD_LABEL_ENTRIES.length + CYBERPUNK_FIELD_LABEL_ENTRIES.length,
  rollLabels: ROLL_LABEL_ENTRIES.length + CYBERPUNK_ROLL_LABEL_ENTRIES.length,
  tableColumns: TABLE_COLUMN_ENTRIES.length + CYBERPUNK_TABLE_COLUMN_ENTRIES.length,
} as const;

export function localizeSystemName(
  systemId: SystemId | string | undefined,
  fallback: string,
  lang: AppLanguage,
): string {
  const trimmed = fallback.trim();
  if (!trimmed) {
    const tuple = systemId ? SYSTEM_DEFAULT_BY_ID[systemId as SystemId] : undefined;
    return tuple ? toLocaleRecord(tuple)[lang] : '';
  }
  const match = SYSTEM_LOOKUP.get(normalizePresetKey(trimmed));
  return match ? match[lang] : fallback;
}

export function localizeTabTitle(
  tab: { id: TabId | string; title?: string; systemId?: SystemId },
  lang: AppLanguage,
): string {
  const raw = tab.title ?? '';
  if (!raw.trim()) {
    const labels = getLocalizedTabLabels(tab.systemId ?? 'default', lang);
    if (tab.id === 'magias' || tab.id === 'tab_2' || tab.id === '2') return labels.tab2;
    if (tab.id === 'xp' || tab.id === 'tab_3' || tab.id === '3') return labels.tab3;
    return labels.tab1;
  }
  const match = TAB_LOOKUP.get(normalizePresetKey(raw));
  return match ? match[lang] : raw;
}

export function localizeCardTitle(
  card: { id?: string; title?: string },
  lang: AppLanguage,
): string {
  const raw = card.title ?? '';
  if (!raw.trim()) {
    const tuple = card.id ? DEFAULT_CARD_TITLE_BY_ID[card.id] : undefined;
    return tuple ? toLocaleRecord(tuple)[lang] : '';
  }
  const match = CARD_TITLE_LOOKUP.get(normalizePresetKey(raw));
  return match ? match[lang] : raw;
}

export function localizeCardTag(
  card: { id?: string; code?: string; tag?: string },
  lang: AppLanguage,
): string {
  const raw = card.tag ?? card.code ?? '';
  if (!raw.trim()) {
    const tuple = card.id ? DEFAULT_CARD_TAG_BY_ID[card.id] : undefined;
    return tuple ? toLocaleRecord(tuple)[lang] : '';
  }
  const match = CARD_TAG_LOOKUP.get(normalizePresetKey(raw));
  return match ? match[lang] : raw;
}

export function localizeFieldLabel(
  field: { id?: string; key?: string; label?: string },
  lang: AppLanguage,
): string {
  const raw = field.label ?? '';
  if (!raw.trim()) {
    const keyNorm = field.key?.trim().toLowerCase() ?? '';
    const tuple = keyNorm
      ? (DEFAULT_FIELD_LABEL_BY_KEY[keyNorm] ?? CYBERPUNK_DEFAULT_FIELD_LABEL_BY_KEY[keyNorm])
      : undefined;
    return tuple ? toLocaleRecord(tuple)[lang] : '';
  }
  const norm = normalizePresetKey(raw);
  const direct = FIELD_LABEL_LOOKUP.get(norm) ?? ROLL_LABEL_LOOKUP.get(norm) ?? WOD_CATALOG_LOOKUP.get(norm);
  return direct ? direct[lang] : raw;
}

export function localizeFieldRollLabel(
  field: { id?: string; key?: string; label?: string; rollLabel?: string },
  lang: AppLanguage,
): string {
  const raw = field.rollLabel?.trim() ? field.rollLabel : (field.label ?? '');
  if (!raw.trim()) {
    return localizeFieldLabel({ id: field.id, key: field.key, label: '' }, lang);
  }
  const norm = normalizePresetKey(raw);
  const direct = ROLL_LABEL_LOOKUP.get(norm) ?? FIELD_LABEL_LOOKUP.get(norm) ?? WOD_CATALOG_LOOKUP.get(norm);
  return direct ? direct[lang] : raw;
}

export function localizeTableColumn(column: string, lang: AppLanguage): string {
  if (!column.trim()) return '';
  const match = TABLE_COLUMN_LOOKUP.get(normalizePresetKey(column));
  return match ? match[lang] : column;
}
