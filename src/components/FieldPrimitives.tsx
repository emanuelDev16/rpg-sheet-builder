import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Minus,
  Plus,
  Settings2,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  AppMode,
  ComputedFieldInfo,
  getV20HealthBreakdown,
  getV5HealthBreakdown,
  resolveRollPreview,
  SheetCard,
  SheetField,
  SystemId,
} from '../core/sheetModel';
import {
  computeRemainingDamageAfterSoak,
  parseWodPoolExpression,
  RulePreset,
  SoakDamageType,
  VariableMap,
} from '../core/formula';
import { AppTranslations, getTranslations } from '../core/i18n';
import { isOfficialVampireSheet } from '../core/wodSkillsCatalog';
import { parsePowerActivationCost } from '../core/wodClansDisciplinesCatalog';
import { resolveWodDotRatingConfig } from '../utils/dotRating';
import { AnimatedCounter } from './AnimatedCounter';
import { DotRating } from './DotRating';

interface ClampedNumberInputProps {
  value: number;
  min: number;
  max: number;
  ariaLabel: string;
  testId: string;
  onCommit: (next: number) => void;
}

const ClampedNumberInput: React.FC<ClampedNumberInputProps> = ({
  value,
  min,
  max,
  ariaLabel,
  testId,
  onCommit,
}) => {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    if (!focused) {
      setDraft(String(value));
    }
  }, [value, focused]);

  return (
    <input
      type="number"
      min={min}
      max={max}
      aria-label={ariaLabel}
      data-testid={testId}
      value={focused ? draft : String(value)}
      onFocus={() => {
        setFocused(true);
        setDraft(String(value));
      }}
      onChange={(e) => {
        const rawText = e.target.value;
        setDraft(rawText);
        if (rawText.trim() === '' || rawText.trim() === '-') return;
        const parsed = Number(rawText);
        if (Number.isFinite(parsed) && parsed >= min && parsed <= max) {
          onCommit(Math.round(parsed));
        }
      }}
      onBlur={() => {
        setFocused(false);
        const parsed = Number(draft);
        if (!Number.isFinite(parsed) || draft.trim() === '' || draft.trim() === '-') {
          setDraft(String(value));
          return;
        }
        const clamped = Math.max(min, Math.min(max, Math.round(parsed)));
        setDraft(String(clamped));
        if (clamped !== value) {
          onCommit(clamped);
        }
      }}
      className="cyber-input mobile-touch-input w-14 sm:w-12 px-1 py-0.5 text-[11px] font-bold text-center tabular-nums"
    />
  );
};

function getEditCtrlLabels(t: AppTranslations['cards']) {
  return {
    moveUp: t.t('cards.edit.moveUp'),
    moveDown: t.t('cards.edit.moveDown'),
    editField: t.t('cards.edit.editField'),
    closeEdit: t.t('cards.edit.closeEdit'),
    editingTag: t.t('cards.edit.editingTag'),
    diffMinus: t.t('cards.edit.diffMinus'),
    diffPlus: t.t('cards.edit.diffPlus'),
  };
}

interface WodPoolRollFieldProps {
  field: SheetField;
  variables: VariableMap;
  defaultDifficulty: number;
  rulePreset: RulePreset;
  woundPenalty: number;
  bloodSurge: boolean;
  lastSoakTotal?: number | null;
  compactHeader?: boolean;
  t: AppTranslations['cards'];
  onRoll: (field: SheetField) => void;
  onUpdateSchema: (fieldId: string, patch: Partial<SheetField>) => void;
}

const SOAK_TYPES: SoakDamageType[] = ['bashing', 'lethal', 'aggravated'];

const WodPoolRollField: React.FC<WodPoolRollFieldProps> = ({
  field,
  variables,
  defaultDifficulty,
  rulePreset,
  woundPenalty,
  bloodSurge,
  lastSoakTotal = null,
  compactHeader = false,
  t,
  onRoll,
  onUpdateSchema,
}) => {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [rawSoakIncoming, setRawSoakIncoming] = useState(4);
  const ctrlLabels = getEditCtrlLabels(t);

  const isSoak = Boolean(field.isSoak || field.id === 'f_soak' || field.key === 'soak_roll');
  const isV5 = rulePreset === 'vampire-v5';
  const soakDamageType: SoakDamageType = field.soakDamageType ?? 'lethal';

  const isV5Pool = isV5 && !isSoak;
  const minDiff = isV5Pool ? 1 : 2;
  const clampedDefaultDiff = isV5Pool
    ? 2
    : Math.max(2, Math.min(10, Math.round(defaultDifficulty)));
  const difficulty = isV5Pool
    ? Math.max(1, Math.min(10, Math.round(field.rollDifficultyV5 ?? 2)))
    : Math.max(2, Math.min(10, Math.round(field.rollDifficulty ?? clampedDefaultDiff)));
  const specialty = isV5 ? false : Boolean(field.rollSpecialty);
  const modifier =
    typeof field.rollMod === 'number' && Number.isFinite(field.rollMod)
      ? Math.round(field.rollMod)
      : 0;

  const commitDifficulty = (nextDiff: number) => {
    const clamped = Math.max(minDiff, Math.min(10, Math.round(nextDiff)));
    if (isV5Pool) {
      onUpdateSchema(field.id, { rollDifficultyV5: clamped });
    } else {
      onUpdateSchema(field.id, { rollDifficulty: clamped });
    }
  };

  const effectiveWoundPenalty = isSoak ? 0 : woundPenalty;

  const previewExpr = resolveRollPreview(field.rollExpr ?? 'pool(1, 6)', variables, {
    difficulty,
    modifier,
    specialty,
    rulePreset,
    woundPenalty: effectiveWoundPenalty,
    isSoak,
    soakDamageType,
    bloodSurge,
  });
  const wpBlocked = isV5 || (isSoak && soakDamageType === 'aggravated');
  const wpArmed = !wpBlocked && Boolean(variables.wp_boost) && (variables.willpower ?? 0) > 0;
  const displayLabel = `${field.rollLabel ?? field.label} · ${previewExpr}`;

  const diffPillLabel = isV5Pool
    ? `${t.t('cards.pool.diffMeta')} ${difficulty}`
    : `${t.t('cards.pool.diffTn')} ${difficulty}`;
  const summaryParts = [diffPillLabel];
  if (modifier !== 0) {
    summaryParts.push(`${modifier > 0 ? `+${modifier}` : modifier} ${t.t('cards.pool.mod')}`);
  }
  if (specialty) {
    summaryParts.push(t.t('cards.pool.specShort'));
  }
  const isCustomized = difficulty !== clampedDefaultDiff || modifier !== 0 || specialty;

  const soakTypeLabels: Record<SoakDamageType, string> = {
    bashing: t.t('cards.vital.soakBashing'),
    lethal: t.t('cards.vital.soakLethal'),
    aggravated: t.t('cards.vital.soakAggravated'),
  };

  return (
    <div className={compactHeader ? 'pt-1' : 'py-0.5'}>
      {!compactHeader && (
        <button
          type="button"
          data-testid={`roll-btn-${field.id}`}
          onClick={() => onRoll(isV5Pool ? { ...field, rollDifficulty: difficulty } : field)}
          className="cyber-roll-btn min-h-[36px] w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs font-bold tracking-wider uppercase cursor-pointer"
        >
          <span className="text-left break-words whitespace-normal leading-snug min-w-0">
            {displayLabel}
          </span>
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
            {effectiveWoundPenalty < 0 && (
              <span
                data-testid={`roll-wound-badge-${field.id}`}
                className="font-mono-tech text-[9px] font-extrabold px-1.5 py-0.5 bg-[var(--accent-danger-soft)] text-[var(--accent-danger)] border border-[var(--accent-danger)] rounded-[var(--radius-pill)] uppercase"
              >
                {t.t('cards.pool.woundBadge', { penalty: effectiveWoundPenalty })}
              </span>
            )}
            {wpArmed && (
              <span className="font-mono-tech text-[9px] font-extrabold px-1.5 py-0.5 bg-[var(--accent-primary)] text-[var(--accent-contrast)] border border-[var(--accent-contrast)]/45 rounded-[var(--radius-pill)]">
                {t.t('cards.pool.wpBadge')}
              </span>
            )}
            <span className="text-sm leading-none" aria-hidden="true">
              ↗
            </span>
          </div>
        </button>
      )}

      {isSoak && !isV5 && (
        <div
          data-testid="v20-soak-type-bar"
          className="no-print print:hidden mt-1.5 p-2 bg-[var(--bg-card-alt)] border border-[var(--border-ink)]/55 rounded-[var(--radius-card)] flex flex-col gap-1.5"
        >
          <div
            role="radiogroup"
            aria-label={t.t('cards.vital.soakTypeAria')}
            className="grid grid-cols-3 gap-1"
          >
            {SOAK_TYPES.map((sType) => {
              const selected = soakDamageType === sType;
              return (
                <button
                  key={sType}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  data-testid={`soak-type-${sType}`}
                  onClick={() => onUpdateSchema(field.id, { soakDamageType: sType })}
                  className={`font-mono-tech min-h-[36px] sm:min-h-[30px] px-1.5 py-1 text-[9px] sm:text-[10px] font-extrabold uppercase rounded-[var(--radius-pill)] border cursor-pointer transition-colors ${
                    selected
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-color)]'
                      : 'bg-[var(--bg-card)] text-[var(--ink-primary)] border-[var(--border-ink)]/55 hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  {soakTypeLabels[sType]}
                </button>
              );
            })}
          </div>
          {soakDamageType === 'aggravated' && (
            <p
              data-testid="soak-aggravated-hint"
              className="font-mono-tech text-[10px] font-bold text-[var(--accent-wine)] uppercase"
            >
              {t.t('cards.vital.soakAggravatedHint')}
            </p>
          )}
          {soakDamageType === 'bashing' && (
            <div
              data-testid="soak-bashing-helper"
              className="flex flex-wrap items-center justify-between gap-2 pt-0.5"
            >
              <span className="font-mono-tech text-[10px] text-[var(--ink-secondary)]">
                {t.t('cards.vital.soakBashingHint')}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <input
                  type="number"
                  min={0}
                  max={50}
                  aria-label={t.t('cards.vital.soakCalcInputAria')}
                  data-testid="soak-bashing-raw-input"
                  value={rawSoakIncoming}
                  onChange={(e) =>
                    setRawSoakIncoming(Math.max(0, Math.min(50, Number(e.target.value) || 0)))
                  }
                  className="cyber-input mobile-touch-input w-14 px-1.5 py-0.5 text-[11px] font-bold text-center tabular-nums"
                />
                <span
                  data-testid="soak-bashing-remaining"
                  className="font-mono-tech text-[10px] font-extrabold px-2 py-0.5 bg-[var(--accent-cream-badge)] text-[var(--accent-wine)] border border-[var(--accent-wine)] rounded-[var(--radius-pill)] tabular-nums"
                >
                  {t.t('cards.vital.soakCalcLabel')}{' '}
                  {computeRemainingDamageAfterSoak(
                    rawSoakIncoming,
                    lastSoakTotal ?? 0,
                    'bashing',
                  )}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="no-print print:hidden mt-1.5 flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex items-center gap-1 flex-wrap">
            <button
              type="button"
              data-testid={`roll-opts-toggle-${field.id}`}
              aria-expanded={optionsOpen}
              aria-controls={`roll-opts-panel-${field.id}`}
              onClick={() => setOptionsOpen((prev) => !prev)}
              className={`font-mono-tech min-h-[36px] sm:min-h-[30px] text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-[var(--radius-pill)] border inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                optionsOpen || isCustomized
                  ? 'bg-[var(--accent-cream-badge)] text-[var(--accent-wine)] border-[var(--accent-wine)]'
                  : 'bg-[var(--bg-card-alt)] text-[var(--ink-secondary)] border-[var(--border-ink)]/55 hover:border-[var(--border-ink)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              <SlidersHorizontal className="w-3 h-3 shrink-0" aria-hidden="true" />
              <span data-testid={isV5Pool ? `v5-diff-meta-${field.id}` : `v20-diff-tn-${field.id}`}>
                {summaryParts.join(' · ')}
              </span>
              <ChevronDown
                className={`w-3 h-3 shrink-0 transition-transform duration-150 ${
                  optionsOpen ? 'rotate-180' : ''
                }`}
                aria-hidden="true"
              />
            </button>

            <div className="inline-flex items-center border border-[var(--border-ink)]/55 rounded-[var(--radius-pill)] overflow-hidden bg-[var(--bg-card-alt)]">
              <button
                type="button"
                data-testid={`roll-diff-dec-${field.id}`}
                aria-label={`${ctrlLabels.diffMinus}: ${field.rollLabel ?? field.label}`}
                disabled={difficulty <= minDiff}
                onClick={() => commitDifficulty(difficulty - 1)}
                className="min-h-[36px] sm:min-h-[28px] w-7 inline-flex items-center justify-center text-[var(--ink-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
              >
                <Minus className="w-3 h-3" aria-hidden="true" />
              </button>
              <button
                type="button"
                data-testid={`roll-diff-inc-${field.id}`}
                aria-label={`${ctrlLabels.diffPlus}: ${field.rollLabel ?? field.label}`}
                disabled={difficulty >= 10}
                onClick={() => commitDifficulty(difficulty + 1)}
                className="min-h-[36px] sm:min-h-[28px] w-7 inline-flex items-center justify-center border-l border-[var(--border-ink)]/35 text-[var(--ink-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
              >
                <Plus className="w-3 h-3" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        {optionsOpen && (
          <div
            id={`roll-opts-panel-${field.id}`}
            data-testid={`roll-opts-panel-${field.id}`}
            className="px-2 py-1.5 bg-[var(--bg-card-alt)] border-[length:var(--border-width)] border-[var(--border-color)]/75 rounded-[var(--radius-card)] flex flex-wrap items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2.5 flex-wrap">
              <label className="flex items-center gap-1 font-mono-tech text-[10px] font-bold text-[var(--ink-secondary)] uppercase">
                <span>{isV5Pool ? t.t('cards.pool.diffMeta') : t.t('cards.pool.diffTn')}</span>
                <ClampedNumberInput
                  min={minDiff}
                  max={10}
                  ariaLabel={t.t(isV5Pool ? 'cards.pool.diffMetaAria' : 'cards.pool.diffAria', {
                    label: field.rollLabel ?? field.label,
                  })}
                  testId={`roll-diff-${field.id}`}
                  value={difficulty}
                  onCommit={commitDifficulty}
                />
              </label>

              <label className="flex items-center gap-1 font-mono-tech text-[10px] font-bold text-[var(--ink-secondary)] uppercase">
                <span>{t.t('cards.pool.mod')}</span>
                <ClampedNumberInput
                  min={-10}
                  max={20}
                  ariaLabel={t.t('cards.pool.modAria', { label: field.rollLabel ?? field.label })}
                  testId={`roll-mod-${field.id}`}
                  value={modifier}
                  onCommit={(next) => onUpdateSchema(field.id, { rollMod: next })}
                />
              </label>
            </div>

            {!isV5 && (
              <label className="inline-flex items-center gap-1.5 min-h-[36px] md:min-h-0 font-mono-tech text-[10px] font-bold uppercase cursor-pointer select-none text-[var(--ink-primary)]">
                <input
                  type="checkbox"
                  data-testid={`roll-spec-${field.id}`}
                  checked={specialty}
                  onChange={(e) => onUpdateSchema(field.id, { rollSpecialty: e.target.checked })}
                  className="w-4 h-4 md:w-3.5 md:h-3.5 accent-[var(--accent-primary)] cursor-pointer"
                />
                <span className={specialty ? 'text-[var(--accent-wine)]' : ''}>
                  {t.t('cards.pool.specialty')}
                </span>
              </label>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

interface FieldPrimitiveProps {
  field: SheetField;
  card?: SheetCard;
  pairedRollField?: SheetField;
  mode: AppMode;
  systemId?: SystemId;
  rulePreset?: RulePreset;
  compactDots?: boolean;
  woundPenalty?: number;
  bloodPool?: { current: number; max: number };
  bloodSurge?: boolean;
  lastSoakTotal?: number | null;
  canWillpowerSurge?: boolean;
  variables: VariableMap;
  computed?: ComputedFieldInfo;
  totalCargoWeight: number;
  t?: AppTranslations['cards'];
  isEditOpen?: boolean;
  onToggleEdit?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onChangeValue: (fieldId: string, value: number | string | boolean) => void;
  onAdjustResource: (fieldId: string, delta: number) => void;
  onAdjustHealthDamage?: (
    fieldId: string,
    damageType: 'superficial' | 'aggravated',
    delta: number,
  ) => void;
  onCycleV20HealthCell?: (fieldId: string, boxIndex: number) => void;
  onAdjustV20HealthDamage?: (
    fieldId: string,
    damageType: 'bashing' | 'lethal' | 'aggravated',
    delta: number,
  ) => void;
  onAdjustV5HealthDamage?: (
    fieldId: string,
    damageType: 'superficial' | 'aggravated',
    delta: number,
  ) => void;
  onApplyV5SuperficialHalving?: (fieldId: string, rawDamage: number) => void;
  onRouseCheck?: (options?: { label?: string; count?: number }) => void;
  onSpendPowerBlood?: (cost: number, powerName: string) => void;
  onTriggerWillpowerSurge?: () => void;
  onRoll: (field: SheetField) => void;
  onAddRow: (fieldId: string) => void;
  onUpdateRow: (fieldId: string, rowId: string, col: 'col1' | 'col2', val: string | number) => void;
  onRemoveRow: (fieldId: string, rowId: string) => void;
  onUpdateSchema: (fieldId: string, patch: Partial<SheetField>) => void;
  onRemoveField: (fieldId: string) => void;
}

const DEFAULT_CARDS_T = getTranslations('pt-BR').cards;

export const FieldPrimitive: React.FC<FieldPrimitiveProps> = ({
  field,
  card,
  pairedRollField,
  mode,
  systemId = 'wod',
  rulePreset = 'storyteller-v20',
  compactDots = false,
  woundPenalty = 0,
  bloodPool,
  bloodSurge = false,
  lastSoakTotal = null,
  canWillpowerSurge = false,
  variables,
  computed,
  totalCargoWeight,
  t = DEFAULT_CARDS_T,
  isEditOpen,
  onToggleEdit,
  canMoveUp = false,
  canMoveDown = false,
  onMoveUp,
  onMoveDown,
  onChangeValue,
  onAdjustResource,
  onAdjustHealthDamage,
  onCycleV20HealthCell,
  onAdjustV20HealthDamage,
  onAdjustV5HealthDamage,
  onApplyV5SuperficialHalving,
  onRouseCheck,
  onSpendPowerBlood,
  onTriggerWillpowerSurge,
  onRoll,
  onAddRow,
  onUpdateRow,
  onRemoveRow,
  onUpdateSchema,
  onRemoveField,
}) => {
  const [v5RawSupDamage, setV5RawSupDamage] = useState(2);
  const inputId = `field_${field.id}`;
  const isCustomSystem = systemId === 'blank';
  const ctrlLabels = getEditCtrlLabels(t);
  const prefersReducedMotion = useReducedMotion();
  const isEinkTheme =
    typeof document !== 'undefined' && document.documentElement?.dataset?.theme === 'eink';
  const shouldReduceMotion = Boolean(prefersReducedMotion || isEinkTheme);
  const shouldShowEditStrip =
    mode === 'edicao' && (onToggleEdit ? Boolean(isEditOpen) : true);
  const dotConfig = resolveWodDotRatingConfig(field, card, rulePreset, systemId);
  const useWodDots = mode === 'jogo' && dotConfig.enabled;

  const renderEditStrip = () => {
    if (!shouldShowEditStrip) return null;
    const defaultCol1 = t.t('cards.defaultItemCol');
    const defaultCol2 = t.t('cards.defaultValueCol');
    return (
      <div
        data-testid={`field-edit-strip-${field.id}`}
        className="no-print print:hidden mt-2 pt-2 border-t border-dashed border-[var(--border-ink)]/40 grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-[var(--bg-header-strip)] p-2 rounded-[var(--radius-card)]"
      >
        <div className={`flex items-center gap-1.5 ${isCustomSystem ? '' : 'sm:col-span-2'}`}>
          <span className="font-mono-tech text-[10px] font-bold text-[var(--ink-muted)] uppercase shrink-0">
            {t.t('cards.strip.label')}
          </span>
          <input
            type="text"
            aria-label={t.t('cards.strip.editLabelAria', { label: field.label })}
            value={field.label}
            onChange={(e) => onUpdateSchema(field.id, { label: e.target.value })}
            className="cyber-input mobile-touch-input px-1.5 py-0.5 text-[11px] w-full"
          />
        </div>
        {isCustomSystem && (
          <div className="flex items-center gap-1.5">
            <span className="font-mono-tech text-[10px] font-bold text-[var(--ink-muted)] uppercase shrink-0">
              {t.t('cards.strip.var')}
            </span>
            <input
              type="text"
              aria-label={t.t('cards.strip.editVarAria', { label: field.label })}
              value={field.key}
              onChange={(e) => onUpdateSchema(field.id, { key: e.target.value })}
              className="cyber-input mobile-touch-input px-1.5 py-0.5 text-[11px] w-full"
            />
          </div>
        )}
        {isCustomSystem && field.kind === 'calculated' && (
          <div className="sm:col-span-2 flex items-center gap-1.5">
            <span className="font-mono-tech text-[10px] font-bold text-[var(--accent-wine)] uppercase shrink-0">
              {t.t('cards.strip.formula')}
            </span>
            <input
              type="text"
              aria-label={t.t('cards.strip.editFormulaAria', { label: field.label })}
              value={field.formula ?? ''}
              onChange={(e) => onUpdateSchema(field.id, { formula: e.target.value })}
              className="cyber-input mobile-touch-input px-1.5 py-0.5 text-[11px] w-full"
            />
          </div>
        )}
        {field.kind === 'roll' && (
          <>
            <div className={`flex items-center gap-1.5 ${isCustomSystem ? '' : 'sm:col-span-2'}`}>
              <span className="font-mono-tech text-[10px] font-bold text-[var(--accent-wine)] uppercase shrink-0">
                {t.t('cards.strip.button')}
              </span>
              <input
                type="text"
                aria-label={t.t('cards.strip.editButtonAria', { label: field.label })}
                value={field.rollLabel ?? ''}
                onChange={(e) => onUpdateSchema(field.id, { rollLabel: e.target.value })}
                className="cyber-input mobile-touch-input px-1.5 py-0.5 text-[11px] w-full"
              />
            </div>
            {isCustomSystem && (
              <div className="flex items-center gap-1.5">
                <span className="font-mono-tech text-[10px] font-bold text-[var(--accent-wine)] uppercase shrink-0">
                  {t.t('cards.strip.dice')}
                </span>
                <input
                  type="text"
                  aria-label={t.t('cards.strip.editDiceAria', { label: field.label })}
                  value={field.rollExpr ?? ''}
                  onChange={(e) => onUpdateSchema(field.id, { rollExpr: e.target.value })}
                  className="cyber-input mobile-touch-input px-1.5 py-0.5 text-[11px] w-full"
                />
              </div>
            )}
          </>
        )}
        {field.kind === 'resource' && (
          <div className="flex items-center gap-1.5">
            <span className="font-mono-tech text-[10px] font-bold text-[var(--accent-wine)] uppercase shrink-0">
              {t.t('cards.strip.max')}
            </span>
            <input
              type="number"
              min={1}
              max={999}
              aria-label={t.t('cards.strip.editMaxAria', { label: field.label })}
              value={field.max ?? 12}
              onChange={(e) => {
                const nextMax = Math.max(1, Math.min(999, Number(e.target.value) || 1));
                onUpdateSchema(field.id, { max: nextMax });
              }}
              className="cyber-input mobile-touch-input px-1.5 py-0.5 text-[11px] w-20"
            />
          </div>
        )}
        {field.kind === 'repeatable' && (
          <>
            <div className="flex items-center gap-1.5">
              <span className="font-mono-tech text-[10px] font-bold text-[var(--accent-wine)] uppercase shrink-0">
                {t.t('cards.strip.col1')}
              </span>
              <input
                type="text"
                aria-label={t.t('cards.strip.editCol1Aria', { label: field.label })}
                value={field.columns?.[0] ?? defaultCol1}
                onChange={(e) =>
                  onUpdateSchema(field.id, {
                    columns: [e.target.value, field.columns?.[1] ?? defaultCol2],
                  })
                }
                className="cyber-input mobile-touch-input px-1.5 py-0.5 text-[11px] w-full"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono-tech text-[10px] font-bold text-[var(--accent-wine)] uppercase shrink-0">
                {t.t('cards.strip.col2')}
              </span>
              <input
                type="text"
                aria-label={t.t('cards.strip.editCol2Aria', { label: field.label })}
                value={field.columns?.[1] ?? defaultCol2}
                onChange={(e) =>
                  onUpdateSchema(field.id, {
                    columns: [field.columns?.[0] ?? defaultCol1, e.target.value],
                  })
                }
                className="cyber-input mobile-touch-input px-1.5 py-0.5 text-[11px] w-full"
              />
            </div>
          </>
        )}
        <div className="sm:col-span-2 flex justify-end">
          <button
            type="button"
            data-testid={`remove-field-btn-${field.id}`}
            onClick={() => onRemoveField(field.id)}
            className="font-mono-tech min-h-[36px] sm:min-h-0 text-[10px] font-bold text-[var(--accent-danger)] hover:underline cursor-pointer py-1"
          >
            {t.t('cards.strip.removeField')}
          </button>
        </div>
      </div>
    );
  };

  const renderFieldBody = (): React.ReactNode => {
    // 1. Número e Texto
    if (field.kind === 'number') {
      const numericValue = typeof field.value === 'number' ? field.value : 0;

      if (pairedRollField && mode === 'jogo') {
        const parsedPairedPool = parseWodPoolExpression(pairedRollField.rollExpr ?? '');
        const pairedIsSoak = Boolean(
          pairedRollField.isSoak ||
            pairedRollField.id === 'f_soak' ||
            pairedRollField.key === 'soak_roll',
        );
        const pairedIsV5 = rulePreset === 'vampire-v5';
        const pairedIsV5Pool = pairedIsV5 && !pairedIsSoak;
        const pairedSoakType: SoakDamageType = pairedRollField.soakDamageType ?? 'lethal';
        const pairedDefaultDiff = parsedPairedPool
          ? Number.isFinite(Number(parsedPairedPool.diffExpr))
            ? Number(parsedPairedPool.diffExpr)
            : 6
          : 6;
        const pairedDiff = pairedIsV5Pool
          ? Math.max(1, Math.min(10, Math.round(pairedRollField.rollDifficultyV5 ?? 2)))
          : Math.max(2, Math.min(10, Math.round(pairedRollField.rollDifficulty ?? pairedDefaultDiff)));
        const pairedMod =
          typeof pairedRollField.rollMod === 'number' && Number.isFinite(pairedRollField.rollMod)
            ? Math.round(pairedRollField.rollMod)
            : 0;
        const pairedSpec = pairedIsV5 ? false : Boolean(pairedRollField.rollSpecialty);
        const pairedWound = pairedIsSoak ? 0 : woundPenalty;
        const preview = resolveRollPreview(pairedRollField.rollExpr ?? '1d20', variables, {
          difficulty: pairedDiff,
          modifier: pairedMod,
          specialty: pairedSpec,
          rulePreset,
          woundPenalty: pairedWound,
          isSoak: pairedIsSoak,
          soakDamageType: pairedSoakType,
          bloodSurge,
        });
        const pairedWpArmed =
          !(pairedIsV5 || (pairedIsSoak && pairedSoakType === 'aggravated')) &&
          Boolean(variables.wp_boost) &&
          (variables.willpower ?? 0) > 0;

        return (
          <div
            data-testid={`paired-skill-row-${field.id}`}
            className="py-1 flex flex-col gap-1 border-b border-[var(--border-subtle)]/45 last:border-b-0"
          >
            <div
              className={`flex items-center justify-between gap-2 min-w-0 ${
                useWodDots ? 'flex-wrap gap-y-1' : 'flex-wrap sm:flex-nowrap'
              }`}
            >
              {useWodDots ? (
                <span className="font-mono-tech text-xs font-bold tracking-wide text-[var(--ink-primary)] uppercase min-w-0 flex-1 break-words">
                  {field.label}
                </span>
              ) : (
                <label
                  htmlFor={inputId}
                  className="font-mono-tech text-xs font-bold tracking-wide text-[var(--ink-primary)] uppercase min-w-0 flex-1 break-words"
                >
                  {field.label}
                </label>
              )}
              <div className="flex flex-wrap items-center justify-end gap-1.5 min-w-0 max-w-full shrink-0">
                {useWodDots ? (
                  <DotRating
                    label={field.label}
                    value={numericValue}
                    min={dotConfig.min}
                    max={dotConfig.max}
                    onChange={(next) => onChangeValue(field.id, next)}
                    t={t}
                    compact={compactDots}
                    testId={`dot-rating-${field.id}`}
                  />
                ) : (
                  <input
                    id={inputId}
                    type="number"
                    value={numericValue}
                    onChange={(e) => onChangeValue(field.id, Number(e.target.value))}
                    className="cyber-input mobile-touch-input w-16 px-2 py-1 text-sm font-bold text-right tabular-nums shrink-0"
                  />
                )}
                <button
                  type="button"
                  data-testid={`roll-btn-${pairedRollField.id}`}
                  aria-label={`${pairedRollField.rollLabel ?? pairedRollField.label} (${preview})`}
                  onClick={() =>
                    onRoll(pairedIsV5Pool ? { ...pairedRollField, rollDifficulty: pairedDiff } : pairedRollField)
                  }
                  className="cyber-roll-btn min-h-[36px] px-2.5 py-1.5 text-[10px] font-bold tracking-wider uppercase inline-flex items-center gap-1.5 shrink-0 cursor-pointer whitespace-nowrap"
                >
                  <span>{preview}</span>
                  {pairedWpArmed && (
                    <span className="font-mono-tech text-[9px] font-extrabold px-1 py-0.5 bg-[var(--accent-primary)] text-[var(--accent-contrast)] rounded-[var(--radius-pill)]">
                      {t.t('cards.pool.wpBadge')}
                    </span>
                  )}
                  <span aria-hidden="true">↗</span>
                </button>
              </div>
            </div>
            {parsedPairedPool && (
              <WodPoolRollField
                field={pairedRollField}
                variables={variables}
                defaultDifficulty={pairedDefaultDiff}
                rulePreset={rulePreset}
                woundPenalty={woundPenalty}
                bloodSurge={bloodSurge}
                lastSoakTotal={lastSoakTotal}
                compactHeader
                t={t}
                onRoll={onRoll}
                onUpdateSchema={onUpdateSchema}
              />
            )}
          </div>
        );
      }

      if (useWodDots) {
        return (
          <div
            className={`py-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 min-w-0 ${
              compactDots ? 'wod-attr-dot-row' : ''
            }`}
          >
            <span className="font-mono-tech text-xs font-bold tracking-wide text-[var(--ink-primary)] uppercase min-w-0 break-words">
              {field.label}
            </span>
            <DotRating
              label={field.label}
              value={numericValue}
              min={dotConfig.min}
              max={dotConfig.max}
              onChange={(next) => onChangeValue(field.id, next)}
              t={t}
              compact={compactDots}
              testId={`dot-rating-${field.id}`}
            />
          </div>
        );
      }

      return (
        <div className="py-1 flex items-center justify-between gap-2 sm:gap-3 min-w-0">
          <label
            htmlFor={inputId}
            className="font-mono-tech text-xs font-bold tracking-wide text-[var(--ink-primary)] uppercase min-w-0 break-words"
          >
            {field.label}
          </label>
          <input
            id={inputId}
            type="number"
            value={numericValue}
            onChange={(e) => onChangeValue(field.id, Number(e.target.value))}
            className="cyber-input mobile-touch-input w-24 px-2.5 py-1.5 text-sm font-bold text-right shrink-0"
          />
        </div>
      );
    }

    if (field.kind === 'text') {
      const isLong = field.key === 'notas_campanha' || String(field.value ?? '').length > 48;
      return (
        <div
          className={`py-1 ${
            isLong
              ? 'flex flex-col gap-1.5'
              : 'flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 sm:gap-3'
          }`}
        >
          <label
            htmlFor={inputId}
            className="font-mono-tech text-xs font-bold tracking-wide text-[var(--ink-secondary)] uppercase shrink-0"
          >
            {field.label}
          </label>
          {isLong ? (
            <>
              <textarea
                id={inputId}
                rows={4}
                value={String(field.value ?? '')}
                onChange={(e) => onChangeValue(field.id, e.target.value)}
                className="no-print print:hidden cyber-input mobile-touch-input w-full px-3 py-2 text-xs leading-relaxed resize-y"
              />
              <p className="hidden print:block cyber-input w-full px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap break-words">
                {String(field.value ?? '')}
              </p>
            </>
          ) : (
            <input
              id={inputId}
              type="text"
              value={String(field.value ?? '')}
              placeholder={field.placeholder}
              onChange={(e) => onChangeValue(field.id, e.target.value)}
              className="cyber-input mobile-touch-input w-full sm:w-auto sm:flex-1 sm:max-w-[260px] px-2.5 py-1.5 text-xs font-semibold"
            />
          )}
        </div>
      );
    }

    // 2. Calculado (Somente Leitura)
    if (field.kind === 'calculated') {
      const isErr = computed && !computed.ok;
      const showFormulaLine = (isCustomSystem && mode === 'edicao') || isErr;
      return (
        <div className="py-1">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="font-mono-tech text-xs font-bold tracking-wide text-[var(--ink-secondary)] uppercase block truncate">
                {field.label}
              </span>
              {showFormulaLine && (
                <span className="font-mono-tech text-[10px] text-[var(--ink-muted)] block truncate">
                  = {field.formula}
                </span>
              )}
            </div>
            <div
              role="status"
              aria-label={`${field.label}: ${computed?.formatted ?? '0'}`}
              title={
                isErr
                  ? computed?.error
                  : isCustomSystem
                    ? t.t('cards.formulaTooltip', { formula: field.formula ?? '' })
                    : undefined
              }
              className={`cyber-calc-box px-3 py-1.5 text-sm font-bold flex items-center gap-2 shrink-0 ${
                isErr ? 'is-error' : ''
              }`}
            >
              <span>{computed?.formatted ?? '0'}</span>
            </div>
          </div>
          {isErr && (
            <p className="font-mono-tech text-[10px] text-[var(--accent-danger)] mt-1">
              ! {computed?.error}
            </p>
          )}
        </div>
      );
    }

    // 3A. Recurso especial: WoD Health Damage Track (Dual V20 3-state vs V5 2-state)
    if (field.kind === 'resource' && field.damageTrack) {
      if (rulePreset === 'vampire-v5') {
        const { max, aggravated: agg, superficial: sup, totalDamage, healthy } =
          getV5HealthBreakdown(field);
        const isImpaired = totalDamage >= max;
        const halvedIncoming = Math.ceil(Math.max(0, v5RawSupDamage) / 2);
        const boxes = Array.from({ length: max }, (_, idx) => {
          if (idx < agg) return 'aggravated' as const;
          if (idx < agg + sup) return 'superficial' as const;
          return 'healthy' as const;
        });

        const adjustV5 = onAdjustV5HealthDamage ?? onAdjustHealthDamage;

        return (
          <div
            data-testid={`health-damage-track-${field.id}`}
            className="p-2.5 bg-[var(--bg-card-alt)] border-[length:var(--border-width)] border-[var(--border-color)] rounded-[var(--radius-card)] flex flex-col gap-2"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                <span className="font-mono-tech text-xs font-bold tracking-wide text-[var(--ink-primary)] uppercase">
                  {field.label}
                </span>
                <span className="font-mono-tech text-[10px] font-bold px-1.5 py-0.5 bg-[var(--accent-cream-badge)] text-[var(--accent-wine)] border border-[var(--accent-wine)] rounded-[var(--radius-pill)] whitespace-nowrap">
                  {t.t('cards.vital.v5OverflowRule')}
                </span>
                {isImpaired && (
                  <span
                    data-testid="health-impaired-badge"
                    className="font-mono-tech text-[10px] font-extrabold px-1.5 py-0.5 bg-[var(--accent-danger-soft)] text-[var(--accent-danger)] border border-[var(--accent-danger)] rounded-[var(--radius-pill)] whitespace-nowrap"
                  >
                    {t.t('cards.vital.impairedBadge')}
                  </span>
                )}
              </div>
              <span
                data-testid="health-healthy-summary"
                className="font-mono-tech text-[11px] font-bold text-[var(--ink-primary)] tabular-nums whitespace-nowrap"
                aria-live="polite"
              >
                <AnimatedCounter value={healthy} /> / <AnimatedCounter value={max} pulseOnChange={false} />{' '}
                {t.healthyRemaining}
              </span>
            </div>

            <div
              className="seg-meter-track flex items-center gap-[3px]"
              role="meter"
              aria-label={field.label}
              aria-valuemin={0}
              aria-valuemax={max}
              aria-valuenow={healthy}
            >
              {boxes.map((state, idx) => (
                <motion.div
                  key={idx}
                  aria-hidden="true"
                  initial={false}
                  animate={{ scale: state === 'healthy' ? 0.96 : 1 }}
                  transition={
                    shouldReduceMotion ? { duration: 0 } : { duration: 0.18, ease: 'easeOut' }
                  }
                  style={
                    state === 'aggravated'
                      ? {
                          backgroundColor: 'var(--ink-primary)',
                          color: 'var(--bg-card)',
                          borderColor: 'var(--border-color)',
                        }
                      : state === 'superficial'
                        ? {
                            backgroundImage:
                              'repeating-linear-gradient(135deg, color-mix(in srgb, var(--ink-primary) 18%, transparent) 0 3px, transparent 3px 6px)',
                            backgroundColor: 'var(--bg-card)',
                            color: 'var(--ink-primary)',
                            borderColor: 'var(--border-color)',
                          }
                        : undefined
                  }
                  className={`seg-block h-[22px] flex items-center justify-center font-mono-tech text-[11px] font-extrabold select-none ${
                    state === 'aggravated'
                      ? 'eink-health-solid'
                      : state === 'superficial'
                        ? 'eink-health-slash'
                        : 'bg-[var(--bg-card)] border-[var(--border-ink)]/40 text-transparent'
                  }`}
                >
                  {state === 'aggravated' ? 'X' : state === 'superficial' ? '/' : ''}
                </motion.div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-1.5 pt-1 border-t border-[var(--border-subtle)]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono-tech text-[10px] font-bold text-[var(--ink-primary)] uppercase break-words min-w-0">
                  {t.aggravatedDmg} (X)
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    data-testid="health-aggravated-dec"
                    aria-label={`${t.aggravatedDmg} -`}
                    onClick={() => adjustV5?.(field.id, 'aggravated', -1)}
                    className="no-print print:hidden cyber-btn-outline mobile-touch-stepper w-6 h-6 flex items-center justify-center text-xs font-bold cursor-pointer"
                  >
                    -
                  </button>
                  <span
                    data-testid="health-aggravated-value"
                    className="font-mono-tech text-xs font-bold px-1.5 min-w-[46px] text-center tabular-nums text-[var(--ink-primary)]"
                  >
                    <AnimatedCounter value={agg} /> / <AnimatedCounter value={max} pulseOnChange={false} />
                  </span>
                  <button
                    type="button"
                    data-testid="health-aggravated-inc"
                    aria-label={`${t.aggravatedDmg} +`}
                    onClick={() => adjustV5?.(field.id, 'aggravated', 1)}
                    className="no-print print:hidden cyber-btn-outline mobile-touch-stepper w-6 h-6 flex items-center justify-center text-xs font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono-tech text-[10px] font-bold text-[var(--accent-wine)] uppercase break-words min-w-0">
                  {t.superficialDmg} (/)
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    data-testid="health-superficial-dec"
                    aria-label={`${t.superficialDmg} -`}
                    onClick={() => adjustV5?.(field.id, 'superficial', -1)}
                    className="no-print print:hidden cyber-btn-outline mobile-touch-stepper w-6 h-6 flex items-center justify-center text-xs font-bold cursor-pointer"
                  >
                    -
                  </button>
                  <span
                    data-testid="health-superficial-value"
                    className="font-mono-tech text-xs font-bold px-1.5 min-w-[46px] text-center tabular-nums text-[var(--accent-wine)]"
                  >
                    <AnimatedCounter value={sup} /> / <AnimatedCounter value={max} pulseOnChange={false} />
                  </span>
                  <button
                    type="button"
                    data-testid="health-superficial-inc"
                    aria-label={`${t.superficialDmg} +`}
                    onClick={() => adjustV5?.(field.id, 'superficial', 1)}
                    className="no-print print:hidden cyber-btn-outline mobile-touch-stepper w-6 h-6 flex items-center justify-center text-xs font-bold cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              <div
                data-testid="v5-superficial-halving-bar"
                className="no-print print:hidden mt-0.5 pt-1.5 border-t border-dashed border-[var(--border-ink)]/35 flex flex-wrap items-center justify-between gap-2"
              >
                <span className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-secondary)]">
                  {t.t('cards.vital.reduceSupLabel')}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <input
                    type="number"
                    min={0}
                    max={30}
                    aria-label={t.t('cards.vital.reduceSupAria')}
                    data-testid="v5-halve-superficial-input"
                    value={v5RawSupDamage}
                    onChange={(e) =>
                      setV5RawSupDamage(Math.max(0, Math.min(30, Number(e.target.value) || 0)))
                    }
                    className="cyber-input mobile-touch-input w-14 px-1.5 py-0.5 text-[11px] font-bold text-center tabular-nums"
                  />
                  <button
                    type="button"
                    data-testid="v5-halve-superficial-btn"
                    disabled={halvedIncoming <= 0}
                    onClick={() => onApplyV5SuperficialHalving?.(field.id, v5RawSupDamage)}
                    className="cyber-btn-outline min-h-[36px] sm:min-h-[28px] px-2.5 py-1 text-[10px] font-extrabold uppercase cursor-pointer disabled:opacity-40"
                  >
                    {t.t('cards.vital.reduceSupApply', { amount: halvedIncoming })}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      }

      // V20 / Custom 3-state Health Track (* Aggravated > X Lethal > / Bashing)
      const { max, aggravated: agg, lethal: letDmg, bashing: bashDmg, healthy } =
        getV20HealthBreakdown(field);
      const boxes = Array.from({ length: max }, (_, idx) => {
        if (idx < agg) return 'aggravated' as const;
        if (idx < agg + letDmg) return 'lethal' as const;
        if (idx < agg + letDmg + bashDmg) return 'bashing' as const;
        return 'healthy' as const;
      });

      const v20CellStyle = (state: 'aggravated' | 'lethal' | 'bashing' | 'healthy'): React.CSSProperties | undefined => {
        if (state === 'aggravated') {
          return {
            backgroundColor: 'var(--ink-primary)',
            color: 'var(--bg-card)',
            borderColor: 'var(--border-color)',
          };
        }
        if (state === 'lethal') {
          return {
            backgroundImage:
              'repeating-linear-gradient(45deg, color-mix(in srgb, var(--ink-primary) 20%, transparent) 0 3px, transparent 3px 6px), repeating-linear-gradient(-45deg, color-mix(in srgb, var(--ink-primary) 20%, transparent) 0 3px, transparent 3px 6px)',
            backgroundColor: 'var(--bg-card)',
            color: 'var(--ink-primary)',
            borderColor: 'var(--border-color)',
          };
        }
        if (state === 'bashing') {
          return {
            backgroundImage:
              'repeating-linear-gradient(135deg, color-mix(in srgb, var(--ink-primary) 16%, transparent) 0 3px, transparent 3px 6px)',
            backgroundColor: 'var(--bg-card)',
            color: 'var(--ink-primary)',
            borderColor: 'var(--border-color)',
          };
        }
        return undefined;
      };

      return (
        <div
          data-testid={`health-damage-track-${field.id}`}
          className="p-2.5 bg-[var(--bg-card-alt)] border-[length:var(--border-width)] border-[var(--border-color)] rounded-[var(--radius-card)] flex flex-col gap-2"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
              <span className="font-mono-tech text-xs font-bold tracking-wide text-[var(--ink-primary)] uppercase">
                {field.label}
              </span>
              <span className="font-mono-tech text-[10px] font-bold px-1.5 py-0.5 bg-[var(--accent-cream-badge)] text-[var(--accent-wine)] border border-[var(--accent-wine)] rounded-[var(--radius-pill)] whitespace-nowrap">
                {t.t('cards.vital.v20TrackRule')}
              </span>
              {woundPenalty < 0 && (
                <span
                  data-testid="health-wound-penalty-badge"
                  className="font-mono-tech text-[10px] font-extrabold px-1.5 py-0.5 bg-[var(--accent-danger-soft)] text-[var(--accent-danger)] border border-[var(--accent-danger)] rounded-[var(--radius-pill)] whitespace-nowrap"
                >
                  {t.t('cards.vital.woundPenaltyLabel', { penalty: woundPenalty })}
                </span>
              )}
            </div>
            <span
              data-testid="health-healthy-summary"
              className="font-mono-tech text-[11px] font-bold text-[var(--ink-primary)] tabular-nums whitespace-nowrap"
              aria-live="polite"
            >
              <AnimatedCounter value={healthy} /> / <AnimatedCounter value={max} pulseOnChange={false} />{' '}
              {t.healthyRemaining}
            </span>
          </div>

          <div
            className="seg-meter-track flex items-center gap-[3px]"
            role="meter"
            aria-label={field.label}
            aria-valuemin={0}
            aria-valuemax={max}
            aria-valuenow={healthy}
          >
            {boxes.map((state, idx) => (
              <button
                key={idx}
                type="button"
                data-testid={`v20-health-box-${idx}`}
                aria-label={`${field.label} ${idx + 1}: ${state}`}
                onClick={() => onCycleV20HealthCell?.(field.id, idx)}
                style={v20CellStyle(state)}
                className={`seg-block min-h-[36px] sm:min-h-[26px] flex items-center justify-center font-mono-tech text-xs font-extrabold select-none cursor-pointer ${
                  state === 'aggravated'
                    ? 'eink-health-solid'
                    : state === 'lethal'
                      ? 'eink-health-cross'
                      : state === 'bashing'
                        ? 'eink-health-slash'
                        : 'bg-[var(--bg-card)] border-[var(--border-ink)]/45 text-transparent hover:border-[var(--border-ink)]'
                }`}
              >
                {state === 'aggravated'
                  ? '*'
                  : state === 'lethal'
                    ? 'X'
                    : state === 'bashing'
                      ? '/'
                      : ''}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-1.5 pt-1 border-t border-[var(--border-subtle)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono-tech text-[10px] font-bold text-[var(--ink-primary)] uppercase break-words min-w-0">
                {t.t('cards.vital.aggravatedV20Dmg')}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  data-testid="health-aggravated-dec"
                  aria-label={`${t.t('cards.vital.aggravatedV20Dmg')} -`}
                  onClick={() => onAdjustV20HealthDamage?.(field.id, 'aggravated', -1)}
                  className="no-print print:hidden cyber-btn-outline mobile-touch-stepper w-6 h-6 flex items-center justify-center text-xs font-bold cursor-pointer"
                >
                  -
                </button>
                <span
                  data-testid="health-aggravated-value"
                  className="font-mono-tech text-xs font-bold px-1.5 min-w-[46px] text-center tabular-nums text-[var(--ink-primary)]"
                >
                  <AnimatedCounter value={agg} /> / <AnimatedCounter value={max} pulseOnChange={false} />
                </span>
                <button
                  type="button"
                  data-testid="health-aggravated-inc"
                  aria-label={`${t.t('cards.vital.aggravatedV20Dmg')} +`}
                  onClick={() => onAdjustV20HealthDamage?.(field.id, 'aggravated', 1)}
                  className="no-print print:hidden cyber-btn-outline mobile-touch-stepper w-6 h-6 flex items-center justify-center text-xs font-bold cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono-tech text-[10px] font-bold text-[var(--accent-wine)] uppercase break-words min-w-0">
                {t.t('cards.vital.lethalDmg')}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  data-testid="health-lethal-dec"
                  aria-label={`${t.t('cards.vital.lethalDmg')} -`}
                  onClick={() => onAdjustV20HealthDamage?.(field.id, 'lethal', -1)}
                  className="no-print print:hidden cyber-btn-outline mobile-touch-stepper w-6 h-6 flex items-center justify-center text-xs font-bold cursor-pointer"
                >
                  -
                </button>
                <span
                  data-testid="health-lethal-value"
                  className="font-mono-tech text-xs font-bold px-1.5 min-w-[46px] text-center tabular-nums text-[var(--accent-wine)]"
                >
                  <AnimatedCounter value={letDmg} /> / <AnimatedCounter value={max} pulseOnChange={false} />
                </span>
                <button
                  type="button"
                  data-testid="health-lethal-inc"
                  aria-label={`${t.t('cards.vital.lethalDmg')} +`}
                  onClick={() => onAdjustV20HealthDamage?.(field.id, 'lethal', 1)}
                  className="no-print print:hidden cyber-btn-outline mobile-touch-stepper w-6 h-6 flex items-center justify-center text-xs font-bold cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono-tech text-[10px] font-bold text-[var(--ink-secondary)] uppercase break-words min-w-0">
                {t.t('cards.vital.bashingDmg')}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  data-testid="health-bashing-dec"
                  aria-label={`${t.t('cards.vital.bashingDmg')} -`}
                  onClick={() => onAdjustV20HealthDamage?.(field.id, 'bashing', -1)}
                  className="no-print print:hidden cyber-btn-outline mobile-touch-stepper w-6 h-6 flex items-center justify-center text-xs font-bold cursor-pointer"
                >
                  -
                </button>
                <span
                  data-testid="health-bashing-value"
                  className="font-mono-tech text-xs font-bold px-1.5 min-w-[46px] text-center tabular-nums text-[var(--ink-secondary)]"
                >
                  <AnimatedCounter value={bashDmg} /> / <AnimatedCounter value={max} pulseOnChange={false} />
                </span>
                <button
                  type="button"
                  data-testid="health-bashing-inc"
                  aria-label={`${t.t('cards.vital.bashingDmg')} +`}
                  onClick={() => onAdjustV20HealthDamage?.(field.id, 'bashing', 1)}
                  className="no-print print:hidden cyber-btn-outline mobile-touch-stepper w-6 h-6 flex items-center justify-center text-xs font-bold cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // 3B. Recurso Padrão
    if (field.kind === 'resource') {
      const max = Math.max(1, field.max ?? 12);
      const current = Math.max(0, Math.min(max, typeof field.value === 'number' ? field.value : 0));
      const isWillpowerField = field.id === 'f_willpower' || field.key === 'willpower';
      const wpSuperficial =
        isWillpowerField && rulePreset === 'vampire-v5'
          ? Math.max(0, Math.min(max - current, field.superficialDamage ?? 0))
          : 0;
      const useContinuousBar = max > 20;
      const fillPct = Math.max(0, Math.min(100, (current / max) * 100));
      const segments = useContinuousBar ? [] : Array.from({ length: max }, (_, idx) => idx);

      return (
        <div
          data-testid={`resource-field-${field.id}`}
          className="p-2.5 bg-[var(--bg-card-alt)] border-[1.5px] border-[var(--border-subtle)] rounded-[var(--radius-card)] min-w-0 max-w-full overflow-hidden"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span className="font-mono-tech text-xs font-bold tracking-wide text-[var(--ink-primary)] uppercase break-words min-w-0">
              {field.label}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                aria-label={t.t('cards.decreaseAria', { label: field.label })}
                onClick={() => onAdjustResource(field.id, -1)}
                className="no-print print:hidden cyber-btn-outline mobile-touch-stepper w-6 h-6 flex items-center justify-center text-xs font-bold cursor-pointer"
              >
                -
              </button>
              <span
                className="font-mono-tech text-xs font-bold px-2 min-w-[56px] text-center tabular-nums"
                aria-live="polite"
              >
                <AnimatedCounter value={current} /> / <AnimatedCounter value={max} pulseOnChange={false} />
              </span>
              <button
                type="button"
                aria-label={t.t('cards.increaseAria', { label: field.label })}
                onClick={() => onAdjustResource(field.id, 1)}
                className="no-print print:hidden cyber-btn-outline mobile-touch-stepper w-6 h-6 flex items-center justify-center text-xs font-bold cursor-pointer"
              >
                +
              </button>
            </div>
          </div>

          {useContinuousBar ? (
            <div
              data-testid={`resource-continuous-bar-${field.id}`}
              className="seg-meter-track relative h-[14px] rounded-[var(--radius-pill)] bg-[var(--accent-wine-soft)] border border-[var(--seg-border)] cursor-pointer overflow-hidden"
              role="meter"
              aria-label={field.label}
              aria-valuemin={0}
              aria-valuemax={max}
              aria-valuenow={current}
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                if (rect.width <= 0) return;
                const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                onChangeValue(field.id, Math.round(ratio * max));
              }}
            >
              <motion.div
                className="h-full bg-[var(--accent-primary)]"
                initial={false}
                animate={{ width: `${fillPct}%` }}
                transition={
                  shouldReduceMotion
                    ? { duration: 0 }
                    : { duration: 0.38, ease: [0.22, 1, 0.36, 1] }
                }
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-[25%] w-[1.5px] bg-[var(--border-color)]/55"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-[50%] w-[1.5px] bg-[var(--border-color)]/55"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-[75%] w-[1.5px] bg-[var(--border-color)]/55"
              />
            </div>
          ) : useWodDots && max === dotConfig.max ? (
            <DotRating
              label={field.label}
              value={current}
              min={dotConfig.min}
              max={dotConfig.max}
              onChange={(next) => onChangeValue(field.id, next)}
              t={t}
              showQuickEdit={false}
              testId={`resource-dot-rating-${field.id}`}
            />
          ) : (
            <div
              data-testid={`resource-segmented-bar-${field.id}`}
              className="seg-meter-track flex items-center gap-[3px]"
              role="meter"
              aria-label={field.label}
              aria-valuemin={0}
              aria-valuemax={max}
              aria-valuenow={current}
            >
              {segments.map((idx) => {
                const filled = idx < current;
                const isSupDamaged = !filled && idx >= current && idx < current + wpSuperficial;
                return (
                  <motion.button
                    key={idx}
                    type="button"
                    aria-label={t.t('cards.setResourceAria', { label: field.label, value: idx + 1 })}
                    onClick={() => onChangeValue(field.id, idx + 1 === current ? idx : idx + 1)}
                    initial={false}
                    animate={{ scale: filled ? 1 : 0.95 }}
                    transition={
                      shouldReduceMotion ? { duration: 0 } : { duration: 0.16, ease: 'easeOut' }
                    }
                    style={
                      isSupDamaged
                        ? {
                            backgroundImage:
                              'repeating-linear-gradient(135deg, color-mix(in srgb, var(--ink-primary) 18%, transparent) 0 3px, transparent 3px 6px)',
                            backgroundColor: 'var(--bg-card)',
                            color: 'var(--ink-primary)',
                            borderColor: 'var(--border-color)',
                          }
                        : undefined
                    }
                    className={`seg-block cursor-pointer flex items-center justify-center font-mono-tech text-[10px] font-extrabold ${
                      filled ? 'is-filled' : ''
                    }`}
                  >
                    {isSupDamaged ? '/' : ''}
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    // 4. Booleano / Contador
    if (field.kind === 'boolean') {
      const checked = Boolean(field.value);
      const isWillpowerAutoSuccess = field.id === 'f_wp_boost' || field.key === 'wp_boost';

      if (isWillpowerAutoSuccess && rulePreset === 'vampire-v5') {
        const currentWillpower = typeof variables.willpower === 'number' ? variables.willpower : 0;
        const isDisabled = currentWillpower <= 0 || !canWillpowerSurge;
        return (
          <div
            data-testid="willpower-surge-panel"
            className="py-1 flex flex-col gap-1.5 p-2.5 bg-[var(--bg-card-alt)] border-[1.5px] border-[var(--border-ink)] rounded-[var(--radius-control)]"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="font-mono-tech text-xs font-bold tracking-wide uppercase text-[var(--ink-primary)] break-words">
                  {t.t('cards.vital.wpSurgeLabel')}
                </div>
                <div className="font-mono-tech text-[10px] text-[var(--ink-secondary)]">
                  {t.t('cards.vital.wpSurgeHint')}
                </div>
              </div>
              <button
                type="button"
                data-testid="willpower-surge-btn"
                disabled={isDisabled}
                onClick={() => onTriggerWillpowerSurge?.()}
                className="cyber-roll-btn min-h-[36px] px-3 py-1.5 text-[10px] font-extrabold uppercase shrink-0 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
              >
                {canWillpowerSurge
                  ? t.t('cards.vital.wpSurgeBtn')
                  : t.t('cards.vital.wpSurgeNoRoll')}
              </button>
            </div>
          </div>
        );
      }

      if (isWillpowerAutoSuccess) {
        const currentWillpower = typeof variables.willpower === 'number' ? variables.willpower : 0;
        const isEmpty = currentWillpower <= 0;
        const effectiveChecked = checked && !isEmpty;
        const badgeLabel = isEmpty ? t.empty : effectiveChecked ? t.active : t.inactive;

        return (
          <div className="py-1">
            <button
              type="button"
              role="checkbox"
              aria-checked={effectiveChecked}
              disabled={isEmpty}
              data-testid="willpower-auto-success-toggle"
              onClick={() => {
                if (!isEmpty) {
                  onChangeValue(field.id, !checked);
                }
              }}
              className={`w-full flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 px-2.5 py-2 border-[1.5px] border-[var(--border-ink)] rounded-[var(--radius-control)] transition-colors text-left ${
                isEmpty
                  ? 'bg-[var(--bg-header-strip)] border-dashed cursor-not-allowed'
                  : effectiveChecked
                    ? 'bg-[var(--accent-cream-badge)] hover:bg-[var(--bg-hover)] cursor-pointer'
                    : 'bg-[var(--bg-card-alt)] hover:bg-[var(--bg-hover)] cursor-pointer'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span
                  className={`w-5 h-5 rounded-[4px] border-2 flex items-center justify-center shrink-0 transition-colors ${
                    effectiveChecked
                      ? 'border-[var(--border-ink)] bg-[var(--accent-wine)] text-[var(--ink-inverse)]'
                      : isEmpty
                        ? 'border-dashed border-[var(--ink-muted)] bg-[var(--bg-card)] text-transparent'
                        : 'border-[var(--border-ink)] bg-[var(--bg-card)] text-transparent'
                  }`}
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" aria-hidden="true" />
                </span>
                <span
                  className={`font-mono-tech text-xs font-bold tracking-wide uppercase break-words leading-snug ${
                    isEmpty ? 'text-[var(--ink-secondary)]' : 'text-[var(--ink-primary)]'
                  }`}
                >
                  {field.label}
                </span>
              </div>
              <span
                data-testid="willpower-auto-success-badge"
                className={`font-mono-tech text-[10px] font-extrabold px-2 py-0.5 rounded-[var(--radius-pill)] border shrink-0 tracking-wider uppercase ${
                  isEmpty
                    ? 'bg-[var(--accent-danger-soft)] text-[var(--accent-danger)] border-[var(--accent-danger)]'
                    : effectiveChecked
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-color)]'
                      : 'bg-[var(--bg-card)] text-[var(--text-secondary)] border-[var(--border-color)]/65'
                }`}
              >
                {badgeLabel}
              </span>
            </button>
          </div>
        );
      }

      return (
        <div className="py-1">
          <button
            type="button"
            role="checkbox"
            aria-checked={checked}
            onClick={() => onChangeValue(field.id, !checked)}
            className="w-full flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 px-2.5 py-2 bg-[var(--bg-card-alt)] border-[1.5px] border-[var(--border-ink)] rounded-[var(--radius-control)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <span
                className={`w-5 h-5 rounded-[4px] border-2 border-[var(--border-ink)] flex items-center justify-center shrink-0 transition-colors ${
                  checked
                    ? 'bg-[var(--accent-wine)] text-[var(--ink-inverse)]'
                    : 'bg-[var(--bg-card)] text-transparent'
                }`}
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" aria-hidden="true" />
              </span>
              <span className="font-mono-tech text-xs font-bold tracking-wide text-[var(--ink-primary)] uppercase break-words leading-snug">
                {field.label}
              </span>
            </div>
            {field.hint && (
              <span className="font-mono-tech text-[10px] text-[var(--ink-muted)] shrink-0">
                {checked ? t.active : t.inactive}
              </span>
            )}
          </button>
        </div>
      );
    }

    // 5. Botão de Rolagem
    if (field.kind === 'roll') {
      const parsedPool = parseWodPoolExpression(field.rollExpr ?? '');

      if (parsedPool) {
        const exprDiff = Number(parsedPool.diffExpr);
        const defaultDiff = Number.isFinite(exprDiff) ? exprDiff : 6;
        return (
          <WodPoolRollField
            field={field}
            variables={variables}
            defaultDifficulty={defaultDiff}
            rulePreset={rulePreset}
            woundPenalty={woundPenalty}
            bloodSurge={bloodSurge}
            lastSoakTotal={lastSoakTotal}
            t={t}
            onRoll={onRoll}
            onUpdateSchema={onUpdateSchema}
          />
        );
      }

      const previewExpr = resolveRollPreview(field.rollExpr ?? '1d20', variables);
      const displayLabel = `${field.rollLabel ?? field.label} · ${previewExpr}`;
      return (
        <div className="py-0.5">
          <button
            type="button"
            data-testid={`roll-btn-${field.id}`}
            onClick={() => onRoll(field)}
            className="cyber-roll-btn min-h-[36px] w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs font-bold tracking-wider uppercase cursor-pointer"
          >
            <span className="text-left break-words whitespace-normal leading-snug min-w-0">
              {displayLabel}
            </span>
            <span className="text-sm leading-none shrink-0" aria-hidden="true">
              ↗
            </span>
          </button>
        </div>
      );
    }

    // 6. Lista Repetível
    if (field.kind === 'repeatable') {
      const rows = field.rows ?? [];
      const col1Title = field.columns?.[0] ?? t.t('cards.defaultItemCol');
      const col2Title = field.columns?.[1] ?? t.t('cards.defaultValueCol');
      const officialEdition = isOfficialVampireSheet(systemId, rulePreset) ? rulePreset : null;
      const parsedCostByRowId = new Map(
        mode === 'jogo' && officialEdition && field.col2Type !== 'number'
          ? rows.map((row) => [row.id, parsePowerActivationCost(row.col2, officialEdition)])
          : [],
      );
      const hasAnyPowerTrigger = Array.from(parsedCostByRowId.values()).some(
        (cost) =>
          (officialEdition === 'vampire-v5' && cost.costType === 'rouse' && cost.costAmount > 0) ||
          (officialEdition === 'storyteller-v20' &&
            cost.costType === 'blood_point' &&
            cost.costAmount > 0),
      );
      const currentBlood = bloodPool?.current ?? 0;

      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono-tech text-xs font-bold tracking-wider text-[var(--ink-primary)] uppercase">
              {field.label}
            </span>
            {field.col2Type === 'number' && (
              <span className="font-mono-tech text-[11px] font-bold px-2 py-0.5 bg-[var(--accent-cream-badge)] text-[var(--accent-wine)] border border-[var(--accent-wine)] rounded-[var(--radius-pill)]">
                {t.cargoBadge} {totalCargoWeight} KG
              </span>
            )}
          </div>

          <div className="border-[length:var(--border-width)] border-[var(--border-color)] rounded-[var(--radius-card)] overflow-x-auto max-w-full bg-[var(--bg-card-alt)]">
            <table className="w-full min-w-[280px] border-collapse font-mono-tech text-xs">
              <thead>
                <tr className="bg-[var(--bg-header-strip)] border-b-[1.5px] border-[var(--border-ink)] text-[10px] text-[var(--ink-muted)] uppercase">
                  <th scope="col" className="text-left py-2 px-2.5 font-bold">
                    {col1Title}
                  </th>
                  <th scope="col" className="text-right py-2 px-2.5 font-bold w-28">
                    {col2Title}
                  </th>
                  {hasAnyPowerTrigger && (
                    <th
                      scope="col"
                      aria-label={t.t('cards.powers.actionColAria')}
                      className="w-24 text-right py-2 px-2 font-bold no-print print:hidden"
                    >
                      <span className="sr-only">{t.t('cards.powers.actionColAria')}</span>
                    </th>
                  )}
                  <th
                    scope="col"
                    className="w-9 no-print print:hidden"
                    aria-label={t.t('cards.actionsColAria')}
                  />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={hasAnyPowerTrigger ? 4 : 3}
                      className="py-4 px-3 text-center text-[11px] text-[var(--ink-muted)]"
                    >
                      {t.emptyTable}
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => {
                    const costInfo = parsedCostByRowId.get(row.id);
                    const isV5Rouse =
                      officialEdition === 'vampire-v5' &&
                      costInfo?.costType === 'rouse' &&
                      costInfo.costAmount > 0;
                    const isV20Blood =
                      officialEdition === 'storyteller-v20' &&
                      costInfo?.costType === 'blood_point' &&
                      costInfo.costAmount > 0;
                    const rouseBtnText =
                      isV5Rouse && costInfo
                        ? costInfo.costAmount > 1
                          ? t.t('cards.powers.rouseMultiBtn', { count: costInfo.costAmount })
                          : t.t('cards.powers.rouseBtn')
                        : '';
                    const hasEnoughBlood =
                      isV20Blood && costInfo ? currentBlood >= costInfo.costAmount : true;

                    return (
                      <tr
                        key={row.id}
                        className="border-b border-[var(--border-subtle)] last:border-b-0 bg-[var(--bg-card)] hover:bg-[var(--bg-hover)]"
                      >
                        <td className="p-1.5">
                          <input
                            type="text"
                            aria-label={t.t('cards.rowColAria', { col: col1Title, row: row.col1 })}
                            value={row.col1}
                            onChange={(e) => onUpdateRow(field.id, row.id, 'col1', e.target.value)}
                            className="mobile-touch-input w-full bg-transparent px-1.5 py-1 text-xs font-medium text-[var(--ink-primary)] focus:outline-none focus:bg-[var(--bg-card-alt)] rounded-[var(--radius-pill)]"
                          />
                        </td>
                        <td className="p-1.5">
                          <input
                            type={field.col2Type === 'number' ? 'number' : 'text'}
                            step={field.col2Type === 'number' ? '0.5' : undefined}
                            aria-label={t.t('cards.rowColAria', { col: col2Title, row: row.col1 })}
                            value={row.col2}
                            onChange={(e) =>
                              onUpdateRow(
                                field.id,
                                row.id,
                                'col2',
                                field.col2Type === 'number' ? Number(e.target.value) : e.target.value,
                              )
                            }
                            className="mobile-touch-input w-full bg-transparent px-1.5 py-1 text-xs font-bold text-right text-[var(--ink-primary)] focus:outline-none focus:bg-[var(--bg-card-alt)] rounded-[var(--radius-pill)]"
                          />
                        </td>
                        {hasAnyPowerTrigger && (
                          <td className="p-1.5 text-right no-print print:hidden">
                            {isV5Rouse && costInfo ? (
                              <button
                                type="button"
                                data-testid={`power-rouse-btn-${row.id}`}
                                aria-label={t.t('cards.powers.rouseAria', {
                                  btn: rouseBtnText,
                                  power: row.col1,
                                })}
                                onClick={() =>
                                  onRouseCheck?.({ label: row.col1, count: costInfo.costAmount })
                                }
                                className="wod-power-trigger-btn"
                              >
                                {rouseBtnText}
                              </button>
                            ) : isV20Blood && costInfo ? (
                              <button
                                type="button"
                                data-testid={`power-blood-btn-${row.id}`}
                                disabled={!hasEnoughBlood}
                                title={
                                  !hasEnoughBlood
                                    ? t.t('cards.powers.insufficientBloodHint', {
                                        cost: costInfo.costAmount,
                                        current: currentBlood,
                                      })
                                    : undefined
                                }
                                aria-label={t.t('cards.powers.spendBloodAria', {
                                  cost: costInfo.costAmount,
                                  power: row.col1,
                                })}
                                onClick={() =>
                                  onSpendPowerBlood?.(costInfo.costAmount, row.col1)
                                }
                                className="wod-power-trigger-btn"
                              >
                                {t.t('cards.powers.spendBloodBtn', { cost: costInfo.costAmount })}
                              </button>
                            ) : null}
                          </td>
                        )}
                        <td className="p-1.5 text-center no-print print:hidden">
                          <button
                            type="button"
                            aria-label={t.t('cards.removeRowAria', { row: row.col1 })}
                            onClick={() => onRemoveRow(field.id, row.id)}
                            className="mobile-touch-stepper w-6 h-6 inline-flex items-center justify-center rounded-[var(--radius-pill)] border border-transparent hover:border-[var(--border-ink)] hover:bg-[var(--accent-danger-soft)] hover:text-[var(--accent-danger)] text-[var(--ink-muted)] cursor-pointer transition-colors"
                          >
                            <X className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={() => onAddRow(field.id)}
            className="no-print print:hidden font-mono-tech min-h-[36px] self-start inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase border-[1.5px] border-dashed border-[var(--border-ink)] rounded-[var(--radius-control)] hover:bg-[var(--accent-wine)] hover:text-[var(--ink-inverse)] transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t.addRow}</span>
          </button>
        </div>
      );
    }

    return null;
  };

  const body = renderFieldBody();
  if (!body) return null;

  if (mode !== 'edicao') {
    return <>{body}</>;
  }

  return (
    <div
      data-testid={`edit-field-wrapper-${field.id}`}
      className={`rounded-[var(--radius-card)] transition-colors ${
        shouldShowEditStrip
          ? 'p-2 border-[1.5px] border-[var(--accent-wine)] bg-[var(--bg-card-alt)]/55'
          : 'p-1.5 border border-dashed border-[var(--border-ink)]/30 hover:border-[var(--border-ink)]/65'
      }`}
    >
      <div className="no-print print:hidden flex items-center justify-between gap-2 pb-1 mb-0.5 border-b border-[var(--border-subtle)]/70">
        <span className="font-mono-tech text-[9px] font-bold uppercase tracking-wider text-[var(--ink-muted)] truncate">
          {shouldShowEditStrip ? `${ctrlLabels.editingTag} · ${field.key}` : field.kind.toUpperCase()}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {onMoveUp && (
            <button
              type="button"
              data-testid={`move-field-up-${field.id}`}
              aria-label={`${ctrlLabels.moveUp}: ${field.label}`}
              disabled={!canMoveUp}
              onClick={onMoveUp}
              className="w-7 h-7 sm:w-6 sm:h-6 inline-flex items-center justify-center rounded-[var(--radius-pill)] border border-[var(--border-ink)]/55 bg-[var(--bg-card)] text-[var(--ink-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <ArrowUp className="w-3 h-3" aria-hidden="true" />
            </button>
          )}
          {onMoveDown && (
            <button
              type="button"
              data-testid={`move-field-down-${field.id}`}
              aria-label={`${ctrlLabels.moveDown}: ${field.label}`}
              disabled={!canMoveDown}
              onClick={onMoveDown}
              className="w-7 h-7 sm:w-6 sm:h-6 inline-flex items-center justify-center rounded-[var(--radius-pill)] border border-[var(--border-ink)]/55 bg-[var(--bg-card)] text-[var(--ink-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <ArrowDown className="w-3 h-3" aria-hidden="true" />
            </button>
          )}
          {onToggleEdit && (
            <button
              type="button"
              data-testid={`edit-field-toggle-${field.id}`}
              aria-expanded={Boolean(isEditOpen)}
              aria-label={`${isEditOpen ? ctrlLabels.closeEdit : ctrlLabels.editField}: ${field.label}`}
              onClick={onToggleEdit}
              className={`min-h-[28px] px-2 inline-flex items-center gap-1 rounded-[var(--radius-pill)] border font-mono-tech text-[9px] font-bold uppercase cursor-pointer transition-colors ${
                isEditOpen
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-color)]'
                  : 'bg-[var(--bg-card)] text-[var(--ink-primary)] border-[var(--border-ink)]/65 hover:bg-[var(--bg-hover)]'
              }`}
            >
              <Settings2 className="w-3 h-3" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {body}
      {renderEditStrip()}
    </div>
  );
};
