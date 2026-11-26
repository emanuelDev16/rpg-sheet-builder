import React, { useId, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import type { TranslateFn } from '../../core/i18n';
import type { CharacterSheetState, XpLedgerEntry, XpState } from '../../core/sheetModel';

export interface GenericXpWorkspaceProps {
  sheet: CharacterSheetState;
  t: TranslateFn;
  onUpdateSheet: (updater: (prev: CharacterSheetState) => CharacterSheetState) => void;
  onFlash?: (msg: string) => void;
}

const QUICK_AMOUNTS = [1, 5, 10] as const;

function readSafeXp(xp?: Partial<XpState> | null): XpState {
  const totalEarned = typeof xp?.totalEarned === 'number' && Number.isFinite(xp.totalEarned) ? Math.max(0, Math.trunc(xp.totalEarned)) : 0;
  const spent = typeof xp?.spent === 'number' && Number.isFinite(xp.spent) ? Math.max(0, Math.trunc(xp.spent)) : 0;
  return { totalEarned, spent, ledger: Array.isArray(xp?.ledger) ? xp.ledger : [] };
}

export const GenericXpWorkspace: React.FC<GenericXpWorkspaceProps> = ({ sheet, t, onUpdateSheet, onFlash }) => {
  const uid = useId();
  const [amountInput, setAmountInput] = useState('5');
  const [noteInput, setNoteInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const xp = readSafeXp(sheet.xp);
  const available = Math.max(0, xp.totalEarned - xp.spent);
  const amountId = `${uid}-generic-xp-amt`, noteId = `${uid}-generic-xp-note`;

  const applyDelta = (kind: 'award' | 'upgrade', rawAmount: number) => {
    const val = Math.trunc(rawAmount);
    if (!Number.isFinite(val) || val <= 0) { setErrorMsg(t('genericXp.errInvalidAmount')); return; }
    if (kind === 'upgrade' && val > available) { setErrorMsg(t('genericXp.errInsufficientXp', { available })); return; }
    setErrorMsg(null);
    const label = (noteInput.trim() || (kind === 'award' ? `+${val} XP` : `-${val} XP`)).slice(0, 120);
    const entry: XpLedgerEntry = {
      id: `gxp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`.slice(0, 64),
      timestamp: new Date().toISOString().slice(0, 40), kind, delta: kind === 'award' ? val : -val,
      ...(kind === 'upgrade' ? { xpSpent: val } : {}), label,
    };
    onUpdateSheet((prev) => {
      const cur = readSafeXp(prev.xp);
      return {
        ...prev,
        xp: {
          totalEarned: kind === 'award' ? cur.totalEarned + val : cur.totalEarned,
          spent: kind === 'upgrade' ? cur.spent + val : cur.spent,
          ledger: [entry, ...cur.ledger].slice(0, 40),
        },
      };
    });
    setNoteInput('');
    onFlash?.(t(kind === 'award' ? 'genericXp.flashAdded' : 'genericXp.flashSpent', { amount: val }));
  };

  const handleUndo = () => {
    if (xp.ledger.length === 0) return;
    setErrorMsg(null);
    onUpdateSheet((prev) => {
      const cur = readSafeXp(prev.xp);
      if (cur.ledger.length === 0) return prev;
      const [latest, ...rest] = cur.ledger;
      const nextEarned = latest.kind === 'award' ? Math.max(0, cur.totalEarned - Math.max(0, latest.delta)) : cur.totalEarned;
      const spentDelta = latest.kind === 'upgrade' ? Math.max(0, latest.xpSpent ?? Math.abs(latest.delta)) : 0;
      return { ...prev, xp: { totalEarned: nextEarned, spent: Math.max(0, cur.spent - spentDelta), ledger: rest } };
    });
    onFlash?.(t('genericXp.flashUndone'));
  };

  const onEnter = (e: React.KeyboardEvent) => {
    if (!e.nativeEvent.isComposing && e.keyCode !== 229 && e.key === 'Enter') applyDelta('award', Number(amountInput));
  };

  return (
    <div data-testid="generic-xp-workspace" className="generic-xp-panel flex flex-col gap-4">
      <header className="bento-card p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-muted)]">{t('genericXp.tag')}</div>
          <h2 className="font-display text-lg font-extrabold uppercase tracking-wide text-[var(--ink-primary)]">{t('genericXp.title')}</h2>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="px-3 py-1.5 border border-[var(--border-color)] rounded-[var(--radius-card)] bg-[var(--bg-card-alt)]">
            <div className="font-mono-tech text-[9px] font-bold uppercase text-[var(--ink-muted)]">{t('genericXp.available')}</div>
            <div data-testid="generic-xp-available" className="font-display text-xl font-extrabold tabular-nums">{available}</div>
          </div>
          <div className="px-3 py-1.5 border border-[var(--border-subtle)] rounded-[var(--radius-card)] bg-[var(--bg-card-alt)]">
            <div className="font-mono-tech text-[9px] font-bold uppercase text-[var(--ink-muted)]">{t('genericXp.earned')}</div>
            <div className="font-display text-xl font-extrabold tabular-nums">{xp.totalEarned}</div>
          </div>
          <div className="px-3 py-1.5 border border-[var(--border-subtle)] rounded-[var(--radius-card)] bg-[var(--bg-card-alt)]">
            <div className="font-mono-tech text-[9px] font-bold uppercase text-[var(--ink-muted)]">{t('genericXp.spent')}</div>
            <div className="font-display text-xl font-extrabold tabular-nums">{xp.spent}</div>
          </div>
        </div>
      </header>

      <section className="bento-card p-4 flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          {QUICK_AMOUNTS.map((amt) => (
            <button key={amt} type="button" aria-label={t('genericXp.quickAddAria', { amount: amt })} onClick={() => applyDelta('award', amt)} className="cyber-btn-outline min-h-[36px] px-3 py-1 font-mono-tech text-xs font-extrabold cursor-pointer">+{amt} XP</button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
          <div className="sm:col-span-3 flex flex-col gap-1">
            <label htmlFor={amountId} className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-secondary)]">{t('genericXp.amountLabel')}</label>
            <input id={amountId} type="number" min={1} data-testid="generic-xp-amount-input" value={amountInput} onChange={(e) => setAmountInput(e.target.value)} onKeyDown={onEnter} className="cyber-input mobile-touch-input min-h-[36px] px-2.5 py-1.5 font-mono-tech font-bold tabular-nums" />
          </div>
          <div className="sm:col-span-5 flex flex-col gap-1">
            <label htmlFor={noteId} className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-secondary)]">{t('genericXp.noteLabel')}</label>
            <input id={noteId} type="text" value={noteInput} onChange={(e) => setNoteInput(e.target.value)} onKeyDown={onEnter} placeholder={t('genericXp.notePlaceholder')} className="cyber-input mobile-touch-input min-h-[36px] px-2.5 py-1.5 text-xs" />
          </div>
          <button type="button" data-testid="generic-xp-add-btn" onClick={() => applyDelta('award', Number(amountInput))} className="sm:col-span-2 cyber-roll-btn min-h-[36px] px-2.5 py-1.5 text-[11px] font-extrabold uppercase cursor-pointer">{t('genericXp.addBtn')}</button>
          <button type="button" data-testid="generic-xp-spend-btn" onClick={() => applyDelta('upgrade', Number(amountInput))} className="sm:col-span-2 cyber-btn-outline min-h-[36px] px-2.5 py-1.5 text-[11px] font-extrabold uppercase cursor-pointer">{t('genericXp.spendBtn')}</button>
        </div>
        {errorMsg && <p role="alert" className="font-mono-tech text-xs font-bold text-[var(--accent-danger)]">{errorMsg}</p>}
      </section>

      <section className="bento-card p-4 flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-mono-tech text-xs font-extrabold uppercase tracking-wider text-[var(--ink-primary)]">{t('genericXp.historyTitle')}</h3>
          <button type="button" aria-disabled={xp.ledger.length === 0} data-testid="generic-xp-undo-btn" onClick={handleUndo} className="cyber-btn-outline min-h-[36px] px-3 py-1 text-[11px] font-extrabold uppercase inline-flex items-center gap-1.5 cursor-pointer">
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /><span>{t('genericXp.undoBtn')}</span>
          </button>
        </div>
        {xp.ledger.length === 0 ? <p className="font-mono-tech text-xs text-[var(--ink-muted)]">{t('genericXp.emptyHistory')}</p> : (
          <ul className="flex flex-col gap-1.5">
            {xp.ledger.map((entry) => (
              <li key={entry.id} className="p-2 border border-[var(--border-subtle)] rounded-[var(--radius-card)] bg-[var(--bg-card-alt)] flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 border border-[var(--border-color)] rounded-[var(--radius-pill)] font-mono-tech text-[10px] font-black tabular-nums">{entry.delta >= 0 ? `+${entry.delta}` : entry.delta} XP</span>
                  <span className="font-mono-tech text-xs text-[var(--ink-primary)]">{entry.label}</span>
                </div>
                <span className="font-mono-tech text-[10px] text-[var(--ink-muted)] tabular-nums">{entry.timestamp.slice(0, 16).replace('T', ' ')}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
