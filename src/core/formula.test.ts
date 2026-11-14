import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateFormula, rollDiceExpression } from './formula';

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

