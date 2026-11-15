import React, { useEffect, useState } from 'react';
import { Check, HardDrive, RefreshCw, AlertTriangle } from 'lucide-react';
import { AppMode } from '../core/sheetModel';
import { formatRoomSyncIndicator, RoomSyncIndicatorState } from '../core/roomSync';
import { PersistenceSnapshot } from '../core/sheetsStore';
import { AppTranslations } from '../core/i18n';

interface StatusBarProps {
  mode: AppMode;
  errorCount: number;
  firstError?: string;
  totalCargoWeight: number;
  availableXp: number;
  rollCount: number;
  flashMessage?: string | null;
  roomSyncState: RoomSyncIndicatorState;
  persistenceState?: PersistenceSnapshot;
  t: AppTranslations['statusBar'];
  onForceRoomSync: () => void;
  onFlushSave?: () => void;
}

const DEFAULT_PERSISTENCE_STATE: PersistenceSnapshot = {
  status: 'idle',
  lastSavedAtMillis: null,
  errorMessage: null,
  pendingCount: 0,
};

export const StatusBar: React.FC<StatusBarProps> = ({
  mode,
  errorCount,
  firstError,
  totalCargoWeight,
  availableXp,
  rollCount,
  flashMessage,
  roomSyncState,
  persistenceState = DEFAULT_PERSISTENCE_STATE,
  t,
  onForceRoomSync,
  onFlushSave,
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

  const persistenceLabel =
    persistenceState.status === 'saving'
      ? t.persistenceSaving
      : persistenceState.status === 'saved'
        ? t.persistenceSaved
        : persistenceState.status === 'error'
          ? t.persistenceError
          : t.persistenceIdle;

  const persistenceTooltip =
    persistenceState.status === 'error' && persistenceState.errorMessage
      ? persistenceState.errorMessage
      : persistenceState.lastSavedAtMillis
        ? `${persistenceLabel} (${new Date(persistenceState.lastSavedAtMillis).toLocaleTimeString()})`
        : persistenceLabel;

  return (
    <footer
      className="no-print print:hidden statusbar-root flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 sm:gap-3 px-4 lg:h-[34px] bg-[var(--bg-card)] border-t-2 border-[var(--border-ink)] font-mono-tech text-[11px] shrink-0 overflow-hidden"
      aria-label={t.ariaFooter}
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
            {t.formulaErrors(errorCount, firstError)}
          </span>
        ) : (
          <span className="font-semibold text-[var(--ink-primary)] truncate">
            {t.ready}
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
        {mode === 'edicao' ? t.schemaUnlocked : t.accessGranted}
      </div>

      <div className="flex items-center gap-2.5 sm:gap-3 text-[var(--ink-secondary)] font-semibold whitespace-nowrap shrink-0">
        <span className="hidden md:inline">
          {t.cargo} {totalCargoWeight} KG
        </span>
        <span className="hidden md:inline" aria-hidden="true">
          ·
        </span>
        <span className="text-[var(--accent-wine)] font-bold tabular-nums">XP: {availableXp}</span>
        <span aria-hidden="true">·</span>
        <span>
          {t.logs} {rollCount}
        </span>
        <span aria-hidden="true">·</span>
        <button
          type="button"
          data-testid="persistence-status-indicator"
          data-persistence-status={persistenceState.status}
          onClick={onFlushSave}
          disabled={!onFlushSave}
          title={persistenceTooltip}
          aria-label={t.persistenceAria(persistenceLabel)}
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 border text-[10px] font-mono-tech font-bold tracking-wide uppercase tabular-nums transition-colors ${
            onFlushSave ? 'cursor-pointer' : 'cursor-default'
          } ${
            persistenceState.status === 'error'
              ? 'bg-[var(--accent-danger-soft)] border-[var(--accent-danger)] text-[var(--accent-danger)] shadow-[2px_2px_0_var(--border-ink)]'
              : persistenceState.status === 'saving'
                ? 'bg-[var(--accent-cream-badge)] border-[var(--border-ink)] text-[var(--accent-wine)] shadow-[2px_2px_0_var(--border-ink)]'
                : persistenceState.status === 'saved'
                  ? 'bg-[var(--bg-card)] border-[var(--border-ink)] text-[var(--ink-primary)]'
                  : 'bg-[var(--bg-card-alt)] border-[var(--border-ink)]/45 text-[var(--ink-secondary)]'
          }`}
        >
          {persistenceState.status === 'error' ? (
            <AlertTriangle className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />
          ) : persistenceState.status === 'saved' ? (
            <Check className="w-2.5 h-2.5 shrink-0 text-[var(--accent-wine)]" aria-hidden="true" />
          ) : (
            <HardDrive
              className={`w-2.5 h-2.5 shrink-0 ${
                persistenceState.status === 'saving' ? 'animate-pulse text-[var(--accent-wine)]' : ''
              }`}
              aria-hidden="true"
            />
          )}
          <span>{persistenceLabel}</span>
        </button>
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

