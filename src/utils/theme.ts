export type ThemeMode = 'light' | 'dark' | 'eink';

export const THEME_STORAGE_KEY = 'gridsheet_theme';
export const DEFAULT_THEME: ThemeMode = 'light';

export interface ThemeOption {
  id: ThemeMode;
  label: string;
}

export const THEME_OPTIONS: ReadonlyArray<ThemeOption> = [
  { id: 'light', label: 'CLARO' },
  { id: 'dark', label: 'ESCURO' },
  { id: 'eink', label: 'E-INK' },
];

export function isValidTheme(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'eink';
}

export function normalizeTheme(value: unknown): ThemeMode {
  if (typeof value !== 'string') return DEFAULT_THEME;
  const normalized = value.trim().toLowerCase();
  if (isValidTheme(normalized)) {
    return normalized;
  }
  return DEFAULT_THEME;
}

export function readStoredTheme(
  storage: Pick<Storage, 'getItem'> | null | undefined =
    typeof window !== 'undefined' ? window.localStorage : null,
): ThemeMode {
  if (!storage) return DEFAULT_THEME;
  try {
    return normalizeTheme(storage.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

export function persistTheme(
  theme: ThemeMode,
  storage: Pick<Storage, 'setItem'> | null | undefined =
    typeof window !== 'undefined' ? window.localStorage : null,
): void {
  if (!storage) return;
  try {
    storage.setItem(THEME_STORAGE_KEY, normalizeTheme(theme));
  } catch {
    // Ignore storage write failures (e.g. private browsing restrictions)
  }
}

export function applyThemeToDocument(
  theme: ThemeMode,
  root: HTMLElement | null | undefined =
    typeof document !== 'undefined' ? document.documentElement : null,
): void {
  if (!root) return;
  root.dataset.theme = normalizeTheme(theme);
}
