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
  });
});
