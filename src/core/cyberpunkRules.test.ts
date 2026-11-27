import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
  addCriticalInjury,
  applyArmorDamage,
  createDefaultCyberpunkState,
  fireWeapon,
  getCyberpunkWoundState,
  normalizeCyberpunkState,
  recomputeCyberpunkHumanity,
  reloadWeapon,
  removeCriticalInjury,
  repairArmorSp,
  rollExplodingD10Check,
  toggleCriticalInjuryTreated,
} from './cyberpunkRules.ts';
import {
  createCyberpunkPreset,
  migrateLegacyCyberpunkSheet,
  validateSheetPayload,
} from './sheetModel.ts';

function seqRng(values: number[]): () => number {
  let idx = 0;
  return () => values[Math.min(idx++, values.length - 1)];
}

test('rollExplodingD10Check handles critical 10 (+1d10), fumble 1 (-1d10), normal 2..9, woundPenalty, and DV', () => {
  const crit = rollExplodingD10Check({ stat: 8, skill: 6, modifier: 1, woundPenalty: 2, dv: 25, rng: seqRng([0.99, 0.7]) });
  assert.equal(crit.baseDie, 10);
  assert.equal(crit.explosionDie, 8);
  assert.equal(crit.explosionKind, 'crit');
  assert.equal(crit.woundPenalty, 2);
  assert.equal(crit.total, 10 + 8 + 8 + 6 + 1 - 2);
  assert.equal(crit.dv, 25);
  assert.equal(crit.passed, true);

  const fumble = rollExplodingD10Check({ stat: 7, skill: 4, modifier: 0, woundPenalty: 0, dv: 10, rng: seqRng([0.0, 0.8]) });
  assert.equal(fumble.baseDie, 1);
  assert.equal(fumble.explosionDie, 9);
  assert.equal(fumble.explosionKind, 'fumble');
  assert.equal(fumble.total, 1 - 9 + 7 + 4);
  assert.equal(fumble.passed, false);

  const normal = rollExplodingD10Check({ stat: 6, skill: 5, rng: seqRng([0.45]) });
  assert.equal(normal.baseDie, 5);
  assert.equal(normal.explosionDie, null);
  assert.equal(normal.explosionKind, 'none');
  assert.equal(normal.total, 16);
  assert.equal(normal.passed, undefined);
});

test('applyArmorDamage and repairArmorSp enforce SP absorption, ablation on penetration, headshot multiplier, and repair bounds', () => {
  const baseArmor = { head: { sp: 11, maxSp: 11 }, body: { sp: 11, maxSp: 11 } };

  const absorbed = applyArmorDamage(baseArmor, 'body', 11);
  assert.equal(absorbed.penetrated, false);
  assert.equal(absorbed.hpDamage, 0);
  assert.equal(absorbed.nextSp, 11);
  assert.equal(absorbed.armor.body.sp, 11);

  const penetratedBody = applyArmorDamage(baseArmor, 'body', 16);
  assert.equal(penetratedBody.penetrated, true);
  assert.equal(penetratedBody.hpDamage, 5);
  assert.equal(penetratedBody.nextSp, 10);
  assert.equal(penetratedBody.armor.head.sp, 11);

  const headNormal = applyArmorDamage(baseArmor, 'head', 14);
  assert.equal(headNormal.hpDamage, 3);
  assert.equal(headNormal.nextSp, 10);

  const headCrit = applyArmorDamage(baseArmor, 'head', 14, { headshotMultiplier: true });
  assert.equal(headCrit.hpDamage, 6);
  assert.equal(headCrit.nextSp, 10);

  const zeroSp = applyArmorDamage({ head: { sp: 0, maxSp: 11 }, body: { sp: 0, maxSp: 11 } }, 'body', 5);
  assert.equal(zeroSp.penetrated, true);
  assert.equal(zeroSp.nextSp, 0);
  assert.equal(zeroSp.hpDamage, 5);

  const clampedMaxSp = applyArmorDamage({ head: { sp: 11, maxSp: 11 }, body: { sp: 15, maxSp: 10 } }, 'body', 12);
  assert.equal(clampedMaxSp.spBefore, 10);
  assert.equal(clampedMaxSp.penetrated, true);
  assert.equal(clampedMaxSp.hpDamage, 2);
  assert.equal(clampedMaxSp.nextSp, 9);

  const partialRepair = repairArmorSp(penetratedBody.armor, 'body', 1);
  assert.equal(partialRepair.body.sp, 11);
  const cappedRepair = repairArmorSp(penetratedBody.armor, 'body', 99);
  assert.equal(cappedRepair.body.sp, 11);
  const fullRepair = repairArmorSp(headCrit.armor, 'head');
  assert.equal(fullRepair.head.sp, 11);
});

test('getCyberpunkWoundState computes Serious and Mortal wound penalties accurately', () => {
  assert.deepEqual(getCyberpunkWoundState(35, 35), { currentHp: 35, maxHp: 35, isSeriouslyWounded: false, isMortallyWounded: false, woundPenalty: 0 });
  assert.deepEqual(getCyberpunkWoundState(19, 35), { currentHp: 19, maxHp: 35, isSeriouslyWounded: false, isMortallyWounded: false, woundPenalty: 0 });
  assert.deepEqual(getCyberpunkWoundState(18, 35), { currentHp: 18, maxHp: 35, isSeriouslyWounded: true, isMortallyWounded: false, woundPenalty: 2 });
  assert.deepEqual(getCyberpunkWoundState(1, 35), { currentHp: 1, maxHp: 35, isSeriouslyWounded: true, isMortallyWounded: false, woundPenalty: 2 });
  assert.deepEqual(getCyberpunkWoundState(0, 35), { currentHp: 0, maxHp: 35, isSeriouslyWounded: false, isMortallyWounded: true, woundPenalty: 4 });
  assert.deepEqual(getCyberpunkWoundState(-5, 35), { currentHp: -5, maxHp: 35, isSeriouslyWounded: false, isMortallyWounded: true, woundPenalty: 4 });
});

test('recomputeCyberpunkHumanity calculates effective EMP, loss floor, and cyberpsychosis threshold', () => {
  const safe = recomputeCyberpunkHumanity({ baseEmp: 6 }, [
    { humanityLoss: 7 },
    { humanityLoss: 14 },
  ]);
  assert.deepEqual(safe, { humanity: { current: 39, max: 60, baseEmp: 6 }, totalHumanityLoss: 21, effectiveEmp: 3, cyberpsychosisRisk: false });

  const risk = recomputeCyberpunkHumanity({ baseEmp: 6 }, [
    { humanityLoss: 14 },
    { humanityLoss: 20 },
  ]);
  assert.deepEqual(risk, { humanity: { current: 26, max: 60, baseEmp: 6 }, totalHumanityLoss: 34, effectiveEmp: 2, cyberpsychosisRisk: true });

  const floored = recomputeCyberpunkHumanity({ baseEmp: 3 }, [
    { humanityLoss: 25 },
    { humanityLoss: 25 },
  ]);
  assert.deepEqual(floored, { humanity: { current: 0, max: 30, baseEmp: 3 }, totalHumanityLoss: 50, effectiveEmp: 0, cyberpsychosisRisk: true });
});

test('weapons and critical injuries handle ammo boundaries, reload, add, toggle, and removal', () => {
  const pistol = {
    id: 'w1',
    name: 'Heavy Pistol',
    skillKey: 'handgun',
    damageFormula: '3d6',
    rof: 2,
    ammoCurrent: 2,
    ammoMax: 8,
  };
  const zeroShot = fireWeapon(pistol, 0);
  assert.equal(zeroShot.fired, false);
  assert.equal(zeroShot.shotsFired, 0);
  assert.equal(zeroShot.weapon.ammoCurrent, 2);

  const negShot = fireWeapon(pistol, -2);
  assert.equal(negShot.fired, false);
  assert.equal(negShot.shotsFired, 0);
  assert.equal(negShot.weapon.ammoCurrent, 2);

  const rofCapped = fireWeapon({ ...pistol, ammoCurrent: 8 }, 4);
  assert.equal(rofCapped.fired, true);
  assert.equal(rofCapped.shotsFired, 2);
  assert.equal(rofCapped.weapon.ammoCurrent, 6);

  const shot1 = fireWeapon(pistol);
  assert.equal(shot1.fired, true);
  assert.equal(shot1.shotsFired, 1);
  assert.equal(shot1.weapon.ammoCurrent, 1);

  const shot2 = fireWeapon(shot1.weapon, 4);
  assert.equal(shot2.fired, true);
  assert.equal(shot2.shotsFired, 1);
  assert.equal(shot2.weapon.ammoCurrent, 0);

  const emptyShot = fireWeapon(shot2.weapon);
  assert.equal(emptyShot.fired, false);
  assert.equal(emptyShot.shotsFired, 0);
  assert.equal(emptyShot.weapon.ammoCurrent, 0);

  const reloaded = reloadWeapon(emptyShot.weapon);
  assert.equal(reloaded.ammoCurrent, 8);

  let injuries = addCriticalInjury([], { id: 'inj_1', name: 'Broken Ribs', effect: '-2 Body', treated: false });
  assert.equal(injuries.length, 1);
  assert.equal(injuries[0].treated, false);
  injuries = addCriticalInjury(injuries, { id: 'inj_1', name: 'Broken Ribs (Updated)', effect: '-1 Body', treated: true });
  assert.equal(injuries.length, 1);
  assert.equal(injuries[0].name, 'Broken Ribs (Updated)');
  assert.equal(injuries[0].treated, true);
  injuries = toggleCriticalInjuryTreated(injuries, 'inj_1');
  assert.equal(injuries[0].treated, false);
  injuries = removeCriticalInjury(injuries, 'inj_1');
  assert.equal(injuries.length, 0);

  let cappedInjuries = injuries;
  for (let i = 1; i <= 25; i += 1) {
    cappedInjuries = addCriticalInjury(cappedInjuries, { id: `inj_${i}`, name: `Injury ${i}`, effect: 'Penalty', treated: false });
  }
  assert.equal(cappedInjuries.length, 20);
});

test('schema.v2.json AJV, validateSheetPayload, and legacy migration handle cyberpunkState and reject extra props', () => {
  const schemaRaw = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'shared/presets/schema.v2.json'), 'utf8'),
  ) as Record<string, unknown>;
  const presetsRaw = JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'shared/presets/presets.v2.json'), 'utf8'),
  ) as { presets: Record<string, unknown> };

  const AjvCtor = (Ajv2020 as unknown as { default?: typeof Ajv2020 }).default ?? Ajv2020;
  const ajv = new AjvCtor({ allErrors: true, strict: false });
  const applyFormats = (addFormats as unknown as { default?: typeof addFormats }).default ?? addFormats;
  applyFormats(ajv);
  const validateAjv = ajv.compile(schemaRaw);

  const preset = createCyberpunkPreset();
  assert.equal(validateAjv(preset), true, JSON.stringify(validateAjv.errors));
  assert.equal(validateSheetPayload(preset).valid, true);
  assert.equal(validateAjv(presetsRaw.presets.cyberpunk), true, JSON.stringify(validateAjv.errors));
  assert.equal(validateSheetPayload(presetsRaw.presets.cyberpunk).valid, true);

  // Legacy cyberpunk sheet without cyberpunkState passes schema & migrates cleanly without altering filled card fields
  const { cyberpunkState: _omit, ...legacy } = preset;
  assert.equal(validateAjv(legacy), true);
  assert.equal(validateSheetPayload(legacy).valid, true);
  const migrated = migrateLegacyCyberpunkSheet(legacy);
  assert.deepEqual(migrated.cyberpunkState, createDefaultCyberpunkState());
  assert.equal(migrated.cards[1].fields[0].value, 8);

  // Existing cyberpunkState values are preserved across migration
  const customPreset = {
    ...preset,
    cyberpunkState: {
      ...preset.cyberpunkState!,
      armor: { head: { sp: 7, maxSp: 11 }, body: { sp: 9, maxSp: 14 } },
    },
  };
  const migratedCustom = migrateLegacyCyberpunkSheet(customPreset);
  assert.equal(migratedCustom.cyberpunkState?.armor.head.sp, 7);
  assert.equal(migratedCustom.cyberpunkState?.armor.body.maxSp, 14);

  // Extra property violates additionalProperties: false
  const polluted = {
    ...preset,
    cyberpunkState: { ...preset.cyberpunkState, unexpectedProp: true },
  };
  assert.equal(validateAjv(polluted), false);
  assert.equal(validateSheetPayload(polluted).valid, false);

  // Hostile non-string fields never throw TypeError in normalizer
  const hostile = normalizeCyberpunkState({ cyberware: [{ id: { toString: null }, name: 123, slot: 'eye', humanityLoss: 5 }] });
  assert.equal(hostile.cyberware[0].id, 'cw_1');
  assert.equal(hostile.cyberware[0].name, 'Cyberware');

  // Partial humanity merges with fallback baseEmp/max instead of discarding fallback
  const mergedHumanity = normalizeCyberpunkState(
    { humanity: { current: 70 } },
    { humanity: { current: 80, max: 80, baseEmp: 8 } },
  );
  assert.deepEqual(mergedHumanity.humanity, { current: 70, max: 80, baseEmp: 8 });
});
