import React from 'react';
import { AppMode } from '../core/sheetModel';

interface StatusBarProps {
  mode: AppMode;
  errorCount: number;
  firstError?: string;
  totalCargoWeight: number;
  availableXp: number;
  rollCount: number;
  flashMessage?: string | null;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  mode,
  errorCount,
  firstError,
  totalCargoWeight,
  availableXp,
  rollCount,
  flashMessage,
}) => {
  const hasError = errorCount > 0;

  return (
    <footer
      className="flex items-center justify-between gap-4 px-4 h-[34px] bg-[var(--bg-card)] border-t-2 border-[var(--border-ink)] font-mono-tech text-[11px] shrink-0 overflow-hidden"
      aria-label="Barra de status da ficha"
    >
      <div className="flex items-center gap-2 min-w-0 truncate">
        <span
          className={`inline-block w-2 h-2 rounded-full shrink-0 ${
            hasError ? 'bg-[var(--accent-danger)]' : 'bg-[var(--accent-wine)] border border-[var(--border-ink)]'
          }`}
          aria-hidden="true"
        />
        {flashMessage ? (
          <span className="font-bold text-[var(--accent-wine)] truncate">{flashMessage}</span>
        ) : hasError ? (
          <span className="font-bold text-[var(--accent-danger)] truncate">
            // STATUS: {errorCount} ERRO(S) DE FÓRMULA · {firstError}
          </span>
        ) : (
          <span className="font-semibold text-[var(--ink-primary)] truncate">
            // STATUS: PRONTO · SEM ERROS DE FÓRMULA
          </span>
        )}
      </div>

      <div
        className={`hidden sm:flex items-center justify-center px-6 h-full font-bold tracking-widest uppercase shrink-0 ${
          mode === 'edicao'
            ? 'bg-[var(--accent-black)] text-[var(--ink-inverse)] border-x-2 border-[var(--border-ink)]'
            : 'cyber-slant-pill'
        }`}
      >
        {mode === 'edicao' ? '> SCHEMA_UNLOCKED_' : '> ACCESS GRANTED_'}
      </div>

      <div className="flex items-center gap-3 text-[var(--ink-secondary)] font-semibold whitespace-nowrap shrink-0">
        <span>//CARGA: {totalCargoWeight} KG</span>
        <span aria-hidden="true">·</span>
        <span className="text-[var(--accent-wine)] font-bold tabular-nums">XP: {availableXp}</span>
        <span aria-hidden="true">·</span>
        <span>LOGS: {rollCount}</span>
        <span className="text-[var(--ink-primary)] font-bold" aria-hidden="true">
          +
        </span>
      </div>
    </footer>
  );
};
