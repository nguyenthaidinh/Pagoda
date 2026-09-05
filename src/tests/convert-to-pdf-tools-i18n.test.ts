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
import { filterFilesByExtensions } from '../js/utils/conversion-page';
import { getLocalizedToolsPath } from '../js/utils/localized-navigation';

const pageFiles = [
  'image-to-pdf',
  'jpg-to-pdf',
  'png-to-pdf',
  'webp-to-pdf',
  'svg-to-pdf',
  'bmp-to-pdf',
  'heic-to-pdf',
  'tiff-to-pdf',
  'txt-to-pdf',
  'markdown-to-pdf',
  'json-to-pdf',
  'odt-to-pdf',
  'csv-to-pdf',
  'rtf-to-pdf',
  'word-to-pdf',
  'excel-to-pdf',
  'powerpoint-to-pdf',
  'xps-to-pdf',
  'mobi-to-pdf',
  'epub-to-pdf',
] as const;

const toolKeys = [
  'conversion',
  'imageToPdf',
  'jpgToPdf',
  'pngToPdf',
  'webpToPdf',
  'svgToPdf',
  'bmpToPdf',
  'heicToPdf',
  'tiffToPdf',
  'textToPdf',
  'markdownToPdf',
  'jsonToPdf',
  'odtToPdf',
  'csvToPdf',
  'rtfToPdf',
  'wordToPdf',
  'excelToPdf',
  'powerpointToPdf',
  'xpsToPdf',
  'mobiToPdf',
  'epubToPdf',
] as const;

const documentConverterPages = [
  'odt-to-pdf',
  'csv-to-pdf',
  'rtf-to-pdf',
  'word-to-pdf',
  'excel-to-pdf',
  'powerpoint-to-pdf',
  'xps-to-pdf',
  'mobi-to-pdf',
  'epub-to-pdf',
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

function readLogic(name: string): string {
  return readFileSync(resolve(`src/js/logic/${name}.ts`), 'utf8');
}

describe('convert-to-PDF tools shown in the tools grid', () => {
  it('keeps EN, VI, and DE translation keys aligned', () => {
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

  it('defines every explicit page translation in all three languages', () => {
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
              missing.push(`${locale}:${name}:${key}`);
            }
          }
        }
      });
    }
    expect(missing).toEqual([]);
  });

  it('translates image options and text editor controls', async () => {
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

    document.body.innerHTML = readPage('png-to-pdf').body.innerHTML;
    applyTranslations();
    expect(
      document.querySelector<HTMLOptionElement>('option[value="medium"]')
        ?.textContent
    ).toBe(viTools.conversion.qualityMedium);

    document.body.innerHTML = readPage('txt-to-pdf').body.innerHTML;
    applyTranslations();
    expect(
      document.querySelector<HTMLTextAreaElement>('#text-input')?.placeholder
    ).toBe(viTools.conversion.textPlaceholder);
    expect(
      document.querySelector<HTMLOptionElement>('option[value="cour"]')
        ?.textContent
    ).toBe(viTools.conversion.fontCourier);
    expect(document.querySelector<HTMLOptGroupElement>('optgroup')?.label).toBe(
      viTools.conversion.pageGroupA
    );

    await i18next.changeLanguage('de');
    applyTranslations();
    expect(
      document.querySelector<HTMLTextAreaElement>('#text-input')?.placeholder
    ).toBe(deTools.conversion.textPlaceholder);
    expect(document.querySelector<HTMLOptGroupElement>('optgroup')?.label).toBe(
      deTools.conversion.pageGroupA
    );
    await i18next.changeLanguage('en');
  });

  it('has valid cards, pages, and localized navigation for all 20 tools', () => {
    const config = readFileSync(resolve('src/js/config/tools.ts'), 'utf8');
    for (const name of pageFiles) {
      expect(config, name).toContain(`'${name}.html'`);
      expect(() => readPage(name), name).not.toThrow();
    }

    const logicNames = pageFiles.map((name) =>
      name === 'json-to-pdf' ? name : `${name}-page`
    );
    for (const name of logicNames) {
      const source = readLogic(name);
      expect(source, name).not.toContain(
        'window.location.href = import.meta.env.BASE_URL'
      );
      expect(source, name).not.toContain("window.location.href = '/'");
      expect(source, name).not.toContain('Please select at least one');
      expect(source, name).not.toContain('Successfully converted');
    }

    window.history.replaceState({}, '', '/vi/png-to-pdf.html');
    expect(getLocalizedToolsPath()).toBe('/vi/tools.html');
    window.history.replaceState({}, '', '/de/word-to-pdf.html');
    expect(getLocalizedToolsPath()).toBe('/de/tools.html');
  });

  it('uses one validated path for picker and drag-and-drop document files', () => {
    for (const name of documentConverterPages) {
      const source = readLogic(`${name}-page`);
      expect(source, name).toContain('filterFilesByExtensions');
      expect(source, name).not.toContain('new DataTransfer()');
    }

    const { validFiles, rejectedCount } = filterFilesByExtensions(
      [new File(['doc'], 'REPORT.DOCX'), new File(['bad'], 'report.docx.exe')],
      ['docx']
    );
    expect(validFiles.map((file) => file.name)).toEqual(['REPORT.DOCX']);
    expect(rejectedCount).toBe(1);
  });

  it('guards fixed output names, duplicate ZIP entries, and branding', () => {
    expect(readLogic('png-to-pdf-page')).toContain("'from_pngs.pdf'");
    expect(readLogic('png-to-pdf-page')).not.toContain("'from_jpgs.pdf'");
    expect(readLogic('json-to-pdf')).not.toContain(
      'URL.createObjectURL(zipBlob)'
    );
    expect(readLogic('json-to-pdf')).toContain('deduplicateFileName');

    for (const name of documentConverterPages) {
      expect(readLogic(`${name}-page`), name).toContain('deduplicateFileName');
    }

    const markdown = readFileSync(
      resolve('src/js/utils/markdown-editor.ts'),
      'utf8'
    );
    expect(markdown).toContain('PagodaPDF Markdown Editor');
    expect(markdown).not.toContain('BentoPDF');
  });

  it('does not contain duplicate translation attributes', () => {
    const duplicates: string[] = [];
    for (const name of pageFiles) {
      const source = readFileSync(resolve(`src/pages/${name}.html`), 'utf8');
      for (const tag of source.match(/<[^>]+>/gs) ?? []) {
        const attributes = [...tag.matchAll(/\b(data-i18n(?:-[\w-]+)?)=/g)].map(
          (match) => match[1]
        );
        for (const attribute of new Set(attributes)) {
          if (attributes.filter((item) => item === attribute).length > 1) {
            duplicates.push(`${name}:${attribute}`);
          }
        }
      }
    }
    expect(duplicates).toEqual([]);
  });
});
