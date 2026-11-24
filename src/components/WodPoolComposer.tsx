import React, { useEffect, useId, useMemo, useState } from 'react';
import { ArrowUpDown, ChevronDown, Dices, Minus, Plus, RotateCcw } from 'lucide-react';
import { AppLanguage, AppTranslations } from '../core/i18n';
import { CharacterSheetState } from '../core/sheetModel';
import {
  computeWodComposedPool,
  extractWodRollableTraits,
  WodComposerRulePreset,
  WodComposedRollRequest,
  WodRollableTrait,
  WodTraitGroup,
} from '../utils/wodPoolComposer';

export interface WodPoolComposerProps {
  sheet: CharacterSheetState;
  rulePreset: WodComposerRulePreset;
  language?: AppLanguage;
  woundPenalty?: number;
  isWillpowerImpaired?: boolean;
  bloodPotency?: number;
  bloodSurge?: boolean;
  bloodSurgeBonus?: number;
  currentWillpower?: number;
  currentHunger?: number;
  t: AppTranslations['sidebar'];
  onRollComposedPool: (request: WodComposedRollRequest) => void;
}

const PRIMARY_GROUP_ORDER: readonly WodTraitGroup[] = [
  'attributes',
  'skills',
  'disciplines',
  'virtues',
];

const SECONDARY_GROUP_ORDER: readonly WodTraitGroup[] = [
  'skills',
  'disciplines',
  'virtues',
  'attributes',
];

export const WodPoolComposer: React.FC<WodPoolComposerProps> = ({
  sheet,
  rulePreset,
  language = 'pt-BR',
  woundPenalty = 0,
  isWillpowerImpaired = false,
  bloodPotency = 1,
  bloodSurge = false,
  bloodSurgeBonus = 2,
  currentWillpower = 0,
  currentHunger = 0,
  t,
  onRollComposedPool,
}) => {
  const isV5 = rulePreset === 'vampire-v5';
  const minDiff = isV5 ? 1 : 2;
  const defaultDiff = isV5 ? 2 : 6;

  const headingId = useId();
  const panelId = useId();
  const primarySelectId = useId();
  const secondarySelectId = useId();
  const diffInputId = useId();

  const traits = useMemo(() => extractWodRollableTraits(sheet, language), [sheet, language]);

  const defaultPrimaryId =
    traits.attributes[0]?.id ?? traits.all[0]?.id ?? '';

  const [isOpen, setIsOpen] = useState(false);
  const [primaryId, setPrimaryId] = useState<string>(defaultPrimaryId);
  const [secondaryId, setSecondaryId] = useState<string>('');
  const [modifier, setModifier] = useState<number>(0);
  const [difficulty, setDifficulty] = useState<number>(defaultDiff);
  const [diffDraft, setDiffDraft] = useState<string>(String(defaultDiff));
  const [ignoreWoundPenalty, setIgnoreWoundPenalty] = useState<boolean>(false);
  const [specialty, setSpecialty] = useState<boolean>(false);
  const [useWillpower, setUseWillpower] = useState<boolean>(false);
  const [bloodSurgeActive, setBloodSurgeActive] = useState<boolean>(Boolean(bloodSurge));
  const [applyPowerBonus, setApplyPowerBonus] = useState<boolean>(true);

  // Keep selected trait IDs valid when switching sheets or removing fields
  useEffect(() => {
    if (traits.all.length === 0) {
      setPrimaryId('');
      setSecondaryId('');
      return;
    }
    if (!primaryId || !traits.all.some((item) => item.id === primaryId)) {
      setPrimaryId(traits.attributes[0]?.id ?? traits.all[0].id);
    }
    if (secondaryId && !traits.all.some((item) => item.id === secondaryId)) {
      setSecondaryId('');
    }
  }, [traits, primaryId, secondaryId]);

  // Reset edition-specific toggles and default difficulty when switching V20 <-> V5
  useEffect(() => {
    const nextDefault = isV5 ? 2 : 6;
    setDifficulty(nextDefault);
    setDiffDraft(String(nextDefault));
    setApplyPowerBonus(true);
    if (isV5) {
      setSpecialty(false);
      setUseWillpower(false);
    } else {
      setBloodSurgeActive(false);
    }
  }, [isV5]);

  // Reflect external sheet Blood Surge toggle when armed from Vital Status card
  useEffect(() => {
    if (isV5 && bloodSurge) {
      setBloodSurgeActive(true);
    } else if (!isV5) {
      setBloodSurgeActive(false);
    }
  }, [isV5, bloodSurge]);

  // Clear Willpower toggle if sheet Willpower drops to 0
  useEffect(() => {
    if (currentWillpower <= 0 && useWillpower) {
      setUseWillpower(false);
    }
  }, [currentWillpower, useWillpower]);

  const primaryTrait: WodRollableTrait | null = useMemo(
    () => traits.all.find((item) => item.id === primaryId) ?? traits.all[0] ?? null,
    [traits.all, primaryId],
  );
  const secondaryTrait: WodRollableTrait | null = useMemo(
    () => (secondaryId ? traits.all.find((item) => item.id === secondaryId) ?? null : null),
    [traits.all, secondaryId],
  );

  // Auto-suggest V20 specialty whenever selected traits change
  const suggestedSpecialty = Boolean(
    !isV5 && (primaryTrait?.specialty || secondaryTrait?.specialty),
  );
  const suggestedSpecialtyFocus =
    primaryTrait?.specialtyLabel ?? secondaryTrait?.specialtyLabel ?? null;

  useEffect(() => {
    if (!isV5) {
      setSpecialty(suggestedSpecialty);
    }
  }, [isV5, primaryTrait?.id, secondaryTrait?.id, suggestedSpecialty]);

  if (traits.all.length === 0) {
    return null;
  }

  const commitDifficulty = (nextVal: number) => {
    const clamped = Math.max(minDiff, Math.min(10, Math.round(nextVal)));
    setDifficulty(clamped);
    setDiffDraft(String(clamped));
  };

  const breakdown = computeWodComposedPool({
    rulePreset,
    primaryTrait,
    secondaryTrait,
    modifier,
    woundPenalty,
    isWillpowerImpaired,
    ignoreWoundPenalty,
    bloodSurgeActive: isV5 && bloodSurgeActive,
    bloodSurgeBonus,
    bloodPotency,
    applyPowerBonus,
    hunger: currentHunger,
    difficulty,
    specialty,
    useWillpower,
    willpowerAvailable: currentWillpower,
    labels: {
      diffTn: t.t('poolComposer.diffShortV20'),
      diffMeta: t.t('poolComposer.diffShortV5'),
      hungerWord: t.t('poolComposer.hungerWord'),
      specTag: t.t('cards.pool.specShort'),
      wpTag: t.t('cards.pool.wpBadge'),
      powerTag: t.t('poolComposer.powerBonusTag'),
    },
  });

  const groupLabels: Record<WodTraitGroup, string> = {
    attributes: t.t('poolComposer.group.attributes'),
    skills: t.t('poolComposer.group.skills'),
    disciplines: t.t('poolComposer.group.disciplines'),
    virtues: t.t('poolComposer.group.virtues'),
  };

  const handleSwapTraits = () => {
    if (!secondaryTrait) return;
    const prevPrimary = primaryTrait?.id ?? '';
    setPrimaryId(secondaryTrait.id);
    setSecondaryId(prevPrimary);
  };

  const handleReset = () => {
    setPrimaryId(traits.attributes[0]?.id ?? traits.all[0]?.id ?? '');
    setSecondaryId('');
    setModifier(0);
    commitDifficulty(defaultDiff);
    setIgnoreWoundPenalty(false);
    setSpecialty(false);
    setUseWillpower(false);
    setBloodSurgeActive(false);
    setApplyPowerBonus(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!breakdown.canRoll) return;
    onRollComposedPool({
      label: breakdown.displayLabel,
      formulaSummary: breakdown.formulaSummary,
      rulePreset,
      basePool: breakdown.primaryValue + breakdown.secondaryValue + breakdown.powerBonusDiceApplied,
      modifier: breakdown.modifier,
      difficulty: breakdown.difficulty,
      woundPenalty: breakdown.appliedWoundPenalty,
      ignoreWoundPenalty,
      specialty: breakdown.specialty,
      useWillpower: breakdown.useWillpower,
      bloodSurge: breakdown.bloodSurgeApplied,
      bloodSurgeBonus,
      powerBonusDice: breakdown.powerBonusDiceApplied,
    });
    setUseWillpower(false);
    setBloodSurgeActive(false);
  };

  const renderOptGroups = (order: readonly WodTraitGroup[]) =>
    order.map((groupKey) => {
      const items = traits[groupKey];
      if (items.length === 0) return null;
      return (
        <optgroup key={groupKey} label={groupLabels[groupKey]}>
          {items.map((trait) => (
            <option key={trait.id} value={trait.id}>
              {trait.label} ({trait.value})
            </option>
          ))}
        </optgroup>
      );
    });

  return (
    <section
      aria-labelledby={headingId}
      data-testid="wod-pool-composer"
      className="wod-pool-composer border-b-[length:var(--border-width)] border-[var(--border-color)] bg-[var(--bg-card)] shrink-0"
    >
      <button
        type="button"
        data-testid="wod-pool-composer-toggle"
        aria-expanded={isOpen}
        aria-controls={panelId}
        aria-label={t.t('poolComposer.toggleAria')}
        onClick={() => setIsOpen((prev) => !prev)}
        className="wod-composer-header w-full flex items-center justify-between gap-2 px-3 py-2 bg-[var(--bg-strip)] hover:bg-[var(--bg-hover)] cursor-pointer text-left"
      >
        <span
          id={headingId}
          className="font-mono-tech text-[10px] font-extrabold tracking-wider uppercase text-[var(--accent-wine)] truncate"
        >
          {t.t('poolComposer.title')}
        </span>
        <span className="flex items-center gap-1.5 shrink-0">
          <span
            data-testid="wod-pool-composer-pill"
            className="font-mono-tech text-[10px] font-extrabold px-1.5 py-0.5 bg-[var(--accent-cream-badge)] text-[var(--accent-wine)] border border-[var(--accent-wine)] rounded-[var(--radius-pill)] tabular-nums"
          >
            {breakdown.effectivePool}d10
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-[var(--text-primary)] ${
              isOpen ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          />
        </span>
      </button>

      {isOpen && (
        <form
          id={panelId}
          aria-labelledby={headingId}
          data-testid="wod-pool-composer-panel"
          onSubmit={handleSubmit}
          className="p-3 flex flex-col gap-2.5 bg-[var(--bg-card-alt)] max-h-[65dvh] overflow-y-auto"
        >
          {/* Trait selectors */}
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <label
                htmlFor={primarySelectId}
                className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-secondary)]"
              >
                {t.t('poolComposer.primaryLabel')}
              </label>
              <select
                id={primarySelectId}
                data-testid="pool-composer-primary"
                value={primaryTrait?.id ?? ''}
                onChange={(e) => setPrimaryId(e.target.value)}
                className="cyber-input wod-composer-select mobile-touch-input w-full min-h-[36px] px-2 py-1 text-xs font-bold uppercase"
              >
                {renderOptGroups(PRIMARY_GROUP_ORDER)}
              </select>
            </div>

            <div className="flex items-end gap-1.5">
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <label
                  htmlFor={secondarySelectId}
                  className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-secondary)]"
                >
                  {t.t('poolComposer.secondaryLabel')}
                </label>
                <select
                  id={secondarySelectId}
                  data-testid="pool-composer-secondary"
                  value={secondaryTrait?.id ?? ''}
                  onChange={(e) => setSecondaryId(e.target.value)}
                  className="cyber-input wod-composer-select mobile-touch-input w-full min-h-[36px] px-2 py-1 text-xs font-bold uppercase"
                >
                  <option value="">{t.t('poolComposer.noneOption')}</option>
                  {renderOptGroups(SECONDARY_GROUP_ORDER)}
                </select>
              </div>

              <button
                type="button"
                data-testid="pool-composer-swap"
                disabled={!secondaryTrait}
                aria-label={t.t('poolComposer.swapAria')}
                title={t.t('poolComposer.swapAria')}
                onClick={handleSwapTraits}
                className="cyber-btn-outline wod-composer-stepper-btn min-h-[36px] min-w-[36px] flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ArrowUpDown className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                data-testid="pool-composer-reset"
                aria-label={t.t('poolComposer.resetAria')}
                title={t.t('poolComposer.resetAria')}
                onClick={handleReset}
                className="cyber-btn-outline wod-composer-stepper-btn min-h-[36px] min-w-[36px] flex items-center justify-center shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Modifier + Difficulty steppers */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1 min-w-0">
              <span className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-secondary)] truncate">
                {t.t('poolComposer.modifierLabel')}
              </span>
              <div className="flex items-center justify-between gap-1 border border-[var(--border-color)] rounded-[var(--radius-pill)] bg-[var(--bg-card)] px-1">
                <button
                  type="button"
                  data-testid="pool-composer-mod-dec"
                  aria-label={t.t('poolComposer.modifierDecAria')}
                  disabled={modifier <= -10}
                  onClick={() => setModifier((prev) => Math.max(-10, prev - 1))}
                  className="wod-composer-stepper-btn min-h-[36px] min-w-[28px] inline-flex items-center justify-center text-[var(--ink-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-35 cursor-pointer"
                >
                  <Minus className="w-3 h-3" aria-hidden="true" />
                </button>
                <span
                  data-testid="pool-composer-mod-value"
                  className="font-mono-tech text-xs font-extrabold tabular-nums text-[var(--ink-primary)]"
                >
                  {modifier > 0 ? `+${modifier}` : modifier}
                </span>
                <button
                  type="button"
                  data-testid="pool-composer-mod-inc"
                  aria-label={t.t('poolComposer.modifierIncAria')}
                  disabled={modifier >= 10}
                  onClick={() => setModifier((prev) => Math.min(10, prev + 1))}
                  className="wod-composer-stepper-btn min-h-[36px] min-w-[28px] inline-flex items-center justify-center text-[var(--ink-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-35 cursor-pointer"
                >
                  <Plus className="w-3 h-3" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1 min-w-0">
              <label
                htmlFor={diffInputId}
                className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-secondary)] truncate"
              >
                {isV5 ? t.t('poolComposer.diffMetaLabel') : t.t('poolComposer.diffTnLabel')}
              </label>
              <div className="flex items-center justify-between gap-0.5 border border-[var(--border-color)] rounded-[var(--radius-pill)] bg-[var(--bg-card)] px-1">
                <button
                  type="button"
                  data-testid="pool-composer-diff-dec"
                  aria-label={t.t('poolComposer.diffDecAria')}
                  disabled={difficulty <= minDiff}
                  onClick={() => commitDifficulty(difficulty - 1)}
                  className="wod-composer-stepper-btn min-h-[36px] min-w-[26px] inline-flex items-center justify-center text-[var(--ink-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-35 cursor-pointer"
                >
                  <Minus className="w-3 h-3" aria-hidden="true" />
                </button>
                <input
                  id={diffInputId}
                  type="number"
                  inputMode="numeric"
                  min={minDiff}
                  max={10}
                  aria-label={t.t('poolComposer.diffInputAria')}
                  data-testid="pool-composer-diff-input"
                  value={diffDraft}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setDiffDraft(raw);
                    if (raw.trim() === '' || raw.trim() === '-') return;
                    const parsed = Number(raw);
                    if (Number.isFinite(parsed) && parsed >= minDiff && parsed <= 10) {
                      setDifficulty(Math.round(parsed));
                    }
                  }}
                  onBlur={() => {
                    const parsed = Number(diffDraft);
                    if (!Number.isFinite(parsed) || diffDraft.trim() === '') {
                      setDiffDraft(String(difficulty));
                      return;
                    }
                    commitDifficulty(parsed);
                  }}
                  className="w-10 bg-transparent text-center font-mono-tech text-xs font-extrabold tabular-nums text-[var(--ink-primary)] focus:outline-none"
                />
                <button
                  type="button"
                  data-testid="pool-composer-diff-inc"
                  aria-label={t.t('poolComposer.diffIncAria')}
                  disabled={difficulty >= 10}
                  onClick={() => commitDifficulty(difficulty + 1)}
                  className="wod-composer-stepper-btn min-h-[36px] min-w-[26px] inline-flex items-center justify-center text-[var(--ink-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-35 cursor-pointer"
                >
                  <Plus className="w-3 h-3" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          {/* Active wound penalty notice & exemption toggle */}
          {(isV5 ? breakdown.impairedPenaltySource !== 'none' : woundPenalty < 0) && (
            <div className="flex flex-wrap items-center justify-between gap-1.5 px-2 py-1.5 rounded-[var(--radius-card)] border border-[var(--accent-danger)]/75 bg-[var(--accent-danger-soft)]">
              <span
                data-testid="pool-composer-wound-badge"
                className="font-mono-tech text-[10px] font-extrabold uppercase text-[var(--accent-danger)]"
              >
                {isV5 && breakdown.impairedPenaltySource === 'willpower'
                  ? t.t('poolComposer.wpImpairedActive')
                  : t.t('poolComposer.woundActive', {
                      penalty: isV5 ? (woundPenalty < 0 ? woundPenalty : -2) : woundPenalty,
                    })}
              </span>
              <button
                type="button"
                data-testid="pool-composer-ignore-wound"
                aria-pressed={ignoreWoundPenalty}
                aria-label={t.t('poolComposer.woundToggleAria')}
                onClick={() => setIgnoreWoundPenalty((prev) => !prev)}
                className={`wod-composer-toggle min-h-[36px] sm:min-h-[28px] px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-[var(--radius-pill)] cursor-pointer ${
                  ignoreWoundPenalty ? 'is-active' : ''
                }`}
              >
                {ignoreWoundPenalty
                  ? t.t('poolComposer.woundExemptActive')
                  : t.t('poolComposer.woundExempt')}
              </button>
            </div>
          )}

          {/* Edition-specific toggles */}
          {isV5 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                data-testid="pool-composer-surge"
                aria-pressed={bloodSurgeActive}
                onClick={() => setBloodSurgeActive((prev) => !prev)}
                className={`wod-composer-toggle flex-1 min-h-[36px] px-2.5 py-1 text-[10px] font-extrabold uppercase rounded-[var(--radius-pill)] inline-flex items-center justify-between gap-1.5 cursor-pointer ${
                  bloodSurgeActive ? 'is-active' : ''
                }`}
              >
                <span className="truncate">
                  {t.t('poolComposer.bloodSurgeToggle', { bonus: bloodSurgeBonus })}
                </span>
                <span className="font-mono-tech text-[8px] font-black px-1 py-0.5 border border-current rounded-[var(--radius-pill)] shrink-0">
                  {t.t('poolComposer.bloodSurgeRouseTag')}
                </span>
              </button>

              <span
                data-testid="pool-composer-hunger-indicator"
                className="wod-composer-hunger-pill min-h-[36px] px-2.5 py-1 text-[10px] font-extrabold uppercase rounded-[var(--radius-pill)] inline-flex items-center justify-center shrink-0 tabular-nums"
              >
                {t.t('poolComposer.hungerIndicator', {
                  count: Math.max(0, Math.min(5, Math.round(currentHunger))),
                })}
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  data-testid="pool-composer-spec"
                  aria-pressed={specialty}
                  onClick={() => setSpecialty((prev) => !prev)}
                  className={`wod-composer-toggle min-h-[36px] px-2 py-1 text-[10px] font-extrabold uppercase rounded-[var(--radius-pill)] cursor-pointer truncate ${
                    specialty ? 'is-active' : ''
                  }`}
                >
                  {t.t('poolComposer.specToggle')}
                </button>
                <button
                  type="button"
                  data-testid="pool-composer-wp"
                  aria-pressed={useWillpower}
                  disabled={currentWillpower <= 0}
                  title={
                    currentWillpower <= 0 ? t.t('poolComposer.wpEmptyHint') : undefined
                  }
                  onClick={() => {
                    if (currentWillpower <= 0) return;
                    setUseWillpower((prev) => !prev);
                  }}
                  className={`wod-composer-toggle min-h-[36px] px-2 py-1 text-[10px] font-extrabold uppercase rounded-[var(--radius-pill)] cursor-pointer truncate ${
                    useWillpower ? 'is-active' : ''
                  }`}
                >
                  {t.t('poolComposer.wpToggle')}
                </button>
              </div>
              {suggestedSpecialtyFocus && (
                <p className="font-mono-tech text-[10px] text-[var(--accent-wine)] truncate">
                  {t.t('poolComposer.specHint', { focus: suggestedSpecialtyFocus })}
                </p>
              )}
            </div>
          )}

          {/* Live preview & roll submit */}
          <div
            data-testid="pool-composer-preview"
            aria-live="polite"
            className="px-2 py-1.5 rounded-[var(--radius-card)] bg-[var(--bg-card)] border border-[var(--border-subtle)] flex flex-col gap-0.5"
          >
            <span className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-primary)] break-words">
              {breakdown.displayLabel}
            </span>
            <span className="font-mono-tech text-[10px] font-semibold uppercase text-[var(--ink-secondary)] tabular-nums">
              {breakdown.formulaSummary}
            </span>
            {isV5 && breakdown.availablePowerBonusDice > 0 && (
              <button
                type="button"
                data-testid="pool-composer-power-bonus-badge"
                aria-pressed={applyPowerBonus}
                aria-label={t.t('poolComposer.powerBonusToggleAria', {
                  bonus: breakdown.availablePowerBonusDice,
                })}
                onClick={() => setApplyPowerBonus((prev) => !prev)}
                style={!applyPowerBonus ? { borderStyle: 'dashed' } : undefined}
                className={`wod-composer-toggle self-start min-h-[36px] sm:min-h-[28px] inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide rounded-[var(--radius-pill)] cursor-pointer ${
                  applyPowerBonus ? 'is-active' : ''
                }`}
              >
                <span>
                  {t.t('poolComposer.powerBonusBadge', {
                    bonus: breakdown.availablePowerBonusDice,
                  })}
                </span>
                <span className="font-mono-tech text-[8px] font-black px-1 py-0.5 border border-current rounded-[var(--radius-pill)] shrink-0">
                  {applyPowerBonus
                    ? t.t('poolComposer.powerBonusOnTag')
                    : t.t('poolComposer.powerBonusOffTag')}
                </span>
              </button>
            )}
            {breakdown.isIncapacitated && !breakdown.canRoll && (
              <span className="font-mono-tech text-[10px] font-bold text-[var(--accent-danger)]">
                {t.t('poolComposer.incapacitatedHint')}
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={!breakdown.canRoll}
            data-testid="pool-composer-roll-btn"
            className="cyber-roll-btn min-h-[36px] w-full px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <Dices className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>{t.t('poolComposer.rollAction', { pool: breakdown.effectivePool })}</span>
          </button>
        </form>
      )}
    </section>
  );
};
