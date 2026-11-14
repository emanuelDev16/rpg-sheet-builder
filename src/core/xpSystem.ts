import type {
  CharacterSheetState,
  SheetCard,
  SheetField,
  XpLedgerEntry,
  XpState,
  XpUpgradeCategory,
} from './sheetModel';

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
): { cost: number; formulaLabel: string } {
  const rating = Math.max(0, Math.round(currentValue));
  if (useD20Scale) {
    if (category === 'attribute') {
      if (rating === 0) return { cost: 100, formulaLabel: 'NEW (100 XP)' };
      return { cost: rating * 100, formulaLabel: `${rating} × 100` };
    }
    if (category === 'skill') {
      if (rating === 0) return { cost: 50, formulaLabel: 'NEW (50 XP)' };
      return { cost: rating * 50, formulaLabel: `${rating} × 50` };
    }
    if (rating === 0) return { cost: 150, formulaLabel: 'NEW (150 XP)' };
    return { cost: rating * 150, formulaLabel: `${rating} × 150` };
  }

  if (category === 'attribute') {
    if (rating === 0) return { cost: 4, formulaLabel: 'NEW (4 XP)' };
    return { cost: rating * 4, formulaLabel: `${rating} × 4` };
  }
  if (category === 'skill') {
    if (rating === 0) return { cost: 3, formulaLabel: 'NEW (3 XP)' };
    return { cost: rating * 2, formulaLabel: `${rating} × 2` };
  }
  // discipline
  if (rating === 0) return { cost: 10, formulaLabel: 'NEW (10 XP)' };
  return { cost: rating * 5, formulaLabel: `${rating} × 5` };
}

export function getCostRulesSummary(sheet: CharacterSheetState): string[] {
  if (isWodSystem(sheet)) {
    return ['ATTR CUR×4', 'SKILL CUR×2 (3 EM 0)', 'DISC CUR×5 (10 EM 0)', 'CAP 5'];
  }
  return ['ABILITY CUR×100', 'SKILL CUR×50 (50 EM 0)', 'CAP 20/10'];
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

export function extractAllTraits(sheet: CharacterSheetState): UpgradableTrait[] {
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
      const { cost, formulaLabel } = calculateUpgradeCost(category, currentValue, useD20Scale);
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
): UpgradableTrait[] {
  return extractAllTraits(sheet).filter(
    (trait) => trait.isPossible && (categoryFilter === 'all' || trait.category === categoryFilter),
  );
}

export function getCheapestBlockedUpgrade(sheet: CharacterSheetState): UpgradableTrait | null {
  const candidates = extractAllTraits(sheet).filter((t) => !t.isMaxed);
  if (candidates.length === 0) return null;
  return candidates.reduce((best, curr) => (curr.cost < best.cost ? curr : best));
}

export function awardXp(
  sheet: CharacterSheetState,
  delta: number,
  reason: string,
  timestamp: string,
  entryId: string,
): { ok: boolean; sheet: CharacterSheetState; error?: string } {
  if (!Number.isFinite(delta) || Math.round(delta) === 0) {
    return {
      ok: false,
      sheet,
      error: 'Informe uma quantidade inteira de XP diferente de zero.',
    };
  }

  const intDelta = Math.round(delta);
  const currentXp = normalizeXpState(sheet.xp);
  const nextEarned = currentXp.totalEarned + intDelta;

  if (nextEarned < 0) {
    return {
      ok: false,
      sheet,
      error: 'O total de XP ganho não pode ser negativo.',
    };
  }

  if (nextEarned < currentXp.spent) {
    return {
      ok: false,
      sheet,
      error: `XP total (${nextEarned}) não pode ficar menor que o XP já gasto (${currentXp.spent}).`,
    };
  }

  const cleanLabel = reason.trim() || (intDelta > 0 ? 'SESSION XP AWARD' : 'XP ADJUSTMENT');
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
): {
  ok: boolean;
  sheet: CharacterSheetState;
  trait?: UpgradableTrait;
  error?: string;
} {
  const trait = extractAllTraits(sheet).find((t) => t.fieldId === fieldId);
  if (!trait) {
    return { ok: false, sheet, error: 'Atributo, perícia ou disciplina não encontrado na ficha.' };
  }
  if (trait.isMaxed) {
    return { ok: false, sheet, error: `${trait.label} já está no limite máximo (${trait.maxCap}).` };
  }
  const available = getAvailableXp(sheet.xp);
  if (trait.cost > available) {
    return {
      ok: false,
      sheet,
      error: `XP insuficiente para ${trait.label} (necessário: ${trait.cost} XP, disponível: ${available} XP).`,
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

export function undoLastUpgrade(sheet: CharacterSheetState): {
  ok: boolean;
  sheet: CharacterSheetState;
  revertedLabel?: string;
  error?: string;
} {
  const currentXp = normalizeXpState(sheet.xp);
  const targetIdx = currentXp.ledger.findIndex((entry) => entry.kind === 'upgrade');
  if (targetIdx === -1) {
    return { ok: false, sheet, error: 'Nenhum upgrade recente para desfazer.' };
  }

  const entry = currentXp.ledger[targetIdx];
  if (!entry.fieldId || typeof entry.fromValue !== 'number') {
    return { ok: false, sheet, error: 'Registro de upgrade incompatível para reversão.' };
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
