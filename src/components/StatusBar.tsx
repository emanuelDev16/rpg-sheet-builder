import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { AppMode } from '../core/sheetModel';
import { formatRoomSyncIndicator, RoomSyncIndicatorState } from '../core/roomSync';

interface StatusBarProps {
  mode: AppMode;
  errorCount: number;
  firstError?: string;
  totalCargoWeight: number;
  availableXp: number;
  rollCount: number;
  flashMessage?: string | null;
  roomSyncState: RoomSyncIndicatorState;
  onForceRoomSync: () => void;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  mode,
  errorCount,
  firstError,
  totalCargoWeight,
  availableXp,
  rollCount,
  flashMessage,
  roomSyncState,
  onForceRoomSync,
}) => {
  const hasError = errorCount > 0;
  const [nowMillis, setNowMillis] = useState<number>(() => Date.now());

  useEffect(() => {
    setNowMillis(Date.now());
    const intervalId = window.setInterval(() => {
      setNowMillis(Date.now());
    }, 500);
    return () => window.clearInterval(intervalId);
  }, [roomSyncState.nextSyncAtMillis, roomSyncState.phase]);

  const syncDisplay = formatRoomSyncIndicator(roomSyncState, nowMillis);

  return (
    <footer
      className="no-print print:hidden flex items-center justify-between gap-3 px-4 h-[34px] bg-[var(--bg-card)] border-t-2 border-[var(--border-ink)] font-mono-tech text-[11px] shrink-0 overflow-hidden"
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

      <div className="flex items-center gap-2.5 sm:gap-3 text-[var(--ink-secondary)] font-semibold whitespace-nowrap shrink-0">
        <span className="hidden md:inline">//CARGA: {totalCargoWeight} KG</span>
        <span className="hidden md:inline" aria-hidden="true">
          ·
        </span>
        <span className="text-[var(--accent-wine)] font-bold tabular-nums">XP: {availableXp}</span>
        <span aria-hidden="true">·</span>
        <span>LOGS: {rollCount}</span>
        <span aria-hidden="true">·</span>
        <button
          type="button"
          data-testid="room-sync-indicator"
          data-sync-phase={roomSyncState.phase}
          onClick={onForceRoomSync}
          disabled={syncDisplay.isSyncing}
          title={syncDisplay.tooltip}
          aria-label={syncDisplay.ariaLabel}
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] border text-[10px] font-bold tracking-wide tabular-nums transition-colors cursor-pointer disabled:cursor-wait ${
            syncDisplay.isError
              ? 'bg-[var(--accent-danger-soft)] border-[var(--accent-danger)] text-[var(--accent-danger)]'
              : syncDisplay.isPending || syncDisplay.isSyncing
                ? 'bg-[var(--accent-cream-badge)] border-[var(--accent-wine)] text-[var(--accent-wine)]'
                : 'bg-[var(--bg-card-alt)] border-[var(--border-ink)]/35 text-[var(--ink-primary)] hover:border-[var(--border-ink)] hover:bg-[var(--bg-hover)]'
          }`}
        >
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
              syncDisplay.isError
                ? 'bg-[var(--accent-danger)]'
                : syncDisplay.isPending || syncDisplay.isSyncing
                  ? 'bg-[var(--accent-wine)] animate-pulse'
                  : 'bg-[var(--accent-wine)]'
            }`}
            aria-hidden="true"
          />
          <RefreshCw
            className={`w-2.5 h-2.5 shrink-0 ${syncDisplay.isSyncing ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          <span>{syncDisplay.label}</span>
        </button>
        <span className="text-[var(--ink-primary)] font-bold hidden sm:inline" aria-hidden="true">
          +
        </span>
      </div>
    </footer>
  );
};

