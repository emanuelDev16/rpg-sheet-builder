export type VariableMap = Record<string, number>;

export const MAX_RECURSION_DEPTH = 15;
export const MAX_DICE_COUNT = 100;
export const MAX_DICE_SIDES = 1000;
export const MAX_FORMULA_LENGTH = 256;

export function normalizeRulePreset(raw?: string | null): RulePreset {
  if (raw === 'vampire-v5' || raw === 'vampire_v5') return 'vampire-v5';
  if (raw === 'custom') return 'custom';
  return 'storyteller-v20';
}

export interface FormulaResult {
  ok: boolean;
  value: number;
  formatted: string;
  error?: string;
}

export interface EvaluateFormulaOptions {
  formulaMap?: Record<string, string>;
  visited?: Set<string>;
  depth?: number;
  resolvedMemo?: Record<string, number>;
}

export type WodOutcome = 'success' | 'failure' | 'botch';
export type V5RollStatus = 'success' | 'critical' | 'messy_critical' | 'failure' | 'bestial_failure';
export type RulePreset = 'storyteller-v20' | 'vampire-v5' | 'custom';
export type SoakDamageType = 'bashing' | 'lethal' | 'aggravated';
export type FrenzyKind = 'frenzy' | 'rotschreck';
export type V5FeedingPenaltyKey = '0' | '1' | '2' | '3' | '4' | '5+';
export type V20FrenzyVirtue =
  | 'autocontrole'
  | 'instinto'
  | 'coragem'
  | 'selfControl'
  | 'instinct'
  | 'courage';

export interface V5BloodPotencyStats {
  level: number;
  bloodSurgeDice: number;
  mendSuperficialPerRouse: number;
  powerBonusDice: number;
  rouseRerollMaxLevel: number;
  baneSeverity: number;
  feedingPenaltyKey: V5FeedingPenaltyKey;
}

export interface RemorseCheckResult {
  passed: boolean;
  pool: number;
  dice: number[];
  successes: number;
  previousHumanity: number;
  previousStains: number;
  nextHumanity: number;
  nextStains: 0;
}

export interface FrenzySheetFieldInput {
  id: string;
  key: string;
  kind: string;
  value?: number | string | boolean;
  max?: number;
  superficialDamage?: number;
  aggravatedDamage?: number;
}

export interface FrenzySheetInput {
  rulePreset?: RulePreset;
  xpRulePreset?: RulePreset;
  virtues?: {
    conscience?: number;
    selfControl?: number;
    courage?: number;
  };
  cards: Array<{
    fields: FrenzySheetFieldInput[];
  }>;
}

export interface FrenzyRollOptions {
  rulePreset?: RulePreset;
  difficulty?: number;
  virtue?: V20FrenzyVirtue;
  kind?: FrenzyKind;
  rng?: () => number;
}

export interface FrenzyRollResult extends DiceRollResult {
  frenzyKind: FrenzyKind;
  poolSize: number;
  virtueUsed?: 'selfControl' | 'instinct' | 'courage';
  resisted: boolean;
}

export interface WodPoolOptions {
  difficulty?: number;
  specialty?: boolean;
  willpowerAutoSuccess?: boolean;
  modifier?: number;
  isSoak?: boolean;
  rulePreset?: RulePreset;
  soakDamageType?: SoakDamageType;
  woundPenalty?: number;
  isWoundExempt?: boolean;
  hungerDice?: number;
  bloodSurge?: boolean;
  bloodSurgeDice?: number;
}

export interface DiceRollResult {
  ok: boolean;
  total: number;
  resolvedExpression: string;
  breakdown: string;
  rolls: number[];
  isCritical?: boolean;
  isFumble?: boolean;
  isPoolRoll?: boolean;
  difficulty?: number;
  specialty?: boolean;
  willpowerUsed?: boolean;
  isSoak?: boolean;
  soakDamageType?: SoakDamageType;
  rawDiceSuccesses?: number;
  onesCount?: number;
  canceledOnes?: number;
  doubledTensCount?: number;
  outcome?: WodOutcome;
  status?: V5RollStatus;
  margin?: number;
  rulePreset?: RulePreset;
  woundPenalty?: number;
  normalDice?: number[];
  hungerDice?: number;
  hungerRolls?: number[];
  messyCritical?: boolean;
  bestialFailure?: boolean;
  critPairsCount?: number;
  isRouseCheck?: boolean;
  hungerDelta?: number;
  isBloodSurge?: boolean;
  isWillpowerReroll?: boolean;
  isRemorseCheck?: boolean;
  isFrenzyRoll?: boolean;
  frenzyKind?: FrenzyKind;
  humanityLost?: boolean;
  rerolledIndices?: number[];
  error?: string;
}

export function computeRemainingDamageAfterSoak(
  incomingDamage: number,
  soakedSuccesses: number,
  soakDamageType: SoakDamageType = 'lethal',
): number {
  const incoming = Math.max(0, Math.round(incomingDamage));
  const soaked = Math.max(0, Math.round(soakedSuccesses));
  const remaining = Math.max(0, incoming - soaked);
  if (soakDamageType === 'bashing') {
    return Math.floor(remaining / 2);
  }
  return remaining;
}

const V5_BLOOD_SURGE_TABLE = [1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6] as const;
const V5_MEND_SUPERFICIAL_TABLE = [1, 1, 2, 2, 3, 3, 3, 4, 4, 5, 5] as const;
const V5_POWER_BONUS_TABLE = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5] as const;
const V5_ROUSE_REROLL_MAX_LEVEL_TABLE = [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5] as const;
const V5_BANE_SEVERITY_TABLE = [0, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6] as const;
const V5_FEEDING_PENALTY_KEYS: readonly V5FeedingPenaltyKey[] = [
  '0',
  '1',
  '2',
  '3',
  '4',
  '5+',
  '5+',
  '5+',
  '5+',
  '5+',
  '5+',
];

/**
 * Deterministic V5 Blood Potency stats lookup clamped to [0..10].
 */
export function getV5BloodPotencyStats(bloodPotency: number): V5BloodPotencyStats {
  const safeLevel =
    typeof bloodPotency === 'number' && Number.isFinite(bloodPotency)
      ? Math.max(0, Math.min(10, Math.round(bloodPotency)))
      : 0;
  return {
    level: safeLevel,
    bloodSurgeDice: V5_BLOOD_SURGE_TABLE[safeLevel],
    mendSuperficialPerRouse: V5_MEND_SUPERFICIAL_TABLE[safeLevel],
    powerBonusDice: V5_POWER_BONUS_TABLE[safeLevel],
    rouseRerollMaxLevel: V5_ROUSE_REROLL_MAX_LEVEL_TABLE[safeLevel],
    baneSeverity: V5_BANE_SEVERITY_TABLE[safeLevel],
    feedingPenaltyKey: V5_FEEDING_PENALTY_KEYS[safeLevel],
  };
}

export function getV5BloodSurgeBonus(bloodPotency?: number): number {
  if (typeof bloodPotency !== 'number' || !Number.isFinite(bloodPotency)) {
    return getV5BloodPotencyStats(1).bloodSurgeDice;
  }
  return getV5BloodPotencyStats(bloodPotency).bloodSurgeDice;
}

export function evaluateV5Rolls(
  rolls: number[],
  hungerDiceCount: number,
  difficulty = 2,
): {
  total: number;
  rawDiceSuccesses: number;
  difficulty: number;
  margin: number;
  critPairsCount: number;
  onesCount: number;
  normalRolls: number[];
  hungerRolls: number[];
  messyCritical: boolean;
  bestialFailure: boolean;
  isCritical: boolean;
  isFumble: boolean;
  outcome: WodOutcome;
  status: V5RollStatus;
} {
  const targetDifficulty = Math.max(
    1,
    Math.min(10, Math.round(Number.isFinite(difficulty) ? difficulty : 2)),
  );
  const clampedHunger = Math.max(0, Math.min(rolls.length, Math.round(hungerDiceCount)));
  const normalCount = rolls.length - clampedHunger;
  const normalRolls = rolls.slice(0, normalCount);
  const hungerRolls = rolls.slice(normalCount);

  let baseSuccesses = 0;
  let tensCount = 0;
  let onesCount = 0;

  for (const roll of rolls) {
    if (roll >= 6) baseSuccesses += 1;
    if (roll === 10) tensCount += 1;
    if (roll === 1) onesCount += 1;
  }

  const critPairsCount = Math.floor(tensCount / 2);
  // Each pair of 10s grants +2 bonus successes on top of their 2 base successes (= +4 total per pair)
  const total = baseSuccesses + critPairsCount * 2;
  const margin = total - targetDifficulty;
  const succeeded = total >= targetDifficulty;
  const isCritical = critPairsCount > 0 && succeeded;
  const messyCritical = isCritical && hungerRolls.some((r) => r === 10);
  const bestialFailure = rolls.length > 0 && !succeeded && hungerRolls.some((r) => r === 1);
  const isFumble = bestialFailure;
  const outcome: WodOutcome = bestialFailure ? 'botch' : succeeded ? 'success' : 'failure';
  const status: V5RollStatus = messyCritical
    ? 'messy_critical'
    : isCritical
      ? 'critical'
      : bestialFailure
        ? 'bestial_failure'
        : succeeded
          ? 'success'
          : 'failure';

  return {
    total,
    rawDiceSuccesses: total,
    difficulty: targetDifficulty,
    margin,
    critPairsCount,
    onesCount,
    normalRolls,
    hungerRolls,
    messyCritical,
    bestialFailure,
    isCritical,
    isFumble,
    outcome,
    status,
  };
}

export function executeRemorseCheck(
  humanity: number,
  stains: number,
  rng: () => number = Math.random,
): RemorseCheckResult {
  const previousHumanity =
    typeof humanity === 'number' && Number.isFinite(humanity)
      ? Math.max(0, Math.min(10, Math.round(humanity)))
      : 7;
  const previousStains =
    typeof stains === 'number' && Number.isFinite(stains)
      ? Math.max(0, Math.min(10, Math.round(stains)))
      : 0;
  const pool = Math.max(1, 10 - previousHumanity - previousStains);
  const dice: number[] = [];
  let successes = 0;
  for (let i = 0; i < pool; i += 1) {
    const roll = Math.floor(rng() * 10) + 1;
    dice.push(roll);
    if (roll >= 6) successes += 1;
  }
  const passed = successes >= 1;
  return {
    passed,
    pool,
    dice,
    successes,
    previousHumanity,
    previousStains,
    nextHumanity: passed ? previousHumanity : Math.max(0, previousHumanity - 1),
    nextStains: 0,
  };
}

function getNumericFieldValue(
  fields: readonly FrenzySheetFieldInput[],
  keys: readonly string[],
): number | null {
  for (const field of fields) {
    if (field.kind !== 'number' && field.kind !== 'resource') continue;
    const fk = field.key.trim().toLowerCase();
    const fid = field.id.trim().toLowerCase();
    if (keys.includes(fk) || keys.includes(fid)) {
      if (typeof field.value === 'number' && Number.isFinite(field.value)) {
        return Math.round(field.value);
      }
    }
  }
  return null;
}

export function resolveFrenzyRoll(
  sheet: FrenzySheetInput,
  options: FrenzyRollOptions = {},
): FrenzyRollResult {
  const rng = options.rng ?? Math.random;
  const preset = normalizeRulePreset(options.rulePreset ?? sheet.rulePreset ?? sheet.xpRulePreset);
  const allFields = sheet.cards.flatMap((c) => c.fields);

  if (preset === 'vampire-v5') {
    const wpField = allFields.find(
      (f) => f.id === 'f_willpower' || f.key.trim().toLowerCase() === 'willpower',
    );
    const composureVal = getNumericFieldValue(allFields, ['composure', 'f_composure']);
    const resolveVal = getNumericFieldValue(allFields, ['resolve', 'f_resolve']);
    const wpMax =
      composureVal !== null && resolveVal !== null
        ? Math.max(1, composureVal + resolveVal)
        : Math.max(1, Math.round(wpField?.max ?? 5));
    const agg = Math.max(0, Math.min(wpMax, Math.round(wpField?.aggravatedDamage ?? 0)));
    const remaining = Math.max(0, wpMax - agg);
    const sup =
      typeof wpField?.superficialDamage === 'number'
        ? Math.max(0, Math.min(remaining, Math.round(wpField.superficialDamage)))
        : typeof wpField?.aggravatedDamage === 'number'
          ? 0
          : Math.max(
              0,
              Math.min(
                remaining,
                wpMax -
                  Math.round(
                    typeof wpField?.value === 'number' && Number.isFinite(wpField.value)
                      ? wpField.value
                      : wpMax,
                  ),
              ),
            );
    const willpowerAvailable = Math.max(0, wpMax - agg - sup);
    const humField = allFields.find(
      (f) => f.id === 'f_humanity' || f.key.trim().toLowerCase() === 'humanity',
    );
    const humanity =
      typeof humField?.value === 'number' && Number.isFinite(humField.value)
        ? Math.max(0, Math.min(10, Math.round(humField.value)))
        : 7;

    const poolSize = Math.max(1, willpowerAvailable + Math.floor(humanity / 3));
    const difficulty =
      typeof options.difficulty === 'number' && Number.isFinite(options.difficulty)
        ? Math.max(1, Math.min(10, Math.round(options.difficulty)))
        : 2;
    const frenzyKind: FrenzyKind = options.kind ?? 'frenzy';

    const rollRes = rollDiceExpression(`pool(${poolSize}, ${difficulty})`, {}, rng, {
      rulePreset: 'vampire-v5',
      difficulty,
      hungerDice: 0,
      woundPenalty: 0,
      isWoundExempt: true,
      bloodSurge: false,
    });
    const resisted = rollRes.total >= difficulty;

    return {
      ...rollRes,
      isFrenzyRoll: true,
      frenzyKind,
      poolSize,
      resisted,
      hungerDice: 0,
      hungerRolls: [],
      woundPenalty: undefined,
    };
  }

  const rawVirtue = options.virtue ?? 'autocontrole';
  let virtueUsed: 'selfControl' | 'instinct' | 'courage' = 'selfControl';
  let defaultKind: FrenzyKind = 'frenzy';
  let rawVirtueValue = 3;

  if (rawVirtue === 'coragem' || rawVirtue === 'courage') {
    virtueUsed = 'courage';
    defaultKind = 'rotschreck';
    rawVirtueValue =
      getNumericFieldValue(allFields, ['courage', 'coragem']) ?? sheet.virtues?.courage ?? 4;
  } else if (rawVirtue === 'instinto' || rawVirtue === 'instinct') {
    virtueUsed = 'instinct';
    defaultKind = 'frenzy';
    rawVirtueValue =
      getNumericFieldValue(allFields, ['instinct', 'instinto']) ??
      sheet.virtues?.selfControl ??
      3;
  } else {
    virtueUsed = 'selfControl';
    defaultKind = 'frenzy';
    rawVirtueValue =
      getNumericFieldValue(allFields, ['self_control', 'selfcontrol', 'autocontrole']) ??
      sheet.virtues?.selfControl ??
      3;
  }

  const frenzyKind: FrenzyKind = options.kind ?? defaultKind;
  const poolSize = Math.max(1, Math.min(10, Math.round(rawVirtueValue)));
  const difficulty =
    typeof options.difficulty === 'number' && Number.isFinite(options.difficulty)
      ? Math.max(2, Math.min(10, Math.round(options.difficulty)))
      : 6;

  const rollRes = rollDiceExpression(`pool(${poolSize}, ${difficulty})`, {}, rng, {
    rulePreset: 'storyteller-v20',
    difficulty,
    woundPenalty: 0,
    isWoundExempt: true,
    specialty: false,
    willpowerAutoSuccess: false,
  });
  const resisted = rollRes.outcome === 'success';

  return {
    ...rollRes,
    isFrenzyRoll: true,
    frenzyKind,
    poolSize,
    virtueUsed,
    resisted,
    hungerDice: 0,
    woundPenalty: undefined,
  };
}

export function executeRouseCheck(rng: () => number = Math.random): DiceRollResult {
  const roll = Math.floor(rng() * 10) + 1;
  const passed = roll >= 6;
  const hungerDelta = passed ? 0 : 1;
  return {
    ok: true,
    total: passed ? 1 : 0,
    resolvedExpression: '1d10 (ROUSE CHECK · DIFF 6)',
    breakdown: `1d10[${roll}] ≥6 → ${passed ? 'ROUSE OK (HUNGER +0)' : 'ROUSE FAIL (+1 HUNGER)'}`,
    rolls: [roll],
    isCritical: false,
    isFumble: false,
    isPoolRoll: true,
    difficulty: 6,
    outcome: passed ? 'success' : 'failure',
    rulePreset: 'vampire-v5',
    isRouseCheck: true,
    hungerDelta,
  };
}

export function rerollV5PoolDice(
  previousRolls: number[],
  hungerDiceCount: number,
  indicesToReroll: number[],
  rng: () => number = Math.random,
  extraMeta?: { woundPenalty?: number; isBloodSurge?: boolean; difficulty?: number },
): DiceRollResult {
  const clampedHunger = Math.max(0, Math.min(previousRolls.length, Math.round(hungerDiceCount)));
  const maxNormalIndex = previousRolls.length - clampedHunger;
  const uniqueValidIndices = Array.from(
    new Set(
      indicesToReroll.filter(
        (idx) => Number.isInteger(idx) && idx >= 0 && idx < maxNormalIndex,
      ),
    ),
  ).slice(0, 3);

  const nextRolls = [...previousRolls];
  for (const idx of uniqueValidIndices) {
    nextRolls[idx] = Math.floor(rng() * 10) + 1;
  }

  const difficulty =
    typeof extraMeta?.difficulty === 'number' && Number.isFinite(extraMeta.difficulty)
      ? Math.max(1, Math.min(10, Math.round(extraMeta.difficulty)))
      : 2;

  const v5Eval = evaluateV5Rolls(nextRolls, clampedHunger, difficulty);
  const statusText = v5Eval.messyCritical
    ? `${v5Eval.total} / ${difficulty} SUCESSOS · MARGEM +${v5Eval.margin} · MESSY CRITICAL!`
    : v5Eval.bestialFailure
      ? `${v5Eval.total} / ${difficulty} SUCESSOS · BESTIAL FAILURE!`
      : v5Eval.isCritical
        ? `${v5Eval.total} / ${difficulty} SUCESSOS · MARGEM +${v5Eval.margin} · CRIT`
        : v5Eval.outcome === 'success'
          ? `${v5Eval.total} / ${difficulty} SUCESSOS · MARGEM +${v5Eval.margin}`
          : `${v5Eval.total} / ${difficulty} SUCESSOS · FALHA`;

  const woundPenalty =
    typeof extraMeta?.woundPenalty === 'number' && extraMeta.woundPenalty < 0
      ? Math.round(extraMeta.woundPenalty)
      : 0;

  return {
    ok: true,
    total: v5Eval.total,
    resolvedExpression: `${nextRolls.length}d10 (V5 · DIFF (META) ${difficulty} · WP REROLL)`,
    breakdown: `${nextRolls.length}d10[${nextRolls.join(', ')}] ≥6 (WP REROLL) → ${statusText}`,
    rolls: nextRolls,
    isCritical: v5Eval.isCritical,
    isFumble: v5Eval.isFumble,
    isPoolRoll: true,
    difficulty,
    margin: v5Eval.margin,
    status: v5Eval.status,
    specialty: false,
    willpowerUsed: true,
    isSoak: false,
    rawDiceSuccesses: v5Eval.rawDiceSuccesses,
    onesCount: v5Eval.onesCount,
    canceledOnes: 0,
    doubledTensCount: 0,
    outcome: v5Eval.outcome,
    rulePreset: 'vampire-v5',
    woundPenalty: woundPenalty < 0 ? woundPenalty : undefined,
    normalDice: v5Eval.normalRolls,
    hungerDice: clampedHunger,
    hungerRolls: v5Eval.hungerRolls,
    messyCritical: v5Eval.messyCritical,
    bestialFailure: v5Eval.bestialFailure,
    critPairsCount: v5Eval.critPairsCount,
    isBloodSurge: extraMeta?.isBloodSurge,
    isWillpowerReroll: true,
    rerolledIndices: uniqueValidIndices,
  };
}

type Token =
  | { type: 'num'; value: number }
  | { type: 'id'; value: string }
  | { type: 'op'; value: '+' | '-' | '*' | '/' }
  | { type: 'lparen' }
  | { type: 'rparen' }
  | { type: 'comma' };

const ALLOWED_FUNCTIONS: Record<string, (...args: number[]) => number> = {
  floor: (x: number) => Math.floor(x),
  ceil: (x: number) => Math.ceil(x),
  round: (x: number) => Math.round(x),
  abs: (x: number) => Math.abs(x),
  min: (...args: number[]) => {
    if (args.length === 0) throw new Error('min() requer argumentos');
    return Math.min(...args);
  },
  max: (...args: number[]) => {
    if (args.length === 0) throw new Error('max() requer argumentos');
    return Math.max(...args);
  },
};

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let numStr = '';
      let dotCount = 0;
      while (i < input.length && /[0-9.]/.test(input[i])) {
        if (input[i] === '.') dotCount += 1;
        if (dotCount > 1) throw new Error(`Número inválido próximo a "${numStr}"`);
        numStr += input[i];
        i += 1;
      }
      const parsed = Number(numStr);
      if (Number.isNaN(parsed)) throw new Error(`Número inválido: ${numStr}`);
      tokens.push({ type: 'num', value: parsed });
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let id = '';
      while (i < input.length && /[a-zA-Z0-9_]/.test(input[i])) {
        id += input[i];
        i += 1;
      }
      tokens.push({ type: 'id', value: id.toLowerCase() });
      continue;
    }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      tokens.push({ type: 'op', value: ch });
      i += 1;
      continue;
    }
    if (ch === '(') {
      tokens.push({ type: 'lparen' });
      i += 1;
      continue;
    }
    if (ch === ')') {
      tokens.push({ type: 'rparen' });
      i += 1;
      continue;
    }
    if (ch === ',') {
      tokens.push({ type: 'comma' });
      i += 1;
      continue;
    }
    throw new Error(`Caractere não suportado: "${ch}"`);
  }
  return tokens;
}

class Parser {
  private pos = 0;
  private readonly tokens: Token[];
  private readonly vars: VariableMap;
  private readonly options?: EvaluateFormulaOptions;
  private depth: number;

  constructor(tokens: Token[], vars: VariableMap, options?: EvaluateFormulaOptions) {
    this.tokens = tokens;
    this.vars = vars;
    this.options = options;
    this.depth = options?.depth ?? 0;
  }

  parse(): number {
    if (this.tokens.length === 0) {
      throw new Error('Fórmula vazia');
    }
    const result = this.parseExpression();
    if (this.pos < this.tokens.length) {
      throw new Error('Expressão incompleta ou tokens extras');
    }
    return result;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private consume(): Token {
    const tok = this.tokens[this.pos];
    this.pos += 1;
    return tok;
  }

  private enterDepth(): void {
    this.depth += 1;
    if (this.depth > MAX_RECURSION_DEPTH) {
      throw new Error(`Profundidade máxima de recursão excedida (${MAX_RECURSION_DEPTH})`);
    }
  }

  private leaveDepth(): void {
    this.depth -= 1;
  }

  private parseExpression(): number {
    let left = this.parseTerm();
    while (true) {
      const tok = this.peek();
      if (tok?.type === 'op' && (tok.value === '+' || tok.value === '-')) {
        this.consume();
        const right = this.parseTerm();
        left = tok.value === '+' ? left + right : left - right;
      } else {
        break;
      }
    }
    return left;
  }

  private parseTerm(): number {
    let left = this.parseUnary();
    while (true) {
      const tok = this.peek();
      if (tok?.type === 'op' && (tok.value === '*' || tok.value === '/')) {
        this.consume();
        const right = this.parseUnary();
        if (tok.value === '/') {
          if (right === 0) throw new Error('Divisão por zero');
          left = left / right;
        } else {
          left = left * right;
        }
      } else {
        break;
      }
    }
    return left;
  }

  private parseUnary(): number {
    const tok = this.peek();
    if (tok?.type === 'op' && (tok.value === '+' || tok.value === '-')) {
      this.consume();
      const val = this.parseUnary();
      return tok.value === '-' ? -val : val;
    }
    return this.parsePrimary();
  }

  private parsePrimary(): number {
    const tok = this.peek();
    if (!tok) throw new Error('Fim inesperado da fórmula');

    if (tok.type === 'num') {
      this.consume();
      return tok.value;
    }

    if (tok.type === 'lparen') {
      this.consume();
      this.enterDepth();
      try {
        const val = this.parseExpression();
        const close = this.peek();
        if (close?.type !== 'rparen') throw new Error('Parêntese ")" ausente');
        this.consume();
        return val;
      } finally {
        this.leaveDepth();
      }
    }

    if (tok.type === 'id') {
      this.consume();
      const next = this.peek();
      if (next?.type === 'lparen') {
        const fn = ALLOWED_FUNCTIONS[tok.value];
        if (!fn) throw new Error(`Função desconhecida: "${tok.value}"`);
        this.consume(); // '('
        this.enterDepth();
        try {
          const args: number[] = [];
          if (this.peek()?.type !== 'rparen') {
            args.push(this.parseExpression());
            while (this.peek()?.type === 'comma') {
              this.consume();
              args.push(this.parseExpression());
            }
          }
          if (this.peek()?.type !== 'rparen') throw new Error(`Parêntese ")" ausente em ${tok.value}()`);
          this.consume();
          return fn(...args);
        } finally {
          this.leaveDepth();
        }
      }

      const memo = this.options?.resolvedMemo;
      if (memo && Object.prototype.hasOwnProperty.call(memo, tok.value)) {
        return memo[tok.value];
      }
      if (this.options?.visited?.has(tok.value)) {
        const chain = [...this.options.visited, tok.value].join(' -> ');
        throw new Error(`Referência circular detectada: ${chain}`);
      }
      const formulaMap = this.options?.formulaMap;
      if (formulaMap && Object.prototype.hasOwnProperty.call(formulaMap, tok.value)) {
        const nextDepth = this.depth + 1;
        if (nextDepth > MAX_RECURSION_DEPTH) {
          throw new Error(`Profundidade máxima de recursão excedida (${MAX_RECURSION_DEPTH})`);
        }
        const nextVisited = new Set(this.options?.visited ?? []);
        nextVisited.add(tok.value);
        const subResult = evaluateFormula(formulaMap[tok.value], this.vars, false, {
          formulaMap,
          visited: nextVisited,
          depth: nextDepth,
          resolvedMemo: memo,
        });
        if (!subResult.ok) {
          throw new Error(subResult.error ?? `Erro ao resolver "${tok.value}"`);
        }
        if (memo) {
          memo[tok.value] = subResult.value;
        }
        return subResult.value;
      }

      if (Object.prototype.hasOwnProperty.call(this.vars, tok.value)) {
        return this.vars[tok.value];
      }
      throw new Error(`Variável indefinida: "${tok.value}"`);
    }

    throw new Error('Token inesperado na fórmula');
  }
}

export function formatSigned(value: number, showPlus = true): string {
  if (!Number.isFinite(value)) return 'ERR';
  const rounded = Number.isInteger(value) ? value : Number(value.toFixed(1));
  if (showPlus && rounded >= 0) return `+${rounded}`;
  return `${rounded}`;
}

export function evaluateFormula(
  expression: string,
  vars: VariableMap,
  showPlus = true,
  options?: EvaluateFormulaOptions,
): FormulaResult {
  try {
    const trimmed = expression.trim();
    if (trimmed.length > MAX_FORMULA_LENGTH) {
      return {
        ok: false,
        value: 0,
        formatted: 'ERR',
        error: `Fórmula excede o tamanho máximo (${MAX_FORMULA_LENGTH} caracteres)`,
      };
    }
    if ((options?.depth ?? 0) > MAX_RECURSION_DEPTH) {
      return {
        ok: false,
        value: 0,
        formatted: 'ERR',
        error: `Profundidade máxima de recursão excedida (${MAX_RECURSION_DEPTH})`,
      };
    }
    const tokens = tokenize(trimmed);
    const parser = new Parser(tokens, vars, options);
    const val = parser.parse();
    if (!Number.isFinite(val)) {
      return { ok: false, value: 0, formatted: 'ERR', error: 'Resultado numérico inválido' };
    }
    return {
      ok: true,
      value: val,
      formatted: formatSigned(val, showPlus),
    };
  } catch (err) {
    return {
      ok: false,
      value: 0,
      formatted: 'ERR',
      error: err instanceof Error ? err.message : 'Erro de sintaxe',
    };
  }
}

export function parseWodPoolExpression(
  expression: string,
): { countExpr: string; diffExpr: string; hasExplicitDiff: boolean } | null {
  const cleaned = expression.trim();
  if (!cleaned) return null;

  const poolFnMatch = cleaned.match(/^pool\((.+)\)$/i);
  if (poolFnMatch) {
    const inner = poolFnMatch[1];
    let depth = 0;
    let splitIdx = -1;
    for (let i = 0; i < inner.length; i += 1) {
      if (inner[i] === '(') depth += 1;
      else if (inner[i] === ')') depth -= 1;
      else if (inner[i] === ',' && depth === 0) {
        splitIdx = i;
        break;
      }
    }
    return {
      countExpr: (splitIdx === -1 ? inner : inner.slice(0, splitIdx)).trim(),
      diffExpr: (splitIdx === -1 ? '6' : inner.slice(splitIdx + 1)).trim(),
      hasExplicitDiff: splitIdx !== -1,
    };
  }

  const shortPoolMatch = cleaned.match(/^(.+?)d10\s*(?:@|>=)\s*(\d+)$/i);
  if (shortPoolMatch) {
    return {
      countExpr: shortPoolMatch[1].trim(),
      diffExpr: shortPoolMatch[2].trim(),
      hasExplicitDiff: true,
    };
  }

  return null;
}

export function isWodPoolExpression(expression: string): boolean {
  return parseWodPoolExpression(expression) !== null;
}

function executeWodPool(
  countExpr: string,
  diffExpr: string,
  vars: VariableMap,
  rng: () => number,
  options: WodPoolOptions = {},
  hasExplicitDiff = true,
): DiceRollResult {
  const rulePreset: RulePreset = options.rulePreset ?? 'storyteller-v20';
  const isSoak = Boolean(options.isSoak);
  const soakDamageType: SoakDamageType = options.soakDamageType ?? 'lethal';

  // In V20 Aggravated Soak, Stamina is excluded: only Fortitude/Armor dice are rolled
  const effectiveVars =
    isSoak && rulePreset !== 'vampire-v5' && soakDamageType === 'aggravated'
      ? { ...vars, stamina: 0, vigor: 0 }
      : vars;

  const countRes = evaluateFormula(countExpr, effectiveVars, false);
  if (!countRes.ok) {
    return {
      ok: false,
      total: 0,
      resolvedExpression: countExpr,
      breakdown: countRes.error ?? 'Erro na parada de dados',
      rolls: [],
      isPoolRoll: true,
      error: countRes.error,
    };
  }

  const diffRes = evaluateFormula(diffExpr, effectiveVars, false);
  if (!diffRes.ok && options.difficulty === undefined && rulePreset !== 'vampire-v5') {
    return {
      ok: false,
      total: 0,
      resolvedExpression: diffExpr,
      breakdown: diffRes.error ?? 'Dificuldade inválida',
      rolls: [],
      isPoolRoll: true,
      error: diffRes.error,
    };
  }

  const mod =
    typeof options.modifier === 'number' && Number.isFinite(options.modifier)
      ? Math.round(options.modifier)
      : 0;
  const isWoundExempt = isSoak || Boolean(options.isWoundExempt);
  const rawWound =
    typeof options.woundPenalty === 'number' && Number.isFinite(options.woundPenalty)
      ? Math.min(0, Math.round(options.woundPenalty))
      : 0;
  const appliedWoundPenalty = isWoundExempt ? 0 : rawWound;

  const isBloodSurge = Boolean(options.bloodSurge) && !isSoak && rulePreset === 'vampire-v5';
  const bloodSurgeBonus = isBloodSurge
    ? typeof options.bloodSurgeDice === 'number' && Number.isFinite(options.bloodSurgeDice)
      ? Math.max(0, Math.round(options.bloodSurgeDice))
      : getV5BloodSurgeBonus(vars.blood_potency)
    : 0;

  if (Math.round(countRes.value) > MAX_DICE_COUNT) {
    return {
      ok: false,
      total: 0,
      resolvedExpression: countExpr,
      breakdown: `Quantidade de dados excede o limite (${MAX_DICE_COUNT})`,
      rolls: [],
      isPoolRoll: true,
      error: `Quantidade de dados excede o limite (${MAX_DICE_COUNT})`,
    };
  }

  const poolSize = Math.max(
    0,
    Math.min(30, Math.round(countRes.value) + mod + bloodSurgeBonus + appliedWoundPenalty),
  );

  // V5 counts every d10 >= 6 as a success, disables 1s cancellation, and treats difficulty as Target Successes (1-10, default 2)
  if (rulePreset === 'vampire-v5') {
    const rawV5Diff =
      typeof options.difficulty === 'number' && Number.isFinite(options.difficulty)
        ? options.difficulty
        : hasExplicitDiff && diffRes.ok
          ? diffRes.value
          : 2;
    const difficulty = Math.max(1, Math.min(10, Math.round(rawV5Diff)));
    const rawHunger =
      typeof options.hungerDice === 'number' && Number.isFinite(options.hungerDice)
        ? options.hungerDice
        : typeof vars.hunger === 'number' && Number.isFinite(vars.hunger)
          ? vars.hunger
          : 0;
    const hungerDice = Math.max(0, Math.min(poolSize, Math.round(rawHunger)));
    const normalDice = poolSize - hungerDice;

    const normalRolls: number[] = [];
    for (let i = 0; i < normalDice; i += 1) {
      normalRolls.push(Math.floor(rng() * 10) + 1);
    }
    const hungerRolls: number[] = [];
    for (let i = 0; i < hungerDice; i += 1) {
      hungerRolls.push(Math.floor(rng() * 10) + 1);
    }
    const rolls = [...normalRolls, ...hungerRolls];
    const v5Eval = evaluateV5Rolls(rolls, hungerDice, difficulty);

    const statusText = v5Eval.messyCritical
      ? `${v5Eval.total} / ${difficulty} SUCESSOS · MARGEM +${v5Eval.margin} · MESSY CRITICAL!`
      : v5Eval.bestialFailure
        ? `${v5Eval.total} / ${difficulty} SUCESSOS · BESTIAL FAILURE!`
        : v5Eval.isCritical
          ? `${v5Eval.total} / ${difficulty} SUCESSOS · MARGEM +${v5Eval.margin} · CRIT`
          : v5Eval.outcome === 'success'
            ? `${v5Eval.total} / ${difficulty} SUCESSOS · MARGEM +${v5Eval.margin}`
            : `${v5Eval.total} / ${difficulty} SUCESSOS · FALHA`;

    const extraTags = [
      'V5',
      hungerDice > 0 ? `HUNGER ${hungerDice}` : null,
      isBloodSurge ? `+${bloodSurgeBonus} SURGE` : null,
      appliedWoundPenalty < 0 ? `FERIMENTO ${appliedWoundPenalty}` : null,
    ].filter(Boolean);

    const resolvedExpression = `${poolSize}d10 (DIFF (META) ${difficulty} · ${extraTags.join(' · ')})`;
    const detailParts: string[] = [];
    if (v5Eval.critPairsCount > 0) {
      detailParts.push(`CRIT ×${v5Eval.critPairsCount} (+${v5Eval.critPairsCount * 2})`);
    }
    if (hungerDice > 0) detailParts.push(`H:[${hungerRolls.join(',')}]`);
    if (appliedWoundPenalty < 0) detailParts.push(`FERIMENTO ${appliedWoundPenalty}`);
    const detailSuffix = detailParts.length > 0 ? ` (${detailParts.join(' · ')})` : '';

    return {
      ok: true,
      total: v5Eval.total,
      resolvedExpression,
      breakdown: `${poolSize}d10[${rolls.join(', ')}] ≥6${detailSuffix} → ${statusText}`,
      rolls,
      isCritical: v5Eval.isCritical,
      isFumble: v5Eval.isFumble,
      isPoolRoll: true,
      difficulty,
      margin: v5Eval.margin,
      status: v5Eval.status,
      specialty: false,
      willpowerUsed: false,
      isSoak: false,
      rawDiceSuccesses: v5Eval.rawDiceSuccesses,
      onesCount: v5Eval.onesCount,
      canceledOnes: 0,
      doubledTensCount: 0,
      outcome: v5Eval.outcome,
      rulePreset: 'vampire-v5',
      woundPenalty: appliedWoundPenalty < 0 ? appliedWoundPenalty : undefined,
      normalDice: v5Eval.normalRolls,
      hungerDice,
      hungerRolls,
      messyCritical: v5Eval.messyCritical,
      bestialFailure: v5Eval.bestialFailure,
      critPairsCount: v5Eval.critPairsCount,
      isBloodSurge,
    };
  }

  // V20 / Custom Storyteller resolution
  const rawDiff =
    typeof options.difficulty === 'number' && Number.isFinite(options.difficulty)
      ? options.difficulty
      : diffRes.value;
  const difficulty = Math.max(2, Math.min(10, Math.round(rawDiff)));
  const specialty = Boolean(options.specialty);
  // Aggravated soak blocks Willpower auto success in V20
  const willpowerBlocked = isSoak && soakDamageType === 'aggravated';
  const willpowerUsed = willpowerBlocked ? false : Boolean(options.willpowerAutoSuccess);

  const rolls: number[] = [];
  let rawDiceSuccesses = 0;
  let onesCount = 0;
  let doubledTensCount = 0;
  let anyDieMetTarget = false;

  for (let i = 0; i < poolSize; i += 1) {
    const roll = Math.floor(rng() * 10) + 1;
    rolls.push(roll);
    if (roll >= difficulty) {
      anyDieMetTarget = true;
      if (roll === 10 && specialty) {
        rawDiceSuccesses += 2;
        doubledTensCount += 1;
      } else {
        rawDiceSuccesses += 1;
      }
    }
    if (roll === 1) onesCount += 1;
  }

  // 1s cancel only successes generated by the dice (clamped at 0 before Willpower)
  const diceSuccessesAfterOnes = Math.max(0, rawDiceSuccesses - onesCount);
  const canceledOnes = Math.min(rawDiceSuccesses, onesCount);
  const finalTotal = diceSuccessesAfterOnes + (willpowerUsed ? 1 : 0);

  // Botch only when finalTotal == 0, no die met Target Number, at least one 1 rolled, Willpower NOT used, and NOT a Soak roll
  const isBotch =
    !isSoak &&
    poolSize > 0 &&
    finalTotal === 0 &&
    !anyDieMetTarget &&
    onesCount > 0 &&
    !willpowerUsed;
  const outcome: WodOutcome = isBotch ? 'botch' : finalTotal > 0 ? 'success' : 'failure';
  const isExceptional = outcome === 'success' && finalTotal >= 5;

  const statusText = isBotch
    ? 'BOTCH!'
    : outcome === 'failure'
      ? isSoak
        ? '0 SOAKED · FAILURE'
        : '0 SUCESSOS · FAILURE'
      : isSoak
        ? `${finalTotal} SOAKED`
        : `${finalTotal} ${finalTotal === 1 ? 'SUCESSO' : 'SUCESSOS'}`;

  const extraTags = [
    specialty ? 'SPEC' : null,
    willpowerUsed ? '+1 WP' : null,
    isSoak ? `SOAK ${soakDamageType.toUpperCase()}` : null,
    appliedWoundPenalty < 0 ? `FERIMENTO ${appliedWoundPenalty}` : null,
  ].filter(Boolean);

  const resolvedExpression =
    extraTags.length > 0
      ? `${poolSize}d10 (DIFF ${difficulty} · ${extraTags.join(' · ')})`
      : `${poolSize}d10 (DIFF ${difficulty})`;

  const detailParts: string[] = [];
  if (doubledTensCount > 0) detailParts.push(`10s×2 (+${doubledTensCount})`);
  if (canceledOnes > 0) detailParts.push(`-${canceledOnes} CANC BY 1s`);
  if (willpowerUsed) detailParts.push('+1 WP AUTO');
  if (appliedWoundPenalty < 0) detailParts.push(`FERIMENTO ${appliedWoundPenalty}`);
  const detailSuffix = detailParts.length > 0 ? ` (${detailParts.join(' · ')})` : '';

  return {
    ok: true,
    total: finalTotal,
    resolvedExpression,
    breakdown: `${poolSize}d10[${rolls.join(', ')}] ≥${difficulty}${detailSuffix} → ${statusText}`,
    rolls,
    isCritical: isExceptional,
    isFumble: isBotch,
    isPoolRoll: true,
    difficulty,
    specialty,
    willpowerUsed,
    isSoak,
    soakDamageType: isSoak ? soakDamageType : undefined,
    rawDiceSuccesses,
    onesCount,
    canceledOnes,
    doubledTensCount,
    outcome,
    rulePreset,
    woundPenalty: appliedWoundPenalty < 0 ? appliedWoundPenalty : undefined,
    normalDice: rolls,
  };
}

export function rollDiceExpression(
  expression: string,
  vars: VariableMap,
  rng: () => number = Math.random,
  options: WodPoolOptions = {},
): DiceRollResult {
  const cleaned = expression.trim();
  if (!cleaned) {
    return {
      ok: false,
      total: 0,
      resolvedExpression: '',
      breakdown: 'Expressão vazia',
      rolls: [],
      error: 'Expressão de rolagem vazia',
    };
  }

  const parsedPool = parseWodPoolExpression(cleaned);
  if (parsedPool) {
    return executeWodPool(
      parsedPool.countExpr,
      parsedPool.diffExpr,
      vars,
      rng,
      options,
      parsedPool.hasExplicitDiff,
    );
  }

  // Replace known variable identifiers (non-dice identifiers) with their numeric values
  const substituted = cleaned.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g, (match) => {
    const lower = match.toLowerCase();
    if (/^d\d+$/i.test(lower)) {
      return `1${lower}`;
    }
    if (Object.prototype.hasOwnProperty.call(vars, lower)) {
      const val = vars[lower];
      return val < 0 ? `(${val})` : `${val}`;
    }
    return match;
  });

  const allRolls: number[] = [];
  const diceDisplayParts: string[] = [];
  let hasSingleD20 = false;
  let singleD20Roll = 0;

  let diceCount = 0;
  let totalDiceRolled = 0;
  let mathExpr = '';
  try {
    mathExpr = substituted.replace(/(\d*)d(\d+)/gi, (_full, countStr: string, sidesStr: string) => {
      const count = countStr ? Number(countStr) : 1;
      const sides = Number(sidesStr);
      if (!Number.isInteger(count) || count < 1 || count > MAX_DICE_COUNT) {
        throw new Error(`Quantidade de dados inválida: ${count} (máx ${MAX_DICE_COUNT})`);
      }
      totalDiceRolled += count;
      if (totalDiceRolled > MAX_DICE_COUNT) {
        throw new Error(`Quantidade total de dados excede o limite (${MAX_DICE_COUNT})`);
      }
      if (!Number.isInteger(sides) || sides < 2 || sides > MAX_DICE_SIDES) {
        throw new Error(`Lados do dado inválidos: d${sides}`);
      }
      diceCount += 1;
      const rolls: number[] = [];
      for (let i = 0; i < count; i += 1) {
        const roll = Math.floor(rng() * sides) + 1;
        rolls.push(roll);
        allRolls.push(roll);
      }
      if (count === 1 && sides === 20 && diceCount === 1) {
        hasSingleD20 = true;
        singleD20Roll = rolls[0];
      } else {
        hasSingleD20 = false;
      }
      const sum = rolls.reduce((acc, n) => acc + n, 0);
      diceDisplayParts.push(`${count}d${sides}[${rolls.join(',')}]`);
      return `${sum}`;
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro na rolagem';
    return {
      ok: false,
      total: 0,
      resolvedExpression: substituted,
      breakdown: message,
      rolls: allRolls,
      error: message,
    };
  }

  const evalResult = evaluateFormula(mathExpr, vars, false);
  if (!evalResult.ok) {
    return {
      ok: false,
      total: 0,
      resolvedExpression: substituted,
      breakdown: evalResult.error ?? 'Erro na rolagem',
      rolls: allRolls,
      error: evalResult.error,
    };
  }

  const prettyResolved = mathExpr
    .replace(/\+\s*\(-(\d+)\)/g, '- $1')
    .replace(/\+\s*-(\d+)/g, '- $1')
    .replace(/\s+/g, ' ')
    .trim();

  const prettyFormula = substituted
    .replace(/\+\s*\(-(\d+)\)/g, '- $1')
    .replace(/\+\s*-(\d+)/g, '- $1')
    .replace(/\s+/g, ' ')
    .trim();

  const breakdown =
    diceDisplayParts.length > 0
      ? `${diceDisplayParts.join(' + ')} → ${prettyResolved}`
      : prettyResolved;

  return {
    ok: true,
    total: Math.round(evalResult.value),
    resolvedExpression: prettyFormula,
    breakdown,
    rolls: allRolls,
    isCritical: hasSingleD20 && singleD20Roll === 20,
    isFumble: hasSingleD20 && singleD20Roll === 1,
  };
}
