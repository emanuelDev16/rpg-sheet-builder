import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { RollLogEntry, SystemId } from '../core/sheetModel';
import { AppLanguage, AppTranslations } from '../core/i18n';
import { RulesSearchPanel } from './RulesSearchPanel';

export type SidebarTab = 'logs' | 'rules';

interface RollLogSidebarProps {
  logs: RollLogEntry[];
  systemId: SystemId;
  systemName: string;
  language?: AppLanguage;
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
  language = 'pt-BR',
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
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-[var(--bg-strip)] border-b-[length:var(--border-width)] border-[var(--border-color)] shrink-0">
        <div role="tablist" aria-label={t.ariaAside} className="flex items-center gap-1.5 flex-1 min-w-0">
          <button
            type="button"
            role="tab"
            aria-selected={sidebarTab === 'logs'}
            onClick={() => setSidebarTab('logs')}
            className={`font-mono-tech mobile-touch-input px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase rounded-[var(--radius-pill)] border border-[var(--border-color)] whitespace-nowrap cursor-pointer transition-colors ${
              sidebarTab === 'logs'
                ? 'bg-[var(--accent-black)] text-[var(--accent-contrast)]'
                : 'bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
            }`}
          >
            {t.rollLogsTab}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={sidebarTab === 'rules'}
            onClick={() => setSidebarTab('rules')}
            className={`font-mono-tech mobile-touch-input px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase rounded-[var(--radius-pill)] border border-[var(--border-color)] whitespace-nowrap cursor-pointer transition-colors ${
              sidebarTab === 'rules'
                ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)]'
                : 'bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
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
              className="mobile-touch-stepper p-1.5 rounded-[var(--radius-pill)] text-[var(--ink-muted)] hover:text-[var(--accent-danger)] hover:bg-[var(--accent-danger-soft)] transition-colors cursor-pointer shrink-0 flex items-center justify-center"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}

          {showMobileClose && onCloseMobile && (
            <button
              ref={mobileCloseBtnRef}
              type="button"
              data-testid="mobile-drawer-close"
              aria-label={t.t('sidebar.closePanelAria')}
              onClick={onCloseMobile}
              className="cyber-btn-outline mobile-touch-stepper min-h-[36px] min-w-[36px] w-8 h-8 flex items-center justify-center cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {sidebarTab === 'rules' ? (
        <RulesSearchPanel
          systemId={systemId}
          systemName={systemName}
          language={language}
          t={t}
        />
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
                  systemId === 'wod'
                    ? t.t('sidebar.quickExprPlaceholderWod')
                    : t.t('sidebar.quickExprPlaceholderDefault')
                }
                className="cyber-input mobile-touch-input min-h-[36px] flex-1 min-w-0 px-2 py-1 text-xs font-semibold"
              />
              <button
                type="submit"
                className="cyber-roll-btn mobile-touch-input min-h-[36px] px-2.5 py-1 text-[11px] font-bold uppercase shrink-0 cursor-pointer"
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
                  className="cyber-btn-outline min-h-[36px] flex-1 min-w-[54px] py-1 text-[10px] font-bold uppercase cursor-pointer"
                >
                  {die}
                </button>
              ))}
            </div>
          </form>

          {/* Lista de resultados */}
          <div className="p-3 flex flex-col gap-2.5 overflow-y-auto flex-1">
            {logs.length === 0 ? (
              <div className="p-4 border-[length:var(--border-width)] border-dashed border-[var(--border-color)]/40 rounded-[var(--radius-card)] text-center">
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
                    className={`p-3 rounded-[var(--radius-card)] border-[length:var(--border-width)] border-[var(--border-color)] transition-colors ${
                      idx === 0 ? 'bg-[var(--bg-card)] shadow-[var(--shadow-btn)]' : 'bg-[var(--bg-card-alt)]'
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
                            {entry.isSoak
                              ? t.t('sidebar.roll.soaked')
                              : entry.total === 1
                                ? t.t('sidebar.roll.sucSingular')
                                : t.t('sidebar.roll.sucPlural')}
                          </span>
                        )}
                      </div>

                      {entry.isPoolRoll ? (
                        poolOutcome === 'botch' ? (
                          <span className="font-mono-tech text-[10px] font-bold px-1.5 py-0.5 bg-[var(--accent-danger-soft)] text-[var(--accent-danger)] border border-[var(--accent-danger)] rounded-[var(--radius-pill)] uppercase">
                            {t.t('sidebar.roll.botch')}
                          </span>
                        ) : poolOutcome === 'failure' ? (
                          <span className="font-mono-tech text-[10px] font-bold px-1.5 py-0.5 bg-[var(--bg-strip)] text-[var(--text-secondary)] border border-[var(--border-color)] rounded-[var(--radius-pill)] uppercase">
                            {t.t('sidebar.roll.failure')}
                          </span>
                        ) : entry.isCritical ? (
                          <span className="font-mono-tech text-[10px] font-bold px-1.5 py-0.5 bg-[var(--accent-primary)] text-[var(--accent-contrast)] border border-[var(--border-color)] rounded-[var(--radius-pill)] uppercase">
                            {t.t('sidebar.roll.exceptional')}
                          </span>
                        ) : (
                          <span className="font-mono-tech text-[10px] font-bold px-1.5 py-0.5 bg-[var(--accent-black)] text-[var(--accent-contrast)] border border-[var(--border-color)] rounded-[var(--radius-pill)] uppercase">
                            {t.t('sidebar.roll.success')}
                          </span>
                        )
                      ) : (
                        <>
                          {entry.isCritical && (
                            <span className="font-mono-tech text-[10px] font-bold px-1.5 py-0.5 bg-[var(--accent-primary)] text-[var(--accent-contrast)] border border-[var(--border-color)] rounded-[var(--radius-pill)]">
                              {t.t('sidebar.roll.crit20')}
                            </span>
                          )}
                          {entry.isFumble && (
                            <span className="font-mono-tech text-[10px] font-bold px-1.5 py-0.5 bg-[var(--accent-danger-soft)] text-[var(--accent-danger)] border border-[var(--accent-danger)] rounded-[var(--radius-pill)]">
                              {t.t('sidebar.roll.fumble1')}
                            </span>
                          )}
                        </>
                      )}
                    </div>

                    {entry.isPoolRoll && entry.rolls && entry.rolls.length > 0 && (
                      <div
                        className="flex flex-wrap items-center gap-1 my-1.5"
                        aria-label={t.t('sidebar.diceResultsAria')}
                      >
                        {entry.rolls.map((dieVal, dIdx) => {
                          const isDoubledTen = Boolean(entry.specialty) && dieVal === 10;
                          const isSuccessDie = dieVal >= diffThreshold;
                          const isOne = dieVal === 1;
                          return (
                            <span
                              key={dIdx}
                              className={`font-mono-tech text-[10px] font-extrabold px-1.5 py-0.5 rounded-[var(--radius-pill)] border tabular-nums leading-none ${
                                isDoubledTen
                                  ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-color)]'
                                  : isSuccessDie
                                    ? 'bg-[var(--accent-black)] text-[var(--accent-contrast)] border-[var(--border-color)]'
                                    : isOne
                                      ? 'bg-[var(--accent-danger-soft)] text-[var(--accent-danger)] border-[var(--accent-danger)]'
                                      : 'bg-[var(--bg-card)] text-[var(--ink-muted)] border-[var(--border-color)]/40'
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
                            className="font-mono-tech text-[9px] font-extrabold px-1.5 py-0.5 bg-[var(--accent-cream-badge)] text-[var(--accent-wine)] border border-[var(--accent-wine)] rounded-[var(--radius-pill)] uppercase"
                          >
                            {t.t('sidebar.roll.wpChip')}
                          </span>
                        )}
                        {(entry.doubledTensCount ?? 0) > 0 && (
                          <span className="font-mono-tech text-[9px] font-bold px-1.5 py-0.5 bg-[var(--bg-strip)] text-[var(--accent-wine)] border border-[var(--border-color)]/60 rounded-[var(--radius-pill)] uppercase">
                            {t.t('sidebar.roll.specChip', { count: entry.doubledTensCount ?? 0 })}
                          </span>
                        )}
                        {(entry.canceledOnes ?? 0) > 0 && (
                          <span className="font-mono-tech text-[9px] font-bold px-1.5 py-0.5 bg-[var(--accent-danger-soft)] text-[var(--accent-danger)] border border-[var(--accent-danger)]/60 rounded-[var(--radius-pill)] uppercase">
                            {t.t('sidebar.roll.canceledOnesChip', { count: entry.canceledOnes ?? 0 })}
                          </span>
                        )}
                      </div>
                    )}

                    {(() => {
                      if (!entry.isPoolRoll || !entry.rolls || entry.rolls.length === 0) {
                        return (
                          <>
                            <div className="font-mono-tech text-[11px] text-[var(--ink-secondary)] break-words">
                              {entry.breakdown}
                            </div>
                            <div className="font-mono-tech text-[10px] text-[var(--ink-muted)] mt-0.5">
                              {entry.formula}
                            </div>
                          </>
                        );
                      }

                      const detailParts: string[] = [];
                      if ((entry.doubledTensCount ?? 0) > 0) {
                        detailParts.push(
                          t.t('sidebar.roll.specChip', { count: entry.doubledTensCount ?? 0 }),
                        );
                      }
                      if ((entry.canceledOnes ?? 0) > 0) {
                        detailParts.push(
                          t.t('sidebar.roll.canceledOnesChip', { count: entry.canceledOnes ?? 0 }),
                        );
                      }
                      if (entry.willpowerUsed) {
                        detailParts.push(t.t('sidebar.roll.wpChip'));
                      }
                      const detailSuffix =
                        detailParts.length > 0 ? ` (${detailParts.join(' · ')})` : '';

                      const statusText =
                        poolOutcome === 'botch'
                          ? t.t('sidebar.roll.botch')
                          : poolOutcome === 'failure'
                            ? `${
                                entry.isSoak
                                  ? `0 ${t.t('sidebar.roll.soaked')}`
                                  : `0 ${t.t('sidebar.roll.sucPlural')}`
                              } · ${t.t('sidebar.roll.failure')}`
                            : entry.isSoak
                              ? `${entry.total} ${t.t('sidebar.roll.soaked')}`
                              : `${entry.total} ${
                                  entry.total === 1
                                    ? t.t('sidebar.roll.sucSingular')
                                    : t.t('sidebar.roll.sucPlural')
                                }`;

                      const localizedBreakdown = `${entry.rolls.length}d10[${entry.rolls.join(', ')}] ≥${diffThreshold}${detailSuffix} → ${statusText}`;
                      const extraFormulaTags = [
                        entry.specialty ? t.t('cards.pool.specShort') : null,
                        entry.willpowerUsed ? t.t('cards.pool.wpBadge') : null,
                        entry.isSoak ? t.t('sidebar.roll.soaked') : null,
                      ].filter(Boolean);
                      const localizedFormula =
                        extraFormulaTags.length > 0
                          ? `${entry.rolls.length}d10 (${t.t('cards.pool.diff')} ${diffThreshold} · ${extraFormulaTags.join(' · ')})`
                          : `${entry.rolls.length}d10 (${t.t('cards.pool.diff')} ${diffThreshold})`;

                      return (
                        <>
                          <div className="font-mono-tech text-[11px] text-[var(--ink-secondary)] break-words">
                            {localizedBreakdown}
                          </div>
                          <div className="font-mono-tech text-[10px] text-[var(--ink-muted)] mt-0.5">
                            {localizedFormula}
                          </div>
                        </>
                      );
                    })()}
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
        className="no-print print:hidden hidden lg:flex lg:w-[290px] shrink-0 bg-[var(--bg-card)] border-l-[length:var(--border-width)] border-[var(--border-color)] flex-col min-h-0"
      >
        {renderPanelContent(false)}
      </aside>

      {/* Mobile slide-over drawer (< 1024px) */}
      {isMobileOpen && (
        <div
          className="no-print print:hidden fixed inset-0 z-40 lg:hidden flex justify-end bg-[var(--overlay-backdrop)]"
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
            className="mobile-drawer-panel w-[min(92vw,360px)] bg-[var(--bg-card)] border-l-[length:var(--border-width)] border-[var(--border-color)] shadow-[var(--shadow-drawer)] flex flex-col min-h-0"
          >
            {renderPanelContent(true)}
          </aside>
        </div>
      )}
    </>
  );
};
