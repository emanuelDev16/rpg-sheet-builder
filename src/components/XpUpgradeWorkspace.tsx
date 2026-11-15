import React, { useMemo, useState } from 'react';
import { ArrowUpRight, RotateCcw } from 'lucide-react';
import { CharacterSheetState, XpUpgradeCategory } from '../core/sheetModel';
import { AppLanguage, AppTranslations, getTranslations } from '../core/i18n';
import {
  extractAllTraits,
  getAvailableXp,
  getCheapestBlockedUpgrade,
  getCostRulesSummary,
  getPossibleUpgrades,
  isWodSystem,
  normalizeXpState,
} from '../core/xpSystem';

interface XpUpgradeWorkspaceProps {
  sheet: CharacterSheetState;
  language?: AppLanguage;
  t?: AppTranslations['xp'];
  onAwardXp: (delta: number, reason: string) => { ok: boolean; error?: string };
  onUpgradeTrait: (fieldId: string) => void;
  onUndoLastUpgrade: () => void;
}

type CategoryFilter = 'all' | XpUpgradeCategory;

const DEFAULT_XP_T = getTranslations('pt-BR').xp;

export const XpUpgradeWorkspace: React.FC<XpUpgradeWorkspaceProps> = ({
  sheet,
  language = 'pt-BR',
  t = DEFAULT_XP_T,
  onAwardXp,
  onUpgradeTrait,
  onUndoLastUpgrade,
}) => {
  const [amountInput, setAmountInput] = useState('3');
  const [reasonInput, setReasonInput] = useState('');
  const [xpError, setXpError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

  const xpState = useMemo(() => normalizeXpState(sheet.xp), [sheet.xp]);
  const availableXp = useMemo(() => getAvailableXp(xpState), [xpState]);

  const allTraits = useMemo(() => extractAllTraits(sheet, language), [sheet, language]);
  const allPossible = useMemo(() => getPossibleUpgrades(sheet, 'all', language), [sheet, language]);
  const filteredPossible = useMemo(
    () =>
      categoryFilter === 'all'
        ? allPossible
        : allPossible.filter((item) => item.category === categoryFilter),
    [allPossible, categoryFilter],
  );

  const countsByCategory = useMemo(() => {
    const counts = { all: allPossible.length, attribute: 0, skill: 0, discipline: 0 };
    for (const item of allPossible) {
      counts[item.category] += 1;
    }
    return counts;
  }, [allPossible]);

  const cheapestBlocked = useMemo(
    () => getCheapestBlockedUpgrade(sheet, language),
    [sheet, language],
  );
  const costRulesSummary = useMemo(
    () => getCostRulesSummary(sheet, language),
    [sheet, language],
  );
  const isWod = useMemo(() => isWodSystem(sheet), [sheet]);
  const hasUndoableUpgrade = useMemo(
    () => xpState.ledger.some((entry) => entry.kind === 'upgrade'),
    [xpState.ledger],
  );

  // 12-block segmented utilization meter for spent vs earned XP
  const totalBlocks = 12;
  const spentRatio =
    xpState.totalEarned > 0 ? Math.min(1, xpState.spent / xpState.totalEarned) : 0;
  const filledBlocks = Math.round(spentRatio * totalBlocks);
  const spentPercent = Math.round(spentRatio * 100);

  const handleQuickAdjust = (delta: number, label: string) => {
    const res = onAwardXp(delta, label);
    if (!res.ok) {
      setXpError(res.error ?? t.t('xp.errAdjustXp'));
    } else {
      setXpError(null);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Number(amountInput);
    if (!Number.isFinite(parsed) || Math.round(parsed) === 0) {
      setXpError(t.t('xp.errZeroXp'));
      return;
    }
    const res = onAwardXp(Math.round(parsed), reasonInput);
    if (!res.ok) {
      setXpError(res.error ?? t.t('xp.errAdjustXp'));
      return;
    }
    setXpError(null);
    setReasonInput('');
  };

  const filterTabs = [
    { id: 'all' as const, label: t.filterAll },
    {
      id: 'attribute' as const,
      label: isWod ? t.t('xp.filterAttributes') : t.t('xp.filterAbilities'),
    },
    { id: 'skill' as const, label: t.t('xp.filterSkills') },
    {
      id: 'discipline' as const,
      label: isWod ? t.t('xp.filterDisciplines') : t.t('xp.filterPowers'),
    },
  ];
  const activeFilterLabel =
    filterTabs.find((tab) => tab.id === categoryFilter)?.label ?? t.filterAll;

  return (
    <div className="bento-print-grid grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
      {/* LEFT CARD: XP MONITOR */}
      <section className="bento-card" aria-label={t.monitorTitle}>
        <header className="bento-card-header">
          <div className="bento-card-header-title flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 min-w-0 flex-1">
            <span className="font-mono-tech text-[11px] font-bold text-[var(--accent-wine)] tracking-wider shrink-0">
              {t.monitorTag}
            </span>
            <h2 className="font-display text-lg sm:text-xl print:text-base font-extrabold tracking-wide uppercase text-[var(--ink-primary)] leading-tight break-words">
              {t.monitorTitle}
            </h2>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-center pt-0.5 sm:pt-0" aria-hidden="true">
            <span className="w-2.5 h-2.5 rounded-full border-[1.5px] border-[var(--border-ink)] bg-[var(--bg-card)]" />
            <span className="w-2.5 h-2.5 rounded-full border-[1.5px] border-[var(--border-ink)] bg-[var(--accent-wine)]" />
          </div>
        </header>

        <div className="bento-card-body p-4 flex flex-col gap-4">
          {/* 3-metric telemetry strip separated by hairline borders */}
          <div className="grid grid-cols-3 border-[1.5px] border-[var(--border-ink)] rounded-[var(--radius-control)] bg-[var(--bg-card-alt)] divide-x divide-[var(--border-ink)]">
            <div className="p-3 flex flex-col gap-0.5">
              <span className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-muted)]">
                {t.availableXp}
              </span>
              <span
                data-testid="xp-available"
                className="font-display text-4xl font-extrabold leading-none text-[var(--accent-wine)] tabular-nums"
              >
                {availableXp}
              </span>
            </div>
            <div className="p-3 flex flex-col gap-0.5">
              <span className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-muted)]">
                {t.totalEarned}
              </span>
              <span
                data-testid="xp-earned"
                className="font-display text-3xl font-extrabold leading-none text-[var(--ink-primary)] tabular-nums"
              >
                {xpState.totalEarned}
              </span>
            </div>
            <div className="p-3 flex flex-col gap-0.5">
              <span className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-muted)]">
                {t.totalSpent}
              </span>
              <span
                data-testid="xp-spent"
                className="font-display text-3xl font-extrabold leading-none text-[var(--ink-secondary)] tabular-nums"
              >
                {xpState.spent}
              </span>
            </div>
          </div>

          {/* Segmented XP allocation meter */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between font-mono-tech text-[11px] font-semibold">
              <span className="text-[var(--ink-secondary)] uppercase">{t.allocation}</span>
              <span className="text-[var(--ink-primary)] tabular-nums">
                {xpState.spent} / {xpState.totalEarned} {t.spentLabel} · {spentPercent}%
              </span>
            </div>
            <div
              className="seg-meter-track flex items-center gap-1"
              role="meter"
              aria-label={t.allocation}
              aria-valuemin={0}
              aria-valuemax={Math.max(1, xpState.totalEarned)}
              aria-valuenow={xpState.spent}
            >
              {Array.from({ length: totalBlocks }).map((_, i) => (
                <span
                  key={i}
                  className={`seg-block ${i < filledBlocks ? 'is-filled' : ''}`}
                />
              ))}
            </div>
          </div>

          {/* Quick XP grant & custom adjustment */}
          <div className="no-print print:hidden pt-3 border-t border-[var(--border-subtle)] flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-secondary)]">
                {t.quickAdjust}
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {[1, 3, 5].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => handleQuickAdjust(amt, t.t('xp.quickAwardLabel', { amount: amt }))}
                    className="cyber-btn-outline min-h-[36px] px-2.5 py-1 text-[11px] font-bold whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    +{amt} XP
                  </button>
                ))}
                <button
                  type="button"
                  disabled={availableXp <= 0}
                  onClick={() => handleQuickAdjust(-1, t.t('xp.quickAdjustLabel'))}
                  className="cyber-btn-outline min-h-[36px] px-2.5 py-1 text-[11px] font-bold whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                >
                  -1 XP
                </button>
              </div>
            </div>

            <form onSubmit={handleCustomSubmit} className="flex flex-wrap sm:flex-nowrap items-center gap-2">
              <input
                type="number"
                aria-label={t.availableXp}
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="cyber-input mobile-touch-input min-h-[36px] w-20 px-2.5 py-1.5 text-xs font-bold text-center shrink-0"
              />
              <input
                type="text"
                aria-label={t.notePlaceholder}
                value={reasonInput}
                onChange={(e) => setReasonInput(e.target.value)}
                placeholder={t.notePlaceholder}
                className="cyber-input mobile-touch-input min-h-[36px] flex-1 min-w-0 px-2.5 py-1.5 text-xs"
              />
              <button
                type="submit"
                className="cyber-roll-btn mobile-touch-input min-h-[36px] px-3 py-1.5 text-[11px] font-bold uppercase whitespace-nowrap shrink-0 cursor-pointer"
              >
                {t.addXpBtn}
              </button>
            </form>

            {xpError && (
              <div
                role="alert"
                className="p-2.5 border-[1.5px] border-[var(--accent-danger)] rounded-[var(--radius-control)] bg-[var(--accent-danger-soft)] font-mono-tech text-[11px] font-semibold text-[var(--accent-danger)] break-words"
              >
                {xpError}
              </div>
            )}
          </div>

          {/* XP Ledger */}
          <div className="pt-3 border-t border-[var(--border-subtle)] flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-secondary)]">
                {t.ledgerTitle} ({xpState.ledger.length})
              </span>
              {hasUndoableUpgrade && (
                <button
                  type="button"
                  onClick={onUndoLastUpgrade}
                  className="no-print print:hidden cyber-btn-outline min-h-[36px] px-2.5 py-1 text-[10px] font-bold uppercase inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" aria-hidden="true" />
                  <span>{t.undoLastUpgrade}</span>
                </button>
              )}
            </div>

            {xpState.ledger.length === 0 ? (
              <div className="p-3 border-[1.5px] border-dashed border-[var(--border-ink)]/35 rounded-[var(--radius-control)] font-mono-tech text-[11px] text-[var(--ink-muted)] text-center">
                {t.emptyLedger}
              </div>
            ) : (
              <ul className="max-h-[240px] overflow-y-auto print:max-h-none print:overflow-visible border border-[var(--border-subtle)] rounded-[var(--radius-control)] divide-y divide-[var(--border-subtle)] bg-[var(--bg-card)]">
                {xpState.ledger.map((entry) => (
                  <li
                    key={entry.id}
                    className="px-3 py-2 flex items-center justify-between gap-2 font-mono-tech text-[11px]"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[var(--ink-muted)] shrink-0">{entry.timestamp}</span>
                      <span className="font-semibold text-[var(--ink-primary)] truncate">
                        {entry.label}
                      </span>
                    </div>
                    <span
                      className={`font-bold whitespace-nowrap shrink-0 tabular-nums ${
                        entry.delta > 0
                          ? 'text-[var(--accent-wine)]'
                          : 'text-[var(--ink-primary)]'
                      }`}
                    >
                      {entry.delta > 0 ? `+${entry.delta} XP` : `${entry.delta} XP`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* RIGHT CARD: POSSIBLE TRAIT UPGRADES */}
      <section className="bento-card" aria-label={t.possibleTitle}>
        <header className="bento-card-header">
          <div className="bento-card-header-title flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 min-w-0 flex-1">
            <span className="font-mono-tech text-[11px] font-bold text-[var(--accent-wine)] tracking-wider shrink-0">
              {t.upgradesTag}
            </span>
            <h2 className="font-display text-lg sm:text-xl print:text-base font-extrabold tracking-wide uppercase text-[var(--ink-primary)] leading-tight break-words">
              {t.possibleTitle}
            </h2>
          </div>
          <span className="font-mono-tech text-[11px] font-bold text-[var(--accent-wine)] whitespace-nowrap shrink-0 self-start sm:self-center">
            {t.availableCount(allPossible.length)}
          </span>
        </header>

        <div className="bento-card-body p-4 flex flex-col gap-3">
          {/* Transparent cost rules line (unboxed metadata) */}
          <div className="font-mono-tech text-[10px] font-semibold text-[var(--ink-muted)] flex flex-wrap items-center gap-1.5">
            <span>{t.costRulesLabel}</span>
            {costRulesSummary.map((rule) => (
              <React.Fragment key={rule}>
                <span>{rule}</span>
                <span aria-hidden="true">·</span>
              </React.Fragment>
            ))}
            <span>{t.budgetLabel(availableXp)}</span>
          </div>

          {/* Interactive category filter tabs */}
          <div
            role="tablist"
            aria-label={t.possibleTitle}
            className="flex flex-wrap items-center gap-1.5"
          >
            {filterTabs.map((tab) => {
              const isSelected = categoryFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setCategoryFilter(tab.id)}
                  className={`font-mono-tech min-h-[36px] px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase rounded-[4px] border border-[var(--border-ink)] whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-[var(--accent-black)] text-[var(--ink-inverse)]'
                      : 'bg-[var(--bg-card)] text-[var(--ink-primary)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  {tab.label} ({countsByCategory[tab.id]})
                </button>
              );
            })}
          </div>

          {/* Filtered possible upgrades list */}
          {filteredPossible.length === 0 ? (
            <div className="p-5 border-[1.5px] border-dashed border-[var(--border-ink)]/40 rounded-[var(--radius-control)] bg-[var(--bg-card-alt)] flex flex-col gap-2 text-center">
              {allPossible.length > 0 && categoryFilter !== 'all' ? (
                <>
                  <p className="font-mono-tech text-xs font-bold text-[var(--ink-primary)] uppercase">
                    {t.t('xp.noUpgradeInCategory', {
                      category: activeFilterLabel,
                      xp: availableXp,
                    })}
                  </p>
                  <button
                    type="button"
                    onClick={() => setCategoryFilter('all')}
                    className="cyber-btn-outline min-h-[36px] self-center px-3 py-1 text-[11px] font-bold uppercase cursor-pointer"
                  >
                    {t.filterAll} ({allPossible.length})
                  </button>
                </>
              ) : allTraits.length === 0 ? (
                <p className="font-mono-tech text-xs text-[var(--ink-muted)]">
                  {t.t('xp.emptyTraits')}
                </p>
              ) : cheapestBlocked ? (
                <>
                  <p className="font-mono-tech text-xs font-bold text-[var(--ink-primary)] uppercase">
                    {t.t('xp.insufficientXpTitle')}
                  </p>
                  <p className="text-xs text-[var(--ink-secondary)] leading-relaxed">
                    {t.t('xp.insufficientXpDetail', {
                      available: availableXp,
                      label: cheapestBlocked.label,
                      from: cheapestBlocked.currentValue,
                      to: cheapestBlocked.nextValue,
                      cost: cheapestBlocked.cost,
                    })}
                  </p>
                </>
              ) : (
                <p className="font-mono-tech text-xs font-bold text-[var(--accent-wine)] uppercase">
                  {t.t('xp.maxReached')}
                </p>
              )}
            </div>
          ) : (
            <ul
              data-testid="possible-upgrades-list"
              className="max-h-[468px] overflow-y-auto print:max-h-none print:overflow-visible border-[1.5px] border-[var(--border-ink)] rounded-[var(--radius-control)] divide-y divide-[var(--border-subtle)] bg-[var(--bg-card)]"
            >
              {filteredPossible.map((trait) => (
                <li
                  key={trait.fieldId}
                  className="px-3.5 py-2 flex items-center justify-between gap-3 hover:bg-[var(--bg-card-alt)] transition-colors"
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-2 font-mono-tech text-[10px] text-[var(--ink-muted)]">
                      <span className="font-bold text-[var(--accent-wine)]">
                        {t.t(`xp.cat.${trait.category}`)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{trait.formulaLabel}</span>
                    </div>

                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono-tech text-xs font-bold text-[var(--ink-primary)] truncate print:whitespace-normal print:overflow-visible">
                        {trait.label}
                      </span>

                      <span className="font-mono-tech text-xs font-semibold text-[var(--ink-secondary)] whitespace-nowrap shrink-0 tabular-nums">
                        {trait.currentValue} → {trait.nextValue}
                      </span>

                      {trait.maxCap <= 5 && (
                        <span className="hidden sm:inline-flex items-center gap-0.5 shrink-0" aria-hidden="true">
                          {Array.from({ length: trait.maxCap }).map((_, idx) => {
                            const filled = idx < trait.currentValue;
                            const nextDot = idx === trait.currentValue;
                            return (
                              <span
                                key={idx}
                                className={`w-2 h-2 rounded-[2px] border ${
                                  filled
                                    ? 'bg-[var(--accent-wine)] border-[var(--accent-wine)]'
                                    : nextDot
                                      ? 'bg-[var(--accent-wine-soft)] border-[var(--accent-wine)] border-dashed'
                                      : 'bg-transparent border-[var(--border-ink)]/35'
                                }`}
                              />
                            );
                          })}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onUpgradeTrait(trait.fieldId)}
                    aria-label={t.t('xp.upgradeAria', {
                      label: trait.label,
                      from: trait.currentValue,
                      to: trait.nextValue,
                      cost: trait.cost,
                    })}
                    className="cyber-roll-btn min-h-[36px] px-3 py-1.5 text-[11px] font-bold uppercase inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer tabular-nums"
                  >
                    <span>{t.upgradeBtn(trait.cost)}</span>
                    <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
};
