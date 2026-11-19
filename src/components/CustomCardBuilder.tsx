import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { SheetCard, SheetField, TabId } from '../core/sheetModel';
import { AppTranslations, getTranslations } from '../core/i18n';

interface CustomCardBuilderProps {
  activeTab: Exclude<TabId, 'xp'>;
  isEmptySheet: boolean;
  t?: AppTranslations['customBuilder'];
  onCreateCard: (card: SheetCard) => void;
}

type StarterTemplateId =
  | 'empty'
  | 'skill_d10'
  | 'attribute'
  | 'discipline'
  | 'resource'
  | 'calculated'
  | 'text';

const DEFAULT_BUILDER_T = getTranslations('pt-BR').customBuilder;

const TEMPLATE_ORDER: StarterTemplateId[] = [
  'empty',
  'skill_d10',
  'attribute',
  'discipline',
  'resource',
  'calculated',
  'text',
];

function buildStarterFields(
  template: StarterTemplateId,
  tFn: AppTranslations['customBuilder']['t'],
): SheetField[] {
  const uid = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
  switch (template) {
    case 'skill_d10': {
      const skillKey = `pericia_${uid.slice(0, 4)}`;
      const skillLabel = tFn('customBuilder.starterField.skill');
      const rollLabel = tFn('customBuilder.starterField.rollSkill');
      return [
        {
          id: `f_${uid}_num`,
          key: skillKey,
          label: skillLabel,
          kind: 'number',
          value: 1,
        },
        {
          id: `f_${uid}_roll`,
          key: `roll_${skillKey}`,
          label: skillLabel,
          kind: 'roll',
          rollLabel,
          rollExpr: `pool(${skillKey}, 6)`,
          rollDifficulty: 6,
          rollSpecialty: false,
          rollMod: 0,
        },
      ];
    }
    case 'attribute':
      return [
        {
          id: `f_${uid}`,
          key: `attr_${uid.slice(0, 4)}`,
          label: tFn('customBuilder.starterField.attribute'),
          kind: 'number',
          value: 2,
        },
      ];
    case 'discipline':
      return [
        {
          id: `f_${uid}`,
          key: `disc_${uid.slice(0, 4)}`,
          label: tFn('customBuilder.starterField.discipline'),
          kind: 'number',
          value: 1,
        },
      ];
    case 'resource':
      return [
        {
          id: `f_${uid}`,
          key: `res_${uid.slice(0, 4)}`,
          label: tFn('customBuilder.starterField.resource'),
          kind: 'resource',
          value: 4,
          max: 6,
        },
      ];
    case 'calculated':
      return [
        {
          id: `f_${uid}`,
          key: `calc_${uid.slice(0, 4)}`,
          label: tFn('customBuilder.starterField.calculated'),
          kind: 'calculated',
          formula: '0',
          showPlus: true,
        },
      ];
    case 'text':
      return [
        {
          id: `f_${uid}`,
          key: `txt_${uid.slice(0, 4)}`,
          label: tFn('customBuilder.starterField.text'),
          kind: 'text',
          value: '',
        },
      ];
    case 'empty':
    default:
      return [];
  }
}

export const CustomCardBuilder: React.FC<CustomCardBuilderProps> = ({
  activeTab,
  isEmptySheet,
  t = DEFAULT_BUILDER_T,
  onCreateCard,
}) => {
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [colSpan, setColSpan] = useState<1 | 2>(1);
  const [starterTemplate, setStarterTemplate] = useState<StarterTemplateId>('empty');

  const getTemplateMeta = (tplId: StarterTemplateId) => ({
    label: t.t(`customBuilder.tpl.${tplId}.label`),
    hint: t.t(`customBuilder.tpl.${tplId}.hint`),
    defaultTitle: t.t(`customBuilder.tpl.${tplId}.defaultTitle`),
    defaultCode: t.t(`customBuilder.tpl.${tplId}.defaultCode`),
  });
  const copy = {
    heading: t.t('customBuilder.starterHeading'),
    options: {
      empty: getTemplateMeta('empty'),
      skill_d10: getTemplateMeta('skill_d10'),
      attribute: getTemplateMeta('attribute'),
      discipline: getTemplateMeta('discipline'),
      resource: getTemplateMeta('resource'),
      calculated: getTemplateMeta('calculated'),
      text: getTemplateMeta('text'),
    },
  };
  const selectedMeta = copy.options[starterTemplate];

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle =
      title.trim().toUpperCase() ||
      (starterTemplate === 'empty' ? t.defaultBlockTitle : selectedMeta.defaultTitle);
    const derivedCode =
      code.trim().toUpperCase() ||
      (starterTemplate !== 'empty' && !title.trim()
        ? selectedMeta.defaultCode
        : `//${cleanTitle.replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 16) || t.defaultBlockCode}`);

    const normalizedCode = derivedCode.startsWith('//') ? derivedCode : `//${derivedCode}`;
    const uid = `card_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;

    onCreateCard({
      id: uid,
      tab: activeTab,
      code: normalizedCode,
      title: cleanTitle,
      colSpan,
      fields: buildStarterFields(starterTemplate, t.t),
    });

    setTitle('');
    setCode('');
    setStarterTemplate('empty');
  };

  return (
    <section
      aria-label={t.ariaSection}
      className="no-print print:hidden bento-card lg:col-span-2 border-dashed"
    >
      <header className="bento-card-header">
        <div className="bento-card-header-title flex items-center gap-2.5 min-w-0 flex-1">
          <span className="font-mono-tech text-[11px] font-bold text-[var(--accent-wine)] tracking-wider shrink-0">
            {t.techHeaderTag}
          </span>
          <h2 className="font-display text-lg sm:text-xl font-extrabold tracking-wide uppercase text-[var(--ink-primary)] leading-tight break-words min-w-0">
            {isEmptySheet ? t.createFromZero : t.addNewBlock}
          </h2>
        </div>
        <span className="font-mono-tech text-[10px] font-bold px-2 py-0.5 bg-[var(--accent-cream-badge)] text-[var(--accent-wine)] border border-[var(--accent-wine)] rounded-[var(--radius-pill)] uppercase shrink-0">
          {activeTab === 'geral' ? '01' : '02'}
        </span>
      </header>

      <form onSubmit={handleCreate} className="bento-card-body p-4 flex flex-col gap-3">
        {isEmptySheet && (
          <p className="font-mono-tech text-xs text-[var(--ink-secondary)] leading-relaxed">
            {t.emptyHint}
          </p>
        )}

        {/* Guided Starter Template Selector */}
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono-tech text-[10px] font-bold text-[var(--ink-muted)] uppercase">
              {copy.heading}
            </span>
            <span className="font-mono-tech text-[10px] font-semibold text-[var(--accent-wine)]">
              {selectedMeta.hint}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={copy.heading}>
            {TEMPLATE_ORDER.map((tplId) => {
              const active = starterTemplate === tplId;
              return (
                <button
                  key={tplId}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  data-testid={`builder-tpl-${tplId}`}
                  onClick={() => setStarterTemplate(tplId)}
                  className={`font-mono-tech min-h-[36px] sm:min-h-[30px] px-2.5 py-1 text-[10px] font-bold uppercase rounded-[var(--radius-pill)] border transition-colors cursor-pointer ${
                    active
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-color)]'
                      : 'bg-[var(--bg-card-alt)] text-[var(--ink-primary)] border-[var(--border-ink)]/65 hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  {copy.options[tplId].label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
          <div className="md:col-span-5 flex flex-col gap-1">
            <label
              htmlFor="new-card-title"
              className="font-mono-tech text-[10px] font-bold text-[var(--ink-muted)] uppercase"
            >
              {t.blockTitle}
            </label>
            <input
              id="new-card-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                starterTemplate === 'empty'
                  ? t.blockTitlePlaceholder
                  : selectedMeta.defaultTitle
              }
              className="cyber-input mobile-touch-input px-2.5 py-1.5 text-xs font-bold uppercase w-full"
            />
          </div>

          <div className="md:col-span-3 flex flex-col gap-1">
            <label
              htmlFor="new-card-code"
              className="font-mono-tech text-[10px] font-bold text-[var(--ink-muted)] uppercase"
            >
              {t.techTag}
            </label>
            <input
              id="new-card-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={
                starterTemplate === 'empty'
                  ? t.techTagPlaceholder
                  : selectedMeta.defaultCode
              }
              className="cyber-input mobile-touch-input min-h-[36px] px-2.5 py-1.5 text-xs font-mono-tech w-full"
            />
          </div>

          <div className="md:col-span-2 flex flex-col gap-1">
            <span className="font-mono-tech text-[10px] font-bold text-[var(--ink-muted)] uppercase">
              {t.width}
            </span>
            <div className="flex border-[length:var(--border-width)] border-[var(--border-color)] rounded-[var(--radius-pill)] overflow-hidden">
              <button
                type="button"
                onClick={() => setColSpan(1)}
                className={`mobile-touch-input min-h-[36px] flex-1 font-mono-tech text-[10px] font-bold py-1.5 cursor-pointer ${
                  colSpan === 1
                    ? 'bg-[var(--accent-black)] text-[var(--accent-contrast)]'
                    : 'bg-[var(--bg-card)] text-[var(--text-primary)]'
                }`}
              >
                1 COL
              </button>
              <button
                type="button"
                onClick={() => setColSpan(2)}
                className={`mobile-touch-input min-h-[36px] flex-1 font-mono-tech text-[10px] font-bold py-1.5 border-l-[length:var(--border-width)] border-[var(--border-color)] cursor-pointer ${
                  colSpan === 2
                    ? 'bg-[var(--accent-black)] text-[var(--accent-contrast)]'
                    : 'bg-[var(--bg-card)] text-[var(--text-primary)]'
                }`}
              >
                2 COL
              </button>
            </div>
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              className="cyber-roll-btn mobile-touch-input min-h-[36px] w-full flex items-center justify-center gap-1.5 px-3 py-2 text-[11px] font-bold uppercase cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t.createBtn}</span>
            </button>
          </div>
        </div>
      </form>
    </section>
  );
};
