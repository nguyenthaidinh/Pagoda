import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import enCommon from '../../public/locales/en/common.json';
import deCommon from '../../public/locales/de/common.json';
import viCommon from '../../public/locales/vi/common.json';
import enTools from '../../public/locales/en/tools.json';
import deTools from '../../public/locales/de/tools.json';
import viTools from '../../public/locales/vi/tools.json';
import i18next, { applyTranslations } from '../js/i18n/i18n';
import { getLocalizedToolsPath } from '../js/utils/localized-navigation';

const toolKeys = [
  'pdfEditor',
  'editPdfText',
  'editBookmarks',
  'tableOfContents',
  'pageNumbers',
  'addPageLabels',
  'batesNumbering',
  'addWatermark',
  'headerFooter',
  'invertColors',
  'scannerEffect',
  'adjustColors',
  'backgroundColor',
  'changeTextColor',
  'signPdf',
] as const;

const pageFiles = [
  'edit-pdf',
  'edit-pdf-text',
  'bookmark',
  'table-of-contents',
  'page-numbers',
  'add-page-labels',
  'bates-numbering',
  'add-watermark',
  'header-footer',
  'invert-colors',
  'scanner-effect',
  'adjust-colors',
  'background-color',
  'text-color',
  'sign-pdf',
] as const;

const logicFiles = [
  'edit-pdf-page',
  'edit-pdf-text-page',
  'bookmark-pdf',
  'table-of-contents',
  'page-numbers-page',
  'add-page-labels-page',
  'bates-numbering-page',
  'add-watermark-page',
  'header-footer-page',
  'invert-colors-page',
  'scanner-effect-page',
  'adjust-colors-page',
  'background-color-page',
  'text-color-page',
  'sign-pdf-page',
] as const;

function flattenKeys(
  value: unknown,
  prefix = '',
  keys = new Set<string>()
): Set<string> {
  if (!value || typeof value !== 'object') return keys;

  for (const [key, entry] of Object.entries(value)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (typeof entry === 'string') keys.add(nextKey);
    else flattenKeys(entry, nextKey, keys);
  }

  return keys;
}

function getValue(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object') return undefined;
    return (current as Record<string, unknown>)[key];
  }, value);
}

function readPage(name: (typeof pageFiles)[number]): Document {
  return new DOMParser().parseFromString(
    readFileSync(resolve(`src/pages/${name}.html`), 'utf8'),
    'text/html'
  );
}

describe('edit and annotation tool translations and regressions', () => {
  it('keeps all translation sections aligned in EN, VI, and DE', () => {
    for (const key of toolKeys) {
      const englishKeys = [...flattenKeys(enTools[key])].sort();
      expect([...flattenKeys(viTools[key])].sort(), `vi:${key}`).toEqual(
        englishKeys
      );
      expect([...flattenKeys(deTools[key])].sort(), `de:${key}`).toEqual(
        englishKeys
      );
    }
  });

  it('defines every explicit tool translation used by the 15 pages', () => {
    const missing: string[] = [];

    for (const name of pageFiles) {
      const page = readPage(name);
      page.querySelectorAll('*').forEach((element) => {
        for (const attribute of element.attributes) {
          if (!attribute.name.startsWith('data-i18n')) continue;
          if (!attribute.value.startsWith('tools:')) continue;
          const key = attribute.value.slice('tools:'.length);
          for (const [locale, resources] of Object.entries({
            en: enTools,
            vi: viTools,
            de: deTools,
          })) {
            if (getValue(resources, key) === undefined) {
              missing.push(`${locale}:${name}: ${key}`);
            }
          }
        }
      });
    }

    expect(missing).toEqual([]);
  });

  it('defines every dynamic tool translation used by the page logic', () => {
    const missing: string[] = [];
    const translationCall = /\b(?:t|translate)\(['"]tools:([^'"]+)['"]/g;

    for (const name of logicFiles) {
      const source = readFileSync(resolve(`src/js/logic/${name}.ts`), 'utf8');
      for (const match of source.matchAll(translationCall)) {
        for (const [locale, resources] of Object.entries({
          en: enTools,
          vi: viTools,
          de: deTools,
        })) {
          if (getValue(resources, match[1]) === undefined) {
            missing.push(`${locale}:${name}: ${match[1]}`);
          }
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it('translates textual select options while preserving form controls', () => {
    const missing: string[] = [];
    const internationalFontNames = new Set([
      'Helvetica',
      'Times New Roman',
      'Courier',
    ]);

    for (const name of pageFiles) {
      const page = readPage(name);
      page.querySelectorAll('option').forEach((option) => {
        const label = option.textContent?.trim() ?? '';
        const isLanguageNeutral =
          /^[\d\s.,/%]+(?:pt)?$/.test(label) ||
          /^(?:[a-z]+\.\s*)+$/i.test(label);
        if (
          label &&
          !isLanguageNeutral &&
          !internationalFontNames.has(label) &&
          !option.hasAttribute('data-i18n')
        ) {
          missing.push(`${name}: ${label}`);
        }
      });

      expect(page.querySelectorAll('label[data-i18n] input')).toHaveLength(0);
      page.querySelectorAll('summary').forEach((summary) => {
        expect(summary.hasAttribute('data-i18n')).toBe(false);
        expect(summary.querySelector('[data-i18n]')).not.toBeNull();
      });
    }

    expect(missing).toEqual([]);
  });

  it('applies Vietnamese and German translations to Bates select options', async () => {
    await i18next.init({
      lng: 'vi',
      fallbackLng: 'en',
      ns: ['common', 'tools'],
      defaultNS: 'common',
      resources: {
        en: { common: enCommon, tools: enTools },
        vi: { common: viCommon, tools: viTools },
        de: { common: deCommon, tools: deTools },
      },
    });
    document.body.innerHTML = readPage('bates-numbering').body.innerHTML;

    applyTranslations();
    expect(
      document.querySelector<HTMLOptionElement>('option[value="full-6"]')
        ?.textContent
    ).toBe(viTools.batesNumbering.presetFull6);
    expect(
      document.querySelector<HTMLOptGroupElement>(
        'optgroup[data-i18n-label="tools:batesNumbering.groupFull"]'
      )?.label
    ).toBe(viTools.batesNumbering.groupFull);

    await i18next.changeLanguage('de');
    applyTranslations();
    expect(
      document.querySelector<HTMLOptionElement>('option[value="full-6"]')
        ?.textContent
    ).toBe(deTools.batesNumbering.presetFull6);
    expect(
      document.querySelector<HTMLOptGroupElement>(
        'optgroup[data-i18n-label="tools:batesNumbering.groupFull"]'
      )?.label
    ).toBe(deTools.batesNumbering.groupFull);

    await i18next.changeLanguage('en');
  });

  it('keeps rasterized PDF pages at their original dimensions', () => {
    const invert = readFileSync(
      resolve('src/js/logic/invert-colors-page.ts'),
      'utf8'
    );
    const scanner = readFileSync(
      resolve('src/js/logic/scanner-effect-page.ts'),
      'utf8'
    );

    expect(invert).toContain('const originalViewport = page.getViewport');
    expect(scanner).toContain('const originalViewport = page.getViewport');
    expect(invert).not.toContain('addPage([image.width');
    expect(scanner).not.toContain('addPage([outputCanvas.width');
  });

  it('uses translated Bates templates and sanitizes bookmark imports', () => {
    const bates = readFileSync(
      resolve('src/js/logic/bates-numbering-page.ts'),
      'utf8'
    );
    const bookmarks = readFileSync(
      resolve('src/js/logic/bookmark-pdf.ts'),
      'utf8'
    );

    expect(bates).toContain('getLocalizedPresetTemplate(value)');
    expect(bates).toContain("t('tools:batesNumbering.templateFull')");
    expect(bates).toContain('embedFontForText(');
    expect(bookmarks).toContain('sanitizeImportedTree(JSON.parse(text))');
    expect(bookmarks).toContain('convertToPdfPoint');
    expect(bookmarks).toContain('convertToViewportPoint');
  });

  it('returns to the tools page without losing the active language', () => {
    for (const [pathname, expected] of [
      ['/vi/page-numbers.html', '/vi/tools.html'],
      ['/de/add-watermark.html', '/de/tools.html'],
      ['/en/sign-pdf.html', '/tools.html'],
    ]) {
      window.history.replaceState({}, '', pathname);
      expect(getLocalizedToolsPath(), pathname).toBe(expected);
    }

    for (const name of logicFiles) {
      const source = readFileSync(resolve(`src/js/logic/${name}.ts`), 'utf8');
      expect(source, name).toContain('goToLocalizedTools');
      expect(source, name).not.toContain(
        'window.location.href = import.meta.env.BASE_URL'
      );
    }
  });
});
