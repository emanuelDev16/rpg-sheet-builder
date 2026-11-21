import React, { useId, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowUpRight, ChevronDown, Lock, Plus, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';
import { CharacterSheetState, XpRulePreset, XpUpgradeCategory } from '../core/sheetModel';
import { AppLanguage, AppTranslations, getTranslations } from '../core/i18n';
import { AnimatedCounter } from './AnimatedCounter';
import {
  AcquirableCatalogKind,
  AcquirableCatalogTrait,
  BACKGROUND_PRESETS,
  DEFAULT_BACKGROUND_XP_COST,
  extractAcquirableTraits,
  extractAllTraits,
  getAvailableXp,
  getCostRulesSummary,
  getEffectiveCustomUseNewLevelBase,
  getEffectiveXpRulePreset,
  getSheetClanName,
  getXpPricingConfig,
  isWodSystem,
  normalizeXpState,
  resetXpPricingConfig,
  setCategoryMultiplierOverride,
  setCustomUseNewLevelBaseConfig,
  setTraitCustomCostOverride,
  setTraitDisciplineAffinity,
  setXpRulePresetConfig,
  SPECIALTY_XP_COST,
  UpgradableTrait,
} from '../core/xpSystem';
import {
  type DisciplineAffinity,
  findClanByIdOrName,
} from '../core/wodClansDisciplinesCatalog';
import {
  findAdvantageByIdOrName,
  getAdvantagesForEdition,
  isCatalogAdvantagePresent,
} from '../core/wodAdvantagesCatalog';
import { normalizeCatalogText } from '../core/wodSkillsCatalog';

interface XpUpgradeWorkspaceProps {
  sheet: CharacterSheetState;
  language?: AppLanguage;
  t?: AppTranslations['xp'];
  onAwardXp: (delta: number, reason: string) => { ok: boolean; error?: string };
  onUpgradeTrait: (fieldId: string) => void;
  onBuySpecialty?: (skillFieldId: string, focus: string) => { ok: boolean; error?: string };
  onBuyBackground?: (label: string, customCost?: number) => { ok: boolean; error?: string };
  onBuyCatalogSkill?: (skillIdOrVar: string) => { ok: boolean; error?: string };
  onBuyCatalogDiscipline?: (discIdOrName: string) => { ok: boolean; error?: string };
  onBuyCatalogAdvantage?: (
    advIdOrName: string,
    customCost?: number,
  ) => { ok: boolean; error?: string };
  onUndoLastUpgrade: () => void;
  onSelectRulePreset?: (preset: XpRulePreset) => void;
}

type CategoryFilter = 'all' | XpUpgradeCategory;

const DEFAULT_XP_T = getTranslations('pt-BR').xp;

export const XpUpgradeWorkspace: React.FC<XpUpgradeWorkspaceProps> = ({
  sheet,
  language = 'pt-BR',
  t = DEFAULT_XP_T,
  onAwardXp,
  onUpgradeTrait,
  onBuySpecialty,
  onBuyBackground,
  onBuyCatalogSkill,
  onBuyCatalogDiscipline,
  onBuyCatalogAdvantage,
  onUndoLastUpgrade,
  onSelectRulePreset,
}) => {
  const [amountInput, setAmountInput] = useState('3');
  const [reasonInput, setReasonInput] = useState('');
  const [xpError, setXpError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [onlyAffordable, setOnlyAffordable] = useState(false);
  const [rulesEditorOpen, setRulesEditorOpen] = useState(false);
  const [editingCostFieldId, setEditingCostFieldId] = useState<string | null>(null);
  const [customCostDraft, setCustomCostDraft] = useState('');
  const [pricingVersion, setPricingVersion] = useState(0);
  const prefersReducedMotion = useReducedMotion();
  const isEinkTheme =
    typeof document !== 'undefined' && document.documentElement?.dataset?.theme === 'eink';
  const shouldReduceMotion = Boolean(prefersReducedMotion || isEinkTheme);
  const [specOpen, setSpecOpen] = useState(false);
  const [specSkillId, setSpecSkillId] = useState('');
  const [specFocus, setSpecFocus] = useState('');
  const [bgOpen, setBgOpen] = useState(false);
  const [bgName, setBgName] = useState('');
  const [bgCost, setBgCost] = useState(String(DEFAULT_BACKGROUND_XP_COST));
  const [acquireOpen, setAcquireOpen] = useState(false);
  const [acquireKind, setAcquireKind] = useState<AcquirableCatalogKind>('skill');
  const [acquireQuery, setAcquireQuery] = useState('');
  const acquireSearchId = useId();

  const ext = {
    virtuesTab: t.t('xp.virtuesTab'),
    virtueCat: t.t('xp.virtueCat'),
    willpowerCat: t.t('xp.willpowerCat'),
    humanityCat: t.t('xp.humanityCat'),
    showAllTraits: t.t('xp.showAllTraits'),
    onlyAffordable: t.t('xp.onlyAffordable'),
    rulesEditorBtn: t.t('xp.rulesEditorBtn'),
    rulesEditorTitle: t.t('xp.rulesEditorTitle'),
    resetRulesBtn: t.t('xp.resetRulesBtn'),
    customCostBtn: t.t('xp.customCostBtn'),
    customCostAria: t.t('xp.customCostAria'),
    clearCustomCost: t.t('xp.clearCustomCost'),
    applyCustomCost: t.t('xp.applyCustomCost'),
    insufficientBadge: (missing: number) => t.t('xp.insufficientBadge', { missing }),
    insufficientClickError: (label: string, cost: number, available: number) =>
      t.t('xp.insufficientClickError', { label, cost, available }),
    maxBadge: t.t('xp.maxBadge'),
    catalogCount: (possible: number, total: number) =>
      t.t('xp.catalogCount', { possible, total }),
    multiplierLabel: t.t('xp.multiplierLabel'),
  };

  const xpState = useMemo(() => normalizeXpState(sheet.xp), [sheet.xp]);
  const availableXp = useMemo(() => getAvailableXp(xpState), [xpState]);
  const pricingConfig = useMemo(
    () => getXpPricingConfig(sheet),
    [sheet, pricingVersion],
  );

  const activePreset = useMemo(
    () => getEffectiveXpRulePreset(sheet, pricingConfig),
    [sheet, pricingConfig],
  );
  const customUseNewLevelBase = useMemo(
    () => getEffectiveCustomUseNewLevelBase(sheet, pricingConfig),
    [sheet, pricingConfig],
  );

  const allTraits = useMemo(
    () => extractAllTraits(sheet, language, pricingConfig),
    [sheet, language, pricingConfig],
  );
  const allPossible = useMemo(
    () => allTraits.filter((trait) => trait.isPossible),
    [allTraits],
  );

  const visibleTraits = useMemo(() => {
    return allTraits.filter((trait) => {
      if (categoryFilter !== 'all' && trait.category !== categoryFilter) return false;
      if (onlyAffordable && !trait.isPossible) return false;
      return true;
    });
  }, [allTraits, categoryFilter, onlyAffordable]);

  const countsByCategory = useMemo(() => {
    const counts: Record<CategoryFilter, number> = {
      all: allTraits.length,
      attribute: 0,
      skill: 0,
      discipline: 0,
      virtue: 0,
    };
    for (const item of allTraits) {
      counts[item.category] += 1;
    }
    return counts;
  }, [allTraits]);

  const costRulesSummary = useMemo(
    () => getCostRulesSummary(sheet, language, pricingConfig),
    [sheet, language, pricingConfig],
  );
  const isWod = useMemo(() => isWodSystem(sheet), [sheet]);
  const officialEdition =
    isWod && (activePreset === 'storyteller-v20' || activePreset === 'vampire-v5')
      ? activePreset
      : null;

  const allAcquirable = useMemo(
    () => extractAcquirableTraits(sheet, language, pricingConfig),
    [sheet, language, pricingConfig],
  );
  const effectiveAcquireKind: AcquirableCatalogKind =
    categoryFilter === 'skill'
      ? 'skill'
      : categoryFilter === 'discipline'
        ? 'discipline'
        : categoryFilter === 'virtue'
          ? 'advantage'
          : acquireKind;

  const acquirableByKind = useMemo(
    () => allAcquirable.filter((item) => item.kind === effectiveAcquireKind),
    [allAcquirable, effectiveAcquireKind],
  );
  const filteredAcquirable = useMemo(() => {
    const normQ = normalizeCatalogText(acquireQuery);
    return acquirableByKind.filter((item) => {
      if (onlyAffordable && !item.isAffordable) return false;
      if (!normQ) return true;
      const haystack = [item.label, item.varName, item.subGroup ?? '', item.summary ?? '']
        .map(normalizeCatalogText)
        .join(' ');
      return haystack.includes(normQ);
    });
  }, [acquirableByKind, acquireQuery, onlyAffordable]);

  const acquirableCountsByKind = useMemo(() => {
    const counts: Record<AcquirableCatalogKind, number> = {
      skill: 0,
      discipline: 0,
      advantage: 0,
    };
    for (const item of allAcquirable) {
      counts[item.kind] += 1;
    }
    return counts;
  }, [allAcquirable]);

  const customAdvantageQuickChips = useMemo(() => {
    if (officialEdition) {
      return getAdvantagesForEdition(officialEdition).map((adv) => ({
        key: adv.id,
        label: adv.name[language] ?? adv.name.en,
      }));
    }
    return BACKGROUND_PRESETS;
  }, [officialEdition, language]);

  const hasUndoableUpgrade = useMemo(
    () => xpState.ledger.some((entry) => entry.kind === 'upgrade'),
    [xpState.ledger],
  );

  const hasCustomPricing = useMemo(() => {
    const multCount = Object.keys(pricingConfig.categoryMultipliers ?? {}).length;
    const costCount = Object.keys(pricingConfig.fieldCustomCosts ?? {}).length;
    const clanCount = Object.keys(pricingConfig.outOfClanFieldIds ?? {}).length;
    const affinityCount = Object.keys(pricingConfig.disciplineAffinityOverrides ?? {}).length;
    return multCount > 0 || costCount > 0 || clanCount > 0 || affinityCount > 0 || activePreset === 'custom';
  }, [pricingConfig, activePreset]);

  const formulaBadgeText = useMemo(() => {
    if (activePreset === 'vampire-v5') return t.t('xp.formulaBadgeV5');
    if (activePreset === 'custom') {
      return customUseNewLevelBase
        ? t.t('xp.formulaBadgeCustomNext')
        : t.t('xp.formulaBadgeCustomCurrent');
    }
    if (!isWod) return t.t('xp.formulaBadgeD20');
    return t.t('xp.formulaBadgeV20');
  }, [activePreset, customUseNewLevelBase, isWod, t]);

  // 12-block segmented utilization meter for spent vs earned XP
  const totalBlocks = 12;
  const spentRatio =
    xpState.totalEarned > 0 ? Math.min(1, xpState.spent / xpState.totalEarned) : 0;
  const filledBlocks = Math.round(spentRatio * totalBlocks);
  const spentPercent = Math.round(spentRatio * 100);

  const handleSelectPreset = (preset: XpRulePreset) => {
    setXpRulePresetConfig(sheet, preset);
    setXpError(null);
    if (preset === 'custom') {
      setRulesEditorOpen(true);
    }
    setPricingVersion((v) => v + 1);
    onSelectRulePreset?.(preset);
  };

  const handleToggleCustomBase = () => {
    setCustomUseNewLevelBaseConfig(sheet, !customUseNewLevelBase);
    setXpError(null);
    setPricingVersion((v) => v + 1);
  };

  const handleQuickAdjust = (delta: number, label: string) => {
    const res = onAwardXp(delta, label);
    if (!res.ok) {
      setXpError(res.error ?? t.t('xp.errAdjustXp'));
    } else {
      setXpError(null);
    }
  };

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Number(amountInput);
    if (!Number.isFinite(parsed) || Math.round(parsed) === 0) {
      setXpError(t.t('xp.errZeroXp'));
      return;
    }
    const res = onAwardXp(Math.round(parsed), reasonInput);
    if (!res.ok) {
      setXpError(res.error ?? t.t('xp.errAdjustXp'));
      return;
    }
    setXpError(null);
    setReasonInput('');
  };

  const handleAttemptUpgrade = (trait: UpgradableTrait) => {
    if (trait.isBlockedByRule || trait.cost === null) {
      setXpError(t.t('xp.errBlockedV5', { label: trait.label }));
      return;
    }
    if (trait.isMaxed) return;
    if (!trait.isAffordable) {
      setXpError(ext.insufficientClickError(trait.label, trait.cost, availableXp));
      return;
    }
    setXpError(null);
    onUpgradeTrait(trait.fieldId);
  };

  const handleToggleDisciplineClan = (trait: UpgradableTrait) => {
    const edition = activePreset === 'vampire-v5' ? 'vampire-v5' : 'storyteller-v20';
    const matchedClan = findClanByIdOrName(getSheetClanName(sheet), edition);
    const currentAffinity: DisciplineAffinity =
      trait.disciplineAffinity ?? (trait.isOutOfClan ? 'discipline_out_of_clan' : 'discipline_clan');
    let nextAffinity: DisciplineAffinity;
    if (currentAffinity === 'discipline_clan') {
      nextAffinity = 'discipline_out_of_clan';
    } else if (currentAffinity === 'discipline_out_of_clan') {
      nextAffinity = matchedClan?.isCaitiff ? 'discipline_caitiff' : 'discipline_clan';
    } else {
      nextAffinity = 'discipline_clan';
    }
    setTraitDisciplineAffinity(sheet, trait.fieldId, nextAffinity);
    setPricingVersion((v) => v + 1);
  };

  const handleCategoryMultiplierChange = (cat: XpUpgradeCategory, raw: string) => {
    if (raw.trim() === '') {
      setCategoryMultiplierOverride(sheet, cat, null);
    } else {
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed >= 1) {
        setCategoryMultiplierOverride(sheet, cat, Math.round(parsed));
      }
    }
    setPricingVersion((v) => v + 1);
  };

  const handleApplyTraitCustomCost = (fieldId: string) => {
    const trimmed = customCostDraft.trim();
    if (trimmed === '') {
      setTraitCustomCostOverride(sheet, fieldId, null);
    } else {
      const parsed = Number(trimmed);
      if (Number.isFinite(parsed) && parsed >= 0) {
        setTraitCustomCostOverride(sheet, fieldId, Math.round(parsed));
      }
    }
    setEditingCostFieldId(null);
    setCustomCostDraft('');
    setPricingVersion((v) => v + 1);
  };

  const handleClearTraitCustomCost = (fieldId: string) => {
    setTraitCustomCostOverride(sheet, fieldId, null);
    setEditingCostFieldId(null);
    setCustomCostDraft('');
    setPricingVersion((v) => v + 1);
  };

  const handleResetAllPricing = () => {
    resetXpPricingConfig(sheet);
    setEditingCostFieldId(null);
    setCustomCostDraft('');
    setPricingVersion((v) => v + 1);
  };

  const getTraitCategoryBadge = (trait: UpgradableTrait): string => {
    if (trait.category === 'virtue') {
      if (trait.virtueSubtype === 'willpower') return ext.willpowerCat;
      if (trait.virtueSubtype === 'humanity') return ext.humanityCat;
      if (trait.virtueSubtype === 'blood_potency') return t.t('xp.bloodPotencyCat');
      if (trait.virtueSubtype === 'advantage') return t.t('xp.advantageCat');
      return ext.virtueCat;
    }
    return t.t(`xp.cat.${trait.category}`);
  };

  const handleAcquireCatalogItem = (item: AcquirableCatalogTrait) => {
    if (!item.isAffordable) {
      setXpError(ext.insufficientClickError(item.label, item.cost, availableXp));
      return;
    }
    let res: { ok: boolean; error?: string } | undefined;
    if (item.kind === 'skill') {
      res = onBuyCatalogSkill?.(item.varName);
    } else if (item.kind === 'discipline') {
      res = onBuyCatalogDiscipline?.(item.catalogId);
    } else {
      res = onBuyCatalogAdvantage?.(item.catalogId);
    }
    if (!res) return;
    if (!res.ok) {
      setXpError(res.error ?? t.t('xp.errAcquireTrait'));
      return;
    }
    setXpError(null);
  };

  const presetOptions: Array<{ id: XpRulePreset; label: string; testId: string }> = [
    { id: 'storyteller-v20', label: t.t('xp.presetV20'), testId: 'xp-preset-v20' },
    { id: 'vampire-v5', label: t.t('xp.presetV5'), testId: 'xp-preset-v5' },
    { id: 'custom', label: t.t('xp.presetCustom'), testId: 'xp-preset-custom' },
  ];

  const virtueTabLabel =
    officialEdition === 'vampire-v5'
      ? t.t('xp.virtuesTabV5')
      : officialEdition === 'storyteller-v20'
        ? t.t('xp.virtuesTabV20')
        : ext.virtuesTab;

  const filterTabs: Array<{ id: CategoryFilter; label: string }> = [
    { id: 'all', label: t.filterAll },
    {
      id: 'attribute',
      label: isWod || activePreset !== 'storyteller-v20' ? t.t('xp.filterAttributes') : t.t('xp.filterAbilities'),
    },
    { id: 'skill', label: t.t('xp.filterSkills') },
    {
      id: 'discipline',
      label: isWod || activePreset !== 'storyteller-v20' ? t.t('xp.filterDisciplines') : t.t('xp.filterPowers'),
    },
    { id: 'virtue', label: virtueTabLabel },
  ];

  const useNewBaseDefaults =
    activePreset === 'vampire-v5' || (activePreset === 'custom' && customUseNewLevelBase);
  const useD20Defaults = !isWod && activePreset === 'storyteller-v20';

  const categoryEditorRows: Array<{ id: XpUpgradeCategory; label: string; defaultMult: number }> = [
    {
      id: 'attribute',
      label: isWod || activePreset !== 'storyteller-v20' ? t.t('xp.filterAttributes') : t.t('xp.filterAbilities'),
      defaultMult: useD20Defaults ? 100 : useNewBaseDefaults ? 5 : 4,
    },
    {
      id: 'skill',
      label: t.t('xp.filterSkills'),
      defaultMult: useD20Defaults ? 50 : useNewBaseDefaults ? 3 : 2,
    },
    {
      id: 'discipline',
      label: isWod || activePreset !== 'storyteller-v20' ? t.t('xp.filterDisciplines') : t.t('xp.filterPowers'),
      defaultMult: useD20Defaults ? 150 : 5,
    },
    {
      id: 'virtue',
      label: ext.virtuesTab,
      defaultMult: useD20Defaults ? 50 : useNewBaseDefaults ? 3 : 2,
    },
  ];

  const showDisciplineClanToggle = isWod || activePreset === 'vampire-v5' || activePreset === 'custom';

  return (
    <div className="flex flex-col gap-4">
      {/* TOP XP RULE PRESET & FORMULA BAR */}
      <div
        data-testid="xp-rule-preset-bar"
        className="bg-[var(--bg-card)] border-[length:var(--border-width)] border-[var(--border-color)] rounded-[var(--radius-card)] shadow-[var(--shadow-card)] print:shadow-none px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5"
      >
        <div
          role="radiogroup"
          aria-label={t.t('xp.presetSelectorAria')}
          data-testid="xp-rule-preset-selector"
          className="no-print print:hidden flex flex-wrap items-center gap-1.5"
        >
          {presetOptions.map((option) => {
            const isSelected = activePreset === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                data-testid={option.testId}
                onClick={() => handleSelectPreset(option.id)}
                className={`font-mono-tech min-h-[36px] px-3 py-1.5 text-[11px] font-bold tracking-wider uppercase rounded-[var(--radius-pill)] border border-[var(--border-color)] whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] shadow-[var(--shadow-btn)]'
                    : 'bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            data-testid="xp-active-formula-badge"
            className="font-mono-tech min-h-[36px] px-3 py-1.5 text-[10px] sm:text-[11px] font-bold tracking-wider uppercase inline-flex items-center rounded-[var(--radius-pill)] border border-[var(--border-color)] bg-[var(--bg-strip)] text-[var(--text-primary)]"
          >
            {formulaBadgeText}
          </span>

          {activePreset === 'custom' && (
            <button
              type="button"
              data-testid="xp-custom-base-toggle"
              aria-pressed={customUseNewLevelBase}
              aria-label={t.t('xp.customBaseToggleAria')}
              onClick={handleToggleCustomBase}
              className={`no-print print:hidden font-mono-tech min-h-[36px] px-3 py-1.5 text-[10px] sm:text-[11px] font-bold tracking-wider uppercase rounded-[var(--radius-pill)] border border-[var(--border-color)] whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                customUseNewLevelBase
                  ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] shadow-[var(--shadow-btn)]'
                  : 'bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              {customUseNewLevelBase
                ? t.t('xp.customBaseNew')
                : t.t('xp.customBaseCurrent')}
            </button>
          )}
        </div>
      </div>

      <div className="bento-print-grid grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        {/* LEFT CARD: XP MONITOR */}
        <section className="bento-card" aria-label={t.monitorTitle}>
          <header className="bento-card-header">
            <div className="bento-card-header-title flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 min-w-0 flex-1">
              <span className="font-mono-tech text-[11px] font-bold text-[var(--accent-wine)] tracking-wider shrink-0">
                {t.monitorTag}
              </span>
              <h2 className="font-display text-lg sm:text-xl print:text-base font-extrabold tracking-wide uppercase text-[var(--ink-primary)] leading-tight break-words">
                {t.monitorTitle}
              </h2>
            </div>
            <div
              className="flex items-center gap-1.5 shrink-0 self-start sm:self-center pt-0.5 sm:pt-0"
              aria-hidden="true"
            >
              <span className="w-2.5 h-2.5 rounded-full border-[1.5px] border-[var(--border-ink)] bg-[var(--bg-card)]" />
              <span className="w-2.5 h-2.5 rounded-full border-[1.5px] border-[var(--border-ink)] bg-[var(--accent-wine)]" />
            </div>
          </header>

          <div className="bento-card-body p-4 flex flex-col gap-4">
            {/* 3-metric telemetry strip separated by hairline borders */}
            <div className="grid grid-cols-3 border-[length:var(--border-width)] border-[var(--border-color)] rounded-[var(--radius-card)] bg-[var(--bg-card-alt)] divide-x divide-[var(--border-color)]">
              <div className="p-3 flex flex-col gap-0.5">
                <span className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-muted)]">
                  {t.availableXp}
                </span>
                <span
                  data-testid="xp-available"
                  className="font-display text-4xl font-extrabold leading-none text-[var(--accent-wine)] tabular-nums"
                >
                  <AnimatedCounter value={availableXp} />
                </span>
              </div>
              <div className="p-3 flex flex-col gap-0.5">
                <span className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-muted)]">
                  {t.totalEarned}
                </span>
                <span
                  data-testid="xp-earned"
                  className="font-display text-3xl font-extrabold leading-none text-[var(--ink-primary)] tabular-nums"
                >
                  <AnimatedCounter value={xpState.totalEarned} />
                </span>
              </div>
              <div className="p-3 flex flex-col gap-0.5">
                <span className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-muted)]">
                  {t.totalSpent}
                </span>
                <span
                  data-testid="xp-spent"
                  className="font-display text-3xl font-extrabold leading-none text-[var(--ink-secondary)] tabular-nums"
                >
                  <AnimatedCounter value={xpState.spent} />
                </span>
              </div>
            </div>

            {/* Segmented XP allocation meter */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between font-mono-tech text-[11px] font-semibold">
                <span className="text-[var(--ink-secondary)] uppercase">{t.allocation}</span>
                <span className="text-[var(--ink-primary)] tabular-nums">
                  <AnimatedCounter value={xpState.spent} pulseOnChange={false} /> /{' '}
                  <AnimatedCounter value={xpState.totalEarned} pulseOnChange={false} /> {t.spentLabel} ·{' '}
                  <AnimatedCounter value={spentPercent} pulseOnChange={false} />%
                </span>
              </div>
              <div
                className="seg-meter-track flex items-center gap-1"
                role="meter"
                aria-label={t.allocation}
                aria-valuemin={0}
                aria-valuemax={Math.max(1, xpState.totalEarned)}
                aria-valuenow={xpState.spent}
              >
                {Array.from({ length: totalBlocks }).map((_, i) => (
                  <motion.span
                    key={i}
                    initial={false}
                    animate={{ scale: i < filledBlocks ? 1 : 0.95 }}
                    transition={
                      shouldReduceMotion
                        ? { duration: 0 }
                        : {
                            duration: 0.2,
                            delay: i < filledBlocks ? i * 0.015 : 0,
                            ease: 'easeOut',
                          }
                    }
                    className={`seg-block ${i < filledBlocks ? 'is-filled' : ''}`}
                  />
                ))}
              </div>
            </div>

            {/* Quick XP grant & custom adjustment */}
            <div className="no-print print:hidden pt-3 border-t border-[var(--border-subtle)] flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-secondary)]">
                  {t.quickAdjust}
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {[1, 3, 5].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() =>
                        handleQuickAdjust(amt, t.t('xp.quickAwardLabel', { amount: amt }))
                      }
                      className="cyber-btn-outline min-h-[36px] px-2.5 py-1 text-[11px] font-bold whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      +{amt} XP
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={availableXp <= 0}
                    onClick={() => handleQuickAdjust(-1, t.t('xp.quickAdjustLabel'))}
                    className="cyber-btn-outline min-h-[36px] px-2.5 py-1 text-[11px] font-bold whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
                  >
                    -1 XP
                  </button>
                </div>
              </div>

              <form
                onSubmit={handleCustomSubmit}
                className="flex flex-wrap sm:flex-nowrap items-center gap-2"
              >
                <input
                  type="number"
                  aria-label={t.availableXp}
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  className="cyber-input mobile-touch-input min-h-[36px] w-20 px-2.5 py-1.5 text-xs font-bold text-center shrink-0"
                />
                <input
                  type="text"
                  aria-label={t.notePlaceholder}
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                  placeholder={t.notePlaceholder}
                  className="cyber-input mobile-touch-input min-h-[36px] flex-1 min-w-0 px-2.5 py-1.5 text-xs"
                />
                <button
                  type="submit"
                  className="cyber-roll-btn mobile-touch-input min-h-[36px] px-3 py-1.5 text-[11px] font-bold uppercase whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {t.addXpBtn}
                </button>
              </form>

              {xpError && (
                <div
                  role="alert"
                  data-testid="xp-error-banner"
                  className="p-2.5 border-[length:var(--border-width)] border-[var(--accent-danger)] rounded-[var(--radius-card)] bg-[var(--accent-danger-soft)] font-mono-tech text-[11px] font-semibold text-[var(--accent-danger)] break-words flex items-center justify-between gap-2"
                >
                  <span>{xpError}</span>
                  <button
                    type="button"
                    aria-label="Dismiss"
                    onClick={() => setXpError(null)}
                    className="shrink-0 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>

            {/* XP Ledger */}
            <div className="pt-3 border-t border-[var(--border-subtle)] flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-secondary)]">
                  {t.ledgerTitle} ({xpState.ledger.length})
                </span>
                {hasUndoableUpgrade && (
                  <button
                    type="button"
                    data-testid="xp-undo-last-btn"
                    onClick={() => {
                      setXpError(null);
                      onUndoLastUpgrade();
                    }}
                    className="no-print print:hidden cyber-btn-outline min-h-[36px] px-2.5 py-1 text-[10px] font-bold uppercase inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" aria-hidden="true" />
                    <span>{t.undoLastUpgrade}</span>
                  </button>
                )}
              </div>

              {xpState.ledger.length === 0 ? (
                <div className="p-3 border-[length:var(--border-width)] border-dashed border-[var(--border-color)] rounded-[var(--radius-card)] font-mono-tech text-[11px] text-[var(--ink-secondary)] text-center">
                  {t.emptyLedger}
                </div>
              ) : (
                <ul className="max-h-[240px] overflow-y-auto print:max-h-none print:overflow-visible border border-[var(--border-subtle)] rounded-[var(--radius-card)] divide-y divide-[var(--border-subtle)] bg-[var(--bg-card)]">
                  {xpState.ledger.map((entry) => (
                    <li
                      key={entry.id}
                      className="px-3 py-2 flex items-center justify-between gap-2 font-mono-tech text-[11px]"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[var(--ink-muted)] shrink-0">{entry.timestamp}</span>
                        <span className="font-semibold text-[var(--ink-primary)] truncate">
                          {entry.label}
                        </span>
                      </div>
                      <span
                        className={`font-bold whitespace-nowrap shrink-0 tabular-nums ${
                          entry.delta > 0
                            ? 'text-[var(--accent-wine)]'
                            : 'text-[var(--ink-primary)]'
                        }`}
                      >
                        {entry.delta > 0 ? `+${entry.delta} XP` : `${entry.delta} XP`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        {/* RIGHT CARD: COMPLETE EVOLUTION CATALOG */}
        <section className="bento-card" aria-label={t.possibleTitle}>
          <header className="bento-card-header">
            <div className="bento-card-header-title flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 min-w-0 flex-1">
              <span className="font-mono-tech text-[11px] font-bold text-[var(--accent-wine)] tracking-wider shrink-0">
                {t.upgradesTag}
              </span>
              <h2 className="font-display text-lg sm:text-xl print:text-base font-extrabold tracking-wide uppercase text-[var(--ink-primary)] leading-tight break-words">
                {t.possibleTitle}
              </h2>
            </div>
            <span className="font-mono-tech text-[10px] font-bold text-[var(--accent-wine)] whitespace-nowrap shrink-0 self-start sm:self-center">
              {ext.catalogCount(allPossible.length, allTraits.length)}
            </span>
          </header>

          <div className="bento-card-body p-4 flex flex-col gap-3">
            {/* Cost rules + multipliers toggle */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-mono-tech text-[10px] font-semibold text-[var(--ink-muted)] flex flex-wrap items-center gap-1.5">
                <span>{t.costRulesLabel}</span>
                {costRulesSummary.map((rule) => (
                  <React.Fragment key={rule}>
                    <span>{rule}</span>
                    <span aria-hidden="true">·</span>
                  </React.Fragment>
                ))}
                <span>{t.budgetLabel(availableXp)}</span>
              </div>

              <button
                type="button"
                data-testid="xp-rules-editor-toggle"
                aria-expanded={rulesEditorOpen}
                onClick={() => setRulesEditorOpen((prev) => !prev)}
                className={`no-print print:hidden font-mono-tech min-h-[36px] px-2.5 py-1 text-[10px] font-bold uppercase rounded-[var(--radius-pill)] border inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                  rulesEditorOpen || hasCustomPricing
                    ? 'bg-[var(--accent-cream-badge)] text-[var(--accent-wine)] border-[var(--accent-wine)]'
                    : 'bg-[var(--bg-card-alt)] text-[var(--ink-primary)] border-[var(--border-ink)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                <SlidersHorizontal className="w-3 h-3" aria-hidden="true" />
                <span>{ext.rulesEditorBtn}</span>
              </button>
            </div>

            {/* Collapsible Category Multipliers Override Panel */}
            {rulesEditorOpen && (
              <div
                data-testid="xp-rules-editor-panel"
                className="no-print print:hidden p-3 bg-[var(--bg-card-alt)] border-[length:var(--border-width)] border-[var(--border-color)] rounded-[var(--radius-card)] flex flex-col gap-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono-tech text-[10px] font-bold uppercase text-[var(--accent-wine)]">
                    {ext.rulesEditorTitle}
                  </span>
                  {hasCustomPricing && (
                    <button
                      type="button"
                      data-testid="xp-rules-reset-btn"
                      onClick={handleResetAllPricing}
                      className="cyber-btn-outline min-h-[36px] px-2.5 py-1 text-[10px] font-bold uppercase cursor-pointer"
                    >
                      {ext.resetRulesBtn}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {categoryEditorRows.map((row) => {
                    const activeVal = pricingConfig.categoryMultipliers?.[row.id];
                    return (
                      <label
                        key={row.id}
                        className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-[var(--bg-card)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-primary)]"
                      >
                        <span className="truncate">{row.label}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[var(--ink-muted)]">{ext.multiplierLabel}</span>
                          <input
                            type="number"
                            min={1}
                            max={500}
                            data-testid={`xp-mult-input-${row.id}`}
                            aria-label={`${row.label} ${ext.rulesEditorBtn}`}
                            placeholder={String(row.defaultMult)}
                            value={activeVal ?? ''}
                            onChange={(e) => handleCategoryMultiplierChange(row.id, e.target.value)}
                            className="cyber-input w-16 min-h-[32px] px-1.5 py-0.5 text-[11px] font-bold text-center tabular-nums"
                          />
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Category filter tabs + affordability filter */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div
                role="tablist"
                aria-label={t.possibleTitle}
                className="flex flex-wrap items-center gap-1.5"
              >
                {filterTabs.map((tab) => {
                  const isSelected = categoryFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      data-testid={`xp-tab-${tab.id}`}
                      aria-selected={isSelected}
                      onClick={() => setCategoryFilter(tab.id)}
                      className={`font-mono-tech min-h-[36px] px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase rounded-[var(--radius-pill)] border border-[var(--border-color)] whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-[var(--accent-black)] text-[var(--accent-contrast)]'
                          : 'bg-[var(--bg-card)] text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                      }`}
                    >
                      {tab.label} ({countsByCategory[tab.id]})
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                data-testid="xp-only-affordable-toggle"
                aria-pressed={onlyAffordable}
                onClick={() => setOnlyAffordable((prev) => !prev)}
                className={`no-print print:hidden font-mono-tech min-h-[36px] px-2.5 py-1 text-[10px] font-bold uppercase rounded-[var(--radius-pill)] border cursor-pointer transition-colors ${
                  onlyAffordable
                    ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-color)]'
                    : 'bg-[var(--bg-card-alt)] text-[var(--ink-primary)] border-[var(--border-ink)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                {onlyAffordable ? ext.onlyAffordable : ext.showAllTraits}
              </button>
            </div>

            {/* Filtered traits catalog */}
            {visibleTraits.length === 0 ? (
              <div className="p-5 border-[length:var(--border-width)] border-dashed border-[var(--border-color)] rounded-[var(--radius-card)] bg-[var(--bg-card-alt)] flex flex-col gap-2 text-center">
                <p className="font-mono-tech text-xs text-[var(--ink-secondary)]">
                  {allTraits.length === 0
                    ? t.t('xp.emptyTraits')
                    : t.t('xp.noUpgradeInCategory', {
                        category:
                          filterTabs.find((tab) => tab.id === categoryFilter)?.label ?? t.filterAll,
                        xp: availableXp,
                      })}
                </p>
                {onlyAffordable && allTraits.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setOnlyAffordable(false)}
                    className="cyber-btn-outline min-h-[36px] self-center px-3 py-1 text-[11px] font-bold uppercase cursor-pointer"
                  >
                    {ext.showAllTraits} ({allTraits.length})
                  </button>
                )}
              </div>
            ) : (
              <ul
                data-testid="possible-upgrades-list"
                className="max-h-[480px] overflow-y-auto print:max-h-none print:overflow-visible border-[length:var(--border-width)] border-[var(--border-color)] rounded-[var(--radius-card)] divide-y divide-[var(--border-subtle)] bg-[var(--bg-card)]"
              >
                {visibleTraits.map((trait) => {
                  const isBlockedV5 = Boolean(trait.isBlockedByRule || trait.cost === null);
                  const numericCost = trait.cost ?? 0;
                  const missingXp = Math.max(0, numericCost - availableXp);
                  const isEditingCost = editingCostFieldId === trait.fieldId && !isBlockedV5;
                  const dotCap = trait.maxCap <= 10 ? trait.maxCap : 0;
                  const clanTagMult =
                    trait.multiplier ??
                    (trait.disciplineAffinity === 'discipline_caitiff'
                      ? 6
                      : trait.isOutOfClan
                        ? 7
                        : 5);

                  return (
                    <li
                      key={trait.fieldId}
                      data-testid={`xp-trait-row-${trait.fieldId}`}
                      className={`px-3.5 py-2.5 flex flex-col gap-2 transition-colors ${
                        isBlockedV5
                          ? 'bg-[var(--bg-strip)]'
                          : trait.isPossible
                            ? 'hover:bg-[var(--bg-card-alt)]'
                            : 'bg-[var(--bg-card-alt)]'
                      }`}
                    >
                      <div
                        className={`flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 ${
                          isBlockedV5
                            ? 'p-2.5 rounded-[var(--radius-card)] border-[length:var(--border-width)] border-dashed border-[var(--border-color)] bg-[var(--bg-card)]'
                            : ''
                        }`}
                      >
                        <div className="flex flex-col gap-1 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 font-mono-tech text-[10px] text-[var(--ink-secondary)]">
                            <span className="font-bold text-[var(--accent-wine)]">
                              {getTraitCategoryBadge(trait)}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span
                              data-testid={`xp-trait-formula-${trait.fieldId}`}
                              className="text-[var(--text-primary)] font-semibold"
                            >
                              {trait.formulaLabel}
                            </span>

                            {trait.category === 'discipline' && showDisciplineClanToggle && (
                              <button
                                type="button"
                                data-testid={`disc-clan-toggle-${trait.fieldId}`}
                                onClick={() => handleToggleDisciplineClan(trait)}
                                className={`no-print print:hidden px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-[var(--radius-pill)] border cursor-pointer transition-colors ${
                                  trait.disciplineAffinity === 'discipline_caitiff'
                                    ? 'bg-[var(--bg-strip)] text-[var(--ink-primary)] border-[var(--border-color)]'
                                    : trait.isOutOfClan
                                      ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-color)]'
                                      : 'bg-[var(--accent-cream-badge)] text-[var(--accent-wine)] border-[var(--accent-wine)]'
                                }`}
                              >
                                {trait.disciplineAffinity === 'discipline_caitiff'
                                  ? t.t('xp.caitiffTag', { mult: clanTagMult })
                                  : trait.isOutOfClan
                                    ? t.t('xp.outOfClanTag', { mult: clanTagMult })
                                    : t.t('xp.clanTag', { mult: clanTagMult })}
                              </button>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 min-w-0">
                            <span className="font-mono-tech text-xs font-bold text-[var(--text-primary)] truncate print:whitespace-normal print:overflow-visible">
                              {trait.label}
                            </span>

                            <span className="font-mono-tech text-xs font-semibold text-[var(--text-secondary)] whitespace-nowrap shrink-0 tabular-nums">
                              {trait.isMaxed || isBlockedV5
                                ? `${trait.currentValue} / ${trait.maxCap}`
                                : `${trait.currentValue} → ${trait.nextValue}`}
                            </span>

                            {dotCap > 0 && (
                              <span
                                className="hidden sm:inline-flex items-center gap-0.5 shrink-0"
                                aria-hidden="true"
                              >
                                {Array.from({ length: dotCap }).map((_, idx) => {
                                  const filled = idx < trait.currentValue;
                                  const nextDot =
                                    !trait.isMaxed && !isBlockedV5 && idx === trait.currentValue;
                                  return (
                                    <span
                                      key={idx}
                                      className={`w-2 h-2 rounded-[2px] border ${
                                        filled
                                          ? 'bg-[var(--accent-wine)] border-[var(--accent-wine)]'
                                          : nextDot
                                            ? 'bg-[var(--accent-wine-soft)] border-[var(--accent-wine)] border-dashed'
                                            : 'bg-transparent border-[var(--border-ink)]'
                                      }`}
                                    />
                                  );
                                })}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {!trait.isMaxed && !isBlockedV5 && (
                            <button
                              type="button"
                              data-testid={`trait-custom-cost-toggle-${trait.fieldId}`}
                              aria-label={`${ext.customCostAria}: ${trait.label}`}
                              aria-expanded={isEditingCost}
                              onClick={() => {
                                if (isEditingCost) {
                                  setEditingCostFieldId(null);
                                } else {
                                  setEditingCostFieldId(trait.fieldId);
                                  setCustomCostDraft(
                                    pricingConfig.fieldCustomCosts?.[trait.fieldId] !== undefined
                                      ? String(pricingConfig.fieldCustomCosts[trait.fieldId])
                                      : String(numericCost),
                                  );
                                }
                              }}
                              className={`no-print print:hidden min-h-[36px] px-2.5 text-[10px] font-mono-tech font-bold uppercase rounded-[var(--radius-pill)] border cursor-pointer ${
                                trait.isCustomCost
                                  ? 'bg-[var(--accent-cream-badge)] text-[var(--accent-wine)] border-[var(--accent-wine)]'
                                  : 'bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-color)] hover:bg-[var(--bg-hover)]'
                              }`}
                            >
                              {ext.customCostBtn}
                            </button>
                          )}

                          {isBlockedV5 ? (
                            <span
                              data-testid={`xp-blocked-v5-${trait.fieldId}`}
                              aria-disabled="true"
                              className="font-mono-tech min-h-[36px] px-3 py-1.5 text-[10px] font-bold uppercase inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-dashed border-[var(--border-color)] bg-[var(--bg-strip)] text-[var(--text-primary)]"
                            >
                              <Lock className="w-3 h-3 shrink-0" aria-hidden="true" />
                              <span>{trait.blockedReason ?? t.t('xp.v5BlockedNotice')}</span>
                            </span>
                          ) : trait.isMaxed ? (
                            <span className="font-mono-tech min-h-[36px] px-3 py-1.5 text-[10px] font-bold uppercase inline-flex items-center rounded-[var(--radius-pill)] border border-[var(--border-color)] bg-[var(--bg-header-strip)] text-[var(--text-primary)]">
                              {ext.maxBadge}
                            </span>
                          ) : trait.isAffordable ? (
                            <button
                              key="affordable"
                              type="button"
                              data-testid={`xp-upgrade-btn-${trait.fieldId}`}
                              onClick={() => handleAttemptUpgrade(trait)}
                              aria-label={t.t('xp.upgradeAria', {
                                label: trait.label,
                                from: trait.currentValue,
                                to: trait.nextValue,
                                cost: numericCost,
                              })}
                              className="cyber-roll-btn min-h-[36px] px-3 py-1.5 text-[11px] font-bold uppercase inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer tabular-nums"
                            >
                              <span>{t.upgradeBtn(numericCost)}</span>
                              <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          ) : (
                            <button
                              key="locked"
                              type="button"
                              data-testid={`xp-upgrade-btn-${trait.fieldId}`}
                              aria-disabled="true"
                              onClick={() => handleAttemptUpgrade(trait)}
                              title={ext.insufficientBadge(missingXp)}
                              className="font-mono-tech min-h-[36px] px-3 py-1.5 text-[10px] font-bold uppercase inline-flex items-center gap-1 whitespace-nowrap shrink-0 tabular-nums rounded-[var(--radius-control)] border border-dashed border-[var(--accent-danger)] bg-[var(--accent-danger-soft)] text-[var(--accent-danger)] cursor-not-allowed"
                            >
                              <span>{numericCost} XP · {ext.insufficientBadge(missingXp)}</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {isEditingCost && (
                        <div className="no-print print:hidden pt-1.5 border-t border-dashed border-[var(--border-ink)] flex flex-wrap items-center justify-end gap-1.5">
                          <input
                            type="number"
                            min={0}
                            max={9999}
                            data-testid={`trait-custom-cost-input-${trait.fieldId}`}
                            aria-label={`${ext.customCostAria}: ${trait.label}`}
                            value={customCostDraft}
                            onChange={(e) => setCustomCostDraft(e.target.value)}
                            className="cyber-input w-20 min-h-[36px] px-2 py-1 text-[11px] font-bold text-center tabular-nums"
                          />
                          <button
                            type="button"
                            data-testid={`trait-custom-cost-apply-${trait.fieldId}`}
                            onClick={() => handleApplyTraitCustomCost(trait.fieldId)}
                            className="cyber-roll-btn min-h-[36px] px-2.5 py-1 text-[10px] font-bold uppercase cursor-pointer"
                          >
                            {ext.applyCustomCost}
                          </button>
                          <button
                            type="button"
                            data-testid={`trait-custom-cost-clear-${trait.fieldId}`}
                            onClick={() => handleClearTraitCustomCost(trait.fieldId)}
                            className="cyber-btn-outline min-h-[36px] px-2.5 py-1 text-[10px] font-bold uppercase cursor-pointer"
                          >
                            {ext.clearCustomCost}
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Integrated Direct Acquisition (0 -> 1) Catalog for Official WoD Sheets */}
            {officialEdition && categoryFilter !== 'attribute' && (
              <div className="no-print print:hidden pt-1 flex flex-col gap-2">
                <button
                  type="button"
                  data-testid="xp-acquire-toggle"
                  aria-expanded={acquireOpen}
                  aria-controls="xp-acquire-panel"
                  aria-label={t.t('xp.acquireToggleAria')}
                  onClick={() => setAcquireOpen((prev) => !prev)}
                  className={`font-mono-tech min-h-[36px] w-full px-3 py-2 text-[11px] font-bold uppercase rounded-[var(--radius-control)] border-[length:var(--border-width)] flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                    acquireOpen
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-contrast)] border-[var(--border-color)]'
                      : 'bg-[var(--bg-card-alt)] text-[var(--text-primary)] border-[var(--border-color)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <Plus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{t.t('xp.acquireHeading')}</span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-[var(--radius-pill)] border ${
                        acquireOpen
                          ? 'bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-color)]'
                          : 'bg-[var(--accent-cream-badge)] text-[var(--accent-wine)] border-[var(--accent-wine)]'
                      }`}
                    >
                      {t.t('xp.acquireCount', { count: acquirableByKind.length })}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-150 ${
                        acquireOpen ? 'rotate-180' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </span>
                </button>

                {acquireOpen && (
                  <div
                    id="xp-acquire-panel"
                    data-testid="xp-acquire-panel"
                    className="xp-acquire-panel p-3 flex flex-col gap-2.5"
                  >
                    {categoryFilter === 'all' && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {(
                          [
                            ['skill', t.t('xp.acquireSubSkills')],
                            ['discipline', t.t('xp.acquireSubDisciplines')],
                            ['advantage', t.t('xp.acquireSubAdvantages')],
                          ] as const
                        ).map(([kindId, kindLabel]) => {
                          const isSelected = effectiveAcquireKind === kindId;
                          return (
                            <button
                              key={kindId}
                              type="button"
                              data-testid={`xp-acquire-kind-${kindId}`}
                              aria-pressed={isSelected}
                              onClick={() => setAcquireKind(kindId)}
                              className={`font-mono-tech min-h-[36px] px-2.5 py-1 text-[10px] font-bold uppercase rounded-[var(--radius-pill)] border cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-[var(--accent-black)] text-[var(--accent-contrast)] border-[var(--border-color)]'
                                  : 'bg-[var(--bg-card)] text-[var(--text-primary)] border-[var(--border-color)] hover:bg-[var(--bg-hover)]'
                              }`}
                            >
                              {kindLabel} ({acquirableCountsByKind[kindId]})
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                      <search className="relative flex-1 min-w-[180px]">
                        <label htmlFor={acquireSearchId} className="sr-only">
                          {t.t('xp.acquireSearchLabel')}
                        </label>
                        <Search
                          className="w-3.5 h-3.5 text-[var(--ink-muted)] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                          aria-hidden="true"
                        />
                        <input
                          id={acquireSearchId}
                          type="search"
                          autoCorrect="off"
                          autoCapitalize="none"
                          spellCheck={false}
                          data-testid="xp-acquire-search"
                          value={acquireQuery}
                          onChange={(e) => setAcquireQuery(e.target.value)}
                          placeholder={t.t('xp.acquireSearchPlaceholder')}
                          className="cyber-input mobile-touch-input min-h-[36px] pl-8 pr-2.5 py-1 text-[16px] sm:text-xs w-full"
                        />
                      </search>

                      {effectiveAcquireKind === 'advantage' && onBuyBackground && (
                        <button
                          type="button"
                          data-testid="xp-acquire-custom-advantage-btn"
                          onClick={() => {
                            setBgOpen(true);
                            setSpecOpen(false);
                            setXpError(null);
                          }}
                          className="cyber-btn-outline min-h-[36px] px-2.5 py-1 text-[10px] font-bold uppercase whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          {t.t('xp.acquireCustomAdvantageBtn')}
                        </button>
                      )}
                    </div>

                    {acquirableByKind.length === 0 ? (
                      <p className="font-mono-tech text-[11px] text-[var(--ink-secondary)] text-center py-3">
                        {t.t('xp.acquireAllOwned')}
                      </p>
                    ) : filteredAcquirable.length === 0 ? (
                      <p className="font-mono-tech text-[11px] text-[var(--ink-secondary)] text-center py-3">
                        {t.t('xp.acquireEmptySearch', { query: acquireQuery })}
                      </p>
                    ) : (
                      <ul
                        data-testid="xp-acquire-list"
                        className="max-h-[320px] overflow-y-auto border border-[var(--border-color)] rounded-[var(--radius-card)] divide-y divide-[var(--border-subtle)] bg-[var(--bg-card)]"
                      >
                        {filteredAcquirable.map((item) => {
                          const missingXp = Math.max(0, item.cost - availableXp);
                          return (
                            <li
                              key={`${item.kind}-${item.catalogId}`}
                              data-testid={`xp-acquire-row-${item.kind}-${item.varName}`}
                              className="px-3 py-2 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2"
                            >
                              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5 font-mono-tech text-[10px]">
                                  {item.kind === 'discipline' && item.disciplineAffinity === 'discipline_clan' && (
                                    <span
                                      data-testid={`xp-acquire-clan-badge-${item.varName}`}
                                      className="xp-acquire-clan-badge px-1.5 py-0.5 text-[9px] font-extrabold uppercase"
                                    >
                                      {t.t('xp.acquireInClanTag')}
                                    </span>
                                  )}
                                  {item.kind === 'discipline' && item.disciplineAffinity === 'discipline_caitiff' && (
                                    <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-[var(--radius-pill)] border border-[var(--border-color)] bg-[var(--bg-strip)] text-[var(--text-primary)]">
                                      {t.t('xp.acquireCaitiffTag')}
                                    </span>
                                  )}
                                  {item.kind === 'discipline' && item.disciplineAffinity === 'discipline_out_of_clan' && (
                                    <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-[var(--radius-pill)] border border-[var(--border-color)] bg-[var(--bg-card-alt)] text-[var(--text-secondary)]">
                                      {t.t('xp.acquireOutOfClanTag')}
                                    </span>
                                  )}
                                  {item.kind === 'advantage' && item.subGroup && (
                                    <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase rounded-[var(--radius-pill)] border border-[var(--border-subtle)] bg-[var(--bg-strip)] text-[var(--text-secondary)]">
                                      {item.subGroup === 'merit'
                                        ? t.t('xp.acquireGroupMerit')
                                        : t.t('xp.acquireGroupBackground')}
                                    </span>
                                  )}
                                  {item.kind === 'skill' && item.subGroup && (
                                    <span className="text-[9px] font-bold uppercase text-[var(--accent-wine)]">
                                      {item.subGroup}
                                    </span>
                                  )}
                                  <span className="font-semibold text-[var(--text-secondary)]">
                                    {item.formulaLabel}
                                  </span>
                                </div>

                                <span className="font-mono-tech text-xs font-bold text-[var(--text-primary)] truncate">
                                  {item.label}
                                </span>

                                {item.summary && (
                                  <span className="font-mono-tech text-[10px] text-[var(--ink-secondary)] line-clamp-2">
                                    {item.summary}
                                  </span>
                                )}
                              </div>

                              {item.isAffordable ? (
                                <button
                                  type="button"
                                  data-testid={`xp-acquire-btn-${item.kind}-${item.varName}`}
                                  onClick={() => handleAcquireCatalogItem(item)}
                                  aria-label={t.t('xp.acquireAria', {
                                    label: item.label,
                                    cost: item.cost,
                                  })}
                                  className="cyber-roll-btn min-h-[36px] px-3 py-1.5 text-[10px] font-bold uppercase inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer tabular-nums"
                                >
                                  <span>{t.t('xp.acquireBtn', { cost: item.cost })}</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  aria-disabled="true"
                                  data-testid={`xp-acquire-btn-${item.kind}-${item.varName}`}
                                  onClick={() => handleAcquireCatalogItem(item)}
                                  className="xp-acquire-locked-btn min-h-[36px] px-3 py-1.5 text-[10px] font-bold uppercase inline-flex items-center gap-1 whitespace-nowrap shrink-0 tabular-nums"
                                >
                                  <span>
                                    {item.cost} XP · {ext.insufficientBadge(missingXp)}
                                  </span>
                                </button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Specialty & Custom Background/Advantage Direct Purchase */}
      <section className="bento-card overflow-hidden">
        <div className="bento-card-header px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="font-mono-tech text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--accent-wine)]">
              {t.t('xp.extrasTag')}
            </div>
            <h3 className="text-sm font-black uppercase tracking-tight text-[var(--ink-primary)]">
              {t.t('xp.extrasTitle')}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              data-testid="xp-open-specialty-btn"
              onClick={() => {
                setSpecOpen((v) => !v);
                setBgOpen(false);
                setXpError(null);
              }}
              className="cyber-btn-outline min-h-[40px] px-3 py-1.5 text-[11px] font-bold uppercase cursor-pointer"
            >
              {t.t('xp.openSpecialtyBtn', { cost: SPECIALTY_XP_COST })}
            </button>
            <button
              type="button"
              data-testid="xp-open-background-btn"
              onClick={() => {
                setBgOpen((v) => !v);
                setSpecOpen(false);
                setXpError(null);
              }}
              className="cyber-roll-btn min-h-[40px] px-3 py-1.5 text-[11px] font-bold uppercase cursor-pointer"
            >
              {t.t('xp.openBackgroundBtn')}
            </button>
          </div>
        </div>

        {specOpen && (
          <div className="p-4 border-t border-[var(--border-ink)] bg-[var(--bg-card-alt)] space-y-3">
            <div className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-secondary)]">
              {t.t('xp.specialtyHeading', { cost: SPECIALTY_XP_COST })}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                data-testid="xp-specialty-skill-select"
                value={specSkillId || allTraits.find((tr) => tr.category === 'skill')?.fieldId || ''}
                onChange={(e) => setSpecSkillId(e.target.value)}
                className="cyber-input min-h-[44px] px-2.5 py-2 text-[16px] sm:text-xs font-bold"
              >
                {allTraits
                  .filter((tr) => tr.category === 'skill')
                  .map((sk) => {
                    const suggested = sk.currentValue >= 4 ? '★ V20 ' : sk.currentValue >= 1 ? '• ' : '';
                    return (
                      <option key={sk.fieldId} value={sk.fieldId}>
                        {suggested}
                        {sk.label} ({sk.currentValue})
                      </option>
                    );
                  })}
              </select>
              <input
                type="text"
                data-testid="xp-specialty-focus-input"
                value={specFocus}
                onChange={(e) => setSpecFocus(e.target.value)}
                placeholder={t.t('xp.specialtyPlaceholder')}
                className="cyber-input min-h-[44px] px-2.5 py-2 text-[16px] sm:text-xs"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSpecOpen(false)}
                className="cyber-btn-outline min-h-[40px] px-3 py-1.5 text-[11px] font-bold uppercase cursor-pointer"
              >
                {t.t('xp.cancelBtn')}
              </button>
              <button
                type="button"
                data-testid="xp-confirm-specialty-btn"
                onClick={() => {
                  const targetId =
                    specSkillId || allTraits.find((tr) => tr.category === 'skill')?.fieldId || '';
                  if (!targetId || !onBuySpecialty) return;
                  const res = onBuySpecialty(targetId, specFocus);
                  if (!res.ok) {
                    setXpError(res.error ?? t.t('xp.errBuySpecialty'));
                    return;
                  }
                  setXpError(null);
                  setSpecFocus('');
                  setSpecOpen(false);
                }}
                className="cyber-roll-btn min-h-[40px] px-4 py-1.5 text-[11px] font-bold uppercase cursor-pointer"
              >
                {t.t('xp.specialtyConfirmBtn', { cost: SPECIALTY_XP_COST })}
              </button>
            </div>
          </div>
        )}

        {bgOpen && (
          <div className="p-4 border-t border-[var(--border-ink)] bg-[var(--bg-card-alt)] space-y-3">
            <div className="font-mono-tech text-[10px] font-bold uppercase text-[var(--ink-secondary)]">
              {t.t('xp.backgroundHeading')}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {customAdvantageQuickChips.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => setBgName(preset.label)}
                  className={`min-h-[36px] px-2.5 py-1 text-[10px] font-mono-tech font-bold uppercase rounded-[var(--radius-pill)] border cursor-pointer ${
                    bgName.trim().toLowerCase() === preset.label.toLowerCase()
                      ? 'bg-[var(--accent-black)] text-[var(--ink-inverse)] border-[var(--border-ink)]'
                      : 'bg-[var(--bg-card)] text-[var(--ink-primary)] border-[var(--border-ink)]/50 hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                data-testid="xp-background-name-input"
                value={bgName}
                onChange={(e) => setBgName(e.target.value)}
                placeholder={t.t('xp.backgroundPlaceholder')}
                className="cyber-input sm:col-span-2 min-h-[44px] px-2.5 py-2 text-[16px] sm:text-xs"
              />
              <input
                type="number"
                min={0}
                max={100}
                data-testid="xp-background-cost-input"
                value={bgCost}
                onChange={(e) => setBgCost(e.target.value)}
                aria-label={t.t('xp.backgroundCostAria')}
                className="cyber-input min-h-[44px] px-2.5 py-2 text-[16px] sm:text-xs font-bold text-center tabular-nums"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setBgOpen(false)}
                className="cyber-btn-outline min-h-[40px] px-3 py-1.5 text-[11px] font-bold uppercase cursor-pointer"
              >
                {t.t('xp.cancelBtn')}
              </button>
              <button
                type="button"
                data-testid="xp-confirm-background-btn"
                onClick={() => {
                  const parsedCost = Number.parseInt(bgCost, 10);
                  const cost = Number.isFinite(parsedCost) ? parsedCost : DEFAULT_BACKGROUND_XP_COST;
                  const matchedOfficial = officialEdition
                    ? findAdvantageByIdOrName(bgName, officialEdition)
                    : null;
                  let res: { ok: boolean; error?: string } | undefined;
                  if (
                    matchedOfficial &&
                    officialEdition &&
                    onBuyCatalogAdvantage &&
                    !isCatalogAdvantagePresent(sheet, matchedOfficial.id, officialEdition)
                  ) {
                    res = onBuyCatalogAdvantage(matchedOfficial.id, cost);
                  } else if (onBuyBackground) {
                    res = onBuyBackground(bgName, cost);
                  }
                  if (!res) return;
                  if (!res.ok) {
                    setXpError(res.error ?? t.t('xp.errBuyBackground'));
                    return;
                  }
                  setXpError(null);
                  setBgName('');
                  setBgCost(String(DEFAULT_BACKGROUND_XP_COST));
                  setBgOpen(false);
                }}
                className="cyber-roll-btn min-h-[40px] px-4 py-1.5 text-[11px] font-bold uppercase cursor-pointer"
              >
                {t.t('xp.backgroundConfirmBtn', {
                  cost: Number.isFinite(Number.parseInt(bgCost, 10))
                    ? Number.parseInt(bgCost, 10)
                    : DEFAULT_BACKGROUND_XP_COST,
                })}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

