import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { CharacterSheetState, RollLogEntry, RulePreset, SystemId } from '../core/sheetModel';
import { AppLanguage, AppTranslations } from '../core/i18n';
import { localizeFieldRollLabel } from '../core/presetI18n';
import { isOfficialVampireSheet } from '../core/wodSkillsCatalog';
import { type WodComposedRollRequest } from '../utils/wodPoolComposer';
import { RulesSearchPanel } from './RulesSearchPanel';
import { WodPoolComposer } from './WodPoolComposer';
import { useFocusTrap } from '../utils/useFocusTrap';

export type SidebarTab = 'logs' | 'rules';

interface RollLogSidebarProps {
  logs: RollLogEntry[];
  sheet?: CharacterSheetState;
  systemId: SystemId;
  rulePreset?: RulePreset;
  systemName: string;
  language?: AppLanguage;
  woundPenalty?: number;
  isWillpowerImpaired?: boolean;
  bloodPotency?: number;
  bloodSurge?: boolean;
  bloodSurgeBonus?: number;
  currentWillpower?: number;
  currentHunger?: number;
  t: AppTranslations['sidebar'];
  rerollArmedLogId?: string | null;
  canWillpowerReroll?: boolean;
  onArmWillpowerReroll?: (logId: string) => void;
  onWillpowerReroll?: (logId: string, indices: number[]) => void;
  onCancelReroll?: () => void;
  onRollComposedPool?: (request: WodComposedRollRequest) => void;
  onQuickRoll: (expression: string) => void;
  onClearLogs: () => void;
  requestedTab?: SidebarTab;
  requestedTabSeq?: number;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export interface RollDiceChipsProps {
  entry: RollLogEntry;
  t: AppTranslations['sidebar'];
  isRerollArmed?: boolean;
  selectedRerollIndices?: number[];
  onToggleRerollIndex?: (idx: number) => void;
  testIdPrefix?: string;
}

export const RollDiceChips: React.FC<RollDiceChipsProps> = ({
  entry,
  t,
  isRerollArmed = false,
  selectedRerollIndices = [],
  onToggleRerollIndex,
  testIdPrefix,
}) => {
  if (!entry.isPoolRoll || !entry.rolls || entry.rolls.length === 0) {
    return null;
  }

  const diffThreshold = entry.isRemorseCheck ? 6 : (entry.difficulty ?? 6);
  const isV5Pool =
    entry.rulePreset === 'vampire-v5' && !entry.isRouseCheck && !entry.isRemorseCheck;
  const hungerCount = isV5Pool
    ? Math.min(entry.rolls.length, Math.max(0, entry.hungerDice ?? entry.hungerRolls?.length ?? 0))
    : 0;
  const normalCount = Math.max(0, entry.rolls.length - hungerCount);

  if (isV5Pool) {
    const normalDice = entry.rolls.slice(0, normalCount).map((val, dIdx) => ({ val, dIdx }));
    const hungerDice = entry.rolls
      .slice(normalCount)
      .map((val, offset) => ({ val, dIdx: normalCount + offset }));

    return (
      <div
        className="flex flex-col gap-1.5 my-1.5"
        aria-label={t.t('sidebar.diceResultsAria')}
      >
        {normalDice.length > 0 && (
          <div
            data-testid={testIdPrefix ? `${testIdPrefix}-normal-dice` : undefined}
            className="flex flex-wrap items-center gap-1"
          >
            <span className="font-mono-tech text-[9px] font-bold uppercase tracking-wider text-[var(--ink-muted)] mr-0.5">
              {t.t('sidebar.roll.normalDiceLabel')}:
            </span>
            {normalDice.map(({ val, dIdx }) => {
              const isSuccessDie = val >= 6;
              const isOne = val === 1;
              const isRerollPick = selectedRerollIndices.includes(dIdx);
              const normalClassName = `die-chip text-[10px] border ${
                isRerollPick
                  ? 'ring-2 ring-[var(--accent-primary)] bg-[var(--accent-cream-badge)] text-[var(--accent-wine)] border-[var(--accent-wine)]'
                  : isSuccessDie
                    ? 'bg-[var(--accent-black)] text-[var(--accent-contrast)] border-[var(--border-color)]'
                    : isOne
                      ? 'bg-[var(--accent-danger-soft)] text-[var(--accent-danger)] border-[var(--accent-danger)]'
                      : 'bg-[var(--bg-card)] text-[var(--ink-muted)] border-[var(--border-color)]/45'
              }`;

              if (isRerollArmed && onToggleRerollIndex) {
                return (
                  <button
                    key={dIdx}
                    type="button"
                    data-testid={`reroll-die-${dIdx}`}
                    aria-pressed={isRerollPick}
                    aria-label={t.t('sidebar.roll.normalDie', { value: val })}
                    onClick={() => onToggleRerollIndex(dIdx)}
                    className={`${normalClassName} min-h-[32px] min-w-[32px] px-2 cursor-pointer`}
                  >
                    {val}
                  </button>
                );
              }

              return (
                <span
                  key={dIdx}
                  aria-label={t.t('sidebar.roll.normalDie', { value: val })}
                  className={`${normalClassName} px-1.5 py-1`}
                >
                  {val}
                </span>
              );
            })}
          </div>
        )}

        {hungerDice.length > 0 && (
          <div
            data-testid={testIdPrefix ? `${testIdPrefix}-hunger-dice` : undefined}
            className="flex flex-wrap items-center gap-1.5"
          >
            <span className="font-mono-tech text-[9px] font-extrabold uppercase tracking-wider text-[var(--accent-wine)] mr-0.5">
              {t.t('sidebar.roll.hungerDiceLabel')}:
            </span>
            {hungerDice.map(({ val, dIdx }) => {
              const hungerHint =
                val === 10
                  ? t.t('sidebar.roll.hungerDieTenHint')
                  : val === 1
                    ? t.t('sidebar.roll.hungerDieOneHint')
                    : t.t('sidebar.roll.hungerDie', { value: val });
              const specialClass =
                val === 10
                  ? 'die-chip--hunger-ten'
                  : val === 1
                    ? 'die-chip--hunger-one'
                    : '';
              const faceText = val === 10 ? '10★' : val === 1 ? '1!' : String(val);

              if (isRerollArmed) {
                const blockedTitle = t.t('sidebar.roll.cannotRerollHunger');
                return (
                  <span
                    key={dIdx}
                    title={blockedTitle}
                    className="inline-flex cursor-not-allowed"
                  >
                    <button
                      type="button"
                      disabled
                      data-hunger-die="true"
                      data-testid={`reroll-hunger-die-${dIdx}`}
                      title={blockedTitle}
                      aria-label={`${hungerHint} — ${blockedTitle}`}
                      className={`die-chip die-chip--hunger ${specialClass} min-h-[32px] min-w-[36px] px-2 text-[10px] pointer-events-none`}
                    >
                      <span className="hunger-die-tag text-[8px] font-black uppercase" aria-hidden="true">
                        H
                      </span>
                      <span>{faceText}</span>
                    </button>
                  </span>
                );
              }

              return (
                <span
                  key={dIdx}
                  data-hunger-die="true"
                  role="img"
                  title={hungerHint}
                  aria-label={hungerHint}
                  className={`die-chip die-chip--hunger ${specialClass} px-1.5 py-1 text-[10px]`}
                >
                  <span className="hunger-die-tag text-[8px] font-black uppercase" aria-hidden="true">
                    H
                  </span>
                  <span>{faceText}</span>
                </span>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="flex flex-wrap items-center gap-1 my-1.5"
      aria-label={t.t('sidebar.diceResultsAria')}
    >
      {entry.rolls.map((dieVal, dIdx) => {
        const isDoubledTen = Boolean(entry.specialty) && dieVal === 10;
        const isSuccessDie = dieVal >= diffThreshold;
        const isOne = dieVal === 1;
        const isBpRerollDie = Boolean(
          entry.isRouseCheck && entry.rerolledIndices?.includes(dIdx),
        );
        const dieClassName = `die-chip text-[10px] px-1.5 py-1 border ${
          isDoubledTen
            ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-color)]'
            : isSuccessDie
              ? 'bg-[var(--accent-black)] text-[var(--accent-contrast)] border-[var(--border-color)]'
              : isOne
                ? 'bg-[var(--accent-danger-soft)] text-[var(--accent-danger)] border-[var(--accent-danger)]'
                : 'bg-[var(--bg-card)] text-[var(--ink-muted)] border-[var(--border-color)]/40'
        }`;

        return (
          <span
            key={dIdx}
            data-bp-reroll-die={isBpRerollDie ? 'true' : undefined}
            title={isBpRerollDie ? t.t('sidebar.roll.rouseBpRerollBadge') : undefined}
            className={dieClassName}
          >
            {isDoubledTen ? '10×2' : dieVal}
          </span>
        );
      })}
    </div>
  );
};

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
  sheet,
  systemId,
  rulePreset,
  systemName,
  language = 'pt-BR',
  woundPenalty = 0,
  isWillpowerImpaired = false,
  bloodPotency = 1,
  bloodSurge = false,
  bloodSurgeBonus = 2,
  currentWillpower = 0,
  currentHunger = 0,
  t,
  rerollArmedLogId = null,
  canWillpowerReroll = true,
  onArmWillpowerReroll,
  onWillpowerReroll,
  onCancelReroll,
  onRollComposedPool,
  onQuickRoll,
  onClearLogs,
  requestedTab,
  requestedTabSeq = 0,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>(requestedTab ?? 'logs');
  const quickDice = useMemo(() => getQuickDicePresets(systemId), [systemId]);
  const [customExpr, setCustomExpr] = useState(systemId === 'wod' ? '5d10@6' : quickDice[0]);
  const [selectedRerollIndices, setSelectedRerollIndices] = useState<number[]>([]);
  const mobileDrawerRef = useRef<HTMLElement>(null);
  const mobileCloseBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (requestedTab && requestedTabSeq > 0) {
      setSidebarTab(requestedTab);
    }
  }, [requestedTab, requestedTabSeq]);

  useEffect(() => {
    setSelectedRerollIndices([]);
    if (rerollArmedLogId) {
      setSidebarTab('logs');
    }
  }, [rerollArmedLogId]);

  useEffect(() => {
    setCustomExpr(systemId === 'wod' ? '5d10@6' : getQuickDicePresets(systemId)[0]);
  }, [systemId]);

  useFocusTrap(
    Boolean(isMobileOpen && onCloseMobile),
    mobileDrawerRef,
    onCloseMobile,
    mobileCloseBtnRef,
  );

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
          {sheet && isOfficialVampireSheet(systemId, rulePreset) && onRollComposedPool && (
            <WodPoolComposer
              sheet={sheet}
              rulePreset={rulePreset}
              language={language}
              woundPenalty={woundPenalty}
              isWillpowerImpaired={isWillpowerImpaired}
              bloodPotency={bloodPotency}
              bloodSurge={bloodSurge}
              bloodSurgeBonus={bloodSurgeBonus}
              currentWillpower={currentWillpower}
              currentHunger={currentHunger}
              t={t}
              onRollComposedPool={onRollComposedPool}
            />
          )}

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
                const isV5Pool =
                  Boolean(entry.isPoolRoll) &&
                  entry.rulePreset === 'vampire-v5' &&
                  !entry.isRouseCheck &&
                  !entry.isRemorseCheck;
                const v5Target = Math.max(1, Math.min(10, Math.round(entry.difficulty ?? 2)));
                const v5Margin =
                  typeof entry.margin === 'number' ? entry.margin : entry.total - v5Target;
                const v5Succeeded = entry.total >= v5Target;
                const v5HasHungerOne = (entry.hungerRolls ?? []).includes(1);
                const v5IsBestial =
                  isV5Pool &&
                  (Boolean(entry.bestialFailure) ||
                    (!v5Succeeded && v5HasHungerOne && (entry.rolls?.length ?? 0) > 0));
                const v5IsMessy = isV5Pool && Boolean(entry.messyCritical) && v5Succeeded;
                const v5IsCrit =
                  isV5Pool && Boolean(entry.isCritical) && v5Succeeded && !v5IsMessy;

                const poolOutcome = entry.isPoolRoll
                  ? isV5Pool
                    ? v5IsBestial
                      ? 'botch'
                      : v5Succeeded
                        ? 'success'
                        : 'failure'
                    : entry.outcome ??
                      (entry.isFumble ? 'botch' : entry.total > 0 ? 'success' : 'failure')
                  : null;
                const diffThreshold = entry.isRemorseCheck ? 6 : (entry.difficulty ?? 6);
                const hungerCount = entry.hungerDice ?? 0;
                const normalDiceCount = Math.max(0, (entry.rolls?.length ?? 0) - hungerCount);
                const isRerollArmed = rerollArmedLogId === entry.id;
                const isBpRouseReroll = Boolean(
                  entry.isRouseCheck && (entry.rerolledIndices?.length ?? 0) > 0,
                );
                const canArmThisRollReroll =
                  Boolean(onArmWillpowerReroll) &&
                  isV5Pool &&
                  !entry.isFrenzyRoll &&
                  !entry.isRemorseCheck &&
                  normalDiceCount > 0 &&
                  !entry.isWillpowerReroll &&
                  !isRerollArmed;

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
                        {localizeFieldRollLabel({ label: entry.label }, language)}
                      </span>
                      <span className="font-mono-tech text-[10px] text-[var(--ink-muted)] shrink-0">
                        {entry.timestamp}
                      </span>
                    </div>

                    <div className="flex items-baseline justify-between gap-2 my-1">
                      <div className="flex items-baseline gap-1.5 flex-wrap min-w-0">
                        <span
                          data-testid={idx === 0 ? 'latest-roll-total' : undefined}
                          className="font-display text-4xl font-extrabold leading-none tracking-tight text-[var(--ink-primary)] tabular-nums"
                        >
                          {entry.total}
                        </span>
                        {isV5Pool ? (
                          <span
                            data-testid={idx === 0 ? 'latest-roll-v5-score' : undefined}
                            className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-secondary)] tabular-nums"
                          >
                            {t.t('sidebar.roll.v5Score', {
                              total: entry.total,
                              target: v5Target,
                            })}
                          </span>
                        ) : (
                          entry.isPoolRoll &&
                          !entry.isRouseCheck &&
                          !entry.isRemorseCheck &&
                          poolOutcome !== 'botch' && (
                            <span className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-muted)]">
                              {entry.isSoak
                                ? t.t('sidebar.roll.soaked')
                                : entry.total === 1
                                  ? t.t('sidebar.roll.sucSingular')
                                  : t.t('sidebar.roll.sucPlural')}
                            </span>
                          )
                        )}
                      </div>

                      {entry.isPoolRoll ? (
                        entry.isRemorseCheck ? (
                          poolOutcome === 'success' && !entry.humanityLost ? (
                            <span
                              data-testid={idx === 0 ? 'latest-remorse-outcome' : undefined}
                              className="font-mono-tech text-[10px] font-bold px-1.5 py-0.5 bg-[var(--accent-black)] text-[var(--accent-contrast)] border border-[var(--border-color)] rounded-[var(--radius-pill)] uppercase shrink-0"
                            >
                              {t.t('sidebar.roll.remorsePass')}
                            </span>
                          ) : (
                            <span
                              data-testid={idx === 0 ? 'latest-remorse-outcome' : undefined}
                              className="font-mono-tech text-[10px] font-bold px-1.5 py-0.5 bg-[var(--accent-danger-soft)] text-[var(--accent-danger)] border border-[var(--accent-danger)] rounded-[var(--radius-pill)] uppercase shrink-0"
                            >
                              {t.t('sidebar.roll.remorseFail')}
                            </span>
                          )
                        ) : entry.isFrenzyRoll ? (
                          (isV5Pool ? v5Succeeded : poolOutcome === 'success') ? (
                            <span
                              data-testid={idx === 0 ? 'latest-frenzy-outcome' : undefined}
                              className="font-mono-tech text-[10px] font-bold px-1.5 py-0.5 bg-[var(--accent-black)] text-[var(--accent-contrast)] border border-[var(--border-color)] rounded-[var(--radius-pill)] uppercase shrink-0"
                            >
                              {t.t('sidebar.roll.frenzyResisted')}
                            </span>
                          ) : (
                            <span
                              data-testid={idx === 0 ? 'latest-frenzy-outcome' : undefined}
                              className="font-mono-tech text-[10px] font-bold px-1.5 py-0.5 bg-[var(--accent-danger-soft)] text-[var(--accent-danger)] border border-[var(--accent-danger)] rounded-[var(--radius-pill)] uppercase shrink-0"
                            >
                              {t.t('sidebar.roll.frenzyFailed')}
                            </span>
                          )
                        ) : entry.isRouseCheck ? (
                          poolOutcome === 'success' ? (
                            <span
                              data-testid={idx === 0 ? 'latest-rouse-outcome' : undefined}
                              className="font-mono-tech text-[10px] font-bold px-1.5 py-0.5 bg-[var(--accent-black)] text-[var(--accent-contrast)] border border-[var(--border-color)] rounded-[var(--radius-pill)] uppercase"
                            >
                              {t.t('sidebar.roll.rousePass')}
                            </span>
                          ) : (
                            <span
                              data-testid={idx === 0 ? 'latest-rouse-outcome' : undefined}
                              className="font-mono-tech text-[10px] font-bold px-1.5 py-0.5 bg-[var(--accent-danger-soft)] text-[var(--accent-danger)] border border-[var(--accent-danger)] rounded-[var(--radius-pill)] uppercase"
                            >
                              {t.t('sidebar.roll.rouseFail')}
                            </span>
                          )
                        ) : isV5Pool ? (
                          v5IsMessy ? (
                            <span
                              data-testid={idx === 0 ? 'latest-roll-messy-crit' : undefined}
                              className="v5-status-badge--messy text-[10px] font-extrabold px-2 py-0.5 rounded-[var(--radius-pill)] uppercase tracking-wider shrink-0"
                            >
                              {t.t('sidebar.roll.messyCritical')}
                            </span>
                          ) : v5IsBestial ? (
                            <span
                              data-testid={idx === 0 ? 'latest-roll-bestial-fail' : undefined}
                              className="v5-status-badge--bestial text-[10px] font-extrabold px-2 py-0.5 rounded-[var(--radius-pill)] uppercase tracking-wider shrink-0"
                            >
                              {t.t('sidebar.roll.bestialFailure')}
                            </span>
                          ) : !v5Succeeded ? (
                            <span
                              data-testid={idx === 0 ? 'latest-roll-v5-status' : undefined}
                              className="font-mono-tech text-[10px] font-bold px-1.5 py-0.5 bg-[var(--bg-strip)] text-[var(--text-secondary)] border border-[var(--border-color)] rounded-[var(--radius-pill)] uppercase shrink-0"
                            >
                              {t.t('sidebar.roll.failure')}
                            </span>
                          ) : v5IsCrit ? (
                            <span
                              data-testid={idx === 0 ? 'latest-roll-v5-status' : undefined}
                              className="font-mono-tech text-[10px] font-bold px-1.5 py-0.5 bg-[var(--accent-primary)] text-[var(--accent-contrast)] border border-[var(--border-color)] rounded-[var(--radius-pill)] uppercase shrink-0"
                            >
                              {t.t('sidebar.roll.exceptional')}
                            </span>
                          ) : (
                            <span
                              data-testid={idx === 0 ? 'latest-roll-v5-status' : undefined}
                              className="font-mono-tech text-[10px] font-bold px-1.5 py-0.5 bg-[var(--accent-black)] text-[var(--accent-contrast)] border border-[var(--border-color)] rounded-[var(--radius-pill)] uppercase shrink-0"
                            >
                              {t.t('sidebar.roll.success')}
                            </span>
                          )
                        ) : poolOutcome === 'botch' ? (
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

                    {isV5Pool && v5Succeeded && (
                      <div className="flex items-center gap-1.5 mb-1">
                        <span
                          data-testid={idx === 0 ? 'latest-roll-v5-margin' : undefined}
                          className="font-mono-tech text-[9px] font-extrabold px-1.5 py-0.5 bg-[var(--accent-cream-badge)] text-[var(--accent-wine)] border border-[var(--accent-wine)] rounded-[var(--radius-pill)] uppercase tabular-nums"
                        >
                          {t.t('sidebar.roll.margin', { margin: v5Margin })}
                        </span>
                      </div>
                    )}

                    <RollDiceChips
                      entry={entry}
                      t={t}
                      isRerollArmed={isRerollArmed && !entry.isRouseCheck}
                      selectedRerollIndices={selectedRerollIndices}
                      testIdPrefix={idx === 0 ? 'latest-roll' : undefined}
                      onToggleRerollIndex={(dIdx) =>
                        setSelectedRerollIndices((prev) => {
                          if (prev.includes(dIdx)) {
                            return prev.filter((item) => item !== dIdx);
                          }
                          if (prev.length >= 3) return prev;
                          return [...prev, dIdx];
                        })
                      }
                    />

                    {(entry.isFrenzyRoll ||
                      entry.isRemorseCheck ||
                      isBpRouseReroll ||
                      entry.willpowerUsed ||
                      entry.isWillpowerReroll ||
                      entry.isBloodSurge ||
                      (entry.hungerDice ?? 0) > 0 ||
                      (entry.critPairsCount ?? 0) > 0 ||
                      (entry.woundPenalty ?? 0) < 0 ||
                      (entry.canceledOnes ?? 0) > 0 ||
                      (entry.doubledTensCount ?? 0) > 0) && (
                      <div className="flex flex-wrap items-center gap-1 mb-1">
                        {isBpRouseReroll && (
                          <span
                            data-testid={
                              idx === 0 ? 'latest-roll-bp-reroll-badge' : 'roll-log-bp-reroll-badge'
                            }
                            className="font-mono-tech text-[9px] font-extrabold px-1.5 py-0.5 bg-[var(--accent-cream-badge)] text-[var(--accent-wine)] border border-[var(--accent-wine)] rounded-[var(--radius-pill)] uppercase"
                          >
                            {t.t('sidebar.roll.rouseBpRerollBadge')}
                          </span>
                        )}
                        {entry.isFrenzyRoll && (
                          <span
                            data-testid={idx === 0 ? 'latest-roll-frenzy-badge' : undefined}
                            className="roll-badge-frenzy text-[9px] font-extrabold px-1.5 py-0.5 rounded-[var(--radius-pill)] uppercase"
                          >
                            {entry.frenzyKind === 'rotschreck'
                              ? t.t('sidebar.roll.rotschreckBadge')
                              : t.t('sidebar.roll.frenzyBadge')}
                          </span>
                        )}
                        {entry.isRemorseCheck && (
                          <span
                            data-testid={idx === 0 ? 'latest-roll-remorse-badge' : undefined}
                            className="roll-badge-remorse text-[9px] font-extrabold px-1.5 py-0.5 rounded-[var(--radius-pill)] uppercase"
                          >
                            {t.t('sidebar.roll.remorseBadge')}
                          </span>
                        )}
                        {entry.willpowerUsed && !entry.isWillpowerReroll && (
                          <span
                            data-testid="roll-log-wp-chip"
                            className="font-mono-tech text-[9px] font-extrabold px-1.5 py-0.5 bg-[var(--accent-cream-badge)] text-[var(--accent-wine)] border border-[var(--accent-wine)] rounded-[var(--radius-pill)] uppercase"
                          >
                            {t.t('sidebar.roll.wpChip')}
                          </span>
                        )}
                        {entry.isWillpowerReroll && (
                          <span
                            data-testid="roll-log-wp-reroll-chip"
                            className="font-mono-tech text-[9px] font-extrabold px-1.5 py-0.5 bg-[var(--accent-cream-badge)] text-[var(--accent-wine)] border border-[var(--accent-wine)] rounded-[var(--radius-pill)] uppercase"
                          >
                            {t.t('sidebar.roll.wpRerollChip')}
                          </span>
                        )}
                        {(entry.critPairsCount ?? 0) > 0 && (
                          <span
                            data-testid="roll-log-crit-pairs-chip"
                            className="font-mono-tech text-[9px] font-extrabold px-1.5 py-0.5 bg-[var(--accent-primary)] text-[var(--accent-contrast)] border border-[var(--border-color)] rounded-[var(--radius-pill)] uppercase"
                          >
                            {t.t('sidebar.roll.critPairsChip', { count: entry.critPairsCount ?? 0 })}
                          </span>
                        )}
                        {(entry.hungerDice ?? 0) > 0 && (
                          <span
                            data-testid="roll-log-hunger-chip"
                            className="font-mono-tech text-[9px] font-bold px-1.5 py-0.5 bg-[var(--bg-strip)] text-[var(--accent-wine)] border border-[var(--accent-wine)] rounded-[var(--radius-pill)] uppercase"
                          >
                            {t.t('sidebar.roll.hungerChip', { count: entry.hungerDice ?? 0 })}
                          </span>
                        )}
                        {entry.isBloodSurge && (
                          <span
                            data-testid="roll-log-surge-chip"
                            className="font-mono-tech text-[9px] font-bold px-1.5 py-0.5 bg-[var(--accent-cream-badge)] text-[var(--accent-wine)] border border-[var(--accent-wine)] rounded-[var(--radius-pill)] uppercase"
                          >
                            {t.t('sidebar.roll.surgeChip')}
                          </span>
                        )}
                        {(entry.woundPenalty ?? 0) < 0 && (
                          <span
                            data-testid="roll-log-wound-chip"
                            className="font-mono-tech text-[9px] font-bold px-1.5 py-0.5 bg-[var(--accent-danger-soft)] text-[var(--accent-danger)] border border-[var(--accent-danger)]/70 rounded-[var(--radius-pill)] uppercase"
                          >
                            {t.t('sidebar.roll.woundChip', { penalty: entry.woundPenalty ?? 0 })}
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

                    {canArmThisRollReroll && (
                      <div className="my-1.5">
                        <button
                          type="button"
                          data-testid={
                            idx === 0
                              ? 'latest-roll-reroll-wp-btn'
                              : `roll-reroll-wp-btn-${entry.id}`
                          }
                          disabled={!canWillpowerReroll}
                          title={
                            canWillpowerReroll
                              ? t.t('sidebar.roll.rerollWillpower')
                              : t.t(
                                  rulePreset === 'vampire-v5'
                                    ? 'sidebar.roll.wpAllAggravated'
                                    : 'sidebar.roll.noWillpowerLeft',
                                )
                          }
                          onClick={() => onArmWillpowerReroll?.(entry.id)}
                          className="cyber-btn-outline min-h-[36px] w-full px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wider cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                          {t.t('sidebar.roll.rerollWillpower')}
                        </button>
                      </div>
                    )}

                    {isRerollArmed && !entry.isRouseCheck && (
                      <div
                        data-testid="v5-wp-reroll-panel"
                        className="my-2 p-2 bg-[var(--bg-header-strip)] border border-[var(--accent-wine)] rounded-[var(--radius-card)] flex flex-col gap-1.5"
                      >
                        <p className="font-mono-tech text-[10px] font-bold text-[var(--ink-primary)]">
                          {t.t('sidebar.roll.rerollPrompt')}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            data-testid="v5-wp-reroll-confirm"
                            disabled={selectedRerollIndices.length === 0}
                            onClick={() => onWillpowerReroll?.(entry.id, selectedRerollIndices)}
                            className="cyber-roll-btn min-h-[36px] sm:min-h-[30px] flex-1 px-2 py-1 text-[10px] font-extrabold uppercase cursor-pointer disabled:opacity-40"
                          >
                            {t.t('sidebar.roll.rerollConfirm', {
                              count: selectedRerollIndices.length,
                            })}
                          </button>
                          <button
                            type="button"
                            data-testid="v5-wp-reroll-cancel"
                            onClick={() => onCancelReroll?.()}
                            className="cyber-btn-outline min-h-[36px] sm:min-h-[30px] px-2 py-1 text-[10px] font-bold uppercase cursor-pointer"
                          >
                            {t.t('sidebar.roll.rerollCancel')}
                          </button>
                        </div>
                      </div>
                    )}

                    {(() => {
                      if (isV5Pool && entry.rolls && entry.rolls.length > 0) {
                        const scoreLabel = t.t('sidebar.roll.v5Score', {
                          total: entry.total,
                          target: v5Target,
                        });
                        const v5OutcomeText = v5IsMessy
                          ? `${scoreLabel} · ${t.t('sidebar.roll.margin', { margin: v5Margin })} · ${t.t('sidebar.roll.messyCritical')}`
                          : v5IsBestial
                            ? `${scoreLabel} · ${t.t('sidebar.roll.bestialFailure')}`
                            : !v5Succeeded
                              ? `${scoreLabel} · ${t.t('sidebar.roll.failure')}`
                              : v5IsCrit
                                ? `${scoreLabel} · ${t.t('sidebar.roll.margin', { margin: v5Margin })} · ${t.t('sidebar.roll.exceptional')}`
                                : `${scoreLabel} · ${t.t('sidebar.roll.margin', { margin: v5Margin })}`;
                        const v5FormulaLine = `${entry.rolls.length}d10 (${t.t('cards.pool.diffMeta')} ${v5Target}${
                          (entry.hungerDice ?? 0) > 0
                            ? ` · ${t.t('sidebar.roll.hungerShort', { count: entry.hungerDice ?? 0 })}`
                            : ''
                        })`;
                        return (
                          <>
                            <div
                              data-testid={idx === 0 ? 'latest-roll-breakdown' : undefined}
                              className="font-mono-tech text-[11px] text-[var(--ink-secondary)] break-words"
                            >
                              {v5OutcomeText}
                            </div>
                            <div className="font-mono-tech text-[10px] text-[var(--ink-muted)] mt-0.5">
                              {v5FormulaLine}
                            </div>
                          </>
                        );
                      }

                      if (
                        !entry.isPoolRoll ||
                        !entry.rolls ||
                        entry.rolls.length === 0 ||
                        entry.rulePreset === 'vampire-v5' ||
                        entry.isRouseCheck ||
                        entry.isRemorseCheck
                      ) {
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
                      if ((entry.woundPenalty ?? 0) < 0) {
                        detailParts.push(
                          t.t('sidebar.roll.woundChip', { penalty: entry.woundPenalty ?? 0 }),
                        );
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
            ref={mobileDrawerRef}
            role="dialog"
            aria-modal="true"
            aria-label={t.ariaAside}
            data-testid="mobile-sidebar-drawer"
            className="mobile-drawer-panel overscroll-contain w-[min(92vw,360px)] bg-[var(--bg-card)] border-l-[length:var(--border-width)] border-[var(--border-color)] shadow-[var(--shadow-drawer)] flex flex-col min-h-0"
          >
            {renderPanelContent(true)}
          </aside>
        </div>
      )}
    </>
  );
};
