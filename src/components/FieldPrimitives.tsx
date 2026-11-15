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
  resolveRollPreview,
  SheetField,
  SystemId,
} from '../core/sheetModel';
import { parseWodPoolExpression, VariableMap } from '../core/formula';
import { AppLanguage, AppTranslations, getTranslations } from '../core/i18n';
import { AnimatedCounter } from './AnimatedCounter';

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

function inferLangFromCardsT(t: AppTranslations['cards']): AppLanguage {
  if (t.addFieldHeading === '+ ADD FIELD') return 'en';
  if (t.addFieldHeading === '+ AÑADIR CAMPO') return 'es';
  return 'pt-BR';
}

const EDIT_CTRL_LABELS: Record<
  AppLanguage,
  {
    moveUp: string;
    moveDown: string;
    editField: string;
    closeEdit: string;
    editingTag: string;
    diffMinus: string;
    diffPlus: string;
  }
> = {
  'pt-BR': {
    moveUp: 'Mover campo para cima',
    moveDown: 'Mover campo para baixo',
    editField: 'Configurar campo',
    closeEdit: 'Fechar edição do campo',
    editingTag: 'EDITANDO',
    diffMinus: 'Diminuir dificuldade',
    diffPlus: 'Aumentar dificuldade',
  },
  en: {
    moveUp: 'Move field up',
    moveDown: 'Move field down',
    editField: 'Edit field',
    closeEdit: 'Close field editor',
    editingTag: 'EDITING',
    diffMinus: 'Decrease difficulty',
    diffPlus: 'Increase difficulty',
  },
  es: {
    moveUp: 'Subir campo',
    moveDown: 'Bajar campo',
    editField: 'Configurar campo',
    closeEdit: 'Cerrar edición del campo',
    editingTag: 'EDITANDO',
    diffMinus: 'Reducir dificultad',
    diffPlus: 'Aumentar dificultad',
  },
};

interface WodPoolRollFieldProps {
  field: SheetField;
  variables: VariableMap;
  defaultDifficulty: number;
  t: AppTranslations['cards'];
  onRoll: (field: SheetField) => void;
  onUpdateSchema: (fieldId: string, patch: Partial<SheetField>) => void;
}

const WodPoolRollField: React.FC<WodPoolRollFieldProps> = ({
  field,
  variables,
  defaultDifficulty,
  t,
  onRoll,
  onUpdateSchema,
}) => {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const lang = inferLangFromCardsT(t);
  const ctrlLabels = EDIT_CTRL_LABELS[lang];

  const clampedDefaultDiff = Math.max(2, Math.min(10, Math.round(defaultDifficulty)));
  const difficulty = Math.max(
    2,
    Math.min(10, Math.round(field.rollDifficulty ?? clampedDefaultDiff)),
  );
  const specialty = Boolean(field.rollSpecialty);
  const modifier =
    typeof field.rollMod === 'number' && Number.isFinite(field.rollMod)
      ? Math.round(field.rollMod)
      : 0;

  const previewExpr = resolveRollPreview(field.rollExpr ?? 'pool(1, 6)', variables, {
    difficulty,
    modifier,
    specialty,
  });
  const wpArmed = Boolean(variables.wp_boost) && (variables.willpower ?? 0) > 0;
  const displayLabel = `${field.rollLabel ?? field.label} · ${previewExpr}`;

  const summaryParts = [`${t.t('cards.pool.diff')} ${difficulty}`];
  if (modifier !== 0) {
    summaryParts.push(`${modifier > 0 ? `+${modifier}` : modifier} ${t.t('cards.pool.mod')}`);
  }
  if (specialty) {
    summaryParts.push(t.t('cards.pool.specShort'));
  }
  const isCustomized = difficulty !== clampedDefaultDiff || modifier !== 0 || specialty;

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
        <div className="flex items-center gap-1.5 shrink-0">
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
              <span>{summaryParts.join(' · ')}</span>
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
                disabled={difficulty <= 2}
                onClick={() =>
                  onUpdateSchema(field.id, { rollDifficulty: Math.max(2, difficulty - 1) })
                }
                className="min-h-[36px] sm:min-h-[28px] w-7 inline-flex items-center justify-center text-[var(--ink-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
              >
                <Minus className="w-3 h-3" aria-hidden="true" />
              </button>
              <button
                type="button"
                data-testid={`roll-diff-inc-${field.id}`}
                aria-label={`${ctrlLabels.diffPlus}: ${field.rollLabel ?? field.label}`}
                disabled={difficulty >= 10}
                onClick={() =>
                  onUpdateSchema(field.id, { rollDifficulty: Math.min(10, difficulty + 1) })
                }
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
                <span>{t.t('cards.pool.diff')}</span>
                <ClampedNumberInput
                  min={2}
                  max={10}
                  ariaLabel={t.t('cards.pool.diffAria', { label: field.rollLabel ?? field.label })}
                  testId={`roll-diff-${field.id}`}
                  value={difficulty}
                  onCommit={(next) => onUpdateSchema(field.id, { rollDifficulty: next })}
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
          </div>
        )}
      </div>
    </div>
  );
};

interface FieldPrimitiveProps {
  field: SheetField;
  mode: AppMode;
  systemId?: SystemId;
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
  mode,
  systemId = 'wod',
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
  onRoll,
  onAddRow,
  onUpdateRow,
  onRemoveRow,
  onUpdateSchema,
  onRemoveField,
}) => {
  const inputId = `field_${field.id}`;
  const isCustomSystem = systemId === 'blank';
  const lang = inferLangFromCardsT(t);
  const ctrlLabels = EDIT_CTRL_LABELS[lang];
  const prefersReducedMotion = useReducedMotion();
  const isEinkTheme =
    typeof document !== 'undefined' && document.documentElement?.dataset?.theme === 'eink';
  const shouldReduceMotion = Boolean(prefersReducedMotion || isEinkTheme);
  const shouldShowEditStrip =
    mode === 'edicao' && (onToggleEdit ? Boolean(isEditOpen) : true);

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
            value={typeof field.value === 'number' ? field.value : 0}
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

    // 3A. Recurso especial: WoD Health Damage Track
    if (field.kind === 'resource' && field.damageTrack) {
      const max = Math.max(1, field.max ?? 7);
      const agg = Math.max(
        0,
        Math.min(
          max,
          typeof field.aggravatedDamage === 'number'
            ? field.aggravatedDamage
            : Math.max(0, max - (typeof field.value === 'number' ? field.value : max)),
        ),
      );
      const sup = agg >= max ? 0 : Math.max(0, Math.min(max - 1, field.superficialDamage ?? 0));
      const healthy = Math.max(0, max - agg);
      const totalSupEq = agg * max + sup;
      const boxes = Array.from({ length: max }, (_, idx) => {
        if (idx < agg) return 'aggravated' as const;
        if (idx < agg + sup) return 'superficial' as const;
        return 'healthy' as const;
      });

      return (
        <div
          data-testid={`health-damage-track-${field.id}`}
          className="p-2.5 bg-[var(--bg-card-alt)] border-[length:var(--border-width)] border-[var(--border-color)] rounded-[var(--radius-card)] flex flex-col gap-2"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono-tech text-xs font-bold tracking-wide text-[var(--ink-primary)] uppercase">
                {field.label}
              </span>
              <span className="font-mono-tech text-[10px] font-bold px-1.5 py-0.5 bg-[var(--accent-cream-badge)] text-[var(--accent-wine)] border border-[var(--accent-wine)] rounded-[var(--radius-pill)] whitespace-nowrap">
                {t.aggEqRule(max)}
              </span>
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
                className={`seg-block h-[18px] flex items-center justify-center font-mono-tech text-[10px] font-extrabold select-none ${
                  state === 'aggravated'
                    ? 'is-aggravated'
                    : state === 'superficial'
                      ? 'is-superficial'
                      : 'bg-[var(--bg-card)] border-[var(--border-ink)]/40 text-transparent'
                }`}
              >
                {state === 'aggravated' ? '✕' : state === 'superficial' ? '/' : ''}
              </motion.div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-1.5 pt-1 border-t border-[var(--border-subtle)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-mono-tech text-[10px] font-bold text-[var(--ink-primary)] uppercase break-words">
                  {t.aggravatedDmg}
                </span>
                <span className="font-mono-tech text-[9px] font-semibold text-[var(--ink-muted)] tabular-nums shrink-0">
                  ({t.supEqTag(totalSupEq)})
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  data-testid="health-aggravated-dec"
                  aria-label={`${t.aggravatedDmg} -`}
                  onClick={() => onAdjustHealthDamage?.(field.id, 'aggravated', -1)}
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
                  onClick={() => onAdjustHealthDamage?.(field.id, 'aggravated', 1)}
                  className="no-print print:hidden cyber-btn-outline mobile-touch-stepper w-6 h-6 flex items-center justify-center text-xs font-bold cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono-tech text-[10px] font-bold text-[var(--accent-wine)] uppercase break-words min-w-0">
                {t.superficialDmg}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  data-testid="health-superficial-dec"
                  aria-label={`${t.superficialDmg} -`}
                  onClick={() => onAdjustHealthDamage?.(field.id, 'superficial', -1)}
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
                  onClick={() => onAdjustHealthDamage?.(field.id, 'superficial', 1)}
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
            </div>
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
                    className={`seg-block cursor-pointer ${filled ? 'is-filled' : ''}`}
                  />
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
                  <th className="text-left py-2 px-2.5 font-bold">{col1Title}</th>
                  <th className="text-right py-2 px-2.5 font-bold w-28">{col2Title}</th>
                  <th className="w-9 no-print print:hidden" aria-label={t.t('cards.actionsColAria')} />
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-4 px-3 text-center text-[11px] text-[var(--ink-muted)]">
                      {t.emptyTable}
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
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
                  ))
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
