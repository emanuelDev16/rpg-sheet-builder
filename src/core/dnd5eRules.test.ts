import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import {
  applyDndDamage,
  applyDndHeal,
  applyLongRest,
  cycleSkillProficiency,
  DND5E_ABILITIES,
  DND5E_SKILLS,
  formatSignedMod,
  getAbilityModifier,
  getPassivePerception,
  getProficiencyBonus,
  getSaveBonus,
  getSkillBonus,
  getSpellAttackBonus,
  getSpellSaveDC,
  rollD20Check,
  rollDeathSave,
  setTempHp,
  spendHitDieShortRest,
} from './dnd5eRules.ts';
import {
  createDnd5ePreset,
  migrateLegacyDnd5eSheet,
  validateSheetPayload,
} from './sheetModel.ts';

function seqRng(values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

test('getAbilityModifier and formatSignedMod compute exact D&D 5e SRD values', () => {
  assert.equal(getAbilityModifier(1), -5);
  assert.equal(getAbilityModifier(8), -1);
  assert.equal(getAbilityModifier(9), -1);
  assert.equal(getAbilityModifier(10), 0);
  assert.equal(getAbilityModifier(11), 0);
  assert.equal(getAbilityModifier(15), 2);
  assert.equal(getAbilityModifier(16), 3);
  assert.equal(getAbilityModifier(20), 5);
  assert.equal(getAbilityModifier(30), 10);

  assert.equal(formatSignedMod(2), '+2');
  assert.equal(formatSignedMod(-1), '-1');
  assert.equal(formatSignedMod(0), '+0');
});

test('getProficiencyBonus scales across levels 1..20 with clamping', () => {
  const expected: Array<[number, number]> = [
    [0, 2], [1, 2], [4, 2], [5, 3], [8, 3], [9, 4],
    [12, 4], [13, 5], [16, 5], [17, 6], [20, 6], [25, 6],
  ];
  for (const [lvl, pb] of expected) {
    assert.equal(getProficiencyBonus(lvl), pb);
  }
});

test('official 18 SRD skills, skill/save bonuses, and passive perception match rules', () => {
  assert.equal(DND5E_ABILITIES.length, 6);
  assert.equal(DND5E_SKILLS.length, 18);
  const bySkill = Object.fromEntries(DND5E_SKILLS.map((s) => [s.key, s.ability]));
  assert.equal(bySkill.athletics, 'str');
  assert.equal(bySkill.acrobatics, 'dex');
  assert.equal(bySkill.sleight_of_hand, 'dex');
  assert.equal(bySkill.stealth, 'dex');
  assert.equal(bySkill.arcana, 'int');
  assert.equal(bySkill.investigation, 'int');
  assert.equal(bySkill.perception, 'wis');
  assert.equal(bySkill.persuasion, 'cha');

  assert.equal(getSkillBonus(14, 5, 'none'), 2);
  assert.equal(getSkillBonus(14, 5, 'proficient'), 5);
  assert.equal(getSkillBonus(14, 5, 'expertise'), 8);
  assert.equal(getSaveBonus(15, 5, true), 5);
  assert.equal(getSaveBonus(15, 5, false), 2);
  assert.equal(getPassivePerception(12, 5, 'proficient'), 14);
  assert.equal(getPassivePerception(12, 5, 'expertise'), 17);

  assert.equal(cycleSkillProficiency('none'), 'proficient');
  assert.equal(cycleSkillProficiency('proficient'), 'expertise');
  assert.equal(cycleSkillProficiency('expertise'), 'none');
});

test('rollD20Check supports normal, advantage, disadvantage, nat20/nat1, and ties', () => {
  const norm = rollD20Check({ mode: 'normal', bonus: 5, rng: seqRng([0.95]) });
  assert.deepEqual(norm.dice, [20]);
  assert.equal(norm.kept, 20);
  assert.equal(norm.discarded, null);
  assert.equal(norm.total, 25);
  assert.equal(norm.isNat20, true);
  assert.equal(norm.isNat1, false);

  // [4, 17] -> adv keeps 17, discards 4
  const adv = rollD20Check({ mode: 'advantage', bonus: 3, rng: seqRng([0.15, 0.80]) });
  assert.deepEqual(adv.dice, [4, 17]);
  assert.equal(adv.kept, 17);
  assert.equal(adv.discarded, 4);
  assert.equal(adv.total, 20);

  // [1, 18] -> dis keeps 1 (Nat 1), discards 18
  const dis = rollD20Check({ mode: 'disadvantage', bonus: 4, rng: seqRng([0.0, 0.85]) });
  assert.deepEqual(dis.dice, [1, 18]);
  assert.equal(dis.kept, 1);
  assert.equal(dis.discarded, 18);
  assert.equal(dis.total, 5);
  assert.equal(dis.isNat1, true);

  // Ties [14, 14]
  const tie = rollD20Check({ mode: 'advantage', bonus: 2, rng: seqRng([0.65, 0.65]) });
  assert.deepEqual(tie.dice, [14, 14]);
  assert.equal(tie.kept, 14);
  assert.equal(tie.discarded, 14);
});

test('tempHp, damage absorption, and healing follow SRD rules', () => {
  assert.equal(setTempHp(8, 5), 8);
  assert.equal(setTempHp(8, 12), 12);
  assert.equal(setTempHp(8, 5, { forceOverride: true }), 5);

  // Partial absorption by tempHp
  const d1 = applyDndDamage({ currentHp: 30, maxHp: 44, tempHp: 5 }, 3);
  assert.deepEqual(d1, { currentHp: 30, tempHp: 2, absorbedByTemp: 3, appliedToHp: 0 });

  // Overflow from tempHp to HP and clamp at 0
  const d2 = applyDndDamage({ currentHp: 10, maxHp: 44, tempHp: 5 }, 20);
  assert.deepEqual(d2, { currentHp: 0, tempHp: 0, absorbedByTemp: 5, appliedToHp: 10 });

  // Healing from >0 preserves tempHp and existing deathSaves; healing from 0 resets deathSaves
  const h1 = applyDndHeal({ currentHp: 20, maxHp: 44, tempHp: 6, deathSaves: { successes: 1, failures: 1 } }, 10);
  assert.deepEqual(h1, { currentHp: 30, tempHp: 6, healed: 10, deathSaves: { successes: 1, failures: 1 } });

  const h2 = applyDndHeal({ currentHp: 0, maxHp: 44, tempHp: 0, deathSaves: { successes: 2, failures: 2 } }, 50);
  assert.deepEqual(h2, { currentHp: 44, tempHp: 0, healed: 44, deathSaves: { successes: 0, failures: 0 } });
});

test('rollDeathSave handles Nat 20, Nat 1, >=10, <10, and stabilization/death bounds', () => {
  const nat20 = rollDeathSave({ currentHp: 0, maxHp: 44, deathSaves: { successes: 1, failures: 2 } }, seqRng([0.99]));
  assert.equal(nat20.roll, 20);
  assert.equal(nat20.currentHp, 1);
  assert.deepEqual(nat20.deathSaves, { successes: 0, failures: 0 });
  assert.equal(nat20.outcome, 'revived');

  const nat1 = rollDeathSave({ currentHp: 0, maxHp: 44, deathSaves: { successes: 1, failures: 1 } }, seqRng([0.0]));
  assert.equal(nat1.roll, 1);
  assert.deepEqual(nat1.deathSaves, { successes: 1, failures: 3 });
  assert.equal(nat1.outcome, 'dead');

  const pass = rollDeathSave({ currentHp: 0, maxHp: 44, deathSaves: { successes: 2, failures: 0 } }, seqRng([0.45]));
  assert.equal(pass.roll, 10);
  assert.deepEqual(pass.deathSaves, { successes: 3, failures: 0 });
  assert.equal(pass.outcome, 'stabilized');

  const fail = rollDeathSave({ currentHp: 0, maxHp: 44, deathSaves: { successes: 0, failures: 0 } }, seqRng([0.40]));
  assert.equal(fail.roll, 9);
  assert.deepEqual(fail.deathSaves, { successes: 0, failures: 1 });
  assert.equal(fail.outcome, 'failure');
});

test('spellcasting DC/attack, short rest hit die, and long rest recovery work accurately', () => {
  assert.equal(getSpellSaveDC(14, 5), 13); // 8 + 3 + 2
  assert.equal(getSpellAttackBonus(14, 5), 5); // 3 + 2

  const sr = spendHitDieShortRest(
    {
      currentHp: 20,
      maxHp: 44,
      tempHp: 4,
      deathSaves: { successes: 0, failures: 0 },
      hitDice: { die: 'd10', current: 2, max: 5 },
      conScore: 15, // +2
    },
    seqRng([0.6]), // floor(0.6*10)+1 = 7 -> 7+2 = 9 healed
  );
  assert.equal(sr.spent, true);
  assert.equal(sr.roll, 7);
  assert.equal(sr.healed, 9);
  assert.equal(sr.currentHp, 29);
  assert.equal(sr.hitDice.current, 1);

  const srEmpty = spendHitDieShortRest({
    currentHp: 20,
    maxHp: 44,
    tempHp: 0,
    deathSaves: { successes: 0, failures: 0 },
    hitDice: { die: 'd10', current: 0, max: 5 },
    conScore: 15,
  });
  assert.equal(srEmpty.spent, false);

  const preset = createDnd5ePreset();
  const tired = {
    ...preset.dnd5eState!,
    tempHp: 9,
    hitDice: { die: 'd10' as const, current: 1, max: 5 }, // recovers max(1, floor(5/2)) = 2 -> 3
    deathSaves: { successes: 2, failures: 1 },
    spellcasting: {
      ability: 'int' as const,
      slots: preset.dnd5eState!.spellcasting.slots.map((s) =>
        s.level === 1 ? { ...s, used: 4 } : s.level === 2 ? { ...s, used: 2 } : s,
      ),
    },
  };
  const lr = applyLongRest({ maxHp: 44, dnd5eState: tired });
  assert.equal(lr.currentHp, 44);
  assert.equal(lr.dnd5eState.tempHp, 0);
  assert.deepEqual(lr.dnd5eState.deathSaves, { successes: 0, failures: 0 });
  assert.equal(lr.dnd5eState.hitDice.current, 3);
  assert.ok(lr.dnd5eState.spellcasting.slots.every((s) => s.used === 0));
});

test('schema.v2.json AJV and validateSheetPayload support dnd5eState, legacy migration, and reject extra props', () => {
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

  const dndPreset = createDnd5ePreset();
  assert.equal(validateAjv(dndPreset), true, JSON.stringify(validateAjv.errors));
  assert.equal(validateSheetPayload(dndPreset).valid, true);
  assert.equal(validateAjv(presetsRaw.presets.dnd5e), true, JSON.stringify(validateAjv.errors));

  // Legacy dnd5e sheet without dnd5eState passes schema & migrates safely
  const { dnd5eState: _omit, ...legacyDnd } = dndPreset;
  assert.equal(validateAjv(legacyDnd), true);
  assert.equal(validateSheetPayload(legacyDnd).valid, true);
  const migrated = migrateLegacyDnd5eSheet(legacyDnd);
  assert.equal(migrated.dnd5eState?.level, 5);
  assert.equal(migrated.dnd5eState?.inspiration, true);
  assert.equal(migrated.dnd5eState?.hitDice.die, 'd10');
  assert.equal(migrated.dnd5eState?.skillProficiencies.athletics, 'proficient');
  assert.equal(migrated.dnd5eState?.saveProficiencies.con, true);

  // Extra property in dnd5eState must fail additionalProperties: false
  const polluted = {
    ...dndPreset,
    dnd5eState: { ...dndPreset.dnd5eState, unexpectedProp: true },
  };
  assert.equal(validateAjv(polluted), false);
  assert.equal(validateSheetPayload(polluted).valid, false);
});
