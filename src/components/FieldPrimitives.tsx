import React, { useEffect, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import {
  AppMode,
  ComputedFieldInfo,
  resolveRollPreview,
  SheetField,
} from '../core/sheetModel';
import { parseWodPoolExpression, VariableMap } from '../core/formula';
import { AppTranslations, getTranslations } from '../core/i18n';

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

interface FieldPrimitiveProps {
  field: SheetField;
  mode: AppMode;
  variables: VariableMap;
  computed?: ComputedFieldInfo;
  totalCargoWeight: number;
  t?: AppTranslations['cards'];
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
  variables,
  computed,
  totalCargoWeight,
  t = DEFAULT_CARDS_T,
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

  const renderEditStrip = () => {
    if (mode !== 'edicao') return null;
    return (
      <div className="no-print print:hidden mt-2 pt-2 border-t border-dashed border-[var(--border-ink)]/40 grid grid-cols-1 sm:grid-cols-2 gap-1.5 bg-[var(--bg-header-strip)] p-2 rounded-[4px]">
        <div className="flex items-center gap-1.5">
          <span className="font-mono-tech text-[10px] font-bold text-[var(--ink-muted)] uppercase shrink-0">
            RÓTULO:
          </span>
          <input
            type="text"
            aria-label={`Editar rótulo de ${field.label}`}
            value={field.label}
            onChange={(e) => onUpdateSchema(field.id, { label: e.target.value })}
            className="cyber-input mobile-touch-input px-1.5 py-0.5 text-[11px] w-full"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-mono-tech text-[10px] font-bold text-[var(--ink-muted)] uppercase shrink-0">
            VAR:
          </span>
          <input
            type="text"
            aria-label={`Editar variável de ${field.label}`}
            value={field.key}
            onChange={(e) => onUpdateSchema(field.id, { key: e.target.value })}
            className="cyber-input mobile-touch-input px-1.5 py-0.5 text-[11px] w-full"
          />
        </div>
        {field.kind === 'calculated' && (
          <div className="sm:col-span-2 flex items-center gap-1.5">
            <span className="font-mono-tech text-[10px] font-bold text-[var(--accent-wine)] uppercase shrink-0">
              FÓRMULA:
            </span>
            <input
              type="text"
              aria-label={`Editar fórmula de ${field.label}`}
              value={field.formula ?? ''}
              onChange={(e) => onUpdateSchema(field.id, { formula: e.target.value })}
              className="cyber-input mobile-touch-input px-1.5 py-0.5 text-[11px] w-full"
            />
          </div>
        )}
        {field.kind === 'roll' && (
          <>
            <div className="flex items-center gap-1.5">
              <span className="font-mono-tech text-[10px] font-bold text-[var(--accent-wine)] uppercase shrink-0">
                BOTÃO:
              </span>
              <input
                type="text"
                aria-label={`Editar texto do botão de ${field.label}`}
                value={field.rollLabel ?? ''}
                onChange={(e) => onUpdateSchema(field.id, { rollLabel: e.target.value })}
                className="cyber-input mobile-touch-input px-1.5 py-0.5 text-[11px] w-full"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono-tech text-[10px] font-bold text-[var(--accent-wine)] uppercase shrink-0">
                DADOS:
              </span>
              <input
                type="text"
                aria-label={`Editar expressão de dados de ${field.label}`}
                value={field.rollExpr ?? ''}
                onChange={(e) => onUpdateSchema(field.id, { rollExpr: e.target.value })}
                className="cyber-input mobile-touch-input px-1.5 py-0.5 text-[11px] w-full"
              />
            </div>
          </>
        )}
        {field.kind === 'resource' && (
          <div className="flex items-center gap-1.5">
            <span className="font-mono-tech text-[10px] font-bold text-[var(--accent-wine)] uppercase shrink-0">
              MÁXIMO:
            </span>
            <input
              type="number"
              min={1}
              max={999}
              aria-label={`Editar máximo de ${field.label}`}
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
                COL 1:
              </span>
              <input
                type="text"
                aria-label={`Editar coluna 1 de ${field.label}`}
                value={field.columns?.[0] ?? 'ITEM'}
                onChange={(e) =>
                  onUpdateSchema(field.id, {
                    columns: [e.target.value, field.columns?.[1] ?? 'VALOR'],
                  })
                }
                className="cyber-input mobile-touch-input px-1.5 py-0.5 text-[11px] w-full"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono-tech text-[10px] font-bold text-[var(--accent-wine)] uppercase shrink-0">
                COL 2:
              </span>
              <input
                type="text"
                aria-label={`Editar coluna 2 de ${field.label}`}
                value={field.columns?.[1] ?? 'VALOR'}
                onChange={(e) =>
                  onUpdateSchema(field.id, {
                    columns: [field.columns?.[0] ?? 'ITEM', e.target.value],
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
            onClick={() => onRemoveField(field.id)}
            className="font-mono-tech text-[10px] font-bold text-[var(--accent-danger)] hover:underline cursor-pointer py-1"
          >
            × REMOVER CAMPO
          </button>
        </div>
      </div>
    );
  };

  // 1. Número e Texto
  if (field.kind === 'number') {
    return (
      <div className="py-1">
        <div className="flex items-center justify-between gap-2 sm:gap-3 min-w-0">
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
        {renderEditStrip()}
      </div>
    );
  }

  if (field.kind === 'text') {
    const isLong = field.key === 'notas_campanha' || String(field.value ?? '').length > 48;
    return (
      <div className="py-1">
        <div
          className={
            isLong
              ? 'flex flex-col gap-1.5'
              : 'flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 sm:gap-3'
          }
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
              onChange={(e) => onChangeValue(field.id, e.target.value)}
              className="cyber-input mobile-touch-input w-full sm:w-auto sm:flex-1 sm:max-w-[260px] px-2.5 py-1.5 text-xs font-semibold"
            />
          )}
        </div>
        {renderEditStrip()}
      </div>
    );
  }

  // 2. Calculado (Somente Leitura)
  if (field.kind === 'calculated') {
    const isErr = computed && !computed.ok;
    return (
      <div className="py-1">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="font-mono-tech text-xs font-bold tracking-wide text-[var(--ink-secondary)] uppercase block truncate">
              {field.label}
            </span>
            <span className="font-mono-tech text-[10px] text-[var(--ink-muted)] block truncate">
              = {field.formula}
            </span>
          </div>
          <div
            role="status"
            aria-label={`${field.label}: ${computed?.formatted ?? '0'}`}
            title={isErr ? computed?.error : `Fórmula: ${field.formula}`}
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
        {renderEditStrip()}
      </div>
    );
  }

  // 3A. Recurso especial: WoD Health Damage Track (Superficial + Aggravated, 1 AGG = max SUP)
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
        className="p-2.5 bg-[var(--bg-card-alt)] border-[1.5px] border-[var(--border-ink)] rounded-[var(--radius-control)] flex flex-col gap-2"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono-tech text-xs font-bold tracking-wide text-[var(--ink-primary)] uppercase">
              {field.label}
            </span>
            <span className="font-mono-tech text-[10px] font-bold px-1.5 py-0.5 bg-[var(--accent-cream-badge)] text-[var(--accent-wine)] border border-[var(--accent-wine)] rounded-[3px] whitespace-nowrap">
              {t.aggEqRule(max)}
            </span>
          </div>
          <span
            data-testid="health-healthy-summary"
            className="font-mono-tech text-[11px] font-bold text-[var(--ink-primary)] tabular-nums whitespace-nowrap"
            aria-live="polite"
          >
            {healthy} / {max} {t.healthyRemaining}
          </span>
        </div>

        {/* Segmented WoD Health Boxes: [X Aggravated] [/ Superficial] [ ] Healthy */}
        <div
          className="seg-meter-track flex items-center gap-[3px]"
          role="meter"
          aria-label={field.label}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={healthy}
        >
          {boxes.map((state, idx) => (
            <div
              key={idx}
              aria-hidden="true"
              className={`seg-block h-[18px] flex items-center justify-center font-mono-tech text-[10px] font-extrabold select-none ${
                state === 'aggravated'
                  ? 'is-aggravated'
                  : state === 'superficial'
                    ? 'is-superficial'
                    : 'bg-[var(--bg-card)] border-[var(--border-ink)]/40 text-transparent'
              }`}
            >
              {state === 'aggravated' ? '✕' : state === 'superficial' ? '/' : ''}
            </div>
          ))}
        </div>

        {/* Aggravated + Superficial Steppers */}
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
                {agg} / {max}
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
                {sup} / {max}
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
        {renderEditStrip()}
      </div>
    );
  }

  // 3B. Recurso Padrão (Barra Segmentada estilo CPU_USAGE / MEMORY; contínua quando max > 20)
  if (field.kind === 'resource') {
    const max = Math.max(1, field.max ?? 12);
    const current = Math.max(0, Math.min(max, typeof field.value === 'number' ? field.value : 0));
    const useContinuousBar = max > 20;
    const fillPct = Math.max(0, Math.min(100, (current / max) * 100));
    const segments = useContinuousBar ? [] : Array.from({ length: max }, (_, idx) => idx);

    return (
      <div
        data-testid={`resource-field-${field.id}`}
        className="p-2.5 bg-[var(--bg-card-alt)] border-[1.5px] border-[var(--border-subtle)] rounded-[var(--radius-control)] min-w-0 max-w-full overflow-hidden"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <span className="font-mono-tech text-xs font-bold tracking-wide text-[var(--ink-primary)] uppercase break-words min-w-0">
            {field.label}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              aria-label={`Diminuir ${field.label}`}
              onClick={() => onAdjustResource(field.id, -1)}
              className="no-print print:hidden cyber-btn-outline mobile-touch-stepper w-6 h-6 flex items-center justify-center text-xs font-bold cursor-pointer"
            >
              -
            </button>
            <span
              className="font-mono-tech text-xs font-bold px-2 min-w-[56px] text-center tabular-nums"
              aria-live="polite"
            >
              {current} / {max}
            </span>
            <button
              type="button"
              aria-label={`Aumentar ${field.label}`}
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
            className="seg-meter-track relative h-[14px] rounded-[2px] bg-[var(--accent-wine-soft)] border border-[rgba(91,15,24,0.35)] cursor-pointer"
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
            <div
              className="h-full bg-[var(--accent-wine)] transition-[width] duration-150"
              style={{ width: `${fillPct}%` }}
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
                <button
                  key={idx}
                  type="button"
                  aria-label={`Definir ${field.label} para ${idx + 1}`}
                  onClick={() => onChangeValue(field.id, idx + 1 === current ? idx : idx + 1)}
                  className={`seg-block cursor-pointer ${filled ? 'is-filled' : ''}`}
                />
              );
            })}
          </div>
        )}
        {renderEditStrip()}
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
      const badgeLabel = isEmpty ? 'EMPTY' : effectiveChecked ? 'ACTIVE' : 'INACTIVE';

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
                ? 'bg-[var(--bg-header-strip)] opacity-65 cursor-not-allowed'
                : effectiveChecked
                  ? 'bg-[var(--accent-cream-badge)] hover:bg-[var(--bg-hover)] cursor-pointer'
                  : 'bg-[var(--bg-card-alt)] hover:bg-[var(--bg-hover)] cursor-pointer'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <span
                className={`w-5 h-5 rounded-[4px] border-2 border-[var(--border-ink)] flex items-center justify-center shrink-0 transition-colors ${
                  effectiveChecked
                    ? 'bg-[var(--accent-wine)] text-[var(--ink-inverse)]'
                    : isEmpty
                      ? 'bg-[var(--bg-header-strip)] text-transparent'
                      : 'bg-[var(--bg-card)] text-transparent'
                }`}
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" aria-hidden="true" />
              </span>
              <span className="font-mono-tech text-xs font-bold tracking-wide text-[var(--ink-primary)] uppercase break-words leading-snug">
                {field.label}
              </span>
            </div>
            <span
              data-testid="willpower-auto-success-badge"
              className={`font-mono-tech text-[10px] font-extrabold px-2 py-0.5 rounded-[3px] border shrink-0 tracking-wider uppercase ${
                isEmpty
                  ? 'bg-[var(--accent-danger-soft)] text-[var(--accent-danger)] border-[var(--accent-danger)]'
                  : effectiveChecked
                    ? 'bg-[var(--accent-wine)] text-[var(--ink-inverse)] border-[var(--border-ink)]'
                    : 'bg-[var(--bg-card)] text-[var(--ink-muted)] border-[var(--border-ink)]/60'
              }`}
            >
              {badgeLabel}
            </span>
          </button>
          {renderEditStrip()}
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
        {renderEditStrip()}
      </div>
    );
  }

  // 5. Botão de Rolagem
  if (field.kind === 'roll') {
    const parsedPool = parseWodPoolExpression(field.rollExpr ?? '');

    if (parsedPool) {
      const exprDiff = Number(parsedPool.diffExpr);
      const difficulty = Math.max(
        2,
        Math.min(
          10,
          Math.round(field.rollDifficulty ?? (Number.isFinite(exprDiff) ? exprDiff : 6)),
        ),
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

      return (
        <div className="py-0.5">
          <button
            type="button"
            data-testid={`roll-btn-${field.id}`}
            onClick={() => onRoll(field)}
            className="cyber-roll-btn w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs font-bold tracking-wider uppercase cursor-pointer"
          >
            <span className="text-left break-words whitespace-normal leading-snug min-w-0">
              {displayLabel}
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              {wpArmed && (
                <span className="font-mono-tech text-[9px] font-extrabold px-1.5 py-0.5 bg-[var(--accent-wine)] text-[var(--ink-inverse)] border border-[var(--ink-inverse)]/40 rounded-[3px]">
                  +1 WP
                </span>
              )}
              <span className="text-sm leading-none" aria-hidden="true">
                ↗
              </span>
            </div>
          </button>

          <div className="no-print print:hidden mt-1 px-2 py-1.5 bg-[var(--bg-card-alt)] border-[1.5px] border-[var(--border-ink)]/70 rounded-[var(--radius-control)] flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <label className="flex items-center gap-1 font-mono-tech text-[10px] font-bold text-[var(--ink-secondary)] uppercase">
                <span>DIFF</span>
                <ClampedNumberInput
                  min={2}
                  max={10}
                  ariaLabel={`Difficulty for ${field.rollLabel ?? field.label}`}
                  testId={`roll-diff-${field.id}`}
                  value={difficulty}
                  onCommit={(next) => onUpdateSchema(field.id, { rollDifficulty: next })}
                />
              </label>

              <label className="flex items-center gap-1 font-mono-tech text-[10px] font-bold text-[var(--ink-secondary)] uppercase">
                <span>MOD</span>
                <ClampedNumberInput
                  min={-10}
                  max={20}
                  ariaLabel={`Pool modifier for ${field.rollLabel ?? field.label}`}
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
                className="w-4 h-4 md:w-3.5 md:h-3.5 accent-[#5B0F18] cursor-pointer"
              />
              <span className={specialty ? 'text-[var(--accent-wine)]' : ''}>SPECIALTY</span>
            </label>
          </div>

          {renderEditStrip()}
        </div>
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
          className="cyber-roll-btn w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs font-bold tracking-wider uppercase cursor-pointer"
        >
          <span className="text-left break-words whitespace-normal leading-snug min-w-0">
            {displayLabel}
          </span>
          <span className="text-sm leading-none shrink-0" aria-hidden="true">
            ↗
          </span>
        </button>
        {renderEditStrip()}
      </div>
    );
  }

  // 6. Lista Repetível
  if (field.kind === 'repeatable') {
    const rows = field.rows ?? [];
    const col1Title = field.columns?.[0] ?? 'ITEM';
    const col2Title = field.columns?.[1] ?? 'VALOR';

    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono-tech text-xs font-bold tracking-wider text-[var(--ink-primary)] uppercase">
            {field.label}
          </span>
          {field.col2Type === 'number' && (
            <span className="font-mono-tech text-[11px] font-bold px-2 py-0.5 bg-[var(--accent-cream-badge)] text-[var(--accent-wine)] border border-[var(--accent-wine)] rounded-[4px]">
              {t.cargoBadge} {totalCargoWeight} KG
            </span>
          )}
        </div>

        <div className="border-[1.5px] border-[var(--border-ink)] rounded-[var(--radius-control)] overflow-x-auto max-w-full bg-[var(--bg-card-alt)]">
          <table className="w-full min-w-[280px] border-collapse font-mono-tech text-xs">
            <thead>
              <tr className="bg-[var(--bg-header-strip)] border-b-[1.5px] border-[var(--border-ink)] text-[10px] text-[var(--ink-muted)] uppercase">
                <th className="text-left py-2 px-2.5 font-bold">{col1Title}</th>
                <th className="text-right py-2 px-2.5 font-bold w-28">{col2Title}</th>
                <th className="w-9 no-print print:hidden" aria-label="Ações" />
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
                        aria-label={`${col1Title} da linha ${row.col1}`}
                        value={row.col1}
                        onChange={(e) => onUpdateRow(field.id, row.id, 'col1', e.target.value)}
                        className="mobile-touch-input w-full bg-transparent px-1.5 py-1 text-xs font-medium text-[var(--ink-primary)] focus:outline-none focus:bg-[var(--bg-card-alt)] rounded-[3px]"
                      />
                    </td>
                    <td className="p-1.5">
                      <input
                        type={field.col2Type === 'number' ? 'number' : 'text'}
                        step={field.col2Type === 'number' ? '0.5' : undefined}
                        aria-label={`${col2Title} de ${row.col1}`}
                        value={row.col2}
                        onChange={(e) =>
                          onUpdateRow(
                            field.id,
                            row.id,
                            'col2',
                            field.col2Type === 'number' ? Number(e.target.value) : e.target.value,
                          )
                        }
                        className="mobile-touch-input w-full bg-transparent px-1.5 py-1 text-xs font-bold text-right text-[var(--ink-primary)] focus:outline-none focus:bg-[var(--bg-card-alt)] rounded-[3px]"
                      />
                    </td>
                    <td className="p-1.5 text-center no-print print:hidden">
                      <button
                        type="button"
                        aria-label={`Remover linha ${row.col1}`}
                        onClick={() => onRemoveRow(field.id, row.id)}
                        className="mobile-touch-stepper w-6 h-6 inline-flex items-center justify-center rounded-[4px] border border-transparent hover:border-[var(--border-ink)] hover:bg-[var(--accent-danger-soft)] hover:text-[var(--accent-danger)] text-[var(--ink-muted)] cursor-pointer transition-colors"
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
          className="no-print print:hidden font-mono-tech self-start inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase border-[1.5px] border-dashed border-[var(--border-ink)] rounded-[var(--radius-control)] hover:bg-[var(--accent-wine)] hover:text-[var(--ink-inverse)] transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{t.addRow}</span>
        </button>
        {renderEditStrip()}
      </div>
    );
  }

  return null;
};
