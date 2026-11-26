import { useCallback, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import {
  applyDndDamage, applyDndHeal, applyLongRest, DND5E_ABILITIES, formatSignedMod,
  getAbilityModifier, normalizeDnd5eState, rollD20Check, rollDeathSave, setTempHp, spendHitDieShortRest,
  type Dnd5eAbilityKey, type Dnd5eDeathSavesState, type Dnd5eHitDieType, type Dnd5eRollMode,
  type Dnd5eSkillKey, type Dnd5eSkillProficiency, type Dnd5eSpellcastingAbilityKey, type Dnd5eState,
} from '../core/dnd5eRules';
import { playDiceClatter } from '../core/diceAudio';
import type { AppTranslations } from '../core/i18n';
import { type CharacterSheetState, type RollLogEntry, type SheetEvaluation, touchSheetMetadata, updateFieldValue } from '../core/sheetModel';
import type { Dnd5eCardContext } from '../components/BentoCard';

function nowTimeString(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function syncDnd5eFields(prev: CharacterSheetState, nextState: Dnd5eState, nextHpValue?: number): CharacterSheetState {
  return {
    ...prev,
    dnd5eState: nextState,
    cards: prev.cards.map((card) => ({
      ...card,
      fields: card.fields.map((f) => {
        const k = f.key.trim().toLowerCase();
        if (nextHpValue !== undefined && (f.id === 'f_hp' || k === 'hp') && f.kind === 'resource') return { ...f, value: nextHpValue };
        if ((f.id === 'f_hit_dice' || k === 'hit_dice') && f.kind === 'resource') return { ...f, value: nextState.hitDice.current, max: nextState.hitDice.max, label: `HIT DICE (${nextState.hitDice.die})` };
        if ((f.id === 'f_inspiration' || k === 'inspiration') && f.kind === 'boolean') return { ...f, value: nextState.inspiration };
        if ((f.id === 'f_nivel' || k === 'level') && f.kind === 'number') return { ...f, value: nextState.level };
        const slotMatch = k.match(/^slots_(\d+)/);
        if (slotMatch && f.kind === 'resource') {
          const slot = nextState.spellcasting.slots.find((s) => s.level === Number.parseInt(slotMatch[1], 10));
          if (slot) return { ...f, max: Math.max(1, slot.max), value: Math.max(0, slot.max - slot.used) };
        }
        return f;
      }),
    })),
  };
}

export interface UseDnd5eHandlersParams {
  enabled: boolean;
  sheet: CharacterSheetState;
  setSheet: Dispatch<SetStateAction<CharacterSheetState>>;
  evaluation: SheetEvaluation;
  t: AppTranslations;
  triggerFlash: (msg: string) => void;
  showToast: (entry: RollLogEntry) => void;
}

export interface UseDnd5eHandlersResult {
  dnd5eContext: Dnd5eCardContext | undefined;
  rollMode: Dnd5eRollMode;
  setRollMode: Dispatch<SetStateAction<Dnd5eRollMode>>;
  rollD20: (label: string, bonus: number, options?: { isDeathSave?: boolean; overrideMode?: Dnd5eRollMode }) => void;
}

/** Encapsulates D&D 5e d20 rolling, HP/rest mutations, Death Saves, and Spell Slot handlers. */
export function useDnd5eHandlers({
  enabled, sheet, setSheet, evaluation, t, triggerFlash, showToast,
}: UseDnd5eHandlersParams): UseDnd5eHandlersResult {
  const [rollMode, setRollMode] = useState<Dnd5eRollMode>('normal');

  const rollD20 = useCallback((label: string, bonus: number, options?: { isDeathSave?: boolean; overrideMode?: Dnd5eRollMode }) => {
    const res = rollD20Check({ mode: options?.overrideMode ?? rollMode, bonus });
    const modeTag = res.mode === 'advantage' ? ' (ADV)' : res.mode === 'disadvantage' ? ' (DIS)' : '';
    const bonusStr = bonus === 0 ? '' : bonus > 0 ? ` + ${bonus}` : ` - ${Math.abs(bonus)}`;
    const entry: RollLogEntry = {
      id: `log_d20_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: nowTimeString(),
      label,
      total: res.total,
      formula: `1d20${bonusStr}${modeTag}`,
      breakdown: `d20[${res.dice.join(', ')}] → ${res.kept}${bonusStr} = ${res.total}`,
      isCritical: res.isNat20, isFumble: res.isNat1, d20Mode: res.mode,
      d20Dice: res.dice, d20Kept: res.kept, d20Discarded: res.discarded, isDeathSave: options?.isDeathSave,
    };
    playDiceClatter({ diceCount: res.dice.length, isCritical: res.isNat20, isFumble: res.isNat1 });
    showToast(entry);
    setSheet((prev) => ({ ...prev, rollLogs: [entry, ...prev.rollLogs].slice(0, 30) }));
  }, [rollMode, setSheet, showToast]);

  const dnd5eContext = useMemo<Dnd5eCardContext | undefined>(() => {
    if (!enabled) return undefined;
    const allFields = sheet.cards.flatMap((c) => c.fields);
    const hpField = allFields.find((f) => (f.id === 'f_hp' || f.key.trim().toLowerCase() === 'hp') && f.kind === 'resource');
    const acField = allFields.find((f) => f.id === 'f_ac' || f.key.trim().toLowerCase() === 'armor_class');
    const fallbackLevel = Math.max(1, Math.min(20, Math.round(evaluation.variables.level ?? 1)));
    const state = normalizeDnd5eState(sheet.dnd5eState, { level: fallbackLevel });
    const abilityScores = Object.fromEntries(
      DND5E_ABILITIES.map((ab) => [ab.key, Math.max(1, Math.min(30, Math.round(evaluation.variables[ab.fieldKey] ?? 10)))]),
    ) as Record<Dnd5eAbilityKey, number>;
    const maxHp = Math.max(1, hpField?.max ?? 10);
    const currentHp = Math.max(0, Math.min(maxHp, Math.round(typeof hpField?.value === 'number' ? hpField.value : maxHp)));
    const armorClass = acField?.kind === 'calculated' ? (evaluation.computedByFieldId[acField.id]?.formatted ?? '10') : String(Math.round(evaluation.variables.armor_class ?? 10));
    const initiativeMod = Math.round(evaluation.variables.initiative ?? getAbilityModifier(abilityScores.dex));

    const mutateState = (fn: (cur: Dnd5eState) => { nextState: Dnd5eState; nextHp?: number; prependLog?: RollLogEntry; flash?: string }) => {
      const { nextState, nextHp, prependLog, flash } = fn(normalizeDnd5eState(sheet.dnd5eState, { level: fallbackLevel }));
      setSheet((prev) => {
        const synced = touchSheetMetadata(syncDnd5eFields(prev, nextState, nextHp));
        return prependLog ? { ...synced, rollLogs: [prependLog, ...synced.rollLogs].slice(0, 30) } : synced;
      });
      if (prependLog) { playDiceClatter({ diceCount: 1, isCritical: prependLog.isCritical, isFumble: prependLog.isFumble }); showToast(prependLog); }
      if (flash) triggerFlash(flash);
    };

    return {
      state, abilityScores, hp: { current: currentHp, max: maxHp }, armorClass, initiativeMod,
      onChangeAbilityScore: (abKey, score) => {
        const spec = DND5E_ABILITIES.find((a) => a.key === abKey);
        const target = spec ? allFields.find((f) => f.id === spec.fieldId || f.key.trim().toLowerCase() === spec.fieldKey) : undefined;
        if (target) setSheet((prev) => updateFieldValue(prev, target.id, score));
      },
      onToggleSaveProf: (abKey) => mutateState((cur) => ({ nextState: { ...cur, saveProficiencies: { ...cur.saveProficiencies, [abKey]: !cur.saveProficiencies[abKey] } } })),
      onCycleSkillProf: (skillKey: Dnd5eSkillKey, nextProf: Dnd5eSkillProficiency) => mutateState((cur) => ({ nextState: { ...cur, skillProficiencies: { ...cur.skillProficiencies, [skillKey]: nextProf } } })),
      onRollCheck: (label, bonus) => rollD20(label, bonus),
      onDamage: (amount) => mutateState((cur) => { const r = applyDndDamage({ currentHp, maxHp, tempHp: cur.tempHp }, amount); return { nextState: { ...cur, tempHp: r.tempHp }, nextHp: r.currentHp }; }),
      onHeal: (amount) => mutateState((cur) => { const r = applyDndHeal({ currentHp, maxHp, tempHp: cur.tempHp, deathSaves: cur.deathSaves }, amount); return { nextState: { ...cur, deathSaves: r.deathSaves }, nextHp: r.currentHp }; }),
      onSetTempHp: (amount) => mutateState((cur) => ({ nextState: { ...cur, tempHp: setTempHp(cur.tempHp, amount, { forceOverride: true }) } })),
      onToggleInspiration: () => mutateState((cur) => ({ nextState: { ...cur, inspiration: !cur.inspiration } })),
      onChangeHitDieType: (die: Dnd5eHitDieType) => mutateState((cur) => ({ nextState: { ...cur, hitDice: { ...cur.hitDice, die } } })),
      onShortRest: () => mutateState((cur) => {
        const sr = spendHitDieShortRest({ currentHp, maxHp, tempHp: cur.tempHp, deathSaves: cur.deathSaves, hitDice: cur.hitDice, conScore: abilityScores.con });
        if (!sr.spent || sr.roll === null) return { nextState: cur };
        const modStr = formatSignedMod(sr.conMod);
        return {
          nextState: { ...cur, hitDice: sr.hitDice, deathSaves: sr.deathSaves }, nextHp: sr.currentHp,
          prependLog: {
            id: `log_sr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, timestamp: nowTimeString(),
            label: t.t('dnd5e.shortRestLogLabel', { die: cur.hitDice.die.toUpperCase() }), total: sr.healed,
            formula: `1${cur.hitDice.die}${modStr}`, breakdown: `1${cur.hitDice.die}[${sr.roll}] ${modStr} → +${sr.healed} HP (${sr.currentHp}/${maxHp})`,
          },
        };
      }),
      onLongRest: () => mutateState((cur) => { const lr = applyLongRest({ maxHp, dnd5eState: cur }); return { nextState: lr.dnd5eState, nextHp: lr.currentHp, flash: t.t('dnd5e.longRestFlash') }; }),
      onSetDeathSaves: (next: Dnd5eDeathSavesState) => mutateState((cur) => ({ nextState: { ...cur, deathSaves: next } })),
      onRollDeathSave: () => mutateState((cur) => {
        const ds = rollDeathSave({ currentHp, maxHp, deathSaves: cur.deathSaves });
        const note = ds.outcome === 'revived' ? ` · ${t.t('dnd5e.deathSaveOutcomeRevived')}` : ds.outcome === 'stabilized' ? ` · ${t.t('dnd5e.deathSaveOutcomeStabilized')}` : ds.outcome === 'dead' ? ` · ${t.t('dnd5e.deathSaveOutcomeDead')}` : '';
        return {
          nextState: { ...cur, deathSaves: ds.deathSaves }, nextHp: ds.currentHp,
          prependLog: {
            id: `log_ds_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, timestamp: nowTimeString(),
            label: t.t('dnd5e.deathSavesHeading'), total: ds.roll, formula: '1d20',
            breakdown: `d20[${ds.roll}] (${ds.deathSaves.successes}/3 ✓ · ${ds.deathSaves.failures}/3 ✕)${note}`,
            isCritical: ds.roll === 20, isFumble: ds.roll === 1, d20Mode: 'normal', d20Dice: [ds.roll], d20Kept: ds.roll, d20Discarded: null, isDeathSave: true,
          },
        };
      }),
      onRollInitiative: () => rollD20(t.t('dnd5e.initiativeBtn'), initiativeMod),
      onChangeSpellAbility: (ability: Dnd5eSpellcastingAbilityKey) => mutateState((cur) => ({ nextState: { ...cur, spellcasting: { ...cur.spellcasting, ability } } })),
      onAdjustSlotMax: (level, delta) => mutateState((cur) => ({
        nextState: { ...cur, spellcasting: { ...cur.spellcasting, slots: cur.spellcasting.slots.map((s) => s.level !== level ? s : { ...s, max: Math.max(0, Math.min(9, s.max + delta)), used: Math.min(s.used, Math.max(0, Math.min(9, s.max + delta))) }) } },
      })),
      onToggleSlotUsed: (level, slotIndex) => mutateState((cur) => ({
        nextState: { ...cur, spellcasting: { ...cur.spellcasting, slots: cur.spellcasting.slots.map((s) => s.level !== level ? s : { ...s, used: slotIndex < s.used ? slotIndex : Math.min(s.max, slotIndex + 1) }) } },
      })),
    };
  }, [enabled, sheet, evaluation, rollD20, setSheet, showToast, triggerFlash, t]);

  return { dnd5eContext, rollMode, setRollMode, rollD20 };
}
