import React, { useId, useState } from 'react';
import { CheckCircle2, Dices, Sparkles } from 'lucide-react';
import {
  computeLevelUpHpGain, DND5E_MAX_LEVEL, type Dnd5eHpMethod, getDnd5eHitDieAverage, isStandardAsiLevel,
} from '../../core/dnd5eProgression';
import {
  type Dnd5eHitDieType, type Dnd5eState, formatSignedMod, getHitDieSides, getProficiencyBonus,
} from '../../core/dnd5eRules';
import { playDiceClatter } from '../../core/diceAudio';
import type { TranslateFn } from '../../core/i18n';

export interface Dnd5eLevelUpPanelProps {
  dnd5eState: Dnd5eState;
  maxHp: number;
  currentHp: number;
  conMod: number;
  xpToNext: number;
  canLevelUpByXp: boolean;
  mode: 'xp' | 'milestone';
  t: TranslateFn;
  onConfirmLevelUp: (params: { method: 'average' | 'roll'; rolledDie?: number; note?: string }) => void;
  onRollHitDieLog: (params: { die: Dnd5eHitDieType; rolled: number; conMod: number; hpGain: number; nextLevel: number }) => void;
}

export const Dnd5eLevelUpPanel: React.FC<Dnd5eLevelUpPanelProps> = ({
  dnd5eState, maxHp, conMod, xpToNext, canLevelUpByXp, mode, t, onConfirmLevelUp, onRollHitDieLog,
}) => {
  const uid = useId();
  const [method, setMethod] = useState<Extract<Dnd5eHpMethod, 'average' | 'roll'>>('average');
  const [rolledDie, setRolledDie] = useState<number | null>(null);
  const [note, setNote] = useState('');

  const curLevel = Math.max(1, Math.min(DND5E_MAX_LEVEL, dnd5eState.level));
  const isMaxLevel = curLevel >= DND5E_MAX_LEVEL;
  const nextLevel = isMaxLevel ? DND5E_MAX_LEVEL : curLevel + 1;
  const die = dnd5eState.hitDice.die;
  const dieSides = getHitDieSides(die);
  const previewGain = computeLevelUpHpGain({ die, conMod, method, rolledDie: rolledDie ?? getDnd5eHitDieAverage(die) });
  const isAsi = !isMaxLevel && isStandardAsiLevel(nextLevel);
  const noteId = `${uid}-lvl-note`;

  const rollHitDie = (): number => {
    const roll = Math.floor(Math.random() * dieSides) + 1;
    const gain = computeLevelUpHpGain({ die, conMod, method: 'roll', rolledDie: roll });
    playDiceClatter({ diceCount: 1, isCritical: roll === dieSides, isFumble: roll === 1 });
    onRollHitDieLog({ die, rolled: roll, conMod, hpGain: gain, nextLevel });
    setRolledDie(roll);
    return roll;
  };

  const handleConfirm = () => {
    if (isMaxLevel) return;
    const dieRoll = method === 'roll' ? (rolledDie ?? rollHitDie()) : undefined;
    onConfirmLevelUp({ method, rolledDie: dieRoll, note });
    setRolledDie(null);
    setNote('');
  };

  return (
    <section data-testid="dnd5e-levelup-panel" className="bento-card p-4 flex flex-col gap-3" aria-label={t('dnd5e.lvl.title')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-mono-tech text-xs font-extrabold uppercase tracking-wider text-[var(--ink-primary)]">{t('dnd5e.lvl.title')}</h3>
        <span className="px-2 py-0.5 border border-[var(--border-color)] rounded-[var(--radius-pill)] bg-[var(--bg-card-alt)] font-mono-tech text-[11px] font-black tabular-nums text-[var(--ink-primary)]">
          {isMaxLevel ? t('dnd5e.prog.maxLevelReached') : t('dnd5e.lvl.levelJump', { from: curLevel, to: nextLevel })}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="p-2 border border-[var(--border-subtle)] rounded-[var(--radius-card)] bg-[var(--bg-card-alt)]">
          <div className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-muted)]">{t('dnd5e.lvl.profBonus')}</div>
          <div className="font-mono-tech text-sm font-black tabular-nums text-[var(--ink-primary)]">
            {formatSignedMod(getProficiencyBonus(curLevel))} → {formatSignedMod(getProficiencyBonus(nextLevel))}
          </div>
        </div>
        <div className="p-2 border border-[var(--border-subtle)] rounded-[var(--radius-card)] bg-[var(--bg-card-alt)]">
          <div className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-muted)]">{t('dnd5e.lvl.hitDiceMax')}</div>
          <div className="font-mono-tech text-sm font-black tabular-nums text-[var(--ink-primary)]">
            {dnd5eState.hitDice.max}{die} → {nextLevel}{die}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="font-mono-tech text-[10px] font-extrabold uppercase text-[var(--ink-secondary)]">{t('dnd5e.lvl.hpMethodLabel')}</span>
        <div role="group" aria-label={t('dnd5e.lvl.hpMethodLabel')} className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {(['average', 'roll'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={method === m}
              data-testid={`dnd5e-hp-method-${m}`}
              onClick={() => setMethod(m)}
              className={`dnd5e-prog-mode-btn min-h-[36px] px-2.5 py-1.5 border border-[var(--border-color)] rounded-[var(--radius-card)] font-mono-tech text-[11px] font-extrabold uppercase cursor-pointer ${
                method === m ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]' : 'bg-[var(--bg-card-alt)] text-[var(--ink-primary)]'
              }`}
            >
              {m === 'average' ? t('dnd5e.lvl.hpAverageBtn') : t('dnd5e.lvl.hpRollBtn', { die })}
            </button>
          ))}
        </div>

        {method === 'roll' && (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" aria-disabled={isMaxLevel} data-testid="dnd5e-roll-hitdie-btn" onClick={() => { if (!isMaxLevel) rollHitDie(); }} className="cyber-roll-btn min-h-[36px] px-3 py-1.5 text-[11px] font-extrabold uppercase inline-flex items-center gap-1.5 cursor-pointer">
              <Dices className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t('dnd5e.lvl.rollDieNowBtn', { die })}</span>
            </button>
            {rolledDie !== null && (
              <span data-testid="dnd5e-rolled-hitdie" className="font-mono-tech text-xs font-black tabular-nums text-[var(--ink-primary)]">
                {t('dnd5e.lvl.rolledDieResult', { die, roll: rolledDie })} {formatSignedMod(conMod)} = +{previewGain}
              </span>
            )}
          </div>
        )}

        <div className="p-2 border border-[var(--border-subtle)] rounded-[var(--radius-card)] bg-[var(--bg-card-alt)] flex flex-col gap-0.5">
          <span data-testid="dnd5e-hp-preview" className="font-mono-tech text-xs font-extrabold tabular-nums text-[var(--ink-primary)]">
            {t('dnd5e.lvl.hpPreview', { from: maxHp, to: maxHp + previewGain, gain: previewGain })}
          </span>
          <span className="font-mono-tech text-[10px] text-[var(--ink-muted)]">{t('dnd5e.lvl.minHpHint')}</span>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={noteId} className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-secondary)]">{t('dnd5e.lvl.noteLabel')}</label>
        <input id={noteId} type="text" value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if (!e.nativeEvent.isComposing && e.keyCode !== 229 && e.key === 'Enter') handleConfirm(); }} placeholder={t('dnd5e.lvl.notePlaceholder')} className="cyber-input mobile-touch-input min-h-[36px] px-2.5 py-1.5 text-xs" />
      </div>

      {!isMaxLevel && mode === 'xp' && !canLevelUpByXp && (
        <p className="font-mono-tech text-[10px] text-[var(--ink-muted)]">{t('dnd5e.lvl.belowXpHint', { xp: xpToNext })}</p>
      )}

      <button type="button" aria-disabled={isMaxLevel} data-testid="dnd5e-levelup-confirm-btn" onClick={handleConfirm} className="cyber-roll-btn min-h-[36px] px-3 py-2 text-xs font-extrabold uppercase tracking-wider cursor-pointer">
        {isMaxLevel ? t('dnd5e.prog.maxLevelReached') : t('dnd5e.lvl.confirmBtn', { level: nextLevel })}
      </button>

      <div className="pt-2 border-t border-[var(--border-subtle)] flex flex-col gap-1.5">
        <span className="font-mono-tech text-[10px] font-extrabold uppercase text-[var(--ink-secondary)]">{t('dnd5e.lvl.checklistTitle')}</span>
        {isAsi && (
          <div data-testid="dnd5e-asi-badge" className="dnd5e-asi-badge p-2 border border-[var(--border-color)] rounded-[var(--radius-card)] flex flex-col gap-0.5">
            <span className="font-mono-tech text-[11px] font-black uppercase inline-flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              {t('dnd5e.lvl.asiBadge')}
            </span>
            <span className="font-mono-tech text-[10px]">{t('dnd5e.lvl.asiDetail', { level: nextLevel })}</span>
          </div>
        )}
        <div className="flex items-start gap-1.5 font-mono-tech text-[10px] text-[var(--ink-secondary)]">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
          <span><strong>{t('dnd5e.lvl.spellSlotsTitle')}:</strong> {t('dnd5e.lvl.spellSlotsDetail')}</span>
        </div>
        <div className="flex items-start gap-1.5 font-mono-tech text-[10px] text-[var(--ink-secondary)]">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
          <span><strong>{t('dnd5e.lvl.classFeaturesTitle')}:</strong> {t('dnd5e.lvl.classFeaturesDetail')}</span>
        </div>
      </div>
    </section>
  );
};
