import { getLanguageFromUrl, t, type SupportedLanguage } from '../i18n/i18n';
import type { NodeCategory } from './types';
import type { NodeRegistryEntry } from './nodes/registry';

const CATEGORY_KEYS: Record<NodeCategory, string> = {
  Input: 'tools:categories.input',
  'Edit & Annotate': 'tools:categories.editAnnotate',
  'Organize & Manage': 'tools:categories.organizeManage',
  'Optimize & Repair': 'tools:categories.optimizeRepair',
  'Secure PDF': 'tools:categories.securePdf',
  Output: 'tools:categories.output',
};

const SPECIAL_NODE_KEYS: Record<string, string> = {
  PDFInputNode: 'tools:pdfWorkflow.specialNodes.pdfInput',
  DownloadNode: 'tools:pdfWorkflow.specialNodes.download',
  DownloadPDFNode: 'tools:pdfWorkflow.specialNodes.download',
  DownloadZipNode: 'tools:pdfWorkflow.specialNodes.download',
};

function toCamelCase(str: string): string {
  return str.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

function translateOrFallback(key: string, fallback: string): string {
  const value = t(key);
  return value && value !== key ? value : fallback;
}

export function translateWorkflowText(
  key: string,
  fallback: string,
  options: Record<string, unknown> = {}
): string {
  return t(`tools:pdfWorkflow.${key}`, { defaultValue: fallback, ...options });
}

function workflowOptionKey(group: string, value: string): string {
  return group === 'level'
    ? value.replace(/[^a-zA-Z0-9]/g, '_')
    : value.replace(/\./g, '_');
}

export function translateWorkflowOptionLabel(
  group: string,
  value: string,
  fallback: string
): string {
  return translateWorkflowText(
    `options.${group}.${workflowOptionKey(group, value)}`,
    fallback
  );
}

export function localizeOcrLanguage(
  code: string,
  fallback: string,
  language: SupportedLanguage = getLanguageFromUrl()
): string {
  const [baseCode, variant] = code.split('_', 2);
  let localized: string;

  try {
    localized =
      new Intl.DisplayNames([language], { type: 'language' }).of(baseCode) ||
      fallback;
  } catch {
    return fallback;
  }

  if (!variant) return localized;
  const variantLabel = translateWorkflowText(
    `ocrVariants.${variant}`,
    fallback.split(' - ').slice(1).join(' - ') || variant
  );
  return `${localized} - ${variantLabel}`;
}

export function translateCategory(category: NodeCategory): string {
  const key = CATEGORY_KEYS[category];
  return translateOrFallback(key, category);
}

export function translateNodeLabel(
  nodeType: string,
  entry: NodeRegistryEntry
): string {
  const specialKey = SPECIAL_NODE_KEYS[nodeType];
  if (specialKey) {
    return translateOrFallback(`${specialKey}.name`, entry.label);
  }
  if (entry.toolPageId) {
    return translateOrFallback(
      `tools:${toCamelCase(entry.toolPageId)}.name`,
      entry.label
    );
  }
  return entry.label;
}

export function translateNodeDescription(
  nodeType: string,
  entry: NodeRegistryEntry
): string {
  const specialKey = SPECIAL_NODE_KEYS[nodeType];
  if (specialKey) {
    return translateOrFallback(`${specialKey}.description`, entry.description);
  }
  if (entry.toolPageId) {
    return translateOrFallback(
      `tools:${toCamelCase(entry.toolPageId)}.subtitle`,
      entry.description
    );
  }
  return entry.description;
}
