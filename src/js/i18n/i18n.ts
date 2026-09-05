import i18next from 'i18next';
import HttpBackend from 'i18next-http-backend';
import { getStoredItem, setStoredItem } from '../utils/safe-storage.js';
import enCommon from '../../../public/locales/en/common.json';
import enTools from '../../../public/locales/en/tools.json';
import enSite from '../../../public/locales/en/site.json';

declare const __BRAND_NAME__: string;

function rebrandText(value: string): string {
  const brandName =
    typeof __BRAND_NAME__ === 'string' && __BRAND_NAME__
      ? __BRAND_NAME__
      : 'PagodaPDF';
  const host =
    typeof window !== 'undefined' &&
    window.location.hostname &&
    window.location.hostname !== 'localhost'
      ? window.location.hostname
      : 'pagodapdf.example';

  return value
    .replace(/https:\/\/www\.bentopdf\.com/g, () => `https://${host}`)
    .replace(/https:\/\/bentopdf\.com/g, () => `https://${host}`)
    .replace(/www\.bentopdf\.com/g, () => host)
    .replace(/bentopdf\.com/g, () => host)
    .replace(/@BentoPDF/g, () => `@${brandName}`)
    .replace(/BentoPDF/g, () => brandName);
}

function applyBrandingToDocument(): void {
  const body = document.body;
  if (!body) return;

  const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName)) {
        return NodeFilter.FILTER_REJECT;
      }

      return /BentoPDF|bentopdf\.com|@BentoPDF/.test(node.nodeValue || '')
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });

  const textNodes: Text[] = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text);
  }

  textNodes.forEach((node) => {
    node.nodeValue = rebrandText(node.nodeValue || '');
  });

  document
    .querySelectorAll('meta[content], [title], [placeholder], [alt]')
    .forEach((element) => {
      ['content', 'title', 'placeholder', 'alt'].forEach((attribute) => {
        const value = element.getAttribute(attribute);
        if (value) {
          element.setAttribute(attribute, rebrandText(value));
        }
      });
    });
}

// Supported languages
export const supportedLanguages = [
  'en',
  'ar',
  'be',
  'ru',
  'fr',
  'de',
  'es',
  'zh',
  'zh-TW',
  'vi',
  'tr',
  'id',
  'it',
  'pt',
  'nl',
  'da',
  'sv',
  'ko',
  'ja',
  'uk',
  'sk',
] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

export const languageNames: Record<SupportedLanguage, string> = {
  en: 'English',
  ar: 'العربية',
  be: 'Беларуская',
  ru: 'Русский',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
  zh: '中文',
  'zh-TW': '繁體中文（台灣）',
  vi: 'Tiếng Việt',
  tr: 'Türkçe',
  id: 'Bahasa Indonesia',
  it: 'Italiano',
  pt: 'Português',
  nl: 'Nederlands',
  da: 'Dansk',
  sv: 'Svenska',
  ko: '한국어',
  ja: '日本語',
  uk: 'Українська',
  sk: 'Slovenčina',
};

export const getLanguageFromUrl = (): SupportedLanguage => {
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
  let path = window.location.pathname;

  if (basePath && basePath !== '/' && path.startsWith(basePath)) {
    path = path.slice(basePath.length) || '/';
  }

  if (!path.startsWith('/')) {
    path = '/' + path;
  }

  const langMatch = path.match(
    /^\/(en|ar|fr|es|de|zh|zh-TW|vi|tr|id|it|pt|nl|be|da|ko|sv|ru|ja|uk|sk)(?:\/|$)/
  );
  if (
    langMatch &&
    supportedLanguages.includes(langMatch[1] as SupportedLanguage)
  ) {
    return langMatch[1] as SupportedLanguage;
  }

  const storedLang = getStoredItem('i18nextLng');
  if (
    storedLang &&
    supportedLanguages.includes(storedLang as SupportedLanguage)
  ) {
    return storedLang as SupportedLanguage;
  }

  // Check browser language preferences
  if (typeof navigator !== 'undefined' && navigator.languages) {
    for (const lang of navigator.languages) {
      if (supportedLanguages.includes(lang as SupportedLanguage)) {
        return lang as SupportedLanguage;
      }

      const primaryLang = lang.split('-')[0];
      if (supportedLanguages.includes(primaryLang as SupportedLanguage)) {
        return primaryLang as SupportedLanguage;
      }
    }
  }

  const envLang = import.meta.env?.VITE_DEFAULT_LANGUAGE;
  if (envLang && supportedLanguages.includes(envLang as SupportedLanguage)) {
    return envLang as SupportedLanguage;
  }

  return 'en';
};

let initialized = false;

const normalizeText = (value: string): string =>
  value.replace(/\s+/g, ' ').trim();

type TranslationRoot = Document | Element | DocumentFragment;

const knownTextKeys = new Map<string, string>();

function indexTranslationValues(
  value: unknown,
  keyPrefix: string,
  namespace = ''
): void {
  if (!value || typeof value !== 'object') return;

  Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
    const nextKey = keyPrefix ? `${keyPrefix}.${key}` : key;
    if (typeof entry === 'string') {
      const normalized = normalizeText(entry);
      if (normalized && !knownTextKeys.has(normalized)) {
        knownTextKeys.set(
          normalized,
          namespace ? `${namespace}:${nextKey}` : nextKey
        );
      }
      return;
    }

    indexTranslationValues(entry, nextKey, namespace);
  });
}

indexTranslationValues(enCommon, '');
indexTranslationValues(enTools, '', 'tools');
indexTranslationValues(enSite, '', 'site');

export const initI18n = async (): Promise<typeof i18next> => {
  if (initialized) return i18next;

  const currentLang = getLanguageFromUrl();

  setStoredItem('i18nextLng', currentLang);

  await i18next.use(HttpBackend).init({
    lng: currentLang,
    fallbackLng: 'en',
    supportedLngs: supportedLanguages as unknown as string[],
    ns: ['common', 'tools', 'site'],
    defaultNS: 'common',
    preload: [currentLang],
    partialBundledLanguages: true,
    resources: {
      en: {
        common: enCommon,
        tools: enTools,
        site: enSite,
      },
    },
    backend: {
      loadPath: `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}locales/{{lng}}/{{ns}}.json`,
    },
    interpolation: {
      escapeValue: false,
    },
  });

  await i18next.loadNamespaces(['tools', 'site']);

  initialized = true;
  return i18next;
};

export const t = (key: string, options?: Record<string, unknown>): string => {
  const translation = i18next.t(key, options);
  return rebrandText(typeof translation === 'string' ? translation : key);
};

export const getLocalizedPath = (
  lang: SupportedLanguage,
  pathname = window.location.pathname,
  basePath = import.meta.env.BASE_URL.replace(/\/$/, '')
): string => {
  let relativePath = pathname;

  if (basePath && basePath !== '/' && relativePath.startsWith(basePath)) {
    relativePath = relativePath.slice(basePath.length) || '/';
  }

  if (!relativePath.startsWith('/')) {
    relativePath = '/' + relativePath;
  }

  let pagePathWithoutLang = relativePath;
  const firstPathSegment = relativePath.slice(1).split('/', 1)[0];
  if (supportedLanguages.includes(firstPathSegment as SupportedLanguage)) {
    pagePathWithoutLang =
      relativePath.slice(firstPathSegment.length + 1) || '/';
  }

  if (!pagePathWithoutLang.startsWith('/')) {
    pagePathWithoutLang = '/' + pagePathWithoutLang;
  }

  let newRelativePath: string;
  if (lang === 'en') {
    newRelativePath = pagePathWithoutLang;
  } else {
    newRelativePath = `/${lang}${pagePathWithoutLang}`;
  }

  let newPath: string;
  if (basePath && basePath !== '/') {
    newPath = basePath + newRelativePath;
  } else {
    newPath = newRelativePath;
  }

  newPath = newPath.replace(/\/+/g, '/');

  return newPath;
};

export const changeLanguage = (lang: SupportedLanguage): void => {
  if (!supportedLanguages.includes(lang)) return;
  setStoredItem('i18nextLng', lang);

  const newPath = getLocalizedPath(lang);
  const newUrl = newPath + window.location.search + window.location.hash;
  window.location.href = newUrl;
};

function selectWithin(root: TranslationRoot, selector: string): Element[] {
  const matches: Element[] = [];
  if (root instanceof Element && root.matches(selector)) {
    matches.push(root);
  }
  matches.push(...root.querySelectorAll(selector));
  return matches;
}

function setTranslatedAttribute(
  root: TranslationRoot,
  selector: string,
  keyAttribute: string,
  targetAttribute: string
): void {
  selectWithin(root, selector).forEach((element) => {
    const key = element.getAttribute(keyAttribute);
    if (!key) return;

    const translation = t(key);
    if (translation && translation !== key) {
      element.setAttribute(targetAttribute, translation);
    }
  });
}

function applyKnownTextTranslations(root: TranslationRoot): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (
        !parent ||
        parent.closest(
          '[data-i18n], [data-i18n-skip], [contenteditable="true"]'
        ) ||
        ['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA'].includes(
          parent.tagName
        )
      ) {
        return NodeFilter.FILTER_REJECT;
      }

      const value = normalizeText(node.nodeValue || '');
      if (
        !value ||
        value === 'PagodaPDF' ||
        value === 'LioDev' ||
        value === 'ntdinh16124@gmail.com' ||
        value === 'hotropagoda@liotnu.com'
      ) {
        return NodeFilter.FILTER_REJECT;
      }

      return knownTextKeys.has(value)
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });

  const textNodes: Text[] = [];
  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text);
  }

  textNodes.forEach((node) => {
    const rawValue = node.nodeValue || '';
    const sourceValue = normalizeText(rawValue);
    const key = knownTextKeys.get(sourceValue);
    if (!key) return;

    const translation = t(key);
    if (!translation || translation === key || translation === sourceValue) {
      return;
    }

    const leadingSpace = rawValue.match(/^\s*/)?.[0] || '';
    const trailingSpace = rawValue.match(/\s*$/)?.[0] || '';
    node.nodeValue = `${leadingSpace}${translation}${trailingSpace}`;
  });
}

const toolKeyAliases: Record<string, string> = {
  bookmark: 'editBookmarks',
  'combine-single-page': 'combineToSinglePage',
  'edit-pdf': 'pdfEditor',
  'form-creator': 'createPdfForm',
  'form-filler': 'pdfFormFiller',
  'organize-pdf': 'duplicateOrganize',
  'overlay-pdf': 'pdfOverlay',
  'pdf-editor': 'pdfEditor',
  'pdf-layers': 'pdfOcg',
  'pdf-to-zip': 'pdfsToZip',
  'text-color': 'changeTextColor',
  'txt-to-pdf': 'textToPdf',
};

function toolKeyFromHref(href: string): string | null {
  const pathname = href.split(/[?#]/, 1)[0];
  const filename = pathname
    .split('/')
    .pop()
    ?.replace(/\.html$/, '');
  if (!filename) return null;

  return (
    toolKeyAliases[filename] ||
    filename.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
  );
}

function annotateToolCards(root: TranslationRoot): void {
  selectWithin(root, 'a.tool-card[href], [data-related-tools] a[href]').forEach(
    (card) => {
      const href = card.getAttribute('href');
      if (!href) return;

      const toolKey = toolKeyFromHref(href);
      if (!toolKey || !i18next.exists(`tools:${toolKey}.name`)) return;

      const title = card.querySelector('h2, h3, h4');
      if (title && !title.hasAttribute('data-i18n')) {
        title.setAttribute('data-i18n', `tools:${toolKey}.name`);
      }

      const subtitle = card.querySelector('p');
      if (
        subtitle &&
        !subtitle.hasAttribute('data-i18n') &&
        i18next.exists(`tools:${toolKey}.subtitle`)
      ) {
        subtitle.setAttribute('data-i18n', `tools:${toolKey}.subtitle`);
      }
    }
  );
}

// Apply translations to the document or to a newly inserted subtree.
export const applyTranslations = (root: TranslationRoot = document): void => {
  annotateToolCards(root);

  selectWithin(root, '[data-i18n]').forEach((element) => {
    const key = element.getAttribute('data-i18n');
    if (key) {
      const translation = t(key);
      if (
        translation &&
        translation !== key &&
        element.textContent !== translation
      ) {
        element.textContent = translation;
      }
    }
  });

  setTranslatedAttribute(
    root,
    '[data-i18n-placeholder]',
    'data-i18n-placeholder',
    'placeholder'
  );
  setTranslatedAttribute(root, '[data-i18n-title]', 'data-i18n-title', 'title');
  setTranslatedAttribute(
    root,
    '[data-i18n-aria-label]',
    'data-i18n-aria-label',
    'aria-label'
  );
  setTranslatedAttribute(root, '[data-i18n-label]', 'data-i18n-label', 'label');
  setTranslatedAttribute(
    root,
    '[data-i18n-content]',
    'data-i18n-content',
    'content'
  );

  applyKnownTextTranslations(root);

  document.title = rebrandText(document.title);
  applyBrandingToDocument();

  document.documentElement.lang = i18next.language;
  document.documentElement.dir = i18next.language === 'ar' ? 'rtl' : 'ltr';
};

export const rewriteLinks = (root: TranslationRoot = document): void => {
  const currentLang = getLanguageFromUrl();
  if (currentLang === 'en') return;

  const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
  const links = selectWithin(root, 'a[href]');

  links.forEach((link) => {
    const href = link.getAttribute('href');
    if (!href) return;

    if (
      href.startsWith('http') ||
      href.startsWith('//') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:') ||
      href.startsWith('#') ||
      href.startsWith('javascript:') ||
      href.startsWith('data:') ||
      href.startsWith('vbscript:')
    ) {
      return;
    }

    if (href.includes('/assets/')) {
      return;
    }

    const langPrefixRegex = new RegExp(
      `^(${basePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})?/?(en|ar|fr|es|de|zh|zh-TW|vi|tr|id|it|pt|nl|be|da|ko|sv|ru|ja|uk|sk)(/|$)`
    );
    if (langPrefixRegex.test(href)) {
      return;
    }

    let newHref: string;
    if (basePath && basePath !== '/' && href.startsWith(basePath)) {
      const pathAfterBase = href.slice(basePath.length);
      newHref = `${basePath}/${currentLang}${pathAfterBase}`;
    } else if (href.startsWith('/')) {
      if (basePath && basePath !== '/') {
        newHref = `${basePath}/${currentLang}${href}`;
      } else {
        newHref = `/${currentLang}${href}`;
      }
    } else if (href === '' || href === 'index.html') {
      if (basePath && basePath !== '/') {
        newHref = `${basePath}/${currentLang}/`;
      } else {
        newHref = `/${currentLang}/`;
      }
    } else {
      newHref = `/${currentLang}/${href}`;
    }

    newHref = newHref.replace(/([^:])\/+/g, '$1/');

    link.setAttribute('href', newHref);
  });
};

let translationObserver: MutationObserver | null = null;
let observerQueued = false;
const pendingTranslationRoots = new Set<TranslationRoot>();

export const observeTranslations = (): void => {
  if (translationObserver || !document.body) return;

  translationObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof Element) {
          pendingTranslationRoots.add(node);
        }
      });
    });

    if (observerQueued || pendingTranslationRoots.size === 0) return;
    observerQueued = true;

    queueMicrotask(() => {
      observerQueued = false;
      const roots = [...pendingTranslationRoots];
      pendingTranslationRoots.clear();
      roots.forEach((translationRoot) => {
        applyTranslations(translationRoot);
        rewriteLinks(translationRoot);
      });
    });
  });

  translationObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
};

export default i18next;
