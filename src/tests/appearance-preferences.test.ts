import { beforeEach, describe, expect, it } from 'vitest';
import {
  applyThemePreference,
  getFontScale,
  getThemePreference,
  setFontScale,
  setThemePreference,
} from '@/js/utils/appearance-preferences';

describe('appearance preferences', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
    delete document.documentElement.dataset.fontScale;
    document.documentElement.style.removeProperty('color-scheme');
    document.documentElement.style.removeProperty('font-size');
  });

  it('uses the existing light theme and default text size by default', () => {
    expect(getThemePreference()).toBe('light');
    expect(getFontScale()).toBe(1);
  });

  it('persists and applies the selected theme', () => {
    document.head.innerHTML = '<meta name="theme-color" content="#38bdf8">';

    setThemePreference('dark');

    expect(localStorage.getItem('themeMode')).toBe('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.colorScheme).toBe('dark');
    expect(
      document
        .querySelector('meta[name="theme-color"]')
        ?.getAttribute('content')
    ).toBe('#08111f');

    applyThemePreference('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('persists text size and keeps it within the supported range', () => {
    expect(setFontScale(1.1)).toBe(1.1);
    expect(localStorage.getItem('fontScale')).toBe('1.1');
    expect(document.documentElement.style.fontSize).toBe('110%');

    expect(setFontScale(5)).toBe(1.2);
    expect(document.documentElement.style.fontSize).toBe('120%');

    expect(setFontScale(0.2)).toBe(0.9);
    expect(document.documentElement.style.fontSize).toBe('90%');
  });
});
