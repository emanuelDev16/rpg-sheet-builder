import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import {
  AppMode,
  FieldKind,
  SheetCard,
  SheetEvaluation,
  SheetField,
} from '../core/sheetModel';
import { AppTranslations, getTranslations } from '../core/i18n';
import { FieldPrimitive } from './FieldPrimitives';

interface BentoCardProps {
  card: SheetCard;
  displayFields?: SheetField[];
  filteredInfo?: { shown: number; total: number };
  mode: AppMode;
  evaluation: SheetEvaluation;
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
  onRemoveField: (cardId: string, fieldId: string) => void;
  onAddField: (cardId: string, kind: FieldKind, customLabel?: string) => void;
  onUpdateCard: (cardId: string, patch: Partial<Pick<SheetCard, 'code' | 'title' | 'colSpan'>>) => void;
  onRemoveCard: (cardId: string) => void;
}

const ALL_FIELD_KINDS: Array<{ kind: FieldKind; label: string }> = [
  { kind: 'number', label: 'NÚMERO' },
  { kind: 'text', label: 'TEXTO' },
  { kind: 'calculated', label: 'FÓRMULA' },
  { kind: 'resource', label: 'RECURSO' },
  { kind: 'boolean', label: 'BOOLEANO' },
  { kind: 'roll', label: 'ROLAGEM' },
  { kind: 'repeatable', label: 'LISTA' },
];

const DEFAULT_CARDS_T = getTranslations('pt-BR').cards;

export const BentoCard: React.FC<BentoCardProps> = ({
  card,
  displayFields,
  filteredInfo,
  mode,
  evaluation,
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
  onAddField,
  onUpdateCard,
  onRemoveCard,
}) => {
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const spanClass = card.colSpan === 2 ? 'lg:col-span-2 bento-span-2' : 'lg:col-span-1';
  const fieldsToRender = displayFields ?? card.fields;

  const canUseTwoColBody =
    card.colSpan === 2 &&
    fieldsToRender.length >= 2 &&
    fieldsToRender.every((f) => f.kind !== 'repeatable' && f.key !== 'notas_campanha');
  const useTwoColBody = mode === 'jogo' && canUseTwoColBody;

  return (
    <section className={`bento-card ${spanClass}`} aria-label={card.title}>
      <header className="bento-card-header">
        {mode === 'edicao' ? (
          <>
            <div className="no-print print:hidden flex flex-wrap items-center gap-2 flex-1 min-w-0">
              <input
                type="text"
                aria-label={`Editar código de ${card.title}`}
                value={card.code}
                onChange={(e) => onUpdateCard(card.id, { code: e.target.value })}
                className="cyber-input mobile-touch-input px-1.5 py-0.5 text-[11px] font-bold text-[var(--accent-wine)] w-28"
              />
              <input
                type="text"
                aria-label={`Editar título de ${card.title}`}
                value={card.title}
                onChange={(e) => onUpdateCard(card.id, { title: e.target.value })}
                className="cyber-input mobile-touch-input px-2 py-0.5 text-xs font-extrabold uppercase flex-1 min-w-[140px]"
              />
            </div>
            <div className="hidden print:flex items-center gap-2.5 min-w-0">
              <span className="font-mono-tech text-[11px] font-bold text-[var(--accent-wine)] tracking-wider shrink-0">
                {card.code}
              </span>
              <h2 className="font-display text-xl print:text-base font-extrabold tracking-wide uppercase text-[var(--ink-primary)] truncate print:whitespace-normal print:overflow-visible print:leading-tight">
                {card.title}
              </h2>
            </div>
          </>
        ) : (
          <div className="bento-card-header-title flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 min-w-0 flex-1">
            <span className="font-mono-tech text-[11px] font-bold text-[var(--accent-wine)] tracking-wider shrink-0">
              {card.code}
            </span>
            <h2 className="font-display text-lg sm:text-xl print:text-base font-extrabold tracking-wide uppercase text-[var(--ink-primary)] leading-tight break-words">
              {card.title}
            </h2>
          </div>
        )}

        <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-center pt-0.5 sm:pt-0">
          {filteredInfo && (
            <span className="no-print print:hidden font-mono-tech text-[10px] font-bold px-2 py-0.5 bg-[var(--accent-cream-badge)] text-[var(--accent-wine)] border border-[var(--accent-wine)] rounded-[4px] tabular-nums whitespace-nowrap">
              {t.filteredPill(filteredInfo.shown, filteredInfo.total)}
            </span>
          )}

          {mode === 'edicao' ? (
            <>
              <div className="no-print print:hidden flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onUpdateCard(card.id, { colSpan: card.colSpan === 2 ? 1 : 2 })}
                  title="Alternar largura entre 1 e 2 colunas"
                  className="font-mono-tech text-[10px] font-bold px-2 py-0.5 border border-[var(--border-ink)] rounded-[4px] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] cursor-pointer"
                >
                  {card.colSpan === 2 ? '2 COL' : '1 COL'}
                </button>
                <button
                  type="button"
                  aria-label={`Remover bloco ${card.title}`}
                  onClick={() => onRemoveCard(card.id)}
                  className="w-7 h-7 sm:w-6 sm:h-6 inline-flex items-center justify-center rounded-[4px] border border-[var(--border-ink)] bg-[var(--bg-card)] hover:bg-[var(--accent-danger-soft)] text-[var(--accent-danger)] cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
              <div className="hidden print:flex items-center gap-1.5 shrink-0" aria-hidden="true">
                <span className="w-2.5 h-2.5 rounded-full border-[1.5px] border-[var(--border-ink)] bg-[var(--bg-card)]" />
                <span className="w-2.5 h-2.5 rounded-full border-[1.5px] border-[var(--border-ink)] bg-[var(--accent-wine)]" />
              </div>
            </>
          ) : (
            <div className="flex items-center gap-1.5 shrink-0" aria-hidden="true">
              <span className="w-2.5 h-2.5 rounded-full border-[1.5px] border-[var(--border-ink)] bg-[var(--bg-card)]" />
              <span className="w-2.5 h-2.5 rounded-full border-[1.5px] border-[var(--border-ink)] bg-[var(--accent-wine)]" />
            </div>
          )}
        </div>
      </header>

      <div
        className={`bento-card-body p-4 flex-1 ${
          useTwoColBody
            ? 'grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2.5 items-center'
            : 'flex flex-col gap-3'
        } ${canUseTwoColBody ? 'bento-card-two-col' : ''}`}
      >
        {fieldsToRender.length === 0 && (
          <div
            data-testid={mode === 'jogo' ? `empty-card-play-${card.id}` : undefined}
            className="no-print print:hidden p-3 border-[1.5px] border-dashed border-[var(--border-ink)]/45 rounded-[var(--radius-control)] bg-[var(--bg-card-alt)]"
          >
            <p className="font-mono-tech text-[11px] font-semibold text-[var(--ink-secondary)]">
              {mode === 'edicao' ? t.emptyBlockEdit : t.emptyBlockPlay}
            </p>
          </div>
        )}

        {fieldsToRender.map((field) => (
          <FieldPrimitive
            key={field.id}
            field={field}
            mode={mode}
            variables={evaluation.variables}
            computed={evaluation.computedByFieldId[field.id]}
            totalCargoWeight={evaluation.totalCargoWeight}
            t={t}
            onChangeValue={onChangeValue}
            onAdjustResource={onAdjustResource}
            onAdjustHealthDamage={onAdjustHealthDamage}
            onRoll={onRoll}
            onAddRow={onAddRow}
            onUpdateRow={onUpdateRow}
            onRemoveRow={onRemoveRow}
            onUpdateSchema={onUpdateSchema}
            onRemoveField={(fid) => onRemoveField(card.id, fid)}
          />
        ))}

        {mode === 'edicao' && (
          <div className="no-print print:hidden mt-auto pt-3 border-t border-dashed border-[var(--border-ink)]/40 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono-tech text-[10px] font-bold text-[var(--ink-muted)] shrink-0">
                {t.addFieldHeading}:
              </span>
              <input
                type="text"
                aria-label={`Nome do novo campo em ${card.title}`}
                value={newFieldLabel}
                onChange={(e) => setNewFieldLabel(e.target.value)}
                placeholder={t.newFieldPlaceholder}
                className="cyber-input mobile-touch-input px-2 py-1 text-[11px] flex-1 min-w-[140px]"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {ALL_FIELD_KINDS.map(({ kind, label }) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => {
                    onAddField(card.id, kind, newFieldLabel.trim() || undefined);
                    setNewFieldLabel('');
                  }}
                  className="font-mono-tech text-[10px] font-bold px-2 py-1 border border-[var(--border-ink)] rounded-[4px] bg-[var(--bg-card-alt)] hover:bg-[var(--accent-wine)] hover:text-[var(--ink-inverse)] cursor-pointer uppercase transition-colors"
                >
                  + {label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
