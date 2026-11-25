import fs from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import {
  canRerollDisciplineRouse,
  evaluateV5Rolls,
  executeDisciplineRouseCheck,
  executeRemorseCheck,
  executeRouseCheck,
  getV5BloodPotencyStats,
  rerollV5PoolDice,
  resolveFrenzyRoll,
  rollDiceExpression,
} from './formula';
import {
  adjustSheetHumanityStains,
  adjustV20HealthDamage,
  adjustV5HealthDamage,
  adjustV5WillpowerDamage,
  applyRemorseOutcomeToSheet,
  applyRouseCheckHunger,
  applyV5WillpowerSuperficialDamage,
  computeWoundPenalty,
  createWorldOfDarknessSheet,
  createWorldOfDarknessV5Sheet,
  getSheetHumanityStains,
  getV5HealthBreakdown,
  getV5WillpowerState,
  updateFieldValue,
  validateSheetPayload,
} from './sheetModel';
import {
  awardXp,
  buyCatalogAdvantageWithXp,
  buyCatalogDisciplineWithXp,
  buyCatalogSkillWithXp,
  calculateUpgradeCost,
  resetXpPricingConfig,
  setTraitCustomCostOverride,
  undoLastUpgrade,
  upgradeTraitWithXp,
} from './xpSystem';
import { computeWodComposedPool } from '../utils/wodPoolComposer';
import {
  assignV20AttributePriority,
  assignV20SkillPriority,
  buildSheetFromWodWizard,
  canCompleteWizard,
  createInitialWodWizardState,
  setWizardAttribute,
  setWizardBackground,
  setWizardClan,
  setWizardDiscipline,
  setWizardSkill,
  setWizardSkillSpecialty,
  toggleWizardDisciplinePower,
  type WodCreationWizardState,
} from '../utils/wodCreationWizard';

function compileSchemaV2Validator() {
  const schemaRaw = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'shared/presets/schema.v2.json'), 'utf8'),
  ) as Record<string, unknown>;
  const AjvCtor = (Ajv2020 as unknown as { default?: typeof Ajv2020 }).default ?? Ajv2020;
  const ajv = new AjvCtor({ allErrors: true, strict: false });
  const applyFormats =
    (addFormats as unknown as { default?: typeof addFormats }).default ?? addFormats;
  applyFormats(ajv);
  return ajv.compile(schemaRaw);
}

function rngFromRolls(rolls: number[]): () => number {
  let idx = 0;
  return () => {
    const face = rolls[idx] ?? 1;
    idx += 1;
    return (face - 1) / 10 + 0.01;
  };
}

describe('Workstream 3 — WoD Business Rules Invariants (V5 & V20)', () => {
  describe('1. Storyteller V20 Engine', () => {
    it('enforces 1s cancellation, Botch, Specialty, Soak botch-immunity, Willpower immunity, Wound penalties, and Frenzy immunity', () => {
      // 1s cancel successes: [8, 7, 1] @ diff 6 => 2 - 1 = 1 success
      const canceled = rollDiceExpression('pool(3, 6)', {}, rngFromRolls([8, 7, 1]), {
        rulePreset: 'storyteller-v20',
        difficulty: 6,
      });
      expect(canceled.ok).toBe(true);
      expect(canceled.total).toBe(1);
      expect(canceled.canceledOnes).toBe(1);
      expect(canceled.outcome).toBe('success');

      // Canceled down to 0 (a die met target, then 1 canceled it) => failure, NOT botch
      const canceledZero = rollDiceExpression('pool(2, 6)', {}, rngFromRolls([8, 1]), {
        rulePreset: 'storyteller-v20',
        difficulty: 6,
      });
      expect(canceledZero.total).toBe(0);
      expect(canceledZero.outcome).toBe('failure');
      expect(canceledZero.isFumble).toBe(false);

      // Botch: 0 dice met target + >= 1 die rolled 1
      const botch = rollDiceExpression('pool(3, 6)', {}, rngFromRolls([5, 4, 1]), {
        rulePreset: 'storyteller-v20',
        difficulty: 6,
      });
      expect(botch.total).toBe(0);
      expect(botch.outcome).toBe('botch');
      expect(botch.isFumble).toBe(true);

      // Specialty: 10 counts as 2 successes
      const spec = rollDiceExpression('pool(2, 6)', {}, rngFromRolls([10, 4]), {
        rulePreset: 'storyteller-v20',
        difficulty: 6,
        specialty: true,
      });
      expect(spec.total).toBe(2);
      expect(spec.doubledTensCount).toBe(1);

      // Soak is immune to Botch
      const soak = rollDiceExpression('pool(2, 6)', {}, rngFromRolls([2, 1]), {
        rulePreset: 'storyteller-v20',
        difficulty: 6,
        isSoak: true,
        soakDamageType: 'lethal',
      });
      expect(soak.total).toBe(0);
      expect(soak.outcome).toBe('failure');
      expect(soak.isFumble).toBe(false);

      // Aggravated soak excludes Stamina and blocks Willpower auto-success
      const aggSoak = rollDiceExpression(
        'pool(stamina + fortitude_armor, 6)',
        { stamina: 4, fortitude_armor: 1 },
        rngFromRolls([9]),
        {
          rulePreset: 'storyteller-v20',
          difficulty: 6,
          isSoak: true,
          soakDamageType: 'aggravated',
          willpowerAutoSuccess: true,
        },
      );
      expect(aggSoak.rolls).toHaveLength(1);
      expect(aggSoak.willpowerUsed).toBe(false);
      expect(aggSoak.total).toBe(1);

      // +1 Willpower auto-success is immune to cancellation by 1s and prevents Botch
      const wpSaved = rollDiceExpression('pool(3, 6)', {}, rngFromRolls([2, 1, 1]), {
        rulePreset: 'storyteller-v20',
        difficulty: 6,
        willpowerAutoSuccess: true,
      });
      expect(wpSaved.total).toBe(1);
      expect(wpSaved.outcome).toBe('success');
      expect(wpSaved.isFumble).toBe(false);
      expect(wpSaved.willpowerUsed).toBe(true);

      // Wound penalties (-1, -2, -5) and Frenzy immunity
      let v20 = createWorldOfDarknessSheet();
      v20 = adjustV20HealthDamage(v20, 'f_health', 'lethal', 2);
      expect(computeWoundPenalty(v20, 'storyteller-v20')).toBe(-1);
      v20 = adjustV20HealthDamage(v20, 'f_health', 'lethal', 2); // total 4
      expect(computeWoundPenalty(v20, 'storyteller-v20')).toBe(-2);
      v20 = adjustV20HealthDamage(v20, 'f_health', 'lethal', 2); // total 6
      expect(computeWoundPenalty(v20, 'storyteller-v20')).toBe(-5);

      const frenzy = resolveFrenzyRoll(v20, {
        rulePreset: 'storyteller-v20',
        virtue: 'autocontrole',
        difficulty: 6,
        rng: rngFromRolls([7, 8, 9]),
      });
      expect(frenzy.isFrenzyRoll).toBe(true);
      expect(frenzy.woundPenalty).toBeUndefined();
      expect(frenzy.poolSize).toBe(3);
      expect(frenzy.resisted).toBe(true);
    });
  });

  describe('2. Vampire V5 Engine', () => {
    it('enforces >=6 successes, 10-pairs (+4 total), Messy Critical, Bestial Failure, and Willpower Surge reroll + WP track', () => {
      // Pair of 10s = 4 successes; +6 = 5 total
      const critEval = evaluateV5Rolls([10, 10, 6], 0, 2);
      expect(critEval.total).toBe(5);
      expect(critEval.critPairsCount).toBe(1);
      expect(critEval.isCritical).toBe(true);
      expect(critEval.messyCritical).toBe(false);
      expect(critEval.status).toBe('critical');

      // Messy Critical: pair of 10s with >=1 Hunger 10
      const messy = evaluateV5Rolls([10, 5, 10], 1, 2);
      expect(messy.total).toBe(4);
      expect(messy.isCritical).toBe(true);
      expect(messy.messyCritical).toBe(true);
      expect(messy.status).toBe('messy_critical');

      // Bestial Failure: failure with >=1 Hunger 1
      const bestial = evaluateV5Rolls([6, 3, 1], 1, 2);
      expect(bestial.total).toBe(1);
      expect(bestial.bestialFailure).toBe(true);
      expect(bestial.status).toBe('bestial_failure');

      // Willpower Surge rerolls only normal dice (Hunger indices ignored) and marks 1 Superficial WP with overflow
      const rerolled = rerollV5PoolDice([2, 3, 10], 1, [0, 1, 2], rngFromRolls([8, 9]), {
        difficulty: 2,
      });
      expect(rerolled.rerolledIndices).toEqual([0, 1]); // index 2 (Hunger) blocked
      expect(rerolled.normalDice).toEqual([8, 9]);
      expect(rerolled.hungerRolls).toEqual([10]);
      expect(rerolled.total).toBe(3);

      let v5 = createWorldOfDarknessV5Sheet(); // Composure 3 + Resolve 2 => WP max 5
      v5 = applyV5WillpowerSuperficialDamage(v5, 1);
      expect(getV5WillpowerState(v5).superficial).toBe(1);
      expect(getV5WillpowerState(v5).aggravated).toBe(0);

      // Fill remaining 4 boxes with superficial, then apply 1 more -> overflow converts 1 superficial to aggravated
      v5 = applyV5WillpowerSuperficialDamage(v5, 4);
      expect(getV5WillpowerState(v5).isImpaired).toBe(true);
      v5 = applyV5WillpowerSuperficialDamage(v5, 1);
      const wpAfterOverflow = getV5WillpowerState(v5);
      expect(wpAfterOverflow.aggravated).toBe(1);
      expect(wpAfterOverflow.superficial).toBe(4);
    });

    it('enforces Blood Potency 0..10 stats, Blood Surge, Mend on failed Rouse, Discipline powerBonusDice, and rouseRerollMaxLevel', () => {
      const expectedTable = [
        [0, 1, 1, 0, 0, 0],
        [1, 2, 1, 0, 1, 2],
        [2, 2, 2, 1, 1, 2],
        [3, 3, 2, 1, 2, 3],
        [4, 3, 3, 2, 2, 3],
        [5, 4, 3, 2, 3, 4],
        [6, 4, 3, 3, 3, 4],
        [7, 5, 4, 3, 4, 5],
        [8, 5, 4, 4, 4, 5],
        [9, 6, 5, 4, 5, 6],
        [10, 6, 5, 5, 5, 6],
      ] as const;

      for (const [level, surge, mend, power, rerollMax, bane] of expectedTable) {
        const stats = getV5BloodPotencyStats(level);
        expect(stats.bloodSurgeDice).toBe(surge);
        expect(stats.mendSuperficialPerRouse).toBe(mend);
        expect(stats.powerBonusDice).toBe(power);
        expect(stats.rouseRerollMaxLevel).toBe(rerollMax);
        expect(stats.baneSeverity).toBe(bane);
      }

      // Blood Surge adds bloodSurgeDice for BP 4 (+3d10)
      const bp4Roll = rollDiceExpression(
        'pool(strength + brawl, 2)',
        { strength: 3, brawl: 2, blood_potency: 4, hunger: 1 },
        rngFromRolls([6, 6, 6, 6, 6, 6, 6, 6]),
        { rulePreset: 'vampire-v5', bloodSurge: true },
      );
      expect(bp4Roll.rolls).toHaveLength(8);
      expect(bp4Roll.isBloodSurge).toBe(true);

      // Mend Superficial heals mendSuperficialPerRouse EVEN WHEN the Rouse Check fails (+1 Hunger)
      let v5 = createWorldOfDarknessV5Sheet();
      v5 = adjustV5HealthDamage(v5, 'f_health', 'superficial', 4);
      const bp4Stats = getV5BloodPotencyStats(4);
      const failedMendRouse = executeRouseCheck(rngFromRolls([2])); // fail -> hungerDelta: 1
      expect(failedMendRouse.hungerDelta).toBe(1);
      v5 = applyRouseCheckHunger(v5, failedMendRouse.hungerDelta ?? 0);
      v5 = adjustV5HealthDamage(v5, 'f_health', 'superficial', -bp4Stats.mendSuperficialPerRouse);
      expect(getV5HealthBreakdown(v5.cards.flatMap((c) => c.fields).find((f) => f.id === 'f_health')!).superficial).toBe(
        4 - bp4Stats.mendSuperficialPerRouse,
      );

      // powerBonusDice applies ONLY when a Discipline trait is in pool AND toggle applyPowerBonus !== false
      const discWithBonus = computeWodComposedPool({
        rulePreset: 'vampire-v5',
        primaryTrait: { id: 'f_manipulation', key: 'manipulation', label: 'MANIPULATION', value: 3, group: 'attributes', attributeGroup: 'social' },
        secondaryTrait: { id: 'f_dominate', key: 'dominate', label: 'DOMINATE', value: 2, group: 'disciplines' },
        bloodPotency: 4,
        applyPowerBonus: true,
      });
      expect(discWithBonus.powerBonusDiceApplied).toBe(2);
      expect(discWithBonus.effectivePool).toBe(7);

      const discToggleOff = computeWodComposedPool({
        rulePreset: 'vampire-v5',
        primaryTrait: { id: 'f_manipulation', key: 'manipulation', label: 'MANIPULATION', value: 3, group: 'attributes', attributeGroup: 'social' },
        secondaryTrait: { id: 'f_dominate', key: 'dominate', label: 'DOMINATE', value: 2, group: 'disciplines' },
        bloodPotency: 4,
        applyPowerBonus: false,
      });
      expect(discToggleOff.powerBonusDiceApplied).toBe(0);
      expect(discToggleOff.effectivePool).toBe(5);

      const nonDiscPool = computeWodComposedPool({
        rulePreset: 'vampire-v5',
        primaryTrait: { id: 'f_strength', key: 'strength', label: 'STRENGTH', value: 3, group: 'attributes', attributeGroup: 'physical' },
        secondaryTrait: { id: 'f_brawl', key: 'brawl', label: 'BRAWL', value: 2, group: 'skills' },
        bloodPotency: 4,
        applyPowerBonus: true,
      });
      expect(nonDiscPool.powerBonusDiceApplied).toBe(0);

      // rouseRerollMaxLevel applies ONLY to eligible Discipline power levels, never undefined (Blood Surge / Mend)
      expect(canRerollDisciplineRouse(3, 2)).toBe(true);
      expect(canRerollDisciplineRouse(3, 3)).toBe(false);
      expect(canRerollDisciplineRouse(3, undefined)).toBe(false);
      const eligibleReroll = executeDisciplineRouseCheck(3, 2, rngFromRolls([2, 8]));
      expect(eligibleReroll.rerolledByBloodPotency).toBe(true);
      expect(eligibleReroll.passed).toBe(true);
      expect(eligibleReroll.hungerDelta).toBe(0);

      const surgeNoReroll = executeDisciplineRouseCheck(3, undefined, rngFromRolls([2, 9]));
      expect(surgeNoReroll.rerolledByBloodPotency).toBe(false);
      expect(surgeNoReroll.passed).toBe(false);
      expect(surgeNoReroll.hungerDelta).toBe(1);
    });

    it('scopes Willpower Impaired (-2) to Social/Mental and Health Impaired (-2) to Physical without stacking -4', () => {
      const physAttr = { id: 'f_str', key: 'strength', label: 'STRENGTH', value: 3, group: 'attributes' as const, attributeGroup: 'physical' as const };
      const physSkill = { id: 'f_brawl', key: 'brawl', label: 'BRAWL', value: 2, group: 'skills' as const };
      const socAttr = { id: 'f_cha', key: 'charisma', label: 'CHARISMA', value: 3, group: 'attributes' as const, attributeGroup: 'social' as const };
      const menSkill = { id: 'f_inv', key: 'investigation', label: 'INVESTIGATION', value: 2, group: 'skills' as const };

      // Willpower Impaired only hits Social/Mental, not Physical
      const physUnderWp = computeWodComposedPool({
        rulePreset: 'vampire-v5',
        primaryTrait: physAttr,
        secondaryTrait: physSkill,
        woundPenalty: 0,
        isWillpowerImpaired: true,
      });
      expect(physUnderWp.appliedWoundPenalty).toBe(0);

      const socUnderWp = computeWodComposedPool({
        rulePreset: 'vampire-v5',
        primaryTrait: socAttr,
        secondaryTrait: menSkill,
        woundPenalty: 0,
        isWillpowerImpaired: true,
      });
      expect(socUnderWp.appliedWoundPenalty).toBe(-2);

      // Health Impaired only hits Physical, not Social/Mental
      const socUnderHealth = computeWodComposedPool({
        rulePreset: 'vampire-v5',
        primaryTrait: socAttr,
        secondaryTrait: menSkill,
        woundPenalty: -2,
        isWillpowerImpaired: false,
      });
      expect(socUnderHealth.appliedWoundPenalty).toBe(0);

      // Mixed pool with BOTH impaired caps at -2 (never -4)
      const mixedBothImpaired = computeWodComposedPool({
        rulePreset: 'vampire-v5',
        primaryTrait: physAttr,
        secondaryTrait: menSkill,
        woundPenalty: -2,
        isWillpowerImpaired: true,
      });
      expect(mixedBothImpaired.poolDomain).toBe('mixed');
      expect(mixedBothImpaired.appliedWoundPenalty).toBe(-2);
      expect(mixedBothImpaired.effectivePool).toBe(3);
    });

    it('enforces Humanity + Stains <= 10 with WP Aggravated overflow and Remorse Check clearing stains', () => {
      let v5 = createWorldOfDarknessV5Sheet(); // Humanity 7, WP max 5
      const stainRes = adjustSheetHumanityStains(v5, 5); // 7 + 5 = 12 => 3 stains + 2 overflow
      v5 = stainRes.sheet;
      expect(stainRes.humanity).toBe(7);
      expect(stainRes.stains).toBe(3);
      expect(stainRes.overflowStains).toBe(2);
      expect(getSheetHumanityStains(v5).humanity + getSheetHumanityStains(v5).stains).toBeLessThanOrEqual(10);
      expect(getV5WillpowerState(v5).aggravated).toBe(2);

      // Remorse check pool = Math.max(1, 10 - 7 - 3) = 1 die (no Hunger)
      const passRemorse = executeRemorseCheck(7, 3, rngFromRolls([6]));
      expect(passRemorse.pool).toBe(1);
      expect(passRemorse.passed).toBe(true);
      expect(passRemorse.nextHumanity).toBe(7);
      expect(passRemorse.nextStains).toBe(0);

      const failRemorse = executeRemorseCheck(7, 3, rngFromRolls([3]));
      expect(failRemorse.pool).toBe(1);
      expect(failRemorse.passed).toBe(false);
      expect(failRemorse.nextHumanity).toBe(6);
      expect(failRemorse.nextStains).toBe(0);

      const afterRemorse = applyRemorseOutcomeToSheet(v5, failRemorse.nextHumanity);
      expect(getSheetHumanityStains(afterRemorse)).toEqual({
        humanity: 6,
        stains: 0,
        remorsePool: 4,
      });
    });
  });

  describe('3. XP Engine & Atomic Undo (xpSystem.ts)', () => {
    it('computes V5 & V20 XP costs accurately, preserves custom overrides, syncs derived tracks, and atomically reverts 0->1 acquisitions', () => {
      // V5 pricing rules
      expect(calculateUpgradeCost(2, 'attribute', 'vampire-v5')).toBe(15); // 3 * 5
      expect(calculateUpgradeCost(2, 'skill', 'vampire-v5')).toBe(9); // 3 * 3
      expect(calculateUpgradeCost(2, 'discipline', 'vampire-v5', { disciplineAffinity: 'discipline_clan' })).toBe(15); // 3 * 5
      expect(calculateUpgradeCost(2, 'discipline', 'vampire-v5', { disciplineAffinity: 'discipline_caitiff' })).toBe(18); // 3 * 6
      expect(calculateUpgradeCost(2, 'discipline', 'vampire-v5', { disciplineAffinity: 'discipline_out_of_clan', isOutOfClan: true })).toBe(21); // 3 * 7
      // V5 Advantages/Backgrounds are flat 3 XP at ANY rating
      for (const lvl of [0, 1, 2, 3, 4]) {
        expect(calculateUpgradeCost(lvl, 'virtue', 'vampire-v5', { virtueSubtype: 'advantage' })).toBe(3);
      }
      expect(calculateUpgradeCost(1, 'virtue', 'vampire-v5', { virtueSubtype: 'blood_potency' })).toBe(20); // 2 * 10

      // V20 pricing rules
      expect(calculateUpgradeCost(2, 'attribute', 'storyteller-v20')).toBe(8); // 2 * 4
      expect(calculateUpgradeCost(0, 'skill', 'storyteller-v20')).toBe(3); // 0->1 = 3
      expect(calculateUpgradeCost(2, 'skill', 'storyteller-v20')).toBe(4); // 2 * 2
      expect(calculateUpgradeCost(0, 'discipline', 'storyteller-v20')).toBe(10); // 0->1 = 10
      expect(calculateUpgradeCost(2, 'discipline', 'storyteller-v20', { disciplineAffinity: 'discipline_clan' })).toBe(10); // 2 * 5
      expect(calculateUpgradeCost(2, 'discipline', 'storyteller-v20', { disciplineAffinity: 'discipline_caitiff' })).toBe(12); // 2 * 6
      expect(calculateUpgradeCost(2, 'discipline', 'storyteller-v20', { disciplineAffinity: 'discipline_out_of_clan', isOutOfClan: true })).toBe(14); // 2 * 7
      expect(calculateUpgradeCost(3, 'virtue', 'storyteller-v20', { virtueSubtype: 'virtue' })).toBe(6); // 3 * 2
      expect(calculateUpgradeCost(7, 'virtue', 'storyteller-v20', { virtueSubtype: 'humanity' })).toBe(14); // 7 * 2
      expect(calculateUpgradeCost(5, 'virtue', 'storyteller-v20', { virtueSubtype: 'willpower' })).toBe(5); // 5 * 1

      // V5 derived Health/Willpower sync + Undo + manual override preservation
      let v5 = createWorldOfDarknessV5Sheet();
      v5 = { ...v5, id: 'sheet_xp_v5_rules' };
      resetXpPricingConfig(v5);
      v5 = awardXp(v5, 100, 'Session XP', '2026-11-24T00:00:00Z', 'aw_1').sheet;
      v5 = adjustV5HealthDamage(v5, 'f_health', 'superficial', 2);

      // Override Stamina cost to 7 XP manually and verify upgradeTraitWithXp uses 7 XP
      setTraitCustomCostOverride(v5, 'f_stamina', 7);
      const stamUp = upgradeTraitWithXp(v5, 'f_stamina', '2026-11-24T00:01:00Z', 'up_stam');
      expect(stamUp.ok).toBe(true);
      expect(stamUp.trait?.cost).toBe(7);
      expect(stamUp.sheet.xp?.spent).toBe(7);
      const hpAfterUp = stamUp.sheet.cards.flatMap((c) => c.fields).find((f) => f.id === 'f_health');
      expect(hpAfterUp?.max).toBe(7); // Stamina 4 + 3
      expect(hpAfterUp?.superficialDamage).toBe(2);

      const stamUndo = undoLastUpgrade(stamUp.sheet);
      expect(stamUndo.ok).toBe(true);
      expect(stamUndo.sheet.xp?.spent).toBe(0);
      const hpAfterUndo = stamUndo.sheet.cards.flatMap((c) => c.fields).find((f) => f.id === 'f_health');
      expect(hpAfterUndo?.max).toBe(6); // Stamina 3 + 3
      expect(hpAfterUndo?.superficialDamage).toBe(2);
      resetXpPricingConfig(v5);

      // 0->1 Advantage acquisition creates card_backgrounds + field, and Undo removes both cleanly
      const cardsBefore = v5.cards.length;
      const buyAdv = buyCatalogAdvantageWithXp(v5, 'contacts', '2026-11-24T00:02:00Z', 'up_adv');
      expect(buyAdv.ok).toBe(true);
      expect(buyAdv.cost).toBe(3);
      expect(buyAdv.sheet.cards.some((c) => c.id === 'card_backgrounds')).toBe(true);
      const undoAdv = undoLastUpgrade(buyAdv.sheet);
      expect(undoAdv.ok).toBe(true);
      expect(undoAdv.sheet.cards.length).toBe(cardsBefore);
      expect(undoAdv.sheet.cards.some((c) => c.id === 'card_backgrounds')).toBe(false);

      // 0->1 Skill acquisition creates number+roll pair and Undo removes both
      const fieldCountBefore = v5.cards.flatMap((c) => c.fields).length;
      const buySkill = buyCatalogSkillWithXp(v5, 'drive', '2026-11-24T00:03:00Z', 'up_skill');
      expect(buySkill.ok).toBe(true);
      expect(buySkill.cost).toBe(3);
      expect(buySkill.sheet.cards.flatMap((c) => c.fields).length).toBe(fieldCountBefore + 2);
      const undoSkill = undoLastUpgrade(buySkill.sheet);
      expect(undoSkill.ok).toBe(true);
      expect(undoSkill.sheet.cards.flatMap((c) => c.fields).length).toBe(fieldCountBefore);

      // 0->1 Discipline acquisition and Undo
      const buyDisc = buyCatalogDisciplineWithXp(v5, 'protean', '2026-11-24T00:04:00Z', 'up_disc');
      expect(buyDisc.ok).toBe(true);
      expect(buyDisc.sheet.cards.flatMap((c) => c.fields).length).toBe(fieldCountBefore + 1);
      const undoDisc = undoLastUpgrade(buyDisc.sheet);
      expect(undoDisc.ok).toBe(true);
      expect(undoDisc.sheet.cards.flatMap((c) => c.fields).length).toBe(fieldCountBefore);
    });
  });

  describe('4. WoD Creation Wizard & Schema v2 Integrity (wodCreationWizard.ts)', () => {
    it('builds valid V5 and V20 sheets passing schema.v2.json with zero Haven/Merit duplication', () => {
      const validateAjv = compileSchemaV2Validator();

      // Strict V5 wizard state
      let v5State: WodCreationWizardState = createInitialWodWizardState('vampire-v5');
      v5State = setWizardClan(v5State, 'ventrue');
      v5State = {
        ...v5State,
        name: 'Clara Moretti',
        concept: 'Financier',
        sire: 'Lorenzo',
        chronicle: 'Milan by Night',
        predatorTypeId: 'siren',
        ambition: 'Hold the Board',
        desire: 'Turn a rival',
      };
      const v5Attrs: Record<string, number> = {
        strength: 1,
        dexterity: 2,
        stamina: 3,
        charisma: 4,
        manipulation: 3,
        composure: 3,
        intelligence: 2,
        wits: 2,
        resolve: 2,
      };
      for (const [k, v] of Object.entries(v5Attrs)) {
        v5State = setWizardAttribute(v5State, k, v);
      }
      const v5Skills: Record<string, number> = {
        athletics: 1,
        brawl: 1,
        stealth: 2,
        etiquette: 3,
        insight: 2,
        intimidation: 2,
        leadership: 2,
        persuasion: 3,
        subterfuge: 3,
        academics: 1,
        finance: 2,
        investigation: 1,
        occult: 1,
        politics: 1,
        technology: 1,
      };
      for (const [k, v] of Object.entries(v5Skills)) {
        v5State = setWizardSkill(v5State, k, v);
      }
      v5State = setWizardSkillSpecialty(v5State, 'academics', 'Economics');
      v5State = setWizardDiscipline(v5State, 'dominate', 2);
      v5State = setWizardDiscipline(v5State, 'presence', 1);
      v5State = toggleWizardDisciplinePower(v5State, 'dominate', 'v5_dominate_compel');
      v5State = toggleWizardDisciplinePower(v5State, 'dominate', 'v5_dominate_mesmerize');
      v5State = toggleWizardDisciplinePower(v5State, 'presence', 'v5_presence_awe');
      v5State = setWizardBackground(v5State, 'resources', 3);
      v5State = setWizardBackground(v5State, 'contacts', 2);
      v5State = {
        ...v5State,
        meritsFlaws: [
          { id: 'mf_v5_1', kind: 'flaw', name: 'Known Corpse', rating: 2, catalogId: 'known_corpse' },
        ],
        haven: {
          name: 'Penthouse Vault',
          location: 'Brera',
          rating: 2,
          traits: ['luxury'],
          notes: '',
        },
        touchstones: [
          { id: 'ts_v5_1', conviction: 'Protect family', touchstone: 'Elena Moretti' },
        ],
      };

      expect(canCompleteWizard(v5State)).toBe(true);
      const v5Sheet = buildSheetFromWodWizard(v5State, 'pt-BR');
      expect(validateAjv(v5Sheet)).toBe(true);
      expect(validateSheetPayload(v5Sheet).valid).toBe(true);
      expect(v5Sheet.havens).toHaveLength(1);
      expect(v5Sheet.touchstones).toHaveLength(1);
      expect(v5Sheet.meritsFlaws).toHaveLength(1);
      const v5BgFields = v5Sheet.cards.find((c) => c.id === 'card_backgrounds')?.fields ?? [];
      expect(v5BgFields.some((f) => f.key === 'haven' || f.id === 'f_haven')).toBe(false);

      // Strict V20 wizard state
      let v20State: WodCreationWizardState = createInitialWodWizardState('storyteller-v20');
      v20State = setWizardClan(v20State, 'tremere');
      v20State = {
        ...v20State,
        name: 'Viktor Kael',
        concept: 'Occultist',
        sire: 'Aurelia',
        chronicle: 'Vienna Nocturne',
        nature: 'Architect',
        demeanor: 'Scholar',
        generation: 10,
      };
      v20State = assignV20AttributePriority(v20State, 'mental', 'primary');
      v20State = assignV20AttributePriority(v20State, 'social', 'secondary');
      v20State = assignV20AttributePriority(v20State, 'physical', 'tertiary');
      const v20Attrs: Record<string, number> = {
        strength: 2,
        dexterity: 2,
        stamina: 2,
        charisma: 3,
        manipulation: 3,
        appearance: 2,
        perception: 3,
        intelligence: 4,
        wits: 3,
      };
      for (const [k, v] of Object.entries(v20Attrs)) {
        v20State = setWizardAttribute(v20State, k, v);
      }
      v20State = assignV20SkillPriority(v20State, 'knowledges', 'primary');
      v20State = assignV20SkillPriority(v20State, 'talents', 'secondary');
      v20State = assignV20SkillPriority(v20State, 'skills', 'tertiary');
      const v20Skills: Record<string, number> = {
        academics: 3,
        investigation: 3,
        medicine: 2,
        occult: 3,
        politics: 2,
        alertness: 2,
        awareness: 2,
        empathy: 2,
        subterfuge: 3,
        etiquette: 2,
        firearms: 1,
        stealth: 2,
      };
      for (const [k, v] of Object.entries(v20Skills)) {
        v20State = setWizardSkill(v20State, k, v);
      }
      v20State = setWizardDiscipline(v20State, 'thaumaturgy', 2);
      v20State = setWizardDiscipline(v20State, 'auspex', 1);
      v20State = toggleWizardDisciplinePower(v20State, 'thaumaturgy', 'v20_thaum_taste_blood');
      v20State = setWizardBackground(v20State, 'mentor', 3);
      v20State = setWizardBackground(v20State, 'resources', 2);
      v20State = {
        ...v20State,
        virtues: { conscience: 3, selfControl: 4, courage: 3 },
        meritsFlaws: [{ id: 'mf_v20_1', kind: 'merit', name: 'Iron Will', rating: 3 }],
        haven: {
          name: 'Chantry Study',
          location: 'Inner Stadt',
          rating: 2,
          traits: ['library'],
          notes: '',
        },
      };

      expect(canCompleteWizard(v20State)).toBe(true);
      const v20Sheet = buildSheetFromWodWizard(v20State, 'en');
      expect(validateAjv(v20Sheet)).toBe(true);
      expect(validateSheetPayload(v20Sheet).valid).toBe(true);
      expect(v20Sheet.touchstones).toBeUndefined();
      expect(v20Sheet.havens).toHaveLength(1);
      expect(v20Sheet.meritsFlaws).toHaveLength(1);
      const v20BgFields = v20Sheet.cards.find((c) => c.id === 'card_backgrounds')?.fields ?? [];
      expect(v20BgFields.some((f) => f.key === 'haven' || f.id === 'f_haven')).toBe(false);
    });
  });
});
