import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown, Flame, Minus, Plus, Search, Trash2, X } from 'lucide-react';
import {
  FrenzyKind,
  getV5BloodPotencyStats,
  V20FrenzyVirtue,
} from '../core/formula';
import {
  AppMode,
  FieldKind,
  HavenEntry,
  MeritFlawEntry,
  reorderFieldInCard,
  RulePreset,
  SheetCard,
  SheetEvaluation,
  SheetField,
  SystemId,
  TouchstoneEntry,
  V5WillpowerState,
  VirtuesState,
} from '../core/sheetModel';
import { AppLanguage, AppTranslations, getTranslations } from '../core/i18n';
import {
  buildCatalogSkillFields,
  getGroupedWodSkillsCatalog,
  isCatalogSkillPresent,
  isOfficialVampireSheet,
  normalizeCatalogText,
  WodCatalogSkill,
} from '../core/wodSkillsCatalog';
import {
  buildCatalogDisciplineField,
  buildCatalogPowerRow,
  findClanByIdOrName,
  formatPowerCostLabel,
  getDisciplinesForEdition,
  isCatalogDisciplinePresent,
  isCatalogPowerPresent,
  resolveDisciplineAffinity,
  WodDisciplineCatalogEntry,
  WodDisciplinePower,
  WodPowerCostType,
} from '../core/wodClansDisciplinesCatalog';
import {
  buildCatalogAdvantageField,
  getAdvantagesForEdition,
  isAdvantageCardCandidate,
  isCatalogAdvantagePresentInCardFields,
  WodAdvantageCatalogEntry,
  WodAdvantageGroup,
} from '../core/wodAdvantagesCatalog';
import { AnimatedCounter } from './AnimatedCounter';
import { DotRating } from './DotRating';
import { FieldPrimitive } from './FieldPrimitives';
import { WodStructuredBlocks } from './WodStructuredBlocks';
import { isFullWidthBentoCard } from '../utils/bentoLayout';

interface BentoCardProps {
  card: SheetCard;
  displayFields?: SheetField[];
  filteredInfo?: { shown: number; total: number };
  mode: AppMode;
  systemId?: SystemId;
  rulePreset?: RulePreset;
  clan?: string;
  woundPenalty?: number;
  bloodPool?: { current: number; max: number };
  virtues?: VirtuesState;
  bloodSurge?: boolean;
  bloodSurgeBonus?: number;
  bloodPotency?: number;
  lastSoakTotal?: number | null;
  canWillpowerSurge?: boolean;
  v5WillpowerState?: V5WillpowerState;
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
  onAdjustV5WillpowerDamage?: (
    damageType: 'superficial' | 'aggravated',
    delta: number,
  ) => void;
  onAdjustHumanityStains?: (delta: number) => void;
  onTriggerRemorseCheck?: () => void;
  onTriggerFrenzyRoll?: (options: {
    difficulty?: number;
    virtue?: V20FrenzyVirtue;
    kind?: FrenzyKind;
  }) => void;
  onApplyV5SuperficialHalving?: (fieldId: string, rawDamage: number) => void;
  onMendSuperficialWithRouse?: (fieldId: string) => void;
  onAdjustBloodPool?: (delta: number) => void;
  onSetBloodPool?: (nextVal: number) => void;
  onUpdateVirtue?: (virtue: keyof VirtuesState, nextVal: number) => void;
  onRouseCheck?: (options?: { label?: string; count?: number }) => void;
  onSpendPowerBlood?: (cost: number, powerName: string) => void;
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
  touchstones?: readonly TouchstoneEntry[];
  meritsFlaws?: readonly MeritFlawEntry[];
  havens?: readonly HavenEntry[];
  searchQuery?: string;
  onAddTouchstone?: (entry: TouchstoneEntry) => void;
  onUpdateTouchstone?: (id: string, patch: Partial<Omit<TouchstoneEntry, 'id'>>) => void;
  onRemoveTouchstone?: (id: string) => void;
  onAddMeritFlaw?: (entry: MeritFlawEntry) => void;
  onUpdateMeritFlaw?: (id: string, patch: Partial<Omit<MeritFlawEntry, 'id'>>) => void;
  onRemoveMeritFlaw?: (id: string) => void;
  onAddHaven?: (entry: HavenEntry) => void;
  onUpdateHaven?: (id: string, patch: Partial<Omit<HavenEntry, 'id'>>) => void;
  onRemoveHaven?: (id: string) => void;
}

type GuidedFieldTemplateId =
  | 'skill_d10'
  | 'attribute'
  | 'discipline'
  | 'advantage'
  | 'resource'
  | 'calculated'
  | 'text'
  | 'boolean'
  | 'repeatable';

const DEFAULT_CARDS_T = getTranslations('pt-BR').cards;

const TEMPLATE_ORDER: GuidedFieldTemplateId[] = [
  'skill_d10',
  'attribute',
  'discipline',
  'advantage',
  'resource',
  'calculated',
  'text',
  'boolean',
  'repeatable',
];

function inferDefaultTemplateForCard(card: SheetCard): GuidedFieldTemplateId {
  if (card.id === 'card_arcano' || card.id === 'card_grimorio') return 'discipline';
  if (isAdvantageCardCandidate(card)) return 'advantage';
  const sig = `${card.code} ${card.title}`.toUpperCase();
  if (/ATTRIBUTE|ATRIBUTO/.test(sig)) return 'attribute';
  if (/DISCIPLIN|PODER|POWER|ARCANO|GRIMOR|MERIT/.test(sig)) return 'discipline';
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
  clan = '',
  woundPenalty = 0,
  bloodPool,
  virtues,
  bloodSurge = false,
  bloodSurgeBonus = 2,
  bloodPotency,
  lastSoakTotal = null,
  canWillpowerSurge = false,
  v5WillpowerState,
  evaluation,
  t = DEFAULT_CARDS_T,
  onChangeValue,
  onAdjustResource,
  onAdjustHealthDamage,
  onCycleV20HealthCell,
  onAdjustV20HealthDamage,
  onAdjustV5HealthDamage,
  onAdjustV5WillpowerDamage,
  onAdjustHumanityStains,
  onTriggerRemorseCheck,
  onTriggerFrenzyRoll,
  onApplyV5SuperficialHalving,
  onMendSuperficialWithRouse,
  onAdjustBloodPool,
  onSetBloodPool,
  onUpdateVirtue,
  onRouseCheck,
  onSpendPowerBlood,
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
  touchstones = [],
  meritsFlaws = [],
  havens = [],
  searchQuery = '',
  onAddTouchstone,
  onUpdateTouchstone,
  onRemoveTouchstone,
  onAddMeritFlaw,
  onUpdateMeritFlaw,
  onRemoveMeritFlaw,
  onAddHaven,
  onUpdateHaven,
  onRemoveHaven,
}) => {
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [catalogQuery, setCatalogQuery] = useState('');
  const [discCatalogTab, setDiscCatalogTab] = useState<'disciplines' | 'powers'>(() =>
    card.fields.some((f) => f.kind === 'repeatable' && f.col2Type !== 'number')
      ? 'powers'
      : 'disciplines',
  );
  const [customDiscName, setCustomDiscName] = useState('');
  const [customPowerName, setCustomPowerName] = useState('');
  const [customPowerCost, setCustomPowerCost] = useState('free');
  const [advGroupFilter, setAdvGroupFilter] = useState<'all' | WodAdvantageGroup>('all');
  const [customAdvName, setCustomAdvName] = useState('');
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [frenzyOpen, setFrenzyOpen] = useState(false);
  const [frenzyKind, setFrenzyKind] = useState<FrenzyKind>('frenzy');
  const [frenzyV5Diff, setFrenzyV5Diff] = useState<number>(2);
  const [frenzyV20Virtue, setFrenzyV20Virtue] = useState<'autocontrole' | 'instinto' | 'coragem'>(
    'autocontrole',
  );
  const [frenzyV20Diff, setFrenzyV20Diff] = useState<number>(6);
  const [selectedTemplate, setSelectedTemplate] = useState<GuidedFieldTemplateId>(() =>
    inferDefaultTemplateForCard(card),
  );
  const labelInputRef = useRef<HTMLInputElement | null>(null);
  const catalogSearchRef = useRef<HTMLInputElement | null>(null);
  const advSearchId = useId();
  const frenzyPanelId = useId();

  useEffect(() => {
    if (mode !== 'edicao') {
      setEditingFieldId(null);
      setComposerOpen(false);
      setCatalogQuery('');
      setCustomDiscName('');
      setCustomPowerName('');
      setAdvGroupFilter('all');
      setCustomAdvName('');
    }
    if (mode !== 'jogo') {
      setFrenzyOpen(false);
    }
  }, [mode]);

  const lang: AppLanguage = t.language ?? 'pt-BR';
  const getTemplateMeta = (tplId: GuidedFieldTemplateId) => ({
    label: t.t(`cards.guided.${tplId}.label`),
    hint: t.t(`cards.guided.${tplId}.hint`),
    fallbackName: t.t(`cards.guided.${tplId}.fallbackName`),
  });
  const guided = {
    addFirstField: t.t('cards.guided.addFirstField'),
    addFieldCta: t.t('cards.guided.addFieldCta'),
    selectTemplate: t.t('cards.guided.selectTemplate'),
    createFieldBtn: t.t('cards.guided.createFieldBtn'),
    cancelBtn: t.t('cards.guided.cancelBtn'),
    templates: {
      skill_d10: getTemplateMeta('skill_d10'),
      attribute: getTemplateMeta('attribute'),
      discipline: getTemplateMeta('discipline'),
      advantage: getTemplateMeta('advantage'),
      resource: getTemplateMeta('resource'),
      calculated: getTemplateMeta('calculated'),
      text: getTemplateMeta('text'),
      boolean: getTemplateMeta('boolean'),
      repeatable: getTemplateMeta('repeatable'),
    },
  };
  const selectedMeta = guided.templates[selectedTemplate];

  const officialEdition = isOfficialVampireSheet(systemId, rulePreset) ? rulePreset : null;
  const isWodDossierCard = card.id === 'card_wod_dossier' && Boolean(officialEdition);
  const showOfficialSkillCatalog = Boolean(officialEdition) && selectedTemplate === 'skill_d10';
  const showOfficialDisciplineCatalog =
    Boolean(officialEdition) && selectedTemplate === 'discipline';
  const showOfficialAdvantageCatalog =
    Boolean(officialEdition) && selectedTemplate === 'advantage';

  const existingSheetKeys = useMemo(
    () => [
      ...Object.keys(evaluation.variables),
      ...card.fields.flatMap((f) => [f.key, f.label]),
    ],
    [evaluation.variables, card.fields],
  );

  const catalogGroups = useMemo(
    () => (officialEdition ? getGroupedWodSkillsCatalog(officialEdition, catalogQuery) : []),
    [officialEdition, catalogQuery],
  );

  const matchedClanEntry = useMemo(
    () => (officialEdition && clan ? findClanByIdOrName(clan, officialEdition) : null),
    [officialEdition, clan],
  );

  const powersTargetField = useMemo(
    () => card.fields.find((f) => f.kind === 'repeatable' && f.col2Type !== 'number') ?? null,
    [card.fields],
  );

  const existingPowerRows = useMemo(
    () => card.fields.filter((f) => f.kind === 'repeatable').flatMap((f) => f.rows ?? []),
    [card.fields],
  );

  const disciplineCatalogList = useMemo(() => {
    if (!officialEdition) return [];
    const list = getDisciplinesForEdition(officialEdition);
    const normQ = normalizeCatalogText(catalogQuery);
    const filtered = normQ
      ? list.filter((disc) =>
          [
            disc.id,
            disc.varName,
            disc.name['pt-BR'],
            disc.name.en,
            disc.name.es,
            ...(disc.aliases ?? []),
          ]
            .map(normalizeCatalogText)
            .some((item) => item.includes(normQ)),
        )
      : list;
    return [...filtered].sort((a, b) => {
      const aClan = matchedClanEntry ? matchedClanEntry.clanDisciplines.includes(a.id) : false;
      const bClan = matchedClanEntry ? matchedClanEntry.clanDisciplines.includes(b.id) : false;
      if (aClan !== bClan) return aClan ? -1 : 1;
      return a.name[lang].localeCompare(b.name[lang]);
    });
  }, [officialEdition, catalogQuery, matchedClanEntry, lang]);

  const powerCatalogGroups = useMemo(() => {
    if (!officialEdition) return [];
    const list = getDisciplinesForEdition(officialEdition);
    const normQ = normalizeCatalogText(catalogQuery);
    const groups = list
      .map((disc) => {
        const discMatches =
          !normQ ||
          [
            disc.id,
            disc.varName,
            disc.name['pt-BR'],
            disc.name.en,
            disc.name.es,
            ...(disc.aliases ?? []),
          ]
            .map(normalizeCatalogText)
            .some((item) => item.includes(normQ));
        const powers = discMatches
          ? disc.powers
          : disc.powers.filter((power) =>
              [power.name['pt-BR'], power.name.en, power.name.es]
                .map(normalizeCatalogText)
                .some((item) => item.includes(normQ)),
            );
        return { discipline: disc, powers };
      })
      .filter((group) => group.powers.length > 0);
    return groups.sort((a, b) => {
      const aClan = matchedClanEntry
        ? matchedClanEntry.clanDisciplines.includes(a.discipline.id)
        : false;
      const bClan = matchedClanEntry
        ? matchedClanEntry.clanDisciplines.includes(b.discipline.id)
        : false;
      if (aClan !== bClan) return aClan ? -1 : 1;
      return a.discipline.name[lang].localeCompare(b.discipline.name[lang]);
    });
  }, [officialEdition, catalogQuery, matchedClanEntry, lang]);

  const advantageCatalogList = useMemo(() => {
    if (!officialEdition) return [];
    const groupParam =
      officialEdition === 'vampire-v5' && advGroupFilter !== 'all' ? advGroupFilter : undefined;
    const list = getAdvantagesForEdition(officialEdition, groupParam);
    const normQ = normalizeCatalogText(catalogQuery);
    if (!normQ) return list;
    return list.filter((adv) =>
      [
        adv.id,
        adv.varName,
        adv.name['pt-BR'],
        adv.name.en,
        adv.name.es,
        adv.summary['pt-BR'],
        adv.summary.en,
        adv.summary.es,
        ...(adv.aliases ?? []),
      ]
        .map(normalizeCatalogText)
        .some((item) => item.includes(normQ)),
    );
  }, [officialEdition, advGroupFilter, catalogQuery]);

  const evaluationVarKeys = useMemo(
    () => Object.keys(evaluation.variables),
    [evaluation.variables],
  );

  const spanClass = isFullWidthBentoCard(card) ? 'lg:col-span-2 bento-span-2' : 'lg:col-span-1';
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

  // Pair numeric skill/stat fields with their matching roll button in Play mode
  const pairedRollByNumberId = new Map<string, SheetField>();
  const consumedRollIds = new Set<string>();
  if (mode === 'jogo') {
    const rollFields = fieldsToRender.filter((f) => f.kind === 'roll');
    for (const numField of fieldsToRender) {
      if (numField.kind !== 'number') continue;
      const numKey = numField.key.trim().toLowerCase();
      if (!numKey) continue;
      const match = rollFields.find(
        (rf) =>
          !consumedRollIds.has(rf.id) &&
          (rf.key.trim().toLowerCase() === `roll_${numKey}` || rf.id === `f_roll_${numKey}`),
      );
      if (match) {
        pairedRollByNumberId.set(numField.id, match);
        consumedRollIds.add(match.id);
      }
    }
  }

  const wodAttributeGroups = useMemo(() => {
    if (mode !== 'jogo' || !officialEdition) return null;
    const physical = fieldsToRender.filter(
      (f) => f.kind === 'number' && f.attributeGroup === 'physical',
    );
    const social = fieldsToRender.filter(
      (f) => f.kind === 'number' && f.attributeGroup === 'social',
    );
    const mental = fieldsToRender.filter(
      (f) => f.kind === 'number' && f.attributeGroup === 'mental',
    );
    if (physical.length === 0 || social.length === 0 || mental.length === 0) {
      return null;
    }
    const groupedIds = new Set([...physical, ...social, ...mental].map((f) => f.id));
    const trailingFields = fieldsToRender.filter((f) => !groupedIds.has(f.id));
    return {
      groups: [
        { id: 'physical' as const, label: t.t('cards.attributes.physical'), fields: physical },
        { id: 'social' as const, label: t.t('cards.attributes.social'), fields: social },
        { id: 'mental' as const, label: t.t('cards.attributes.mental'), fields: mental },
      ],
      trailingFields,
    };
  }, [mode, officialEdition, fieldsToRender, t]);

  const canUseTwoColBody =
    card.colSpan === 2 &&
    fieldsToRender.length >= 2 &&
    fieldsToRender.every((f) => f.kind !== 'repeatable' && f.key !== 'notas_campanha');
  const useTwoColBody = mode === 'jogo' && canUseTwoColBody && !wodAttributeGroups;

  const openGuidedComposer = () => {
    const defaultTpl = inferDefaultTemplateForCard(card);
    setSelectedTemplate(defaultTpl);
    setCatalogQuery('');
    const hasPowerTable = card.fields.some((f) => f.kind === 'repeatable' && f.col2Type !== 'number');
    setDiscCatalogTab(hasPowerTable ? 'powers' : 'disciplines');
    setCustomDiscName('');
    setCustomPowerName('');
    setAdvGroupFilter('all');
    setCustomAdvName('');
    setCustomPowerCost(
      officialEdition === 'vampire-v5'
        ? 'rouse_1'
        : officialEdition === 'storyteller-v20'
          ? 'blood_1'
          : 'free',
    );
    setComposerOpen(true);
    window.setTimeout(() => {
      if (
        officialEdition &&
        (defaultTpl === 'skill_d10' || defaultTpl === 'discipline' || defaultTpl === 'advantage')
      ) {
        catalogSearchRef.current?.focus();
      } else {
        labelInputRef.current?.focus();
      }
    }, 0);
  };

  const handleAddOfficialCatalogSkill = (skill: WodCatalogSkill) => {
    if (!officialEdition) return;
    if (isCatalogSkillPresent(skill, existingSheetKeys)) return;
    const newFields = buildCatalogSkillFields(
      skill,
      officialEdition,
      lang,
      evaluation.variables,
    );
    onUpdateCard(card.id, {
      fields: [...card.fields, ...newFields],
    });
  };

  const handleAddOfficialDiscipline = (disc: WodDisciplineCatalogEntry) => {
    if (!officialEdition) return;
    if (isCatalogDisciplinePresent(disc, existingSheetKeys)) return;
    const baseField = buildCatalogDisciplineField(disc, lang);
    const idExists = card.fields.some((f) => f.id === baseField.id);
    const resolvedField = idExists
      ? { ...baseField, id: `${baseField.id}_${Date.now().toString(36).slice(-4)}` }
      : baseField;
    onUpdateCard(card.id, {
      fields: [...card.fields, resolvedField],
    });
  };

  const appendPowerRowToCard = (newRow: ReturnType<typeof buildCatalogPowerRow>) => {
    if (powersTargetField) {
      onUpdateCard(card.id, {
        fields: card.fields.map((f) =>
          f.id === powersTargetField.id ? { ...f, rows: [...(f.rows ?? []), newRow] } : f,
        ),
      });
      return;
    }
    const newTableField: SheetField = {
      id: `f_powers_${card.id}_${Date.now().toString(36).slice(-4)}`,
      key: `powers_${card.fields.length + 1}`,
      label: t.t('cards.disciplines.powersTableLabel'),
      kind: 'repeatable',
      columns: [t.t('cards.disciplines.powersColPower'), t.t('cards.disciplines.powersColCost')],
      col2Type: 'text',
      rows: [newRow],
    };
    onUpdateCard(card.id, {
      fields: [...card.fields, newTableField],
    });
  };

  const handleAddOfficialPower = (
    disc: WodDisciplineCatalogEntry,
    power: WodDisciplinePower,
  ) => {
    if (!officialEdition) return;
    if (isCatalogPowerPresent(power, existingPowerRows)) return;
    appendPowerRowToCard(buildCatalogPowerRow(disc, power, lang));
  };

  const handleAddCustomDiscipline = () => {
    const clean = customDiscName.trim();
    const resolved = clean || `${selectedMeta.fallbackName} ${card.fields.length + 1}`;
    onAddField(card.id, 'number', resolved);
    setCustomDiscName('');
  };

  const handleAddCustomPower = () => {
    const clean = customPowerName.trim();
    if (!clean) return;
    let costType: WodPowerCostType = 'free';
    let costAmount = 0;
    if (customPowerCost.startsWith('rouse_')) {
      costType = 'rouse';
      costAmount = Math.max(1, Number(customPowerCost.split('_')[1]) || 1);
    } else if (customPowerCost.startsWith('blood_')) {
      costType = 'blood_point';
      costAmount = Math.max(1, Number(customPowerCost.split('_')[1]) || 1);
    }
    appendPowerRowToCard({
      id: `pwr_custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      col1: clean,
      col2: formatPowerCostLabel(costType, costAmount, lang),
    });
    setCustomPowerName('');
  };

  const handleAddOfficialAdvantage = (adv: WodAdvantageCatalogEntry) => {
    if (!officialEdition) return;
    if (isCatalogAdvantagePresentInCardFields(adv, card.fields, evaluationVarKeys)) return;
    const baseField = buildCatalogAdvantageField(adv, lang, 1);
    const idExists = card.fields.some((f) => f.id === baseField.id);
    const resolvedField = idExists
      ? { ...baseField, id: `${baseField.id}_${Date.now().toString(36).slice(-4)}` }
      : baseField;
    onUpdateCard(card.id, {
      fields: [...card.fields, resolvedField],
    });
  };

  const handleAddCustomAdvantage = () => {
    const clean = customAdvName.trim();
    const resolved = clean || `${selectedMeta.fallbackName} ${card.fields.length + 1}`;
    const slug =
      normalizeCatalogText(resolved)
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '') || 'custom_adv';
    const keyBase = slug === 'generation' ? 'generation_bg' : slug;
    const existingKeys = new Set(card.fields.map((f) => f.key));
    let uniqueKey = keyBase;
    let suffix = 2;
    while (existingKeys.has(uniqueKey)) {
      uniqueKey = `${keyBase}_${suffix++}`;
    }
    const uid = `${Date.now().toString(36).slice(-4)}_${Math.random().toString(36).slice(2, 5)}`;
    const newField: SheetField = {
      id: `f_adv_${uniqueKey}_${uid}`,
      key: uniqueKey,
      label: resolved.toUpperCase(),
      kind: 'number',
      value: 1,
      max: 5,
      xpCategory: 'advantage',
    };
    onUpdateCard(card.id, {
      fields: [...card.fields, newField],
    });
    setCustomAdvName('');
  };

  const handleCreateGuidedField = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (showOfficialSkillCatalog) return;
    if (showOfficialDisciplineCatalog) {
      if (discCatalogTab === 'disciplines' && customDiscName.trim()) {
        handleAddCustomDiscipline();
      } else if (discCatalogTab === 'powers' && customPowerName.trim()) {
        handleAddCustomPower();
      }
      return;
    }
    if (showOfficialAdvantageCatalog) {
      if (customAdvName.trim()) {
        handleAddCustomAdvantage();
      }
      return;
    }
    const trimmed = newFieldLabel.trim();
    const resolvedLabel =
      trimmed || `${selectedMeta.fallbackName} ${card.fields.length + 1}`;

    if (selectedTemplate === 'skill_d10') {
      onAddField(card.id, 'number', resolvedLabel);
      onAddField(card.id, 'roll', resolvedLabel);
    } else if (
      selectedTemplate === 'attribute' ||
      selectedTemplate === 'discipline' ||
      selectedTemplate === 'advantage'
    ) {
      onAddField(card.id, 'number', resolvedLabel);
    } else {
      onAddField(card.id, selectedTemplate, resolvedLabel);
    }

    setNewFieldLabel('');
    setComposerOpen(false);
  };

  const renderFieldEntry = (field: SheetField, compactDots = false) => {
    if (consumedRollIds.has(field.id)) {
      return null;
    }
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
    const showV5BloodPotencyPanel =
      mode === 'jogo' &&
      rulePreset === 'vampire-v5' &&
      (field.id === 'f_blood_potency' || field.key.trim().toLowerCase() === 'blood_potency');
    const bpComputed = evaluation.computedByFieldId[field.id];
    const bpRawLevel = bpComputed?.ok
      ? bpComputed.value
      : typeof field.value === 'number'
        ? field.value
        : evaluation.variables.blood_potency ?? 1;
    const bpStats = showV5BloodPotencyPanel ? getV5BloodPotencyStats(bpRawLevel) : null;

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
                    className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 min-w-0"
                  >
                    <span className="font-mono-tech text-[11px] font-bold uppercase text-[var(--ink-primary)] truncate">
                      {vLabel}
                    </span>
                    <div className="flex flex-wrap items-center justify-end gap-1.5 shrink-0 max-w-full">
                      <DotRating
                        label={vLabel}
                        value={val}
                        min={1}
                        max={5}
                        onChange={(next) => onUpdateVirtue?.(vKey, next)}
                        t={t}
                        showQuickEdit={false}
                        testId={`v20-virtue-${vKey}-dots`}
                      />
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          data-testid={`v20-virtue-${vKey}-dec`}
                          aria-label={`${vLabel} -`}
                          disabled={val <= 1}
                          onClick={() => onUpdateVirtue?.(vKey, val - 1)}
                          className="no-print print:hidden cyber-btn-outline mobile-touch-stepper w-6 h-6 flex items-center justify-center text-xs font-bold cursor-pointer"
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
                          className="no-print print:hidden cyber-btn-outline mobile-touch-stepper w-6 h-6 flex items-center justify-center text-xs font-bold cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <FieldPrimitive
          field={field}
          card={card}
          pairedRollField={pairedRollByNumberId.get(field.id)}
          mode={mode}
          systemId={systemId}
          rulePreset={rulePreset}
          compactDots={compactDots}
          woundPenalty={woundPenalty}
          bloodPool={bloodPool}
          bloodSurge={bloodSurge}
          bloodPotency={bloodPotency}
          lastSoakTotal={lastSoakTotal}
          canWillpowerSurge={canWillpowerSurge}
          v5WillpowerState={v5WillpowerState}
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
          onAdjustV5WillpowerDamage={onAdjustV5WillpowerDamage}
          onAdjustHumanityStains={onAdjustHumanityStains}
          onTriggerRemorseCheck={onTriggerRemorseCheck}
          onApplyV5SuperficialHalving={onApplyV5SuperficialHalving}
          onMendSuperficialWithRouse={onMendSuperficialWithRouse}
          onRouseCheck={onRouseCheck}
          onSpendPowerBlood={
            onSpendPowerBlood ?? ((cost) => onAdjustBloodPool?.(-cost))
          }
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
                  className="no-print print:hidden cyber-btn-outline min-h-[36px] sm:min-h-[26px] px-2 py-0.5 text-[10px] font-extrabold uppercase cursor-pointer"
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
                  className="no-print print:hidden cyber-btn-outline mobile-touch-stepper w-6 h-6 flex items-center justify-center text-xs font-bold cursor-pointer"
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

        {showV5BloodPotencyPanel && bpStats && (
          <div
            data-testid="v5-blood-potency-panel"
            className={`v5-bp-stats-panel p-2.5 flex flex-col gap-2 ${
              useTwoColBody ? 'md:col-span-2' : ''
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono-tech text-[10px] font-extrabold tracking-wider uppercase text-[var(--accent-wine)]">
                {t.t('cards.vital.bpPanelTitle', { level: bpStats.level })}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              <div className="v5-bp-stat-cell px-2 py-1 flex flex-col gap-0.5">
                <span className="font-mono-tech text-[9px] font-bold uppercase text-[var(--ink-muted)]">
                  {t.t('cards.vital.bpSurge')}
                </span>
                <span className="font-mono-tech text-xs font-extrabold tabular-nums text-[var(--ink-primary)]">
                  +{bpStats.bloodSurgeDice}d10
                </span>
              </div>
              <div className="v5-bp-stat-cell px-2 py-1 flex flex-col gap-0.5">
                <span className="font-mono-tech text-[9px] font-bold uppercase text-[var(--ink-muted)]">
                  {t.t('cards.vital.bpMend')}
                </span>
                <span className="font-mono-tech text-xs font-extrabold tabular-nums text-[var(--ink-primary)]">
                  {bpStats.mendSuperficialPerRouse} SUP
                </span>
              </div>
              <div className="v5-bp-stat-cell px-2 py-1 flex flex-col gap-0.5">
                <span className="font-mono-tech text-[9px] font-bold uppercase text-[var(--ink-muted)]">
                  {t.t('cards.vital.bpPowerBonus')}
                </span>
                <span className="font-mono-tech text-xs font-extrabold tabular-nums text-[var(--ink-primary)]">
                  +{bpStats.powerBonusDice}d10
                </span>
              </div>
              <div className="v5-bp-stat-cell px-2 py-1 flex flex-col gap-0.5">
                <span className="font-mono-tech text-[9px] font-bold uppercase text-[var(--ink-muted)]">
                  {t.t('cards.vital.bpRouseReroll')}
                </span>
                <span className="font-mono-tech text-xs font-extrabold tabular-nums text-[var(--ink-primary)]">
                  {bpStats.rouseRerollMaxLevel > 0
                    ? t.t('cards.vital.bpRouseRerollValue', { level: bpStats.rouseRerollMaxLevel })
                    : t.t('cards.vital.bpRouseRerollNone')}
                </span>
              </div>
              <div className="v5-bp-stat-cell px-2 py-1 flex flex-col gap-0.5">
                <span className="font-mono-tech text-[9px] font-bold uppercase text-[var(--ink-muted)]">
                  {t.t('cards.vital.bpBaneSeverity')}
                </span>
                <span className="font-mono-tech text-xs font-extrabold tabular-nums text-[var(--ink-primary)]">
                  {bpStats.baneSeverity}
                </span>
              </div>
              <div className="v5-bp-stat-cell px-2 py-1 flex flex-col gap-0.5">
                <span className="font-mono-tech text-[9px] font-bold uppercase text-[var(--ink-muted)]">
                  {t.t('cards.vital.bpFeedingLabel')}
                </span>
                <span className="font-mono-tech text-[10px] font-bold leading-snug text-[var(--ink-secondary)]">
                  {t.t(`cards.vital.bpFeeding.${bpStats.feedingPenaltyKey}`)}
                </span>
              </div>
            </div>
          </div>
        )}
      </React.Fragment>
    );
  };

  return (
    <section className={`bento-card ${spanClass}`} data-card-id={card.id} aria-label={card.title}>
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
        className={`bento-card-body flex-1 ${
          useTwoColBody
            ? `grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2.5 ${
                consumedRollIds.size > 0 ? 'items-start' : 'items-center'
              }`
            : 'flex flex-col'
        } ${canUseTwoColBody ? 'bento-card-two-col' : ''}`}
      >
        {isWodDossierCard && officialEdition && (
          <WodStructuredBlocks
            edition={officialEdition}
            cardTitle={card.title}
            cardCode={card.code}
            searchQuery={searchQuery}
            touchstones={touchstones}
            meritsFlaws={meritsFlaws}
            havens={havens}
            t={t}
            onAddTouchstone={onAddTouchstone}
            onUpdateTouchstone={onUpdateTouchstone}
            onRemoveTouchstone={onRemoveTouchstone}
            onAddMeritFlaw={onAddMeritFlaw}
            onUpdateMeritFlaw={onUpdateMeritFlaw}
            onRemoveMeritFlaw={onRemoveMeritFlaw}
            onAddHaven={onAddHaven}
            onUpdateHaven={onUpdateHaven}
            onRemoveHaven={onRemoveHaven}
          />
        )}

        {fieldsToRender.length === 0 && !isWodDossierCard && (
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

        {wodAttributeGroups ? (
          <>
            <div data-testid={`wod-attr-grid-${card.id}`} className="wod-attr-grid-container">
              <div className="wod-attr-grid">
                {wodAttributeGroups.groups.map((group) => (
                  <div
                    key={group.id}
                    data-testid={`wod-attr-group-${group.id}`}
                    className="wod-attr-group-col"
                  >
                    <span className="wod-attr-group-heading">{group.label}</span>
                    {group.fields.map((field) => renderFieldEntry(field, true))}
                  </div>
                ))}
              </div>
            </div>
            {wodAttributeGroups.trailingFields.length > 0 && (
              <div className="wod-attr-trailing pt-2 border-t border-dashed border-[var(--border-ink)]/35 flex flex-col gap-2">
                {wodAttributeGroups.trailingFields.map((field) => renderFieldEntry(field, false))}
              </div>
            )}
          </>
        ) : (
          fieldsToRender.map((field) => renderFieldEntry(field, false))
        )}

        {isWodCombatCard && mode === 'jogo' && officialEdition && (
          <div data-testid="wod-frenzy-section" className="no-print print:hidden flex flex-col gap-2 pt-1">
            <button
              type="button"
              data-testid="wod-frenzy-toggle-btn"
              aria-expanded={frenzyOpen}
              aria-controls={frenzyPanelId}
              onClick={() => setFrenzyOpen((prev) => !prev)}
              className="cyber-btn-outline min-h-[36px] w-full px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider flex items-center justify-between gap-2 cursor-pointer"
            >
              <span className="inline-flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-[var(--accent-wine)] shrink-0" aria-hidden="true" />
                <span>{t.t('cards.vital.frenzyBtn')}</span>
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 shrink-0 ${frenzyOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>

            {frenzyOpen && (
              <div
                id={frenzyPanelId}
                data-testid="wod-frenzy-panel"
                className="wod-frenzy-panel p-2.5 flex flex-col gap-2.5"
              >
                {rulePreset === 'vampire-v5' ? (
                  (() => {
                    const wpFree =
                      v5WillpowerState?.available ??
                      Math.max(0, Math.round(evaluation.variables.willpower ?? 0));
                    const humVal = Math.max(
                      0,
                      Math.min(10, Math.round(evaluation.variables.humanity ?? 7)),
                    );
                    const humBonus = Math.floor(humVal / 3);
                    const v5Pool = Math.max(1, wpFree + humBonus);
                    return (
                      <>
                        <div className="grid grid-cols-2 gap-1.5">
                          {(
                            [
                              ['frenzy', t.t('cards.vital.frenzyKindFrenzy')],
                              ['rotschreck', t.t('cards.vital.frenzyKindRotschreck')],
                            ] as const
                          ).map(([kindId, kindLabel]) => (
                            <button
                              key={kindId}
                              type="button"
                              data-testid={`wod-frenzy-kind-${kindId}`}
                              aria-pressed={frenzyKind === kindId}
                              onClick={() => setFrenzyKind(kindId)}
                              className={`wod-frenzy-chip min-h-[36px] px-2 py-1 text-[10px] font-extrabold uppercase cursor-pointer ${
                                frenzyKind === kindId ? 'is-active' : ''
                              }`}
                            >
                              {kindLabel}
                            </button>
                          ))}
                        </div>

                        <div className="flex flex-wrap gap-1.5">
                          {(
                            [
                              [2, t.t('cards.vital.frenzyV5Diff2')],
                              [3, t.t('cards.vital.frenzyV5Diff3')],
                              [4, t.t('cards.vital.frenzyV5Diff4')],
                            ] as const
                          ).map(([diffVal, diffLabel]) => (
                            <button
                              key={diffVal}
                              type="button"
                              data-testid={`wod-frenzy-v5-diff-${diffVal}`}
                              aria-pressed={frenzyV5Diff === diffVal}
                              onClick={() => setFrenzyV5Diff(diffVal)}
                              className={`wod-frenzy-chip min-h-[36px] flex-1 min-w-[110px] px-2 py-1 text-[10px] font-bold uppercase cursor-pointer ${
                                frenzyV5Diff === diffVal ? 'is-active' : ''
                              }`}
                            >
                              {diffLabel}
                            </button>
                          ))}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-secondary)]">
                            {t.t('cards.vital.frenzyDiffLabel')}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              data-testid="wod-frenzy-diff-dec"
                              aria-label={t.t('cards.vital.frenzyDiffDecAria')}
                              disabled={frenzyV5Diff <= 1}
                              onClick={() => setFrenzyV5Diff((d) => Math.max(1, d - 1))}
                              className="cyber-btn-outline min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
                            >
                              <Minus className="w-3 h-3" aria-hidden="true" />
                            </button>
                            <span
                              data-testid="wod-frenzy-diff-value"
                              className="font-mono-tech text-xs font-extrabold min-w-[28px] text-center tabular-nums"
                            >
                              {frenzyV5Diff}
                            </span>
                            <button
                              type="button"
                              data-testid="wod-frenzy-diff-inc"
                              aria-label={t.t('cards.vital.frenzyDiffIncAria')}
                              disabled={frenzyV5Diff >= 10}
                              onClick={() => setFrenzyV5Diff((d) => Math.min(10, d + 1))}
                              className="cyber-btn-outline min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
                            >
                              <Plus className="w-3 h-3" aria-hidden="true" />
                            </button>
                          </div>
                        </div>

                        <p className="font-mono-tech text-[10px] font-semibold text-[var(--ink-secondary)]">
                          {t.t('cards.vital.frenzyFormulaV5', { wp: wpFree, humBonus })}
                        </p>

                        <button
                          type="button"
                          data-testid="wod-frenzy-roll-btn"
                          onClick={() =>
                            onTriggerFrenzyRoll?.({
                              difficulty: frenzyV5Diff,
                              kind: frenzyKind,
                            })
                          }
                          className="cyber-roll-btn min-h-[36px] w-full px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider cursor-pointer"
                        >
                          {t.t('cards.vital.frenzyRollBtn', { pool: v5Pool })}
                        </button>
                      </>
                    );
                  })()
                ) : (
                  (() => {
                    const instVar =
                      typeof evaluation.variables.instinct === 'number'
                        ? evaluation.variables.instinct
                        : typeof evaluation.variables.instinto === 'number'
                          ? evaluation.variables.instinto
                          : null;
                    const selfControlVal =
                      typeof evaluation.variables.self_control === 'number'
                        ? evaluation.variables.self_control
                        : virtues?.selfControl ?? 3;
                    const courageVal =
                      typeof evaluation.variables.courage === 'number'
                        ? evaluation.variables.courage
                        : virtues?.courage ?? 4;
                    const rawVirtuePool =
                      frenzyV20Virtue === 'coragem'
                        ? courageVal
                        : frenzyV20Virtue === 'instinto'
                          ? instVar ?? selfControlVal
                          : selfControlVal;
                    const v20Pool = Math.max(1, Math.min(10, Math.round(rawVirtuePool)));
                    const virtueOptions = [
                      {
                        id: 'autocontrole' as const,
                        label: t.t('cards.vital.frenzyVirtueSelfControl'),
                        kind: 'frenzy' as const,
                      },
                      {
                        id: 'instinto' as const,
                        label: t.t('cards.vital.frenzyVirtueInstinct'),
                        kind: 'frenzy' as const,
                      },
                      {
                        id: 'coragem' as const,
                        label: t.t('cards.vital.frenzyVirtueCourage'),
                        kind: 'rotschreck' as const,
                      },
                    ];
                    const selectedVirtueLabel =
                      virtueOptions.find((opt) => opt.id === frenzyV20Virtue)?.label ?? '';

                    return (
                      <>
                        <div className="flex flex-col gap-1">
                          <span className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-secondary)]">
                            {t.t('cards.vital.frenzyVirtueLabel')}
                          </span>
                          <div className="grid grid-cols-3 gap-1">
                            {virtueOptions.map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                data-testid={`wod-frenzy-virtue-${opt.id}`}
                                aria-pressed={frenzyV20Virtue === opt.id}
                                onClick={() => {
                                  setFrenzyV20Virtue(opt.id);
                                  setFrenzyKind(opt.kind);
                                }}
                                className={`wod-frenzy-chip min-h-[36px] px-1.5 py-1 text-[9px] font-extrabold uppercase cursor-pointer truncate ${
                                  frenzyV20Virtue === opt.id ? 'is-active' : ''
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-secondary)]">
                            {t.t('cards.vital.frenzyDiffLabel')} (TN)
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              data-testid="wod-frenzy-diff-dec"
                              aria-label={t.t('cards.vital.frenzyDiffDecAria')}
                              disabled={frenzyV20Diff <= 2}
                              onClick={() => setFrenzyV20Diff((d) => Math.max(2, d - 1))}
                              className="cyber-btn-outline min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
                            >
                              <Minus className="w-3 h-3" aria-hidden="true" />
                            </button>
                            <span
                              data-testid="wod-frenzy-diff-value"
                              className="font-mono-tech text-xs font-extrabold min-w-[28px] text-center tabular-nums"
                            >
                              {frenzyV20Diff}
                            </span>
                            <button
                              type="button"
                              data-testid="wod-frenzy-diff-inc"
                              aria-label={t.t('cards.vital.frenzyDiffIncAria')}
                              disabled={frenzyV20Diff >= 10}
                              onClick={() => setFrenzyV20Diff((d) => Math.min(10, d + 1))}
                              className="cyber-btn-outline min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
                            >
                              <Plus className="w-3 h-3" aria-hidden="true" />
                            </button>
                          </div>
                        </div>

                        <p className="font-mono-tech text-[10px] font-semibold text-[var(--ink-secondary)]">
                          {t.t('cards.vital.frenzyFormulaV20', {
                            virtue: selectedVirtueLabel,
                            pool: v20Pool,
                            diff: frenzyV20Diff,
                          })}
                        </p>

                        <button
                          type="button"
                          data-testid="wod-frenzy-roll-btn"
                          onClick={() =>
                            onTriggerFrenzyRoll?.({
                              virtue: frenzyV20Virtue,
                              difficulty: frenzyV20Diff,
                              kind: frenzyV20Virtue === 'coragem' ? 'rotschreck' : 'frenzy',
                            })
                          }
                          className="cyber-roll-btn min-h-[36px] w-full px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider cursor-pointer"
                        >
                          {t.t('cards.vital.frenzyRollBtn', { pool: v20Pool })}
                        </button>
                      </>
                    );
                  })()
                )}
              </div>
            )}
          </div>
        )}

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
                  {showOfficialSkillCatalog && officialEdition
                    ? t.t('cards.catalog.clickHint')
                    : showOfficialAdvantageCatalog && officialEdition
                      ? t.t('cards.advantages.clickHint')
                      : selectedMeta.hint}
                </p>

                {showOfficialSkillCatalog && officialEdition ? (
                  <div
                    data-testid={`official-skills-catalog-${card.id}`}
                    className="flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono-tech text-[10px] font-extrabold uppercase text-[var(--accent-wine)]">
                        {officialEdition === 'vampire-v5'
                          ? t.t('cards.catalog.headingV5')
                          : t.t('cards.catalog.headingV20')}
                      </span>
                    </div>

                    <div className="relative">
                      <Search
                        className="w-3.5 h-3.5 text-[var(--ink-muted)] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                        aria-hidden="true"
                      />
                      <input
                        ref={catalogSearchRef}
                        type="search"
                        data-testid={`official-catalog-search-${card.id}`}
                        aria-label={t.t('cards.catalog.searchAria')}
                        value={catalogQuery}
                        onChange={(e) => setCatalogQuery(e.target.value)}
                        placeholder={t.t('cards.catalog.searchPlaceholder')}
                        className="cyber-input mobile-touch-input min-h-[36px] pl-8 pr-2.5 py-1 text-[11px] w-full"
                      />
                    </div>

                    <div className="max-h-64 overflow-y-auto pr-0.5 flex flex-col gap-2.5">
                      {catalogGroups.length === 0 ? (
                        <p className="font-mono-tech text-[11px] text-[var(--ink-muted)] text-center py-2">
                          {t.t('cards.catalog.emptySearch', { query: catalogQuery })}
                        </p>
                      ) : (
                        catalogGroups.map((group) => (
                          <div
                            key={group.category}
                            data-testid={`catalog-group-${group.category}`}
                            className="flex flex-col gap-1"
                          >
                            <span className="font-mono-tech text-[9px] font-extrabold tracking-wider uppercase text-[var(--ink-muted)]">
                              {group.labels[lang]}
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                              {group.skills.map((skill) => {
                                const alreadyOnSheet = isCatalogSkillPresent(
                                  skill,
                                  existingSheetKeys,
                                );
                                return (
                                  <button
                                    key={skill.id}
                                    type="button"
                                    disabled={alreadyOnSheet}
                                    data-testid={`catalog-skill-${skill.varName}`}
                                    onClick={() => handleAddOfficialCatalogSkill(skill)}
                                    className={`font-mono-tech min-h-[36px] px-2.5 py-1 text-[10px] font-bold uppercase rounded-[var(--radius-control)] border flex items-center justify-between gap-1.5 text-left transition-colors ${
                                      alreadyOnSheet
                                        ? 'bg-[var(--bg-strip)] text-[var(--ink-muted)] border-[var(--border-ink)]/30 opacity-65 cursor-not-allowed'
                                        : 'bg-[var(--bg-card)] text-[var(--ink-primary)] border-[var(--border-ink)]/65 hover:bg-[var(--accent-primary)] hover:text-[var(--accent-contrast)] hover:border-[var(--border-color)] cursor-pointer'
                                    }`}
                                  >
                                    <span className="truncate">{skill.labels[lang]}</span>
                                    {alreadyOnSheet ? (
                                      <span
                                        data-testid={`catalog-skill-badge-${skill.varName}`}
                                        className="text-[8px] font-extrabold px-1.5 py-0.5 bg-[var(--bg-card)] text-[var(--ink-muted)] border border-[var(--border-ink)]/40 rounded-[var(--radius-pill)] shrink-0"
                                      >
                                        {t.t('cards.catalog.alreadyOnSheet')}
                                      </span>
                                    ) : (
                                      <Plus className="w-3 h-3 shrink-0" aria-hidden="true" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : showOfficialDisciplineCatalog && officialEdition ? (
                  <div
                    data-testid={`official-disciplines-catalog-${card.id}`}
                    className="flex flex-col gap-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono-tech text-[10px] font-extrabold uppercase text-[var(--accent-wine)]">
                        {officialEdition === 'vampire-v5'
                          ? t.t('cards.disciplines.headingV5')
                          : t.t('cards.disciplines.headingV20')}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          data-testid={`disc-catalog-tab-disciplines-${card.id}`}
                          aria-pressed={discCatalogTab === 'disciplines'}
                          onClick={() => setDiscCatalogTab('disciplines')}
                          className={`font-mono-tech min-h-[36px] sm:min-h-[28px] px-2.5 py-1 text-[10px] font-bold uppercase rounded-[var(--radius-pill)] border transition-colors cursor-pointer ${
                            discCatalogTab === 'disciplines'
                              ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-color)]'
                              : 'bg-[var(--bg-card)] text-[var(--ink-primary)] border-[var(--border-ink)]/60 hover:bg-[var(--bg-hover)]'
                          }`}
                        >
                          {t.t('cards.disciplines.tabDisciplines')}
                        </button>
                        <button
                          type="button"
                          data-testid={`disc-catalog-tab-powers-${card.id}`}
                          aria-pressed={discCatalogTab === 'powers'}
                          onClick={() => setDiscCatalogTab('powers')}
                          className={`font-mono-tech min-h-[36px] sm:min-h-[28px] px-2.5 py-1 text-[10px] font-bold uppercase rounded-[var(--radius-pill)] border transition-colors cursor-pointer ${
                            discCatalogTab === 'powers'
                              ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-color)]'
                              : 'bg-[var(--bg-card)] text-[var(--ink-primary)] border-[var(--border-ink)]/60 hover:bg-[var(--bg-hover)]'
                          }`}
                        >
                          {t.t('cards.disciplines.tabPowers')}
                        </button>
                      </div>
                    </div>

                    <div className="relative">
                      <Search
                        className="w-3.5 h-3.5 text-[var(--ink-muted)] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                        aria-hidden="true"
                      />
                      <input
                        ref={catalogSearchRef}
                        type="search"
                        autoCorrect="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        data-testid={`official-disc-search-${card.id}`}
                        aria-label={t.t('cards.disciplines.searchAria')}
                        value={catalogQuery}
                        onChange={(e) => setCatalogQuery(e.target.value)}
                        placeholder={t.t('cards.disciplines.searchPlaceholder')}
                        className="cyber-input mobile-touch-input min-h-[36px] pl-8 pr-2.5 py-1 text-[11px] w-full"
                      />
                    </div>

                    {discCatalogTab === 'disciplines' ? (
                      <div className="max-h-60 overflow-y-auto pr-0.5 grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {disciplineCatalogList.length === 0 ? (
                          <p className="sm:col-span-2 font-mono-tech text-[11px] text-[var(--ink-muted)] text-center py-2">
                            {t.t('cards.disciplines.emptySearch', { query: catalogQuery })}
                          </p>
                        ) : (
                          disciplineCatalogList.map((disc) => {
                            const alreadyOnSheet = isCatalogDisciplinePresent(
                              disc,
                              existingSheetKeys,
                            );
                            const affinity = matchedClanEntry
                              ? resolveDisciplineAffinity(clan, disc.id, officialEdition)
                              : null;
                            return (
                              <button
                                key={disc.id}
                                type="button"
                                disabled={alreadyOnSheet}
                                data-testid={`catalog-disc-${disc.varName}`}
                                onClick={() => handleAddOfficialDiscipline(disc)}
                                className={`font-mono-tech min-h-[36px] px-2.5 py-1 text-[10px] font-bold uppercase rounded-[var(--radius-control)] border flex items-center justify-between gap-1.5 text-left transition-colors ${
                                  alreadyOnSheet
                                    ? 'bg-[var(--bg-strip)] text-[var(--ink-muted)] border-[var(--border-ink)]/30 opacity-65 cursor-not-allowed'
                                    : 'bg-[var(--bg-card)] text-[var(--ink-primary)] border-[var(--border-ink)]/65 hover:bg-[var(--accent-primary)] hover:text-[var(--accent-contrast)] hover:border-[var(--border-color)] cursor-pointer'
                                }`}
                              >
                                <span className="truncate">{disc.name[lang]}</span>
                                <span className="flex items-center gap-1 shrink-0">
                                  {affinity === 'discipline_clan' && (
                                    <span className="text-[8px] font-extrabold px-1.5 py-0.5 bg-[var(--accent-cream-badge)] text-[var(--accent-wine)] border border-[var(--accent-wine)] rounded-[var(--radius-pill)]">
                                      {t.t('cards.disciplines.inClanBadge')}
                                    </span>
                                  )}
                                  {affinity === 'discipline_caitiff' && (
                                    <span className="text-[8px] font-extrabold px-1.5 py-0.5 bg-[var(--bg-strip)] text-[var(--ink-primary)] border border-[var(--border-ink)]/50 rounded-[var(--radius-pill)]">
                                      {t.t('cards.disciplines.caitiffBadge')}
                                    </span>
                                  )}
                                  {alreadyOnSheet ? (
                                    <span className="text-[8px] font-extrabold px-1.5 py-0.5 bg-[var(--bg-card)] text-[var(--ink-muted)] border border-[var(--border-ink)]/40 rounded-[var(--radius-pill)]">
                                      {t.t('cards.catalog.alreadyOnSheet')}
                                    </span>
                                  ) : (
                                    <Plus className="w-3 h-3 shrink-0" aria-hidden="true" />
                                  )}
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    ) : (
                      <div className="max-h-60 overflow-y-auto pr-0.5 flex flex-col gap-2">
                        {powerCatalogGroups.length === 0 ? (
                          <p className="font-mono-tech text-[11px] text-[var(--ink-muted)] text-center py-2">
                            {t.t('cards.disciplines.emptySearch', { query: catalogQuery })}
                          </p>
                        ) : (
                          powerCatalogGroups.map(({ discipline, powers }) => (
                            <div key={discipline.id} className="flex flex-col gap-1">
                              <span className="font-mono-tech text-[9px] font-extrabold tracking-wider uppercase text-[var(--ink-muted)]">
                                {discipline.name[lang]}
                              </span>
                              <div className="grid grid-cols-1 gap-1">
                                {powers.map((power) => {
                                  const alreadyOnSheet = isCatalogPowerPresent(
                                    power,
                                    existingPowerRows,
                                  );
                                  const costLabel = formatPowerCostLabel(
                                    power.costType,
                                    power.costAmount,
                                    lang,
                                  );
                                  return (
                                    <button
                                      key={power.id}
                                      type="button"
                                      disabled={alreadyOnSheet}
                                      data-testid={`catalog-power-${power.id}`}
                                      onClick={() => handleAddOfficialPower(discipline, power)}
                                      className={`font-mono-tech min-h-[36px] px-2.5 py-1 text-[10px] font-bold uppercase rounded-[var(--radius-control)] border flex items-center justify-between gap-2 text-left transition-colors ${
                                        alreadyOnSheet
                                          ? 'bg-[var(--bg-strip)] text-[var(--ink-muted)] border-[var(--border-ink)]/30 opacity-65 cursor-not-allowed'
                                          : 'bg-[var(--bg-card)] text-[var(--ink-primary)] border-[var(--border-ink)]/65 hover:bg-[var(--accent-primary)] hover:text-[var(--accent-contrast)] hover:border-[var(--border-color)] cursor-pointer'
                                      }`}
                                    >
                                      <span className="truncate min-w-0">
                                        {t.t('cards.disciplines.levelShort', {
                                          level: power.level,
                                        })}{' '}
                                        · {power.name[lang]}
                                      </span>
                                      <span className="flex items-center gap-1.5 shrink-0">
                                        <span className="text-[8px] font-extrabold px-1.5 py-0.5 bg-[var(--accent-cream-badge)] text-[var(--accent-wine)] border border-[var(--accent-wine)] rounded-[var(--radius-pill)]">
                                          {costLabel}
                                        </span>
                                        {alreadyOnSheet ? (
                                          <span className="text-[8px] font-extrabold px-1.5 py-0.5 bg-[var(--bg-card)] text-[var(--ink-muted)] border border-[var(--border-ink)]/40 rounded-[var(--radius-pill)]">
                                            {t.t('cards.catalog.alreadyOnSheet')}
                                          </span>
                                        ) : (
                                          <Plus className="w-3 h-3 shrink-0" aria-hidden="true" />
                                        )}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}

                    {/* Custom Discipline or Power quick add */}
                    <div className="pt-2 border-t border-dashed border-[var(--border-ink)]/40 flex flex-col gap-1.5">
                      <span className="font-mono-tech text-[9px] font-extrabold uppercase text-[var(--ink-muted)]">
                        {t.t('cards.disciplines.customHeading')}
                      </span>
                      {discCatalogTab === 'disciplines' ? (
                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5">
                          <input
                            type="text"
                            data-testid={`custom-disc-input-${card.id}`}
                            aria-label={t.t('cards.disciplines.customDiscPlaceholder')}
                            value={customDiscName}
                            onChange={(e) => setCustomDiscName(e.target.value)}
                            placeholder={t.t('cards.disciplines.customDiscPlaceholder')}
                            className="cyber-input mobile-touch-input min-h-[36px] px-2.5 py-1 text-[11px] flex-1 min-w-[140px]"
                          />
                          <button
                            type="button"
                            data-testid={`custom-disc-add-${card.id}`}
                            onClick={handleAddCustomDiscipline}
                            className="cyber-roll-btn min-h-[36px] px-3 py-1 text-[10px] font-bold uppercase whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            {t.t('cards.disciplines.customAddBtn')}
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5">
                          <input
                            type="text"
                            data-testid={`custom-power-input-${card.id}`}
                            aria-label={t.t('cards.disciplines.customPowerPlaceholder')}
                            value={customPowerName}
                            onChange={(e) => setCustomPowerName(e.target.value)}
                            placeholder={t.t('cards.disciplines.customPowerPlaceholder')}
                            className="cyber-input mobile-touch-input min-h-[36px] px-2.5 py-1 text-[11px] flex-1 min-w-[120px]"
                          />
                          <select
                            data-testid={`custom-power-cost-${card.id}`}
                            aria-label={t.t('cards.disciplines.customCostLabel')}
                            value={customPowerCost}
                            onChange={(e) => setCustomPowerCost(e.target.value)}
                            className="cyber-input mobile-touch-input min-h-[36px] px-2 py-1 text-[10px] font-bold uppercase shrink-0"
                          >
                            <option value="free">
                              {t.t('cards.disciplines.customCostFree')}
                            </option>
                            {officialEdition === 'vampire-v5' ? (
                              <>
                                <option value="rouse_1">
                                  {t.t('cards.disciplines.customCostRouse', { count: 1 })}
                                </option>
                                <option value="rouse_2">
                                  {t.t('cards.disciplines.customCostRouse', { count: 2 })}
                                </option>
                              </>
                            ) : (
                              <>
                                <option value="blood_1">
                                  {t.t('cards.disciplines.customCostBlood', { count: 1 })}
                                </option>
                                <option value="blood_2">
                                  {t.t('cards.disciplines.customCostBlood', { count: 2 })}
                                </option>
                                <option value="blood_3">
                                  {t.t('cards.disciplines.customCostBlood', { count: 3 })}
                                </option>
                              </>
                            )}
                          </select>
                          <button
                            type="button"
                            data-testid={`custom-power-add-${card.id}`}
                            disabled={!customPowerName.trim()}
                            onClick={handleAddCustomPower}
                            className="cyber-roll-btn min-h-[36px] px-3 py-1 text-[10px] font-bold uppercase whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            {t.t('cards.disciplines.customAddBtn')}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : showOfficialAdvantageCatalog && officialEdition ? (
                  <div
                    data-testid={`official-advantages-catalog-${card.id}`}
                    className="flex flex-col gap-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono-tech text-[10px] font-extrabold uppercase text-[var(--accent-wine)]">
                        {officialEdition === 'vampire-v5'
                          ? t.t('cards.advantages.headingV5')
                          : t.t('cards.advantages.headingV20')}
                      </span>
                      {officialEdition === 'vampire-v5' && (
                        <div className="flex flex-wrap items-center gap-1">
                          {(
                            [
                              ['all', t.t('cards.advantages.tabAll')],
                              ['background', t.t('cards.advantages.tabBackgrounds')],
                              ['merit', t.t('cards.advantages.tabMerits')],
                            ] as const
                          ).map(([groupId, groupLabel]) => {
                            const active = advGroupFilter === groupId;
                            return (
                              <button
                                key={groupId}
                                type="button"
                                data-testid={`adv-catalog-group-${groupId}-${card.id}`}
                                aria-pressed={active}
                                onClick={() => setAdvGroupFilter(groupId)}
                                className={`font-mono-tech min-h-[36px] sm:min-h-[28px] px-2.5 py-1 text-[10px] font-bold uppercase rounded-[var(--radius-pill)] border transition-colors cursor-pointer ${
                                  active
                                    ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-color)]'
                                    : 'bg-[var(--bg-card)] text-[var(--ink-primary)] border-[var(--border-ink)]/60 hover:bg-[var(--bg-hover)]'
                                }`}
                              >
                                {groupLabel}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="relative">
                      <label htmlFor={advSearchId} className="sr-only">
                        {t.t('cards.advantages.searchAria')}
                      </label>
                      <Search
                        className="w-3.5 h-3.5 text-[var(--ink-muted)] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                        aria-hidden="true"
                      />
                      <input
                        id={advSearchId}
                        ref={catalogSearchRef}
                        type="search"
                        autoCorrect="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        data-testid={`official-adv-search-${card.id}`}
                        value={catalogQuery}
                        onChange={(e) => setCatalogQuery(e.target.value)}
                        placeholder={t.t('cards.advantages.searchPlaceholder')}
                        className="cyber-input mobile-touch-input min-h-[36px] pl-8 pr-2.5 py-1 text-[16px] sm:text-[11px] w-full"
                      />
                    </div>

                    <div className="max-h-60 overflow-y-auto pr-0.5 grid grid-cols-1 gap-1.5">
                      {advantageCatalogList.length === 0 ? (
                        <p className="font-mono-tech text-[11px] text-[var(--ink-muted)] text-center py-2">
                          {t.t('cards.advantages.emptySearch', { query: catalogQuery })}
                        </p>
                      ) : (
                        advantageCatalogList.map((adv) => {
                          const alreadyOnSheet = isCatalogAdvantagePresentInCardFields(
                            adv,
                            card.fields,
                            evaluationVarKeys,
                          );
                          return (
                            <button
                              key={adv.id}
                              type="button"
                              aria-disabled={alreadyOnSheet}
                              data-testid={`catalog-adv-${adv.varName}`}
                              onClick={() => handleAddOfficialAdvantage(adv)}
                              className={`font-mono-tech min-h-[36px] px-2.5 py-1.5 text-[10px] font-bold rounded-[var(--radius-control)] border flex items-center justify-between gap-2 text-left transition-colors ${
                                alreadyOnSheet
                                  ? 'xp-catalog-present-btn'
                                  : 'group bg-[var(--bg-card)] text-[var(--ink-primary)] border-[var(--border-ink)]/65 hover:bg-[var(--accent-primary)] hover:text-[var(--accent-contrast)] hover:border-[var(--border-color)] cursor-pointer'
                              }`}
                            >
                              <div className="flex flex-col gap-0.5 min-w-0">
                                <span className="uppercase truncate">{adv.name[lang]}</span>
                                <span
                                  className={`text-[9px] font-normal normal-case line-clamp-1 ${
                                    alreadyOnSheet
                                      ? 'text-[var(--ink-primary)]'
                                      : 'text-[var(--ink-secondary)] group-hover:text-[var(--accent-contrast)]'
                                  }`}
                                >
                                  {adv.summary[lang]}
                                </span>
                              </div>
                              <span className="flex items-center gap-1 shrink-0">
                                {officialEdition === 'vampire-v5' && (
                                  <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.5 bg-[var(--accent-cream-badge)] text-[var(--accent-wine)] border border-[var(--accent-wine)] rounded-[var(--radius-pill)]">
                                    {adv.group === 'merit'
                                      ? t.t('cards.advantages.groupMerit')
                                      : t.t('cards.advantages.groupBackground')}
                                  </span>
                                )}
                                {alreadyOnSheet ? (
                                  <span className="text-[8px] font-extrabold uppercase px-1.5 py-0.5 bg-[var(--bg-card)] text-[var(--ink-primary)] border border-[var(--border-color)] rounded-[var(--radius-pill)]">
                                    {t.t('cards.catalog.alreadyOnSheet')}
                                  </span>
                                ) : (
                                  <Plus className="w-3 h-3 shrink-0" aria-hidden="true" />
                                )}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>

                    <div className="pt-2 border-t border-dashed border-[var(--border-ink)]/40 flex flex-col gap-1.5">
                      <span className="font-mono-tech text-[9px] font-extrabold uppercase text-[var(--ink-muted)]">
                        {t.t('cards.advantages.customHeading')}
                      </span>
                      <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5">
                        <input
                          type="text"
                          data-testid={`custom-adv-input-${card.id}`}
                          aria-label={t.t('cards.advantages.customPlaceholder')}
                          value={customAdvName}
                          onChange={(e) => setCustomAdvName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                              e.preventDefault();
                              handleAddCustomAdvantage();
                            }
                          }}
                          placeholder={t.t('cards.advantages.customPlaceholder')}
                          className="cyber-input mobile-touch-input min-h-[36px] px-2.5 py-1 text-[16px] sm:text-[11px] flex-1 min-w-[140px]"
                        />
                        <button
                          type="button"
                          data-testid={`custom-adv-add-${card.id}`}
                          onClick={handleAddCustomAdvantage}
                          className="cyber-roll-btn min-h-[36px] px-3 py-1 text-[10px] font-bold uppercase whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          {t.t('cards.advantages.customAddBtn')}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
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
                )}
              </form>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
