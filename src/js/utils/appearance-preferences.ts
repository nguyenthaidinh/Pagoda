import { getStoredItem, setStoredItem } from './safe-storage.js';

export type ThemePreference = 'light' | 'dark';

export const FONT_SCALE_MIN = 0.9;
export const FONT_SCALE_MAX = 1.2;
export const FONT_SCALE_STEP = 0.1;

const THEME_STORAGE_KEY = 'themeMode';
const FONT_SCALE_STORAGE_KEY = 'fontScale';

const clampFontScale = (value: number): number => {
  const clamped = Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, value));
  return Math.round(clamped * 10) / 10;
};

export const getThemePreference = (): ThemePreference =>
  getStoredItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';

export const getFontScale = (): number => {
  const storedValue = Number.parseFloat(
    getStoredItem(FONT_SCALE_STORAGE_KEY) ?? ''
  );
  return Number.isFinite(storedValue) ? clampFontScale(storedValue) : 1;
};

export const applyThemePreference = (theme: ThemePreference): void => {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;

  const themeColor = document.querySelector<HTMLMetaElement>(
    'meta[name="theme-color"]'
  );
  themeColor?.setAttribute('content', theme === 'dark' ? '#08111f' : '#38bdf8');
};

export const setThemePreference = (theme: ThemePreference): void => {
  setStoredItem(THEME_STORAGE_KEY, theme);
  applyThemePreference(theme);
};

export const applyFontScale = (scale: number): void => {
  const normalizedScale = clampFontScale(scale);
  document.documentElement.style.fontSize = `${Math.round(normalizedScale * 100)}%`;
  document.documentElement.dataset.fontScale = normalizedScale.toString();
};

export const setFontScale = (scale: number): number => {
  const normalizedScale = clampFontScale(scale);
  setStoredItem(FONT_SCALE_STORAGE_KEY, normalizedScale.toString());
  applyFontScale(normalizedScale);
  return normalizedScale;
};

export const initializeAppearancePreferences = (): void => {
  applyThemePreference(getThemePreference());
  applyFontScale(getFontScale());

  window.addEventListener('storage', (event) => {
    if (event.key === THEME_STORAGE_KEY) {
      applyThemePreference(event.newValue === 'dark' ? 'dark' : 'light');
    }
    if (event.key === FONT_SCALE_STORAGE_KEY) {
      const nextScale = Number.parseFloat(event.newValue ?? '');
      applyFontScale(Number.isFinite(nextScale) ? nextScale : 1);
    }
  });
};
