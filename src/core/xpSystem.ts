import type {
  CharacterSheetState,
  SheetCard,
  SheetField,
  XpLedgerEntry,
  XpRulePreset,
  XpState,
  XpUpgradeCategory,
} from './sheetModel.ts';
import { type AppLanguage, createTranslator } from './i18n.ts';

export type VirtueSubtype = 'willpower' | 'humanity' | 'virtue';

export interface XpPricingConfig {
  xpRulePreset?: XpRulePreset;
  customUseNewLevelBase?: boolean;
  outOfClanFieldIds?: Record<string, boolean>;
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
    if (isOutOfClan) {
      nextMap[fieldId] = true;
    } else {
      delete nextMap[fieldId];
    }
    return { ...prev, outOfClanFieldIds: nextMap };
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
  return pricing.xpRulePreset ?? sheet.xpRulePreset ?? 'storyteller-v20';
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
  'perception',
  'intelligence',
  'wisdom',
  'wits',
  'forca',
  'destreza',
  'constituicao',
  'intelecto',
  'sabedoria',
  'carisma',
  'aparencia',
  'raciocinio',
  'inteligencia',
  'vigor',
]);

const SKILL_KEYS = new Set([
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

export function getVirtueSubtype(field: SheetField): VirtueSubtype | undefined {
  const key = field.key.trim().toLowerCase();
  if (field.id === 'f_willpower' || WILLPOWER_KEYS.has(key)) return 'willpower';
  if (field.id === 'f_humanity' || HUMANITY_PATH_KEYS.has(key)) return 'humanity';
  if (VIRTUE_KEYS.has(key)) return 'virtue';
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
  if (!key || IGNORED_NUMERIC_KEYS.has(key)) return null;

  const cardSig = `${card.code} ${card.title}`.toUpperCase();
  const isVirtueCard = /VIRTUE|VIRTUDE|MORAL|TRILHA|PATH|CONVIC/.test(cardSig);

  if (field.kind === 'resource') {
    if (getVirtueSubtype(field) !== undefined || isVirtueCard) {
      return 'virtue';
    }
    return null;
  }

  if (field.kind !== 'number') return null;

  const isSkillCard =
    card.id === 'card_skills' ||
    /SKILL|PERICIA|PERÍCIA|HABILIDAD|TALENT|KNOWLEDGE/.test(cardSig);

  if (key === 'perception' && isSkillCard) return 'skill';

  if (getVirtueSubtype(field) !== undefined) return 'virtue';
  if (ATTRIBUTE_KEYS.has(key)) return 'attribute';
  if (SKILL_KEYS.has(key)) return 'skill';
  if (DISCIPLINE_KEYS.has(key)) return 'discipline';

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

  const useNewBase =
    preset === 'vampire-v5' || (preset === 'custom' && Boolean(options?.useNewLevelBase));

  if (useNewBase) {
    if (category === 'attribute') return 5;
    if (category === 'skill') return 3;
    if (category === 'virtue') return 3;
    return options?.isOutOfClan ? 7 : 5;
  }

  if (category === 'attribute') return 4;
  if (category === 'skill') return 2;
  if (category === 'virtue') return options?.virtueSubtype === 'willpower' ? 1 : 2;
  return options?.isOutOfClan ? 7 : 5;
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
    if (virtueSubtype === 'willpower' || virtueSubtype === 'humanity') {
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

export function extractAllTraits(
  sheet: CharacterSheetState,
  lang: AppLanguage = 'pt-BR',
  pricingOverride?: XpPricingConfig,
): UpgradableTrait[] {
  const availableXp = getAvailableXp(sheet.xp);
  const pricing = pricingOverride ?? getXpPricingConfig(sheet);
  const preset = getEffectiveXpRulePreset(sheet, pricing);
  const customUseNewLevelBase = getEffectiveCustomUseNewLevelBase(sheet, pricing);
  const useD20Scale = !isWodSystem(sheet) && preset === 'storyteller-v20';
  const traits: UpgradableTrait[] = [];

  for (const card of sheet.cards) {
    for (const field of card.fields) {
      const category = classifyTraitField(card, field);
      if (!category) continue;

      const virtueSubtype =
        category === 'virtue' ? (getVirtueSubtype(field) ?? 'virtue') : undefined;
      const currentValue = getTraitCurrentRating(field, virtueSubtype);
      const maxCap = getTraitMaxCap(sheet, currentValue, category, virtueSubtype, field.max);
      const isMaxed = currentValue >= maxCap;

      const isOutOfClan =
        category === 'discipline' ? Boolean(pricing.outOfClanFieldIds?.[field.id]) : false;
      const customCost = pricing.fieldCustomCosts?.[field.id];
      const customMultiplier = pricing.categoryMultipliers?.[category];

      const defaultCalc = calculateUpgradeCostDetails(currentValue, category, preset, lang, {
        isOutOfClan,
        virtueSubtype,
        useNewLevelBase: customUseNewLevelBase,
        useD20Scale,
      });
      const effectiveCalc = calculateUpgradeCostDetails(currentValue, category, preset, lang, {
        isOutOfClan,
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

  const categoryOrder: Record<XpUpgradeCategory, number> = {
    attribute: 0,
    skill: 1,
    discipline: 2,
    virtue: 3,
  };

  return traits.sort((a, b) => categoryOrder[a.category] - categoryOrder[b.category]);
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
    trait.category === 'discipline' && trait.isOutOfClan
      ? lang === 'en'
        ? ' [OUT]'
        : lang === 'es'
          ? ' [EXT]'
          : ' [FORA]'
      : '';
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
  };

  const nextCards = sheet.cards.map((card) => ({
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
  if (!entry.fieldId || typeof entry.fromValue !== 'number') {
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
  const fromValue = entry.fromValue;
  const nextCards = sheet.cards.map((card) => ({
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

  const nextLedger = currentXp.ledger.filter((_, idx) => idx !== targetIdx);

  return {
    ok: true,
    revertedLabel: entry.label,
    sheet: {
      ...sheet,
      cards: nextCards,
      xp: {
        totalEarned: currentXp.totalEarned,
        spent: Math.max(0, currentXp.spent - refund),
        ledger: nextLedger,
      },
    },
  };
}
