import React, { useId, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { DND5E_MAX_LEVEL, type Dnd5eMilestoneStyle, type Dnd5eSessionProgress } from '../../core/dnd5eProgression';
import type { TranslateFn } from '../../core/i18n';

export interface Dnd5eMilestonePanelProps {
  level: number;
  progress: Dnd5eSessionProgress;
  t: TranslateFn;
  onSelectStyle: (style: Dnd5eMilestoneStyle) => void;
  onChangeTarget: (sessionsPerLevel: number) => void;
  onLogSession: (note?: string) => void;
  onLogMilestone: (note?: string) => void;
}

const KPI_BOX = 'p-2.5 border border-[var(--border-subtle)] rounded-[var(--radius-card)] bg-[var(--bg-card-alt)]';
const KPI_LBL = 'font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-muted)]';

/** Renders D&D 5e milestone progression controls for Session Goal and Free Milestone styles. */
export const Dnd5eMilestonePanel: React.FC<Dnd5eMilestonePanelProps> = ({
  level, progress, t, onSelectStyle, onChangeTarget, onLogSession, onLogMilestone,
}) => {
  const uid = useId();
  const [note, setNote] = useState('');
  const noteId = `${uid}-ms-note`;
  const isSessions = progress.style === 'sessions';
  const isMaxLevel = level >= DND5E_MAX_LEVEL;
  const atMin = progress.sessionsPerLevel <= 1;
  const atMax = progress.sessionsPerLevel >= DND5E_MAX_LEVEL;

  const submitSession = () => { onLogSession(note); setNote(''); };
  const submitMilestone = () => { onLogMilestone(note); setNote(''); };
  const onEnter = (e: React.KeyboardEvent) => {
    if (!e.nativeEvent.isComposing && e.keyCode !== 229 && e.key === 'Enter') {
      if (isSessions) submitSession();
      else submitMilestone();
    }
  };

  return (
    <div className="flex flex-col gap-3" data-testid="dnd5e-milestone-panel">
      <div role="group" aria-label={t('dnd5e.prog.milestoneStyleGroupAria')} className="inline-flex flex-wrap gap-1.5">
        {(['sessions', 'free'] as const).map((style) => (
          <button
            key={style}
            type="button"
            aria-pressed={progress.style === style}
            data-testid={`dnd5e-milestone-style-${style}`}
            onClick={() => onSelectStyle(style)}
            className={`dnd5e-prog-mode-btn min-h-[36px] px-3 py-1 border border-[var(--border-color)] rounded-[var(--radius-pill)] font-mono-tech text-[11px] font-extrabold uppercase cursor-pointer ${
              progress.style === style ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]' : 'bg-[var(--bg-card-alt)] text-[var(--ink-primary)]'
            }`}
          >
            {style === 'sessions' ? t('dnd5e.prog.styleSessions') : t('dnd5e.prog.styleFree')}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className={KPI_BOX}><div className={KPI_LBL}>{t('dnd5e.prog.currentLevel')}</div><div data-testid="dnd5e-prog-level" className="font-display text-2xl font-extrabold tabular-nums">{level}</div></div>
        {isSessions ? (
          <>
            <div className={KPI_BOX}>
              <div className={KPI_LBL}>{t('dnd5e.prog.sessionsInLevel')}</div>
              <div data-testid="dnd5e-sessions-in-level" className="font-display text-2xl font-extrabold tabular-nums">{progress.sessionsInLevel}</div>
              <div data-testid="dnd5e-sessions-count" className="font-mono-tech text-[10px] text-[var(--ink-secondary)] tabular-nums">{t('dnd5e.prog.sessionsTotalSub', { total: progress.sessionsTotal })}</div>
            </div>
            <div className={KPI_BOX}>
              <div className={KPI_LBL}>{t('dnd5e.prog.milestoneGoal')}</div>
              <div className="font-mono-tech text-xs font-black tabular-nums mt-1">{isMaxLevel ? t('dnd5e.prog.maxLevelReached') : t('dnd5e.prog.goalSessions', { target: progress.sessionsPerLevel })}</div>
              {!isMaxLevel && (
                <div className={`font-mono-tech text-[10px] tabular-nums ${progress.isGoalReached ? 'font-bold text-[var(--accent-primary)]' : 'text-[var(--ink-secondary)]'}`}>
                  {progress.isGoalReached ? t('dnd5e.prog.readyToLevelShort') : t('dnd5e.prog.sessionsRemaining', { count: progress.sessionsToNext })}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className={KPI_BOX}><div className={KPI_LBL}>{t('dnd5e.prog.sessionsCount')}</div><div data-testid="dnd5e-sessions-count" className="font-display text-2xl font-extrabold tabular-nums">{progress.sessionsTotal}</div></div>
            <div className={KPI_BOX}><div className={KPI_LBL}>{t('dnd5e.prog.paceLabel')}</div><div className="font-mono-tech text-xs font-black mt-1 text-[var(--ink-primary)]">{t('dnd5e.prog.paceFreeValue')}</div></div>
          </>
        )}
      </div>

      {isSessions && (
        <>
          <div role="progressbar" aria-label={t('dnd5e.prog.sessionsProgressLabel', { current: progress.sessionsInLevel, target: progress.sessionsPerLevel })} aria-valuenow={progress.progressPercent} aria-valuemin={0} aria-valuemax={100} className="dnd5e-prog-bar h-3 w-full overflow-hidden">
            <div className="dnd5e-prog-bar-fill h-full" style={{ width: `${progress.progressPercent}%` }} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div role="group" aria-label={t('dnd5e.prog.sessionsTargetLabel')} className="dnd5e-prog-stepper inline-flex items-center gap-1.5">
              <span className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-secondary)]">{t('dnd5e.prog.sessionsTargetLabel')}</span>
              <button type="button" aria-label={t('dnd5e.prog.targetDecAria')} aria-disabled={atMin || undefined} data-testid="dnd5e-sessions-target-dec" onClick={() => { if (!atMin) onChangeTarget(progress.sessionsPerLevel - 1); }} className="cyber-btn-outline min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"><Minus className="w-3.5 h-3.5" aria-hidden="true" /></button>
              <span data-testid="dnd5e-sessions-target-value" aria-live="polite" className="min-w-[2ch] text-center font-mono-tech text-sm font-black tabular-nums">{progress.sessionsPerLevel}</span>
              <button type="button" aria-label={t('dnd5e.prog.targetIncAria')} aria-disabled={atMax || undefined} data-testid="dnd5e-sessions-target-inc" onClick={() => { if (!atMax) onChangeTarget(progress.sessionsPerLevel + 1); }} className="cyber-btn-outline min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"><Plus className="w-3.5 h-3.5" aria-hidden="true" /></button>
            </div>
            <button type="button" data-testid="dnd5e-quick-session-btn" onClick={() => onLogSession()} className="cyber-btn-outline min-h-[36px] px-3 py-1 font-mono-tech text-xs font-extrabold uppercase cursor-pointer">{t('dnd5e.prog.quickSessionBtn')}</button>
          </div>
        </>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
        <div className={`${isSessions ? 'sm:col-span-6' : 'sm:col-span-5'} flex flex-col gap-1`}>
          <label htmlFor={noteId} className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-secondary)]">
            {t(isSessions ? 'dnd5e.prog.noteLabel' : 'dnd5e.prog.milestoneNoteLabel')}
          </label>
          <input
            id={noteId}
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={onEnter}
            placeholder={t(isSessions ? 'dnd5e.prog.sessionNotePlaceholder' : 'dnd5e.prog.milestoneNotePlaceholder')}
            className="cyber-input mobile-touch-input min-h-[36px] px-2.5 py-1.5 text-xs"
          />
        </div>
        <button
          type="button"
          data-testid="dnd5e-log-session-btn"
          onClick={submitSession}
          className={`${isSessions ? 'sm:col-span-4 cyber-roll-btn px-3' : 'sm:col-span-3 cyber-btn-outline px-2.5'} min-h-[36px] py-1.5 text-[11px] font-extrabold uppercase cursor-pointer`}
        >
          {t('dnd5e.prog.logSessionBtn')}
        </button>
        <button
          type="button"
          data-testid="dnd5e-log-milestone-btn"
          onClick={submitMilestone}
          className={`${isSessions ? 'sm:col-span-2 cyber-btn-outline px-2.5' : 'sm:col-span-4 cyber-roll-btn px-3'} min-h-[36px] py-1.5 text-[11px] font-extrabold uppercase cursor-pointer`}
        >
          {t(isSessions ? 'dnd5e.prog.logMilestoneShortBtn' : 'dnd5e.prog.logMilestoneBtn')}
        </button>
      </div>
    </div>
  );
};
