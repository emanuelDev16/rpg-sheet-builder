import React, { useEffect, useRef, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import {
  AppMode,
  FieldKind,
  reorderFieldInCard,
  RulePreset,
  SheetCard,
  SheetEvaluation,
  SheetField,
  SystemId,
  VirtuesState,
} from '../core/sheetModel';
import { AppLanguage, AppTranslations, getTranslations } from '../core/i18n';
import { AnimatedCounter } from './AnimatedCounter';
import { FieldPrimitive } from './FieldPrimitives';

interface BentoCardProps {
  card: SheetCard;
  displayFields?: SheetField[];
  filteredInfo?: { shown: number; total: number };
  mode: AppMode;
  systemId?: SystemId;
  rulePreset?: RulePreset;
  woundPenalty?: number;
  bloodPool?: { current: number; max: number };
  virtues?: VirtuesState;
  bloodSurge?: boolean;
  bloodSurgeBonus?: number;
  lastSoakTotal?: number | null;
  canWillpowerSurge?: boolean;
  evaluation: SheetEvaluation;
  t?: AppTranslations['cards'];
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
  onAdjustBloodPool?: (delta: number) => void;
  onSetBloodPool?: (nextVal: number) => void;
  onUpdateVirtue?: (virtue: keyof VirtuesState, nextVal: number) => void;
  onRouseCheck?: () => void;
  onToggleBloodSurge?: () => void;
  onTriggerWillpowerSurge?: () => void;
  onRoll: (field: SheetField) => void;
  onAddRow: (fieldId: string) => void;
  onUpdateRow: (fieldId: string, rowId: string, col: 'col1' | 'col2', val: string | number) => void;
  onRemoveRow: (fieldId: string, rowId: string) => void;
  onUpdateSchema: (fieldId: string, patch: Partial<SheetField>) => void;
  onRemoveField: (cardId: string, fieldId: string) => void;
  onAddField: (cardId: string, kind: FieldKind, customLabel?: string) => void;
  onUpdateCard: (
    cardId: string,
    patch: Partial<Pick<SheetCard, 'code' | 'title' | 'colSpan' | 'fields'>>,
  ) => void;
  onRemoveCard: (cardId: string) => void;
}

type GuidedFieldTemplateId =
  | 'skill_d10'
  | 'attribute'
  | 'discipline'
  | 'resource'
  | 'calculated'
  | 'text'
  | 'boolean'
  | 'repeatable';

const DEFAULT_CARDS_T = getTranslations('pt-BR').cards;

function inferLang(t: AppTranslations['cards']): AppLanguage {
  if (t.addFieldHeading === '+ ADD FIELD') return 'en';
  if (t.addFieldHeading === '+ AÑADIR CAMPO') return 'es';
  return 'pt-BR';
}

const GUIDED_COPY: Record<
  AppLanguage,
  {
    addFirstField: string;
    addFieldCta: string;
    selectTemplate: string;
    createFieldBtn: string;
    cancelBtn: string;
    templates: Record<GuidedFieldTemplateId, { label: string; hint: string; fallbackName: string }>;
  }
> = {
  'pt-BR': {
    addFirstField: '+ ADICIONAR PRIMEIRO CAMPO',
    addFieldCta: '+ ADICIONAR CAMPO',
    selectTemplate: 'TEMPLATE DO CAMPO',
    createFieldBtn: 'CRIAR CAMPO ↗',
    cancelBtn: 'FECHAR',
    templates: {
      skill_d10: {
        label: 'Habilidade / Perícia d10',
        hint: 'Cria perícia + rolagem d10 com DIFF 6 automático',
        fallbackName: 'NOVA PERÍCIA',
      },
      attribute: {
        label: 'Atributo',
        hint: 'Campo numérico de atributo (1–5)',
        fallbackName: 'NOVO ATRIBUTO',
      },
      discipline: {
        label: 'Disciplina / Poder',
        hint: 'Campo numérico para disciplina ou poder',
        fallbackName: 'NOVA DISCIPLINA',
      },
      resource: {
        label: 'Recurso (Barra)',
        hint: 'Barra segmentada com + e -',
        fallbackName: 'NOVO RECURSO',
      },
      calculated: {
        label: 'Calculado',
        hint: 'Campo derivado somente leitura',
        fallbackName: 'DERIVADO',
      },
      text: {
        label: 'Texto/Notas',
        hint: 'Texto curto ou notas',
        fallbackName: 'ANOTAÇÃO',
      },
      boolean: {
        label: 'Marcador',
        hint: 'Caixa de seleção (Ativo/Inativo)',
        fallbackName: 'MARCADOR',
      },
      repeatable: {
        label: 'Lista / Tabela',
        hint: 'Tabela com linhas adicionáveis',
        fallbackName: 'LISTA',
      },
    },
  },
  en: {
    addFirstField: '+ ADD FIRST FIELD',
    addFieldCta: '+ ADD FIELD',
    selectTemplate: 'FIELD TEMPLATE',
    createFieldBtn: 'CREATE FIELD ↗',
    cancelBtn: 'CLOSE',
    templates: {
      skill_d10: {
        label: 'Skill / Roll d10',
        hint: 'Creates skill + d10 pool roll with automatic DIFF 6',
        fallbackName: 'NEW SKILL',
      },
      attribute: {
        label: 'Attribute',
        hint: 'Numeric attribute rating (1–5)',
        fallbackName: 'NEW ATTRIBUTE',
      },
      discipline: {
        label: 'Discipline / Power',
        hint: 'Numeric rating for discipline or power',
        fallbackName: 'NEW DISCIPLINE',
      },
      resource: {
        label: 'Resource (Bar)',
        hint: 'Segmented bar with + and -',
        fallbackName: 'NEW RESOURCE',
      },
      calculated: {
        label: 'Calculated',
        hint: 'Read-only formula field',
        fallbackName: 'DERIVED',
      },
      text: {
        label: 'Text/Notes',
        hint: 'Short text or notes',
        fallbackName: 'NOTE',
      },
      boolean: {
        label: 'Toggle',
        hint: 'Checkbox flag (Active/Inactive)',
        fallbackName: 'FLAG',
      },
      repeatable: {
        label: 'List / Table',
        hint: 'Repeatable row table',
        fallbackName: 'LIST',
      },
    },
  },
  es: {
    addFirstField: '+ AÑADIR PRIMER CAMPO',
    addFieldCta: '+ AÑADIR CAMPO',
    selectTemplate: 'PLANTILLA DEL CAMPO',
    createFieldBtn: 'CREAR CAMPO ↗',
    cancelBtn: 'CERRAR',
    templates: {
      skill_d10: {
        label: 'Habilidad / Pericia d10',
        hint: 'Crea habilidad + tirada d10 con DIF 6 automático',
        fallbackName: 'NUEVA HABILIDAD',
      },
      attribute: {
        label: 'Atributo',
        hint: 'Valor numérico de atributo (1–5)',
        fallbackName: 'NUEVO ATRIBUTO',
      },
      discipline: {
        label: 'Disciplina / Poder',
        hint: 'Valor numérico de disciplina o poder',
        fallbackName: 'NUEVA DISCIPLINA',
      },
      resource: {
        label: 'Recurso (Barra)',
        hint: 'Barra segmentada con + y -',
        fallbackName: 'NUEVO RECURSO',
      },
      calculated: {
        label: 'Calculado',
        hint: 'Campo calculado de solo lectura',
        fallbackName: 'DERIVADO',
      },
      text: {
        label: 'Texto/Notas',
        hint: 'Texto corto o notas',
        fallbackName: 'NOTA',
      },
      boolean: {
        label: 'Marcador',
        hint: 'Casilla de verificación',
        fallbackName: 'MARCADOR',
      },
      repeatable: {
        label: 'Lista / Tabla',
        hint: 'Tabla con filas repetibles',
        fallbackName: 'LISTA',
      },
    },
  },
};

const TEMPLATE_ORDER: GuidedFieldTemplateId[] = [
  'skill_d10',
  'attribute',
  'discipline',
  'resource',
  'calculated',
  'text',
  'boolean',
  'repeatable',
];

function inferDefaultTemplateForCard(card: SheetCard): GuidedFieldTemplateId {
  const sig = `${card.code} ${card.title}`.toUpperCase();
  if (/ATTRIBUTE|ATRIBUTO/.test(sig)) return 'attribute';
  if (/DISCIPLIN|PODER|POWER|ARCANO/.test(sig)) return 'discipline';
  if (/VITAL|RECURS|RESOURCE|STATUS/.test(sig)) return 'resource';
  if (/NOTE|NOTA|LOG/.test(sig)) return 'text';
  return 'skill_d10';
}

export const BentoCard: React.FC<BentoCardProps> = ({
  card,
  displayFields,
  filteredInfo,
  mode,
  systemId = 'wod',
  rulePreset = 'storyteller-v20',
  woundPenalty = 0,
  bloodPool,
  virtues,
  bloodSurge = false,
  bloodSurgeBonus = 2,
  lastSoakTotal = null,
  canWillpowerSurge = false,
  evaluation,
  t = DEFAULT_CARDS_T,
  onChangeValue,
  onAdjustResource,
  onAdjustHealthDamage,
  onCycleV20HealthCell,
  onAdjustV20HealthDamage,
  onAdjustV5HealthDamage,
  onApplyV5SuperficialHalving,
  onAdjustBloodPool,
  onSetBloodPool,
  onUpdateVirtue,
  onRouseCheck,
  onToggleBloodSurge,
  onTriggerWillpowerSurge,
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
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<GuidedFieldTemplateId>(() =>
    inferDefaultTemplateForCard(card),
  );
  const labelInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (mode !== 'edicao') {
      setEditingFieldId(null);
      setComposerOpen(false);
    }
  }, [mode]);

  const lang = inferLang(t);
  const guided = GUIDED_COPY[lang];
  const selectedMeta = guided.templates[selectedTemplate];

  const spanClass = card.colSpan === 2 ? 'lg:col-span-2 bento-span-2' : 'lg:col-span-1';
  const rawFieldsToRender = displayFields ?? card.fields;
  const isWodCombatCard = systemId === 'wod' && card.id === 'card_combate';
  const fieldsToRender =
    isWodCombatCard && mode === 'jogo'
      ? rawFieldsToRender.filter((f) => {
          if (rulePreset === 'storyteller-v20' && (f.id === 'f_hunger' || f.key === 'hunger')) {
            return false;
          }
          if (rulePreset === 'vampire-v5' && (f.id === 'f_soak' || f.key === 'soak_roll' || f.isSoak)) {
            return false;
          }
          return true;
        })
      : rawFieldsToRender;

  const canUseTwoColBody =
    card.colSpan === 2 &&
    fieldsToRender.length >= 2 &&
    fieldsToRender.every((f) => f.kind !== 'repeatable' && f.key !== 'notas_campanha');
  const useTwoColBody = mode === 'jogo' && canUseTwoColBody;

  const openGuidedComposer = () => {
    setSelectedTemplate(inferDefaultTemplateForCard(card));
    setComposerOpen(true);
    window.setTimeout(() => {
      labelInputRef.current?.focus();
    }, 0);
  };

  const handleCreateGuidedField = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newFieldLabel.trim();
    const resolvedLabel =
      trimmed || `${selectedMeta.fallbackName} ${card.fields.length + 1}`;

    if (selectedTemplate === 'skill_d10') {
      onAddField(card.id, 'number', resolvedLabel);
      onAddField(card.id, 'roll', resolvedLabel);
    } else if (selectedTemplate === 'attribute' || selectedTemplate === 'discipline') {
      onAddField(card.id, 'number', resolvedLabel);
    } else {
      onAddField(card.id, selectedTemplate, resolvedLabel);
    }

    setNewFieldLabel('');
    setComposerOpen(false);
  };

  return (
    <section className={`bento-card ${spanClass}`} aria-label={card.title}>
      <header className="bento-card-header">
        {mode === 'edicao' ? (
          <>
            <div className="no-print print:hidden flex flex-wrap items-center gap-2 flex-1 min-w-0">
              <input
                type="text"
                aria-label={t.t('cards.editCodeAria', { title: card.title })}
                value={card.code}
                onChange={(e) => onUpdateCard(card.id, { code: e.target.value })}
                className="cyber-input mobile-touch-input px-1.5 py-0.5 text-[11px] font-bold text-[var(--accent-wine)] w-28"
              />
              <input
                type="text"
                aria-label={t.t('cards.editTitleAria', { title: card.title })}
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
            <span className="no-print print:hidden font-mono-tech text-[10px] font-bold px-2 py-0.5 bg-[var(--accent-cream-badge)] text-[var(--accent-wine)] border border-[var(--accent-wine)] rounded-[var(--radius-pill)] tabular-nums whitespace-nowrap">
              {t.filteredPill(filteredInfo.shown, filteredInfo.total)}
            </span>
          )}

          {mode === 'edicao' ? (
            <>
              <div className="no-print print:hidden flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onUpdateCard(card.id, { colSpan: card.colSpan === 2 ? 1 : 2 })}
                  title={t.t('cards.toggleWidthTitle')}
                  className="font-mono-tech text-[10px] font-bold px-2 py-0.5 border border-[var(--border-ink)] rounded-[var(--radius-pill)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] cursor-pointer"
                >
                  {card.colSpan === 2 ? t.t('cards.col2Label') : t.t('cards.col1Label')}
                </button>
                <button
                  type="button"
                  aria-label={t.t('cards.removeCardAria', { title: card.title })}
                  onClick={() => onRemoveCard(card.id)}
                  className="w-7 h-7 sm:w-6 sm:h-6 inline-flex items-center justify-center rounded-[var(--radius-pill)] border border-[var(--border-ink)] bg-[var(--bg-card)] hover:bg-[var(--accent-danger-soft)] text-[var(--accent-danger)] cursor-pointer"
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
            data-testid={mode === 'jogo' ? `empty-card-play-${card.id}` : `empty-card-edit-${card.id}`}
            className="no-print print:hidden p-3 border-[length:var(--border-width)] border-dashed border-[var(--border-color)]/45 rounded-[var(--radius-card)] bg-[var(--bg-card-alt)] flex flex-col gap-2"
          >
            <p className="font-mono-tech text-[11px] font-semibold text-[var(--ink-secondary)]">
              {mode === 'edicao' ? t.emptyBlockEdit : t.emptyBlockPlay}
            </p>
            {mode === 'edicao' && !composerOpen && (
              <button
                type="button"
                data-testid={`empty-add-field-${card.id}`}
                onClick={openGuidedComposer}
                className="font-mono-tech min-h-[36px] w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-bold uppercase border-[length:var(--border-width)] border-dashed border-[var(--border-color)] rounded-[var(--radius-control)] bg-[var(--bg-card)] text-[var(--ink-primary)] hover:bg-[var(--accent-primary)] hover:text-[var(--accent-contrast)] transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{guided.addFirstField}</span>
              </button>
            )}
          </div>
        )}

        {fieldsToRender.map((field) => {
          const realIdx = card.fields.findIndex((f) => f.id === field.id);
          const showV20BloodAfterWillpower =
            isWodCombatCard &&
            mode === 'jogo' &&
            rulePreset === 'storyteller-v20' &&
            (field.id === 'f_willpower' || field.key === 'willpower') &&
            Boolean(bloodPool);
          const showV20VirtuesBeforeHumanity =
            isWodCombatCard &&
            mode === 'jogo' &&
            rulePreset === 'storyteller-v20' &&
            (field.id === 'f_humanity' || field.key === 'humanity') &&
            Boolean(virtues);
          const showV5FuelAfterHunger =
            isWodCombatCard &&
            mode === 'jogo' &&
            rulePreset === 'vampire-v5' &&
            (field.id === 'f_hunger' || field.key === 'hunger');

          return (
            <React.Fragment key={field.id}>
              {showV20VirtuesBeforeHumanity && virtues && (
                <div
                  data-testid="v20-virtues-panel"
                  className="p-2.5 bg-[var(--bg-card-alt)] border-[1.5px] border-[var(--border-subtle)] rounded-[var(--radius-card)] flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono-tech text-[10px] font-bold tracking-wider uppercase text-[var(--accent-wine)]">
                      {t.t('cards.vital.virtuesHeading')}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    {(
                      [
                        ['conscience', t.t('cards.vital.virtueConscience')],
                        ['selfControl', t.t('cards.vital.virtueSelfControl')],
                        ['courage', t.t('cards.vital.virtueCourage')],
                      ] as const
                    ).map(([vKey, vLabel]) => {
                      const val = virtues[vKey];
                      return (
                        <div
                          key={vKey}
                          className="flex items-center justify-between gap-2"
                        >
                          <span className="font-mono-tech text-[11px] font-bold uppercase text-[var(--ink-primary)] truncate">
                            {vLabel}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              data-testid={`v20-virtue-${vKey}-dec`}
                              aria-label={`${vLabel} -`}
                              disabled={val <= 1}
                              onClick={() => onUpdateVirtue?.(vKey, val - 1)}
                              className="no-print print:hidden cyber-btn-outline mobile-touch-stepper w-6 h-6 flex items-center justify-center text-xs font-bold cursor-pointer disabled:opacity-35"
                            >
                              -
                            </button>
                            <span
                              data-testid={`v20-virtue-${vKey}-value`}
                              className="font-mono-tech text-xs font-bold min-w-[34px] text-center tabular-nums text-[var(--ink-primary)]"
                            >
                              {val} / 5
                            </span>
                            <button
                              type="button"
                              data-testid={`v20-virtue-${vKey}-inc`}
                              aria-label={`${vLabel} +`}
                              disabled={val >= 5}
                              onClick={() => onUpdateVirtue?.(vKey, val + 1)}
                              className="no-print print:hidden cyber-btn-outline mobile-touch-stepper w-6 h-6 flex items-center justify-center text-xs font-bold cursor-pointer disabled:opacity-35"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <FieldPrimitive
                field={field}
                mode={mode}
                systemId={systemId}
                rulePreset={rulePreset}
                woundPenalty={woundPenalty}
                bloodSurge={bloodSurge}
                lastSoakTotal={lastSoakTotal}
                canWillpowerSurge={canWillpowerSurge}
                variables={evaluation.variables}
                computed={evaluation.computedByFieldId[field.id]}
                totalCargoWeight={evaluation.totalCargoWeight}
                t={t}
                isEditOpen={mode === 'edicao' && editingFieldId === field.id}
                onToggleEdit={() =>
                  setEditingFieldId((prev) => (prev === field.id ? null : field.id))
                }
                canMoveUp={realIdx > 0}
                canMoveDown={realIdx !== -1 && realIdx < card.fields.length - 1}
                onMoveUp={() =>
                  onUpdateCard(card.id, {
                    fields: reorderFieldInCard(card.fields, field.id, 'up'),
                  })
                }
                onMoveDown={() =>
                  onUpdateCard(card.id, {
                    fields: reorderFieldInCard(card.fields, field.id, 'down'),
                  })
                }
                onChangeValue={onChangeValue}
                onAdjustResource={onAdjustResource}
                onAdjustHealthDamage={onAdjustHealthDamage}
                onCycleV20HealthCell={onCycleV20HealthCell}
                onAdjustV20HealthDamage={onAdjustV20HealthDamage}
                onAdjustV5HealthDamage={onAdjustV5HealthDamage}
                onApplyV5SuperficialHalving={onApplyV5SuperficialHalving}
                onTriggerWillpowerSurge={onTriggerWillpowerSurge}
                onRoll={onRoll}
                onAddRow={onAddRow}
                onUpdateRow={onUpdateRow}
                onRemoveRow={onRemoveRow}
                onUpdateSchema={onUpdateSchema}
                onRemoveField={(fid) => {
                  if (editingFieldId === fid) setEditingFieldId(null);
                  onRemoveField(card.id, fid);
                }}
              />

              {showV20BloodAfterWillpower && bloodPool && (
                <div
                  data-testid="v20-blood-pool-panel"
                  className="p-2.5 bg-[var(--bg-card-alt)] border-[1.5px] border-[var(--border-subtle)] rounded-[var(--radius-card)] flex flex-col gap-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono-tech text-xs font-bold tracking-wide text-[var(--ink-primary)] uppercase">
                      {t.t('cards.vital.bloodPoolLabel')}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        data-testid="v20-spend-blood-btn"
                        disabled={bloodPool.current <= 0}
                        onClick={() => onAdjustBloodPool?.(-1)}
                        className="no-print print:hidden cyber-btn-outline min-h-[36px] sm:min-h-[26px] px-2 py-0.5 text-[10px] font-extrabold uppercase cursor-pointer disabled:opacity-40"
                      >
                        {t.t('cards.vital.spendBloodBtn')}
                      </button>
                      <span
                        data-testid="v20-blood-pool-value"
                        className="font-mono-tech text-xs font-bold px-1.5 min-w-[52px] text-center tabular-nums"
                        aria-live="polite"
                      >
                        <AnimatedCounter value={bloodPool.current} /> /{' '}
                        <AnimatedCounter value={bloodPool.max} pulseOnChange={false} />
                      </span>
                      <button
                        type="button"
                        data-testid="v20-blood-pool-inc"
                        aria-label={`${t.t('cards.vital.bloodPoolLabel')} +`}
                        disabled={bloodPool.current >= bloodPool.max}
                        onClick={() => onAdjustBloodPool?.(1)}
                        className="no-print print:hidden cyber-btn-outline mobile-touch-stepper w-6 h-6 flex items-center justify-center text-xs font-bold cursor-pointer disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  {bloodPool.max > 20 ? (
                    <div
                      className="seg-meter-track relative h-[14px] rounded-[var(--radius-pill)] bg-[var(--accent-wine-soft)] border border-[var(--seg-border)] cursor-pointer overflow-hidden"
                      role="meter"
                      aria-label={t.t('cards.vital.bloodPoolLabel')}
                      aria-valuemin={0}
                      aria-valuemax={bloodPool.max}
                      aria-valuenow={bloodPool.current}
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        if (rect.width <= 0) return;
                        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                        onSetBloodPool?.(Math.round(ratio * bloodPool.max));
                      }}
                    >
                      <div
                        className="h-full bg-[var(--accent-primary)]"
                        style={{
                          width: `${Math.max(0, Math.min(100, (bloodPool.current / bloodPool.max) * 100))}%`,
                        }}
                      />
                    </div>
                  ) : (
                    <div
                      className="seg-meter-track flex items-center gap-[3px]"
                      role="meter"
                      aria-label={t.t('cards.vital.bloodPoolLabel')}
                      aria-valuemin={0}
                      aria-valuemax={bloodPool.max}
                      aria-valuenow={bloodPool.current}
                    >
                      {Array.from({ length: bloodPool.max }, (_, idx) => {
                        const filled = idx < bloodPool.current;
                        return (
                          <button
                            key={idx}
                            type="button"
                            aria-label={t.t('cards.setResourceAria', {
                              label: t.t('cards.vital.bloodPoolLabel'),
                              value: idx + 1,
                            })}
                            onClick={() => onSetBloodPool?.(idx + 1 === bloodPool.current ? idx : idx + 1)}
                            className={`seg-block cursor-pointer ${filled ? 'is-filled' : ''}`}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {showV5FuelAfterHunger && (
                <div
                  data-testid="v5-hunger-controls"
                  className="no-print print:hidden flex flex-wrap items-center gap-2"
                >
                  <button
                    type="button"
                    data-testid="v5-rouse-check-btn"
                    onClick={() => onRouseCheck?.()}
                    className="cyber-roll-btn min-h-[36px] flex-1 min-w-[140px] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider cursor-pointer"
                  >
                    {t.t('cards.vital.rouseCheckBtn')} ↗
                  </button>
                  <button
                    type="button"
                    data-testid="v5-blood-surge-toggle"
                    aria-pressed={bloodSurge}
                    onClick={() => onToggleBloodSurge?.()}
                    className={`font-mono-tech min-h-[36px] flex-1 min-w-[140px] px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider rounded-[var(--radius-control)] border-[1.5px] cursor-pointer transition-colors ${
                      bloodSurge
                        ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-color)]'
                        : 'bg-[var(--bg-card)] text-[var(--ink-primary)] border-[var(--border-ink)] hover:bg-[var(--bg-hover)]'
                    }`}
                  >
                    {t.t('cards.vital.bloodSurgeLabel', { bonus: bloodSurgeBonus })}
                    {bloodSurge ? ' · ON' : ''}
                  </button>
                </div>
              )}
            </React.Fragment>
          );
        })}

        {mode === 'edicao' && (fieldsToRender.length > 0 || composerOpen) && (
          <div className="no-print print:hidden mt-auto pt-3 border-t border-dashed border-[var(--border-ink)]/40 flex flex-col gap-2">
            {!composerOpen ? (
              <button
                type="button"
                data-testid={`open-add-field-${card.id}`}
                onClick={openGuidedComposer}
                className="font-mono-tech min-h-[36px] self-start inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase border-[1.5px] border-dashed border-[var(--border-ink)] rounded-[var(--radius-control)] bg-[var(--bg-card-alt)] text-[var(--ink-primary)] hover:bg-[var(--accent-primary)] hover:text-[var(--accent-contrast)] transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{guided.addFieldCta}</span>
              </button>
            ) : (
              <form
                onSubmit={handleCreateGuidedField}
                data-testid={`guided-field-composer-${card.id}`}
                className="p-2.5 bg-[var(--bg-card-alt)] border-[length:var(--border-width)] border-[var(--border-color)] rounded-[var(--radius-card)] flex flex-col gap-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono-tech text-[10px] font-bold text-[var(--accent-wine)] uppercase">
                    {guided.selectTemplate}
                  </span>
                  <button
                    type="button"
                    aria-label={guided.cancelBtn}
                    onClick={() => setComposerOpen(false)}
                    className="w-7 h-7 inline-flex items-center justify-center rounded-[var(--radius-pill)] border border-[var(--border-ink)]/50 bg-[var(--bg-card)] text-[var(--ink-primary)] hover:bg-[var(--bg-hover)] cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>

                <div
                  className="flex flex-wrap gap-1.5"
                  role="radiogroup"
                  aria-label={guided.selectTemplate}
                >
                  {TEMPLATE_ORDER.map((tplId) => {
                    const active = selectedTemplate === tplId;
                    return (
                      <button
                        key={tplId}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        data-testid={`field-tpl-${card.id}-${tplId}`}
                        onClick={() => setSelectedTemplate(tplId)}
                        className={`font-mono-tech min-h-[32px] px-2 py-1 text-[10px] font-bold uppercase rounded-[var(--radius-pill)] border transition-colors cursor-pointer ${
                          active
                            ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-color)]'
                            : 'bg-[var(--bg-card)] text-[var(--ink-primary)] border-[var(--border-ink)]/60 hover:bg-[var(--bg-hover)]'
                        }`}
                      >
                        {guided.templates[tplId].label}
                      </button>
                    );
                  })}
                </div>

                <p className="font-mono-tech text-[10px] text-[var(--ink-secondary)]">
                  {selectedMeta.hint}
                </p>

                <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5">
                  <input
                    ref={labelInputRef}
                    type="text"
                    aria-label={t.t('cards.newFieldNameAria', { title: card.title })}
                    value={newFieldLabel}
                    onChange={(e) => setNewFieldLabel(e.target.value)}
                    placeholder={t.newFieldPlaceholder}
                    className="cyber-input mobile-touch-input min-h-[36px] px-2.5 py-1.5 text-[11px] flex-1 min-w-[140px]"
                  />
                  <button
                    type="submit"
                    data-testid={`create-guided-field-btn-${card.id}`}
                    className="cyber-roll-btn mobile-touch-input min-h-[36px] px-3 py-1.5 text-[10px] font-bold uppercase whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {guided.createFieldBtn}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
