import React, { useId, useMemo, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import {
  addDnd5eXp, applyDnd5eLevelUp, DND5E_DEFAULT_SESSIONS_PER_LEVEL, type Dnd5eProgressionEntry,
  getDnd5eXpProgress, logDnd5eSession, normalizeDnd5eProgression, setDnd5eProgressionMode, undoLastDnd5eProgression,
} from '../../core/dnd5eProgression';
import { type Dnd5eState, formatSignedMod, getAbilityModifier, normalizeDnd5eState } from '../../core/dnd5eRules';
import type { TranslateFn } from '../../core/i18n';
import type { CharacterSheetState, RollLogEntry } from '../../core/sheetModel';
import { Dnd5eLevelUpPanel } from './Dnd5eLevelUpPanel';

export interface Dnd5eProgressionWorkspaceProps {
  sheet: CharacterSheetState; t: TranslateFn;
  onUpdateSheet: (updater: (prev: CharacterSheetState) => CharacterSheetState) => void;
  onAppendRollLog: (entry: RollLogEntry) => void; onFlash?: (msg: string) => void;
}
const QUICK_XP = [50, 100, 250, 500, 1000] as const;

function syncFields(prev: CharacterSheetState, next: Dnd5eState, maxHp?: number, curHp?: number): CharacterSheetState {
  return {
    ...prev, dnd5eState: next,
    cards: prev.cards.map((c) => ({
      ...c,
      fields: c.fields.map((f) => {
        const k = f.key.trim().toLowerCase();
        if ((f.id === 'f_nivel' || k === 'level') && f.kind === 'number') return { ...f, value: next.level };
        if ((f.id === 'f_hit_dice' || k === 'hit_dice') && f.kind === 'resource') return { ...f, value: next.hitDice.current, max: next.hitDice.max, label: `HIT DICE (${next.hitDice.die})` };
        if ((f.id === 'f_hp' || k === 'hp') && f.kind === 'resource' && maxHp !== undefined) return { ...f, max: maxHp, value: curHp ?? f.value };
        return f;
      }),
    })),
  };
}

export const Dnd5eProgressionWorkspace: React.FC<Dnd5eProgressionWorkspaceProps> = ({
  sheet, t, onUpdateSheet, onAppendRollLog, onFlash,
}) => {
  const uid = useId();
  const [xpInput, setXpInput] = useState('100');
  const [noteInput, setNoteInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { dnd5eState, prog, conMod, maxHp, currentHp } = useMemo(() => {
    const fields = sheet.cards.flatMap((c) => c.fields);
    const find = (id: string, key: string) => fields.find((f) => f.id === id || f.key.trim().toLowerCase() === key);
    const lvl = find('f_nivel', 'level'), con = find('f_constitution', 'constitution'), hp = find('f_hp', 'hp');
    const state = normalizeDnd5eState(sheet.dnd5eState, { level: typeof lvl?.value === 'number' ? lvl.value : 1 });
    const mHp = Math.max(1, hp?.kind === 'resource' ? (hp.max ?? 10) : 10);
    const cHp = Math.max(0, Math.min(mHp, typeof hp?.value === 'number' ? hp.value : mHp));
    return {
      dnd5eState: state, prog: normalizeDnd5eProgression(state.progression),
      conMod: getAbilityModifier(typeof con?.value === 'number' ? con.value : 10), maxHp: mHp, currentHp: cHp,
    };
  }, [sheet.cards, sheet.dnd5eState]);

  const xpProg = getDnd5eXpProgress(dnd5eState.level, prog.xpTotal);
  const targetSessions = Math.max(1, prog.sessionsPerLevel ?? DND5E_DEFAULT_SESSIONS_PER_LEVEL);
  const lastLvlIdx = prog.history.map((e) => e.kind).lastIndexOf('level_up');
  const cycleSessions = lastLvlIdx === -1 ? prog.sessionsCount
    : prog.history.slice(lastLvlIdx + 1).reduce((s, e) => s + (e.kind === 'session' ? (e.deltaSessions ?? 1) : 0), 0);
  const sessionPct = Math.min(100, Math.round((cycleSessions / targetSessions) * 100));

  const mutateProg = (fn: (cur: Dnd5eState) => Dnd5eState) =>
    onUpdateSheet((prev) => syncFields(prev, fn(normalizeDnd5eState(prev.dnd5eState, { level: dnd5eState.level }))));

  const submitXp = (amount: number) => {
    const val = Math.trunc(amount);
    if (!Number.isFinite(val) || val <= 0) { setErrorMsg(t('dnd5e.prog.errInvalidXp')); return; }
    setErrorMsg(null); mutateProg((cur) => addDnd5eXp(cur, val, { note: noteInput }));
    setNoteInput(''); onFlash?.(t('dnd5e.prog.flashXpAdded', { xp: val }));
  };
  const submitSession = () => {
    setErrorMsg(null); mutateProg((cur) => logDnd5eSession(cur, { note: noteInput }));
    setNoteInput(''); onFlash?.(t('dnd5e.prog.flashSessionLogged'));
  };
  const handleConfirmLevelUp = (params: { method: 'average' | 'roll'; rolledDie?: number; note?: string }) => {
    let appliedLevel = dnd5eState.level, gained = 0;
    onUpdateSheet((prev) => {
      const res = applyDnd5eLevelUp({ dnd5eState: normalizeDnd5eState(prev.dnd5eState, { level: dnd5eState.level }), maxHp, currentHp }, { conMod, ...params });
      if (!res.applied) return prev;
      appliedLevel = res.toLevel; gained = res.hpGain;
      return syncFields(prev, res.dnd5eState, res.maxHp, res.currentHp);
    });
    if (gained > 0) onFlash?.(t('dnd5e.prog.flashLevelUp', { level: appliedLevel, hp: gained }));
  };
  const handleUndo = () => {
    if (prog.history.length === 0) return;
    onUpdateSheet((prev) => {
      const res = undoLastDnd5eProgression({ dnd5eState: normalizeDnd5eState(prev.dnd5eState, { level: dnd5eState.level }), maxHp, currentHp });
      return res.undone ? syncFields(prev, res.dnd5eState, res.maxHp, res.currentHp) : prev;
    });
    onFlash?.(t('dnd5e.prog.flashUndone'));
  };

  const badgeText = (e: Dnd5eProgressionEntry) => e.kind === 'xp_gain' ? t('dnd5e.prog.entryXpBadge', { xp: e.deltaXp ?? 0 })
    : e.kind === 'session' ? t('dnd5e.prog.entrySessionBadge', { count: e.deltaSessions ?? 1 })
      : t('dnd5e.prog.entryLevelBadge', { from: e.fromLevel ?? 1, to: e.toLevel ?? 2, hp: e.hpGain ?? 1 });

  const xpInputId = `${uid}-xp-amt`, noteId = `${uid}-prog-note`, targetId = `${uid}-ses-target`;
  const onEnter = (e: React.KeyboardEvent, fn: () => void) => {
    if (!e.nativeEvent.isComposing && e.keyCode !== 229 && e.key === 'Enter') fn();
  };
  const kpiBox = 'p-2.5 border border-[var(--border-subtle)] rounded-[var(--radius-card)] bg-[var(--bg-card-alt)]';

  return (
    <div data-testid="dnd5e-progression-workspace" className="dnd5e-prog-panel flex flex-col gap-4">
      <header className="bento-card p-4 flex flex-wrap items-center justify-between gap-3">
        <div><div className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-muted)]">{t('dnd5e.prog.tag')}</div><h2 className="font-display text-lg font-extrabold uppercase tracking-wide text-[var(--ink-primary)]">{t('dnd5e.prog.title')}</h2></div>
        <div role="group" aria-label={t('dnd5e.prog.modeGroupAria')} className="inline-flex flex-wrap gap-1.5">
          {(['xp', 'milestone'] as const).map((m) => (
            <button key={m} type="button" aria-pressed={prog.mode === m} data-testid={`dnd5e-mode-${m}`} onClick={() => mutateProg((cur) => setDnd5eProgressionMode(cur, m))} className={`dnd5e-prog-mode-btn min-h-[36px] px-3 py-1.5 border border-[var(--border-color)] rounded-[var(--radius-pill)] font-mono-tech text-xs font-extrabold uppercase cursor-pointer ${prog.mode === m ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]' : 'bg-[var(--bg-card-alt)] text-[var(--ink-primary)]'}`}>
              {m === 'xp' ? t('dnd5e.prog.modeXp') : t('dnd5e.prog.modeMilestone')}
            </button>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <section className="lg:col-span-7 bento-card p-4 flex flex-col gap-3">
          {prog.mode === 'xp' ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className={kpiBox}><div className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-muted)]">{t('dnd5e.prog.currentLevel')}</div><div data-testid="dnd5e-prog-level" className="font-display text-2xl font-extrabold tabular-nums">{xpProg.currentLevel}</div></div>
                <div className={kpiBox}><div className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-muted)]">{t('dnd5e.prog.xpAccumulated')}</div><div data-testid="dnd5e-prog-xp-total" className="font-display text-2xl font-extrabold tabular-nums">{prog.xpTotal.toLocaleString()}</div></div>
                <div className={kpiBox}>
                  <div className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-muted)]">{t('dnd5e.prog.nextLevel')}</div>
                  <div className="font-mono-tech text-xs font-black tabular-nums mt-1">{xpProg.nextThreshold === null ? t('dnd5e.prog.maxLevelReached') : t('dnd5e.prog.srdThreshold', { xp: xpProg.nextThreshold.toLocaleString() })}</div>
                  <div className="font-mono-tech text-[10px] text-[var(--ink-secondary)]">{xpProg.nextThreshold === null ? '' : xpProg.canLevelUp ? t('dnd5e.prog.readyToLevelUp') : t('dnd5e.prog.xpRemaining', { xp: xpProg.xpToNext.toLocaleString() })}</div>
                </div>
              </div>
              <div role="progressbar" aria-label={t('dnd5e.prog.progressAria', { level: xpProg.nextLevel ?? 20 })} aria-valuenow={xpProg.progressPercent} aria-valuemin={0} aria-valuemax={100} className="dnd5e-prog-bar h-3 w-full overflow-hidden"><div className="dnd5e-prog-bar-fill h-full" style={{ width: `${xpProg.progressPercent}%` }} /></div>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_XP.map((amt) => (<button key={amt} type="button" aria-label={t('dnd5e.prog.quickXpAria', { amount: amt })} data-testid={`dnd5e-quick-xp-${amt}`} onClick={() => submitXp(amt)} className="cyber-btn-outline min-h-[36px] px-2.5 py-1 font-mono-tech text-xs font-extrabold cursor-pointer">+{amt} XP</button>))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                <div className="sm:col-span-4 flex flex-col gap-1"><label htmlFor={xpInputId} className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-secondary)]">{t('dnd5e.prog.xpAmountLabel')}</label><input id={xpInputId} type="number" min={1} data-testid="dnd5e-xp-input" value={xpInput} onChange={(e) => setXpInput(e.target.value)} onKeyDown={(e) => onEnter(e, () => submitXp(Number(xpInput)))} className="cyber-input mobile-touch-input min-h-[36px] px-2.5 py-1.5 font-mono-tech font-bold tabular-nums" /></div>
                <div className="sm:col-span-5 flex flex-col gap-1"><label htmlFor={noteId} className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-secondary)]">{t('dnd5e.prog.noteLabel')}</label><input id={noteId} type="text" value={noteInput} onChange={(e) => setNoteInput(e.target.value)} onKeyDown={(e) => onEnter(e, () => submitXp(Number(xpInput)))} placeholder={t('dnd5e.prog.notePlaceholder')} className="cyber-input mobile-touch-input min-h-[36px] px-2.5 py-1.5 text-xs" /></div>
                <button type="button" data-testid="dnd5e-add-xp-btn" onClick={() => submitXp(Number(xpInput))} className="sm:col-span-3 cyber-roll-btn min-h-[36px] px-3 py-1.5 text-[11px] font-extrabold uppercase cursor-pointer">{t('dnd5e.prog.addXpBtn')}</button>
              </div>
              {errorMsg && <p role="alert" className="font-mono-tech text-xs font-bold text-[var(--accent-danger)]">{errorMsg}</p>}
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                <div className={kpiBox}><div className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-muted)]">{t('dnd5e.prog.currentLevel')}</div><div className="font-display text-2xl font-extrabold tabular-nums">{dnd5eState.level}</div></div>
                <div className={kpiBox}><div className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-muted)]">{t('dnd5e.prog.sessionsCount')}</div><div data-testid="dnd5e-sessions-count" className="font-display text-2xl font-extrabold tabular-nums">{prog.sessionsCount}</div></div>
                <div className="flex flex-col gap-1"><label htmlFor={targetId} className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-secondary)]">{t('dnd5e.prog.sessionsTargetLabel')}</label><input id={targetId} type="number" min={1} max={20} data-testid="dnd5e-sessions-target-input" value={targetSessions} onChange={(e) => mutateProg((cur) => setDnd5eProgressionMode(cur, 'milestone', Math.max(1, Math.min(20, Number.parseInt(e.target.value, 10) || 1))))} className="cyber-input mobile-touch-input min-h-[36px] px-2.5 py-1.5 font-mono-tech font-bold tabular-nums" /></div>
              </div>
              <div className="flex items-center justify-between font-mono-tech text-[11px] font-bold text-[var(--ink-secondary)]">
                <span>{t('dnd5e.prog.sessionsProgressLabel', { current: cycleSessions, target: targetSessions })}</span>
                {cycleSessions >= targetSessions && <span className="text-[var(--accent-primary)]">{t('dnd5e.prog.milestoneReady')}</span>}
              </div>
              <div role="progressbar" aria-label={t('dnd5e.prog.sessionsProgressLabel', { current: cycleSessions, target: targetSessions })} aria-valuenow={sessionPct} aria-valuemin={0} aria-valuemax={100} className="dnd5e-prog-bar h-3 w-full overflow-hidden"><div className="dnd5e-prog-bar-fill h-full" style={{ width: `${sessionPct}%` }} /></div>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                <div className="sm:col-span-8 flex flex-col gap-1"><label htmlFor={noteId} className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-secondary)]">{t('dnd5e.prog.noteLabel')}</label><input id={noteId} type="text" value={noteInput} onChange={(e) => setNoteInput(e.target.value)} onKeyDown={(e) => onEnter(e, submitSession)} placeholder={t('dnd5e.prog.sessionNotePlaceholder')} className="cyber-input mobile-touch-input min-h-[36px] px-2.5 py-1.5 text-xs" /></div>
                <button type="button" data-testid="dnd5e-log-session-btn" onClick={submitSession} className="sm:col-span-4 cyber-roll-btn min-h-[36px] px-3 py-1.5 text-[11px] font-extrabold uppercase cursor-pointer">{t('dnd5e.prog.logSessionBtn')}</button>
              </div>
            </>
          )}
        </section>

        <div className="lg:col-span-5">
          <Dnd5eLevelUpPanel
            dnd5eState={dnd5eState} maxHp={maxHp} currentHp={currentHp} conMod={conMod} xpToNext={xpProg.xpToNext}
            canLevelUpByXp={xpProg.canLevelUp} mode={prog.mode} t={t} onConfirmLevelUp={handleConfirmLevelUp}
            onRollHitDieLog={({ die, rolled, conMod: cMod, hpGain, nextLevel }) => onAppendRollLog({
              id: `log_lvl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              label: t('dnd5e.lvl.rollLogLabel', { level: nextLevel, die: die.toUpperCase() }),
              total: hpGain, formula: `1${die}${formatSignedMod(cMod)}`, breakdown: `1${die}[${rolled}] ${formatSignedMod(cMod)} → +${hpGain} HP`,
            })}
          />
        </div>
      </div>

      <section className="bento-card p-4 flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-mono-tech text-xs font-extrabold uppercase tracking-wider text-[var(--ink-primary)]">{t('dnd5e.prog.historyTitle')}</h3>
          <button type="button" aria-disabled={prog.history.length === 0} data-testid="dnd5e-prog-undo-btn" onClick={handleUndo} className="cyber-btn-outline min-h-[36px] px-3 py-1 text-[11px] font-extrabold uppercase inline-flex items-center gap-1.5 cursor-pointer"><RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /><span>{t('dnd5e.prog.undoBtn')}</span></button>
        </div>
        {prog.history.length === 0 ? <p className="font-mono-tech text-xs text-[var(--ink-muted)]">{t('dnd5e.prog.emptyHistory')}</p> : (
          <ul className="flex flex-col gap-1.5">
            {[...prog.history].reverse().map((entry) => (
              <li key={entry.id} className="p-2 border border-[var(--border-subtle)] rounded-[var(--radius-card)] bg-[var(--bg-card-alt)] flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2"><span className="px-2 py-0.5 border border-[var(--border-color)] rounded-[var(--radius-pill)] font-mono-tech text-[10px] font-black tabular-nums">{badgeText(entry)}</span>{entry.note && <span className="font-mono-tech text-xs text-[var(--ink-primary)]">{entry.note}</span>}</div>
                <span className="font-mono-tech text-[10px] text-[var(--ink-muted)] tabular-nums">{entry.timestamp.slice(0, 16).replace('T', ' ')}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
