import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Plus,
  Search,
  ShieldCheck,
  Sliders,
  Trash2,
  X,
} from 'lucide-react';
import {
  type AppLanguage,
  createTranslator,
  getTranslations,
  type TranslateFn,
} from '../core/i18n';
import {
  type CharacterSheetState,
  getBloodPoolMaxByGeneration,
  type MeritFlawKind,
  type WodEdition,
} from '../core/sheetModel';
import {
  getAdvantagesForEdition,
  getFlawsForEdition,
  getHavenTraitsForEdition,
  type WodAdvantageCatalogEntry,
} from '../core/wodAdvantagesCatalog';
import {
  formatPowerCostLabel,
  getClansForEdition,
  getDisciplinesForEdition,
  resolveDisciplineAffinity,
} from '../core/wodClansDisciplinesCatalog';
import {
  getGroupedWodSkillsCatalog,
  normalizeCatalogText,
  WOD_CATEGORY_LABELS,
} from '../core/wodSkillsCatalog';
import {
  assignV20AttributePriority,
  assignV20SkillPriority,
  buildSheetFromWodWizard,
  canAdvanceFromStep,
  canCompleteWizard,
  clampGenerationForEdition,
  createInitialWodWizardState,
  findPredatorTypeById,
  getResolvedWizardClan,
  getStep2AttributeSummary,
  getStep3SkillSummary,
  getStep4DossierSummary,
  getV5InitialBloodPotency,
  getV5InitialHumanity,
  resolveWizardClanName,
  setWizardAttribute,
  setWizardBackground,
  setWizardClan,
  setWizardDiscipline,
  setWizardEdition,
  setWizardSkill,
  setWizardSkillSpecialty,
  toggleWizardDisciplinePower,
  toggleWizardHavenTrait,
  V5_FREE_SPECIALTY_SKILL_KEYS,
  V5_SKILL_ARRAYS,
  V5_TOUCHSTONES_MAX,
  V5_TOUCHSTONES_MIN,
  V20_ATTRIBUTE_PRIORITY_BUDGETS,
  V20_SKILL_PRIORITY_BUDGETS,
  validateWizardStep,
  WOD_ATTRIBUTE_GROUPS_BY_EDITION,
  WOD_V5_PREDATOR_TYPES,
  WOD_WIZARD_CUSTOM_VALUE,
  type V20PriorityTier,
  type V20SkillGroup,
  type V5SkillArrayId,
  type WodAttributeGroup,
  type WodCreationWizardState,
  type WodWizardStep,
  type WodWizardValidationIssue,
} from '../utils/wodCreationWizard';
import { DotRating } from './DotRating';

export interface WodCreationWizardProps {
  initialEdition?: WodEdition;
  language: AppLanguage;
  onComplete: (sheet: CharacterSheetState) => void;
  onCancel?: () => void;
}

function makeUid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function formatWizardIssue(issue: WodWizardValidationIssue, t: TranslateFn): string {
  const p = issue.params;
  switch (issue.code) {
    case 'name_required':
      return t('wizard.issue.nameRequired');
    case 'clan_required':
      return t('wizard.issue.clanRequired');
    case 'v5_attributes_mismatch':
      return t('wizard.issue.v5AttributesMismatch', p);
    case 'v20_attributes_mismatch':
      return t('wizard.issue.v20AttributesMismatch', p);
    case 'v5_skills_mismatch':
      return t('wizard.issue.v5SkillsMismatch', p);
    case 'v20_skills_mismatch':
      return t('wizard.issue.v20SkillsMismatch', p);
    case 'v20_skills_over_cap':
      return t('wizard.issue.v20SkillsOverCap', p);
    case 'disciplines_total_mismatch':
      return t('wizard.issue.disciplinesTotalMismatch', p);
    case 'v5_disciplines_clan_split':
      return t('wizard.issue.v5DisciplinesClanSplit', p);
    case 'v20_disciplines_out_of_clan':
      return t('wizard.issue.v20DisciplinesOutOfClan', p);
    case 'v5_powers_mismatch':
      return t('wizard.issue.v5PowersMismatch', p);
    case 'v5_advantages_mismatch':
      return t('wizard.issue.v5AdvantagesMismatch', p);
    case 'v5_flaws_mismatch':
      return t('wizard.issue.v5FlawsMismatch', p);
    case 'v5_touchstones_mismatch':
      return t('wizard.issue.v5TouchstonesMismatch', p);
    case 'v20_backgrounds_mismatch':
      return t('wizard.issue.v20BackgroundsMismatch', p);
    case 'v20_virtues_mismatch':
      return t('wizard.issue.v20VirtuesMismatch', p);
  }
}

export const WodCreationWizard: React.FC<WodCreationWizardProps> = ({
  initialEdition = 'vampire-v5',
  language,
  onComplete,
  onCancel,
}) => {
  const uid = useId();
  const t = useMemo(() => createTranslator(language), [language]);
  const cardsT = useMemo(() => getTranslations(language).cards, [language]);

  const [state, setState] = useState<WodCreationWizardState>(() =>
    createInitialWodWizardState(initialEdition),
  );
  const [skillQuery, setSkillQuery] = useState('');
  const [showAllDisciplines, setShowAllDisciplines] = useState(false);
  const [meritQuery, setMeritQuery] = useState('');
  const [meritFilter, setMeritFilter] = useState<'all' | 'merit' | 'flaw'>('all');
  const [customMfKind, setCustomMfKind] = useState<MeritFlawKind>('merit');
  const [customMfName, setCustomMfName] = useState('');
  const [customMfRating, setCustomMfRating] = useState(1);

  const bodyRef = useRef<HTMLDivElement>(null);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const prevStepRef = useRef<WodWizardStep>(state.currentStep);

  useEffect(() => {
    if (prevStepRef.current !== state.currentStep) {
      prevStepRef.current = state.currentStep;
      if (bodyRef.current) {
        bodyRef.current.scrollTop = 0;
      }
      stepHeadingRef.current?.focus();
    }
  }, [state.currentStep]);

  const stepValidations = useMemo(
    () => ({
      1: validateWizardStep(state, 1),
      2: validateWizardStep(state, 2),
      3: validateWizardStep(state, 3),
      4: validateWizardStep(state, 4),
    }),
    [state],
  );

  const currentValidation = stepValidations[state.currentStep];
  const canAdvanceCurrent = canAdvanceFromStep(state, state.currentStep);
  const canFinish = canCompleteWizard(state);

  const stepDefs: ReadonlyArray<{ step: WodWizardStep; title: string }> = [
    { step: 1, title: t('wizard.step1Short') },
    { step: 2, title: t('wizard.step2Short') },
    { step: 3, title: t('wizard.step3Short') },
    { step: 4, title: t('wizard.step4Short') },
  ];

  const canJumpToStep = (targetStep: WodWizardStep): boolean => {
    if (targetStep <= state.currentStep || !state.strictRules) return true;
    for (let s = 1; s < targetStep; s += 1) {
      if (!stepValidations[s as WodWizardStep].valid) return false;
    }
    return true;
  };

  const handleGoStep = (targetStep: WodWizardStep) => {
    if (!canJumpToStep(targetStep)) return;
    setState((prev) => ({ ...prev, currentStep: targetStep }));
  };

  const handleNext = () => {
    if (!canAdvanceCurrent || state.currentStep >= 4) return;
    const nextStep = (state.currentStep + 1) as WodWizardStep;
    setState((prev) => ({ ...prev, currentStep: nextStep }));
  };

  const handlePrev = () => {
    if (state.currentStep <= 1) return;
    const prevStep = (state.currentStep - 1) as WodWizardStep;
    setState((prev) => ({ ...prev, currentStep: prevStep }));
  };

  const handleFinish = () => {
    if (!canFinish) return;
    const built = buildSheetFromWodWizard(state, language);
    onComplete(built);
  };

  // Derived catalogs & summaries
  const editionClans = useMemo(() => getClansForEdition(state.edition), [state.edition]);
  const editionDisciplines = useMemo(
    () => getDisciplinesForEdition(state.edition),
    [state.edition],
  );
  const discNameById = useMemo(
    () => new Map(editionDisciplines.map((d) => [d.id, d.name[language]])),
    [editionDisciplines, language],
  );
  const resolvedClanInfo = useMemo(() => getResolvedWizardClan(state), [state]);
  const selectedPredator = useMemo(
    () => findPredatorTypeById(state.predatorTypeId),
    [state.predatorTypeId],
  );

  const attrSummary = useMemo(() => getStep2AttributeSummary(state), [state]);
  const skillSummary = useMemo(() => getStep3SkillSummary(state), [state]);
  const dossierSummary = useMemo(() => getStep4DossierSummary(state), [state]);

  const groupedSkills = useMemo(
    () => getGroupedWodSkillsCatalog(state.edition, skillQuery),
    [state.edition, skillQuery],
  );

  const visibleDisciplines = useMemo(() => {
    if (
      showAllDisciplines ||
      !state.strictRules ||
      resolvedClanInfo.allowsFreeDisciplines ||
      !resolvedClanInfo.clanEntry
    ) {
      return editionDisciplines;
    }
    const clanSet = new Set(resolvedClanInfo.clanEntry.clanDisciplines);
    return editionDisciplines.filter(
      (d) => clanSet.has(d.id) || (state.disciplines[d.id] ?? 0) > 0,
    );
  }, [
    editionDisciplines,
    resolvedClanInfo,
    showAllDisciplines,
    state.disciplines,
    state.strictRules,
  ]);

  const catalogBackgrounds = useMemo(
    () => getAdvantagesForEdition(state.edition, 'background').filter((a) => a.id !== 'haven'),
    [state.edition],
  );

  const catalogMeritsAndFlaws = useMemo(() => {
    const merits = getAdvantagesForEdition(state.edition, 'merit');
    const flaws = getFlawsForEdition(state.edition);
    const merged: WodAdvantageCatalogEntry[] =
      meritFilter === 'merit'
        ? [...merits]
        : meritFilter === 'flaw'
          ? [...flaws]
          : [...merits, ...flaws];
    const norm = normalizeCatalogText(meritQuery);
    if (!norm) return merged;
    return merged.filter((entry) => {
      const hay = [
        entry.id,
        entry.varName,
        entry.name['pt-BR'],
        entry.name.en,
        entry.name.es,
        ...(entry.aliases ?? []),
        entry.summary[language],
      ]
        .map(normalizeCatalogText)
        .join(' ');
      return hay.includes(norm);
    });
  }, [language, meritFilter, meritQuery, state.edition]);

  const havenTraitsCatalog = useMemo(
    () => getHavenTraitsForEdition(state.edition),
    [state.edition],
  );

  const addCatalogMeritOrFlaw = (entry: WodAdvantageCatalogEntry) => {
    setState((prev) => {
      const kind: MeritFlawKind = entry.group === 'flaw' ? 'flaw' : 'merit';
      const existing = prev.meritsFlaws.find(
        (item) => item.catalogId === entry.id && item.kind === kind,
      );
      if (existing) {
        return {
          ...prev,
          meritsFlaws: prev.meritsFlaws.map((item) =>
            item.id === existing.id
              ? { ...item, rating: Math.min(entry.maxDots, item.rating + 1) }
              : item,
          ),
        };
      }
      return {
        ...prev,
        meritsFlaws: [
          ...prev.meritsFlaws,
          {
            id: makeUid('mf'),
            kind,
            name: entry.name[language],
            rating: 1,
            catalogId: entry.id,
          },
        ],
      };
    });
  };

  const handleAddCustomMeritFlaw = () => {
    const trimmed = customMfName.trim();
    if (!trimmed) return;
    const clampedRating = Math.max(1, Math.min(5, Math.round(customMfRating)));
    setState((prev) => ({
      ...prev,
      meritsFlaws: [
        ...prev.meritsFlaws,
        {
          id: makeUid('mf'),
          kind: customMfKind,
          name: trimmed.slice(0, 120),
          rating: clampedRating,
        },
      ],
    }));
    setCustomMfName('');
    setCustomMfRating(1);
  };

  const handleAddTouchstone = () => {
    setState((prev) => ({
      ...prev,
      touchstones: [
        ...prev.touchstones,
        {
          id: makeUid('ts'),
          conviction: '',
          touchstone: '',
        },
      ],
    }));
  };

  const formatV5RemainingSkills = (): string => {
    const rem = skillSummary.v5RemainingSlots;
    const parts: string[] = [];
    for (const lvl of [4, 3, 2, 1] as const) {
      if (skillSummary.v5ArraySpec.targetCounts[lvl] > 0 || rem[lvl] !== 0) {
        parts.push(`${rem[lvl]}×[${lvl}]`);
      }
    }
    return parts.join(' · ');
  };

  return (
    <div
      data-testid="wod-creation-wizard"
      className="wod-creation-wizard flex flex-col flex-1 min-h-0 overflow-hidden"
    >
      {/* Top Wizard Bar: 4-Step Progress + RAW/Free Rules Switch */}
      <div className="wod-wizard-topbar px-3.5 py-2.5 flex flex-col gap-2">
        <nav aria-label={t('wizard.stepProgressAria')}>
          <ol className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 list-none m-0 p-0">
            {stepDefs.map((item) => {
              const isCurrent = state.currentStep === item.step;
              const isValid = stepValidations[item.step].valid;
              const isDone = isValid && item.step < state.currentStep;
              const unlocked = canJumpToStep(item.step);
              return (
                <li key={item.step} className="min-w-0">
                  <button
                    type="button"
                    data-testid={`wizard-step-btn-${item.step}`}
                    disabled={!unlocked}
                    aria-current={isCurrent ? 'step' : undefined}
                    onClick={() => handleGoStep(item.step)}
                    className={`wod-wizard-step-btn w-full min-h-[36px] px-2 py-1.5 text-left flex items-center gap-1.5 cursor-pointer ${
                      isCurrent ? 'is-active' : isDone ? 'is-done' : ''
                    }`}
                  >
                    <span className="font-mono-tech text-[10px] font-extrabold shrink-0">
                      {isDone && !isCurrent ? (
                        <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      ) : (
                        `${item.step}.`
                      )}
                    </span>
                    <span className="font-mono-tech text-[10px] font-bold uppercase truncate">
                      {item.title}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={state.strictRules}
            aria-label={t('wizard.rulesToggleAria')}
            data-testid="wizard-rules-toggle"
            onClick={() => setState((prev) => ({ ...prev, strictRules: !prev.strictRules }))}
            className={`wod-wizard-rules-toggle min-h-[36px] px-3 py-1 inline-flex items-center gap-1.5 font-mono-tech text-[10px] font-extrabold uppercase cursor-pointer ${
              state.strictRules ? 'is-strict' : 'is-free'
            }`}
          >
            {state.strictRules ? (
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <Sliders className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            )}
            <span>
              {state.strictRules ? t('wizard.strictModeLabel') : t('wizard.freeModeLabel')}
            </span>
          </button>
          <span className="font-mono-tech text-[10px] text-[var(--ink-muted)]">
            {state.strictRules ? t('wizard.strictModeHint') : t('wizard.freeModeHint')}
          </span>
        </div>
      </div>

      {/* Scrollable Step Body */}
      <div
        ref={bodyRef}
        className="modal-dialog-body p-3.5 sm:p-4 flex flex-col gap-3.5"
      >
        {/* STEP 1: Identity & Clan */}
        {state.currentStep === 1 && (
          <section aria-labelledby={`${uid}-step1-heading`} className="flex flex-col gap-3">
            <h3
              id={`${uid}-step1-heading`}
              ref={stepHeadingRef}
              tabIndex={-1}
              className="font-display text-sm sm:text-base font-extrabold uppercase text-[var(--ink-primary)] outline-none"
            >
              {t('wizard.step1Heading')}
            </h3>

            {/* Edition Switch */}
            <fieldset className="border-0 p-0 m-0 flex flex-col gap-1">
              <legend className="font-mono-tech text-[10px] font-bold uppercase tracking-wider text-[var(--ink-muted)] mb-1">
                {t('modal.wodEditionLabel')}
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {(
                  [
                    {
                      id: 'vampire-v5' as const,
                      suffix: 'v5',
                      title: t('modal.wodEditionV5'),
                      hint: t('modal.wodEditionV5Hint'),
                    },
                    {
                      id: 'storyteller-v20' as const,
                      suffix: 'v20',
                      title: t('modal.wodEditionV20'),
                      hint: t('modal.wodEditionV20Hint'),
                    },
                  ] as const
                ).map((ed) => {
                  const active = state.edition === ed.id;
                  return (
                    <label
                      key={ed.id}
                      data-testid={`wizard-edition-${ed.suffix}`}
                      className={`wod-edition-segment cyber-btn-outline min-h-[40px] !rounded-[var(--radius-card)] px-2.5 py-2 text-left flex items-start justify-between gap-2 cursor-pointer ${
                        active ? 'cyber-active-tint' : ''
                      }`}
                    >
                      <input
                        type="radio"
                        name={`${uid}-edition`}
                        value={ed.id}
                        checked={active}
                        onChange={() => setState((prev) => setWizardEdition(prev, ed.id))}
                        className="sr-only"
                      />
                      <div className="min-w-0 flex flex-col gap-0.5">
                        <span
                          className={`font-mono-tech text-xs font-extrabold uppercase ${
                            active ? 'cyber-active-title' : 'text-[var(--ink-primary)]'
                          }`}
                        >
                          {ed.title}
                        </span>
                        <span className="cyber-active-muted font-mono-tech text-[10px] leading-snug text-[var(--ink-muted)]">
                          {ed.hint}
                        </span>
                      </div>
                      <span
                        aria-hidden="true"
                        className={`cyber-radio-ring mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                          active
                            ? 'border-[var(--accent-wine)] bg-[var(--accent-wine)]'
                            : 'border-[var(--border-ink)] bg-[var(--bg-card)]'
                        }`}
                      >
                        {active && (
                          <span className="cyber-radio-dot w-1.5 h-1.5 rounded-full bg-[var(--ink-inverse)]" />
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {/* Clan Selection & Preview */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor={`${uid}-clan-select`}
                className="font-mono-tech text-[11px] font-bold uppercase text-[var(--ink-primary)]"
              >
                {t('modal.newClanFactionLabel')} *
              </label>
              <select
                id={`${uid}-clan-select`}
                data-testid="wizard-clan-select"
                value={state.clanId}
                onChange={(e) => setState((prev) => setWizardClan(prev, e.target.value))}
                className="cyber-input mobile-touch-input min-h-[38px] px-2.5 py-1.5 text-base sm:text-xs font-semibold w-full"
              >
                <option value="">{t('modal.wodClanPlaceholder')}</option>
                {editionClans.map((clan) => (
                  <option key={clan.id} value={clan.id}>
                    {clan.name[language]}
                  </option>
                ))}
                <option value={WOD_WIZARD_CUSTOM_VALUE}>{t('modal.wodClanCustomOption')}</option>
              </select>

              {state.clanId === WOD_WIZARD_CUSTOM_VALUE && (
                <div className="flex flex-col gap-1 pt-1">
                  <label
                    htmlFor={`${uid}-custom-clan`}
                    className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-secondary)]"
                  >
                    {t('modal.wodClanCustomLabel')} *
                  </label>
                  <input
                    id={`${uid}-custom-clan`}
                    data-testid="wizard-clan-custom-input"
                    type="text"
                    value={state.customClanName}
                    onChange={(e) =>
                      setState((prev) => ({ ...prev, customClanName: e.target.value }))
                    }
                    placeholder={t('modal.wodClanCustomPlaceholder')}
                    className="cyber-input mobile-touch-input min-h-[38px] px-2.5 py-1.5 text-base sm:text-xs font-semibold w-full"
                  />
                </div>
              )}

              {resolvedClanInfo.clanEntry && (
                <div
                  data-testid="wizard-clan-preview"
                  className="wod-wizard-subcard px-2.5 py-2 flex flex-col gap-0.5"
                >
                  <div className="font-mono-tech text-[10px] leading-snug text-[var(--ink-primary)]">
                    <span className="font-extrabold text-[var(--accent-wine)] uppercase">
                      {t('modal.wodClanDisciplinesLabel')}:{' '}
                    </span>
                    <span>
                      {resolvedClanInfo.clanEntry.isCaitiff
                        ? t('cards.disciplines.caitiffBadge')
                        : resolvedClanInfo.clanEntry.clanDisciplines
                            .map((discId) => discNameById.get(discId) ?? discId)
                            .join(' · ')}
                    </span>
                  </div>
                  {resolvedClanInfo.clanEntry.edition === 'storyteller-v20' ? (
                    <div className="font-mono-tech text-[10px] leading-snug text-[var(--ink-secondary)]">
                      <span className="font-bold text-[var(--ink-primary)] uppercase">
                        {t('modal.wodClanWeaknessLabel')}:{' '}
                      </span>
                      <span>{resolvedClanInfo.clanEntry.weakness[language]}</span>
                    </div>
                  ) : (
                    <>
                      <div className="font-mono-tech text-[10px] leading-snug text-[var(--ink-secondary)]">
                        <span className="font-bold text-[var(--ink-primary)] uppercase">
                          {t('modal.wodClanBaneLabel')}:{' '}
                        </span>
                        <span>{resolvedClanInfo.clanEntry.bane[language]}</span>
                      </div>
                      <div className="font-mono-tech text-[10px] leading-snug text-[var(--ink-secondary)]">
                        <span className="font-bold text-[var(--ink-primary)] uppercase">
                          {t('modal.wodClanCompulsionLabel')}:{' '}
                        </span>
                        <span>{resolvedClanInfo.clanEntry.compulsion[language]}</span>
                      </div>
                      {resolvedClanInfo.isThinBlood && (
                        <div className="font-mono-tech text-[10px] font-bold text-[var(--accent-wine)] pt-0.5">
                          {t('wizard.clanThinBloodHint')}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Identity Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="flex flex-col gap-1 sm:col-span-2">
                <label
                  htmlFor={`${uid}-char-name`}
                  className="font-mono-tech text-[11px] font-bold uppercase text-[var(--ink-primary)]"
                >
                  {t('wizard.nameLabel')}
                </label>
                <input
                  id={`${uid}-char-name`}
                  data-testid="wizard-name-input"
                  type="text"
                  required
                  value={state.name}
                  onChange={(e) => setState((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder={
                    state.edition === 'vampire-v5'
                      ? t('wizard.namePlaceholderV5')
                      : t('wizard.namePlaceholderV20')
                  }
                  className="cyber-input mobile-touch-input min-h-[38px] px-2.5 py-1.5 text-base sm:text-xs font-semibold w-full"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor={`${uid}-concept`}
                  className="font-mono-tech text-[11px] font-bold uppercase text-[var(--ink-primary)]"
                >
                  {t('wizard.conceptLabel')}
                </label>
                <input
                  id={`${uid}-concept`}
                  data-testid="wizard-concept-input"
                  type="text"
                  value={state.concept}
                  onChange={(e) => setState((prev) => ({ ...prev, concept: e.target.value }))}
                  placeholder={t('wizard.conceptPlaceholder')}
                  className="cyber-input mobile-touch-input min-h-[38px] px-2.5 py-1.5 text-base sm:text-xs w-full"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor={`${uid}-generation`}
                  className="font-mono-tech text-[11px] font-bold uppercase text-[var(--ink-primary)]"
                >
                  {t('wizard.generationLabel')}
                </label>
                <input
                  id={`${uid}-generation`}
                  data-testid="wizard-generation-input"
                  type="number"
                  min={state.edition === 'storyteller-v20' ? 7 : 10}
                  max={state.edition === 'storyteller-v20' ? 15 : 16}
                  value={state.generation}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      generation: clampGenerationForEdition(prev.edition, Number(e.target.value)),
                    }))
                  }
                  aria-describedby={`${uid}-generation-hint`}
                  className="cyber-input mobile-touch-input min-h-[38px] px-2.5 py-1.5 text-base sm:text-xs font-bold w-full"
                />
                <span id={`${uid}-generation-hint`} className="font-mono-tech text-[10px] text-[var(--ink-muted)]">
                  {state.edition === 'vampire-v5'
                    ? `${t('wizard.generationHintV5')} · ${t('wizard.bloodPotencyPreview', {
                        bp: getV5InitialBloodPotency(state),
                      })}`
                    : t('wizard.generationHintV20', {
                        bloodPool: getBloodPoolMaxByGeneration(state.generation),
                      })}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor={`${uid}-sire`}
                  className="font-mono-tech text-[11px] font-bold uppercase text-[var(--ink-primary)]"
                >
                  {t('wizard.sireLabel')}
                </label>
                <input
                  id={`${uid}-sire`}
                  data-testid="wizard-sire-input"
                  type="text"
                  value={state.sire}
                  onChange={(e) => setState((prev) => ({ ...prev, sire: e.target.value }))}
                  placeholder={t('wizard.sirePlaceholder')}
                  className="cyber-input mobile-touch-input min-h-[38px] px-2.5 py-1.5 text-base sm:text-xs w-full"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor={`${uid}-chronicle`}
                  className="font-mono-tech text-[11px] font-bold uppercase text-[var(--ink-primary)]"
                >
                  {t('wizard.chronicleLabel')}
                </label>
                <input
                  id={`${uid}-chronicle`}
                  data-testid="wizard-chronicle-input"
                  type="text"
                  value={state.chronicle}
                  onChange={(e) => setState((prev) => ({ ...prev, chronicle: e.target.value }))}
                  placeholder={t('wizard.chroniclePlaceholder')}
                  className="cyber-input mobile-touch-input min-h-[38px] px-2.5 py-1.5 text-base sm:text-xs w-full"
                />
              </div>

              {state.edition === 'vampire-v5' ? (
                <>
                  <div className="flex flex-col gap-1 sm:col-span-2">
                    <label
                      htmlFor={`${uid}-predator-select`}
                      className="font-mono-tech text-[11px] font-bold uppercase text-[var(--ink-primary)]"
                    >
                      {t('wizard.predatorLabel')}
                    </label>
                    <select
                      id={`${uid}-predator-select`}
                      data-testid="wizard-predator-select"
                      value={state.predatorTypeId}
                      onChange={(e) =>
                        setState((prev) => ({
                          ...prev,
                          predatorTypeId: e.target.value,
                          customPredatorType:
                            e.target.value === WOD_WIZARD_CUSTOM_VALUE
                              ? prev.customPredatorType
                              : '',
                        }))
                      }
                      className="cyber-input mobile-touch-input min-h-[38px] px-2.5 py-1.5 text-base sm:text-xs font-semibold w-full"
                    >
                      <option value="">{t('wizard.predatorPlaceholder')}</option>
                      {WOD_V5_PREDATOR_TYPES.map((pred) => (
                        <option key={pred.id} value={pred.id}>
                          {pred.name[language]}
                        </option>
                      ))}
                      <option value={WOD_WIZARD_CUSTOM_VALUE}>
                        {t('wizard.predatorCustomOption')}
                      </option>
                    </select>

                    {state.predatorTypeId === WOD_WIZARD_CUSTOM_VALUE && (
                      <div className="flex flex-col gap-1 pt-1">
                        <label
                          htmlFor={`${uid}-predator-custom`}
                          className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-secondary)]"
                        >
                          {t('wizard.predatorCustomLabel')}
                        </label>
                        <input
                          id={`${uid}-predator-custom`}
                          data-testid="wizard-predator-custom-input"
                          type="text"
                          value={state.customPredatorType}
                          onChange={(e) =>
                            setState((prev) => ({ ...prev, customPredatorType: e.target.value }))
                          }
                          placeholder={t('wizard.predatorCustomPlaceholder')}
                          className="cyber-input mobile-touch-input min-h-[38px] px-2.5 py-1.5 text-base sm:text-xs w-full"
                        />
                      </div>
                    )}

                    {selectedPredator && (
                      <div
                        data-testid="wizard-predator-guide"
                        className="wod-wizard-subcard px-2.5 py-2 flex flex-col gap-0.5 mt-1"
                      >
                        <div className="font-mono-tech text-[10px] text-[var(--ink-primary)]">
                          <span className="font-bold text-[var(--accent-wine)] uppercase">
                            {t('wizard.predatorGuideDisciplines')}:{' '}
                          </span>
                          <span>
                            {selectedPredator.disciplineOptions
                              .map((d) => discNameById.get(d) ?? d)
                              .join(' · ')}
                          </span>
                        </div>
                        <div className="font-mono-tech text-[10px] text-[var(--ink-secondary)]">
                          <span className="font-bold text-[var(--ink-primary)] uppercase">
                            {t('wizard.predatorGuideSpecialty')}:{' '}
                          </span>
                          <span>{selectedPredator.specialtyHint[language]}</span>
                        </div>
                        <div className="font-mono-tech text-[10px] text-[var(--ink-secondary)]">
                          <span className="font-bold text-[var(--ink-primary)] uppercase">
                            {t('wizard.predatorGuideHumanity')}:{' '}
                          </span>
                          <span>
                            {selectedPredator.humanityMod > 0
                              ? `+${selectedPredator.humanityMod}`
                              : selectedPredator.humanityMod}{' '}
                            · {t('wizard.humanityPreview', { humanity: getV5InitialHumanity(state) })}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor={`${uid}-ambition`}
                      className="font-mono-tech text-[11px] font-bold uppercase text-[var(--ink-primary)]"
                    >
                      {t('wizard.ambitionLabel')}
                    </label>
                    <input
                      id={`${uid}-ambition`}
                      data-testid="wizard-ambition-input"
                      type="text"
                      value={state.ambition}
                      onChange={(e) => setState((prev) => ({ ...prev, ambition: e.target.value }))}
                      placeholder={t('wizard.ambitionPlaceholder')}
                      className="cyber-input mobile-touch-input min-h-[38px] px-2.5 py-1.5 text-base sm:text-xs w-full"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor={`${uid}-desire`}
                      className="font-mono-tech text-[11px] font-bold uppercase text-[var(--ink-primary)]"
                    >
                      {t('wizard.desireLabel')}
                    </label>
                    <input
                      id={`${uid}-desire`}
                      data-testid="wizard-desire-input"
                      type="text"
                      value={state.desire}
                      onChange={(e) => setState((prev) => ({ ...prev, desire: e.target.value }))}
                      placeholder={t('wizard.desirePlaceholder')}
                      className="cyber-input mobile-touch-input min-h-[38px] px-2.5 py-1.5 text-base sm:text-xs w-full"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor={`${uid}-nature`}
                      className="font-mono-tech text-[11px] font-bold uppercase text-[var(--ink-primary)]"
                    >
                      {t('wizard.natureLabel')}
                    </label>
                    <input
                      id={`${uid}-nature`}
                      data-testid="wizard-nature-input"
                      type="text"
                      value={state.nature}
                      onChange={(e) => setState((prev) => ({ ...prev, nature: e.target.value }))}
                      placeholder={t('wizard.naturePlaceholder')}
                      className="cyber-input mobile-touch-input min-h-[38px] px-2.5 py-1.5 text-base sm:text-xs w-full"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor={`${uid}-demeanor`}
                      className="font-mono-tech text-[11px] font-bold uppercase text-[var(--ink-primary)]"
                    >
                      {t('wizard.demeanorLabel')}
                    </label>
                    <input
                      id={`${uid}-demeanor`}
                      data-testid="wizard-demeanor-input"
                      type="text"
                      value={state.demeanor}
                      onChange={(e) => setState((prev) => ({ ...prev, demeanor: e.target.value }))}
                      placeholder={t('wizard.demeanorPlaceholder')}
                      className="cyber-input mobile-touch-input min-h-[38px] px-2.5 py-1.5 text-base sm:text-xs w-full"
                    />
                  </div>
                </>
              )}
            </div>
          </section>
        )}

        {/* STEP 2: 3x3 Attributes */}
        {state.currentStep === 2 && (
          <section aria-labelledby={`${uid}-step2-heading`} className="flex flex-col gap-3">
            <h3
              id={`${uid}-step2-heading`}
              ref={stepHeadingRef}
              tabIndex={-1}
              className="font-display text-sm sm:text-base font-extrabold uppercase text-[var(--ink-primary)] outline-none"
            >
              {t('wizard.step2Heading')}
            </h3>

            {state.edition === 'vampire-v5' ? (
              <div className="wod-wizard-panel p-2.5 flex flex-col gap-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono-tech text-[11px] font-extrabold uppercase text-[var(--ink-primary)]">
                    {t('wizard.v5AttrBudgetLabel', {
                      spent: attrSummary.v5PointsSpent,
                      target: attrSummary.v5PointsTarget,
                    })}
                  </span>
                  <span
                    className={`wod-wizard-budget-pill font-mono-tech px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                      stepValidations[2].valid ? 'is-ok' : 'is-warn'
                    }`}
                  >
                    {t('wizard.v5AttrRemaining', {
                      s4: attrSummary.v5RemainingSlots[4],
                      s3: attrSummary.v5RemainingSlots[3],
                      s2: attrSummary.v5RemainingSlots[2],
                      s1: attrSummary.v5RemainingSlots[1],
                    })}
                  </span>
                </div>
                <span className="font-mono-tech text-[10px] text-[var(--ink-muted)]">
                  {t('wizard.v5AttrCapNote')}
                </span>
              </div>
            ) : (
              <div className="wod-wizard-panel p-2.5 font-mono-tech text-[11px] text-[var(--ink-secondary)]">
                {t('wizard.v20AttrBudgetIntro')}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {(['physical', 'social', 'mental'] as WodAttributeGroup[]).map((group) => {
                const groupLabel =
                  group === 'physical'
                    ? t('wizard.attrGroupPhysical')
                    : group === 'social'
                      ? t('wizard.attrGroupSocial')
                      : t('wizard.attrGroupMental');
                const v20GroupInfo = attrSummary.v20Groups.find((g) => g.group === group)!;
                const attrs = WOD_ATTRIBUTE_GROUPS_BY_EDITION[state.edition][group];

                return (
                  <div key={group} className="wod-wizard-subcard p-2.5 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-1.5">
                      <span className="font-mono-tech text-[11px] font-extrabold uppercase text-[var(--accent-wine)]">
                        {groupLabel}
                      </span>
                      {state.edition === 'storyteller-v20' && (
                        <span
                          className={`wod-wizard-budget-pill font-mono-tech px-2 py-0.5 text-[10px] font-extrabold ${
                            v20GroupInfo.remaining === 0 ? 'is-ok' : 'is-warn'
                          }`}
                        >
                          {t('wizard.v20PointsRemaining', {
                            remaining: v20GroupInfo.remaining,
                            budget: v20GroupInfo.budget,
                          })}
                        </span>
                      )}
                    </div>

                    {state.edition === 'storyteller-v20' && (
                      <div className="flex flex-col gap-1">
                        <label
                          htmlFor={`${uid}-attr-prio-${group}`}
                          className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-muted)]"
                        >
                          {t('wizard.v20PriorityLabel')}
                        </label>
                        <select
                          id={`${uid}-attr-prio-${group}`}
                          data-testid={`wizard-v20-attr-priority-${group}`}
                          value={state.v20AttributePriorities[group]}
                          onChange={(e) =>
                            setState((prev) =>
                              assignV20AttributePriority(
                                prev,
                                group,
                                e.target.value as V20PriorityTier,
                              ),
                            )
                          }
                          className="cyber-input mobile-touch-input min-h-[36px] px-2 py-1 text-base sm:text-[11px] font-bold w-full"
                        >
                          <option value="primary">
                            {t('wizard.v20PriorityPrimary', {
                              budget: V20_ATTRIBUTE_PRIORITY_BUDGETS.primary,
                            })}
                          </option>
                          <option value="secondary">
                            {t('wizard.v20PrioritySecondary', {
                              budget: V20_ATTRIBUTE_PRIORITY_BUDGETS.secondary,
                            })}
                          </option>
                          <option value="tertiary">
                            {t('wizard.v20PriorityTertiary', {
                              budget: V20_ATTRIBUTE_PRIORITY_BUDGETS.tertiary,
                            })}
                          </option>
                        </select>
                      </div>
                    )}

                    <div className="flex flex-col gap-2">
                      {attrs.map((attr) => {
                        const val = state.attributes[attr.key] ?? 1;
                        return (
                          <div
                            key={attr.key}
                            className="flex items-center justify-between gap-2 flex-wrap"
                          >
                            <span className="font-mono-tech text-xs font-bold text-[var(--ink-primary)]">
                              {attr.labels[language]}
                            </span>
                            <DotRating
                              label={attr.labels[language]}
                              value={val}
                              min={1}
                              max={5}
                              compact
                              t={cardsT}
                              testId={`wizard-attr-${attr.key}`}
                              onChange={(next) =>
                                setState((prev) => setWizardAttribute(prev, attr.key, next))
                              }
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* STEP 3: Skills */}
        {state.currentStep === 3 && (
          <section aria-labelledby={`${uid}-step3-heading`} className="flex flex-col gap-3">
            <h3
              id={`${uid}-step3-heading`}
              ref={stepHeadingRef}
              tabIndex={-1}
              className="font-display text-sm sm:text-base font-extrabold uppercase text-[var(--ink-primary)] outline-none"
            >
              {t('wizard.step3Heading')}
            </h3>

            {state.edition === 'vampire-v5' ? (
              <div className="wod-wizard-panel p-2.5 flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono-tech text-[11px] font-extrabold uppercase text-[var(--ink-primary)]">
                    {t('wizard.v5SkillArrayLabel')}
                  </span>
                  <span
                    className={`wod-wizard-budget-pill font-mono-tech px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                      stepValidations[3].valid ? 'is-ok' : 'is-warn'
                    }`}
                  >
                    {t('wizard.v5SkillRemaining', { slots: formatV5RemainingSkills() })}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
                  {(
                    [
                      {
                        id: 'balanced' as V5SkillArrayId,
                        title: t('wizard.v5ArrayBalanced'),
                        desc: t('wizard.v5ArrayBalancedDesc'),
                      },
                      {
                        id: 'jack-of-all-trades' as V5SkillArrayId,
                        title: t('wizard.v5ArrayJack'),
                        desc: t('wizard.v5ArrayJackDesc'),
                      },
                      {
                        id: 'specialist' as V5SkillArrayId,
                        title: t('wizard.v5ArraySpecialist'),
                        desc: t('wizard.v5ArraySpecialistDesc'),
                      },
                    ] as const
                  ).map((arr) => {
                    const active = state.v5SkillArray === arr.id;
                    return (
                      <button
                        key={arr.id}
                        type="button"
                        data-testid={`wizard-v5-skill-array-${arr.id}`}
                        aria-pressed={active}
                        onClick={() => setState((prev) => ({ ...prev, v5SkillArray: arr.id }))}
                        className={`wod-creation-mode-btn min-h-[40px] px-2.5 py-1.5 text-left flex flex-col gap-0.5 cursor-pointer ${
                          active ? 'is-active' : ''
                        }`}
                      >
                        <span className="font-mono-tech text-[11px] font-extrabold uppercase">
                          {arr.title}
                        </span>
                        <span className="font-mono-tech text-[10px] opacity-90">{arr.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="wod-wizard-panel p-2.5 flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono-tech text-[11px] text-[var(--ink-secondary)]">
                    {t('wizard.v20SkillBudgetIntro')}
                  </span>
                  <span className="font-mono-tech text-[10px] font-bold text-[var(--accent-wine)]">
                    {t('wizard.skillV20CapHint')}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {skillSummary.v20Groups.map((g) => {
                    const groupTitle = WOD_CATEGORY_LABELS[g.group][language];
                    return (
                      <div key={g.group} className="wod-wizard-subcard p-2 flex flex-col gap-1">
                        <div className="flex items-center justify-between gap-1">
                          <label
                            htmlFor={`${uid}-skill-prio-${g.group}`}
                            className="font-mono-tech text-[10px] font-extrabold uppercase text-[var(--ink-primary)]"
                          >
                            {groupTitle}
                          </label>
                          <span
                            className={`wod-wizard-budget-pill font-mono-tech px-1.5 py-0.5 text-[10px] font-extrabold ${
                              g.remaining === 0 && g.overCapKeys.length === 0 ? 'is-ok' : 'is-warn'
                            }`}
                          >
                            {t('wizard.v20PointsRemaining', {
                              remaining: g.remaining,
                              budget: g.budget,
                            })}
                          </span>
                        </div>
                        <select
                          id={`${uid}-skill-prio-${g.group}`}
                          data-testid={`wizard-v20-skill-priority-${g.group}`}
                          value={g.tier}
                          onChange={(e) =>
                            setState((prev) =>
                              assignV20SkillPriority(
                                prev,
                                g.group as V20SkillGroup,
                                e.target.value as V20PriorityTier,
                              ),
                            )
                          }
                          className="cyber-input mobile-touch-input min-h-[36px] px-2 py-1 text-base sm:text-[11px] font-bold w-full"
                        >
                          <option value="primary">
                            {t('wizard.v20PriorityPrimary', {
                              budget: V20_SKILL_PRIORITY_BUDGETS.primary,
                            })}
                          </option>
                          <option value="secondary">
                            {t('wizard.v20PrioritySecondary', {
                              budget: V20_SKILL_PRIORITY_BUDGETS.secondary,
                            })}
                          </option>
                          <option value="tertiary">
                            {t('wizard.v20PriorityTertiary', {
                              budget: V20_SKILL_PRIORITY_BUDGETS.tertiary,
                            })}
                          </option>
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Skill Search */}
            <search>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor={`${uid}-skill-search`}
                  className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-muted)]"
                >
                  {t('wizard.skillSearchLabel')}
                </label>
                <div className="relative flex items-center">
                  <Search
                    className="w-3.5 h-3.5 text-[var(--ink-muted)] absolute left-3 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    id={`${uid}-skill-search`}
                    data-testid="wizard-skill-search"
                    type="search"
                    value={skillQuery}
                    onChange={(e) => setSkillQuery(e.target.value)}
                    placeholder={t('wizard.skillSearchPlaceholder')}
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    className="cyber-input mobile-touch-input min-h-[36px] pl-8 pr-8 py-1 text-base sm:text-xs w-full"
                  />
                  {skillQuery && (
                    <button
                      type="button"
                      aria-label={t('home.clearSearchAria')}
                      onClick={() => setSkillQuery('')}
                      className="min-h-[36px] min-w-[36px] absolute right-0.5 flex items-center justify-center text-[var(--ink-muted)] hover:text-[var(--ink-primary)] cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
            </search>

            {/* Skill Columns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {groupedSkills.map((group) => (
                <div key={group.category} className="wod-wizard-subcard p-2.5 flex flex-col gap-2">
                  <div className="font-mono-tech text-[11px] font-extrabold uppercase text-[var(--accent-wine)] border-b border-[var(--border-subtle)] pb-1">
                    {group.labels[language]}
                  </div>
                  <div className="flex flex-col gap-2">
                    {group.skills.map((skill) => {
                      const dots = state.skills[skill.varName] ?? 0;
                      const isV5FreeSpec =
                        state.edition === 'vampire-v5' &&
                        V5_FREE_SPECIALTY_SKILL_KEYS.has(skill.varName) &&
                        dots > 0;
                      const specId = `${uid}-spec-${skill.varName}`;
                      return (
                        <div
                          key={skill.id}
                          className="flex flex-col gap-1 border-b border-[var(--border-subtle)]/50 pb-1.5 last:border-b-0 last:pb-0"
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1 min-w-0 flex-wrap">
                              <span className="font-mono-tech text-xs font-bold text-[var(--ink-primary)]">
                                {skill.labels[language]}
                              </span>
                              {isV5FreeSpec && (
                                <span className="wod-wizard-budget-pill is-ok font-mono-tech px-1.5 py-0.5 text-[9px] font-extrabold uppercase">
                                  {t('wizard.freeSpecialtyBadge')}
                                </span>
                              )}
                            </div>
                            <DotRating
                              label={skill.labels[language]}
                              value={dots}
                              min={0}
                              max={5}
                              compact
                              t={cardsT}
                              testId={`wizard-skill-${skill.varName}`}
                              onChange={(next) =>
                                setState((prev) => setWizardSkill(prev, skill.varName, next))
                              }
                            />
                          </div>
                          {dots > 0 && (
                            <div className="flex items-center gap-1.5">
                              <label
                                htmlFor={specId}
                                className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-muted)] shrink-0"
                              >
                                {t('wizard.skillSpecialtyLabel')}
                              </label>
                              <input
                                id={specId}
                                data-testid={`wizard-skill-spec-${skill.varName}`}
                                type="text"
                                value={state.skillSpecialties[skill.varName] ?? ''}
                                onChange={(e) =>
                                  setState((prev) =>
                                    setWizardSkillSpecialty(prev, skill.varName, e.target.value),
                                  )
                                }
                                placeholder={t('wizard.skillSpecialtyPlaceholder')}
                                className="cyber-input mobile-touch-input min-h-[36px] px-2 py-0.5 text-base sm:text-[11px] w-full"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* STEP 4: Disciplines, Virtues/Backgrounds, Merits/Flaws, Haven & Touchstones */}
        {state.currentStep === 4 && (
          <section aria-labelledby={`${uid}-step4-heading`} className="flex flex-col gap-3.5">
            <h3
              id={`${uid}-step4-heading`}
              ref={stepHeadingRef}
              tabIndex={-1}
              className="font-display text-sm sm:text-base font-extrabold uppercase text-[var(--ink-primary)] outline-none"
            >
              {t('wizard.step4Heading')}
            </h3>

            {/* Live Budget Strip */}
            <div className="wod-wizard-panel p-2.5 flex flex-wrap gap-1.5">
              <span
                className={`wod-wizard-budget-pill font-mono-tech px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                  dossierSummary.disciplinesTotal === dossierSummary.disciplinesTarget &&
                  (state.edition === 'storyteller-v20' ||
                    (dossierSummary.hasValidV5Split && dossierSummary.powerGaps.length === 0))
                    ? 'is-ok'
                    : 'is-warn'
                }`}
              >
                {t('wizard.disciplinesTitle', {
                  current: dossierSummary.disciplinesTotal,
                  target: dossierSummary.disciplinesTarget,
                })}
              </span>

              {state.edition === 'vampire-v5' ? (
                <>
                  <span
                    className={`wod-wizard-budget-pill font-mono-tech px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                      dossierSummary.v5AdvantagesTotal === dossierSummary.v5AdvantagesTarget
                        ? 'is-ok'
                        : 'is-warn'
                    }`}
                  >
                    {t('wizard.v5BudgetAdvantages', {
                      current: dossierSummary.v5AdvantagesTotal,
                      target: dossierSummary.v5AdvantagesTarget,
                      bg: dossierSummary.backgroundsTotal,
                      merits: dossierSummary.v5MeritsTotal,
                      haven: dossierSummary.v5HavenRating,
                    })}
                  </span>
                  <span
                    className={`wod-wizard-budget-pill font-mono-tech px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                      dossierSummary.v5FlawsTotal === dossierSummary.v5FlawsTarget
                        ? 'is-ok'
                        : 'is-warn'
                    }`}
                  >
                    {t('wizard.v5BudgetFlaws', {
                      current: dossierSummary.v5FlawsTotal,
                      target: dossierSummary.v5FlawsTarget,
                      list: dossierSummary.v5FlawsListTotal,
                      haven: dossierSummary.v5HavenFlawsTotal,
                    })}
                  </span>
                  <span
                    className={`wod-wizard-budget-pill font-mono-tech px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                      dossierSummary.v5TouchstonesValidCount >= V5_TOUCHSTONES_MIN &&
                      dossierSummary.v5TouchstonesValidCount <= V5_TOUCHSTONES_MAX
                        ? 'is-ok'
                        : 'is-warn'
                    }`}
                  >
                    {t('wizard.touchstonesTitle', {
                      count: dossierSummary.v5TouchstonesValidCount,
                      min: V5_TOUCHSTONES_MIN,
                      max: V5_TOUCHSTONES_MAX,
                    })}
                  </span>
                </>
              ) : (
                <>
                  <span
                    className={`wod-wizard-budget-pill font-mono-tech px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                      dossierSummary.backgroundsTotal === dossierSummary.v20BackgroundsTarget
                        ? 'is-ok'
                        : 'is-warn'
                    }`}
                  >
                    {t('wizard.v20BudgetBackgrounds', {
                      current: dossierSummary.backgroundsTotal,
                      target: dossierSummary.v20BackgroundsTarget,
                    })}
                  </span>
                  <span
                    className={`wod-wizard-budget-pill font-mono-tech px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                      dossierSummary.v20VirtuesExtraSpent === dossierSummary.v20VirtuesExtraTarget
                        ? 'is-ok'
                        : 'is-warn'
                    }`}
                  >
                    {t('wizard.virtuesTitle', {
                      spent: dossierSummary.v20VirtuesExtraSpent,
                      target: dossierSummary.v20VirtuesExtraTarget,
                    })}
                  </span>
                </>
              )}
            </div>

            {/* 4A. Disciplines & Powers */}
            <div className="wod-wizard-panel p-3 flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="font-mono-tech text-xs font-extrabold uppercase text-[var(--ink-primary)]">
                    {t('wizard.disciplinesTitle', {
                      current: dossierSummary.disciplinesTotal,
                      target: dossierSummary.disciplinesTarget,
                    })}
                  </span>
                  <span className="font-mono-tech text-[10px] text-[var(--ink-secondary)]">
                    {state.edition === 'vampire-v5'
                      ? dossierSummary.allowsFreeDisciplines
                        ? t('wizard.disciplinesHintV5Free')
                        : t('wizard.disciplinesHintV5')
                      : dossierSummary.allowsFreeDisciplines
                        ? t('wizard.disciplinesHintV20Free')
                        : t('wizard.disciplinesHintV20')}
                  </span>
                </div>
                {!resolvedClanInfo.allowsFreeDisciplines && resolvedClanInfo.clanEntry && (
                  <button
                    type="button"
                    data-testid="wizard-toggle-all-disciplines"
                    onClick={() => setShowAllDisciplines((prev) => !prev)}
                    aria-pressed={showAllDisciplines}
                    className="cyber-btn-outline min-h-[36px] px-2.5 py-1 font-mono-tech text-[10px] font-bold uppercase cursor-pointer"
                  >
                    {t('wizard.showAllDisciplines')}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {visibleDisciplines.map((disc) => {
                  const dots = state.disciplines[disc.id] ?? 0;
                  const affinity = resolveDisciplineAffinity(
                    resolveWizardClanName(state, language),
                    disc.id,
                    state.edition,
                  );
                  const eligiblePowers = disc.powers.filter((p) => p.level <= dots);
                  const chosenIds = state.selectedPowers[disc.id] ?? [];

                  return (
                    <div
                      key={disc.id}
                      className="wod-wizard-subcard p-2.5 flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          <span className="font-mono-tech text-xs font-extrabold text-[var(--ink-primary)]">
                            {disc.name[language]}
                          </span>
                          {!resolvedClanInfo.allowsFreeDisciplines &&
                            resolvedClanInfo.clanEntry && (
                              <span
                                className={`font-mono-tech text-[9px] font-extrabold px-1.5 py-0.5 rounded-[var(--radius-sm)] border ${
                                  affinity === 'discipline_clan'
                                    ? 'border-[var(--accent-wine)] text-[var(--accent-wine)] bg-[var(--accent-cream-badge)]'
                                    : 'border-[var(--border-ink)] text-[var(--ink-muted)] bg-[var(--bg-card-alt)]'
                                }`}
                              >
                                {affinity === 'discipline_clan'
                                  ? t('wizard.inClanTag')
                                  : t('wizard.outOfClanTag')}
                              </span>
                            )}
                        </div>

                        <DotRating
                          label={disc.name[language]}
                          value={dots}
                          min={0}
                          max={5}
                          compact
                          t={cardsT}
                          testId={`wizard-disc-${disc.id}`}
                          onChange={(next) =>
                            setState((prev) => setWizardDiscipline(prev, disc.id, next))
                          }
                        />
                      </div>

                      {dots > 0 && eligiblePowers.length > 0 && (
                        <div className="flex flex-col gap-1 border-t border-[var(--border-subtle)] pt-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono-tech text-[10px] font-bold text-[var(--ink-muted)]">
                              {t('wizard.powersSelectHint', { dots })}
                            </span>
                            {state.edition === 'vampire-v5' && (
                              <span
                                className={`wod-wizard-budget-pill font-mono-tech px-1.5 py-0.5 text-[9px] font-extrabold ${
                                  chosenIds.length === dots ? 'is-ok' : 'is-warn'
                                }`}
                              >
                                {t('wizard.powersPickedCounter', {
                                  selected: chosenIds.length,
                                  dots,
                                })}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-col gap-1">
                            {eligiblePowers.map((power) => {
                              const checked = chosenIds.includes(power.id);
                              const disabledCheck =
                                !checked && state.strictRules && chosenIds.length >= dots;
                              const checkId = `${uid}-pwr-${power.id}`;
                              return (
                                <label
                                  key={power.id}
                                  htmlFor={checkId}
                                  className={`flex items-center justify-between gap-2 px-2 py-1 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] text-[11px] font-mono-tech ${
                                    disabledCheck
                                      ? 'opacity-60 cursor-not-allowed'
                                      : 'cursor-pointer hover:bg-[var(--bg-hover)]'
                                  }`}
                                >
                                  <span className="flex items-center gap-1.5 min-w-0">
                                    <input
                                      id={checkId}
                                      data-testid={`wizard-power-${power.id}`}
                                      type="checkbox"
                                      checked={checked}
                                      disabled={disabledCheck}
                                      onChange={() =>
                                        setState((prev) =>
                                          toggleWizardDisciplinePower(prev, disc.id, power.id),
                                        )
                                      }
                                    />
                                    <span className="truncate font-semibold text-[var(--ink-primary)]">
                                      {t('wizard.powerLevelShort', { level: power.level })} · {power.name[language]}
                                    </span>
                                  </span>
                                  <span className="text-[9px] font-extrabold text-[var(--accent-wine)] shrink-0">
                                    {formatPowerCostLabel(
                                      power.costType,
                                      power.costAmount,
                                      language,
                                    )}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 4B. V20 Virtues (7 extra pts) */}
            {state.edition === 'storyteller-v20' && (
              <div className="wod-wizard-panel p-3 flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono-tech text-xs font-extrabold uppercase text-[var(--ink-primary)]">
                    {t('wizard.virtuesTitle', {
                      spent: dossierSummary.v20VirtuesExtraSpent,
                      target: dossierSummary.v20VirtuesExtraTarget,
                    })}
                  </span>
                  <span className="font-mono-tech text-[10px] font-bold text-[var(--accent-wine)]">
                    {t('wizard.virtuesDerivedPreview', {
                      humanity: dossierSummary.v20DerivedHumanity,
                      willpower: dossierSummary.v20DerivedWillpower,
                    })}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(
                    [
                      { key: 'conscience', label: t('wizard.virtueConscience') },
                      { key: 'selfControl', label: t('wizard.virtueSelfControl') },
                      { key: 'courage', label: t('wizard.virtueCourage') },
                    ] as const
                  ).map((v) => (
                    <div
                      key={v.key}
                      className="wod-wizard-subcard p-2 flex items-center justify-between gap-2 flex-wrap"
                    >
                      <span className="font-mono-tech text-xs font-bold text-[var(--ink-primary)]">
                        {v.label}
                      </span>
                      <DotRating
                        label={v.label}
                        value={state.virtues[v.key]}
                        min={1}
                        max={5}
                        compact
                        t={cardsT}
                        testId={`wizard-virtue-${v.key}`}
                        onChange={(next) =>
                          setState((prev) => ({
                            ...prev,
                            virtues: {
                              ...prev.virtues,
                              [v.key]: Math.max(1, Math.min(5, Math.round(next))),
                            },
                          }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4C. Backgrounds (Official Catalog, excluding Haven) */}
            <div className="wod-wizard-panel p-3 flex flex-col gap-2">
              <div className="flex flex-col gap-0.5">
                <span className="font-mono-tech text-xs font-extrabold uppercase text-[var(--ink-primary)]">
                  {t('wizard.backgroundsTitle')} ({dossierSummary.backgroundsTotal})
                </span>
                <span className="font-mono-tech text-[10px] text-[var(--ink-muted)]">
                  {t('wizard.backgroundsHavenNote')}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {catalogBackgrounds.map((adv) => {
                  const dots = state.backgrounds[adv.id] ?? 0;
                  return (
                    <div
                      key={adv.id}
                      className="wod-wizard-subcard p-2 flex flex-col gap-1"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-mono-tech text-xs font-bold text-[var(--ink-primary)]">
                          {adv.name[language]}
                        </span>
                        <DotRating
                          label={adv.name[language]}
                          value={dots}
                          min={0}
                          max={5}
                          compact
                          t={cardsT}
                          testId={`wizard-bg-${adv.id}`}
                          onChange={(next) =>
                            setState((prev) => setWizardBackground(prev, adv.id, next))
                          }
                        />
                      </div>
                      <span className="font-mono-tech text-[10px] leading-snug text-[var(--ink-muted)]">
                        {adv.summary[language]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 4D. Merits & Flaws */}
            <div className="wod-wizard-panel p-3 flex flex-col gap-2.5">
              <span className="font-mono-tech text-xs font-extrabold uppercase text-[var(--ink-primary)]">
                {t('wizard.meritsFlawsTitle')}
              </span>

              <div className="flex flex-col sm:flex-row gap-2">
                <search className="flex-1">
                  <label htmlFor={`${uid}-merits-search`} className="sr-only">
                    {t('wizard.meritsSearchLabel')}
                  </label>
                  <div className="relative flex items-center">
                    <Search
                      className="w-3.5 h-3.5 text-[var(--ink-muted)] absolute left-3 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      id={`${uid}-merits-search`}
                      data-testid="wizard-merits-search"
                      type="search"
                      value={meritQuery}
                      onChange={(e) => setMeritQuery(e.target.value)}
                      placeholder={t('wizard.meritsSearchPlaceholder')}
                      autoCorrect="off"
                      autoCapitalize="none"
                      spellCheck={false}
                      className="cyber-input mobile-touch-input min-h-[36px] pl-8 pr-8 py-1 text-base sm:text-xs w-full"
                    />
                    {meritQuery && (
                      <button
                        type="button"
                        aria-label={t('home.clearSearchAria')}
                        onClick={() => setMeritQuery('')}
                        className="min-h-[36px] min-w-[36px] absolute right-0.5 flex items-center justify-center text-[var(--ink-muted)] cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </search>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {(
                    [
                      { id: 'all', label: t('wizard.meritsFilterAll') },
                      { id: 'merit', label: t('wizard.meritsFilterMerit') },
                      { id: 'flaw', label: t('wizard.meritsFilterFlaw') },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setMeritFilter(f.id)}
                      aria-pressed={meritFilter === f.id}
                      className={`wod-structured-filter-chip font-mono-tech min-h-[36px] px-2.5 py-1 text-[10px] font-bold uppercase cursor-pointer ${
                        meritFilter === f.id ? 'is-active' : ''
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Catalog Chips */}
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                {catalogMeritsAndFlaws.map((entry) => (
                  <button
                    key={`${entry.group}-${entry.id}`}
                    type="button"
                    data-testid={`wizard-mf-catalog-${entry.id}`}
                    onClick={() => addCatalogMeritOrFlaw(entry)}
                    className={`wod-structured-catalog-btn font-mono-tech min-h-[36px] px-2.5 py-1 text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer ${
                      entry.group === 'flaw' ? 'border-dashed' : ''
                    }`}
                  >
                    <Plus className="w-3 h-3 shrink-0" aria-hidden="true" />
                    <span>{entry.name[language]}</span>
                    <span
                      className={
                        entry.group === 'flaw'
                          ? 'text-[var(--accent-danger)] font-extrabold'
                          : 'text-[var(--accent-wine)] font-extrabold'
                      }
                    >
                      {entry.group === 'flaw' ? '(-)' : '(+)'}
                    </span>
                  </button>
                ))}
              </div>

              {/* Custom Merit / Flaw Input */}
              <div className="wod-wizard-subcard p-2 grid grid-cols-1 sm:grid-cols-[auto_1fr_auto_auto] gap-1.5 items-end">
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor={`${uid}-custom-mf-kind`}
                    className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-muted)]"
                  >
                    {t('wizard.addCustomMeritLabel')}
                  </label>
                  <select
                    id={`${uid}-custom-mf-kind`}
                    value={customMfKind}
                    onChange={(e) => setCustomMfKind(e.target.value as MeritFlawKind)}
                    className="cyber-input mobile-touch-input min-h-[36px] px-2 py-1 text-base sm:text-xs font-bold"
                  >
                    <option value="merit">{t('wizard.customKindMerit')}</option>
                    <option value="flaw">{t('wizard.customKindFlaw')}</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor={`${uid}-custom-mf-name`} className="sr-only">
                    {t('wizard.addCustomMeritPlaceholder')}
                  </label>
                  <input
                    id={`${uid}-custom-mf-name`}
                    data-testid="wizard-custom-mf-name"
                    type="text"
                    value={customMfName}
                    onChange={(e) => setCustomMfName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCustomMeritFlaw();
                      }
                    }}
                    placeholder={t('wizard.addCustomMeritPlaceholder')}
                    className="cyber-input mobile-touch-input min-h-[36px] px-2.5 py-1 text-base sm:text-xs w-full"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label
                    htmlFor={`${uid}-custom-mf-rating`}
                    className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-muted)]"
                  >
                    {t('wizard.customRatingLabel')}
                  </label>
                  <select
                    id={`${uid}-custom-mf-rating`}
                    value={customMfRating}
                    onChange={(e) => setCustomMfRating(Number(e.target.value))}
                    className="cyber-input mobile-touch-input min-h-[36px] px-2 py-1 text-base sm:text-xs font-bold"
                  >
                    {[1, 2, 3, 4, 5].map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  data-testid="wizard-add-custom-mf-btn"
                  onClick={handleAddCustomMeritFlaw}
                  className="cyber-btn-outline min-h-[36px] px-3 py-1 font-mono-tech text-[10px] font-extrabold uppercase cursor-pointer"
                >
                  {t('wizard.addBtn')}
                </button>
              </div>

              {/* Selected Merits & Flaws List */}
              {state.meritsFlaws.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {state.meritsFlaws.map((mf) => (
                    <div
                      key={mf.id}
                      className="wod-wizard-subcard p-2 flex flex-col gap-1.5"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`font-mono-tech text-[9px] font-extrabold px-1.5 py-0.5 uppercase ${
                              mf.kind === 'flaw' ? 'wod-mf-badge--flaw' : 'wod-mf-badge--merit'
                            }`}
                          >
                            {mf.kind === 'flaw'
                              ? t('wizard.customKindFlaw')
                              : t('wizard.customKindMerit')}
                          </span>
                          <span className="font-mono-tech text-xs font-bold text-[var(--ink-primary)] truncate">
                            {mf.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <DotRating
                            label={mf.name}
                            value={mf.rating}
                            min={1}
                            max={5}
                            compact
                            t={cardsT}
                            onChange={(next) =>
                              setState((prev) => ({
                                ...prev,
                                meritsFlaws: prev.meritsFlaws.map((item) =>
                                  item.id === mf.id ? { ...item, rating: next } : item,
                                ),
                              }))
                            }
                          />
                          <button
                            type="button"
                            aria-label={`${t('wizard.removeBtn')} ${mf.name}`}
                            onClick={() =>
                              setState((prev) => ({
                                ...prev,
                                meritsFlaws: prev.meritsFlaws.filter((item) => item.id !== mf.id),
                              }))
                            }
                            className="cyber-btn-outline min-h-[36px] min-w-[36px] px-2 py-1 inline-flex items-center justify-center cursor-pointer"
                          >
                            <Trash2
                              className="w-3.5 h-3.5 text-[var(--accent-danger)]"
                              aria-hidden="true"
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 4E. Haven */}
            <div className="wod-wizard-panel p-3 flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono-tech text-xs font-extrabold uppercase text-[var(--ink-primary)]">
                  {t('wizard.havenTitle')}
                </span>
                <DotRating
                  label={t('wizard.havenRatingLabel')}
                  value={state.haven.rating}
                  min={0}
                  max={5}
                  compact
                  t={cardsT}
                  testId="wizard-haven-rating"
                  onChange={(next) =>
                    setState((prev) => ({
                      ...prev,
                      haven: { ...prev.haven, rating: next },
                    }))
                  }
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor={`${uid}-haven-name`}
                    className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-primary)]"
                  >
                    {t('wizard.havenNameLabel')}
                  </label>
                  <input
                    id={`${uid}-haven-name`}
                    data-testid="wizard-haven-name"
                    type="text"
                    value={state.haven.name}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        haven: { ...prev.haven, name: e.target.value },
                      }))
                    }
                    placeholder={t('wizard.havenNamePlaceholder')}
                    className="cyber-input mobile-touch-input min-h-[36px] px-2.5 py-1 text-base sm:text-xs w-full"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor={`${uid}-haven-loc`}
                    className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-primary)]"
                  >
                    {t('wizard.havenLocationLabel')}
                  </label>
                  <input
                    id={`${uid}-haven-loc`}
                    data-testid="wizard-haven-location"
                    type="text"
                    value={state.haven.location}
                    onChange={(e) =>
                      setState((prev) => ({
                        ...prev,
                        haven: { ...prev.haven, location: e.target.value },
                      }))
                    }
                    placeholder={t('wizard.havenLocationPlaceholder')}
                    className="cyber-input mobile-touch-input min-h-[36px] px-2.5 py-1 text-base sm:text-xs w-full"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-muted)]">
                  {t('wizard.havenTraitsLabel')}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {havenTraitsCatalog.map((trait) => {
                    const active = state.haven.traits.includes(trait.id);
                    return (
                      <button
                        key={trait.id}
                        type="button"
                        data-testid={`wizard-haven-trait-${trait.id}`}
                        aria-pressed={active}
                        onClick={() => setState((prev) => toggleWizardHavenTrait(prev, trait.id))}
                        className={`wod-haven-trait-chip font-mono-tech min-h-[36px] px-2.5 py-1 text-[10px] font-bold cursor-pointer ${
                          trait.kind === 'flaw' ? 'is-flaw' : ''
                        } ${active ? 'is-active' : ''}`}
                      >
                        {trait.name[language]}
                        {trait.kind === 'flaw' ? ' (-)' : ''}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label
                  htmlFor={`${uid}-haven-notes`}
                  className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-primary)]"
                >
                  {t('wizard.havenNotesLabel')}
                </label>
                <input
                  id={`${uid}-haven-notes`}
                  type="text"
                  value={state.haven.notes}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      haven: { ...prev.haven, notes: e.target.value },
                    }))
                  }
                  placeholder={t('wizard.havenNotesPlaceholder')}
                  className="cyber-input mobile-touch-input min-h-[36px] px-2.5 py-1 text-base sm:text-xs w-full"
                />
              </div>
            </div>

            {/* 4F. V5 Convictions & Touchstones */}
            {state.edition === 'vampire-v5' && (
              <div className="wod-wizard-panel p-3 flex flex-col gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono-tech text-xs font-extrabold uppercase text-[var(--ink-primary)]">
                    {t('wizard.touchstonesTitle', {
                      count: dossierSummary.v5TouchstonesValidCount,
                      min: V5_TOUCHSTONES_MIN,
                      max: V5_TOUCHSTONES_MAX,
                    })}
                  </span>
                  <button
                    type="button"
                    data-testid="wizard-add-touchstone-btn"
                    onClick={handleAddTouchstone}
                    disabled={state.strictRules && state.touchstones.length >= V5_TOUCHSTONES_MAX}
                    className="cyber-btn-outline min-h-[36px] px-2.5 py-1 font-mono-tech text-[10px] font-extrabold uppercase cursor-pointer"
                  >
                    {t('wizard.addTouchstoneBtn')}
                  </button>
                </div>

                {state.touchstones.map((ts, idx) => (
                  <div
                    key={ts.id}
                    className="wod-wizard-subcard p-2.5 flex flex-col gap-2"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <label
                          htmlFor={`${uid}-ts-conv-${ts.id}`}
                          className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-primary)]"
                        >
                          {t('wizard.touchstoneConvictionLabel')} #{idx + 1}
                        </label>
                        <input
                          id={`${uid}-ts-conv-${ts.id}`}
                          data-testid={`wizard-ts-conviction-${idx}`}
                          type="text"
                          value={ts.conviction}
                          onChange={(e) =>
                            setState((prev) => ({
                              ...prev,
                              touchstones: prev.touchstones.map((item) =>
                                item.id === ts.id ? { ...item, conviction: e.target.value } : item,
                              ),
                            }))
                          }
                          placeholder={t('wizard.touchstoneConvictionPlaceholder')}
                          className="cyber-input mobile-touch-input min-h-[36px] px-2.5 py-1 text-base sm:text-xs w-full"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label
                          htmlFor={`${uid}-ts-person-${ts.id}`}
                          className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-primary)]"
                        >
                          {t('wizard.touchstonePersonLabel')} #{idx + 1}
                        </label>
                        <input
                          id={`${uid}-ts-person-${ts.id}`}
                          data-testid={`wizard-ts-person-${idx}`}
                          type="text"
                          value={ts.touchstone}
                          onChange={(e) =>
                            setState((prev) => ({
                              ...prev,
                              touchstones: prev.touchstones.map((item) =>
                                item.id === ts.id ? { ...item, touchstone: e.target.value } : item,
                              ),
                            }))
                          }
                          placeholder={t('wizard.touchstonePersonPlaceholder')}
                          className="cyber-input mobile-touch-input min-h-[36px] px-2.5 py-1 text-base sm:text-xs w-full"
                        />
                      </div>
                    </div>

                    <div className="flex items-end gap-2">
                      <div className="flex-1 flex flex-col gap-1">
                        <label
                          htmlFor={`${uid}-ts-notes-${ts.id}`}
                          className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-muted)]"
                        >
                          {t('wizard.touchstoneNotesLabel')}
                        </label>
                        <input
                          id={`${uid}-ts-notes-${ts.id}`}
                          type="text"
                          value={ts.notes ?? ''}
                          onChange={(e) =>
                            setState((prev) => ({
                              ...prev,
                              touchstones: prev.touchstones.map((item) =>
                                item.id === ts.id ? { ...item, notes: e.target.value } : item,
                              ),
                            }))
                          }
                          placeholder={t('wizard.touchstoneNotesPlaceholder')}
                          className="cyber-input mobile-touch-input min-h-[36px] px-2.5 py-1 text-base sm:text-xs w-full"
                        />
                      </div>
                      <button
                        type="button"
                        aria-label={`${t('wizard.removeBtn')} #${idx + 1}`}
                        onClick={() =>
                          setState((prev) => ({
                            ...prev,
                            touchstones: prev.touchstones.filter((item) => item.id !== ts.id),
                          }))
                        }
                        className="cyber-btn-outline min-h-[36px] min-w-[36px] px-2 py-1 inline-flex items-center justify-center shrink-0 cursor-pointer"
                      >
                        <Trash2
                          className="w-3.5 h-3.5 text-[var(--accent-danger)]"
                          aria-hidden="true"
                        />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Fixed Navigation Footer */}
      <div className="modal-dialog-footer flex flex-col gap-2">
        {state.strictRules && !currentValidation.valid && (
          <div
            role="status"
            aria-live="polite"
            data-testid="wizard-validation-alert"
            className="wod-wizard-alert px-2.5 py-1.5 flex items-start gap-2 font-mono-tech text-[10px] leading-snug"
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="min-w-0 flex flex-col gap-0.5">
              <span className="font-extrabold uppercase">{t('wizard.pendingHeading')}</span>
              <ul className="list-disc pl-4 m-0 space-y-0.5">
                {currentValidation.issues.map((issue) => (
                  <li key={issue.code}>{formatWizardIssue(issue, t)}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {onCancel && (
              <button
                type="button"
                data-testid="wizard-cancel-btn"
                onClick={onCancel}
                className="cyber-btn-outline min-h-[38px] px-3 py-2 text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                {t('home.wodModalCancel')}
              </button>
            )}
            <button
              type="button"
              data-testid="wizard-prev-btn"
              disabled={state.currentStep <= 1}
              onClick={handlePrev}
              className="cyber-btn-outline min-h-[38px] px-3.5 py-2 text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t('wizard.prevBtn')}</span>
            </button>
          </div>

          {state.currentStep < 4 ? (
            <button
              type="button"
              data-testid="wizard-next-btn"
              disabled={!canAdvanceCurrent}
              onClick={handleNext}
              className="cyber-roll-btn min-h-[38px] px-4 py-2 text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer"
            >
              <span>{t('wizard.nextBtn')}</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              data-testid="wizard-finish-btn"
              disabled={!canFinish}
              onClick={handleFinish}
              className="cyber-roll-btn min-h-[38px] px-4 py-2 text-xs font-bold uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t('wizard.finishBtn')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default WodCreationWizard;
