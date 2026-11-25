import React from 'react';
import { Dices, Minus, Plus } from 'lucide-react';
import {
  type Dnd5eAbilityKey,
  type Dnd5eSpellcastingAbilityKey,
  type Dnd5eState,
  formatSignedMod,
  getSpellAttackBonus,
  getSpellSaveDC,
} from '../../core/dnd5eRules';
import { type AppTranslations } from '../../core/i18n';

interface Dnd5eSpellSlotsPanelProps {
  dnd5eState: Dnd5eState;
  abilityScores: Record<Dnd5eAbilityKey, number>;
  t: AppTranslations['cards'];
  onChangeSpellAbility: (ability: Dnd5eSpellcastingAbilityKey) => void;
  onAdjustSlotMax: (level: number, delta: number) => void;
  onToggleSlotUsed: (level: number, slotIndex: number) => void;
  onRollSpellAttack: (label: string, bonus: number) => void;
}

const SPELL_ABILITIES: readonly Dnd5eSpellcastingAbilityKey[] = ['int', 'wis', 'cha'];

export const Dnd5eSpellSlotsPanel: React.FC<Dnd5eSpellSlotsPanelProps> = ({
  dnd5eState,
  abilityScores,
  t,
  onChangeSpellAbility,
  onAdjustSlotMax,
  onToggleSlotUsed,
  onRollSpellAttack,
}) => {
  const spellAb = dnd5eState.spellcasting.ability;
  const abScore = abilityScores[spellAb];
  const spellDc = getSpellSaveDC(abScore, dnd5eState.level);
  const spellAtk = getSpellAttackBonus(abScore, dnd5eState.level);
  const atkLabel = t.t('dnd5e.spellAttackBtn');

  return (
    <div className="dnd5e-panel flex flex-col gap-3" data-testid="dnd5e-spellcasting-panel">
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 border border-[var(--border-color)] rounded-[var(--radius-card)] bg-[var(--bg-card-alt)]">
        <div className="flex items-center gap-1" role="group" aria-label={t.t('dnd5e.spellAbilityLabel')}>
          {SPELL_ABILITIES.map((ab) => {
            const active = spellAb === ab;
            return (
              <button
                key={ab}
                type="button"
                aria-pressed={active}
                data-testid={`dnd5e-spell-ab-${ab}`}
                onClick={() => onChangeSpellAbility(ab)}
                className={`min-h-[36px] px-2.5 text-[11px] font-extrabold uppercase border border-[var(--border-color)] rounded-[var(--radius-pill)] cursor-pointer ${
                  active
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                    : 'bg-[var(--bg-card)] text-[var(--ink-secondary)]'
                }`}
              >
                {t.t(`dnd5e.abilityShort.${ab}`)}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <div className="px-2 py-1 border border-[var(--border-subtle)] rounded-[var(--radius-control)] bg-[var(--bg-strip)] font-mono-tech text-xs font-extrabold tabular-nums">
            <span className="text-[var(--ink-muted)] mr-1">{t.t('dnd5e.spellSaveDc')}</span>
            <span data-testid="dnd5e-spell-dc">{spellDc}</span>
          </div>
          <button
            type="button"
            data-testid="dnd5e-spell-atk-btn"
            onClick={() => onRollSpellAttack(atkLabel, spellAtk)}
            className="cyber-roll-btn min-h-[36px] px-2.5 py-1 font-mono-tech text-xs font-extrabold uppercase inline-flex items-center gap-1 cursor-pointer"
          >
            <span>{atkLabel} {formatSignedMod(spellAtk)}</span>
            <Dices className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="font-mono-tech text-[10px] font-extrabold uppercase tracking-wider text-[var(--ink-muted)]">
          {t.t('dnd5e.spellSlotsHeading')}
        </div>
        <div className="grid grid-cols-1 gap-1">
          {dnd5eState.spellcasting.slots.map((slot) => {
            const remaining = Math.max(0, slot.max - slot.used);
            return (
              <div
                key={slot.level}
                data-testid={`dnd5e-slot-row-${slot.level}`}
                className="flex items-center justify-between gap-2 p-1.5 border border-[var(--border-subtle)] rounded-[var(--radius-control)] bg-[var(--bg-card-alt)]"
              >
                <span className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-secondary)] min-w-[78px]">
                  {t.t('dnd5e.spellCircleLabel', { level: slot.level })}
                </span>

                <div className="flex flex-wrap items-center gap-1 flex-1">
                  {Array.from({ length: slot.max }, (_, idx) => {
                    const isUsed = idx < slot.used;
                    return (
                      <button
                        key={idx}
                        type="button"
                        aria-pressed={isUsed}
                        data-testid={`dnd5e-slot-${slot.level}-${idx}`}
                        aria-label={t.t('dnd5e.spellSlotToggleAria', {
                          level: slot.level,
                          index: idx + 1,
                          max: slot.max,
                        })}
                        onClick={() => onToggleSlotUsed(slot.level, idx)}
                        className={`min-h-[32px] min-w-[28px] px-1 font-mono-tech text-[11px] font-extrabold border border-[var(--border-color)] rounded-[var(--radius-pill)] cursor-pointer ${
                          isUsed
                            ? 'bg-[var(--bg-strip)] text-[var(--ink-muted)] line-through opacity-65'
                            : 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                        }`}
                      >
                        {isUsed ? '×' : '◆'}
                      </button>
                    );
                  })}
                  {slot.max > 0 && (
                    <span className="font-mono-tech text-[10px] text-[var(--ink-muted)] ml-1 tabular-nums">
                      {remaining}/{slot.max}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    data-testid={`dnd5e-slot-dec-${slot.level}`}
                    aria-label={t.t('dnd5e.spellSlotMaxDecAria', { level: slot.level })}
                    disabled={slot.max <= 0}
                    onClick={() => onAdjustSlotMax(slot.level, -1)}
                    className="cyber-btn-outline min-h-[32px] min-w-[30px] flex items-center justify-center cursor-pointer disabled:opacity-40"
                  >
                    <Minus className="w-3 h-3" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    data-testid={`dnd5e-slot-inc-${slot.level}`}
                    aria-label={t.t('dnd5e.spellSlotMaxIncAria', { level: slot.level })}
                    disabled={slot.max >= 9}
                    onClick={() => onAdjustSlotMax(slot.level, 1)}
                    className="cyber-btn-outline min-h-[32px] min-w-[30px] flex items-center justify-center cursor-pointer disabled:opacity-40"
                  >
                    <Plus className="w-3 h-3" aria-hidden="true" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
