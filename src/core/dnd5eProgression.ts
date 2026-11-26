import type { Dnd5eHitDieType, Dnd5eState } from './dnd5eRules.ts';

export type Dnd5eProgressionMode = 'xp' | 'milestone';
export type Dnd5eProgressionEntryKind = 'xp_gain' | 'session' | 'level_up';
export type Dnd5eHpMethod = 'average' | 'roll' | 'manual';

export interface Dnd5eProgressionEntry {
  id: string; timestamp: string; kind: Dnd5eProgressionEntryKind;
  deltaXp?: number; deltaSessions?: number; fromLevel?: number; toLevel?: number;
  hpGain?: number; hpMethod?: Dnd5eHpMethod; note?: string;
}
export interface Dnd5eProgressionState {
  mode: Dnd5eProgressionMode; xpTotal: number; sessionsCount: number;
  sessionsPerLevel?: number; history: Dnd5eProgressionEntry[];
}
export interface Dnd5eXpProgress {
  currentLevel: number; nextLevel: number | null; currentThreshold: number;
  nextThreshold: number | null; xpToNext: number; progressPercent: number; canLevelUp: boolean;
}
export interface Dnd5eProgressionSnapshot { dnd5eState: Dnd5eState; maxHp: number; currentHp: number; }
declare module './dnd5eRules.ts' { interface Dnd5eState { progression?: Dnd5eProgressionState; } }

export const DND5E_MAX_LEVEL = 20;
export const DND5E_MAX_PROGRESSION_HISTORY = 100;
export const DND5E_DEFAULT_SESSIONS_PER_LEVEL = 3;
export const DND5E_XP_THRESHOLDS: readonly number[] = Object.freeze([
  0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
  85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000,
]);

const HIT_DIE_AVERAGE: Record<Dnd5eHitDieType, number> = { d6: 4, d8: 5, d10: 6, d12: 7 };
const HIT_DIE_SIDES: Record<Dnd5eHitDieType, number> = { d6: 6, d8: 8, d10: 10, d12: 12 };
const ASI_LEVELS = new Set([4, 8, 12, 16, 19]);

const clampInt = (n: number, min: number, max: number): number =>
  Number.isFinite(n) ? Math.min(max, Math.max(min, Math.trunc(n))) : min;
const nonNegInt = (n: unknown, fallback = 0): number =>
  typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : fallback;
const optInt = (n: unknown): number | undefined =>
  typeof n === 'number' && Number.isFinite(n) ? Math.trunc(n) : undefined;
const makeId = (prefix: string): string =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`.slice(0, 64);
const trimNote = (note?: string): string | undefined => {
  const s = typeof note === 'string' ? note.trim().slice(0, 240) : '';
  return s || undefined;
};
const appendHistory = (history: Dnd5eProgressionEntry[], entry: Dnd5eProgressionEntry): Dnd5eProgressionEntry[] =>
  [...history, entry].slice(-DND5E_MAX_PROGRESSION_HISTORY);
const makeEntry = (
  prefix: string, kind: Dnd5eProgressionEntryKind,
  opts: { id?: string; timestamp?: string; note?: string }, extra: Partial<Dnd5eProgressionEntry>,
): Dnd5eProgressionEntry => {
  const note = trimNote(opts.note);
  return {
    id: opts.id?.trim().slice(0, 64) || makeId(prefix),
    timestamp: opts.timestamp?.trim().slice(0, 40) || new Date().toISOString(),
    kind, ...extra, ...(note ? { note } : {}),
  };
};

function sanitizeEntry(raw: unknown): Dnd5eProgressionEntry | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const r = raw as Partial<Dnd5eProgressionEntry>;
  const id = typeof r.id === 'string' ? r.id.trim().slice(0, 64) : '';
  const timestamp = typeof r.timestamp === 'string' ? r.timestamp.trim().slice(0, 40) : '';
  const kind = r.kind === 'xp_gain' || r.kind === 'session' || r.kind === 'level_up' ? r.kind : null;
  if (!id || !timestamp || !kind) return null;
  const note = trimNote(r.note);
  const hpMethod = r.hpMethod === 'average' || r.hpMethod === 'roll' || r.hpMethod === 'manual' ? r.hpMethod : undefined;
  const deltaXp = optInt(r.deltaXp), deltaSessions = optInt(r.deltaSessions);
  const fromLevel = optInt(r.fromLevel), toLevel = optInt(r.toLevel), hpGain = optInt(r.hpGain);
  return {
    id, timestamp, kind,
    ...(deltaXp !== undefined ? { deltaXp } : {}), ...(deltaSessions !== undefined ? { deltaSessions } : {}),
    ...(fromLevel !== undefined ? { fromLevel: clampInt(fromLevel, 1, DND5E_MAX_LEVEL) } : {}),
    ...(toLevel !== undefined ? { toLevel: clampInt(toLevel, 1, DND5E_MAX_LEVEL) } : {}),
    ...(hpGain !== undefined ? { hpGain: clampInt(hpGain, 1, 1000) } : {}),
    ...(hpMethod ? { hpMethod } : {}), ...(note ? { note } : {}),
  };
}

/** Creates a normalized D&D 5e progression state with safe defaults. */
export function createDefaultDnd5eProgression(overrides: Partial<Dnd5eProgressionState> = {}): Dnd5eProgressionState {
  const mode: Dnd5eProgressionMode = overrides.mode === 'milestone' ? 'milestone' : 'xp';
  const sessionsPerLevel = clampInt(overrides.sessionsPerLevel ?? DND5E_DEFAULT_SESSIONS_PER_LEVEL, 1, DND5E_MAX_LEVEL);
  const history = Array.isArray(overrides.history)
    ? overrides.history.map(sanitizeEntry).filter((e): e is Dnd5eProgressionEntry => e !== null).slice(-DND5E_MAX_PROGRESSION_HISTORY)
    : [];
  return { mode, xpTotal: nonNegInt(overrides.xpTotal, 0), sessionsCount: nonNegInt(overrides.sessionsCount, 0), sessionsPerLevel, history };
}

/** Normalizes arbitrary untrusted input into a valid `Dnd5eProgressionState`. */
export function normalizeDnd5eProgression(raw: unknown, fallback?: Partial<Dnd5eProgressionState>): Dnd5eProgressionState {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return createDefaultDnd5eProgression(fallback);
  return createDefaultDnd5eProgression({ ...fallback, ...(raw as Partial<Dnd5eProgressionState>) });
}

/** Computes SRD 5.1 XP threshold progress for the current character level and cumulative XP. */
export function getDnd5eXpProgress(level: number, xpTotal: number): Dnd5eXpProgress {
  const currentLevel = clampInt(level, 1, DND5E_MAX_LEVEL);
  const xp = nonNegInt(xpTotal, 0);
  const currentThreshold = DND5E_XP_THRESHOLDS[currentLevel - 1];
  if (currentLevel >= DND5E_MAX_LEVEL) {
    return { currentLevel: DND5E_MAX_LEVEL, nextLevel: null, currentThreshold, nextThreshold: null, xpToNext: 0, progressPercent: 100, canLevelUp: false };
  }
  const nextLevel = currentLevel + 1;
  const nextThreshold = DND5E_XP_THRESHOLDS[currentLevel];
  const xpToNext = Math.max(0, nextThreshold - xp);
  const canLevelUp = xp >= nextThreshold;
  const progressPercent = canLevelUp ? 100 : Math.min(99, Math.max(0, Math.floor(((xp - currentThreshold) / Math.max(1, nextThreshold - currentThreshold)) * 100)));
  return { currentLevel, nextLevel, currentThreshold, nextThreshold, xpToNext, progressPercent, canLevelUp };
}

export const getDnd5eHitDieAverage = (die: Dnd5eHitDieType): number => HIT_DIE_AVERAGE[die];
export const isStandardAsiLevel = (level: number): boolean => Number.isInteger(level) && ASI_LEVELS.has(level);

/** Computes HP gained on level up, enforcing the official PHB errata minimum of +1 HP. */
export function computeLevelUpHpGain(params: {
  die: Dnd5eHitDieType; conMod: number; method: Dnd5eHpMethod; rolledDie?: number; manualGain?: number;
}): number {
  const con = Number.isFinite(params.conMod) ? Math.trunc(params.conMod) : 0;
  if (params.method === 'manual') return Math.max(1, optInt(params.manualGain) ?? 1);
  if (params.method === 'roll') {
    const rawRoll = typeof params.rolledDie === 'number' && Number.isFinite(params.rolledDie) ? params.rolledDie : HIT_DIE_AVERAGE[params.die];
    return Math.max(1, clampInt(rawRoll, 1, HIT_DIE_SIDES[params.die]) + con);
  }
  return Math.max(1, HIT_DIE_AVERAGE[params.die] + con);
}

/** Switches progression mode ('xp' | 'milestone') and optional sessions-per-level target. */
export function setDnd5eProgressionMode(dnd5eState: Dnd5eState, mode: Dnd5eProgressionMode, sessionsPerLevel?: number): Dnd5eState {
  const cur = normalizeDnd5eProgression(dnd5eState.progression);
  const nextTarget = sessionsPerLevel !== undefined ? clampInt(sessionsPerLevel, 1, DND5E_MAX_LEVEL) : cur.sessionsPerLevel;
  return { ...dnd5eState, progression: { ...cur, mode, sessionsPerLevel: nextTarget } };
}

/** Adds positive XP to cumulative `xpTotal` and appends an auditable history entry. */
export function addDnd5eXp(
  dnd5eState: Dnd5eState, amount: number, options: { note?: string; id?: string; timestamp?: string } = {},
): Dnd5eState {
  const cur = normalizeDnd5eProgression(dnd5eState.progression);
  const delta = optInt(amount) ?? 0;
  if (delta <= 0) return { ...dnd5eState, progression: cur };
  const entry = makeEntry('xp', 'xp_gain', options, { deltaXp: delta });
  return { ...dnd5eState, progression: { ...cur, xpTotal: cur.xpTotal + delta, history: appendHistory(cur.history, entry) } };
}

/** Logs one or more completed sessions for milestone/session tracking. */
export function logDnd5eSession(
  dnd5eState: Dnd5eState, options: { deltaSessions?: number; note?: string; id?: string; timestamp?: string } = {},
): Dnd5eState {
  const cur = normalizeDnd5eProgression(dnd5eState.progression);
  const delta = options.deltaSessions !== undefined ? (optInt(options.deltaSessions) ?? 0) : 1;
  if (delta <= 0) return { ...dnd5eState, progression: cur };
  const entry = makeEntry('ses', 'session', options, { deltaSessions: delta });
  return { ...dnd5eState, progression: { ...cur, sessionsCount: cur.sessionsCount + delta, history: appendHistory(cur.history, entry) } };
}

/** Advances character level by 1 (up to 20), increases max/current HP and hitDice.max, keeping xpTotal intact. */
export function applyDnd5eLevelUp(
  state: Dnd5eProgressionSnapshot,
  options: { conMod: number; method?: Dnd5eHpMethod; rolledDie?: number; manualGain?: number; note?: string; id?: string; timestamp?: string },
): Dnd5eProgressionSnapshot & { applied: boolean; hpGain: number; fromLevel: number; toLevel: number; isAsiLevel: boolean } {
  const prog = normalizeDnd5eProgression(state.dnd5eState.progression);
  const fromLevel = clampInt(state.dnd5eState.level, 1, DND5E_MAX_LEVEL);
  const baseMaxHp = Math.max(1, Math.trunc(state.maxHp));
  const baseCurHp = Math.max(0, Math.trunc(state.currentHp));
  if (fromLevel >= DND5E_MAX_LEVEL) {
    return { applied: false, dnd5eState: { ...state.dnd5eState, progression: prog }, maxHp: baseMaxHp, currentHp: baseCurHp, hpGain: 0, fromLevel, toLevel: fromLevel, isAsiLevel: false };
  }
  const toLevel = fromLevel + 1, method = options.method ?? 'average';
  const hpGain = computeLevelUpHpGain({ die: state.dnd5eState.hitDice.die, conMod: options.conMod, method, rolledDie: options.rolledDie, manualGain: options.manualGain });
  const entry = makeEntry('lvl', 'level_up', options, { fromLevel, toLevel, hpGain, hpMethod: method });
  return {
    applied: true, hpGain, fromLevel, toLevel, isAsiLevel: isStandardAsiLevel(toLevel),
    maxHp: baseMaxHp + hpGain, currentHp: baseCurHp + hpGain,
    dnd5eState: { ...state.dnd5eState, level: toLevel, hitDice: { ...state.dnd5eState.hitDice, max: toLevel }, progression: { ...prog, history: appendHistory(prog.history, entry) } },
  };
}

/** Atomically reverts the most recent progression history entry and associated state changes. */
export function undoLastDnd5eProgression(
  state: Dnd5eProgressionSnapshot,
): Dnd5eProgressionSnapshot & { undone: boolean; entry: Dnd5eProgressionEntry | null } {
  const prog = normalizeDnd5eProgression(state.dnd5eState.progression);
  const baseMaxHp = Math.max(1, Math.trunc(state.maxHp)), baseCurHp = Math.max(0, Math.trunc(state.currentHp));
  if (prog.history.length === 0) {
    return { undone: false, entry: null, dnd5eState: { ...state.dnd5eState, progression: prog }, maxHp: baseMaxHp, currentHp: baseCurHp };
  }
  const entry = prog.history[prog.history.length - 1], nextHistory = prog.history.slice(0, -1);
  if (entry.kind === 'xp_gain') {
    return { undone: true, entry, maxHp: baseMaxHp, currentHp: baseCurHp, dnd5eState: { ...state.dnd5eState, progression: { ...prog, xpTotal: Math.max(0, prog.xpTotal - nonNegInt(entry.deltaXp, 0)), history: nextHistory } } };
  }
  if (entry.kind === 'session') {
    return { undone: true, entry, maxHp: baseMaxHp, currentHp: baseCurHp, dnd5eState: { ...state.dnd5eState, progression: { ...prog, sessionsCount: Math.max(0, prog.sessionsCount - nonNegInt(entry.deltaSessions, 1)), history: nextHistory } } };
  }
  const prevLevel = clampInt(entry.fromLevel ?? state.dnd5eState.level - 1, 1, DND5E_MAX_LEVEL);
  const hpDelta = nonNegInt(entry.hpGain, 0), nextMaxHp = Math.max(1, baseMaxHp - hpDelta), nextCurHp = Math.max(0, Math.min(nextMaxHp, baseCurHp - hpDelta));
  return {
    undone: true, entry, maxHp: nextMaxHp, currentHp: nextCurHp,
    dnd5eState: { ...state.dnd5eState, level: prevLevel, hitDice: { ...state.dnd5eState.hitDice, max: prevLevel, current: Math.min(prevLevel, Math.max(0, state.dnd5eState.hitDice.current)) }, progression: { ...prog, history: nextHistory } },
  };
}
