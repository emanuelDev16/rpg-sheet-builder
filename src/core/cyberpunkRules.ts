export type CyberpunkArmorLocation = 'head' | 'body';
export type CyberpunkExplosionKind = 'crit' | 'fumble' | 'none';

export interface CyberpunkArmorPiece { sp: number; maxSp: number; }
export interface CyberpunkArmorState { head: CyberpunkArmorPiece; body: CyberpunkArmorPiece; }
export interface CyberpunkHumanityState { current: number; max: number; baseEmp: number; }
export interface CyberpunkCyberwareEntry { id: string; name: string; slot: string; humanityLoss: number; notes?: string; }
export interface CyberpunkWeaponEntry {
  id: string; name: string; skillKey: string; damageFormula: string; rof: number; ammoCurrent: number; ammoMax: number; notes?: string;
}
export interface CyberpunkCriticalInjuryEntry { id: string; name: string; effect: string; treated: boolean; }
export interface CyberpunkState {
  armor: CyberpunkArmorState; humanity: CyberpunkHumanityState;
  cyberware: CyberpunkCyberwareEntry[]; weapons: CyberpunkWeaponEntry[]; criticalInjuries: CyberpunkCriticalInjuryEntry[];
}
export interface ExplodingD10Options { stat?: number; skill?: number; modifier?: number; woundPenalty?: number; dv?: number; rng?: () => number; }
export interface ExplodingD10Result {
  baseDie: number; explosionDie: number | null; explosionKind: CyberpunkExplosionKind;
  woundPenalty: number; total: number; dv?: number; passed?: boolean;
}
export interface ArmorDamageResult {
  armor: CyberpunkArmorState; location: CyberpunkArmorLocation; incomingDamage: number;
  spBefore: number; nextSp: number; hpDamage: number; penetrated: boolean;
}
export interface CyberpunkWoundState {
  currentHp: number; maxHp: number; isSeriouslyWounded: boolean; isMortallyWounded: boolean; woundPenalty: 0 | 2 | 4;
}
export interface CyberpunkHumanitySummary {
  humanity: CyberpunkHumanityState; totalHumanityLoss: number; effectiveEmp: number; cyberpsychosisRisk: boolean;
}
export interface FireWeaponResult { weapon: CyberpunkWeaponEntry; fired: boolean; shotsFired: number; }

const safeInt = (n: unknown, fallback = 0): number => (typeof n === 'number' && Number.isFinite(n) ? Math.trunc(n) : fallback);
const clampInt = (n: unknown, min: number, max: number, fallback = min): number => Math.min(max, Math.max(min, safeInt(n, fallback)));
const safeStr = (val: unknown, fallback: string, maxLen: number): string =>
  typeof val === 'string' && val.trim().length > 0 ? val.trim().slice(0, maxLen) : fallback;
const isPlainObj = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === 'object' && !Array.isArray(v));
const normArmorPiece = (piece?: Partial<CyberpunkArmorPiece>, defSp = 11): CyberpunkArmorPiece => {
  const maxSp = clampInt(piece?.maxSp ?? defSp, 0, 30, defSp);
  return { sp: clampInt(piece?.sp ?? maxSp, 0, maxSp, maxSp), maxSp };
};
const rollD10 = (rng: () => number): number => {
  const raw = rng();
  const unit = typeof raw === 'number' && Number.isFinite(raw) ? Math.min(0.999999999, Math.max(0, raw)) : 0.5;
  return Math.floor(unit * 10) + 1;
};

/** Rolls 1d10 with critical (10 -> +1d10) and fumble (1 -> -1d10) explosions. */
export function rollExplodingD10Check(options: ExplodingD10Options = {}): ExplodingD10Result {
  const rng = options.rng ?? Math.random;
  const baseDie = rollD10(rng);
  const explosionKind: CyberpunkExplosionKind = baseDie === 10 ? 'crit' : baseDie === 1 ? 'fumble' : 'none';
  const explosionDie = explosionKind === 'none' ? null : rollD10(rng);
  const explosionDelta = explosionKind === 'crit' ? explosionDie! : explosionKind === 'fumble' ? -explosionDie! : 0;
  const woundPenalty = Math.max(0, safeInt(options.woundPenalty, 0));
  const total =
    baseDie + explosionDelta + safeInt(options.stat, 0) + safeInt(options.skill, 0) + safeInt(options.modifier, 0) - woundPenalty;
  const dv = typeof options.dv === 'number' && Number.isFinite(options.dv) ? Math.trunc(options.dv) : undefined;
  return { baseDie, explosionDie, explosionKind, woundPenalty, total, ...(dv !== undefined ? { dv, passed: total >= dv } : {}) };
}

/** Resolves damage against Stopping Power (SP), ablating 1 SP only on penetration. */
export function applyArmorDamage(
  armor: CyberpunkArmorState,
  location: CyberpunkArmorLocation,
  rawDamage: number,
  options?: { headshotMultiplier?: boolean },
): ArmorDamageResult {
  const incomingDamage = Math.max(0, safeInt(rawDamage, 0));
  const { sp: spBefore, maxSp } = normArmorPiece(armor[location], 0);
  const penetrated = incomingDamage > spBefore;
  const mult = penetrated && location === 'head' && options?.headshotMultiplier ? 2 : 1;
  const hpDamage = penetrated ? (incomingDamage - spBefore) * mult : 0;
  const nextSp = penetrated ? Math.max(0, spBefore - 1) : spBefore;
  const other = normArmorPiece(armor[location === 'head' ? 'body' : 'head'], 0);
  const nextArmor: CyberpunkArmorState = location === 'head' ? { head: { sp: nextSp, maxSp }, body: other } : { head: other, body: { sp: nextSp, maxSp } };
  return { armor: nextArmor, location, incomingDamage, spBefore, nextSp, hpDamage, penetrated };
}

/** Repairs SP on the target armor location up to its maxSp. */
export function repairArmorSp(armor: CyberpunkArmorState, location: CyberpunkArmorLocation, amount?: number): CyberpunkArmorState {
  const { sp: curSp, maxSp } = normArmorPiece(armor[location], 0);
  const nextSp = amount === undefined ? maxSp : clampInt(curSp + Math.max(0, safeInt(amount, 0)), 0, maxSp, curSp);
  return {
    head: location === 'head' ? { sp: nextSp, maxSp } : normArmorPiece(armor.head, 0),
    body: location === 'body' ? { sp: nextSp, maxSp } : normArmorPiece(armor.body, 0),
  };
}

/** Computes tactical wound thresholds (Serious <= ceil(maxHp/2), Mortal <= 0). */
export function getCyberpunkWoundState(currentHp: number, maxHp: number): CyberpunkWoundState {
  const safeMax = Math.max(1, safeInt(maxHp, 1));
  const safeCur = safeInt(currentHp, 0);
  const isMortallyWounded = safeCur <= 0;
  const isSeriouslyWounded = !isMortallyWounded && safeCur <= Math.ceil(safeMax / 2);
  const woundPenalty: 0 | 2 | 4 = isMortallyWounded ? 4 : isSeriouslyWounded ? 2 : 0;
  return { currentHp: safeCur, maxHp: safeMax, isSeriouslyWounded, isMortallyWounded, woundPenalty };
}

/** Sums cyberware humanity loss and derives current humanity, effective EMP, and cyberpsychosis risk. */
export function recomputeCyberpunkHumanity(
  humanity: Pick<CyberpunkHumanityState, 'baseEmp'> & Partial<CyberpunkHumanityState>,
  cyberware: readonly Pick<CyberpunkCyberwareEntry, 'humanityLoss'>[],
): CyberpunkHumanitySummary {
  const baseEmp = clampInt(humanity.baseEmp, 1, 10, 6);
  const max = baseEmp * 10;
  const totalHumanityLoss = cyberware.reduce((sum, item) => sum + clampInt(item.humanityLoss, 0, 30, 0), 0);
  const current = clampInt(max - totalHumanityLoss, 0, max, 0);
  const effectiveEmp = Math.max(0, Math.floor(current / 10));
  return { humanity: { current, max, baseEmp }, totalHumanityLoss, effectiveEmp, cyberpsychosisRisk: effectiveEmp <= 2 };
}

/** Consumes ammo respecting ROF and preventing negative ammo counts. */
export function fireWeapon(weapon: CyberpunkWeaponEntry, shots = 1): FireWeaponResult {
  const rof = clampInt(weapon.rof, 1, 4, 1);
  const ammoMax = clampInt(weapon.ammoMax, 0, 999, 0);
  const ammoCurrent = clampInt(weapon.ammoCurrent, 0, ammoMax, 0);
  if (ammoCurrent <= 0 || safeInt(shots, 1) <= 0) return { weapon: { ...weapon, rof, ammoCurrent, ammoMax }, fired: false, shotsFired: 0 };
  const shotsFired = Math.min(ammoCurrent, clampInt(shots, 1, rof, 1));
  return { weapon: { ...weapon, rof, ammoCurrent: ammoCurrent - shotsFired, ammoMax }, fired: true, shotsFired };
}

/** Restores weapon magazine to ammoMax. */
export function reloadWeapon(weapon: CyberpunkWeaponEntry): CyberpunkWeaponEntry {
  const ammoMax = clampInt(weapon.ammoMax, 0, 999, 0);
  return { ...weapon, rof: clampInt(weapon.rof, 1, 4, 1), ammoCurrent: ammoMax, ammoMax };
}

export function addCriticalInjury(
  injuries: readonly CyberpunkCriticalInjuryEntry[],
  entry: CyberpunkCriticalInjuryEntry,
): CyberpunkCriticalInjuryEntry[] {
  const clean: CyberpunkCriticalInjuryEntry = {
    id: safeStr(entry.id, `inj_${injuries.length + 1}`, 64),
    name: safeStr(entry.name, 'Critical Injury', 120),
    effect: safeStr(entry.effect, 'Tactical penalty', 240),
    treated: Boolean(entry.treated),
  };
  const idx = injuries.findIndex((i) => i.id === clean.id);
  if (idx >= 0) return injuries.map((i, k) => (k === idx ? clean : i));
  return injuries.length >= 20 ? [...injuries] : [...injuries, clean];
}

export const toggleCriticalInjuryTreated = (injuries: readonly CyberpunkCriticalInjuryEntry[], id: string): CyberpunkCriticalInjuryEntry[] =>
  injuries.map((inj) => (inj.id === id ? { ...inj, treated: !inj.treated } : inj));

export const removeCriticalInjury = (injuries: readonly CyberpunkCriticalInjuryEntry[], id: string): CyberpunkCriticalInjuryEntry[] =>
  injuries.filter((inj) => inj.id !== id);

export function createDefaultCyberpunkState(overrides: Partial<CyberpunkState> = {}): CyberpunkState {
  const baseEmp = clampInt(overrides.humanity?.baseEmp ?? 6, 1, 10, 6);
  const maxHum = clampInt(overrides.humanity?.max ?? baseEmp * 10, 0, 100, baseEmp * 10);
  const curHum = clampInt(overrides.humanity?.current ?? maxHum, 0, maxHum, maxHum);
  return {
    armor: { head: normArmorPiece(overrides.armor?.head), body: normArmorPiece(overrides.armor?.body) },
    humanity: { current: curHum, max: maxHum, baseEmp },
    cyberware: Array.isArray(overrides.cyberware) ? overrides.cyberware.slice(0, 40).map((c) => ({ ...c })) : [],
    weapons: Array.isArray(overrides.weapons) ? overrides.weapons.slice(0, 20).map((w) => ({ ...w })) : [],
    criticalInjuries: Array.isArray(overrides.criticalInjuries) ? overrides.criticalInjuries.slice(0, 20).map((ci) => ({ ...ci })) : [],
  };
}

export function normalizeCyberpunkState(raw: unknown, fallback?: Partial<CyberpunkState>): CyberpunkState {
  if (!isPlainObj(raw)) return createDefaultCyberpunkState(fallback);
  const r = raw as Partial<CyberpunkState>;
  const ra = isPlainObj(r.armor) ? (r.armor as Partial<CyberpunkArmorState>) : undefined;
  const cyberware = Array.isArray(r.cyberware)
    ? r.cyberware.slice(0, 40).filter(isPlainObj).map((c, idx) => ({
        id: safeStr(c.id, `cw_${idx + 1}`, 64), name: safeStr(c.name, 'Cyberware', 120), slot: safeStr(c.slot, 'neural', 64),
        humanityLoss: clampInt(c.humanityLoss, 0, 30, 0),
        ...(typeof c.notes === 'string' && c.notes.length > 0 ? { notes: c.notes.slice(0, 500) } : {}),
      }))
    : fallback?.cyberware;
  const weapons = Array.isArray(r.weapons)
    ? r.weapons.slice(0, 20).filter(isPlainObj).map((w, idx) => {
        const ammoMax = clampInt(w.ammoMax, 0, 999, 8);
        return {
          id: safeStr(w.id, `wpn_${idx + 1}`, 64), name: safeStr(w.name, 'Sidearm', 120),
          skillKey: safeStr(w.skillKey, 'handgun', 64), damageFormula: safeStr(w.damageFormula, '2d6', 64),
          rof: clampInt(w.rof, 1, 4, 1), ammoCurrent: clampInt(w.ammoCurrent, 0, ammoMax, ammoMax), ammoMax,
          ...(typeof w.notes === 'string' && w.notes.length > 0 ? { notes: w.notes.slice(0, 500) } : {}),
        };
      })
    : fallback?.weapons;
  const criticalInjuries = Array.isArray(r.criticalInjuries)
    ? r.criticalInjuries.slice(0, 20).filter(isPlainObj).map((ci, idx) => ({
        id: safeStr(ci.id, `inj_${idx + 1}`, 64), name: safeStr(ci.name, 'Critical Injury', 120),
        effect: safeStr(ci.effect, 'Tactical penalty', 240), treated: Boolean(ci.treated),
      }))
    : fallback?.criticalInjuries;
  return createDefaultCyberpunkState({
    armor: {
      head: { ...fallback?.armor?.head, ...(isPlainObj(ra?.head) ? ra.head : {}) } as CyberpunkArmorPiece,
      body: { ...fallback?.armor?.body, ...(isPlainObj(ra?.body) ? ra.body : {}) } as CyberpunkArmorPiece,
    },
    humanity: { ...fallback?.humanity, ...(isPlainObj(r.humanity) ? r.humanity : {}) } as CyberpunkHumanityState,
    cyberware, weapons, criticalInjuries,
  });
}
