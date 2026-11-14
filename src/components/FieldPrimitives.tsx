import React from 'react';
import { Check, Plus, X } from 'lucide-react';
import {
  AppMode,
  ComputedFieldInfo,
  resolveRollPreview,
  SheetField,
} from '../core/sheetModel';
import { VariableMap } from '../core/formula';

interface FieldPrimitiveProps {
  field: SheetField;
  mode: AppMode;
  variables: VariableMap;
  computed?: ComputedFieldInfo;
  totalCargoWeight: number;
  onChangeValue: (fieldId: string, value: number | string | boolean) => void;
  onAdjustResource: (fieldId: string, delta: number) => void;
  onRoll: (field: SheetField) => void;
  onAddRow: (fieldId: string) => void;
  onUpdateRow: (fieldId: string, rowId: string, col: 'col1' | 'col2', val: string | number) => void;
  onRemoveRow: (fieldId: string, rowId: string) => void;
  onUpdateSchema: (fieldId: string, patch: Partial<SheetField>) => void;
  onRemoveField: (fieldId: string) => void;
}

export const FieldPrimitive: React.FC<FieldPrimitiveProps> = ({
  field,
  mode,
  variables,
  computed,
  totalCargoWeight,
  onChangeValue,
  onAdjustResource,
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
            className="cyber-input px-1.5 py-0.5 text-[11px] w-full"
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
            className="cyber-input px-1.5 py-0.5 text-[11px] w-full"
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
              className="cyber-input px-1.5 py-0.5 text-[11px] w-full"
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
                className="cyber-input px-1.5 py-0.5 text-[11px] w-full"
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
                className="cyber-input px-1.5 py-0.5 text-[11px] w-full"
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
              max={30}
              aria-label={`Editar máximo de ${field.label}`}
              value={field.max ?? 12}
              onChange={(e) => {
                const nextMax = Math.max(1, Math.min(30, Number(e.target.value) || 1));
                onUpdateSchema(field.id, { max: nextMax });
              }}
              className="cyber-input px-1.5 py-0.5 text-[11px] w-20"
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
                className="cyber-input px-1.5 py-0.5 text-[11px] w-full"
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
                className="cyber-input px-1.5 py-0.5 text-[11px] w-full"
              />
            </div>
          </>
        )}
        <div className="sm:col-span-2 flex justify-end">
          <button
            type="button"
            onClick={() => onRemoveField(field.id)}
            className="font-mono-tech text-[10px] font-bold text-[var(--accent-danger)] hover:underline cursor-pointer"
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
        <div className="flex items-center justify-between gap-3">
          <label
            htmlFor={inputId}
            className="font-mono-tech text-xs font-bold tracking-wide text-[var(--ink-primary)] uppercase"
          >
            {field.label}
          </label>
          <input
            id={inputId}
            type="number"
            value={typeof field.value === 'number' ? field.value : 0}
            onChange={(e) => onChangeValue(field.id, Number(e.target.value))}
            className="cyber-input w-24 px-2.5 py-1.5 text-sm font-bold text-right"
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
        <div className={isLong ? 'flex flex-col gap-1.5' : 'flex items-center justify-between gap-3'}>
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
                className="no-print print:hidden cyber-input w-full px-3 py-2 text-xs leading-relaxed resize-y"
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
              className="cyber-input flex-1 max-w-[260px] px-2.5 py-1.5 text-xs font-semibold"
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

  // 3. Recurso (Barra Segmentada estilo CPU_USAGE / MEMORY)
  if (field.kind === 'resource') {
    const max = Math.max(1, field.max ?? 12);
    const current = Math.max(0, Math.min(max, typeof field.value === 'number' ? field.value : 0));
    const segments = Array.from({ length: max }, (_, idx) => idx);

    return (
      <div className="p-2.5 bg-[var(--bg-card-alt)] border-[1.5px] border-[var(--border-subtle)] rounded-[var(--radius-control)]">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="font-mono-tech text-xs font-bold tracking-wide text-[var(--ink-primary)] uppercase">
            {field.label}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              aria-label={`Diminuir ${field.label}`}
              onClick={() => onAdjustResource(field.id, -1)}
              className="no-print print:hidden cyber-btn-outline w-6 h-6 flex items-center justify-center text-xs font-bold cursor-pointer"
            >
              -
            </button>
            <span
              className="font-mono-tech text-xs font-bold px-2 min-w-[56px] text-center"
              aria-live="polite"
            >
              {current} / {max}
            </span>
            <button
              type="button"
              aria-label={`Aumentar ${field.label}`}
              onClick={() => onAdjustResource(field.id, 1)}
              className="no-print print:hidden cyber-btn-outline w-6 h-6 flex items-center justify-center text-xs font-bold cursor-pointer"
            >
              +
            </button>
          </div>
        </div>

        <div
          className="flex items-center gap-[3px]"
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
        {renderEditStrip()}
      </div>
    );
  }

  // 4. Booleano / Contador
  if (field.kind === 'boolean') {
    const checked = Boolean(field.value);
    return (
      <div className="py-1">
        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          onClick={() => onChangeValue(field.id, !checked)}
          className="w-full flex items-center justify-between gap-3 px-2.5 py-2 bg-[var(--bg-card-alt)] border-[1.5px] border-[var(--border-ink)] rounded-[var(--radius-control)] hover:bg-[var(--bg-hover)] transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={`w-5 h-5 rounded-[4px] border-2 border-[var(--border-ink)] flex items-center justify-center shrink-0 transition-colors ${
                checked
                  ? 'bg-[var(--accent-wine)] text-[var(--ink-inverse)]'
                  : 'bg-[var(--bg-card)] text-transparent'
              }`}
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" aria-hidden="true" />
            </span>
            <span className="font-mono-tech text-xs font-bold tracking-wide text-[var(--ink-primary)] uppercase truncate">
              {field.label}
            </span>
          </div>
          {field.hint && (
            <span className="font-mono-tech text-[10px] text-[var(--ink-muted)] hidden sm:inline shrink-0">
              {checked ? 'ATIVO' : 'INATIVO'}
            </span>
          )}
        </button>
        {renderEditStrip()}
      </div>
    );
  }

  // 5. Botão de Rolagem
  if (field.kind === 'roll') {
    const previewExpr = resolveRollPreview(field.rollExpr ?? '1d20', variables);
    const displayLabel = `${field.rollLabel ?? field.label} · ${previewExpr}`;
    return (
      <div className="py-0.5">
        <button
          type="button"
          onClick={() => onRoll(field)}
          className="cyber-roll-btn w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs font-bold tracking-wider uppercase cursor-pointer"
        >
          <span className="truncate">{displayLabel}</span>
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
              //CARGA: {totalCargoWeight} KG
            </span>
          )}
        </div>

        <div className="border-[1.5px] border-[var(--border-ink)] rounded-[var(--radius-control)] overflow-hidden bg-[var(--bg-card-alt)]">
          <table className="w-full border-collapse font-mono-tech text-xs">
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
                    Nenhum registro na lista.
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
                        className="w-full bg-transparent px-1.5 py-1 text-xs font-medium text-[var(--ink-primary)] focus:outline-none focus:bg-[var(--bg-card-alt)] rounded-[3px]"
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
                        className="w-full bg-transparent px-1.5 py-1 text-xs font-bold text-right text-[var(--ink-primary)] focus:outline-none focus:bg-[var(--bg-card-alt)] rounded-[3px]"
                      />
                    </td>
                    <td className="p-1.5 text-center no-print print:hidden">
                      <button
                        type="button"
                        aria-label={`Remover linha ${row.col1}`}
                        onClick={() => onRemoveRow(field.id, row.id)}
                        className="w-6 h-6 inline-flex items-center justify-center rounded-[4px] border border-transparent hover:border-[var(--border-ink)] hover:bg-[var(--accent-danger-soft)] hover:text-[var(--accent-danger)] text-[var(--ink-muted)] cursor-pointer transition-colors"
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
          <span>ADICIONAR LINHA</span>
        </button>
        {renderEditStrip()}
      </div>
    );
  }

  return null;
};
