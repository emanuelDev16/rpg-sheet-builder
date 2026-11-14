import React from 'react';
import { AppMode, SYSTEM_OPTIONS, SystemId } from '../core/sheetModel';

interface TopBarProps {
  systemCode: string;
  activeSystemId: SystemId;
  mode: AppMode;
  onChangeSystemCode: (nextCode: string) => void;
  onSwitchSystem: (systemId: SystemId) => void;
  onModeChange: (mode: AppMode) => void;
  onNewSheet: () => void;
  onOpenModal: () => void;
  onSaveModal: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  systemCode,
  activeSystemId,
  mode,
  onChangeSystemCode,
  onSwitchSystem,
  onModeChange,
  onNewSheet,
  onOpenModal,
  onSaveModal,
}) => {
  return (
    <header
      className="flex flex-wrap items-center justify-between gap-4 px-5 py-3 bg-[var(--bg-card)] border-b-2 border-[var(--border-ink)] shrink-0"
      aria-label="Barra superior técnica"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span
          className="font-mono-tech text-xs font-bold px-2 py-1 bg-[var(--accent-black)] text-[var(--ink-inverse)] rounded-[4px] select-none shrink-0"
          aria-hidden="true"
        >
          +
        </span>
        {mode === 'edicao' ? (
          <input
            type="text"
            aria-label="Identificador do sistema"
            value={systemCode}
            onChange={(e) => onChangeSystemCode(e.target.value)}
            className="cyber-input px-2.5 py-1 text-xs font-bold uppercase tracking-wider w-[280px] max-w-full"
          />
        ) : (
          <h1 className="font-mono-tech text-xs sm:text-sm font-bold tracking-wider text-[var(--ink-primary)] uppercase truncate">
            {systemCode}
          </h1>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2.5 shrink-0">
        <div className="flex items-center gap-1.5">
          <label
            htmlFor="system-switcher-select"
            className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-muted)] hidden xl:inline whitespace-nowrap"
          >
            SISTEMA:
          </label>
          <select
            id="system-switcher-select"
            aria-label="Trocar sistema de RPG"
            value={activeSystemId}
            onChange={(e) => onSwitchSystem(e.target.value as SystemId)}
            className="cyber-input px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider cursor-pointer max-w-[210px]"
          >
            {SYSTEM_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.shortLabel}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNewSheet}
            className="cyber-btn-outline px-3 py-1.5 text-[11px] font-bold tracking-wider uppercase whitespace-nowrap shrink-0 cursor-pointer"
          >
            NOVA FICHA
          </button>
          <button
            type="button"
            onClick={onOpenModal}
            className="cyber-btn-outline px-3 py-1.5 text-[11px] font-bold tracking-wider uppercase whitespace-nowrap shrink-0 cursor-pointer"
          >
            ABRIR
          </button>
          <button
            type="button"
            onClick={onSaveModal}
            className="cyber-btn-outline px-3 py-1.5 text-[11px] font-bold tracking-wider uppercase whitespace-nowrap shrink-0 cursor-pointer"
          >
            SALVAR
          </button>
        </div>

        <div
          role="group"
          aria-label="Seletor de modo da ficha"
          className="inline-flex border-2 border-[var(--border-ink)] rounded-[var(--radius-control)] overflow-hidden bg-[var(--bg-card)] shrink-0"
        >
          <button
            type="button"
            aria-pressed={mode === 'jogo'}
            onClick={() => onModeChange('jogo')}
            className={`font-mono-tech px-3 py-1.5 text-[11px] font-bold tracking-wider uppercase whitespace-nowrap shrink-0 cursor-pointer transition-colors duration-75 ${
              mode === 'jogo'
                ? 'bg-[var(--accent-black)] text-[var(--ink-inverse)]'
                : 'bg-[var(--bg-card)] text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
            }`}
          >
            MODO JOGO
          </button>
          <button
            type="button"
            aria-pressed={mode === 'edicao'}
            onClick={() => onModeChange('edicao')}
            className={`font-mono-tech px-3 py-1.5 text-[11px] font-bold tracking-wider uppercase whitespace-nowrap shrink-0 border-l-2 border-[var(--border-ink)] cursor-pointer transition-colors duration-75 ${
              mode === 'edicao'
                ? 'bg-[var(--accent-wine)] text-[var(--ink-inverse)]'
                : 'bg-[var(--bg-card)] text-[var(--ink-muted)] hover:text-[var(--ink-primary)]'
            }`}
          >
            MODO EDIÇÃO
          </button>
        </div>
      </div>
    </header>
  );
};
