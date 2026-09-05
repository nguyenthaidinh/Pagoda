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
import { filterPdfFiles, pdfFileMeta } from '../js/utils/pdf-export-page';
import { getLocalizedToolsPath } from '../js/utils/localized-navigation';

const pageFiles = [
  'pdf-to-jpg',
  'pdf-to-png',
  'pdf-to-webp',
  'pdf-to-bmp',
  'pdf-to-tiff',
  'pdf-to-cbz',
  'pdf-to-svg',
  'pdf-to-csv',
  'pdf-to-excel',
  'pdf-to-greyscale',
  'pdf-to-json',
  'pdf-to-docx',
  'extract-images',
  'pdf-to-markdown',
  'prepare-pdf-for-ai',
  'pdf-to-text',
] as const;

const toolKeys = [
  'pdfExport',
  'pdfToJpg',
  'pdfToPng',
  'pdfToWebp',
  'pdfToBmp',
  'pdfToTiff',
  'pdfToCbz',
  'pdfToSvg',
  'pdfToCsv',
  'pdfToExcel',
  'pdfToGreyscale',
  'pdfToJson',
  'pdfToWord',
  'extractImages',
  'pdfToMarkdown',
  'preparePdfForAi',
  'pdfToText',
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

describe('convert-from-PDF tools shown in the tools grid', () => {
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

  it('translates options, placeholders, and action buttons', async () => {
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

    document.body.innerHTML = readPage('pdf-to-tiff').body.innerHTML;
    applyTranslations();
    expect(
      document.querySelector<HTMLOptionElement>('option[value="ccittfax4"]')
        ?.textContent
    ).toBe(viTools.pdfToTiff.compressionCcitt);

    document.body.innerHTML = readPage('pdf-to-cbz').body.innerHTML;
    applyTranslations();
    expect(
      document.querySelector<HTMLInputElement>('#cbz-title')?.placeholder
    ).toBe(viTools.pdfToCbz.titlePlaceholder);

    document.body.innerHTML = readPage('extract-images').body.innerHTML;
    applyTranslations();
    expect(document.querySelector('#process-btn')?.textContent).toBe(
      viTools.pdfExport.extractImagesButton
    );

    await i18next.changeLanguage('de');
    document.body.innerHTML = readPage('pdf-to-markdown').body.innerHTML;
    applyTranslations();
    expect(document.querySelector('#process-btn')?.textContent).toBe(
      deTools.pdfExport.convertToMarkdown
    );
    await i18next.changeLanguage('en');
  });

  it('uses localized navigation and one PDF validation path on all 16 pages', () => {
    const config = readFileSync(resolve('src/js/config/tools.ts'), 'utf8');
    for (const name of pageFiles) {
      expect(config, name).toContain(`${name}.html`);
      expect(() => readPage(name), name).not.toThrow();

      const logicName = name === 'pdf-to-json' ? name : `${name}-page`;
      const source = readLogic(logicName);
      const pageSource = readFileSync(
        resolve(`src/pages/${name}.html`),
        'utf8'
      );
      expect(pageSource, name).toContain(`/src/js/logic/${logicName}.ts`);
      expect(source, logicName).toContain('filterPdfFiles');
      expect(source, logicName).toContain('goToLocalizedTools');
      expect(source, logicName).not.toContain(
        'window.location.href = import.meta.env.BASE_URL'
      );
      expect(source, logicName).not.toContain("window.location.href = '/'");
    }

    window.history.replaceState({}, '', '/vi/pdf-to-svg.html');
    expect(getLocalizedToolsPath()).toBe('/vi/tools.html');
    window.history.replaceState({}, '', '/de/pdf-to-docx.html');
    expect(getLocalizedToolsPath()).toBe('/de/tools.html');
  });

  it('accepts real PDF extensions and rejects disguised files', () => {
    const { validFiles, rejectedCount } = filterPdfFiles([
      new File(['pdf'], 'REPORT.PDF'),
      new File(['bad'], 'report.pdf.exe', { type: 'application/octet-stream' }),
    ]);
    expect(validFiles.map((file) => file.name)).toEqual(['REPORT.PDF']);
    expect(rejectedCount).toBe(1);
  });

  it('localizes dynamic metadata and protects generated output', async () => {
    await i18next.changeLanguage('vi');
    expect(pdfFileMeta('2 MB', 3)).toContain(viCommon.common.pages);
    expect(pdfFileMeta('2 MB', null)).toContain(
      viTools.pdfExport.pageCountUnavailable
    );

    const greyscale = readLogic('pdf-to-greyscale-page');
    expect(greyscale).toContain('convertPdfToGreyscale(result.file)');
    expect(greyscale).not.toContain('embedJpg');
    const svg = readLogic('pdf-to-svg-page');
    expect(svg).toContain('deduplicateFileName');
    expect(svg).toContain('doc.close()');
    expect(readLogic('pdf-to-csv-page')).toContain('doc.close()');
    expect(readLogic('pdf-to-excel-page')).toContain('doc.close()');

    const extractImages = readLogic('extract-images-page');
    expect(extractImages).toContain('URL.revokeObjectURL');
    expect(extractImages).toContain('type: `image/${imageType}`');
    expect(extractImages).toContain('doc.close()');

    const cbz = readLogic('pdf-to-cbz-page');
    expect(cbz).not.toContain('Year must be between');
    expect(cbz).not.toContain('Rating must be between');
    expect(readLogic('pdf-to-tiff-page')).not.toContain(
      'Failed to load the image processor. Please ensure'
    );
    await i18next.changeLanguage('en');
  });

  it('contains no mojibake or duplicate translation attributes', () => {
    const duplicates: string[] = [];
    const sources = [
      readFileSync(resolve('src/js/utils/pdf-export-page.ts'), 'utf8'),
    ];

    for (const name of pageFiles) {
      const logicName = name === 'pdf-to-json' ? name : `${name}-page`;
      sources.push(readLogic(logicName));
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

    expect(sources.join('\n')).not.toContain('â€¢');
    expect(duplicates).toEqual([]);
  });
});
