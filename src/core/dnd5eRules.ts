export type Dnd5eAbilityKey = 'str' | 'dex' | 'con' | 'int' | 'wis' | 'cha';
export type Dnd5eSpellcastingAbilityKey = 'int' | 'wis' | 'cha';
export type Dnd5eHitDieType = 'd6' | 'd8' | 'd10' | 'd12';
export type Dnd5eSkillProficiency = 'none' | 'proficient' | 'expertise';
export type Dnd5eRollMode = 'normal' | 'advantage' | 'disadvantage';
export type Dnd5eSkillKey =
  | 'acrobatics' | 'animal_handling' | 'arcana' | 'athletics' | 'deception' | 'history'
  | 'insight' | 'intimidation' | 'investigation' | 'medicine' | 'nature' | 'perception'
  | 'performance' | 'persuasion' | 'religion' | 'sleight_of_hand' | 'stealth' | 'survival';

export interface Dnd5eHitDiceState { die: Dnd5eHitDieType; current: number; max: number; }
export interface Dnd5eDeathSavesState { successes: number; failures: number; }
export type Dnd5eSaveProficiencies = Record<Dnd5eAbilityKey, boolean>;
export type Dnd5eSkillProficiencies = Record<Dnd5eSkillKey, Dnd5eSkillProficiency>;
export interface Dnd5eSpellSlotEntry { level: number; max: number; used: number; }
export interface Dnd5eSpellcastingState { ability: Dnd5eSpellcastingAbilityKey; slots: Dnd5eSpellSlotEntry[]; }
export interface Dnd5eState {
  level: number;
  inspiration: boolean;
  tempHp: number;
  hitDice: Dnd5eHitDiceState;
  deathSaves: Dnd5eDeathSavesState;
  saveProficiencies: Dnd5eSaveProficiencies;
  skillProficiencies: Dnd5eSkillProficiencies;
  spellcasting: Dnd5eSpellcastingState;
}
export interface D20RollResult {
  dice: number[];
  kept: number;
  discarded: number | null;
  total: number;
  isNat20: boolean;
  isNat1: boolean;
  mode: Dnd5eRollMode;
  bonus: number;
}

export const DND5E_ABILITIES: ReadonlyArray<{ key: Dnd5eAbilityKey; fieldKey: string; fieldId: string }> = [
  { key: 'str', fieldKey: 'strength', fieldId: 'f_strength' },
  { key: 'dex', fieldKey: 'dexterity', fieldId: 'f_dexterity' },
  { key: 'con', fieldKey: 'constitution', fieldId: 'f_constitution' },
  { key: 'int', fieldKey: 'intelligence', fieldId: 'f_intelligence' },
  { key: 'wis', fieldKey: 'wisdom', fieldId: 'f_wisdom' },
  { key: 'cha', fieldKey: 'charisma', fieldId: 'f_charisma' },
];

export const DND5E_SKILLS: ReadonlyArray<{ key: Dnd5eSkillKey; ability: Dnd5eAbilityKey }> = [
  { key: 'acrobatics', ability: 'dex' }, { key: 'animal_handling', ability: 'wis' },
  { key: 'arcana', ability: 'int' }, { key: 'athletics', ability: 'str' },
  { key: 'deception', ability: 'cha' }, { key: 'history', ability: 'int' },
  { key: 'insight', ability: 'wis' }, { key: 'intimidation', ability: 'cha' },
  { key: 'investigation', ability: 'int' }, { key: 'medicine', ability: 'wis' },
  { key: 'nature', ability: 'int' }, { key: 'perception', ability: 'wis' },
  { key: 'performance', ability: 'cha' }, { key: 'persuasion', ability: 'cha' },
  { key: 'religion', ability: 'int' }, { key: 'sleight_of_hand', ability: 'dex' },
  { key: 'stealth', ability: 'dex' }, { key: 'survival', ability: 'wis' },
];

const clampInt = (n: number, min: number, max: number): number =>
  Number.isFinite(n) ? Math.min(max, Math.max(min, Math.trunc(n))) : min;
const rollDie = (sides: number, rng: () => number): number =>
  Math.floor(Math.min(0.999999999, Math.max(0, rng())) * sides) + 1;

export function getAbilityModifier(score: number): number {
  return Number.isFinite(score) ? Math.floor((score - 10) / 2) : 0;
}
export function formatSignedMod(n: number): string {
  const rounded = Number.isFinite(n) ? Math.trunc(n) : 0;
  return rounded >= 0 ? `+${rounded}` : `${rounded}`;
}
export function getProficiencyBonus(level: number): number {
  return Math.floor((clampInt(Number.isFinite(level) ? level : 1, 1, 20) - 1) / 4) + 2;
}
export function getSaveBonus(abilityScore: number, level: number, proficient: boolean): number {
  return getAbilityModifier(abilityScore) + (proficient ? getProficiencyBonus(level) : 0);
}
export function getSkillBonus(abilityScore: number, level: number, proficiency: Dnd5eSkillProficiency): number {
  const pb = getProficiencyBonus(level);
  const mult = proficiency === 'expertise' ? 2 : proficiency === 'proficient' ? 1 : 0;
  return getAbilityModifier(abilityScore) + pb * mult;
}
export function getPassivePerception(wisdomScore: number, level: number, perceptionProf: Dnd5eSkillProficiency): number {
  return 10 + getSkillBonus(wisdomScore, level, perceptionProf);
}
export function cycleSkillProficiency(current: Dnd5eSkillProficiency): Dnd5eSkillProficiency {
  return current === 'none' ? 'proficient' : current === 'proficient' ? 'expertise' : 'none';
}
export function rollD20Check(options: { mode?: Dnd5eRollMode; bonus?: number; rng?: () => number } = {}): D20RollResult {
  const mode = options.mode ?? 'normal';
  const bonus = Number.isFinite(options.bonus) ? Math.trunc(options.bonus ?? 0) : 0;
  const rng = options.rng ?? Math.random;
  if (mode === 'normal') {
    const kept = rollDie(20, rng);
    return { dice: [kept], kept, discarded: null, total: kept + bonus, isNat20: kept === 20, isNat1: kept === 1, mode, bonus };
  }
  const d1 = rollDie(20, rng);
  const d2 = rollDie(20, rng);
  const kept = mode === 'advantage' ? Math.max(d1, d2) : Math.min(d1, d2);
  const discarded = kept === d1 ? d2 : d1;
  return { dice: [d1, d2], kept, discarded, total: kept + bonus, isNat20: kept === 20, isNat1: kept === 1, mode, bonus };
}
export function setTempHp(currentTempHp: number, incoming: number, options?: { forceOverride?: boolean }): number {
  const current = Math.max(0, Number.isFinite(currentTempHp) ? Math.floor(currentTempHp) : 0);
  const next = Math.max(0, Number.isFinite(incoming) ? Math.floor(incoming) : 0);
  return options?.forceOverride ? next : Math.max(current, next);
}
export function applyDndDamage(
  state: { currentHp: number; maxHp: number; tempHp: number },
  damage: number,
): { currentHp: number; tempHp: number; absorbedByTemp: number; appliedToHp: number } {
  const dmg = Math.max(0, Number.isFinite(damage) ? Math.floor(damage) : 0);
  const curTemp = Math.max(0, Math.floor(state.tempHp));
  const curHp = Math.max(0, Math.min(Math.max(1, Math.floor(state.maxHp)), Math.floor(state.currentHp)));
  const absorbedByTemp = Math.min(curTemp, dmg);
  const remaining = dmg - absorbedByTemp;
  const appliedToHp = Math.min(curHp, remaining);
  return { currentHp: curHp - appliedToHp, tempHp: curTemp - absorbedByTemp, absorbedByTemp, appliedToHp };
}
export function applyDndHeal(
  state: { currentHp: number; maxHp: number; tempHp: number; deathSaves: Dnd5eDeathSavesState },
  amount: number,
): { currentHp: number; tempHp: number; healed: number; deathSaves: Dnd5eDeathSavesState } {
  const maxHp = Math.max(1, Math.floor(state.maxHp));
  const curHp = Math.max(0, Math.min(maxHp, Math.floor(state.currentHp)));
  const heal = Math.max(0, Number.isFinite(amount) ? Math.floor(amount) : 0);
  const nextHp = Math.min(maxHp, curHp + heal);
  const deathSaves = curHp === 0 && nextHp > 0 ? { successes: 0, failures: 0 } : { ...state.deathSaves };
  return { currentHp: nextHp, tempHp: Math.max(0, Math.floor(state.tempHp)), healed: nextHp - curHp, deathSaves };
}
export function rollDeathSave(
  state: { currentHp: number; maxHp: number; deathSaves: Dnd5eDeathSavesState },
  rng: () => number = Math.random,
): { roll: number; currentHp: number; deathSaves: Dnd5eDeathSavesState; outcome: 'revived' | 'stabilized' | 'dead' | 'success' | 'failure' | 'critical_failure' } {
  const roll = rollDie(20, rng);
  const maxHp = Math.max(1, Math.floor(state.maxHp));
  if (roll === 20) {
    return { roll, currentHp: Math.min(maxHp, Math.max(1, state.currentHp + 1)), deathSaves: { successes: 0, failures: 0 }, outcome: 'revived' };
  }
  const s = clampInt(state.deathSaves.successes, 0, 3);
  const f = clampInt(state.deathSaves.failures, 0, 3);
  if (roll === 1) {
    const failures = Math.min(3, f + 2);
    return { roll, currentHp: state.currentHp, deathSaves: { successes: s, failures }, outcome: failures >= 3 ? 'dead' : 'critical_failure' };
  }
  if (roll >= 10) {
    const successes = Math.min(3, s + 1);
    return { roll, currentHp: state.currentHp, deathSaves: { successes, failures: f }, outcome: successes >= 3 ? 'stabilized' : 'success' };
  }
  const failures = Math.min(3, f + 1);
  return { roll, currentHp: state.currentHp, deathSaves: { successes: s, failures }, outcome: failures >= 3 ? 'dead' : 'failure' };
}
export function getSpellSaveDC(abilityScore: number, level: number): number {
  return 8 + getProficiencyBonus(level) + getAbilityModifier(abilityScore);
}
export function getSpellAttackBonus(abilityScore: number, level: number): number {
  return getProficiencyBonus(level) + getAbilityModifier(abilityScore);
}
export function getHitDieSides(die: Dnd5eHitDieType): number {
  return die === 'd6' ? 6 : die === 'd10' ? 10 : die === 'd12' ? 12 : 8;
}
export function spendHitDieShortRest(
  state: { currentHp: number; maxHp: number; tempHp: number; deathSaves: Dnd5eDeathSavesState; hitDice: Dnd5eHitDiceState; conScore: number },
  rng: () => number = Math.random,
): { spent: boolean; roll: number | null; conMod: number; healed: number; currentHp: number; hitDice: Dnd5eHitDiceState; deathSaves: Dnd5eDeathSavesState } {
  const conMod = getAbilityModifier(state.conScore);
  if (state.hitDice.current <= 0) {
    return { spent: false, roll: null, conMod, healed: 0, currentHp: state.currentHp, hitDice: { ...state.hitDice }, deathSaves: { ...state.deathSaves } };
  }
  const roll = rollDie(getHitDieSides(state.hitDice.die), rng);
  const healRes = applyDndHeal({ currentHp: state.currentHp, maxHp: state.maxHp, tempHp: state.tempHp, deathSaves: state.deathSaves }, Math.max(0, roll + conMod));
  return {
    spent: true, roll, conMod, healed: healRes.healed, currentHp: healRes.currentHp,
    hitDice: { ...state.hitDice, current: state.hitDice.current - 1 }, deathSaves: healRes.deathSaves,
  };
}
export function applyLongRest(state: { maxHp: number; dnd5eState: Dnd5eState }): { currentHp: number; dnd5eState: Dnd5eState } {
  const cur = state.dnd5eState;
  const hdMax = Math.max(1, cur.hitDice.max);
  const recoveredHd = Math.max(1, Math.floor(hdMax / 2));
  return {
    currentHp: Math.max(1, Math.floor(state.maxHp)),
    dnd5eState: {
      ...cur, tempHp: 0, deathSaves: { successes: 0, failures: 0 },
      hitDice: { ...cur.hitDice, current: Math.min(hdMax, Math.max(0, cur.hitDice.current) + recoveredHd) },
      spellcasting: { ...cur.spellcasting, slots: cur.spellcasting.slots.map((s) => ({ ...s, used: 0 })) },
    },
  };
}
export function createDefaultDnd5eSlots(): Dnd5eSpellSlotEntry[] {
  return Array.from({ length: 9 }, (_, i) => ({ level: i + 1, max: 0, used: 0 }));
}
export function createDefaultDnd5eState(overrides: Partial<Dnd5eState> = {}): Dnd5eState {
  const level = clampInt(overrides.level ?? 1, 1, 20);
  const saveProficiencies: Dnd5eSaveProficiencies = { str: false, dex: false, con: false, int: false, wis: false, cha: false, ...overrides.saveProficiencies };
  const skillProficiencies = Object.fromEntries(DND5E_SKILLS.map((s) => [s.key, overrides.skillProficiencies?.[s.key] ?? 'none'])) as Dnd5eSkillProficiencies;
  const rawHd = overrides.hitDice;
  const hdMax = clampInt(rawHd?.max ?? level, 1, 20);
  const hdCur = clampInt(rawHd?.current ?? hdMax, 0, hdMax);
  const slotsMap = new Map((overrides.spellcasting?.slots ?? []).map((s) => [s.level, s]));
  const slots = createDefaultDnd5eSlots().map((def) => {
    const s = slotsMap.get(def.level);
    const max = clampInt(s?.max ?? 0, 0, 20);
    return { level: def.level, max, used: clampInt(s?.used ?? 0, 0, max) };
  });
  return {
    level,
    inspiration: Boolean(overrides.inspiration ?? false),
    tempHp: Math.max(0, Math.trunc(overrides.tempHp ?? 0)),
    hitDice: { die: rawHd?.die ?? 'd8', current: hdCur, max: hdMax },
    deathSaves: { successes: clampInt(overrides.deathSaves?.successes ?? 0, 0, 3), failures: clampInt(overrides.deathSaves?.failures ?? 0, 0, 3) },
    saveProficiencies,
    skillProficiencies,
    spellcasting: { ability: overrides.spellcasting?.ability ?? 'int', slots },
    ...(overrides.progression && typeof overrides.progression === 'object' && !Array.isArray(overrides.progression)
      ? { progression: overrides.progression }
      : {}),
  };
}
export function normalizeDnd5eState(raw: unknown, fallback?: Partial<Dnd5eState>): Dnd5eState {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return createDefaultDnd5eState(fallback);
  const r = raw as Partial<Dnd5eState>;
  const die = r.hitDice?.die;
  const validDie: Dnd5eHitDieType = die === 'd6' || die === 'd8' || die === 'd10' || die === 'd12' ? die : (fallback?.hitDice?.die ?? 'd8');
  const ab = r.spellcasting?.ability;
  const validAb: Dnd5eSpellcastingAbilityKey = ab === 'int' || ab === 'wis' || ab === 'cha' ? ab : (fallback?.spellcasting?.ability ?? 'int');
  return createDefaultDnd5eState({
    ...fallback,
    ...r,
    hitDice: { die: validDie, max: r.hitDice?.max ?? fallback?.hitDice?.max ?? r.level ?? fallback?.level ?? 1, current: r.hitDice?.current ?? fallback?.hitDice?.current ?? 1 },
    deathSaves: { successes: r.deathSaves?.successes ?? fallback?.deathSaves?.successes ?? 0, failures: r.deathSaves?.failures ?? fallback?.deathSaves?.failures ?? 0 },
    saveProficiencies: { ...fallback?.saveProficiencies, ...r.saveProficiencies } as Dnd5eSaveProficiencies,
    skillProficiencies: { ...fallback?.skillProficiencies, ...r.skillProficiencies } as Dnd5eSkillProficiencies,
    spellcasting: { ability: validAb, slots: Array.isArray(r.spellcasting?.slots) ? r.spellcasting.slots : fallback?.spellcasting?.slots ?? [] },
    progression: r.progression ?? fallback?.progression,
  });
}
