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
import {
  localizeOcrLanguage,
  translateWorkflowOptionLabel,
} from '../js/workflow/i18n';

const popularToolKeys = [
  'editPdfText',
  'pdfWorkflow',
  'pdfMultiTool',
  'mergePdf',
  'splitPdf',
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

describe('popular tool translations', () => {
  it('keeps the five tool sections in sync for all supported languages', () => {
    for (const key of popularToolKeys) {
      const englishKeys = [...flattenKeys(enTools[key])].sort();
      expect([...flattenKeys(viTools[key])].sort(), `vi:${key}`).toEqual(
        englishKeys
      );
      expect([...flattenKeys(deTools[key])].sort(), `de:${key}`).toEqual(
        englishKeys
      );
    }

    const multiToolKeys = [...flattenKeys(enCommon.multiTool)].sort();
    expect([...flattenKeys(viCommon.multiTool)].sort()).toEqual(multiToolKeys);
    expect([...flattenKeys(deCommon.multiTool)].sort()).toEqual(multiToolKeys);
  });

  it('defines every explicit tool translation used by the five pages', () => {
    const files = [
      'src/pages/edit-pdf-text.html',
      'src/pages/pdf-workflow.html',
      'src/pages/pdf-multi-tool.html',
      'src/pages/merge-pdf.html',
      'src/pages/split-pdf.html',
    ];
    const missing: string[] = [];

    for (const file of files) {
      const page = new DOMParser().parseFromString(
        readFileSync(resolve(file), 'utf8'),
        'text/html'
      );
      page.querySelectorAll('*').forEach((element) => {
        for (const attribute of element.attributes) {
          if (!attribute.name.startsWith('data-i18n')) continue;
          if (!attribute.value.startsWith('tools:')) continue;
          const key = attribute.value.slice('tools:'.length);
          if (getValue(enTools, key) === undefined) {
            missing.push(`${file}: ${key}`);
          }
        }
      });
    }

    expect(missing).toEqual([]);
  });

  it('marks static option labels and preserves controls inside translated labels', () => {
    const splitPage = new DOMParser().parseFromString(
      readFileSync(resolve('src/pages/split-pdf.html'), 'utf8'),
      'text/html'
    );
    const editPage = new DOMParser().parseFromString(
      readFileSync(resolve('src/pages/edit-pdf-text.html'), 'utf8'),
      'text/html'
    );

    splitPage
      .querySelectorAll('#split-mode option, #bookmark-level option')
      .forEach((option) => expect(option.hasAttribute('data-i18n')).toBe(true));
    editPage
      .querySelectorAll('#spellLang option')
      .forEach((option) => expect(option.hasAttribute('data-i18n')).toBe(true));

    expect(editPage.querySelectorAll('label[data-i18n] input')).toHaveLength(0);
    expect(editPage.querySelectorAll('label input + [data-i18n]').length).toBe(
      5
    );
  });

  it('applies Vietnamese to static controls without removing their inputs', async () => {
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
      <select>
        <option data-i18n="tools:splitPdf.modeEvenOdd">Split by Even/Odd Pages</option>
      </select>
      <label>
        <input id="spell-check" type="checkbox">
        <span data-i18n="tools:editPdfText.spelling">Spelling</span>
      </label>
    `;

    applyTranslations();

    expect(document.querySelector('option')?.textContent).toBe(
      viTools.splitPdf.modeEvenOdd
    );
    expect(document.querySelector('label span')?.textContent).toBe(
      viTools.editPdfText.spelling
    );
    expect(document.getElementById('spell-check')).toBeInstanceOf(
      HTMLInputElement
    );
  });

  it('translates dynamically generated workflow options and OCR languages', async () => {
    const source = readFileSync(
      resolve('src/js/logic/pdf-workflow-page.ts'),
      'utf8'
    );

    expect(source).toContain('option.textContent = optionLabel(key, opt)');
    expect(source).toContain(
      'return translateWorkflowText(`controlLabels.${key}`, fallback)'
    );
    expect(source).not.toContain('option.textContent = opt.label');

    await i18next.changeLanguage('vi');
    expect(
      translateWorkflowOptionLabel('position', 'bottom-left', 'Bottom Left')
    ).toBe(viTools.pdfWorkflow.options.position['bottom-left']);
    expect(localizeOcrLanguage('deu', 'German', 'vi')).toBe('Tiếng Đức');

    await i18next.changeLanguage('de');
    expect(
      translateWorkflowOptionLabel('redactMode', 'area', 'Area (Coordinates)')
    ).toBe(deTools.pdfWorkflow.options.redactMode.area);
    expect(localizeOcrLanguage('vie', 'Vietnamese', 'de')).toBe(
      'Vietnamesisch'
    );

    await i18next.changeLanguage('en');
  });
});
