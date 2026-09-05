import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PDFDict, PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import deCommon from '../../public/locales/de/common.json';
import enCommon from '../../public/locales/en/common.json';
import viCommon from '../../public/locales/vi/common.json';
import deTools from '../../public/locales/de/tools.json';
import enTools from '../../public/locales/en/tools.json';
import viTools from '../../public/locales/vi/tools.json';
import i18next, { applyTranslations } from '../js/i18n/i18n';
import { removeMetadataFromDoc } from '../js/utils/sanitize';
import {
  filterPdfFiles,
  isPdfFile,
  pdfOutputName,
} from '../js/utils/security-pdf-page';
import { getLocalizedToolsPath } from '../js/utils/localized-navigation';

const pageFiles = [
  'encrypt-pdf',
  'sanitize-pdf',
  'decrypt-pdf',
  'flatten-pdf',
  'remove-metadata',
  'change-permissions',
  'digital-sign-pdf',
  'validate-signature-pdf',
  'timestamp-pdf',
] as const;

const toolKeys = [
  'securityPdf',
  'encryptPdf',
  'sanitizePdf',
  'decryptPdf',
  'flattenPdf',
  'removeMetadata',
  'changePermissions',
  'digitalSignPdf',
  'validateSignaturePdf',
  'timestampPdf',
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

function readLogic(name: (typeof pageFiles)[number]): string {
  return readFileSync(resolve(`src/js/logic/${name}-page.ts`), 'utf8');
}

describe('security PDF tools shown in the tools grid', () => {
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
      readPage(name)
        .querySelectorAll('*')
        .forEach((element) => {
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

  it('defines every dynamic translation used by the page scripts', () => {
    const missing: string[] = [];

    for (const name of pageFiles) {
      const source = readLogic(name);
      const toolKeys = [
        ...source.matchAll(/\bt\(\s*['"]tools:([^'"]+)['"]/g),
      ].map((match) => match[1]);
      const securityKeys = [
        ...source.matchAll(/\bsecurityText\(\s*['"]([^'"]+)['"]/g),
      ].map((match) => `securityPdf.${match[1]}`);

      for (const key of [...toolKeys, ...securityKeys]) {
        for (const [locale, resources] of Object.entries({
          en: enTools,
          vi: viTools,
          de: deTools,
        })) {
          if (
            getValue(resources, key) === undefined &&
            getValue(resources, `${key}_other`) === undefined
          ) {
            missing.push(`${locale}:${name}:${key}`);
          }
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it('translates controls, placeholders, notices, and action buttons', async () => {
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

    document.body.innerHTML = readPage('sanitize-pdf').body.innerHTML;
    applyTranslations();
    expect(
      document.querySelector(
        '[data-i18n="tools:sanitizePdf.removeMetadataOption"]'
      )?.textContent
    ).toBe(viTools.sanitizePdf.removeMetadataOption);

    document.body.innerHTML = readPage('change-permissions').body.innerHTML;
    applyTranslations();
    expect(
      document.querySelector<HTMLInputElement>(
        '[data-i18n-placeholder="tools:changePermissions.newOwnerPasswordPlaceholder"]'
      )?.placeholder
    ).toBe(viTools.changePermissions.newOwnerPasswordPlaceholder);

    document.body.innerHTML = readPage('validate-signature-pdf').body.innerHTML;
    applyTranslations();
    expect(
      document.querySelector(
        '[data-i18n="tools:validateSignaturePdf.customCertificateTitle"]'
      )?.textContent
    ).toBe(viTools.validateSignaturePdf.customCertificateTitle);

    await i18next.changeLanguage('de');
    document.body.innerHTML = readPage('timestamp-pdf').body.innerHTML;
    applyTranslations();
    expect(
      document.querySelector(
        '[data-i18n="tools:timestampPdf.internetRequiredDescription"]'
      )?.textContent
    ).toBe(deTools.timestampPdf.internetRequiredDescription);

    document.body.innerHTML = readPage('encrypt-pdf').body.innerHTML;
    applyTranslations();
    expect(document.querySelector('#process-btn')?.textContent).toContain(
      deTools.encryptPdf.processButton
    );
    await i18next.changeLanguage('en');
  });

  it('uses localized navigation and shared PDF validation on every page', () => {
    const config = readFileSync(resolve('src/js/config/tools.ts'), 'utf8');

    for (const name of pageFiles) {
      expect(config, name).toContain(`${name}.html`);
      expect(() => readPage(name), name).not.toThrow();

      const source = readLogic(name);
      expect(source, name).toContain('security-pdf-page');
      expect(source, name).toContain('goToLocalizedTools');
      expect(source, name).not.toContain(
        'window.location.href = import.meta.env.BASE_URL'
      );
      expect(source, name).not.toContain("window.location.href = '/'");
    }

    window.history.replaceState({}, '', '/vi/encrypt-pdf.html');
    expect(getLocalizedToolsPath()).toBe('/vi/tools.html');
    window.history.replaceState({}, '', '/de/timestamp-pdf.html');
    expect(getLocalizedToolsPath()).toBe('/de/tools.html');
  });

  it('accepts real PDFs and rejects disguised executable names', () => {
    const validUppercase = new File(['pdf'], 'REPORT.PDF');
    const validWithoutExtension = new File(['pdf'], 'document', {
      type: 'application/pdf',
    });
    const disguised = new File(['bad'], 'report.pdf.exe', {
      type: 'application/pdf',
    });

    expect(isPdfFile(validUppercase)).toBe(true);
    expect(isPdfFile(validWithoutExtension)).toBe(true);
    expect(isPdfFile(disguised)).toBe(false);
    expect(filterPdfFiles([validUppercase, disguised])).toEqual([
      validUppercase,
    ]);
  });

  it('builds clear output names for every security operation', () => {
    expect(pdfOutputName('REPORT.PDF', 'encrypted')).toBe(
      'REPORT_encrypted.pdf'
    );
    expect(pdfOutputName('document.pdf', 'metadata-removed')).toBe(
      'document_metadata-removed.pdf'
    );
    expect(pdfOutputName('document', 'timestamped')).toBe(
      'document_timestamped.pdf'
    );
  });

  it('removes document metadata without recreating the Info dictionary', async () => {
    const pdf = await PDFDocument.create({ updateMetadata: false });
    pdf.addPage();
    pdf.setTitle('Private title');
    pdf.setAuthor('Private author');
    const infoDictionary = pdf.context.lookup(
      pdf.context.trailerInfo.Info
    ) as PDFDict;

    removeMetadataFromDoc(pdf);

    expect(infoDictionary.keys()).toHaveLength(0);
    expect(pdf.context.trailerInfo.Info).toBeUndefined();
    expect(pdf.context.trailerInfo.ID).toBeUndefined();
  });

  it('keeps security-specific correctness fixes in place', () => {
    const permissionsPage = readFileSync(
      resolve('src/pages/change-permissions.html'),
      'utf8'
    );
    expect(permissionsPage).not.toContain('allow-page-extraction');

    const metadata = readLogic('remove-metadata');
    expect(metadata).toContain('updateMetadata: false');
    expect(metadata).toContain('removeMetadataFromDoc');

    const digitalSign = readLogic('digital-sign-pdf');
    expect(digitalSign).toContain('URL.revokeObjectURL');
    expect(digitalSign).toContain('pdfOutputName(state.pdfFile?.name');
    expect(digitalSign).toContain("'signed'");

    const timestamp = readLogic('timestamp-pdf');
    expect(timestamp).toContain("'timestamped'");
    expect(timestamp).toContain('await pdfDoc.destroy()');

    const validation = readLogic('validate-signature-pdf');
    expect(validation).toContain('r.isValid && !r.isExpired');
    expect(validation).not.toContain(
      'r.isValid && !r.isExpired && r.isTrusted'
    );
  });

  it('contains no mojibake or duplicate translation attributes', () => {
    const duplicates: string[] = [];
    const sources = [
      readFileSync(resolve('src/js/utils/security-pdf-page.ts'), 'utf8'),
    ];

    for (const name of pageFiles) {
      sources.push(readLogic(name));
      const source = readFileSync(resolve(`src/pages/${name}.html`), 'utf8');
      sources.push(source);
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
