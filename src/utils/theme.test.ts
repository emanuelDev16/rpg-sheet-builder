import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyThemeToDocument,
  DEFAULT_THEME,
  isValidTheme,
  normalizeTheme,
  persistTheme,
  readStoredTheme,
  THEME_OPTIONS,
  THEME_STORAGE_KEY,
} from './theme.ts';

test('THEME_OPTIONS exposes CLARO, ESCURO, and E-INK in order', () => {
  assert.deepEqual(THEME_OPTIONS, [
    { id: 'light', label: 'CLARO' },
    { id: 'dark', label: 'ESCURO' },
    { id: 'eink', label: 'E-INK' },
  ]);
  assert.equal(THEME_STORAGE_KEY, 'gridsheet_theme');
  assert.equal(DEFAULT_THEME, 'light');
});

test('isValidTheme and normalizeTheme validate and sanitize theme values', () => {
  assert.equal(isValidTheme('light'), true);
  assert.equal(isValidTheme('dark'), true);
  assert.equal(isValidTheme('eink'), true);
  assert.equal(isValidTheme('sepia'), false);
  assert.equal(isValidTheme(null), false);

  assert.equal(normalizeTheme('DARK'), 'dark');
  assert.equal(normalizeTheme('  eink '), 'eink');
  assert.equal(normalizeTheme('unknown'), 'light');
  assert.equal(normalizeTheme(undefined), 'light');
});

test('readStoredTheme and persistTheme round-trip safely through storage', () => {
  const map = new Map<string, string>();
  const mockStorage = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };

  assert.equal(readStoredTheme(mockStorage), 'light');
  persistTheme('dark', mockStorage);
  assert.equal(map.get('gridsheet_theme'), 'dark');
  assert.equal(readStoredTheme(mockStorage), 'dark');

  persistTheme('eink', mockStorage);
  assert.equal(readStoredTheme(mockStorage), 'eink');

  map.set('gridsheet_theme', 'invalid_theme');
  assert.equal(readStoredTheme(mockStorage), 'light');
});

test('readStoredTheme and persistTheme tolerate throwing storage', () => {
  const brokenStorage = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('blocked');
    },
  };

  assert.equal(readStoredTheme(brokenStorage), 'light');
  assert.doesNotThrow(() => persistTheme('eink', brokenStorage));
});

test('applyThemeToDocument updates dataset.theme safely', () => {
  const fakeRoot = { dataset: {} as Record<string, string> } as unknown as HTMLElement;
  applyThemeToDocument('dark', fakeRoot);
  assert.equal(fakeRoot.dataset.theme, 'dark');

  applyThemeToDocument('eink', fakeRoot);
  assert.equal(fakeRoot.dataset.theme, 'eink');
});
