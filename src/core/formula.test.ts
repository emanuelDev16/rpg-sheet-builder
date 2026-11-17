import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeRemainingDamageAfterSoak,
  evaluateFormula,
  evaluateV5Rolls,
  executeRouseCheck,
  getV5BloodSurgeBonus,
  rerollV5PoolDice,
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

test('V5 pool locks Diff 6, disables 1s cancellation, awards +4 per pair of 10s, tracks Hunger dice, Messy Critical, Bestial Failure, Rouse Check & WP Reroll', () => {
  // 1) Messy Critical: 2 tens (1 normal 10, 1 hunger 10) + 1 fail -> 1 pair = 4 successes, messyCritical=true
  // Also verifies difficulty override (diff 8 ignored -> locked at 6) and 1s do NOT cancel successes
  const v5CritSeq = [0.95, 0.01, 0.65, 0.95]; // normal: [10, 1, 7], hunger: [10]
  let cIdx = 0;
  const v5Crit = rollDiceExpression(
    'pool(strength + brawl, 6)',
    { strength: 2, brawl: 2, hunger: 1 },
    () => v5CritSeq[cIdx++],
    { rulePreset: 'vampire-v5', difficulty: 9, hungerDice: 1 },
  );
  assert.equal(v5Crit.difficulty, 6);
  assert.equal(v5Crit.canceledOnes, 0);
  assert.equal(v5Crit.critPairsCount, 1);
  assert.equal(v5Crit.total, 5); // 10 (1) + 7 (1) + 10 (1) + pair bonus (+2) = 5
  assert.deepEqual(v5Crit.hungerRolls, [10]);
  assert.equal(v5Crit.messyCritical, true);
  assert.equal(v5Crit.bestialFailure, false);

  // 2) Bestial Failure: 0 successes and a 1 on Hunger die
  const bestialEval = evaluateV5Rolls([4, 3, 1], 1);
  assert.equal(bestialEval.total, 0);
  assert.equal(bestialEval.bestialFailure, true);
  assert.equal(bestialEval.outcome, 'botch');

  // 3) Blood Surge bonus scales by Blood Potency
  assert.equal(getV5BloodSurgeBonus(1), 2);
  assert.equal(getV5BloodSurgeBonus(3), 3);
  assert.equal(getV5BloodSurgeBonus(5), 4);
  const surgeRoll = rollDiceExpression(
    'pool(strength + brawl, 6)',
    { strength: 2, brawl: 1, blood_potency: 3, hunger: 1 },
    () => 0.65,
    { rulePreset: 'vampire-v5', bloodSurge: true },
  );
  assert.equal(surgeRoll.rolls.length, 6); // 3 base + 3 blood surge
  assert.equal(surgeRoll.isBloodSurge, true);

  // 4) Rouse Check: >=6 passes (hungerDelta 0), <=5 fails (hungerDelta +1)
  const rousePass = executeRouseCheck(() => 0.55); // 6
  assert.deepEqual(rousePass.rolls, [6]);
  assert.equal(rousePass.hungerDelta, 0);
  assert.equal(rousePass.outcome, 'success');

  const rouseFail = executeRouseCheck(() => 0.45); // 5
  assert.deepEqual(rouseFail.rolls, [5]);
  assert.equal(rouseFail.hungerDelta, 1);
  assert.equal(rouseFail.outcome, 'failure');

  // 5) Willpower Reroll: blocks Hunger die index (index 3), caps at 3 normal dice, re-evaluates total
  const prevRolls = [2, 3, 4, 1]; // 3 normal dice (indices 0,1,2) + 1 Hunger die (index 3)
  let rIdx = 0;
  const rerollSeq = [0.95, 0.95, 0.65]; // 10, 10, 7
  const rerolled = rerollV5PoolDice(prevRolls, 1, [0, 1, 2, 3], () => rerollSeq[rIdx++]);
  assert.deepEqual(rerolled.rerolledIndices, [0, 1, 2]);
  assert.deepEqual(rerolled.rolls, [10, 10, 7, 1]);
  assert.equal(rerolled.critPairsCount, 1);
  assert.equal(rerolled.total, 5);
  assert.equal(rerolled.isWillpowerReroll, true);
  assert.equal(rerolled.messyCritical, false); // 10s are on normal dice, Hunger die is 1
});


