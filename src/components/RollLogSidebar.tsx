import React, { useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { RollLogEntry, SystemId } from '../core/sheetModel';
import { RulesSearchPanel } from './RulesSearchPanel';

export type SidebarTab = 'logs' | 'rules';

interface RollLogSidebarProps {
  logs: RollLogEntry[];
  systemId: SystemId;
  systemName: string;
  onQuickRoll: (expression: string) => void;
  onClearLogs: () => void;
}

function getQuickDicePresets(systemId: SystemId): string[] {
  if (systemId === 'wod') {
    return ['3d10@6', '5d10@6', '7d10@6', '1d10'];
  }
  if (systemId === 'cyberpunk') {
    return ['1d10', '1d10+8', '2d6', '3d6'];
  }
  if (systemId === 'blank') {
    return ['1d6', '2d6', '1d10', '1d20'];
  }
  return ['1d20', '1d20+5', '1d8+3', '2d6'];
}

export const RollLogSidebar: React.FC<RollLogSidebarProps> = ({
  logs,
  systemId,
  systemName,
  onQuickRoll,
  onClearLogs,
}) => {
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('logs');
  const quickDice = useMemo(() => getQuickDicePresets(systemId), [systemId]);
  const [customExpr, setCustomExpr] = useState(systemId === 'wod' ? '5d10@6' : quickDice[0]);

  useEffect(() => {
    setCustomExpr(systemId === 'wod' ? '5d10@6' : getQuickDicePresets(systemId)[0]);
  }, [systemId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customExpr.trim()) return;
    onQuickRoll(customExpr.trim());
  };

  return (
    <aside
      aria-label="Painel lateral de rolagens e consulta de regras"
      className="no-print print:hidden w-full lg:w-[290px] shrink-0 bg-[var(--bg-card)] border-t-2 lg:border-t-0 lg:border-l-2 border-[var(--border-ink)] flex flex-col min-h-0"
    >
      {/* Seletor superior do painel lateral */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-[var(--bg-header-strip)] border-b-[1.5px] border-[var(--border-ink)] shrink-0">
        <div role="tablist" aria-label="Modo do painel lateral" className="flex items-center gap-1.5 flex-1 min-w-0">
          <button
            type="button"
            role="tab"
            aria-selected={sidebarTab === 'logs'}
            onClick={() => setSidebarTab('logs')}
            className={`font-mono-tech px-2 py-1 text-[10px] font-bold tracking-wider uppercase rounded-[4px] border border-[var(--border-ink)] whitespace-nowrap cursor-pointer transition-colors ${
              sidebarTab === 'logs'
                ? 'bg-[var(--accent-black)] text-[var(--ink-inverse)]'
                : 'bg-[var(--bg-card)] text-[var(--ink-primary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            // LOG_ROLAGENS
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={sidebarTab === 'rules'}
            onClick={() => setSidebarTab('rules')}
            className={`font-mono-tech px-2 py-1 text-[10px] font-bold tracking-wider uppercase rounded-[4px] border border-[var(--border-ink)] whitespace-nowrap cursor-pointer transition-colors ${
              sidebarTab === 'rules'
                ? 'bg-[var(--accent-wine)] text-[var(--ink-inverse)]'
                : 'bg-[var(--bg-card)] text-[var(--ink-primary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            // REGRAS
          </button>
        </div>

        {sidebarTab === 'logs' && logs.length > 0 && (
          <button
            type="button"
            onClick={onClearLogs}
            aria-label="Limpar log de rolagens"
            title="Limpar histórico"
            className="p-1 rounded-[4px] text-[var(--ink-muted)] hover:text-[var(--accent-danger)] hover:bg-[var(--accent-danger-soft)] transition-colors cursor-pointer shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      {sidebarTab === 'rules' ? (
        <RulesSearchPanel systemName={systemName} />
      ) : (
        <>
          {/* Rolagem rápida manual */}
          <form
            onSubmit={handleSubmit}
            className="p-3 border-b-[1.5px] border-[var(--border-subtle)] bg-[var(--bg-card-alt)] flex flex-col gap-2 shrink-0"
          >
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                aria-label="Expressão rápida de dados"
                value={customExpr}
                onChange={(e) => setCustomExpr(e.target.value)}
                placeholder={
                  systemId === 'wod' ? 'ex: 5d10@6 ou pool(wits+occult,6)' : 'ex: 1d20 + mod_str + prof'
                }
                className="cyber-input flex-1 min-w-0 px-2 py-1 text-xs font-semibold"
              />
              <button
                type="submit"
                className="cyber-roll-btn px-2.5 py-1 text-[11px] font-bold uppercase shrink-0 cursor-pointer"
              >
                ROLAR ↗
              </button>
            </div>
            <div className="flex items-center gap-1">
              {quickDice.map((die) => (
                <button
                  key={die}
                  type="button"
                  onClick={() => onQuickRoll(die)}
                  className="cyber-btn-outline flex-1 py-0.5 text-[10px] font-bold uppercase cursor-pointer"
                >
                  {die}
                </button>
              ))}
            </div>
          </form>

          {/* Lista de resultados */}
          <div className="p-3 flex flex-col gap-2.5 overflow-y-auto flex-1">
            {logs.length === 0 ? (
              <div className="p-4 border-[1.5px] border-dashed border-[var(--border-ink)]/40 rounded-[var(--radius-control)] text-center">
                <p className="font-mono-tech text-[11px] text-[var(--ink-muted)]">
                  Nenhuma rolagem registrada. Clique em um botão de rolagem ou use a barra acima.
                </p>
              </div>
            ) : (
              logs.map((entry, idx) => (
                <article
                  key={entry.id}
                  className={`p-3 rounded-[var(--radius-control)] border-[1.5px] border-[var(--border-ink)] transition-colors ${
                    idx === 0 ? 'bg-[var(--bg-card)] shadow-[2px_2px_0_#5B0F18]' : 'bg-[var(--bg-card-alt)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-secondary)] truncate">
                      {entry.label}
                    </span>
                    <span className="font-mono-tech text-[10px] text-[var(--ink-muted)] shrink-0">
                      {entry.timestamp}
                    </span>
                  </div>

                  <div className="flex items-baseline justify-between gap-2 my-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-display text-4xl font-extrabold leading-none tracking-tight text-[var(--ink-primary)] tabular-nums">
                        {entry.total}
                      </span>
                      {entry.isPoolRoll && !entry.isFumble && (
                        <span className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-muted)]">
                          {entry.total === 1 ? 'SUC' : 'SUCS'}
                        </span>
                      )}
                    </div>
                    {entry.isCritical && (
                      <span className="font-mono-tech text-[10px] font-bold px-1.5 py-0.5 bg-[var(--accent-wine)] text-[var(--ink-inverse)] border border-[var(--border-ink)] rounded-[3px]">
                        {entry.isPoolRoll ? 'EXCEPCIONAL' : 'CRÍTICO 20'}
                      </span>
                    )}
                    {entry.isFumble && (
                      <span className="font-mono-tech text-[10px] font-bold px-1.5 py-0.5 bg-[var(--accent-danger-soft)] text-[var(--accent-danger)] border border-[var(--accent-danger)] rounded-[3px]">
                        {entry.isPoolRoll ? 'BOTCH!' : 'FALHA 1'}
                      </span>
                    )}
                  </div>

                  <div className="font-mono-tech text-[11px] text-[var(--ink-secondary)] break-words">
                    {entry.breakdown}
                  </div>
                  <div className="font-mono-tech text-[10px] text-[var(--ink-muted)] mt-0.5">
                    {entry.formula}
                  </div>
                </article>
              ))
            )}
          </div>
        </>
      )}
    </aside>
  );
};
