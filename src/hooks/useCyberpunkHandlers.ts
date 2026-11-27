import { useMemo } from 'react';
import {
  addCriticalInjury, applyArmorDamage, fireWeapon, normalizeCyberpunkState, recomputeCyberpunkHumanity,
  reloadWeapon, removeCriticalInjury, repairArmorSp, rollExplodingD10Check, toggleCriticalInjuryTreated,
  type CyberpunkArmorLocation, type CyberpunkCriticalInjuryEntry, type CyberpunkCyberwareEntry,
  type CyberpunkState, type CyberpunkWeaponEntry, type ExplodingD10Options, type ExplodingD10Result,
} from '../core/cyberpunkRules';
import { playDiceClatter } from '../core/diceAudio';
import type { AppTranslations } from '../core/i18n';
import { touchSheetMetadata, type CharacterSheetState, type RollLogEntry } from '../core/sheetModel';

export interface UseCyberpunkHandlersParams {
  updateSheet: (updater: (prev: CharacterSheetState) => CharacterSheetState) => void;
  t: AppTranslations;
  triggerFlash?: (msg: string) => void;
  showToast?: (entry: RollLogEntry) => void;
}
export interface CyberpunkExplodingRollRecord extends ExplodingD10Result { entry: RollLogEntry; }
export type CyberpunkWeaponInput = Omit<CyberpunkWeaponEntry, 'id'> & { id?: string };
export type CyberpunkCyberwareInput = Omit<CyberpunkCyberwareEntry, 'id'> & { id?: string };
export type CyberpunkCriticalInjuryInput = Omit<CyberpunkCriticalInjuryEntry, 'id' | 'treated'> & { id?: string; treated?: boolean };

export interface UseCyberpunkHandlersResult {
  handleExplodingD10Roll: (label: string, options?: ExplodingD10Options) => CyberpunkExplodingRollRecord;
  handleApplyArmorDamage: (location: CyberpunkArmorLocation, rawDamage: number, options?: { headshotMultiplier?: boolean }) => void;
  handleRepairArmorSp: (location: CyberpunkArmorLocation, amount?: number) => void;
  handleFireWeapon: (weaponId: string, shots?: number) => void;
  handleReloadWeapon: (weaponId: string) => void;
  handleAddWeapon: (input: CyberpunkWeaponInput) => void;
  handleUpdateWeapon: (id: string, patch: Partial<Omit<CyberpunkWeaponEntry, 'id'>>) => void;
  handleRemoveWeapon: (id: string) => void;
  handleAddCyberware: (input: CyberpunkCyberwareInput) => void;
  handleUpdateCyberware: (id: string, patch: Partial<Omit<CyberpunkCyberwareEntry, 'id'>>) => void;
  handleRemoveCyberware: (id: string) => void;
  handleAddCriticalInjury: (input: CyberpunkCriticalInjuryInput) => void;
  handleToggleCriticalInjury: (id: string) => void;
  handleRemoveCriticalInjury: (id: string) => void;
}

const nowTimeString = (): string => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
const makeId = (prefix: string): string => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const fmtSigned = (n: number): string => (n >= 0 ? ` + ${n}` : ` - ${Math.abs(n)}`);
const asInt = (n: number | undefined): number => (typeof n === 'number' && Number.isFinite(n) ? Math.trunc(n) : 0);

function applyHpDamageToCards(cards: CharacterSheetState['cards'], hpDamage: number): CharacterSheetState['cards'] {
  if (hpDamage <= 0) return cards;
  return cards.map((card) => ({
    ...card,
    fields: card.fields.map((f) => {
      const k = f.key.trim().toLowerCase();
      if (f.kind === 'resource' && (f.id === 'f_pv' || f.id === 'f_hp' || k === 'pv' || k === 'hp')) {
        const cur = typeof f.value === 'number' && Number.isFinite(f.value) ? f.value : (f.max ?? 0);
        return { ...f, value: Math.max(0, Math.round(cur) - hpDamage) };
      }
      return f;
    }),
  }));
}

/** Formats an exploding 1d10 check into a schema-v2-valid `RollLogEntry`. */
export function buildCyberpunkRollEntry(
  label: string, result: ExplodingD10Result, options: ExplodingD10Options | undefined, t: AppTranslations,
): RollLogEntry {
  const netMod = asInt(options?.stat) + asInt(options?.skill) + asInt(options?.modifier);
  const expTag =
    result.explosionKind === 'crit' && result.explosionDie !== null ? ` + ${t.t('cyberpunk.combat.critBadge')}[+${result.explosionDie}]`
      : result.explosionKind === 'fumble' && result.explosionDie !== null ? ` - ${t.t('cyberpunk.combat.fumbleBadge')}[-${result.explosionDie}]` : '';
  const modPart = netMod !== 0 ? fmtSigned(netMod) : '';
  const woundPart = result.woundPenalty > 0 ? ` - ${result.woundPenalty}` : '';
  const dvPart = result.dv !== undefined ? ` · DV ${result.dv} (${result.passed ? 'OK' : 'FAIL'})` : '';
  return {
    id: makeId('log_cp'),
    timestamp: nowTimeString(),
    label: (label.trim() || t.t('cyberpunk.combat.explodingD10Heading')).slice(0, 120),
    total: result.total,
    formula: `1d10${modPart}${woundPart}`.slice(0, 256),
    breakdown: `1d10[${result.baseDie}]${expTag}${modPart}${woundPart} = ${result.total}${dvPart}`.slice(0, 512),
    rolls: result.explosionDie !== null ? [result.baseDie, result.explosionDie] : [result.baseDie],
    woundPenalty: result.woundPenalty,
    isCritical: result.explosionKind === 'crit',
    isFumble: result.explosionKind === 'fumble',
    ...(result.dv !== undefined ? { margin: result.total - result.dv } : {}),
  };
}

/** Pure Cyberpunk tactical orchestration handlers layered over `updateSheet` and `cyberpunkRules.ts`. */
export function useCyberpunkHandlers({ updateSheet, t, triggerFlash, showToast }: UseCyberpunkHandlersParams): UseCyberpunkHandlersResult {
  return useMemo(() => {
    const mutate = (transform: (cur: CyberpunkState, prev: CharacterSheetState) => { state: CyberpunkState; hpDamage?: number } | null) => {
      updateSheet((prev) => {
        const cur = normalizeCyberpunkState(prev.cyberpunkState);
        const res = transform(cur, prev);
        if (!res) return prev;
        const cards = res.hpDamage ? applyHpDamageToCards(prev.cards, res.hpDamage) : prev.cards;
        return touchSheetMetadata({ ...prev, cards, cyberpunkState: res.state });
      });
    };
    const updateCyberwareList = (buildNext: (cur: CyberpunkState) => CyberpunkCyberwareEntry[] | null) =>
      mutate((cur) => {
        const nextList = buildNext(cur);
        if (!nextList) return null;
        const normalized = normalizeCyberpunkState({ ...cur, cyberware: nextList }, cur);
        return { state: { ...normalized, humanity: recomputeCyberpunkHumanity(cur.humanity, normalized.cyberware).humanity } };
      });
    return {
      handleExplodingD10Roll: (label, options) => {
        const res = rollExplodingD10Check(options);
        const entry = buildCyberpunkRollEntry(label, res, options, t);
        playDiceClatter({ diceCount: res.explosionDie !== null ? 2 : 1, isCritical: res.explosionKind === 'crit', isFumble: res.explosionKind === 'fumble' });
        if (showToast && typeof window !== 'undefined' && window.innerWidth < 1024) showToast(entry);
        updateSheet((prev) => ({ ...prev, rollLogs: [entry, ...prev.rollLogs].slice(0, 30) }));
        return { ...res, entry };
      },
      handleApplyArmorDamage: (location, rawDamage, options) => {
        let flashMsg: string | null = null;
        mutate((cur, prev) => {
          const res = applyArmorDamage(cur.armor, location, rawDamage, options);
          const loc = t.t(location === 'head' ? 'cyberpunk.combat.armorHead' : 'cyberpunk.combat.armorBody');
          flashMsg = res.penetrated
            ? t.t('cyberpunk.combat.armorAblatedFlash', { location: loc, before: res.spBefore, after: res.nextSp, hp: res.hpDamage })
            : t.t('cyberpunk.combat.armorBlockedFlash', { damage: res.incomingDamage, sp: res.spBefore });
          return !res.penetrated && prev.cyberpunkState ? null : { state: { ...cur, armor: res.armor }, hpDamage: res.hpDamage };
        });
        if (triggerFlash) queueMicrotask(() => { if (flashMsg) triggerFlash(flashMsg); });
      },
      handleRepairArmorSp: (location, amount) => mutate((cur, prev) => {
        const nextArmor = repairArmorSp(cur.armor, location, amount);
        return nextArmor[location].sp === cur.armor[location].sp && prev.cyberpunkState ? null : { state: { ...cur, armor: nextArmor } };
      }),
      handleFireWeapon: (weaponId, shots = 1) => mutate((cur) => {
        const target = cur.weapons.find((w) => w.id === weaponId);
        if (!target) return null;
        const res = fireWeapon(target, shots);
        return !res.fired ? null : { state: { ...cur, weapons: cur.weapons.map((w) => (w.id === weaponId ? res.weapon : w)) } };
      }),
      handleReloadWeapon: (weaponId) => mutate((cur) => {
        const target = cur.weapons.find((w) => w.id === weaponId);
        if (!target) return null;
        const next = reloadWeapon(target);
        return next.ammoCurrent === target.ammoCurrent && next.ammoMax === target.ammoMax && next.rof === target.rof
          ? null : { state: { ...cur, weapons: cur.weapons.map((w) => (w.id === weaponId ? next : w)) } };
      }),
      handleAddWeapon: (input) => mutate((cur) => ({
        state: normalizeCyberpunkState({ ...cur, weapons: [...cur.weapons, { ...input, id: input.id ?? makeId('wpn') }] }, cur),
      })),
      handleUpdateWeapon: (id, patch) => mutate((cur) => (cur.weapons.some((w) => w.id === id)
        ? { state: normalizeCyberpunkState({ ...cur, weapons: cur.weapons.map((w) => (w.id === id ? { ...w, ...patch, id } : w)) }, cur) }
        : null)),
      handleRemoveWeapon: (id) => mutate((cur) => {
        const weapons = cur.weapons.filter((w) => w.id !== id);
        return weapons.length === cur.weapons.length ? null : { state: { ...cur, weapons } };
      }),
      handleAddCyberware: (input) => updateCyberwareList((cur) => [...cur.cyberware, { ...input, id: input.id ?? makeId('cw') }]),
      handleUpdateCyberware: (id, patch) => updateCyberwareList((cur) =>
        cur.cyberware.some((c) => c.id === id) ? cur.cyberware.map((c) => (c.id === id ? { ...c, ...patch, id } : c)) : null),
      handleRemoveCyberware: (id) => updateCyberwareList((cur) => {
        const next = cur.cyberware.filter((c) => c.id !== id);
        return next.length === cur.cyberware.length ? null : next;
      }),
      handleAddCriticalInjury: (input) => mutate((cur) => ({
        state: {
          ...cur,
          criticalInjuries: addCriticalInjury(cur.criticalInjuries, {
            id: input.id ?? makeId('inj'), name: input.name, effect: input.effect, treated: Boolean(input.treated),
          }),
        },
      })),
      handleToggleCriticalInjury: (id) => mutate((cur) => cur.criticalInjuries.some((i) => i.id === id)
        ? { state: { ...cur, criticalInjuries: toggleCriticalInjuryTreated(cur.criticalInjuries, id) } } : null),
      handleRemoveCriticalInjury: (id) => mutate((cur) => {
        const next = removeCriticalInjury(cur.criticalInjuries, id);
        return next.length === cur.criticalInjuries.length ? null : { state: { ...cur, criticalInjuries: next } };
      }),
    };
  }, [updateSheet, t, triggerFlash, showToast]);
}
