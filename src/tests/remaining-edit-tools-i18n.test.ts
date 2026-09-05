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

const toolKeys = [
  'addStamps',
  'removeAnnotations',
  'cropPdf',
  'pdfFormFiller',
  'createPdfForm',
  'removeBlankPages',
] as const;

const pageFiles = [
  'add-stamps',
  'remove-annotations',
  'crop-pdf',
  'form-filler',
  'form-creator',
  'remove-blank-pages',
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

describe('remaining edit and annotation tools', () => {
  it('keeps translation keys aligned in EN, VI, and DE', () => {
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

  it('defines each explicit page translation in all three languages', () => {
    const missing: string[] = [];

    for (const pageName of pageFiles) {
      const page = readPage(pageName);
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
              missing.push(`${locale}:${pageName}: ${key}`);
            }
          }
        }
      });
    }

    expect(missing).toEqual([]);
  });

  it('defines each form creator translation used by dynamic controls', () => {
    const source = readFileSync(
      resolve('src/js/logic/form-creator.ts'),
      'utf8'
    );
    const calls = /\b(?:formText|safeFormText)\(['"]([^'"]+)['"]/g;
    const missing = [...source.matchAll(calls)]
      .map((match) => match[1])
      .filter((key) => getValue(enTools.createPdfForm, key) === undefined);

    expect(missing).toEqual([]);
  });

  it('translates form creator options and tooltips', async () => {
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
    document.body.innerHTML = readPage('form-creator').body.innerHTML;

    applyTranslations();
    expect(
      document.querySelector<HTMLOptionElement>('option[value="custom"]')
        ?.textContent
    ).toBe(viTools.createPdfForm.pageSizeCustom);
    expect(document.getElementById('toggleGridBtn')?.title).toBe(
      viTools.createPdfForm.toggleGrid
    );

    await i18next.changeLanguage('de');
    applyTranslations();
    expect(
      document.querySelector<HTMLOptionElement>('option[value="custom"]')
        ?.textContent
    ).toBe(deTools.createPdfForm.pageSizeCustom);
    await i18next.changeLanguage('en');
  });

  it('guards PDF output dimensions, viewer locales, and reset state', () => {
    const crop = readFileSync(resolve('src/js/logic/crop-pdf-page.ts'), 'utf8');
    const stamps = readFileSync(resolve('src/js/logic/add-stamps.ts'), 'utf8');
    const filler = readFileSync(
      resolve('src/js/logic/form-filler-page.ts'),
      'utf8'
    );
    const creator = readFileSync(
      resolve('src/js/logic/form-creator.ts'),
      'utf8'
    );

    expect(crop).toContain('const outputViewport = page.getViewport');
    expect(crop).toContain('newPdfDoc.addPage([outputWidth, outputHeight])');
    expect(stamps).toContain('locale: getLanguageFromUrl()');
    expect(filler).toContain('locale: getLanguageFromUrl()');
    expect(creator).toContain('embedLatinExtendedPdfFont(pdfDoc, false)');
    expect(creator).toContain('existingRadioGroups.clear()');
    expect(creator).toContain("pdfDoc.setAuthor('PagodaPDF')");
    expect(creator).not.toContain("pdfDoc.setAuthor('BentoPDF')");
  });
});
