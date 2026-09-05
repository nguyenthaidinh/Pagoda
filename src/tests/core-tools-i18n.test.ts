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
import { vietnameseEmbedPdfLocale } from '../js/i18n/embedpdf-vi';

const toolKeys = [
  'compressPdf',
  'pdfEditor',
  'jpgToPdf',
  'signPdf',
  'cropPdf',
  'extractPages',
  'duplicateOrganize',
  'deletePages',
] as const;

const pageFiles = [
  'compress-pdf',
  'edit-pdf',
  'jpg-to-pdf',
  'sign-pdf',
  'crop-pdf',
  'extract-pages',
  'organize-pdf',
  'delete-pages',
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

describe('core PDF tool translations and regressions', () => {
  it('keeps all eight translation sections aligned in EN, VI, and DE', () => {
    for (const key of toolKeys) {
      const englishKeys = [...flattenKeys(enTools[key])].sort();
      expect([...flattenKeys(viTools[key])].sort(), `vi:${key}`).toEqual(
        englishKeys
      );
      expect([...flattenKeys(deTools[key])].sort(), `de:${key}`).toEqual(
        englishKeys
      );
    }

    expect(viCommon.faq.fileSizeLimit).toBeDefined();
    expect(deCommon.faq.fileSizeLimit).toBeDefined();
  });

  it('defines every explicit tool translation used by these pages', () => {
    const missing: string[] = [];

    for (const name of pageFiles) {
      const page = readPage(name);
      page.querySelectorAll('*').forEach((element) => {
        for (const attribute of element.attributes) {
          if (!attribute.name.startsWith('data-i18n')) continue;
          if (!attribute.value.startsWith('tools:')) continue;
          const key = attribute.value.slice('tools:'.length);
          if (getValue(enTools, key) === undefined) {
            missing.push(`${name}: ${key}`);
          }
        }
      });
    }

    expect(missing).toEqual([]);
  });

  it('translates options without removing inputs or FAQ icons', () => {
    const compressPage = readPage('compress-pdf');
    const jpgPage = readPage('jpg-to-pdf');

    compressPage
      .querySelectorAll(
        '#compression-algorithm option, #compression-level option'
      )
      .forEach((option) => expect(option.hasAttribute('data-i18n')).toBe(true));
    jpgPage
      .querySelectorAll('#jpg-pdf-quality option')
      .forEach((option) => expect(option.hasAttribute('data-i18n')).toBe(true));

    for (const name of pageFiles) {
      const page = readPage(name);
      expect(page.querySelectorAll('label[data-i18n] input')).toHaveLength(0);
      page.querySelectorAll('summary').forEach((summary) => {
        expect(summary.hasAttribute('data-i18n')).toBe(false);
        expect(summary.querySelector('[data-i18n]')).not.toBeNull();
        expect(summary.querySelector('i')).not.toBeNull();
      });
    }
  });

  it('translates related tool cards, including the edit-pdf alias', async () => {
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
    document.body.innerHTML = `
      <div data-related-tools>
        <a href="edit-pdf.html"><h3>Edit PDF</h3><p>Editor</p></a>
        <a href="crop-pdf.html"><h3>Crop PDF</h3><p>Crop</p></a>
      </div>
    `;

    applyTranslations();

    const cards = document.querySelectorAll('[data-related-tools] a');
    expect(cards[0].querySelector('h3')?.textContent).toBe(
      viTools.pdfEditor.name
    );
    expect(cards[1].querySelector('p')?.textContent).toBe(
      viTools.cropPdf.subtitle
    );
    await i18next.changeLanguage('en');
  });

  it('provides a complete Vietnamese locale for the embedded PDF editor', () => {
    expect(vietnameseEmbedPdfLocale.code).toBe('vi');
    expect(flattenKeys(vietnameseEmbedPdfLocale.translations).size).toBe(266);
  });

  it('guards the fixed PDF processing paths', () => {
    const compress = readFileSync(
      resolve('src/js/logic/compress-pdf-page.ts'),
      'utf8'
    );
    const crop = readFileSync(resolve('src/js/logic/crop-pdf-page.ts'), 'utf8');
    const deletePages = readFileSync(
      resolve('src/js/logic/delete-pages-page.ts'),
      'utf8'
    );
    const organize = readFileSync(
      resolve('src/js/logic/organize-pdf-page.ts'),
      'utf8'
    );
    const sign = readFileSync(resolve('src/js/logic/sign-pdf-page.ts'), 'utf8');

    expect(compress).toContain('return compressRenderedPdf(pdfJsDoc, level)');
    expect(crop).toContain('newPdfDoc.embedJpg(jpegBytes)');
    expect(crop).not.toContain('embedPng(jpegBytes)');
    expect(deletePages).toContain('const inputValue = pagesInput.value.trim()');
    expect(deletePages).toContain(': new Set();');
    expect(organize).toContain('currentThumbnails[pageNum - 1]');
    expect(organize).toContain('renumberPages();');
    expect(sign).toContain('const ready = await updateFileDisplay()');
    expect(sign).toContain('locale: document.documentElement.lang');
  });
});
