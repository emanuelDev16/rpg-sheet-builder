import type {
  CharacterSheetState,
  SheetCard,
  SheetField,
  XpLedgerEntry,
  XpState,
  XpUpgradeCategory,
} from './sheetModel.ts';
import { type AppLanguage, createTranslator } from './i18n.ts';

export interface UpgradableTrait {
  fieldId: string;
  key: string;
  label: string;
  category: XpUpgradeCategory;
  currentValue: number;
  nextValue: number;
  maxCap: number;
  cost: number;
  formulaLabel: string;
  isMaxed: boolean;
  isAffordable: boolean;
  isPossible: boolean;
}

const IGNORED_NUMERIC_KEYS = new Set(['generation', 'nivel', 'level']);

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
]);

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
  if (field.kind !== 'number') return null;

  const key = field.key.trim().toLowerCase();
  if (!key || IGNORED_NUMERIC_KEYS.has(key)) return null;

  const cardCode = card.code.toUpperCase();
  const isSkillCard =
    card.id === 'card_skills' || cardCode.includes('SKILL') || cardCode.includes('PERICIA');

  if (key === 'perception' && isSkillCard) return 'skill';

  if (ATTRIBUTE_KEYS.has(key)) return 'attribute';
  if (SKILL_KEYS.has(key)) return 'skill';
  if (DISCIPLINE_KEYS.has(key)) return 'discipline';

  if (card.id === 'card_atributos' || cardCode.includes('ATTRIBUTE') || cardCode.includes('ATRIBUTO') || cardCode.includes('ABILITY')) {
    return 'attribute';
  }
  if (isSkillCard) {
    return 'skill';
  }
  if (card.id === 'card_arcano' || cardCode.includes('DISCIPLINE') || cardCode.includes('ARCANO')) {
    return 'discipline';
  }

  return null;
}

export function isWodSystem(sheet: CharacterSheetState): boolean {
  if (sheet.systemId === 'wod') return true;
  if (sheet.systemId && sheet.systemId !== 'blank') return false;
  const sys = `${sheet.systemName} ${sheet.systemCode}`.toUpperCase();
  return sys.includes('DARKNESS') || sys.includes('STORYTELLER') || sys.includes('VAMPIRE');
}

export function calculateUpgradeCost(
  category: XpUpgradeCategory,
  currentValue: number,
  useD20Scale = false,
  lang: AppLanguage = 'pt-BR',
): { cost: number; formulaLabel: string } {
  const t = createTranslator(lang);
  const rating = Math.max(0, Math.round(currentValue));
  if (useD20Scale) {
    if (category === 'attribute') {
      if (rating === 0) return { cost: 100, formulaLabel: t('xp.newCostFormula', { cost: 100 }) };
      return { cost: rating * 100, formulaLabel: `${rating} × 100` };
    }
    if (category === 'skill') {
      if (rating === 0) return { cost: 50, formulaLabel: t('xp.newCostFormula', { cost: 50 }) };
      return { cost: rating * 50, formulaLabel: `${rating} × 50` };
    }
    if (rating === 0) return { cost: 150, formulaLabel: t('xp.newCostFormula', { cost: 150 }) };
    return { cost: rating * 150, formulaLabel: `${rating} × 150` };
  }

  if (category === 'attribute') {
    if (rating === 0) return { cost: 4, formulaLabel: t('xp.newCostFormula', { cost: 4 }) };
    return { cost: rating * 4, formulaLabel: `${rating} × 4` };
  }
  if (category === 'skill') {
    if (rating === 0) return { cost: 3, formulaLabel: t('xp.newCostFormula', { cost: 3 }) };
    return { cost: rating * 2, formulaLabel: `${rating} × 2` };
  }
  // discipline
  if (rating === 0) return { cost: 10, formulaLabel: t('xp.newCostFormula', { cost: 10 }) };
  return { cost: rating * 5, formulaLabel: `${rating} × 5` };
}

export function getCostRulesSummary(sheet: CharacterSheetState, lang: AppLanguage = 'pt-BR'): string[] {
  const t = createTranslator(lang);
  if (isWodSystem(sheet)) {
    return [t('xp.ruleWodAttr'), t('xp.ruleWodSkill'), t('xp.ruleWodDisc'), t('xp.ruleWodCap')];
  }
  return [t('xp.ruleD20Attr'), t('xp.ruleD20Skill'), t('xp.ruleD20Cap')];
}

export function getTraitMaxCap(
  sheet: CharacterSheetState,
  currentValue: number,
  category?: XpUpgradeCategory,
): number {
  if (isWodSystem(sheet)) return 5;
  if (category === 'skill') return Math.max(10, currentValue);
  return currentValue >= 5 ? 20 : 10;
}

export function extractAllTraits(
  sheet: CharacterSheetState,
  lang: AppLanguage = 'pt-BR',
): UpgradableTrait[] {
  const availableXp = getAvailableXp(sheet.xp);
  const useD20Scale = !isWodSystem(sheet);
  const traits: UpgradableTrait[] = [];

  for (const card of sheet.cards) {
    for (const field of card.fields) {
      const category = classifyTraitField(card, field);
      if (!category) continue;

      const rawVal = typeof field.value === 'number' ? field.value : Number(field.value ?? 0);
      const currentValue = Number.isFinite(rawVal) ? Math.max(0, Math.round(rawVal)) : 0;
      const maxCap = getTraitMaxCap(sheet, currentValue, category);
      const isMaxed = currentValue >= maxCap;
      const { cost, formulaLabel } = calculateUpgradeCost(category, currentValue, useD20Scale, lang);
      const isAffordable = cost <= availableXp;

      traits.push({
        fieldId: field.id,
        key: field.key,
        label: field.label,
        category,
        currentValue,
        nextValue: currentValue + 1,
        maxCap,
        cost,
        formulaLabel,
        isMaxed,
        isAffordable,
        isPossible: !isMaxed && isAffordable,
      });
    }
  }

  const categoryOrder: Record<XpUpgradeCategory, number> = {
    attribute: 0,
    skill: 1,
    discipline: 2,
  };

  return traits.sort((a, b) => categoryOrder[a.category] - categoryOrder[b.category]);
}

export function getPossibleUpgrades(
  sheet: CharacterSheetState,
  categoryFilter: XpUpgradeCategory | 'all' = 'all',
  lang: AppLanguage = 'pt-BR',
): UpgradableTrait[] {
  return extractAllTraits(sheet, lang).filter(
    (trait) => trait.isPossible && (categoryFilter === 'all' || trait.category === categoryFilter),
  );
}

export function getCheapestBlockedUpgrade(
  sheet: CharacterSheetState,
  lang: AppLanguage = 'pt-BR',
): UpgradableTrait | null {
  const candidates = extractAllTraits(sheet, lang).filter((t) => !t.isMaxed);
  if (candidates.length === 0) return null;
  return candidates.reduce((best, curr) => (curr.cost < best.cost ? curr : best));
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

  const defaultReason = intDelta > 0 ? t('xp.quickAwardLabel', { amount: intDelta }) : t('xp.quickAdjustLabel');
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
): {
  ok: boolean;
  sheet: CharacterSheetState;
  trait?: UpgradableTrait;
  error?: string;
} {
  const trait = extractAllTraits(sheet, lang).find((t) => t.fieldId === fieldId);
  if (!trait) {
    return {
      ok: false,
      sheet,
      error:
        lang === 'en'
          ? 'Attribute, skill, or discipline not found on sheet.'
          : lang === 'es'
            ? 'Atributo, habilidad o disciplina no encontrado en la hoja.'
            : 'Atributo, perícia ou disciplina não encontrado na ficha.',
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
  const entry: XpLedgerEntry = {
    id: entryId,
    timestamp,
    kind: 'upgrade',
    delta: -trait.cost,
    label: `${trait.label} ${trait.currentValue} → ${trait.nextValue}`,
    fieldId: trait.fieldId,
    category: trait.category,
    fromValue: trait.currentValue,
    toValue: trait.nextValue,
  };

  const nextCards = sheet.cards.map((card) => ({
    ...card,
    fields: card.fields.map((f) =>
      f.id === fieldId ? { ...f, value: trait.nextValue } : f,
    ),
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

  const refund = Math.abs(entry.delta);
  const nextCards = sheet.cards.map((card) => ({
    ...card,
    fields: card.fields.map((f) =>
      f.id === entry.fieldId ? { ...f, value: entry.fromValue } : f,
    ),
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
