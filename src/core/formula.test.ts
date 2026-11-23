import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeRemainingDamageAfterSoak,
  evaluateFormula,
  evaluateV5Rolls,
  executeRemorseCheck,
  executeRouseCheck,
  getV5BloodPotencyStats,
  getV5BloodSurgeBonus,
  rerollV5PoolDice,
  resolveFrenzyRoll,
  rollDiceExpression,
} from './formula';

test('evaluateFormula calculates D20 attribute modifiers accurately', () => {
  const res14 = evaluateFormula('floor((forca - 10) / 2)', { forca: 14 }, true);
  assert.equal(res14.ok, true);
  assert.equal(res14.value, 2);
  assert.equal(res14.formatted, '+2');

  const res8 = evaluateFormula('floor((forca - 10) / 2)', { forca: 8 }, true);
  assert.equal(res8.ok, true);
  assert.equal(res8.value, -1);
  assert.equal(res8.formatted, '-1');
});

test('evaluateFormula reports clear error for undefined variables or bad syntax', () => {
  const missing = evaluateFormula('forca + desconhecido', { forca: 12 });
  assert.equal(missing.ok, false);
  assert.equal(missing.formatted, 'ERR');
  assert.match(missing.error ?? '', /desconhecido/);

  const divZero = evaluateFormula('10 / 0', {});
  assert.equal(divZero.ok, false);
});

test('rollDiceExpression rolls deterministic dice with variable substitution', () => {
  const res = rollDiceExpression('1d20 + mod_forca', { mod_forca: 3 }, () => 0.5);
  assert.equal(res.ok, true);
  assert.deepEqual(res.rolls, [11]);
  assert.equal(res.total, 14);
  assert.equal(res.resolvedExpression, '1d20 + 3');
  assert.equal(res.breakdown, '1d20[11] → 11 + 3');
});

test('rollDiceExpression detects natural 20 critical and natural 1 fumble on 1d20', () => {
  const crit = rollDiceExpression('1d20 + 2', {}, () => 0.99);
  assert.equal(crit.rolls[0], 20);
  assert.equal(crit.isCritical, true);
  assert.equal(crit.isFumble, false);

  const fumble = rollDiceExpression('1d20 + 2', {}, () => 0.0);
  assert.equal(fumble.rolls[0], 1);
  assert.equal(fumble.isFumble, true);
  assert.equal(fumble.isCritical, false);
});

test('rollDiceExpression evaluates World of Darkness d10 pools and counts successes/botches', () => {
  // Sequence: 9, 6, 1, 8, 4 -> 3 successes (>=6), 1 one -> net 2 successes
  const seq = [0.85, 0.55, 0.01, 0.75, 0.35];
  let idx = 0;
  const poolRes = rollDiceExpression(
    'pool(strength + brawl, 6)',
    { strength: 3, brawl: 2 },
    () => seq[idx++],
  );
  assert.equal(poolRes.ok, true);
  assert.equal(poolRes.isPoolRoll, true);
  assert.deepEqual(poolRes.rolls, [9, 6, 1, 8, 4]);
  assert.equal(poolRes.total, 2);
  assert.equal(poolRes.outcome, 'success');
  assert.equal(poolRes.isFumble, false);
  assert.equal(poolRes.resolvedExpression, '5d10 (DIFF 6)');
  assert.match(poolRes.breakdown, /2 SUCESSOS/);

  // Botch: 0 dice >= Target Number and at least one '1', Willpower not used
  const botchSeq = [0.02, 0.25, 0.45];
  let bIdx = 0;
  const botchRes = rollDiceExpression('3d10@6', {}, () => botchSeq[bIdx++]);
  assert.equal(botchRes.ok, true);
  assert.equal(botchRes.isFumble, true);
  assert.equal(botchRes.outcome, 'botch');
  assert.equal(botchRes.total, 0);
  assert.match(botchRes.breakdown, /BOTCH!/);
});

test('WoD Storyteller engine handles Specialty (10=+2), 1s clamping before Willpower, Simple Failure vs Botch, and Soak immunity to Botch', () => {
  // 1) Specialty doubles 10s, Target Number overrides formula difficulty, modifier changes pool size
  // Rolls: 10 (+2), 8 (+1 at Diff 8), 5 (miss), 1 (-1) => raw 3 - 1 = 2 successes
  const specSeq = [0.95, 0.75, 0.45, 0.05];
  let sIdx = 0;
  const specRes = rollDiceExpression(
    'pool(dexterity + firearms, 6)',
    { dexterity: 2, firearms: 1 },
    () => specSeq[sIdx++],
    { difficulty: 8, specialty: true, modifier: 1 },
  );
  assert.equal(specRes.ok, true);
  assert.deepEqual(specRes.rolls, [10, 8, 5, 1]);
  assert.equal(specRes.difficulty, 8);
  assert.equal(specRes.doubledTensCount, 1);
  assert.equal(specRes.canceledOnes, 1);
  assert.equal(specRes.total, 2);
  assert.equal(specRes.outcome, 'success');

  // 2) Simple Failure: rolled a 9 (>=6) canceled by two 1s -> 0 total, NOT a botch because a die met Target Number
  const simpleFailSeq = [0.85, 0.02, 0.05];
  let sfIdx = 0;
  const simpleFail = rollDiceExpression('3d10@6', {}, () => simpleFailSeq[sfIdx++]);
  assert.deepEqual(simpleFail.rolls, [9, 1, 1]);
  assert.equal(simpleFail.total, 0);
  assert.equal(simpleFail.isFumble, false);
  assert.equal(simpleFail.outcome, 'failure');

  // 3) Willpower (+1 Auto Success) applies AFTER 1s cancellation clamped at 0, immune to 1s, and prevents Botch
  // Rolls: [4, 2, 1] at Diff 6 -> dice raw=0, canceled by 1 -> clamped 0 -> +1 Willpower = 1 Success (no Botch!)
  const wpSaveSeq = [0.35, 0.15, 0.01];
  let wIdx = 0;
  const wpSaved = rollDiceExpression(
    'pool(manipulation + subterfuge, 6)',
    { manipulation: 1, subterfuge: 2 },
    () => wpSaveSeq[wIdx++],
    { willpowerAutoSuccess: true },
  );
  assert.deepEqual(wpSaved.rolls, [4, 2, 1]);
  assert.equal(wpSaved.total, 1);
  assert.equal(wpSaved.willpowerUsed, true);
  assert.equal(wpSaved.isFumble, false);
  assert.equal(wpSaved.outcome, 'success');

  // 4) Even if a roll has [8, 1, 1] (+1 from 8, -2 from 1s -> clamped to 0), Willpower STILL yields 1 total (not 0)
  const clampSeq = [0.75, 0.01, 0.02];
  let cIdx = 0;
  const wpClamped = rollDiceExpression(
    '3d10@6',
    {},
    () => clampSeq[cIdx++],
    { willpowerAutoSuccess: true },
  );
  assert.deepEqual(wpClamped.rolls, [8, 1, 1]);
  assert.equal(wpClamped.total, 1);
  assert.equal(wpClamped.canceledOnes, 1);
  assert.equal(wpClamped.outcome, 'success');

  // 5) Soak roll: Stamina + Fortitude/Armor against Difficulty, never Botches even on all 1s
  const soakSeq = [0.01, 0.05, 0.25];
  let skIdx = 0;
  const soakFail = rollDiceExpression(
    'pool(stamina + fortitude_armor, 6)',
    { stamina: 2, fortitude_armor: 1 },
    () => soakSeq[skIdx++],
    { difficulty: 6, isSoak: true },
  );
  assert.deepEqual(soakFail.rolls, [1, 1, 3]);
  assert.equal(soakFail.total, 0);
  assert.equal(soakFail.isFumble, false);
  assert.equal(soakFail.outcome, 'failure');
  assert.equal(soakFail.isSoak, true);
});

test('V20 Aggravated Soak excludes Stamina and blocks Willpower, Bashing Soak halves remaining, and Wound Penalty respects exemption', () => {
  // Aggravated soak: Stamina=3 is zeroed, Fortitude/Armor=2 stays -> 2d10, WP blocked even when requested
  const aggSeq = [0.75, 0.85];
  let aIdx = 0;
  const aggSoak = rollDiceExpression(
    'pool(stamina + fortitude_armor, 6)',
    { stamina: 3, fortitude_armor: 2 },
    () => aggSeq[aIdx++],
    {
      rulePreset: 'storyteller-v20',
      isSoak: true,
      soakDamageType: 'aggravated',
      willpowerAutoSuccess: true,
      woundPenalty: -5,
    },
  );
  assert.equal(aggSoak.rolls.length, 2);
  assert.deepEqual(aggSoak.rolls, [8, 9]);
  assert.equal(aggSoak.willpowerUsed, false);
  assert.equal(aggSoak.soakDamageType, 'aggravated');
  assert.equal(aggSoak.woundPenalty, undefined);
  assert.equal(aggSoak.total, 2);

  // Bashing soak post-soak halving (floor((incoming - soaked) / 2)) vs Lethal full remaining
  assert.equal(computeRemainingDamageAfterSoak(7, 2, 'bashing'), 2);
  assert.equal(computeRemainingDamageAfterSoak(7, 2, 'lethal'), 5);
  assert.equal(computeRemainingDamageAfterSoak(3, 5, 'bashing'), 0);

  // Normal skill pool applies woundPenalty (-2 -> 5-2 = 3 dice)
  const wSeq = [0.65, 0.75, 0.85];
  let wIdx = 0;
  const woundedRoll = rollDiceExpression(
    'pool(strength + brawl, 6)',
    { strength: 3, brawl: 2 },
    () => wSeq[wIdx++],
    { rulePreset: 'storyteller-v20', woundPenalty: -2 },
  );
  assert.equal(woundedRoll.rolls.length, 3);
  assert.equal(woundedRoll.woundPenalty, -2);
  assert.equal(woundedRoll.total, 3);

  // Wound-exempt roll keeps full pool (5 dice)
  const exSeq = [0.65, 0.65, 0.65, 0.65, 0.65];
  let exIdx = 0;
  const exemptRoll = rollDiceExpression(
    'pool(strength + brawl, 6)',
    { strength: 3, brawl: 2 },
    () => exSeq[exIdx++],
    { rulePreset: 'storyteller-v20', woundPenalty: -2, isWoundExempt: true },
  );
  assert.equal(exemptRoll.rolls.length, 5);
  assert.equal(exemptRoll.woundPenalty, undefined);
});

test('V5 pool evaluates fixed >=6 per die against Target Successes (1-10), disables 1s cancellation, gates Critical/Messy Critical on total >= diff, detects Failure & Bestial Failure, Rouse Check & WP Reroll', () => {
  // 1) Messy Critical: 2 tens (1 normal 10, 1 hunger 10) + 1 seven + 1 one = 5 successes vs diff 5 -> messy_critical (margin 0)
  // Also verifies 1s NEVER cancel successes in V5
  const v5CritSeq = [0.95, 0.01, 0.65, 0.95]; // normal: [10, 1, 7], hunger: [10]
  let cIdx = 0;
  const v5Crit = rollDiceExpression(
    'pool(strength + brawl, 6)',
    { strength: 2, brawl: 2, hunger: 1 },
    () => v5CritSeq[cIdx++],
    { rulePreset: 'vampire-v5', difficulty: 5, hungerDice: 1 },
  );
  assert.equal(v5Crit.difficulty, 5);
  assert.equal(v5Crit.canceledOnes, 0);
  assert.equal(v5Crit.critPairsCount, 1);
  assert.equal(v5Crit.total, 5); // 10 (1) + 7 (1) + 10 (1) + pair bonus (+2) = 5
  assert.equal(v5Crit.margin, 0);
  assert.equal(v5Crit.status, 'messy_critical');
  assert.equal(v5Crit.outcome, 'success');
  assert.deepEqual(v5Crit.hungerRolls, [10]);
  assert.equal(v5Crit.isCritical, true);
  assert.equal(v5Crit.messyCritical, true);
  assert.equal(v5Crit.bestialFailure, false);

  // 2) V5 Failure with positive successes: 3 successes vs Difficulty 6 -> FAILURE (not success!), margin -3
  const v5Fail3vs6 = evaluateV5Rolls([6, 7, 8, 2, 3], 1, 6); // normal [6,7,8,2], hunger [3] -> 3 successes
  assert.equal(v5Fail3vs6.total, 3);
  assert.equal(v5Fail3vs6.difficulty, 6);
  assert.equal(v5Fail3vs6.margin, -3);
  assert.equal(v5Fail3vs6.status, 'failure');
  assert.equal(v5Fail3vs6.outcome, 'failure');
  assert.equal(v5Fail3vs6.bestialFailure, false);
  assert.equal(v5Fail3vs6.isCritical, false);

  // 3) V5 Bestial Failure with positive successes: 3 successes vs Difficulty 6 + Hunger die 1 -> BESTIAL FAILURE!
  const v5Bestial3vs6 = evaluateV5Rolls([6, 7, 8, 2, 1], 1, 6); // normal [6,7,8,2], hunger [1] -> 3 successes < 6
  assert.equal(v5Bestial3vs6.total, 3);
  assert.equal(v5Bestial3vs6.difficulty, 6);
  assert.equal(v5Bestial3vs6.margin, -3);
  assert.equal(v5Bestial3vs6.status, 'bestial_failure');
  assert.equal(v5Bestial3vs6.bestialFailure, true);
  assert.equal(v5Bestial3vs6.outcome, 'botch');

  // 4) V5 Pair of 10s (4 successes, including Hunger 10) vs Difficulty 6 -> FAILURE (NO Critical / NO Messy Critical!)
  const v5PairFail = evaluateV5Rolls([10, 2, 3, 10], 1, 6); // 1 pair of 10s = 4 successes < 6
  assert.equal(v5PairFail.total, 4);
  assert.equal(v5PairFail.critPairsCount, 1);
  assert.equal(v5PairFail.difficulty, 6);
  assert.equal(v5PairFail.margin, -2);
  assert.equal(v5PairFail.status, 'failure');
  assert.equal(v5PairFail.outcome, 'failure');
  assert.equal(v5PairFail.isCritical, false);
  assert.equal(v5PairFail.messyCritical, false);

  // 5) V5 Exact Success: 6 successes vs Difficulty 6 -> SUCCESS (margin 0)
  const v5Exact6vs6 = evaluateV5Rolls([6, 6, 7, 8, 9, 6], 1, 6);
  assert.equal(v5Exact6vs6.total, 6);
  assert.equal(v5Exact6vs6.difficulty, 6);
  assert.equal(v5Exact6vs6.margin, 0);
  assert.equal(v5Exact6vs6.status, 'success');
  assert.equal(v5Exact6vs6.outcome, 'success');
  assert.equal(v5Exact6vs6.bestialFailure, false);

  // 6) V5 Bestial Failure at 0 successes (classic case)
  const bestialEval = evaluateV5Rolls([4, 3, 1], 1, 2);
  assert.equal(bestialEval.total, 0);
  assert.equal(bestialEval.status, 'bestial_failure');
  assert.equal(bestialEval.bestialFailure, true);
  assert.equal(bestialEval.outcome, 'botch');

  // 7) Blood Surge bonus scales by Blood Potency
  assert.equal(getV5BloodSurgeBonus(1), 2);
  assert.equal(getV5BloodSurgeBonus(3), 3);
  assert.equal(getV5BloodSurgeBonus(5), 4);
  const surgeRoll = rollDiceExpression(
    'pool(strength + brawl, 6)',
    { strength: 2, brawl: 1, blood_potency: 3, hunger: 1 },
    () => 0.65,
    { rulePreset: 'vampire-v5', difficulty: 2, bloodSurge: true },
  );
  assert.equal(surgeRoll.rolls.length, 6); // 3 base + 3 blood surge
  assert.equal(surgeRoll.isBloodSurge, true);
  assert.equal(surgeRoll.status, 'success');
  assert.equal(surgeRoll.margin, 4);

  // 8) Rouse Check: >=6 passes (hungerDelta 0), <=5 fails (hungerDelta +1)
  const rousePass = executeRouseCheck(() => 0.55); // 6
  assert.deepEqual(rousePass.rolls, [6]);
  assert.equal(rousePass.hungerDelta, 0);
  assert.equal(rousePass.outcome, 'success');

  const rouseFail = executeRouseCheck(() => 0.45); // 5
  assert.deepEqual(rouseFail.rolls, [5]);
  assert.equal(rouseFail.hungerDelta, 1);
  assert.equal(rouseFail.outcome, 'failure');

  // 9) Willpower Reroll preserves difficulty (Target Successes) & blocks Hunger die index (index 3)
  const prevRolls = [2, 3, 4, 1]; // 3 normal dice (indices 0,1,2) + 1 Hunger die (index 3)
  let rIdx = 0;
  const rerollSeq = [0.95, 0.95, 0.65]; // 10, 10, 7 -> 5 successes
  const rerolledFailVs6 = rerollV5PoolDice(prevRolls, 1, [0, 1, 2, 3], () => rerollSeq[rIdx++], {
    difficulty: 6,
  });
  assert.deepEqual(rerolledFailVs6.rerolledIndices, [0, 1, 2]);
  assert.deepEqual(rerolledFailVs6.rolls, [10, 10, 7, 1]);
  assert.equal(rerolledFailVs6.difficulty, 6);
  assert.equal(rerolledFailVs6.critPairsCount, 1);
  assert.equal(rerolledFailVs6.total, 5);
  assert.equal(rerolledFailVs6.margin, -1);
  assert.equal(rerolledFailVs6.status, 'bestial_failure'); // 5 < 6 and Hunger die is 1!
  assert.equal(rerolledFailVs6.isCritical, false);
  assert.equal(rerolledFailVs6.messyCritical, false);
  assert.equal(rerolledFailVs6.bestialFailure, true);
  assert.equal(rerolledFailVs6.isWillpowerReroll, true);

  let rIdx2 = 0;
  const rerollSeq2 = [0.95, 0.95, 0.65]; // 10, 10, 7 -> 5 successes vs diff 2 -> critical!
  const rerolledPassVs2 = rerollV5PoolDice(prevRolls, 1, [0, 1, 2, 3], () => rerollSeq2[rIdx2++], {
    difficulty: 2,
  });
  assert.equal(rerolledPassVs2.total, 5);
  assert.equal(rerolledPassVs2.margin, 3);
  assert.equal(rerolledPassVs2.status, 'critical');
  assert.equal(rerolledPassVs2.isCritical, true);
  assert.equal(rerolledPassVs2.messyCritical, false); // 10s are on normal dice, Hunger die is 1
  assert.equal(rerolledPassVs2.bestialFailure, false);
});

test('V20 regression: 3 successes vs Difficulty 6 remains SUCCESS (100% isolated from V5)', () => {
  const v20Seq = [0.55, 0.65, 0.75, 0.25, 0.35]; // [6, 7, 8, 3, 4] -> 3 successes at Diff 6
  let idx = 0;
  const res = rollDiceExpression(
    'pool(strength + brawl, 6)',
    { strength: 3, brawl: 2 },
    () => v20Seq[idx++],
    { rulePreset: 'storyteller-v20', difficulty: 6 },
  );
  assert.equal(res.ok, true);
  assert.equal(res.difficulty, 6);
  assert.equal(res.total, 3);
  assert.equal(res.outcome, 'success');
  assert.equal(res.isFumble, false);
});

test('getV5BloodPotencyStats covers levels 0..10 with clamping and matches getV5BloodSurgeBonus', () => {
  const expected = [
    { level: 0, bloodSurgeDice: 1, mendSuperficialPerRouse: 1, powerBonusDice: 0, rouseRerollMaxLevel: 0, baneSeverity: 0, feedingPenaltyKey: '0' },
    { level: 1, bloodSurgeDice: 2, mendSuperficialPerRouse: 1, powerBonusDice: 0, rouseRerollMaxLevel: 1, baneSeverity: 2, feedingPenaltyKey: '1' },
    { level: 2, bloodSurgeDice: 2, mendSuperficialPerRouse: 2, powerBonusDice: 1, rouseRerollMaxLevel: 1, baneSeverity: 2, feedingPenaltyKey: '2' },
    { level: 3, bloodSurgeDice: 3, mendSuperficialPerRouse: 2, powerBonusDice: 1, rouseRerollMaxLevel: 2, baneSeverity: 3, feedingPenaltyKey: '3' },
    { level: 4, bloodSurgeDice: 3, mendSuperficialPerRouse: 3, powerBonusDice: 2, rouseRerollMaxLevel: 2, baneSeverity: 3, feedingPenaltyKey: '4' },
    { level: 5, bloodSurgeDice: 4, mendSuperficialPerRouse: 3, powerBonusDice: 2, rouseRerollMaxLevel: 3, baneSeverity: 4, feedingPenaltyKey: '5+' },
    { level: 6, bloodSurgeDice: 4, mendSuperficialPerRouse: 3, powerBonusDice: 3, rouseRerollMaxLevel: 3, baneSeverity: 4, feedingPenaltyKey: '5+' },
    { level: 7, bloodSurgeDice: 5, mendSuperficialPerRouse: 4, powerBonusDice: 3, rouseRerollMaxLevel: 4, baneSeverity: 5, feedingPenaltyKey: '5+' },
    { level: 8, bloodSurgeDice: 5, mendSuperficialPerRouse: 4, powerBonusDice: 4, rouseRerollMaxLevel: 4, baneSeverity: 5, feedingPenaltyKey: '5+' },
    { level: 9, bloodSurgeDice: 6, mendSuperficialPerRouse: 5, powerBonusDice: 4, rouseRerollMaxLevel: 5, baneSeverity: 6, feedingPenaltyKey: '5+' },
    { level: 10, bloodSurgeDice: 6, mendSuperficialPerRouse: 5, powerBonusDice: 5, rouseRerollMaxLevel: 5, baneSeverity: 6, feedingPenaltyKey: '5+' },
  ] as const;

  for (const row of expected) {
    assert.deepEqual(getV5BloodPotencyStats(row.level), row);
    assert.equal(getV5BloodSurgeBonus(row.level), row.bloodSurgeDice);
  }
  assert.deepEqual(getV5BloodPotencyStats(-3), expected[0]);
  assert.deepEqual(getV5BloodPotencyStats(14), expected[10]);
  assert.deepEqual(getV5BloodPotencyStats(Number.NaN), expected[0]);
  assert.equal(getV5BloodSurgeBonus(undefined), 2);
});

test('executeRemorseCheck handles pass, fail, minimum 1 die, and humanity 0 floor', () => {
  // Humanity 6, Stains 2 -> 2d10; [7, 2] -> 1 success -> pass, stains cleared, humanity stays 6
  const seqPass = [0.65, 0.15];
  let idxPass = 0;
  const passRes = executeRemorseCheck(6, 2, () => seqPass[idxPass++]);
  assert.equal(passRes.pool, 2);
  assert.deepEqual(passRes.dice, [7, 2]);
  assert.equal(passRes.successes, 1);
  assert.equal(passRes.passed, true);
  assert.equal(passRes.nextHumanity, 6);
  assert.equal(passRes.nextStains, 0);

  // Humanity 7, Stains 1 -> 2d10; [4, 5] -> 0 successes -> fail, humanity drops 7 -> 6, stains cleared
  const seqFail = [0.35, 0.45];
  let idxFail = 0;
  const failRes = executeRemorseCheck(7, 1, () => seqFail[idxFail++]);
  assert.equal(failRes.pool, 2);
  assert.equal(failRes.successes, 0);
  assert.equal(failRes.passed, false);
  assert.equal(failRes.nextHumanity, 6);
  assert.equal(failRes.nextStains, 0);

  // Minimum 1 die when humanity + stains >= 10
  const minPoolPass = executeRemorseCheck(8, 2, () => 0.75);
  assert.equal(minPoolPass.pool, 1);
  assert.deepEqual(minPoolPass.dice, [8]);
  assert.equal(minPoolPass.passed, true);

  const minPoolOverflow = executeRemorseCheck(9, 2, () => 0.15);
  assert.equal(minPoolOverflow.pool, 1);
  assert.equal(minPoolOverflow.passed, false);
  assert.equal(minPoolOverflow.nextHumanity, 8);

  // Humanity cannot drop below 0
  const floorZero = executeRemorseCheck(0, 10, () => 0.05);
  assert.equal(floorZero.pool, 1);
  assert.equal(floorZero.passed, false);
  assert.equal(floorZero.nextHumanity, 0);
  assert.equal(floorZero.nextStains, 0);
});

test('resolveFrenzyRoll computes V5 and V20 pools exempt from wounds and Hunger dice', () => {
  // V5: Composure 3 + Resolve 2 = max WP 5, 2 superficial damage -> 3 WP free; Humanity 7 -> floor(7/3)=2 -> 5d10
  // Health fully damaged (impaired -2) and Hunger 4 MUST be ignored
  const v5Sheet = {
    rulePreset: 'vampire-v5' as const,
    cards: [
      {
        fields: [
          { id: 'f_composure', key: 'composure', kind: 'number', value: 3 },
          { id: 'f_resolve', key: 'resolve', kind: 'number', value: 2 },
          { id: 'f_health', key: 'health', kind: 'resource', value: 0, max: 6, superficialDamage: 6, aggravatedDamage: 0 },
          { id: 'f_willpower', key: 'willpower', kind: 'resource', value: 3, max: 5, superficialDamage: 2, aggravatedDamage: 0 },
          { id: 'f_hunger', key: 'hunger', kind: 'resource', value: 4, max: 5 },
          { id: 'f_humanity', key: 'humanity', kind: 'resource', value: 7, max: 10 },
        ],
      },
    ],
  };

  const v5Seq = [0.65, 0.75, 0.85, 0.25, 0.35]; // [7, 8, 9, 3, 4] -> 3 successes vs difficulty 3
  let v5Idx = 0;
  const v5Res = resolveFrenzyRoll(v5Sheet, {
    difficulty: 3,
    kind: 'frenzy',
    rng: () => v5Seq[v5Idx++],
  });
  assert.equal(v5Res.ok, true);
  assert.equal(v5Res.isFrenzyRoll, true);
  assert.equal(v5Res.frenzyKind, 'frenzy');
  assert.equal(v5Res.poolSize, 5);
  assert.equal(v5Res.rolls.length, 5);
  assert.equal(v5Res.hungerDice, 0);
  assert.deepEqual(v5Res.hungerRolls, []);
  assert.equal(v5Res.woundPenalty, undefined);
  assert.equal(v5Res.total, 3);
  assert.equal(v5Res.resisted, true);

  // V5 minimum 1 die when WP free is 0 and Humanity < 3
  const v5MinSheet = {
    rulePreset: 'vampire-v5' as const,
    cards: [
      {
        fields: [
          { id: 'f_composure', key: 'composure', kind: 'number', value: 1 },
          { id: 'f_resolve', key: 'resolve', kind: 'number', value: 1 },
          { id: 'f_willpower', key: 'willpower', kind: 'resource', value: 0, max: 2, superficialDamage: 2, aggravatedDamage: 0 },
          { id: 'f_humanity', key: 'humanity', kind: 'resource', value: 2, max: 10 },
        ],
      },
    ],
  };
  const v5MinRes = resolveFrenzyRoll(v5MinSheet, { difficulty: 2, rng: () => 0.95 });
  assert.equal(v5MinRes.poolSize, 1);
  assert.equal(v5MinRes.rolls.length, 1);
  assert.equal(v5MinRes.resisted, false);

  // V20: Self-Control 3 vs TN 6, and Courage 4 vs TN 7 (Rötschreck) ignoring -5 wound penalty
  const v20Sheet = {
    rulePreset: 'storyteller-v20' as const,
    virtues: { conscience: 3, selfControl: 3, courage: 4 },
    cards: [
      {
        fields: [
          { id: 'f_health', key: 'health', kind: 'resource', value: 1, max: 7, aggravatedDamage: 6 },
        ],
      },
    ],
  };
  const v20Frenzy = resolveFrenzyRoll(v20Sheet, {
    virtue: 'autocontrole',
    difficulty: 6,
    rng: () => 0.65,
  });
  assert.equal(v20Frenzy.frenzyKind, 'frenzy');
  assert.equal(v20Frenzy.virtueUsed, 'selfControl');
  assert.equal(v20Frenzy.poolSize, 3);
  assert.equal(v20Frenzy.rolls.length, 3);
  assert.equal(v20Frenzy.woundPenalty, undefined);
  assert.equal(v20Frenzy.hungerDice, 0);
  assert.equal(v20Frenzy.total, 3);
  assert.equal(v20Frenzy.resisted, true);

  const v20Rotschreck = resolveFrenzyRoll(v20Sheet, {
    virtue: 'coragem',
    difficulty: 7,
    rng: () => 0.55, // rolls 6 < TN 7 -> failure
  });
  assert.equal(v20Rotschreck.frenzyKind, 'rotschreck');
  assert.equal(v20Rotschreck.virtueUsed, 'courage');
  assert.equal(v20Rotschreck.poolSize, 4);
  assert.equal(v20Rotschreck.difficulty, 7);
  assert.equal(v20Rotschreck.total, 0);
  assert.equal(v20Rotschreck.resisted, false);
});



