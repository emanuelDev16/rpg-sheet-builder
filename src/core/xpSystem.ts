import {
  evaluateSheet,
  getSheetVirtues,
  type CharacterSheetState,
  type SheetCard,
  type SheetField,
  type VirtuesState,
  type XpLedgerEntry,
  type XpRulePreset,
  type XpState,
  type XpUpgradeCategory,
} from './sheetModel.ts';
import { type AppLanguage, createTranslator } from './i18n.ts';
import {
  V20_SKILLS_CATALOG,
  V5_SKILLS_CATALOG,
  WOD_CATEGORY_LABELS,
  buildCatalogSkillFields,
  getWodSkillsCatalog,
  isCatalogSkillPresent,
  isOfficialVampireSheet,
  isSkillsCardCandidate,
  normalizeCatalogText,
  type WodCatalogEdition,
} from './wodSkillsCatalog.ts';
import {
  type DisciplineAffinity,
  buildCatalogDisciplineField,
  findClanByIdOrName,
  findDisciplineByIdOrName,
  getDisciplinesForEdition,
  isCatalogDisciplinePresent,
  isDisciplinesCardCandidate,
  resolveDisciplineAffinity,
} from './wodClansDisciplinesCatalog.ts';
import {
  type WodAdvantageGroup,
  buildCatalogAdvantageField,
  findAdvantageByIdOrName,
  getAdvantagesForEdition,
  isAdvantageCardCandidate,
  isCatalogAdvantagePresent,
} from './wodAdvantagesCatalog.ts';

export type VirtueSubtype = 'willpower' | 'humanity' | 'virtue' | 'advantage' | 'blood_potency';

export type AcquirableCatalogKind = 'skill' | 'discipline' | 'advantage';

export interface AcquirableCatalogTrait {
  catalogId: string;
  varName: string;
  kind: AcquirableCatalogKind;
  category: XpUpgradeCategory;
  label: string;
  summary?: string;
  subGroup?: string;
  edition: WodCatalogEdition;
  cost: number;
  formulaLabel: string;
  disciplineAffinity?: DisciplineAffinity;
  isInClan?: boolean;
  isAffordable: boolean;
}

export interface XpPricingConfig {
  xpRulePreset?: XpRulePreset;
  customUseNewLevelBase?: boolean;
  outOfClanFieldIds?: Record<string, boolean>;
  disciplineAffinityOverrides?: Record<string, DisciplineAffinity>;
  categoryMultipliers?: Partial<Record<XpUpgradeCategory, number>>;
  fieldCustomCosts?: Record<string, number>;
}

export interface UpgradableTrait {
  fieldId: string;
  key: string;
  label: string;
  category: XpUpgradeCategory;
  virtueSubtype?: VirtueSubtype;
  cardTitle?: string;
  currentValue: number;
  nextValue: number;
  maxCap: number;
  cost: number | null;
  defaultCost: number | null;
  formulaLabel: string;
  disciplineAffinity?: DisciplineAffinity;
  isOutOfClan?: boolean;
  isCustomCost?: boolean;
  isBlockedByRule?: boolean;
  blockedReason?: string;
  multiplier?: number;
  isMaxed: boolean;
  isAffordable: boolean;
  isPossible: boolean;
}

const XP_PRICING_STORAGE_KEY = 'gridsheet_xp_pricing_v1';
const memoryPricingStore = new Map<string, XpPricingConfig>();

function readAllStoredPricing(): Record<string, XpPricingConfig> {
  if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
    try {
      const raw = globalThis.localStorage.getItem(XP_PRICING_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, XpPricingConfig>;
        }
      }
    } catch {
      // Ignore storage access errors in private mode or non-browser runtimes
    }
  }
  return Object.fromEntries(memoryPricingStore.entries());
}

function writeAllStoredPricing(all: Record<string, XpPricingConfig>): void {
  memoryPricingStore.clear();
  for (const [k, v] of Object.entries(all)) {
    memoryPricingStore.set(k, v);
  }
  if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
    try {
      globalThis.localStorage.setItem(XP_PRICING_STORAGE_KEY, JSON.stringify(all));
    } catch {
      // Ignore storage write failures
    }
  }
}

export function getSheetPricingKey(sheet: CharacterSheetState): string {
  return sheet.id?.trim() || sheet.systemId || 'default';
}

export function getXpPricingConfig(sheet: CharacterSheetState): XpPricingConfig {
  const key = getSheetPricingKey(sheet);
  const all = readAllStoredPricing();
  return all[key] ?? memoryPricingStore.get(key) ?? {};
}

function updateSheetPricingConfig(
  sheet: CharacterSheetState,
  updater: (prev: XpPricingConfig) => XpPricingConfig,
): XpPricingConfig {
  const key = getSheetPricingKey(sheet);
  const all = readAllStoredPricing();
  const next = updater(all[key] ?? {});
  all[key] = next;
  writeAllStoredPricing(all);
  return next;
}

export function setTraitOutOfClan(
  sheet: CharacterSheetState,
  fieldId: string,
  isOutOfClan: boolean,
): XpPricingConfig {
  return updateSheetPricingConfig(sheet, (prev) => {
    const nextMap = { ...(prev.outOfClanFieldIds ?? {}) };
    nextMap[fieldId] = Boolean(isOutOfClan);
    const nextAffinities = { ...(prev.disciplineAffinityOverrides ?? {}) };
    nextAffinities[fieldId] = isOutOfClan ? 'discipline_out_of_clan' : 'discipline_clan';
    return {
      ...prev,
      outOfClanFieldIds: nextMap,
      disciplineAffinityOverrides: nextAffinities,
    };
  });
}

export function setTraitDisciplineAffinity(
  sheet: CharacterSheetState,
  fieldId: string,
  affinity: DisciplineAffinity | null,
): XpPricingConfig {
  return updateSheetPricingConfig(sheet, (prev) => {
    const nextAffinities = { ...(prev.disciplineAffinityOverrides ?? {}) };
    const nextMap = { ...(prev.outOfClanFieldIds ?? {}) };
    if (affinity === null) {
      delete nextAffinities[fieldId];
      delete nextMap[fieldId];
    } else {
      nextAffinities[fieldId] = affinity;
      nextMap[fieldId] = affinity === 'discipline_out_of_clan';
    }
    return {
      ...prev,
      outOfClanFieldIds: nextMap,
      disciplineAffinityOverrides: nextAffinities,
    };
  });
}

export function setCategoryMultiplierOverride(
  sheet: CharacterSheetState,
  category: XpUpgradeCategory,
  multiplier: number | null,
): XpPricingConfig {
  return updateSheetPricingConfig(sheet, (prev) => {
    const nextMultipliers = { ...(prev.categoryMultipliers ?? {}) };
    if (typeof multiplier === 'number' && Number.isFinite(multiplier) && multiplier >= 1) {
      nextMultipliers[category] = Math.round(multiplier);
    } else {
      delete nextMultipliers[category];
    }
    return { ...prev, categoryMultipliers: nextMultipliers };
  });
}

export function setTraitCustomCostOverride(
  sheet: CharacterSheetState,
  fieldId: string,
  cost: number | null,
): XpPricingConfig {
  return updateSheetPricingConfig(sheet, (prev) => {
    const nextCosts = { ...(prev.fieldCustomCosts ?? {}) };
    if (typeof cost === 'number' && Number.isFinite(cost) && cost >= 0) {
      nextCosts[fieldId] = Math.round(cost);
    } else {
      delete nextCosts[fieldId];
    }
    return { ...prev, fieldCustomCosts: nextCosts };
  });
}

export function resetXpPricingConfig(sheet: CharacterSheetState): XpPricingConfig {
  const key = getSheetPricingKey(sheet);
  const all = readAllStoredPricing();
  delete all[key];
  writeAllStoredPricing(all);
  return {};
}

export function getEffectiveXpRulePreset(
  sheet: CharacterSheetState,
  pricingOverride?: XpPricingConfig,
): XpRulePreset {
  const pricing = pricingOverride ?? getXpPricingConfig(sheet);
  return (
    pricingOverride?.xpRulePreset ??
    sheet.rulePreset ??
    pricing.xpRulePreset ??
    sheet.xpRulePreset ??
    'storyteller-v20'
  );
}

export function getEffectiveCustomUseNewLevelBase(
  sheet: CharacterSheetState,
  pricingOverride?: XpPricingConfig,
): boolean {
  const pricing = pricingOverride ?? getXpPricingConfig(sheet);
  return pricing.customUseNewLevelBase ?? sheet.customUseNewLevelBase ?? false;
}

export function setXpRulePreset(
  sheet: CharacterSheetState,
  preset: XpRulePreset,
): CharacterSheetState {
  return {
    ...sheet,
    rulePreset: preset,
    xpRulePreset: preset,
  };
}

export function setXpRulePresetConfig(
  sheet: CharacterSheetState,
  preset: XpRulePreset,
): XpPricingConfig {
  return updateSheetPricingConfig(sheet, (prev) => ({
    ...prev,
    xpRulePreset: preset,
  }));
}

export function setCustomUseNewLevelBaseConfig(
  sheet: CharacterSheetState,
  useNewLevelBase: boolean,
): XpPricingConfig {
  return updateSheetPricingConfig(sheet, (prev) => ({
    ...prev,
    customUseNewLevelBase: useNewLevelBase,
  }));
}

const IGNORED_NUMERIC_KEYS = new Set([
  'generation',
  'blood_potency',
  'nivel',
  'level',
  'fortitude_armor',
  'hunger',
  'health',
  'blood_pool',
]);

const ATTRIBUTE_KEYS = new Set([
  'strength',
  'dexterity',
  'stamina',
  'constitution',
  'charisma',
  'manipulation',
  'appearance',
  'composure',
  'perception',
  'intelligence',
  'wisdom',
  'wits',
  'resolve',
  'forca',
  'destreza',
  'constituicao',
  'intelecto',
  'sabedoria',
  'carisma',
  'aparencia',
  'percepcao',
  'raciocinio',
  'inteligencia',
  'determinacao',
  'vigor',
]);

const SKILL_KEYS = new Set([
  ...V20_SKILLS_CATALOG.map((s) => s.varName),
  ...V5_SKILLS_CATALOG.map((s) => s.varName),
  'brawl',
  'firearms',
  'stealth',
  'subterfuge',
  'occult',
  'melee',
  'athletics',
  'acrobatics',
  'arcana',
  'academics',
  'deception',
  'history',
  'insight',
  'investigation',
  'nature',
  'religion',
  'sleight_of_hand',
  'performance',
  'survival',
  'awareness',
  'persuasion',
  'intimidation',
  'larceny',
  'medicine',
  'science',
  'technology',
  'etiquette',
  'streetwise',
  'drive',
  'alertness',
  'empathy',
  'expression',
  'finance',
  'politics',
  'briga',
  'armas_de_fogo',
  'furtividade',
  'labia',
  'ocultismo',
  'atletismo',
  'investigacao',
  'lideranca',
  'leadership',
  'animal_ken',
  'craft',
  'crafts',
]);

const DISCIPLINE_KEYS = new Set([
  'dominate',
  'presence',
  'celerity',
  'fortitude',
  'potence',
  'obfuscate',
  'auspex',
  'protean',
  'animalism',
  'blood_sorcery',
  'thaumaturgy',
  'oblivion',
  'necromancy',
  'chimerstry',
  'dementation',
  'dominacao',
  'presenca',
  'rapidez',
  'potencia',
  'ofuscacao',
  'auspicios',
  'metamorfose',
  'animalismo',
  'taumaturgia',
]);

const WILLPOWER_KEYS = new Set(['willpower', 'forca_de_vontade', 'vontade']);
const HUMANITY_PATH_KEYS = new Set([
  'humanity',
  'humanidade',
  'trilha',
  'path',
  'road',
  'via',
  'moralidade',
]);
const VIRTUE_KEYS = new Set([
  'conscience',
  'consciencia',
  'conviccao',
  'conviction',
  'self_control',
  'autocontrole',
  'instinct',
  'instinto',
  'courage',
  'coragem',
]);

const SYNTHETIC_V20_VIRTUE_DEFS: ReadonlyArray<{
  id: string;
  key: string;
  prop: keyof VirtuesState;
  aliases: readonly string[];
  labels: Readonly<Record<AppLanguage, string>>;
}> = [
  {
    id: 'v20_virtue_conscience',
    key: 'conscience',
    prop: 'conscience',
    aliases: ['conscience', 'consciencia', 'conviction', 'conviccao'],
    labels: {
      'pt-BR': 'CONSCIÊNCIA',
      en: 'CONSCIENCE',
      es: 'CONCIENCIA',
    },
  },
  {
    id: 'v20_virtue_self_control',
    key: 'self_control',
    prop: 'selfControl',
    aliases: ['self_control', 'selfcontrol', 'autocontrole', 'instinct', 'instinto'],
    labels: {
      'pt-BR': 'AUTOCONTROLE',
      en: 'SELF-CONTROL',
      es: 'AUTOCONTROL',
    },
  },
  {
    id: 'v20_virtue_courage',
    key: 'courage',
    prop: 'courage',
    aliases: ['courage', 'coragem'],
    labels: {
      'pt-BR': 'CORAGEM',
      en: 'COURAGE',
      es: 'CORAJE',
    },
  },
];

export function getVirtueSubtype(
  field: SheetField,
  card?: Pick<SheetCard, 'id' | 'code' | 'title'>,
): VirtueSubtype | undefined {
  const key = field.key.trim().toLowerCase();
  if (field.id === 'f_blood_potency' || key === 'blood_potency') return 'blood_potency';
  if (field.id === 'f_willpower' || WILLPOWER_KEYS.has(key)) return 'willpower';
  if (field.id === 'f_humanity' || HUMANITY_PATH_KEYS.has(key)) return 'humanity';
  if (VIRTUE_KEYS.has(key)) return 'virtue';
  if (
    field.xpCategory === 'advantage' ||
    field.id.startsWith('f_adv_') ||
    field.id.startsWith('f_bg_') ||
    (card ? isAdvantageCardCandidate(card) : false) ||
    (key !== 'generation' && findAdvantageByIdOrName(key) !== null)
  ) {
    return 'advantage';
  }
  return undefined;
}

export function normalizeXpState(xp?: Partial<XpState> | null): XpState {
  const totalEarned =
    typeof xp?.totalEarned === 'number' && Number.isFinite(xp.totalEarned)
      ? Math.max(0, Math.round(xp.totalEarned))
      : 0;
  const spent =
    typeof xp?.spent === 'number' && Number.isFinite(xp.spent)
      ? Math.max(0, Math.round(xp.spent))
      : 0;
  const ledger = Array.isArray(xp?.ledger) ? xp.ledger : [];
  return {
    totalEarned,
    spent,
    ledger,
  };
}

export function getAvailableXp(xp?: Partial<XpState> | null): number {
  const normalized = normalizeXpState(xp);
  return Math.max(0, normalized.totalEarned - normalized.spent);
}

export function classifyTraitField(card: SheetCard, field: SheetField): XpUpgradeCategory | null {
  const key = field.key.trim().toLowerCase();
  if (!key) return null;
  if (field.kind === 'number' && field.xpCategory === 'advantage') {
    return 'virtue';
  }
  if (IGNORED_NUMERIC_KEYS.has(key)) return null;

  const cardSig = `${card.code} ${card.title}`.toUpperCase();
  const isVirtueCard =
    isAdvantageCardCandidate(card) ||
    /VIRTUE|VIRTUDE|MORAL|TRILHA|PATH|CONVIC/.test(cardSig);

  if (field.kind === 'resource') {
    if (field.xpCategory === 'virtue') return 'virtue';
    if (getVirtueSubtype(field, card) !== undefined || isVirtueCard) {
      return 'virtue';
    }
    return null;
  }

  if (field.kind !== 'number') return null;

  if (
    field.xpCategory === 'attribute' ||
    field.xpCategory === 'skill' ||
    field.xpCategory === 'virtue'
  ) {
    return field.xpCategory;
  }
  if (
    field.xpCategory === 'discipline' ||
    field.xpCategory === 'discipline_clan' ||
    field.xpCategory === 'discipline_out_of_clan' ||
    field.xpCategory === 'discipline_caitiff'
  ) {
    return 'discipline';
  }
  if (field.attributeGroup !== undefined) {
    return 'attribute';
  }

  const isSkillCard =
    card.id === 'card_skills' ||
    /SKILL|PERICIA|PERÍCIA|HABILIDAD|TALENT|KNOWLEDGE/.test(cardSig);

  if (key === 'perception' && isSkillCard) return 'skill';

  if (getVirtueSubtype(field, card) !== undefined) return 'virtue';
  if (ATTRIBUTE_KEYS.has(key)) return 'attribute';
  if (SKILL_KEYS.has(key)) return 'skill';
  if (DISCIPLINE_KEYS.has(key) || findDisciplineByIdOrName(key) !== null) return 'discipline';

  if (
    card.id === 'card_atributos' ||
    /ATTRIBUTE|ATRIBUTO|ABILITY/.test(cardSig)
  ) {
    return 'attribute';
  }
  if (isSkillCard) {
    return 'skill';
  }
  if (
    card.id === 'card_arcano' ||
    /DISCIPLIN|ARCANO|PODER|POWER|GIFT|SPHERE|ESFERA|MAGIA/.test(cardSig)
  ) {
    return 'discipline';
  }
  if (isVirtueCard) {
    return 'virtue';
  }

  return null;
}

export function isWodSystem(sheet: CharacterSheetState): boolean {
  if (sheet.systemId === 'wod') return true;
  if (sheet.systemId && sheet.systemId !== 'blank') return false;
  const sys = `${sheet.systemName} ${sheet.systemCode}`.toUpperCase();
  return sys.includes('DARKNESS') || sys.includes('STORYTELLER') || sys.includes('VAMPIRE');
}

export interface CalculateCostOptions {
  isOutOfClan?: boolean;
  disciplineAffinity?: DisciplineAffinity;
  virtueSubtype?: VirtueSubtype;
  customMultiplier?: number;
  customCost?: number;
  useNewLevelBase?: boolean;
  useD20Scale?: boolean;
}

export interface CalculateCostDetails {
  cost: number | null;
  formulaLabel: string;
  multiplier: number;
  isBlocked: boolean;
  blockedReason?: string;
}

function resolveDisciplineMultiplier(options?: CalculateCostOptions): number {
  if (options?.disciplineAffinity === 'discipline_caitiff') return 6;
  if (options?.disciplineAffinity === 'discipline_out_of_clan' || options?.isOutOfClan) return 7;
  return 5;
}

function resolveDefaultMultiplier(
  category: XpUpgradeCategory,
  preset: XpRulePreset,
  options?: CalculateCostOptions,
): number {
  if (options?.useD20Scale && preset === 'storyteller-v20') {
    if (category === 'attribute') return 100;
    if (category === 'discipline') return 150;
    return 50;
  }

  if (category === 'virtue' && options?.virtueSubtype === 'blood_potency') {
    return 10;
  }

  const useNewBase =
    preset === 'vampire-v5' || (preset === 'custom' && Boolean(options?.useNewLevelBase));

  if (useNewBase) {
    if (category === 'attribute') return 5;
    if (category === 'skill') return 3;
    if (category === 'virtue') return 3;
    return resolveDisciplineMultiplier(options);
  }

  if (category === 'attribute') return 4;
  if (category === 'skill') return 2;
  if (category === 'virtue') return options?.virtueSubtype === 'willpower' ? 1 : 2;
  return resolveDisciplineMultiplier(options);
}

function normalizeCustomOverride(
  customOverride?: CalculateCostOptions | number | null,
): CalculateCostOptions {
  if (typeof customOverride === 'number') {
    return Number.isFinite(customOverride) && customOverride >= 1
      ? { customMultiplier: Math.round(customOverride) }
      : {};
  }
  return customOverride ?? {};
}

export function calculateUpgradeCost(
  currentLevel: number,
  category: XpUpgradeCategory,
  preset: XpRulePreset = 'storyteller-v20',
  customOverride?: CalculateCostOptions | number | null,
): number | null {
  const options = normalizeCustomOverride(customOverride);
  const rating = Math.max(0, Math.round(currentLevel));
  const nextLevel = rating + 1;

  if (
    preset === 'vampire-v5' &&
    (options.virtueSubtype === 'willpower' || options.virtueSubtype === 'humanity')
  ) {
    return null;
  }

  if (
    typeof options.customCost === 'number' &&
    Number.isFinite(options.customCost) &&
    options.customCost >= 0
  ) {
    return Math.round(options.customCost);
  }

  const hasCustomMultiplier =
    typeof options.customMultiplier === 'number' &&
    Number.isFinite(options.customMultiplier) &&
    options.customMultiplier >= 1;
  const customMult = hasCustomMultiplier ? Math.round(options.customMultiplier as number) : undefined;
  const defaultMult = resolveDefaultMultiplier(category, preset, options);
  const mult = customMult ?? defaultMult;

  if (options.useD20Scale && preset === 'storyteller-v20') {
    return rating === 0 ? mult : rating * mult;
  }

  if (preset === 'vampire-v5') {
    return nextLevel * mult;
  }

  if (preset === 'custom') {
    if (options.useNewLevelBase) {
      return nextLevel * mult;
    }
    if (rating === 0) {
      if (customMult !== undefined) return mult;
      if (category === 'skill') return 3;
      if (category === 'discipline') return 10;
      return mult;
    }
    return rating * mult;
  }

  // storyteller-v20 (Base = currentLevel)
  if (customMult !== undefined) {
    return rating === 0 ? mult : rating * mult;
  }
  if (category === 'attribute') {
    return rating === 0 ? 4 : rating * 4;
  }
  if (category === 'skill') {
    return rating === 0 ? 3 : rating * 2;
  }
  if (category === 'virtue') {
    if (rating === 0 && options.virtueSubtype === 'advantage') {
      return DEFAULT_BACKGROUND_XP_COST;
    }
    return rating === 0 ? mult : rating * mult;
  }
  return rating === 0 ? 10 : rating * mult;
}

export function calculateUpgradeCostDetails(
  currentLevel: number,
  category: XpUpgradeCategory,
  preset: XpRulePreset = 'storyteller-v20',
  lang: AppLanguage = 'pt-BR',
  customOverride?: CalculateCostOptions | number | null,
): CalculateCostDetails {
  const t = createTranslator(lang);
  const options = normalizeCustomOverride(customOverride);
  const rating = Math.max(0, Math.round(currentLevel));
  const nextLevel = rating + 1;
  const defaultMult = resolveDefaultMultiplier(category, preset, options);
  const hasCustomMultiplier =
    typeof options.customMultiplier === 'number' &&
    Number.isFinite(options.customMultiplier) &&
    options.customMultiplier >= 1;
  const mult = hasCustomMultiplier
    ? Math.round(options.customMultiplier as number)
    : defaultMult;

  const cost = calculateUpgradeCost(rating, category, preset, options);
  if (cost === null) {
    return {
      cost: null,
      formulaLabel: t('xp.v5BlockedShort'),
      multiplier: mult,
      isBlocked: true,
      blockedReason: t('xp.v5BlockedNotice'),
    };
  }

  if (
    typeof options.customCost === 'number' &&
    Number.isFinite(options.customCost) &&
    options.customCost >= 0
  ) {
    const customTag = lang === 'en' ? 'CUSTOM' : lang === 'es' ? 'AJUSTE' : 'CUSTOM';
    return {
      cost,
      formulaLabel: `${cost} XP (${customTag})`,
      multiplier: rating > 0 ? Number((cost / rating).toFixed(1)) : cost,
      isBlocked: false,
    };
  }

  const usesNewLevelBase =
    preset === 'vampire-v5' || (preset === 'custom' && Boolean(options.useNewLevelBase));

  if (usesNewLevelBase) {
    return {
      cost,
      formulaLabel: `${nextLevel} × ${mult}`,
      multiplier: mult,
      isBlocked: false,
    };
  }

  if (rating === 0) {
    return {
      cost,
      formulaLabel: t('xp.newCostFormula', { cost }),
      multiplier: mult,
      isBlocked: false,
    };
  }

  return {
    cost,
    formulaLabel: `${rating} × ${mult}`,
    multiplier: mult,
    isBlocked: false,
  };
}

export function getCostRulesSummary(
  sheet: CharacterSheetState,
  lang: AppLanguage = 'pt-BR',
  pricingOverride?: XpPricingConfig,
): string[] {
  const t = createTranslator(lang);
  const pricing = pricingOverride ?? getXpPricingConfig(sheet);
  const preset = getEffectiveXpRulePreset(sheet, pricing);
  const useNewBase = getEffectiveCustomUseNewLevelBase(sheet, pricing);

  if (preset === 'vampire-v5') {
    return [
      t('xp.ruleV5Attr'),
      t('xp.ruleV5Skill'),
      t('xp.ruleV5Disc'),
      t('xp.ruleV5Virtue'),
      t('xp.ruleV5BloodPotency'),
    ];
  }

  if (preset === 'custom') {
    const attrMult =
      pricing.categoryMultipliers?.attribute ?? (useNewBase ? 5 : 4);
    const skillMult =
      pricing.categoryMultipliers?.skill ?? (useNewBase ? 3 : 2);
    const discMult =
      pricing.categoryMultipliers?.discipline ?? 5;
    const virtMult =
      pricing.categoryMultipliers?.virtue ?? (useNewBase ? 3 : 2);
    return [
      useNewBase ? t('xp.ruleCustomBaseNew') : t('xp.ruleCustomBaseCurrent'),
      `${t('xp.cat.attribute')} ×${attrMult}`,
      `${t('xp.cat.skill')} ×${skillMult}`,
      `${t('xp.cat.discipline')} ×${discMult}`,
      `${lang === 'en' ? 'VIRT' : 'VIRT'} ×${virtMult}`,
    ];
  }

  if (isWodSystem(sheet)) {
    const discRule =
      lang === 'en'
        ? 'Discipline: Clan ×5 / Out ×7'
        : lang === 'es'
          ? 'Disciplina: Clan ×5 / Ext ×7'
          : 'Disciplina: Clã ×5 / Fora ×7';
    const virtueRule =
      lang === 'en'
        ? 'Willpower ×1 · Virtues/Path ×2'
        : lang === 'es'
          ? 'Voluntad ×1 · Virtudes/Senda ×2'
          : 'Vontade ×1 · Virtudes/Trilha ×2';
    return [t('xp.ruleWodAttr'), t('xp.ruleWodSkill'), discRule, virtueRule];
  }
  return [t('xp.ruleD20Attr'), t('xp.ruleD20Skill'), t('xp.ruleD20Cap')];
}

export function getTraitMaxCap(
  sheet: CharacterSheetState,
  currentValue: number,
  category?: XpUpgradeCategory,
  virtueSubtype?: VirtueSubtype,
  fieldMax?: number,
): number {
  if (category === 'virtue') {
    if (
      virtueSubtype === 'willpower' ||
      virtueSubtype === 'humanity' ||
      virtueSubtype === 'blood_potency'
    ) {
      return Math.max(10, currentValue);
    }
    if (typeof fieldMax === 'number' && Number.isFinite(fieldMax) && fieldMax > 0) {
      return Math.max(fieldMax, currentValue);
    }
    return isWodSystem(sheet) ? 5 : Math.max(10, currentValue);
  }
  if (isWodSystem(sheet)) return 5;
  if (category === 'skill') return Math.max(10, currentValue);
  return currentValue >= 5 ? 20 : 10;
}

function getTraitCurrentRating(field: SheetField, virtueSubtype?: VirtueSubtype): number {
  if (field.kind === 'resource' && virtueSubtype === 'willpower') {
    const rawMax = typeof field.max === 'number' ? field.max : Number(field.value ?? 0);
    return Number.isFinite(rawMax) ? Math.max(0, Math.round(rawMax)) : 0;
  }
  const rawVal = typeof field.value === 'number' ? field.value : Number(field.value ?? 0);
  return Number.isFinite(rawVal) ? Math.max(0, Math.round(rawVal)) : 0;
}

export function getSheetClanName(sheet: CharacterSheetState): string {
  for (const card of sheet.cards) {
    for (const field of card.fields) {
      const fk = (field.key ?? '').trim().toLowerCase();
      if ((field.id === 'f_clan' || fk === 'clan') && typeof field.value === 'string') {
        return field.value.trim();
      }
    }
  }
  return '';
}

function resolveTraitDisciplineAffinity(
  sheet: CharacterSheetState,
  field: SheetField,
  pricing: XpPricingConfig,
  preset: XpRulePreset,
): DisciplineAffinity {
  const workspaceOverride = pricing.disciplineAffinityOverrides?.[field.id];
  if (workspaceOverride) {
    return workspaceOverride;
  }
  if (
    pricing.outOfClanFieldIds &&
    Object.prototype.hasOwnProperty.call(pricing.outOfClanFieldIds, field.id)
  ) {
    return pricing.outOfClanFieldIds[field.id] ? 'discipline_out_of_clan' : 'discipline_clan';
  }
  if (
    field.xpCategory === 'discipline_clan' ||
    field.xpCategory === 'discipline_out_of_clan' ||
    field.xpCategory === 'discipline_caitiff'
  ) {
    return field.xpCategory;
  }
  if (
    isWodSystem(sheet) &&
    (preset === 'storyteller-v20' || preset === 'vampire-v5')
  ) {
    const sheetClan = getSheetClanName(sheet);
    const matchedClan = sheetClan ? findClanByIdOrName(sheetClan, preset) : null;
    if (matchedClan) {
      const discByKey = findDisciplineByIdOrName(field.key, preset);
      const discByLabel = !discByKey ? findDisciplineByIdOrName(field.label, preset) : null;
      const discToken = discByKey
        ? field.key
        : discByLabel
          ? field.label
          : field.key || field.label;
      return resolveDisciplineAffinity(sheetClan, discToken, preset);
    }
  }
  return 'discipline_clan';
}

export function extractAllTraits(
  sheet: CharacterSheetState,
  lang: AppLanguage = 'pt-BR',
  pricingOverride?: XpPricingConfig,
): UpgradableTrait[] {
  const t = createTranslator(lang);
  const availableXp = getAvailableXp(sheet.xp);
  const pricing = pricingOverride ?? getXpPricingConfig(sheet);
  const preset = getEffectiveXpRulePreset(sheet, pricing);
  const customUseNewLevelBase = getEffectiveCustomUseNewLevelBase(sheet, pricing);
  const useD20Scale = !isWodSystem(sheet) && preset === 'storyteller-v20';
  const traits: UpgradableTrait[] = [];
  let cachedEval: ReturnType<typeof evaluateSheet> | null = null;
  const getEval = () => {
    if (!cachedEval) cachedEval = evaluateSheet(sheet);
    return cachedEval;
  };

  for (const card of sheet.cards) {
    for (const field of card.fields) {
      const category = classifyTraitField(card, field);
      if (!category) continue;

      const virtueSubtype =
        category === 'virtue' ? (getVirtueSubtype(field, card) ?? 'virtue') : undefined;
      const currentValue = getTraitCurrentRating(field, virtueSubtype);
      const maxCap = getTraitMaxCap(sheet, currentValue, category, virtueSubtype, field.max);
      const isMaxed = currentValue >= maxCap;

      const disciplineAffinity =
        category === 'discipline'
          ? resolveTraitDisciplineAffinity(sheet, field, pricing, preset)
          : undefined;
      const isOutOfClan = disciplineAffinity === 'discipline_out_of_clan';
      const customCost = pricing.fieldCustomCosts?.[field.id];
      const customMultiplier = pricing.categoryMultipliers?.[category];

      const defaultCalc = calculateUpgradeCostDetails(currentValue, category, preset, lang, {
        isOutOfClan,
        disciplineAffinity,
        virtueSubtype,
        useNewLevelBase: customUseNewLevelBase,
        useD20Scale,
      });
      const effectiveCalc = calculateUpgradeCostDetails(currentValue, category, preset, lang, {
        isOutOfClan,
        disciplineAffinity,
        virtueSubtype,
        customMultiplier,
        customCost,
        useNewLevelBase: customUseNewLevelBase,
        useD20Scale,
      });

      const isBlockedByRule = effectiveCalc.isBlocked || effectiveCalc.cost === null;
      const isAffordable =
        !isBlockedByRule && effectiveCalc.cost !== null && effectiveCalc.cost <= availableXp;
      const isCustomCost =
        !isBlockedByRule &&
        (typeof customCost === 'number' || typeof customMultiplier === 'number');

      traits.push({
        fieldId: field.id,
        key: field.key,
        label: field.label,
        category,
        virtueSubtype,
        cardTitle: card.title,
        currentValue,
        nextValue: currentValue + 1,
        maxCap,
        cost: effectiveCalc.cost,
        defaultCost: defaultCalc.cost,
        formulaLabel: effectiveCalc.formulaLabel,
        ...(disciplineAffinity ? { disciplineAffinity } : {}),
        isOutOfClan,
        isCustomCost,
        isBlockedByRule,
        blockedReason: effectiveCalc.blockedReason,
        multiplier: effectiveCalc.multiplier,
        isMaxed,
        isAffordable,
        isPossible: !isMaxed && !isBlockedByRule && isAffordable,
      });
    }
  }

  // V20 Virtues stored in sheet.virtues (Conscience, Self-Control, Courage)
  if (
    isWodSystem(sheet) &&
    preset !== 'vampire-v5' &&
    (preset === 'storyteller-v20' || sheet.virtues !== undefined)
  ) {
    const sheetVirtues = getSheetVirtues(sheet);
    const existingKeys = new Set(traits.map((tr) => tr.key.trim().toLowerCase()));
    const customMultiplier = pricing.categoryMultipliers?.virtue;

    for (const def of SYNTHETIC_V20_VIRTUE_DEFS) {
      if (def.aliases.some((alias) => existingKeys.has(alias))) continue;
      const currentValue = sheetVirtues[def.prop];
      const maxCap = 5;
      const isMaxed = currentValue >= maxCap;
      const customCost = pricing.fieldCustomCosts?.[def.id];
      const defaultCalc = calculateUpgradeCostDetails(currentValue, 'virtue', preset, lang, {
        virtueSubtype: 'virtue',
        useNewLevelBase: customUseNewLevelBase,
      });
      const effectiveCalc = calculateUpgradeCostDetails(currentValue, 'virtue', preset, lang, {
        virtueSubtype: 'virtue',
        customMultiplier,
        customCost,
        useNewLevelBase: customUseNewLevelBase,
      });
      const isBlockedByRule = effectiveCalc.isBlocked || effectiveCalc.cost === null;
      const isAffordable =
        !isBlockedByRule && effectiveCalc.cost !== null && effectiveCalc.cost <= availableXp;
      const isCustomCost =
        !isBlockedByRule &&
        (typeof customCost === 'number' || typeof customMultiplier === 'number');

      traits.push({
        fieldId: def.id,
        key: def.key,
        label: def.labels[lang],
        category: 'virtue',
        virtueSubtype: 'virtue',
        currentValue,
        nextValue: currentValue + 1,
        maxCap,
        cost: effectiveCalc.cost,
        defaultCost: defaultCalc.cost,
        formulaLabel: effectiveCalc.formulaLabel,
        isCustomCost,
        isBlockedByRule,
        blockedReason: effectiveCalc.blockedReason,
        multiplier: effectiveCalc.multiplier,
        isMaxed,
        isAffordable,
        isPossible: !isMaxed && !isBlockedByRule && isAffordable,
      });
    }
  }

  // V5 Blood Potency (Novo Nível × 10 XP, max 10)
  if (isWodSystem(sheet) && preset === 'vampire-v5') {
    let bpFieldInfo: { cardTitle: string; field: SheetField } | null = null;
    for (const card of sheet.cards) {
      const found = card.fields.find(
        (f) => f.id === 'f_blood_potency' || f.key.trim().toLowerCase() === 'blood_potency',
      );
      if (found) {
        bpFieldInfo = { cardTitle: card.title, field: found };
        break;
      }
    }

    const bpFieldId = bpFieldInfo?.field.id ?? 'f_blood_potency';
    let currentValue = 1;
    if (bpFieldInfo) {
      if (bpFieldInfo.field.kind === 'number') {
        currentValue = getTraitCurrentRating(bpFieldInfo.field, 'blood_potency');
      } else {
        const evalRes = getEval();
        const computedVal =
          evalRes.computedByFieldId[bpFieldInfo.field.id]?.value ?? evalRes.variables.blood_potency;
        currentValue =
          typeof computedVal === 'number' && Number.isFinite(computedVal)
            ? Math.max(0, Math.min(10, Math.round(computedVal)))
            : 1;
      }
    } else {
      const genField = sheet.cards
        .flatMap((c) => c.fields)
        .find((f) => f.id === 'f_generation' || f.key.trim().toLowerCase() === 'generation');
      const genNum =
        typeof genField?.value === 'number' && Number.isFinite(genField.value)
          ? Math.round(genField.value)
          : 13;
      currentValue = Math.max(1, Math.min(10, 13 - genNum));
    }

    const rawLabel = bpFieldInfo?.field.label.trim() ?? '';
    const bpLabel =
      rawLabel && rawLabel.toUpperCase() !== 'BLOOD_POTENCY'
        ? rawLabel
        : t('xp.bloodPotencyLabel');
    const maxCap = Math.max(10, currentValue);
    const isMaxed = currentValue >= maxCap;
    const customCost = pricing.fieldCustomCosts?.[bpFieldId];
    const customMultiplier = pricing.categoryMultipliers?.virtue;

    const defaultCalc = calculateUpgradeCostDetails(currentValue, 'virtue', 'vampire-v5', lang, {
      virtueSubtype: 'blood_potency',
    });
    const effectiveCalc = calculateUpgradeCostDetails(currentValue, 'virtue', 'vampire-v5', lang, {
      virtueSubtype: 'blood_potency',
      customMultiplier,
      customCost,
    });
    const isBlockedByRule = effectiveCalc.isBlocked || effectiveCalc.cost === null;
    const isAffordable =
      !isBlockedByRule && effectiveCalc.cost !== null && effectiveCalc.cost <= availableXp;
    const isCustomCost =
      !isBlockedByRule &&
      (typeof customCost === 'number' || typeof customMultiplier === 'number');

    traits.push({
      fieldId: bpFieldId,
      key: 'blood_potency',
      label: bpLabel,
      category: 'virtue',
      virtueSubtype: 'blood_potency',
      cardTitle: bpFieldInfo?.cardTitle,
      currentValue,
      nextValue: currentValue + 1,
      maxCap,
      cost: effectiveCalc.cost,
      defaultCost: defaultCalc.cost,
      formulaLabel: effectiveCalc.formulaLabel,
      isCustomCost,
      isBlockedByRule,
      blockedReason: effectiveCalc.blockedReason,
      multiplier: effectiveCalc.multiplier,
      isMaxed,
      isAffordable,
      isPossible: !isMaxed && !isBlockedByRule && isAffordable,
    });
  }

  const categoryOrder: Record<XpUpgradeCategory, number> = {
    attribute: 0,
    skill: 1,
    discipline: 2,
    virtue: 3,
  };

  return traits.sort((a, b) => categoryOrder[a.category] - categoryOrder[b.category]);
}

function resolveOfficialWodEdition(
  sheet: CharacterSheetState,
  pricing: XpPricingConfig,
): WodCatalogEdition | null {
  if (!isWodSystem(sheet)) return null;
  const preset = getEffectiveXpRulePreset(sheet, pricing);
  return isOfficialVampireSheet('wod', preset) ? preset : null;
}

function collectSheetKeysByCategory(
  sheet: CharacterSheetState,
  targetCategory: 'skill' | 'discipline',
): string[] {
  const collected: string[] = [];
  for (const card of sheet.cards) {
    for (const field of card.fields) {
      if (field.kind !== 'number') continue;
      const cat = classifyTraitField(card, field);
      if (cat !== targetCategory) continue;
      if (field.key.trim()) collected.push(field.key.trim());
      if (field.label.trim()) collected.push(field.label.trim());
    }
  }
  return collected;
}

export function extractAcquirableTraits(
  sheet: CharacterSheetState,
  lang: AppLanguage = 'pt-BR',
  pricingOverride?: XpPricingConfig,
): AcquirableCatalogTrait[] {
  const pricing = pricingOverride ?? getXpPricingConfig(sheet);
  const edition = resolveOfficialWodEdition(sheet, pricing);
  if (!edition) return [];

  const availableXp = getAvailableXp(sheet.xp);
  const existingSkillKeys = collectSheetKeysByCategory(sheet, 'skill');
  const existingDiscKeys = collectSheetKeysByCategory(sheet, 'discipline');

  const items: AcquirableCatalogTrait[] = [];

  // 1. Missing Skills (0 -> 1)
  const customSkillMult = pricing.categoryMultipliers?.skill;
  for (const skill of getWodSkillsCatalog(edition)) {
    if (isCatalogSkillPresent(skill, existingSkillKeys)) continue;
    const calc = calculateUpgradeCostDetails(0, 'skill', edition, lang, {
      customMultiplier: customSkillMult,
    });
    const cost = calc.cost ?? 3;
    items.push({
      catalogId: skill.id,
      varName: skill.varName,
      kind: 'skill',
      category: 'skill',
      label: (skill.labels[lang] ?? skill.labels.en).toUpperCase(),
      subGroup: WOD_CATEGORY_LABELS[skill.category][lang],
      edition,
      cost,
      formulaLabel: calc.formulaLabel,
      isAffordable: cost <= availableXp,
    });
  }

  // 2. Missing Disciplines (0 -> 1), sorted with native Clan disciplines first
  const sheetClan = getSheetClanName(sheet);
  const matchedClan = sheetClan ? findClanByIdOrName(sheetClan, edition) : null;
  const customDiscMult = pricing.categoryMultipliers?.discipline;
  const acquirableDisciplines: AcquirableCatalogTrait[] = [];

  for (const disc of getDisciplinesForEdition(edition)) {
    if (isCatalogDisciplinePresent(disc, existingDiscKeys)) continue;
    const affinity: DisciplineAffinity = matchedClan
      ? resolveDisciplineAffinity(sheetClan, disc.id, edition)
      : 'discipline_clan';
    const isOutOfClan = affinity === 'discipline_out_of_clan';
    const calc = calculateUpgradeCostDetails(0, 'discipline', edition, lang, {
      disciplineAffinity: affinity,
      isOutOfClan,
      customMultiplier: customDiscMult,
    });
    const cost = calc.cost ?? (edition === 'vampire-v5' ? 5 : 10);
    acquirableDisciplines.push({
      catalogId: disc.id,
      varName: disc.varName,
      kind: 'discipline',
      category: 'discipline',
      label: (disc.name[lang] ?? disc.name.en).toUpperCase(),
      edition,
      cost,
      formulaLabel: calc.formulaLabel,
      disciplineAffinity: affinity,
      isInClan: affinity === 'discipline_clan',
      isAffordable: cost <= availableXp,
    });
  }

  acquirableDisciplines.sort((a, b) => {
    if (Boolean(a.isInClan) !== Boolean(b.isInClan)) return a.isInClan ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
  items.push(...acquirableDisciplines);

  // 3. Missing Advantages & Merits (0 -> 1)
  const customVirtMult = pricing.categoryMultipliers?.virtue;
  for (const adv of getAdvantagesForEdition(edition)) {
    if (isCatalogAdvantagePresent(sheet, adv.id, edition)) continue;
    const calc = calculateUpgradeCostDetails(0, 'virtue', edition, lang, {
      virtueSubtype: 'advantage',
      customMultiplier: customVirtMult,
    });
    const cost = calc.cost ?? DEFAULT_BACKGROUND_XP_COST;
    const subGroup: WodAdvantageGroup = adv.group;
    items.push({
      catalogId: adv.id,
      varName: adv.varName,
      kind: 'advantage',
      category: 'virtue',
      label: (adv.name[lang] ?? adv.name.en).toUpperCase(),
      summary: adv.summary[lang],
      subGroup,
      edition,
      cost,
      formulaLabel: calc.formulaLabel,
      isAffordable: cost <= availableXp,
    });
  }

  return items;
}

export function getPossibleUpgrades(
  sheet: CharacterSheetState,
  categoryFilter: XpUpgradeCategory | 'all' = 'all',
  lang: AppLanguage = 'pt-BR',
  pricingOverride?: XpPricingConfig,
): UpgradableTrait[] {
  return extractAllTraits(sheet, lang, pricingOverride).filter(
    (trait) => trait.isPossible && (categoryFilter === 'all' || trait.category === categoryFilter),
  );
}

export function getCheapestBlockedUpgrade(
  sheet: CharacterSheetState,
  lang: AppLanguage = 'pt-BR',
  pricingOverride?: XpPricingConfig,
): UpgradableTrait | null {
  const candidates = extractAllTraits(sheet, lang, pricingOverride).filter(
    (t) => !t.isMaxed && !t.isBlockedByRule && t.cost !== null,
  );
  if (candidates.length === 0) return null;
  return candidates.reduce((best, curr) =>
    (curr.cost ?? Infinity) < (best.cost ?? Infinity) ? curr : best,
  );
}

export function awardXp(
  sheet: CharacterSheetState,
  delta: number,
  reason: string,
  timestamp: string,
  entryId: string,
  lang: AppLanguage = 'pt-BR',
): { ok: boolean; sheet: CharacterSheetState; error?: string } {
  const t = createTranslator(lang);
  if (!Number.isFinite(delta) || Math.round(delta) === 0) {
    return {
      ok: false,
      sheet,
      error: t('xp.errZeroXp'),
    };
  }

  const intDelta = Math.round(delta);
  const currentXp = normalizeXpState(sheet.xp);
  const nextEarned = currentXp.totalEarned + intDelta;

  if (nextEarned < 0) {
    return {
      ok: false,
      sheet,
      error:
        lang === 'en'
          ? 'Total earned XP cannot be negative.'
          : lang === 'es'
            ? 'La XP total ganada no puede ser negativa.'
            : 'O total de XP ganho não pode ser negativo.',
    };
  }

  if (nextEarned < currentXp.spent) {
    return {
      ok: false,
      sheet,
      error:
        lang === 'en'
          ? `Total XP (${nextEarned}) cannot be lower than already spent XP (${currentXp.spent}).`
          : lang === 'es'
            ? `La XP total (${nextEarned}) no puede ser menor que la XP ya gastada (${currentXp.spent}).`
            : `XP total (${nextEarned}) não pode ficar menor que o XP já gasto (${currentXp.spent}).`,
    };
  }

  const defaultReason =
    intDelta > 0 ? t('xp.quickAwardLabel', { amount: intDelta }) : t('xp.quickAdjustLabel');
  const cleanLabel = reason.trim() || defaultReason;
  const entry: XpLedgerEntry = {
    id: entryId,
    timestamp,
    kind: 'award',
    delta: intDelta,
    label: cleanLabel.toUpperCase(),
  };

  return {
    ok: true,
    sheet: {
      ...sheet,
      xp: {
        totalEarned: nextEarned,
        spent: currentXp.spent,
        ledger: [entry, ...currentXp.ledger].slice(0, 40),
      },
    },
  };
}

export function upgradeTraitWithXp(
  sheet: CharacterSheetState,
  fieldId: string,
  timestamp: string,
  entryId: string,
  lang: AppLanguage = 'pt-BR',
  pricingOverride?: XpPricingConfig,
): {
  ok: boolean;
  sheet: CharacterSheetState;
  trait?: UpgradableTrait;
  error?: string;
} {
  const t = createTranslator(lang);
  const trait = extractAllTraits(sheet, lang, pricingOverride).find((tr) => tr.fieldId === fieldId);
  if (!trait) {
    return {
      ok: false,
      sheet,
      error:
        lang === 'en'
          ? 'Trait not found on sheet.'
          : lang === 'es'
            ? 'Rasgo no encontrado en la hoja.'
            : 'Traço não encontrado na ficha.',
    };
  }
  if (trait.isBlockedByRule || trait.cost === null) {
    return {
      ok: false,
      sheet,
      error: t('xp.errBlockedV5', { label: trait.label }),
    };
  }
  if (trait.isMaxed) {
    return {
      ok: false,
      sheet,
      error:
        lang === 'en'
          ? `${trait.label} is already at maximum cap (${trait.maxCap}).`
          : lang === 'es'
            ? `${trait.label} ya alcanzó el límite máximo (${trait.maxCap}).`
            : `${trait.label} já está no limite máximo (${trait.maxCap}).`,
    };
  }
  const available = getAvailableXp(sheet.xp);
  if (trait.cost > available) {
    return {
      ok: false,
      sheet,
      error:
        lang === 'en'
          ? `Insufficient XP for ${trait.label} (needed: ${trait.cost} XP, available: ${available} XP).`
          : lang === 'es'
            ? `XP insuficiente para ${trait.label} (necesaria: ${trait.cost} XP, disponible: ${available} XP).`
            : `XP insuficiente para ${trait.label} (necessário: ${trait.cost} XP, disponível: ${available} XP).`,
    };
  }

  const currentXp = normalizeXpState(sheet.xp);
  const clanTag =
    trait.category === 'discipline'
      ? trait.disciplineAffinity === 'discipline_caitiff'
        ? ' [CAITIFF]'
        : trait.isOutOfClan
          ? lang === 'en'
            ? ' [OUT]'
            : lang === 'es'
              ? ' [EXT]'
              : ' [FORA]'
          : ''
      : '';

  const syntheticVirtueDef = SYNTHETIC_V20_VIRTUE_DEFS.find((d) => d.id === fieldId);
  if (syntheticVirtueDef) {
    const nextVirtues: VirtuesState = {
      ...getSheetVirtues(sheet),
      [syntheticVirtueDef.prop]: Math.max(1, Math.min(5, trait.nextValue)),
    };
    const entry: XpLedgerEntry = {
      id: entryId,
      timestamp,
      kind: 'upgrade',
      delta: -trait.cost,
      xpSpent: trait.cost,
      label: `${trait.label} ${trait.currentValue} → ${trait.nextValue}`,
      fieldId: trait.fieldId,
      category: trait.category,
      fromValue: trait.currentValue,
      toValue: trait.nextValue,
    };
    return {
      ok: true,
      trait,
      sheet: {
        ...sheet,
        virtues: nextVirtues,
        xp: {
          totalEarned: currentXp.totalEarned,
          spent: currentXp.spent + trait.cost,
          ledger: [entry, ...currentXp.ledger].slice(0, 40),
        },
      },
    };
  }

  let createdField = false;
  let createdFieldIds: string[] | undefined;
  let createdCardId: string | undefined;
  let nextCards: SheetCard[];

  if (trait.virtueSubtype === 'blood_potency') {
    const hasBpField = sheet.cards.some((c) => c.fields.some((f) => f.id === fieldId));
    if (hasBpField) {
      nextCards = sheet.cards.map((card) => ({
        ...card,
        fields: card.fields.map((f) =>
          f.id === fieldId
            ? {
                id: f.id,
                key: f.key,
                label: f.label,
                kind: 'number' as const,
                value: trait.nextValue,
                max: 10,
              }
            : f,
        ),
      }));
    } else {
      const bpField: SheetField = {
        id: 'f_blood_potency',
        key: 'blood_potency',
        label: 'BLOOD_POTENCY',
        kind: 'number',
        value: trait.nextValue,
        max: 10,
      };
      createdField = true;
      createdFieldIds = ['f_blood_potency'];
      const idIdx = sheet.cards.findIndex((c) => c.id === 'card_identidade');
      const targetIdx = idIdx >= 0 ? idIdx : sheet.cards.length > 0 ? 0 : -1;
      if (targetIdx >= 0) {
        nextCards = sheet.cards.map((c, idx) =>
          idx === targetIdx ? { ...c, fields: [...c.fields, bpField] } : c,
        );
      } else {
        createdCardId = 'card_identidade';
        nextCards = [
          {
            id: createdCardId,
            tab: 'geral',
            code: '//CHRONICLE_ID',
            title: 'IDENTITY & LINEAGE',
            colSpan: 2,
            fields: [bpField],
          },
        ];
      }
    }
  } else {
    nextCards = sheet.cards.map((card) => ({
      ...card,
      fields: card.fields.map((f) => {
        if (f.id !== fieldId) return f;
        if (f.kind === 'resource' && trait.virtueSubtype === 'willpower') {
          const prevVal = typeof f.value === 'number' ? f.value : trait.currentValue;
          return {
            ...f,
            max: trait.nextValue,
            value: Math.min(trait.nextValue, Math.max(0, prevVal + 1)),
          };
        }
        return { ...f, value: trait.nextValue };
      }),
    }));
  }

  const entry: XpLedgerEntry = {
    id: entryId,
    timestamp,
    kind: 'upgrade',
    delta: -trait.cost,
    xpSpent: trait.cost,
    label: `${trait.label}${clanTag} ${trait.currentValue} → ${trait.nextValue}`,
    fieldId: trait.fieldId,
    category: trait.category,
    fromValue: trait.currentValue,
    toValue: trait.nextValue,
    ...(createdField ? { createdField, createdFieldIds, ...(createdCardId ? { createdCardId } : {}) } : {}),
  };

  return {
    ok: true,
    trait,
    sheet: {
      ...sheet,
      cards: nextCards,
      xp: {
        totalEarned: currentXp.totalEarned,
        spent: currentXp.spent + trait.cost,
        ledger: [entry, ...currentXp.ledger].slice(0, 40),
      },
    },
  };
}

export const SPECIALTY_XP_COST = 3;
export const DEFAULT_BACKGROUND_XP_COST = 3;

export interface BackgroundPresetOption {
  key: string;
  label: string;
}

export const BACKGROUND_PRESETS: BackgroundPresetOption[] = [
  { key: 'recursos', label: 'Recursos' },
  { key: 'contatos', label: 'Contatos' },
  { key: 'refugio', label: 'Refúgio' },
  { key: 'aliados', label: 'Aliados' },
  { key: 'geracao_bg', label: 'Geração' },
  { key: 'rebanho', label: 'Rebanho' },
  { key: 'meritos', label: 'Méritos' },
];

function slugifyBackgroundKey(label: string): string {
  const normalized = label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!normalized || normalized === 'generation') return 'geracao_bg';
  return normalized;
}

function ensureUniqueFieldId(sheet: CharacterSheetState, preferredId: string): string {
  const existingIds = new Set(sheet.cards.flatMap((c) => c.fields.map((f) => f.id)));
  if (!existingIds.has(preferredId)) return preferredId;
  let suffix = 2;
  while (existingIds.has(`${preferredId}_${suffix}`)) {
    suffix += 1;
  }
  return `${preferredId}_${suffix}`;
}

export function buySpecialtyWithXp(
  sheet: CharacterSheetState,
  skillFieldId: string,
  specialtyFocus: string,
  timestamp: string,
  entryId: string,
  lang: AppLanguage = 'pt-BR',
): {
  ok: boolean;
  sheet: CharacterSheetState;
  error?: string;
} {
  const focus = specialtyFocus.trim();
  if (!focus) {
    return {
      ok: false,
      sheet,
      error:
        lang === 'en'
          ? 'Enter a specialty focus.'
          : lang === 'es'
            ? 'Ingresa el enfoque de la especialidad.'
            : 'Informe o foco da especialização.',
    };
  }

  let targetSkill: SheetField | undefined;
  for (const card of sheet.cards) {
    const found = card.fields.find((f) => f.id === skillFieldId);
    if (found) {
      targetSkill = found;
      break;
    }
  }
  if (!targetSkill) {
    return {
      ok: false,
      sheet,
      error:
        lang === 'en'
          ? 'Target skill not found on sheet.'
          : lang === 'es'
            ? 'Habilidad objetivo no encontrada en la hoja.'
            : 'Habilidade alvo não encontrada na ficha.',
    };
  }

  const available = getAvailableXp(sheet.xp);
  if (available < SPECIALTY_XP_COST) {
    return {
      ok: false,
      sheet,
      error:
        lang === 'en'
          ? `Insufficient XP for Specialty (needed: ${SPECIALTY_XP_COST} XP, available: ${available} XP).`
          : lang === 'es'
            ? `XP insuficiente para Especialidad (necesaria: ${SPECIALTY_XP_COST} XP, disponible: ${available} XP).`
            : `XP insuficiente para Especialização (necessário: ${SPECIALTY_XP_COST} XP, disponível: ${available} XP).`,
    };
  }

  const currentXp = normalizeXpState(sheet.xp);
  const prevSpec = targetSkill.hint?.trim();
  const nextSpec = prevSpec ? `${prevSpec}, ${focus}` : focus;
  const skillKeyRegex = targetSkill.key.trim()
    ? new RegExp(`\\b${targetSkill.key.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    : null;

  const entry: XpLedgerEntry = {
    id: entryId,
    timestamp,
    kind: 'upgrade',
    delta: -SPECIALTY_XP_COST,
    xpSpent: SPECIALTY_XP_COST,
    label: `SPEC: ${targetSkill.label} (${focus})`,
    fieldId: targetSkill.id,
    category: 'skill',
    prevSpecialtyLabel: targetSkill.hint ?? '',
    prevRollSpecialty: Boolean(targetSkill.rollSpecialty),
  };

  const nextCards = sheet.cards.map((card) => ({
    ...card,
    fields: card.fields.map((f) => {
      if (f.id === targetSkill!.id) {
        return {
          ...f,
          rollSpecialty: true,
          hint: nextSpec,
        };
      }
      if (f.kind === 'roll' && skillKeyRegex && f.rollExpr && skillKeyRegex.test(f.rollExpr)) {
        return {
          ...f,
          rollSpecialty: true,
          hint: nextSpec,
        };
      }
      return f;
    }),
  }));

  return {
    ok: true,
    sheet: {
      ...sheet,
      cards: nextCards,
      xp: {
        totalEarned: currentXp.totalEarned,
        spent: currentXp.spent + SPECIALTY_XP_COST,
        ledger: [entry, ...currentXp.ledger].slice(0, 40),
      },
    },
  };
}

export function buyBackgroundWithXp(
  sheet: CharacterSheetState,
  label: string,
  timestamp: string,
  entryId: string,
  customCost?: number,
  lang: AppLanguage = 'pt-BR',
): {
  ok: boolean;
  sheet: CharacterSheetState;
  fieldId?: string;
  cost?: number;
  error?: string;
} {
  const cleanLabel = label.trim();
  if (!cleanLabel) {
    return {
      ok: false,
      sheet,
      error:
        lang === 'en'
          ? 'Enter a background or advantage name.'
          : lang === 'es'
            ? 'Ingresa el nombre del trasfondo o ventaja.'
            : 'Informe o nome do Antecedente ou Vantagem.',
    };
  }

  const cost =
    typeof customCost === 'number' && Number.isFinite(customCost) && customCost >= 0
      ? Math.round(customCost)
      : DEFAULT_BACKGROUND_XP_COST;
  const available = getAvailableXp(sheet.xp);
  if (available < cost) {
    return {
      ok: false,
      sheet,
      error:
        lang === 'en'
          ? `Insufficient XP for ${cleanLabel} (needed: ${cost} XP, available: ${available} XP).`
          : lang === 'es'
            ? `XP insuficiente para ${cleanLabel} (necesaria: ${cost} XP, disponible: ${available} XP).`
            : `XP insuficiente para ${cleanLabel} (necessário: ${cost} XP, disponível: ${available} XP).`,
    };
  }

  const baseKey = slugifyBackgroundKey(cleanLabel);
  const existingKeys = new Set(sheet.cards.flatMap((c) => c.fields.map((f) => f.key)));
  let uniqueKey = baseKey;
  let suffix = 2;
  while (existingKeys.has(uniqueKey)) {
    uniqueKey = `${baseKey}_${suffix++}`;
  }
  const newFieldId = ensureUniqueFieldId(
    sheet,
    `f_bg_${uniqueKey}_${Date.now().toString(36).slice(-4)}`,
  );
  const newField: SheetField = {
    id: newFieldId,
    key: uniqueKey,
    label: cleanLabel.toUpperCase(),
    kind: 'number',
    value: 1,
    max: 5,
    xpCategory: 'advantage',
  };

  const bgCardIdx = sheet.cards.findIndex((c) => isAdvantageCardCandidate(c));

  let createdCardId: string | undefined;
  let nextCards: SheetCard[];
  if (bgCardIdx >= 0) {
    nextCards = sheet.cards.map((c, idx) =>
      idx === bgCardIdx ? { ...c, fields: [...c.fields, newField] } : c,
    );
  } else {
    createdCardId = 'card_backgrounds';
    const newCard: SheetCard = {
      id: createdCardId,
      tab: 'geral',
      code: '//ANTECEDENTES',
      title: 'ANTECEDENTES & VANTAGENS',
      colSpan: 1,
      fields: [newField],
    };
    nextCards = [...sheet.cards, newCard];
  }

  const currentXp = normalizeXpState(sheet.xp);
  const entry: XpLedgerEntry = {
    id: entryId,
    timestamp,
    kind: 'upgrade',
    delta: -cost,
    xpSpent: cost,
    label: `${cleanLabel.toUpperCase()} 0 → 1`,
    fieldId: newFieldId,
    category: 'virtue',
    fromValue: 0,
    toValue: 1,
    createdField: true,
    createdFieldIds: [newFieldId],
    createdCardId,
  };

  return {
    ok: true,
    fieldId: newFieldId,
    cost,
    sheet: {
      ...sheet,
      cards: nextCards,
      xp: {
        totalEarned: currentXp.totalEarned,
        spent: currentXp.spent + cost,
        ledger: [entry, ...currentXp.ledger].slice(0, 40),
      },
    },
  };
}

export function buyCatalogSkillWithXp(
  sheet: CharacterSheetState,
  skillIdOrVarName: string,
  timestamp: string,
  entryId: string,
  lang: AppLanguage = 'pt-BR',
  pricingOverride?: XpPricingConfig,
): {
  ok: boolean;
  sheet: CharacterSheetState;
  fieldId?: string;
  cost?: number;
  label?: string;
  error?: string;
} {
  const pricing = pricingOverride ?? getXpPricingConfig(sheet);
  const edition = resolveOfficialWodEdition(sheet, pricing);
  if (!edition) {
    return {
      ok: false,
      sheet,
      error:
        lang === 'en'
          ? 'Official WoD catalog acquisition requires V20 or V5 rules.'
          : lang === 'es'
            ? 'La adquisición del catálogo oficial requiere reglas V20 o V5.'
            : 'Aquisição do catálogo oficial requer regras WoD V20 ou V5.',
    };
  }

  const normQuery = normalizeCatalogText(skillIdOrVarName);
  const skill = getWodSkillsCatalog(edition).find(
    (item) =>
      item.id === skillIdOrVarName ||
      item.varName === skillIdOrVarName ||
      normalizeCatalogText(item.varName) === normQuery ||
      Object.values(item.labels).some((lbl) => normalizeCatalogText(lbl) === normQuery) ||
      (item.aliases ?? []).some((al) => normalizeCatalogText(al) === normQuery),
  );
  if (!skill) {
    return {
      ok: false,
      sheet,
      error:
        lang === 'en'
          ? 'Skill not found in edition catalog.'
          : lang === 'es'
            ? 'Habilidad no encontrada en el catálogo de la edición.'
            : 'Habilidade não encontrada no catálogo da edição.',
    };
  }

  const existingSkillKeys = collectSheetKeysByCategory(sheet, 'skill');
  if (isCatalogSkillPresent(skill, existingSkillKeys)) {
    const labelText = (skill.labels[lang] ?? skill.labels.en).toUpperCase();
    return {
      ok: false,
      sheet,
      error:
        lang === 'en'
          ? `${labelText} is already on the sheet.`
          : lang === 'es'
            ? `${labelText} ya está en la hoja.`
            : `${labelText} já está presente na ficha.`,
    };
  }

  const calc = calculateUpgradeCostDetails(0, 'skill', edition, lang, {
    customMultiplier: pricing.categoryMultipliers?.skill,
  });
  const cost = calc.cost ?? 3;
  const available = getAvailableXp(sheet.xp);
  const displayLabel = (skill.labels[lang] ?? skill.labels.en).toUpperCase();
  if (available < cost) {
    return {
      ok: false,
      sheet,
      error:
        lang === 'en'
          ? `Insufficient XP for ${displayLabel} (needed: ${cost} XP, available: ${available} XP).`
          : lang === 'es'
            ? `XP insuficiente para ${displayLabel} (necesaria: ${cost} XP, disponible: ${available} XP).`
            : `XP insuficiente para ${displayLabel} (necessário: ${cost} XP, disponível: ${available} XP).`,
    };
  }

  const evalVars = evaluateSheet(sheet).variables;
  const builtFields = buildCatalogSkillFields(skill, edition, lang, evalVars);
  const numField = { ...builtFields[0], id: ensureUniqueFieldId(sheet, builtFields[0].id) };
  const rollField = { ...builtFields[1], id: ensureUniqueFieldId(sheet, builtFields[1].id) };
  const newFields = [numField, rollField];

  const skillCardIdx = sheet.cards.findIndex((c) => isSkillsCardCandidate(c));
  let createdCardId: string | undefined;
  let nextCards: SheetCard[];
  if (skillCardIdx >= 0) {
    nextCards = sheet.cards.map((c, idx) =>
      idx === skillCardIdx ? { ...c, fields: [...c.fields, ...newFields] } : c,
    );
  } else {
    createdCardId = 'card_skills';
    nextCards = [
      ...sheet.cards,
      {
        id: createdCardId,
        tab: 'geral',
        code: '//SKILLS_&_POOLS',
        title: 'ABILITIES & DICE POOLS',
        colSpan: 1,
        fields: newFields,
      },
    ];
  }

  const currentXp = normalizeXpState(sheet.xp);
  const entry: XpLedgerEntry = {
    id: entryId,
    timestamp,
    kind: 'upgrade',
    delta: -cost,
    xpSpent: cost,
    label: `${displayLabel} 0 → 1`,
    fieldId: numField.id,
    category: 'skill',
    fromValue: 0,
    toValue: 1,
    createdField: true,
    createdFieldIds: newFields.map((f) => f.id),
    ...(createdCardId ? { createdCardId } : {}),
  };

  return {
    ok: true,
    fieldId: numField.id,
    cost,
    label: displayLabel,
    sheet: {
      ...sheet,
      cards: nextCards,
      xp: {
        totalEarned: currentXp.totalEarned,
        spent: currentXp.spent + cost,
        ledger: [entry, ...currentXp.ledger].slice(0, 40),
      },
    },
  };
}

export function buyCatalogDisciplineWithXp(
  sheet: CharacterSheetState,
  disciplineIdOrName: string,
  timestamp: string,
  entryId: string,
  lang: AppLanguage = 'pt-BR',
  pricingOverride?: XpPricingConfig,
): {
  ok: boolean;
  sheet: CharacterSheetState;
  fieldId?: string;
  cost?: number;
  label?: string;
  error?: string;
} {
  const pricing = pricingOverride ?? getXpPricingConfig(sheet);
  const edition = resolveOfficialWodEdition(sheet, pricing);
  if (!edition) {
    return {
      ok: false,
      sheet,
      error:
        lang === 'en'
          ? 'Official WoD catalog acquisition requires V20 or V5 rules.'
          : lang === 'es'
            ? 'La adquisición del catálogo oficial requiere reglas V20 o V5.'
            : 'Aquisição do catálogo oficial requer regras WoD V20 ou V5.',
    };
  }

  const disc = findDisciplineByIdOrName(disciplineIdOrName, edition);
  if (!disc) {
    return {
      ok: false,
      sheet,
      error:
        lang === 'en'
          ? 'Discipline not found in edition catalog.'
          : lang === 'es'
            ? 'Disciplina no encontrada en el catálogo de la edición.'
            : 'Disciplina não encontrada no catálogo da edição.',
    };
  }

  const existingDiscKeys = collectSheetKeysByCategory(sheet, 'discipline');
  if (isCatalogDisciplinePresent(disc, existingDiscKeys)) {
    const labelText = (disc.name[lang] ?? disc.name.en).toUpperCase();
    return {
      ok: false,
      sheet,
      error:
        lang === 'en'
          ? `${labelText} is already on the sheet.`
          : lang === 'es'
            ? `${labelText} ya está en la hoja.`
            : `${labelText} já está presente na ficha.`,
    };
  }

  const sheetClan = getSheetClanName(sheet);
  const matchedClan = sheetClan ? findClanByIdOrName(sheetClan, edition) : null;
  const affinity: DisciplineAffinity = matchedClan
    ? resolveDisciplineAffinity(sheetClan, disc.id, edition)
    : 'discipline_clan';
  const isOutOfClan = affinity === 'discipline_out_of_clan';

  const calc = calculateUpgradeCostDetails(0, 'discipline', edition, lang, {
    disciplineAffinity: affinity,
    isOutOfClan,
    customMultiplier: pricing.categoryMultipliers?.discipline,
  });
  const cost = calc.cost ?? (edition === 'vampire-v5' ? 5 : 10);
  const available = getAvailableXp(sheet.xp);
  const displayLabel = (disc.name[lang] ?? disc.name.en).toUpperCase();
  if (available < cost) {
    return {
      ok: false,
      sheet,
      error:
        lang === 'en'
          ? `Insufficient XP for ${displayLabel} (needed: ${cost} XP, available: ${available} XP).`
          : lang === 'es'
            ? `XP insuficiente para ${displayLabel} (necesaria: ${cost} XP, disponible: ${available} XP).`
            : `XP insuficiente para ${displayLabel} (necessário: ${cost} XP, disponível: ${available} XP).`,
    };
  }

  const builtField = buildCatalogDisciplineField(disc, lang);
  const newField: SheetField = {
    ...builtField,
    id: ensureUniqueFieldId(sheet, builtField.id),
    xpCategory: 'discipline',
  };

  const arcanoIdx = sheet.cards.findIndex((c) => c.id === 'card_arcano');
  const discCardIdx =
    arcanoIdx >= 0
      ? arcanoIdx
      : sheet.cards.findIndex((c) => c.id !== 'card_grimorio' && isDisciplinesCardCandidate(c));

  let createdCardId: string | undefined;
  let nextCards: SheetCard[];
  if (discCardIdx >= 0) {
    nextCards = sheet.cards.map((c, idx) =>
      idx === discCardIdx ? { ...c, fields: [...c.fields, newField] } : c,
    );
  } else {
    createdCardId = 'card_arcano';
    nextCards = [
      ...sheet.cards,
      {
        id: createdCardId,
        tab: 'magias',
        code: '//DISCIPLINES',
        title: 'DISCIPLINES & OCCULT',
        colSpan: 1,
        fields: [newField],
      },
    ];
  }

  const clanTag =
    affinity === 'discipline_caitiff'
      ? ' [CAITIFF]'
      : isOutOfClan
        ? lang === 'en'
          ? ' [OUT]'
          : lang === 'es'
            ? ' [EXT]'
            : ' [FORA]'
        : '';

  const currentXp = normalizeXpState(sheet.xp);
  const entry: XpLedgerEntry = {
    id: entryId,
    timestamp,
    kind: 'upgrade',
    delta: -cost,
    xpSpent: cost,
    label: `${displayLabel}${clanTag} 0 → 1`,
    fieldId: newField.id,
    category: 'discipline',
    fromValue: 0,
    toValue: 1,
    createdField: true,
    createdFieldIds: [newField.id],
    ...(createdCardId ? { createdCardId } : {}),
  };

  return {
    ok: true,
    fieldId: newField.id,
    cost,
    label: displayLabel,
    sheet: {
      ...sheet,
      cards: nextCards,
      xp: {
        totalEarned: currentXp.totalEarned,
        spent: currentXp.spent + cost,
        ledger: [entry, ...currentXp.ledger].slice(0, 40),
      },
    },
  };
}

export function buyCatalogAdvantageWithXp(
  sheet: CharacterSheetState,
  advantageIdOrName: string,
  timestamp: string,
  entryId: string,
  lang: AppLanguage = 'pt-BR',
  customCost?: number,
  pricingOverride?: XpPricingConfig,
): {
  ok: boolean;
  sheet: CharacterSheetState;
  fieldId?: string;
  cost?: number;
  label?: string;
  error?: string;
} {
  const pricing = pricingOverride ?? getXpPricingConfig(sheet);
  const edition = resolveOfficialWodEdition(sheet, pricing);
  if (!edition) {
    return {
      ok: false,
      sheet,
      error:
        lang === 'en'
          ? 'Official WoD catalog acquisition requires V20 or V5 rules.'
          : lang === 'es'
            ? 'La adquisición del catálogo oficial requiere reglas V20 o V5.'
            : 'Aquisição do catálogo oficial requer regras WoD V20 ou V5.',
    };
  }

  const adv = findAdvantageByIdOrName(advantageIdOrName, edition);
  if (!adv) {
    return {
      ok: false,
      sheet,
      error:
        lang === 'en'
          ? 'Advantage not found in edition catalog.'
          : lang === 'es'
            ? 'Ventaja no encontrada en el catálogo de la edición.'
            : 'Vantagem ou antecedente não encontrado no catálogo da edição.',
    };
  }

  if (isCatalogAdvantagePresent(sheet, adv.id, edition)) {
    const labelText = (adv.name[lang] ?? adv.name.en).toUpperCase();
    return {
      ok: false,
      sheet,
      error:
        lang === 'en'
          ? `${labelText} is already on the sheet.`
          : lang === 'es'
            ? `${labelText} ya está en la hoja.`
            : `${labelText} já está presente na ficha.`,
    };
  }

  const calc = calculateUpgradeCostDetails(0, 'virtue', edition, lang, {
    virtueSubtype: 'advantage',
    customMultiplier: pricing.categoryMultipliers?.virtue,
  });
  const cost =
    typeof customCost === 'number' && Number.isFinite(customCost) && customCost >= 0
      ? Math.round(customCost)
      : calc.cost ?? DEFAULT_BACKGROUND_XP_COST;
  const available = getAvailableXp(sheet.xp);
  const displayLabel = (adv.name[lang] ?? adv.name.en).toUpperCase();
  if (available < cost) {
    return {
      ok: false,
      sheet,
      error:
        lang === 'en'
          ? `Insufficient XP for ${displayLabel} (needed: ${cost} XP, available: ${available} XP).`
          : lang === 'es'
            ? `XP insuficiente para ${displayLabel} (necesaria: ${cost} XP, disponible: ${available} XP).`
            : `XP insuficiente para ${displayLabel} (necessário: ${cost} XP, disponível: ${available} XP).`,
    };
  }

  const builtField = buildCatalogAdvantageField(adv, lang, 1);
  const newField: SheetField = {
    ...builtField,
    id: ensureUniqueFieldId(sheet, builtField.id),
  };

  const bgCardIdx = sheet.cards.findIndex((c) => isAdvantageCardCandidate(c));
  let createdCardId: string | undefined;
  let nextCards: SheetCard[];
  if (bgCardIdx >= 0) {
    nextCards = sheet.cards.map((c, idx) =>
      idx === bgCardIdx ? { ...c, fields: [...c.fields, newField] } : c,
    );
  } else {
    createdCardId = 'card_backgrounds';
    nextCards = [
      ...sheet.cards,
      {
        id: createdCardId,
        tab: 'geral',
        code: '//ANTECEDENTES',
        title: 'ANTECEDENTES & VANTAGENS',
        colSpan: 1,
        fields: [newField],
      },
    ];
  }

  const currentXp = normalizeXpState(sheet.xp);
  const entry: XpLedgerEntry = {
    id: entryId,
    timestamp,
    kind: 'upgrade',
    delta: -cost,
    xpSpent: cost,
    label: `${displayLabel} 0 → 1`,
    fieldId: newField.id,
    category: 'virtue',
    fromValue: 0,
    toValue: 1,
    createdField: true,
    createdFieldIds: [newField.id],
    ...(createdCardId ? { createdCardId } : {}),
  };

  return {
    ok: true,
    fieldId: newField.id,
    cost,
    label: displayLabel,
    sheet: {
      ...sheet,
      cards: nextCards,
      xp: {
        totalEarned: currentXp.totalEarned,
        spent: currentXp.spent + cost,
        ledger: [entry, ...currentXp.ledger].slice(0, 40),
      },
    },
  };
}

export function undoLastUpgrade(
  sheet: CharacterSheetState,
  lang: AppLanguage = 'pt-BR',
): {
  ok: boolean;
  sheet: CharacterSheetState;
  revertedLabel?: string;
  error?: string;
} {
  const currentXp = normalizeXpState(sheet.xp);
  const targetIdx = currentXp.ledger.findIndex((entry) => entry.kind === 'upgrade');
  if (targetIdx === -1) {
    return {
      ok: false,
      sheet,
      error:
        lang === 'en'
          ? 'No recent upgrade to undo.'
          : lang === 'es'
            ? 'No hay ninguna mejora reciente para deshacer.'
            : 'Nenhum upgrade recente para desfazer.',
    };
  }

  const entry = currentXp.ledger[targetIdx];
  const isSpecialtyUndo =
    entry.prevSpecialtyLabel !== undefined || entry.prevRollSpecialty !== undefined;
  const isCreatedFieldUndo = entry.createdField === true;

  if (
    !entry.fieldId ||
    (!isSpecialtyUndo && !isCreatedFieldUndo && typeof entry.fromValue !== 'number')
  ) {
    return {
      ok: false,
      sheet,
      error:
        lang === 'en'
          ? 'Upgrade entry cannot be reverted.'
          : lang === 'es'
            ? 'Registro de mejora incompatible para revertir.'
            : 'Registro de upgrade incompatível para reversão.',
    };
  }

  const refund =
    typeof entry.xpSpent === 'number' && Number.isFinite(entry.xpSpent) && entry.xpSpent >= 0
      ? Math.round(entry.xpSpent)
      : Math.abs(entry.delta);
  let nextCards = sheet.cards;
  let nextVirtues = sheet.virtues;

  const syntheticVirtueDef = SYNTHETIC_V20_VIRTUE_DEFS.find((d) => d.id === entry.fieldId);

  if (isCreatedFieldUndo) {
    const removeIds = new Set<string>([
      entry.fieldId,
      ...(entry.createdFieldIds ?? []),
    ]);
    nextCards = sheet.cards
      .map((card) => ({
        ...card,
        fields: card.fields.filter((f) => !removeIds.has(f.id)),
      }))
      .filter(
        (card) => !(entry.createdCardId && card.id === entry.createdCardId && card.fields.length === 0),
      );
  } else if (syntheticVirtueDef) {
    const fromValue = entry.fromValue!;
    nextVirtues = {
      ...getSheetVirtues(sheet),
      [syntheticVirtueDef.prop]: Math.max(1, Math.min(5, Math.round(fromValue))),
    };
  } else if (isSpecialtyUndo) {
    const targetField = sheet.cards.flatMap((c) => c.fields).find((f) => f.id === entry.fieldId);
    const skillKeyRegex = targetField?.key.trim()
      ? new RegExp(`\\b${targetField.key.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
      : null;
    const restoredSpec = entry.prevSpecialtyLabel ? entry.prevSpecialtyLabel : undefined;
    const restoredBool = Boolean(entry.prevRollSpecialty);
    nextCards = sheet.cards.map((card) => ({
      ...card,
      fields: card.fields.map((f) => {
        if (f.id === entry.fieldId) {
          return {
            ...f,
            hint: restoredSpec,
            rollSpecialty: restoredBool,
          };
        }
        if (f.kind === 'roll' && skillKeyRegex && f.rollExpr && skillKeyRegex.test(f.rollExpr)) {
          return {
            ...f,
            hint: restoredSpec,
            rollSpecialty: restoredBool,
          };
        }
        return f;
      }),
    }));
  } else {
    const fromValue = entry.fromValue!;
    nextCards = sheet.cards.map((card) => ({
      ...card,
      fields: card.fields.map((f) => {
        if (f.id !== entry.fieldId) return f;
        if (f.kind === 'resource' && getVirtueSubtype(f) === 'willpower') {
          const prevVal = typeof f.value === 'number' ? f.value : fromValue;
          return {
            ...f,
            max: Math.max(1, fromValue),
            value: Math.min(fromValue, Math.max(0, prevVal - 1)),
          };
        }
        return { ...f, value: fromValue };
      }),
    }));
  }

  const nextLedger = currentXp.ledger.filter((_, idx) => idx !== targetIdx);

  return {
    ok: true,
    revertedLabel: entry.label,
    sheet: {
      ...sheet,
      ...(nextVirtues !== undefined ? { virtues: nextVirtues } : {}),
      cards: nextCards,
      xp: {
        totalEarned: currentXp.totalEarned,
        spent: Math.max(0, currentXp.spent - refund),
        ledger: nextLedger,
      },
    },
  };
}
