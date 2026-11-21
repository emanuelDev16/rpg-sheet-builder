import test from 'node:test';
import assert from 'node:assert/strict';
import {
  V20_CLANS_CATALOG,
  V5_CLANS_CATALOG,
  WOD_DISCIPLINES_CATALOG,
  buildCatalogDisciplineField,
  buildCatalogPowerRow,
  findClanByIdOrName,
  findDisciplineByIdOrName,
  formatPowerCostLabel,
  getClansForEdition,
  getDisciplinesForEdition,
  isCatalogDisciplinePresent,
  isCatalogPowerPresent,
  parsePowerActivationCost,
  resolveDisciplineAffinity,
} from './wodClansDisciplinesCatalog.ts';

const LANGUAGES = ['pt-BR', 'en', 'es'] as const;

test('Official WoD Clans catalog exposes 14 V20 clans and 16 V5 clans with full pt-BR/en/es parity', () => {
  const v20Clans = getClansForEdition('storyteller-v20');
  assert.equal(v20Clans.length, 14);
  assert.equal(V20_CLANS_CATALOG.length, 14);

  const v20DiscIds = new Set(getDisciplinesForEdition('storyteller-v20').map((d) => d.id));
  for (const clan of v20Clans) {
    assert.equal(clan.edition, 'storyteller-v20');
    for (const lang of LANGUAGES) {
      assert.ok(clan.name[lang].trim().length > 0, `Missing V20 clan name (${lang}) for ${clan.id}`);
      assert.ok(
        clan.weakness[lang].trim().length > 0,
        `Missing V20 weakness (${lang}) for ${clan.id}`,
      );
    }
    if (clan.isCaitiff) {
      assert.equal(clan.clanDisciplines.length, 0);
    } else {
      assert.equal(clan.clanDisciplines.length, 3, `Expected 3 disciplines on V20 clan ${clan.id}`);
      for (const discId of clan.clanDisciplines) {
        assert.ok(v20DiscIds.has(discId), `Unknown V20 discipline ${discId} on ${clan.id}`);
      }
    }
  }

  const v5Clans = getClansForEdition('vampire-v5');
  assert.equal(v5Clans.length, 16);
  assert.equal(V5_CLANS_CATALOG.length, 16);

  const v5DiscIds = new Set(getDisciplinesForEdition('vampire-v5').map((d) => d.id));
  for (const clan of v5Clans) {
    assert.equal(clan.edition, 'vampire-v5');
    for (const lang of LANGUAGES) {
      assert.ok(clan.name[lang].trim().length > 0, `Missing V5 clan name (${lang}) for ${clan.id}`);
      assert.ok(clan.bane[lang].trim().length > 0, `Missing V5 bane (${lang}) for ${clan.id}`);
      assert.ok(
        clan.compulsion[lang].trim().length > 0,
        `Missing V5 compulsion (${lang}) for ${clan.id}`,
      );
    }
    if (clan.isCaitiff) {
      assert.equal(clan.clanDisciplines.length, 0);
    } else if (clan.isThinBlood) {
      assert.deepEqual(clan.clanDisciplines, ['thin_blood_alchemy']);
    } else {
      assert.equal(clan.clanDisciplines.length, 3, `Expected 3 disciplines on V5 clan ${clan.id}`);
    }
    for (const discId of clan.clanDisciplines) {
      assert.ok(v5DiscIds.has(discId), `Unknown V5 discipline ${discId} on ${clan.id}`);
    }
  }
});

test('findClanByIdOrName handles accents, casing, all 3 languages, and keeps V20/V5 isolated', () => {
  assert.equal(findClanByIdOrName('Ministério', 'vampire-v5')?.id, 'ministry');
  assert.equal(findClanByIdOrName('ministerio', 'vampire-v5')?.id, 'ministry');
  assert.equal(findClanByIdOrName('THE MINISTRY', 'vampire-v5')?.id, 'ministry');
  assert.equal(findClanByIdOrName('el ministerio', 'vampire-v5')?.id, 'ministry');

  assert.equal(findClanByIdOrName('Sangue-Fraco', 'vampire-v5')?.id, 'thin_blood');
  assert.equal(findClanByIdOrName('SANGRE DEBIL', 'vampire-v5')?.id, 'thin_blood');
  assert.equal(findClanByIdOrName('thin-blood', 'vampire-v5')?.id, 'thin_blood');

  assert.equal(findClanByIdOrName('Assamita', 'storyteller-v20')?.id, 'assamite');
  assert.equal(findClanByIdOrName('Seguidores de Set', 'storyteller-v20')?.id, 'followers_of_set');
  assert.equal(findClanByIdOrName('Followers of Set', 'storyteller-v20')?.id, 'followers_of_set');

  // Edition isolation & custom clans
  assert.equal(findClanByIdOrName('Banu Haqim', 'storyteller-v20'), null);
  assert.equal(findClanByIdOrName('Giovanni', 'vampire-v5'), null);
  assert.equal(findClanByIdOrName('Baali', 'vampire-v5'), null);
  assert.equal(findClanByIdOrName('', 'storyteller-v20'), null);
});

test('resolveDisciplineAffinity resolves In-Clan, Out-of-Clan, and Caitiff accurately across editions and languages', () => {
  // Brujah + Potence = In-Clan, Brujah + Dominate = Out-of-Clan
  assert.equal(
    resolveDisciplineAffinity('Brujah', 'Potence', 'storyteller-v20'),
    'discipline_clan',
  );
  assert.equal(
    resolveDisciplineAffinity('Brujah', 'Potência', 'storyteller-v20'),
    'discipline_clan',
  );
  assert.equal(
    resolveDisciplineAffinity('Brujah', 'Dominate', 'storyteller-v20'),
    'discipline_out_of_clan',
  );
  assert.equal(
    resolveDisciplineAffinity('Brujah', 'Dominação', 'vampire-v5'),
    'discipline_out_of_clan',
  );

  // Caitiff + any discipline = Caitiff
  assert.equal(
    resolveDisciplineAffinity('Caitiff', 'Dominate', 'storyteller-v20'),
    'discipline_caitiff',
  );
  assert.equal(
    resolveDisciplineAffinity('caitiff', 'Oblivion', 'vampire-v5'),
    'discipline_caitiff',
  );

  // Hecata V5 + Oblivion = In-Clan (multilingual)
  assert.equal(
    resolveDisciplineAffinity('Hecata', 'Oblivion', 'vampire-v5'),
    'discipline_clan',
  );
  assert.equal(
    resolveDisciplineAffinity('Hecata', 'Obliteração', 'vampire-v5'),
    'discipline_clan',
  );
  assert.equal(
    resolveDisciplineAffinity('Hecata', 'Olvido', 'vampire-v5'),
    'discipline_clan',
  );

  // Followers of Set (V20) vs The Ministry (V5)
  assert.equal(
    resolveDisciplineAffinity('Seguidores de Set', 'Serpentis', 'storyteller-v20'),
    'discipline_clan',
  );
  assert.equal(
    resolveDisciplineAffinity('Ministério', 'Metamorfose', 'vampire-v5'),
    'discipline_clan',
  );

  // Thin-Blood V5: Thin-Blood Alchemy = clan, standard disciplines = out-of-clan
  assert.equal(
    resolveDisciplineAffinity('Sangue-Fraco', 'Alquimia do Sangue-Fraco', 'vampire-v5'),
    'discipline_clan',
  );
  assert.equal(
    resolveDisciplineAffinity('Thin-Blood', 'Dominate', 'vampire-v5'),
    'discipline_out_of_clan',
  );
});

test('Disciplines and powers catalog maintains valid activation costs and builds localized fields/rows', () => {
  assert.equal(WOD_DISCIPLINES_CATALOG.length, 20);

  for (const edition of ['storyteller-v20', 'vampire-v5'] as const) {
    const discs = getDisciplinesForEdition(edition);
    assert.ok(discs.length >= 12);

    for (const disc of discs) {
      assert.ok(disc.powers.length >= 2, `Expected powers for ${disc.id} in ${edition}`);
      for (const lang of LANGUAGES) {
        assert.ok(disc.name[lang].trim().length > 0);
      }

      for (const power of disc.powers) {
        assert.equal(power.edition, edition);
        assert.ok(power.level >= 1 && power.level <= 5);
        for (const lang of LANGUAGES) {
          assert.ok(power.name[lang].trim().length > 0);
        }

        if (edition === 'vampire-v5') {
          assert.ok(
            power.costType === 'free' || power.costType === 'rouse',
            `Invalid V5 costType ${power.costType} on ${power.id}`,
          );
        } else {
          assert.ok(
            power.costType === 'free' || power.costType === 'blood_point',
            `Invalid V20 costType ${power.costType} on ${power.id}`,
          );
        }

        if (power.costType === 'free') {
          assert.equal(power.costAmount, 0);
        } else {
          assert.ok(power.costAmount >= 1 && power.costAmount <= 5);
        }

        const formatted = formatPowerCostLabel(power.costType, power.costAmount, 'pt-BR');
        const reparsed = parsePowerActivationCost(formatted, edition);
        assert.equal(reparsed.costType, power.costType);
        assert.equal(reparsed.costAmount, power.costAmount);
      }
    }
  }

  // Legacy & multilingual cost string parsing
  assert.deepEqual(parsePowerActivationCost('1 ROUSE', 'vampire-v5'), {
    costType: 'rouse',
    costAmount: 1,
  });
  assert.deepEqual(parsePowerActivationCost('2 ROUSE', 'vampire-v5'), {
    costType: 'rouse',
    costAmount: 2,
  });
  assert.deepEqual(parsePowerActivationCost('FREE', 'vampire-v5'), {
    costType: 'free',
    costAmount: 0,
  });
  assert.deepEqual(parsePowerActivationCost('1 BLOOD', 'storyteller-v20'), {
    costType: 'blood_point',
    costAmount: 1,
  });
  assert.deepEqual(parsePowerActivationCost('2 SANGUE', 'storyteller-v20'), {
    costType: 'blood_point',
    costAmount: 2,
  });
  assert.deepEqual(parsePowerActivationCost('1 WP', 'storyteller-v20'), {
    costType: 'free',
    costAmount: 0,
  });
  assert.deepEqual(parsePowerActivationCost('•••', 'storyteller-v20'), {
    costType: 'free',
    costAmount: 0,
  });

  // Field & Row builders + duplicate detection
  const oblivion = findDisciplineByIdOrName('Obliteração', 'vampire-v5');
  assert.ok(oblivion);
  assert.equal(isCatalogDisciplinePresent(oblivion, ['dominate', 'oblivion']), true);
  assert.equal(isCatalogDisciplinePresent(oblivion, ['dominate']), false);

  const discField = buildCatalogDisciplineField(oblivion, 'pt-BR');
  assert.equal(discField.key, 'oblivion');
  assert.equal(discField.label, 'OBLITERAÇÃO');
  assert.equal(discField.xpCategory, undefined);

  const shadowCast = oblivion.powers.find((p) => p.id === 'v5_oblivion_shadow_cast');
  assert.ok(shadowCast);
  const powerRow = buildCatalogPowerRow(oblivion, shadowCast, 'pt-BR');
  assert.deepEqual(Object.keys(powerRow).sort(), ['col1', 'col2', 'id']);
  assert.equal(powerRow.col2, '1 ROUSE');
  assert.equal(isCatalogPowerPresent(shadowCast, [powerRow]), true);
  assert.equal(isCatalogPowerPresent(shadowCast, []), false);
});
