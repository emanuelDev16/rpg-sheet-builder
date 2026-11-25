import { describe, expect, it } from 'vitest';
import {
  EN,
  ES,
  getTranslations,
  normalizeLanguage,
  PT_BR,
  translate,
} from './core/i18n';

describe('Strict i18n dictionary parity & fallback', () => {
  it('enforces exact key parity and non-empty values across pt-BR, en, and es', () => {
    const ptKeys = Object.keys(PT_BR).sort();
    const enKeys = Object.keys(EN).sort();
    const esKeys = Object.keys(ES).sort();

    expect(enKeys).toEqual(ptKeys);
    expect(esKeys).toEqual(ptKeys);

    for (const key of ptKeys as Array<keyof typeof PT_BR>) {
      expect(PT_BR[key].trim().length, `Empty PT_BR value for ${key}`).toBeGreaterThan(0);
      expect(EN[key].trim().length, `Empty EN value for ${key}`).toBeGreaterThan(0);
      expect(ES[key].trim().length, `Empty ES value for ${key}`).toBeGreaterThan(0);
    }
  });

  it('normalizes regional locale codes safely with pt -> pt-BR fallback', () => {
    expect(normalizeLanguage('pt')).toBe('pt-BR');
    expect(normalizeLanguage('pt-PT')).toBe('pt-BR');
    expect(normalizeLanguage('pt_BR')).toBe('pt-BR');
    expect(normalizeLanguage('en-US')).toBe('en');
    expect(normalizeLanguage('es-419')).toBe('es');
    expect(normalizeLanguage('fr-FR')).toBe('pt-BR');
    expect(normalizeLanguage('')).toBe('pt-BR');
    expect(normalizeLanguage(null)).toBe('pt-BR');
  });

  it('provides localized component strings and interpolation across languages', () => {
    expect(translate('pt-BR', 'theme.light')).toBe('CLARO');
    expect(translate('en', 'theme.light')).toBe('LIGHT');
    expect(translate('es', 'theme.dark')).toBe('OSCURO');

    expect(translate('pt-BR', 'home.themeBadge')).toBe('GRID//SHEET · TEMA');
    expect(translate('en', 'home.themeBadge')).toBe('GRID//SHEET · THEME');

    expect(translate('pt-BR', 'statusBar.mobileRulesBtn')).toBe('// REGRAS');
    expect(translate('en', 'statusBar.mobileRulesBtn')).toBe('// RULES');
    expect(translate('es', 'statusBar.mobileRulesBtn')).toBe('// REGLAS');

    expect(translate('en', 'xp.insufficientBadge', { missing: 5 })).toBe('NEED 5 XP');
    expect(translate('es', 'xp.catalogCount', { possible: 3, total: 10 })).toBe(
      '3 COMPRABLES · 10 TOTAL',
    );

    const ptBundle = getTranslations('pt-BR');
    expect(ptBundle.customBuilder.t('customBuilder.starterHeading')).toBe('TEMPLATE INICIAL');
    const enBundle = getTranslations('en');
    expect(enBundle.cards.t('cards.guided.addFirstField')).toBe('+ ADD FIRST FIELD');

    expect(translate('pt-BR', 'home.wodModalTitle')).toBe('CRIAR PERSONAGEM · WORLD OF DARKNESS');
    expect(translate('en', 'modal.wodClanCustomOption')).toBe('Other (custom)...');
    expect(translate('es', 'modal.wodClanCountHint', { count: 16 })).toBe(
      '16 clanes de la edición + entrada libre',
    );
    expect(translate('pt-BR', 'cards.powers.spendBloodBtn', { cost: 2 })).toBe('-2 SANGUE');
    expect(translate('en', 'cards.powers.rouseBtn')).toBe('ROUSE');
    expect(translate('es', 'xp.caitiffTag', { mult: 6 })).toBe('CAITIFF (×6)');

    expect(
      translate('pt-BR', 'fields.dotRating.groupAria', { label: 'Força', value: 3, max: 5 }),
    ).toBe('Força: 3 de 5');
    expect(
      translate('en', 'fields.dotRating.decreaseDotAria', {
        label: 'Strength',
        dot: 3,
        max: 5,
        next: 2,
      }),
    ).toBe('Strength: level 3 of 5 (click to decrease to 2)');
    expect(
      translate('es', 'fields.dotRating.setDotAria', { label: 'Fuerza', dot: 4, max: 5 }),
    ).toBe('Definir Fuerza en 4 de 5');
    expect(
      translate('en', 'fields.dotRating.quickEditAria', {
        label: 'Strength',
        value: 3,
        max: 5,
      }),
    ).toBe('Edit numeric value for Strength (current: 3 of 5)');

    expect(translate('pt-BR', 'poolComposer.rollAction', { pool: 7 })).toBe('ROLAR PARADA • 7d10');
    expect(translate('en', 'poolComposer.bloodSurgeToggle', { bonus: 3 })).toBe('BLOOD SURGE (+3)');
    expect(translate('es', 'poolComposer.hungerIndicator', { count: 2 })).toBe('ANSIA 2 DADOS');

    expect(translate('pt-BR', 'xp.acquireBtn', { cost: 5 })).toBe('ADQUIRIR · 5 XP ↗');
    expect(translate('en', 'xp.bloodPotencyCat')).toBe('BLOOD POTENCY');
    expect(translate('es', 'cards.advantages.headingV5')).toBe('CATÁLOGO OFICIAL V5 (18 VENTAJAS)');
    expect(translate('en', 'app.xpAcquired', { label: 'AWARENESS', cost: 3 })).toBe(
      '// XP: ACQUIRED AWARENESS (-3 XP)',
    );

    expect(translate('pt-BR', 'xp.ruleV5Virtue')).toBe('VANT 3 XP/PONTO · FV/HUM EM JOGO');
    expect(translate('en', 'xp.ruleV5Virtue')).toBe('ADV 3 XP/DOT · WP/HUM IN-PLAY');
    expect(translate('es', 'xp.ruleV5Virtue')).toBe('VENT 3 XP/PUNTO · VOL/HUM EN JUEGO');

    expect(translate('pt-BR', 'xp.flatPerDotFormula', { cost: 3 })).toBe('3 XP / PONTO');
    expect(translate('en', 'xp.flatPerDotFormula', { cost: 3 })).toBe('3 XP / DOT');
    expect(translate('es', 'xp.flatPerDotFormula', { cost: 3 })).toBe('3 XP / PUNTO');

    expect(translate('pt-BR', 'cards.vital.remorseCheckBtn', { pool: 2 })).toBe('TESTE DE REMORSO (2d10)');
    expect(translate('en', 'cards.vital.wpImpairedBadge')).toBe('IMPAIRED (-2)');
    expect(translate('es', 'cards.vital.frenzyBtn')).toBe('FRENESÍ / RÖTSCHRECK');
    expect(translate('en', 'sidebar.roll.rotschreckBadge')).toBe('RÖTSCHRECK');

    expect(translate('pt-BR', 'cards.vital.mendRouseBtn', { amount: 2 })).toBe('CURAR +2 (ROUSE)');
    expect(translate('en', 'cards.vital.mendRouseBtn', { amount: 3 })).toBe('MEND +3 (ROUSE)');
    expect(translate('es', 'cards.vital.mendRouseBtn', { amount: 2 })).toBe('CURAR +2 (ROUSE)');
    expect(translate('pt-BR', 'cards.vital.baneSeverityBadge', { severity: 4 })).toBe('SEVERIDADE 4');
    expect(translate('en', 'cards.vital.baneSeverityBadge', { severity: 4 })).toBe('SEVERITY 4');
    expect(translate('es', 'cards.vital.baneSeverityBadge', { severity: 4 })).toBe('SEVERIDAD 4');
    expect(translate('en', 'poolComposer.powerBonusBadge', { bonus: 2 })).toBe('+2 POWER (POTENCY)');

    expect(translate('pt-BR', 'cards.structured.touchstonesAddBtn')).toBe('+ ADICIONAR CONVICÇÃO');
    expect(translate('en', 'cards.structured.touchstonesAddBtn')).toBe('+ ADD CONVICTION');
    expect(translate('es', 'cards.structured.touchstonesAddBtn')).toBe('+ AÑADIR CONVICCIÓN');
    expect(
      translate('pt-BR', 'cards.structured.meritsFlawsSummary', { merits: 4, flaws: 2 }),
    ).toBe('+4 QUALIDADES · -2 DEFEITOS');
    expect(
      translate('en', 'cards.structured.meritsFlawsSummary', { merits: 4, flaws: 2 }),
    ).toBe('+4 MERITS · -2 FLAWS');
    expect(
      translate('es', 'cards.structured.meritsFlawsSummary', { merits: 4, flaws: 2 }),
    ).toBe('+4 MÉRITOS · -2 DEFECTOS');
    expect(translate('pt-BR', 'cards.structured.havensAddBtn')).toBe('+ ADICIONAR REFÚGIO');
    expect(translate('en', 'cards.structured.havensAddBtn')).toBe('+ ADD HAVEN');
    expect(translate('es', 'cards.structured.havensAddBtn')).toBe('+ AÑADIR REFUGIO');

    expect(translate('pt-BR', 'wizard.modeGuided')).toBe('ASSISTENTE GUIADO (4 PASSOS)');
    expect(translate('en', 'wizard.modeGuided')).toBe('GUIDED WIZARD (4 STEPS)');
    expect(translate('es', 'wizard.modeGuided')).toBe('ASISTENTE GUIADO (4 PASOS)');
    expect(translate('pt-BR', 'wizard.finishBtn')).toBe('CONCLUIR E CRIAR FICHA');
    expect(translate('en', 'wizard.finishBtn')).toBe('FINISH & CREATE SHEET');
    expect(translate('es', 'wizard.finishBtn')).toBe('FINALIZAR Y CREAR HOJA');

    expect(translate('pt-BR', 'xp.dismissErrorAria')).toBe('Fechar alerta');
    expect(translate('en', 'xp.dismissErrorAria')).toBe('Dismiss alert');
    expect(translate('es', 'xp.dismissErrorAria')).toBe('Cerrar alerta');
    expect(translate('en', 'wizard.powerLevelShort', { level: 2 })).toBe('L2');
    expect(translate('pt-BR', 'print.pureHtmlDossierTitle')).toBe('CONVICÇÕES, QUALIDADES & REFÚGIOS');

    expect(translate('pt-BR', 'cards.addButton')).toBe('ADICIONAR');
    expect(translate('pt-BR', 'sidebar.roll.messyCritical')).toBe('CRÍTICO SANGRENTO!');
    expect(translate('pt-BR', 'sidebar.roll.bestialFailure')).toBe('FALHA BESTIAL!');
    expect(translate('pt-BR', 'poolComposer.wpToggle')).toBe('+1 VONTADE');
    expect(translate('pt-BR', 'xp.upgradeBtn', { cost: 4 })).toBe('EVOLUIR · 4 XP ↗');
    expect(translate('es', 'sidebar.roll.hungerShort', { count: 2 })).toBe('A:2');
    expect(translate('pt-BR', 'modal.saveLocalAction')).toBe('SALVAR ↗');
    expect(translate('es', 'rules.suggestions.wod')).toContain('Ansia');
  });

  it('maintains identical interpolation placeholders and guards against accidental untranslated PT-BR entries', () => {
    const ALLOWED_IDENTICAL_PT_EN_KEYS = new Set([
      'system.wod.label',
      'system.wod.short',
      'system.dnd5e.short',
      'system.cyberpunk.label',
      'system.cyberpunk.short',
      'home.customGridTag',
      'tabNav.rulePresetV20',
      'tabNav.rulePresetV5',
      'tabNav.rulePresetCustom',
      'cards.defaultItemCol',
      'cards.supEqTag',
      'cards.col1Label',
      'cards.col2Label',
      'cards.strip.var',
      'cards.strip.col1',
      'cards.strip.col2',
      'cards.pool.mod',
      'cards.disciplines.caitiffBadge',
      'cards.disciplines.customCostRouse',
      'cards.powers.rouseBtn',
      'cards.powers.rouseMultiBtn',
      'cards.powers.rouseLogPrefix',
      'cards.vital.v20TrackRule',
      'cards.vital.rouseCheckBtn',
      'cards.vital.wpImpairedBadge',
      'cards.vital.wpSuperficialDmg',
      'cards.vital.bpSurge',
      'cards.vital.bpMendValue',
      'cards.vital.bpRouseRerollNone',
      'cards.vital.frenzyKindRotschreck',
      'cards.structured.touchstonesCounter',
      'sidebar.roll.surgeChip',
      'sidebar.roll.rousePass',
      'sidebar.roll.rotschreckBadge',
      'sidebar.roll.mendRouseHealedChip',
      'sidebar.roll.sucSingular',
      'sidebar.roll.sucPlural',
      'poolComposer.specToggle',
      'poolComposer.bloodSurgeToggle',
      'poolComposer.bloodSurgeRouseTag',
      'statusBar.logs',
      'statusBar.mobileLogsBtn',
      'statusBar.roomSyncingLabel',
      'statusBar.roomRetryLabel',
      'statusBar.roomSyncLabel',
      'modal.snapshotReasonManual',
      'modal.defaultTemplateName',
      'xp.presetCustom',
      'xp.caitiffTag',
      'xp.multiplierLabel',
      'xp.acquireCaitiffTag',
      'app.fieldDefault.calculated',
      'app.xpBackgroundFlash',
      'theme.eink',
    ]);

    const extractPlaceholders = (s: string) =>
      [...s.matchAll(/\{\{([a-zA-Z0-9_]+)\}\}/g)].map((m) => m[1]).sort();

    for (const key of Object.keys(PT_BR) as Array<keyof typeof PT_BR>) {
      const ptPh = extractPlaceholders(PT_BR[key]);
      const enPh = extractPlaceholders(EN[key]);
      const esPh = extractPlaceholders(ES[key]);
      expect(enPh, `Placeholder mismatch in EN for ${key}`).toEqual(ptPh);
      expect(esPh, `Placeholder mismatch in ES for ${key}`).toEqual(ptPh);

      if (PT_BR[key] === EN[key]) {
        expect(
          ALLOWED_IDENTICAL_PT_EN_KEYS.has(key),
          `Untranslated PT_BR key matches EN unexpectedly: ${key} = ${PT_BR[key]}`,
        ).toBe(true);
      }
    }
  });
});
