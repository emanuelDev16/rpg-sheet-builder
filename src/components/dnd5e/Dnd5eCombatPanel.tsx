import React, { useId, useState } from 'react';
import { Dices, Shield, Sparkles } from 'lucide-react';
import { type Dnd5eDeathSavesState, type Dnd5eHitDieType, type Dnd5eState, formatSignedMod } from '../../core/dnd5eRules';
import { type AppTranslations } from '../../core/i18n';

interface Dnd5eCombatPanelProps {
  dnd5eState: Dnd5eState;
  currentHp: number;
  maxHp: number;
  armorClass: string;
  initiativeMod: number;
  t: AppTranslations['cards'];
  onDamage: (amount: number) => void;
  onHeal: (amount: number) => void;
  onSetTempHp: (amount: number) => void;
  onToggleInspiration: () => void;
  onChangeHitDieType: (die: Dnd5eHitDieType) => void;
  onShortRest: () => void;
  onLongRest: () => void;
  onSetDeathSaves: (next: Dnd5eDeathSavesState) => void;
  onRollDeathSave: () => void;
  onRollInitiative: () => void;
}

export const Dnd5eCombatPanel: React.FC<Dnd5eCombatPanelProps> = ({
  dnd5eState, currentHp, maxHp, armorClass, initiativeMod, t,
  onDamage, onHeal, onSetTempHp, onToggleInspiration, onChangeHitDieType,
  onShortRest, onLongRest, onSetDeathSaves, onRollDeathSave, onRollInitiative,
}) => {
  const uid = useId();
  const [amountInput, setAmountInput] = useState('5');
  const [confirmLongRest, setConfirmLongRest] = useState(false);
  const parsedAmount = Math.max(0, Number.parseInt(amountInput, 10) || 0);
  const amountId = `${uid}-hp-delta`;
  const hitDieId = `${uid}-hit-die`;

  return (
    <div className="dnd5e-panel flex flex-col gap-3" data-testid="dnd5e-combat-panel">
      <div className="grid grid-cols-3 gap-1.5">
        <div className="p-2 border border-[var(--border-color)] rounded-[var(--radius-card)] bg-[var(--bg-card-alt)] flex flex-col items-center justify-center">
          <span className="font-mono-tech text-[9px] font-bold uppercase text-[var(--ink-muted)] inline-flex items-center gap-1">
            <Shield className="w-3 h-3" aria-hidden="true" />
            {t.t('dnd5e.armorClassShort')}
          </span>
          <span data-testid="dnd5e-ac-val" className="font-display text-2xl font-extrabold leading-tight text-[var(--ink-primary)] tabular-nums">{armorClass}</span>
        </div>

        <button type="button" data-testid="dnd5e-initiative-btn" onClick={onRollInitiative} className="cyber-roll-btn min-h-[36px] p-2 flex flex-col items-center justify-center cursor-pointer">
          <span className="font-mono-tech text-[9px] font-bold uppercase opacity-85">{t.t('dnd5e.initiativeBtn')}</span>
          <span className="font-mono-tech text-base font-black tabular-nums inline-flex items-center gap-1">
            {formatSignedMod(initiativeMod)}
            <Dices className="w-3.5 h-3.5" aria-hidden="true" />
          </span>
        </button>

        <button
          type="button"
          aria-pressed={dnd5eState.inspiration}
          data-testid="dnd5e-inspiration-btn"
          onClick={onToggleInspiration}
          className={`min-h-[36px] p-2 border border-[var(--border-color)] rounded-[var(--radius-card)] flex flex-col items-center justify-center cursor-pointer transition-colors ${
            dnd5eState.inspiration ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]' : 'bg-[var(--bg-card-alt)] text-[var(--ink-secondary)]'
          }`}
        >
          <span className="font-mono-tech text-[9px] font-bold uppercase inline-flex items-center gap-1">
            <Sparkles className="w-3 h-3" aria-hidden="true" />
            {t.t('dnd5e.inspirationLabel')}
          </span>
          <span className="font-mono-tech text-xs font-extrabold">{dnd5eState.inspiration ? '✓' : '○'}</span>
        </button>
      </div>

      <div className="p-2.5 border border-[var(--border-color)] rounded-[var(--radius-card)] bg-[var(--bg-card-alt)] flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono-tech text-[11px] font-extrabold uppercase text-[var(--ink-secondary)]">{t.t('dnd5e.hpLabel')}</span>
          <div className="flex items-center gap-2 font-mono-tech tabular-nums">
            <span data-testid="dnd5e-hp-readout" className="text-base font-black text-[var(--ink-primary)]">{currentHp} / {maxHp}</span>
            <span data-testid="dnd5e-temphp-readout" className="px-1.5 py-0.5 text-[10px] font-extrabold border border-[var(--border-color)] rounded-[var(--radius-pill)] bg-[var(--bg-strip)] text-[var(--ink-primary)]">
              {t.t('dnd5e.tempHpLabel')}: {dnd5eState.tempHp}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <label htmlFor={amountId} className="sr-only">{t.t('dnd5e.amountInputLabel')}</label>
          <input
            id={amountId}
            type="number"
            min={0}
            data-testid="dnd5e-hp-amount-input"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            className="cyber-input mobile-touch-input w-20 min-h-[36px] px-2 text-center font-mono-tech font-bold tabular-nums"
          />
          <button type="button" data-testid="dnd5e-damage-btn" onClick={() => onDamage(parsedAmount)} className="cyber-btn-outline min-h-[36px] flex-1 px-2 text-[10px] font-extrabold uppercase text-[var(--accent-danger)] border-[var(--accent-danger)] cursor-pointer">
            {t.t('dnd5e.damageBtn')}
          </button>
          <button type="button" data-testid="dnd5e-heal-btn" onClick={() => onHeal(parsedAmount)} className="cyber-btn-outline min-h-[36px] flex-1 px-2 text-[10px] font-extrabold uppercase cursor-pointer">
            {t.t('dnd5e.healBtn')}
          </button>
          <button type="button" data-testid="dnd5e-temphp-btn" onClick={() => onSetTempHp(parsedAmount)} className="cyber-btn-outline min-h-[36px] flex-1 px-2 text-[10px] font-extrabold uppercase cursor-pointer">
            {t.t('dnd5e.setTempHpBtn')}
          </button>
        </div>
      </div>

      <div className="p-2.5 border border-[var(--border-subtle)] rounded-[var(--radius-card)] bg-[var(--bg-card-alt)] flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono-tech text-[10px] font-extrabold uppercase text-[var(--ink-secondary)]">
            {t.t('dnd5e.hitDiceLabel')}: <strong data-testid="dnd5e-hd-readout">{dnd5eState.hitDice.current}/{dnd5eState.hitDice.max}</strong>
          </span>
          <label htmlFor={hitDieId} className="sr-only">{t.t('dnd5e.hitDieTypeLabel')}</label>
          <select
            id={hitDieId}
            data-testid="dnd5e-hit-die-select"
            value={dnd5eState.hitDice.die}
            onChange={(e) => onChangeHitDieType(e.target.value as Dnd5eHitDieType)}
            className="cyber-input mobile-touch-input min-h-[36px] px-2 font-mono-tech text-xs font-bold uppercase"
          >
            {(['d6', 'd8', 'd10', 'd12'] as const).map((d) => (<option key={d} value={d}>{d.toUpperCase()}</option>))}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            data-testid="dnd5e-short-rest-btn"
            aria-disabled={dnd5eState.hitDice.current <= 0 || undefined}
            title={dnd5eState.hitDice.current <= 0 ? t.t('dnd5e.shortRestNoDice') : undefined}
            onClick={() => { if (dnd5eState.hitDice.current <= 0) return; onShortRest(); }}
            className="cyber-btn-outline min-h-[36px] flex-1 px-2.5 text-[10px] font-extrabold uppercase cursor-pointer aria-[disabled=true]:opacity-45"
          >
            {t.t('dnd5e.shortRestBtn')}
          </button>
          {confirmLongRest ? (
            <>
              <button type="button" data-testid="dnd5e-long-rest-confirm" onClick={() => { setConfirmLongRest(false); onLongRest(); }} className="cyber-roll-btn min-h-[36px] flex-1 px-2.5 text-[10px] font-extrabold uppercase cursor-pointer">
                {t.t('dnd5e.longRestConfirm')}
              </button>
              <button type="button" data-testid="dnd5e-long-rest-cancel" onClick={() => setConfirmLongRest(false)} className="cyber-btn-outline min-h-[36px] px-2.5 text-[10px] font-bold uppercase cursor-pointer">
                {t.t('dnd5e.longRestCancel')}
              </button>
            </>
          ) : (
            <button type="button" data-testid="dnd5e-long-rest-btn" onClick={() => setConfirmLongRest(true)} className="cyber-btn-outline min-h-[36px] flex-1 px-2.5 text-[10px] font-extrabold uppercase cursor-pointer">
              {t.t('dnd5e.longRestBtn')}
            </button>
          )}
        </div>
      </div>

      <div className="p-2.5 border border-[var(--border-subtle)] rounded-[var(--radius-card)] bg-[var(--bg-card-alt)] flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono-tech text-[10px] font-extrabold uppercase text-[var(--ink-secondary)]">{t.t('dnd5e.deathSavesHeading')}</span>
          <button type="button" data-testid="dnd5e-roll-death-save-btn" onClick={onRollDeathSave} className="cyber-roll-btn min-h-[36px] px-2.5 py-1 text-[10px] font-extrabold uppercase inline-flex items-center gap-1 cursor-pointer">
            <Dices className="w-3 h-3" aria-hidden="true" />
            <span>{t.t('dnd5e.rollDeathSaveBtn')}</span>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {([
            ['successes', dnd5eState.deathSaves.successes, t.t('dnd5e.deathSuccesses'), 'dnd5e.deathSuccessAria'],
            ['failures', dnd5eState.deathSaves.failures, t.t('dnd5e.deathFailures'), 'dnd5e.deathFailureAria'],
          ] as const).map(([field, count, lbl, ariaKey]) => (
            <div key={field} className="flex items-center justify-between gap-1">
              <span className="font-mono-tech text-[10px] font-bold text-[var(--ink-muted)]">{lbl}</span>
              <div className="flex items-center gap-1">
                {[1, 2, 3].map((step) => {
                  const active = step <= count;
                  return (
                    <button
                      key={step}
                      type="button"
                      aria-pressed={active}
                      data-testid={`dnd5e-death-${field}-${step}`}
                      aria-label={t.t(ariaKey, { count: active && step === count ? step - 1 : step })}
                      onClick={() => onSetDeathSaves({ ...dnd5eState.deathSaves, [field]: active && step === count ? step - 1 : step })}
                      className={`min-h-[36px] min-w-[32px] px-1 font-mono-tech text-xs font-bold border border-[var(--border-color)] rounded-[var(--radius-pill)] cursor-pointer ${
                        active ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]' : 'bg-[var(--bg-card)] text-[var(--ink-muted)]'
                      }`}
                    >
                      {active ? '●' : '○'}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
