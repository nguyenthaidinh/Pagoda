import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import en from '../../public/locales/en/site.json';
import viSite from '../../public/locales/vi/site.json';
import deSite from '../../public/locales/de/site.json';
import viTools from '../../public/locales/vi/tools.json';
import i18next, {
  applyTranslations,
  observeTranslations,
} from '../js/i18n/i18n';

const flattenKeys = (
  value: unknown,
  prefix = '',
  keys = new Set<string>()
): Set<string> => {
  if (!value || typeof value !== 'object') return keys;

  Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (typeof entry === 'string') {
      keys.add(nextKey);
    } else {
      flattenKeys(entry, nextKey, keys);
    }
  });

  return keys;
};

const siteFiles = [
  'index.html',
  'about.html',
  'contact.html',
  'faq.html',
  'privacy.html',
  'terms.html',
  'licensing.html',
  'tools.html',
  'pdf-converter.html',
  'pdf-editor.html',
  'pdf-security.html',
  'pdf-merge-split.html',
  '404.html',
  'src/partials/navbar.html',
  'src/partials/footer.html',
  'src/partials/footer-simple.html',
];

describe('PagodaPDF site translations', () => {
  it('keeps English, Vietnamese, and German keys in sync', () => {
    const englishKeys = [...flattenKeys(en)].sort();
    expect([...flattenKeys(viSite)].sort()).toEqual(englishKeys);
    expect([...flattenKeys(deSite)].sort()).toEqual(englishKeys);
  });

  it('defines every site key referenced by shared and top-level pages', () => {
    const keys = flattenKeys(en);
    const missing: string[] = [];

    siteFiles.forEach((file) => {
      const source = readFileSync(resolve(file), 'utf8');
      const page = new DOMParser().parseFromString(source, 'text/html');

      page.querySelectorAll('*').forEach((element) => {
        [...element.attributes].forEach((attribute) => {
          if (
            !attribute.name.startsWith('data-i18n') ||
            !attribute.value.startsWith('site:')
          ) {
            return;
          }

          const key = attribute.value.slice('site:'.length);
          if (!keys.has(key)) missing.push(`${file}: ${key}`);
        });
      });
    });

    expect(missing).toEqual([]);
  });

  it('preserves the PagodaPDF and LioDev brand names', () => {
    const navbar = readFileSync(resolve('src/partials/navbar.html'), 'utf8');
    const footer = readFileSync(resolve('src/partials/footer.html'), 'utf8');

    expect(navbar).toContain('id="nav-brand"');
    expect(footer).toContain('id="footer-brand"');
    expect(footer).toContain('<span class="footer-maker">LioDev</span>');
    expect(navbar).not.toMatch(/id="nav-brand"[^>]*data-i18n/);
    expect(footer).not.toMatch(/id="footer-brand"[^>]*data-i18n/);
  });

  it('translates shared, tool-card, and dynamically inserted content', async () => {
    await i18next.init({
      lng: 'vi',
      fallbackLng: 'en',
      ns: ['site', 'tools'],
      defaultNS: 'site',
      resources: {
        vi: { site: viSite, tools: viTools },
        en: { site: en },
      },
    });

    document.body.innerHTML = `
      <span id="nav-brand">PagodaPDF</span>
      <span class="footer-maker">LioDev</span>
      <a class="tool-card" href="/merge-pdf.html">
        <h3>Merge PDF</h3>
        <p>Combine PDFs</p>
      </a>
      <span data-i18n="site:nav.tools">Tools</span>
    `;

    applyTranslations();
    expect(
      document.querySelector('[data-i18n="site:nav.tools"]')?.textContent
    ).toBe('Công cụ');
    expect(document.querySelector('.tool-card h3')?.textContent).toBe(
      'Gộp PDF'
    );
    expect(document.getElementById('nav-brand')?.textContent).toBe('PagodaPDF');
    expect(document.querySelector('.footer-maker')?.textContent).toBe('LioDev');

    observeTranslations();
    const dynamicLabel = document.createElement('span');
    dynamicLabel.dataset.i18n = 'site:nav.security';
    dynamicLabel.textContent = 'Security';
    document.body.appendChild(dynamicLabel);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(dynamicLabel.textContent).toBe('Bảo mật');

    await i18next.changeLanguage('en');
  });
});
