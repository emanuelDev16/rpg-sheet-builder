import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { RollLogEntry, SystemId } from '../core/sheetModel';
import { AppTranslations } from '../core/i18n';
import { RulesSearchPanel } from './RulesSearchPanel';

export type SidebarTab = 'logs' | 'rules';

interface RollLogSidebarProps {
  logs: RollLogEntry[];
  systemId: SystemId;
  systemName: string;
  t: AppTranslations['sidebar'];
  onQuickRoll: (expression: string) => void;
  onClearLogs: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
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
  t,
  onQuickRoll,
  onClearLogs,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('logs');
  const quickDice = useMemo(() => getQuickDicePresets(systemId), [systemId]);
  const [customExpr, setCustomExpr] = useState(systemId === 'wod' ? '5d10@6' : quickDice[0]);
  const mobileCloseBtnRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseMobileRef = useRef(onCloseMobile);
  onCloseMobileRef.current = onCloseMobile;

  useEffect(() => {
    setCustomExpr(systemId === 'wod' ? '5d10@6' : getQuickDicePresets(systemId)[0]);
  }, [systemId]);

  useEffect(() => {
    if (!isMobileOpen || !onCloseMobileRef.current) return;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const rafId = window.requestAnimationFrame(() => {
      mobileCloseBtnRef.current?.focus();
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseMobileRef.current?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus?.();
      previousFocusRef.current = null;
    };
  }, [isMobileOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customExpr.trim()) return;
    onQuickRoll(customExpr.trim());
  };

  const renderPanelContent = (showMobileClose: boolean) => (
    <>
      {/* Seletor superior do painel lateral */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-[var(--bg-header-strip)] border-b-[1.5px] border-[var(--border-ink)] shrink-0">
        <div role="tablist" aria-label={t.ariaAside} className="flex items-center gap-1.5 flex-1 min-w-0">
          <button
            type="button"
            role="tab"
            aria-selected={sidebarTab === 'logs'}
            onClick={() => setSidebarTab('logs')}
            className={`font-mono-tech mobile-touch-input px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase rounded-[4px] border border-[var(--border-ink)] whitespace-nowrap cursor-pointer transition-colors ${
              sidebarTab === 'logs'
                ? 'bg-[var(--accent-black)] text-[var(--ink-inverse)]'
                : 'bg-[var(--bg-card)] text-[var(--ink-primary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            {t.rollLogsTab}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={sidebarTab === 'rules'}
            onClick={() => setSidebarTab('rules')}
            className={`font-mono-tech mobile-touch-input px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase rounded-[4px] border border-[var(--border-ink)] whitespace-nowrap cursor-pointer transition-colors ${
              sidebarTab === 'rules'
                ? 'bg-[var(--accent-wine)] text-[var(--ink-inverse)]'
                : 'bg-[var(--bg-card)] text-[var(--ink-primary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            {t.rulesTab}
          </button>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {sidebarTab === 'logs' && logs.length > 0 && (
            <button
              type="button"
              onClick={onClearLogs}
              aria-label={t.clearLogsAria}
              title={t.clearLogsAria}
              className="mobile-touch-stepper p-1.5 rounded-[4px] text-[var(--ink-muted)] hover:text-[var(--accent-danger)] hover:bg-[var(--accent-danger-soft)] transition-colors cursor-pointer shrink-0 flex items-center justify-center"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}

          {showMobileClose && onCloseMobile && (
            <button
              ref={mobileCloseBtnRef}
              type="button"
              data-testid="mobile-drawer-close"
              aria-label="Fechar painel"
              onClick={onCloseMobile}
              className="cyber-btn-outline mobile-touch-stepper w-8 h-8 flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {sidebarTab === 'rules' ? (
        <RulesSearchPanel systemName={systemName} t={t} />
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
                aria-label={t.quickExprAria}
                value={customExpr}
                onChange={(e) => setCustomExpr(e.target.value)}
                placeholder={
                  systemId === 'wod' ? 'ex: 5d10@6 ou pool(wits+occult,6)' : 'ex: 1d20 + mod_str + prof'
                }
                className="cyber-input mobile-touch-input flex-1 min-w-0 px-2 py-1 text-xs font-semibold"
              />
              <button
                type="submit"
                className="cyber-roll-btn mobile-touch-input px-2.5 py-1 text-[11px] font-bold uppercase shrink-0 cursor-pointer"
              >
                {t.rollBtn}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {quickDice.map((die) => (
                <button
                  key={die}
                  type="button"
                  onClick={() => onQuickRoll(die)}
                  className="cyber-btn-outline flex-1 min-w-[54px] py-1 text-[10px] font-bold uppercase cursor-pointer"
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
                  {t.emptyLogs}
                </p>
              </div>
            ) : (
              logs.map((entry, idx) => {
                const poolOutcome = entry.isPoolRoll
                  ? entry.outcome ??
                    (entry.isFumble ? 'botch' : entry.total > 0 ? 'success' : 'failure')
                  : null;
                const diffThreshold = entry.difficulty ?? 6;

                return (
                  <article
                    key={entry.id}
                    data-testid={idx === 0 ? 'latest-roll-log-entry' : undefined}
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
                        <span
                          data-testid={idx === 0 ? 'latest-roll-total' : undefined}
                          className="font-display text-4xl font-extrabold leading-none tracking-tight text-[var(--ink-primary)] tabular-nums"
                        >
                          {entry.total}
                        </span>
                        {entry.isPoolRoll && poolOutcome !== 'botch' && (
                          <span className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-muted)]">
                            {entry.isSoak ? 'SOAKED' : entry.total === 1 ? 'SUC' : 'SUCS'}
                          </span>
                        )}
                      </div>

                      {entry.isPoolRoll ? (
                        poolOutcome === 'botch' ? (
                          <span className="font-mono-tech text-[10px] font-bold px-1.5 py-0.5 bg-[var(--accent-danger-soft)] text-[var(--accent-danger)] border border-[var(--accent-danger)] rounded-[3px] uppercase">
                            BOTCH!
                          </span>
                        ) : poolOutcome === 'failure' ? (
                          <span className="font-mono-tech text-[10px] font-bold px-1.5 py-0.5 bg-[var(--bg-header-strip)] text-[var(--ink-secondary)] border border-[var(--border-ink)] rounded-[3px] uppercase">
                            FAILURE
                          </span>
                        ) : entry.isCritical ? (
                          <span className="font-mono-tech text-[10px] font-bold px-1.5 py-0.5 bg-[var(--accent-wine)] text-[var(--ink-inverse)] border border-[var(--border-ink)] rounded-[3px] uppercase">
                            EXCEPTIONAL
                          </span>
                        ) : (
                          <span className="font-mono-tech text-[10px] font-bold px-1.5 py-0.5 bg-[var(--accent-black)] text-[var(--ink-inverse)] border border-[var(--border-ink)] rounded-[3px] uppercase">
                            SUCCESS
                          </span>
                        )
                      ) : (
                        <>
                          {entry.isCritical && (
                            <span className="font-mono-tech text-[10px] font-bold px-1.5 py-0.5 bg-[var(--accent-wine)] text-[var(--ink-inverse)] border border-[var(--border-ink)] rounded-[3px]">
                              CRÍTICO 20
                            </span>
                          )}
                          {entry.isFumble && (
                            <span className="font-mono-tech text-[10px] font-bold px-1.5 py-0.5 bg-[var(--accent-danger-soft)] text-[var(--accent-danger)] border border-[var(--accent-danger)] rounded-[3px]">
                              FALHA 1
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    {entry.isPoolRoll && entry.rolls && entry.rolls.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1 my-1.5" aria-label="Dice results">
                        {entry.rolls.map((dieVal, dIdx) => {
                          const isDoubledTen = Boolean(entry.specialty) && dieVal === 10;
                          const isSuccessDie = dieVal >= diffThreshold;
                          const isOne = dieVal === 1;
                          return (
                            <span
                              key={dIdx}
                              className={`font-mono-tech text-[10px] font-extrabold px-1.5 py-0.5 rounded-[3px] border tabular-nums leading-none ${
                                isDoubledTen
                                  ? 'bg-[var(--accent-wine)] text-[var(--ink-inverse)] border-[var(--border-ink)]'
                                  : isSuccessDie
                                    ? 'bg-[var(--accent-black)] text-[var(--ink-inverse)] border-[var(--border-ink)]'
                                    : isOne
                                      ? 'bg-[var(--accent-danger-soft)] text-[var(--accent-danger)] border-[var(--accent-danger)]'
                                      : 'bg-[var(--bg-card)] text-[var(--ink-muted)] border-[var(--border-ink)]/40'
                              }`}
                            >
                              {isDoubledTen ? '10×2' : dieVal}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {(entry.willpowerUsed ||
                      (entry.canceledOnes ?? 0) > 0 ||
                      (entry.doubledTensCount ?? 0) > 0) && (
                      <div className="flex flex-wrap items-center gap-1 mb-1">
                        {entry.willpowerUsed && (
                          <span
                            data-testid="roll-log-wp-chip"
                            className="font-mono-tech text-[9px] font-extrabold px-1.5 py-0.5 bg-[var(--accent-cream-badge)] text-[var(--accent-wine)] border border-[var(--accent-wine)] rounded-[3px] uppercase"
                          >
                            +1 WILLPOWER
                          </span>
                        )}
                        {(entry.doubledTensCount ?? 0) > 0 && (
                          <span className="font-mono-tech text-[9px] font-bold px-1.5 py-0.5 bg-[var(--bg-header-strip)] text-[var(--accent-wine)] border border-[var(--border-ink)]/60 rounded-[3px] uppercase">
                            SPEC 10s×2 ({entry.doubledTensCount})
                          </span>
                        )}
                        {(entry.canceledOnes ?? 0) > 0 && (
                          <span className="font-mono-tech text-[9px] font-bold px-1.5 py-0.5 bg-[var(--accent-danger-soft)] text-[var(--accent-danger)] border border-[var(--accent-danger)]/60 rounded-[3px] uppercase">
                            -{entry.canceledOnes} CANCELED BY 1s
                          </span>
                        )}
                      </div>
                    )}

                    <div className="font-mono-tech text-[11px] text-[var(--ink-secondary)] break-words">
                      {entry.breakdown}
                    </div>
                    <div className="font-mono-tech text-[10px] text-[var(--ink-muted)] mt-0.5">
                      {entry.formula}
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </>
      )}
    </>
  );

  return (
    <>
      {/* Desktop fixed right-hand sidebar (lg: 1024px+) */}
      <aside
        aria-label={t.ariaAside}
        className="no-print print:hidden hidden lg:flex lg:w-[290px] shrink-0 bg-[var(--bg-card)] border-l-2 border-[var(--border-ink)] flex-col min-h-0"
      >
        {renderPanelContent(false)}
      </aside>

      {/* Mobile slide-over drawer (< 1024px) */}
      {isMobileOpen && (
        <div
          className="no-print print:hidden fixed inset-0 z-40 lg:hidden flex justify-end bg-[#0B0B0B]/55"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              onCloseMobile?.();
            }
          }}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={t.ariaAside}
            data-testid="mobile-sidebar-drawer"
            className="mobile-drawer-panel w-[min(92vw,360px)] bg-[var(--bg-card)] border-l-2 border-[var(--border-ink)] shadow-[-6px_0_0_#0B0B0B] flex flex-col min-h-0"
          >
            {renderPanelContent(true)}
          </aside>
        </div>
      )}
    </>
  );
};
