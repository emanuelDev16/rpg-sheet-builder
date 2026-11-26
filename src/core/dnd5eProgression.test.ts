import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { createDefaultDnd5eState } from './dnd5eRules.ts';
import {
  addDnd5eXp,
  applyDnd5eLevelUp,
  computeLevelUpHpGain,
  createDefaultDnd5eProgression,
  DND5E_MAX_PROGRESSION_HISTORY,
  DND5E_XP_THRESHOLDS,
  getDnd5eHitDieAverage,
  getDnd5eXpProgress,
  isStandardAsiLevel,
  logDnd5eSession,
  normalizeDnd5eProgression,
  setDnd5eProgressionMode,
  undoLastDnd5eProgression,
} from './dnd5eProgression.ts';
import { createDnd5ePreset, migrateLegacyDnd5eSheet, validateSheetPayload } from './sheetModel.ts';

function compileSchemaV2() {
  const schemaRaw = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'shared/presets/schema.v2.json'), 'utf8'),
  ) as Record<string, unknown>;
  const AjvCtor = (Ajv2020 as unknown as { default?: typeof Ajv2020 }).default ?? Ajv2020;
  const ajv = new AjvCtor({ allErrors: true, strict: false });
  const applyFormats = (addFormats as unknown as { default?: typeof addFormats }).default ?? addFormats;
  applyFormats(ajv);
  return ajv.compile(schemaRaw);
}

test('DND5E_XP_THRESHOLDS matches official SRD 5.1 levels 1..20 and getDnd5eXpProgress calculates bounds', () => {
  const expected = [
    0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
    85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000,
  ];
  assert.deepEqual([...DND5E_XP_THRESHOLDS], expected);

  const at299 = getDnd5eXpProgress(1, 299);
  assert.deepEqual(at299, {
    currentLevel: 1,
    nextLevel: 2,
    currentThreshold: 0,
    nextThreshold: 300,
    xpToNext: 1,
    progressPercent: 99,
    canLevelUp: false,
  });

  const at300 = getDnd5eXpProgress(1, 300);
  assert.deepEqual(at300, {
    currentLevel: 1,
    nextLevel: 2,
    currentThreshold: 0,
    nextThreshold: 300,
    xpToNext: 0,
    progressPercent: 100,
    canLevelUp: true,
  });

  for (let lvl = 1; lvl < 20; lvl += 1) {
    const justBelow = getDnd5eXpProgress(lvl, expected[lvl] - 1);
    assert.equal(justBelow.canLevelUp, false);
    assert.equal(justBelow.xpToNext, 1);
    const exact = getDnd5eXpProgress(lvl, expected[lvl]);
    assert.equal(exact.canLevelUp, true);
    assert.equal(exact.xpToNext, 0);
  }

  assert.deepEqual(getDnd5eXpProgress(20, 999999), {
    currentLevel: 20,
    nextLevel: null,
    currentThreshold: 355000,
    nextThreshold: null,
    xpToNext: 0,
    progressPercent: 100,
    canLevelUp: false,
  });
});

test('hit die averages, standard ASI levels, and PHB errata minimum +1 HP gain', () => {
  assert.equal(getDnd5eHitDieAverage('d6'), 4);
  assert.equal(getDnd5eHitDieAverage('d8'), 5);
  assert.equal(getDnd5eHitDieAverage('d10'), 6);
  assert.equal(getDnd5eHitDieAverage('d12'), 7);

  for (let lvl = 1; lvl <= 20; lvl += 1) {
    assert.equal(isStandardAsiLevel(lvl), [4, 8, 12, 16, 19].includes(lvl));
  }

  assert.equal(computeLevelUpHpGain({ die: 'd6', conMod: -3, method: 'roll', rolledDie: 1 }), 1);
  assert.equal(computeLevelUpHpGain({ die: 'd6', conMod: -3, method: 'average' }), 1);
  assert.equal(computeLevelUpHpGain({ die: 'd10', conMod: 2, method: 'average' }), 8);
  assert.equal(computeLevelUpHpGain({ die: 'd12', conMod: 3, method: 'roll', rolledDie: 11 }), 14);
  assert.equal(computeLevelUpHpGain({ die: 'd8', conMod: 1, method: 'manual', manualGain: 0 }), 1);
  assert.equal(computeLevelUpHpGain({ die: 'd8', conMod: 1, method: 'manual', manualGain: 9 }), 9);
});

test('immutable reducers handle mode, XP, sessions, level-up, level 20 ceiling, history cap, and atomic undo', () => {
  const base = {
    ...createDefaultDnd5eState({
      level: 3,
      hitDice: { die: 'd8', current: 2, max: 3 },
    }),
    progression: createDefaultDnd5eProgression({ mode: 'xp', xpTotal: 2600 }),
  };

  const switched = setDnd5eProgressionMode(base, 'milestone', 4);
  assert.equal(switched.progression?.mode, 'milestone');
  assert.equal(switched.progression?.sessionsPerLevel, 4);
  assert.equal(base.progression?.mode, 'xp');

  const withXp = addDnd5eXp(switched, 300, { id: 'e_xp_1', timestamp: '2026-11-26T18:00:00Z', note: 'Goblin ambush' });
  assert.equal(withXp.progression?.xpTotal, 2900);
  assert.equal(addDnd5eXp(withXp, 0).progression?.xpTotal, 2900);

  const withSession = logDnd5eSession(withXp, { id: 'e_ses_1', timestamp: '2026-11-26T19:00:00Z', note: 'Session 12' });
  assert.equal(withSession.progression?.sessionsCount, 1);

  const leveled = applyDnd5eLevelUp(
    { dnd5eState: withSession, maxHp: 22, currentHp: 19 },
    { conMod: 2, method: 'average', id: 'e_lvl_1', timestamp: '2026-11-26T20:00:00Z', note: 'Reached level 4' },
  );
  assert.equal(leveled.applied, true);
  assert.equal(leveled.fromLevel, 3);
  assert.equal(leveled.toLevel, 4);
  assert.equal(leveled.isAsiLevel, true);
  assert.equal(leveled.hpGain, 7);
  assert.equal(leveled.maxHp, 29);
  assert.equal(leveled.currentHp, 26);
  assert.equal(leveled.dnd5eState.level, 4);
  assert.equal(leveled.dnd5eState.hitDice.max, 4);
  assert.equal(leveled.dnd5eState.hitDice.current, 2);
  assert.equal(leveled.dnd5eState.progression?.xpTotal, 2900);

  const undoLvl = undoLastDnd5eProgression(leveled);
  assert.equal(undoLvl.undone, true);
  assert.equal(undoLvl.dnd5eState.level, 3);
  assert.equal(undoLvl.dnd5eState.hitDice.max, 3);
  assert.equal(undoLvl.maxHp, 22);
  assert.equal(undoLvl.currentHp, 19);
  assert.equal(undoLvl.dnd5eState.progression?.xpTotal, 2900);
  assert.equal(undoLvl.dnd5eState.progression?.sessionsCount, 1);

  const undoSes = undoLastDnd5eProgression(undoLvl);
  assert.equal(undoSes.undone, true);
  assert.equal(undoSes.dnd5eState.progression?.sessionsCount, 0);

  const undoXp = undoLastDnd5eProgression(undoSes);
  assert.equal(undoXp.undone, true);
  assert.equal(undoXp.dnd5eState.progression?.xpTotal, 2600);
  assert.equal(undoXp.dnd5eState.progression?.history.length, 0);

  const emptyUndo = undoLastDnd5eProgression(undoXp);
  assert.equal(emptyUndo.undone, false);
  assert.equal(emptyUndo.entry, null);

  // Level 20 ceiling
  const lvl20 = createDefaultDnd5eState({ level: 20, hitDice: { die: 'd10', current: 20, max: 20 } });
  const blocked = applyDnd5eLevelUp({ dnd5eState: lvl20, maxHp: 180, currentHp: 180 }, { conMod: 3 });
  assert.equal(blocked.applied, false);
  assert.equal(blocked.dnd5eState.level, 20);
  assert.equal(blocked.maxHp, 180);

  // History capped at 100 entries
  let many = createDefaultDnd5eState({ level: 1 });
  for (let i = 0; i < 105; i += 1) {
    many = addDnd5eXp(many, 10, { id: `xp_${i}`, timestamp: '2026-11-26T20:00:00Z' });
  }
  assert.equal(many.progression?.history.length, DND5E_MAX_PROGRESSION_HISTORY);
  assert.equal(many.progression?.history[0].id, 'xp_5');
});

test('schema.v2.json AJV and validateSheetPayload validate progression and reject invalid payloads', () => {
  const validateAjv = compileSchemaV2();
  const preset = createDnd5ePreset();
  assert.equal(validateAjv(preset), true, JSON.stringify(validateAjv.errors));
  assert.equal(validateSheetPayload(preset).valid, true);

  // Backward compatibility: dnd5eState without progression passes AJV and migrates cleanly
  const { progression: _omit, ...dnd5eWithoutProg } = preset.dnd5eState!;
  const legacySheet = { ...preset, dnd5eState: dnd5eWithoutProg };
  assert.equal(validateAjv(legacySheet), true, JSON.stringify(validateAjv.errors));
  assert.equal(validateSheetPayload(legacySheet).valid, true);

  const migrated = migrateLegacyDnd5eSheet(legacySheet);
  assert.deepEqual(migrated.dnd5eState?.progression, normalizeDnd5eProgression(undefined));

  // Mutated progression with entries passes AJV & validateSheetPayload
  const withEvents = addDnd5eXp(migrated.dnd5eState!, 500, {
    id: 'xp_test_1',
    timestamp: '2026-11-26T20:00:00Z',
    note: 'Quest reward',
  });
  const updatedSheet = { ...migrated, dnd5eState: withEvents };
  assert.equal(validateAjv(updatedSheet), true, JSON.stringify(validateAjv.errors));
  assert.equal(validateSheetPayload(updatedSheet).valid, true);

  // Reject extra properties inside progression and invalid mode
  const badExtra = {
    ...updatedSheet,
    dnd5eState: {
      ...withEvents,
      progression: { ...withEvents.progression!, extraField: true },
    },
  };
  assert.equal(validateAjv(badExtra), false);
  assert.equal(validateSheetPayload(badExtra).valid, false);

  const badMode = {
    ...updatedSheet,
    dnd5eState: {
      ...withEvents,
      progression: { ...withEvents.progression!, mode: 'freeform' },
    },
  };
  assert.equal(validateAjv(badMode), false);
  assert.equal(validateSheetPayload(badMode).valid, false);
});
