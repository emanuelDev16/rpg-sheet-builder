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
  assert.equal(poolRes.isFumble, false);
  assert.equal(poolRes.resolvedExpression, '5d10 (DIFF 6)');
  assert.match(poolRes.breakdown, /2 SUCESSOS/);

  // Botch: 0 successes + at least one '1'
  const botchSeq = [0.02, 0.25, 0.45];
  let bIdx = 0;
  const botchRes = rollDiceExpression('3d10@6', {}, () => botchSeq[bIdx++]);
  assert.equal(botchRes.ok, true);
  assert.equal(botchRes.isFumble, true);
  assert.equal(botchRes.total, 0);
  assert.match(botchRes.breakdown, /BOTCH!/);
});
