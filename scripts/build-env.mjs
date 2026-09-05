import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { loadEnv } from 'vite';

const repoRoot = resolve(fileURLToPath(import.meta.url), '../..');
const mode = process.env.MODE || process.env.NODE_ENV || 'production';
const loadedEnv = loadEnv(mode, repoRoot, '');

export const env = { ...loadedEnv, ...process.env };

export const BRAND_NAME = env.VITE_BRAND_NAME || 'PagodaPDF';
export const BRAND_LOGO = env.VITE_BRAND_LOGO || 'images/pagoda-logo.svg';
export const BRAND_SOCIAL_LINKS = (env.VITE_BRAND_SOCIAL_LINKS || '')
  .split(',')
  .map((link) => link.trim())
  .filter(Boolean);

export const SITE_URL = (
  env.SITE_URL || 'https://nguyenthaidinh.github.io/Pagoda'
).replace(/\/+$/, '');
export const SITE_HOST = new URL(SITE_URL).hostname;

export function siteAssetUrl(assetPath) {
  const cleanPath = String(assetPath || BRAND_LOGO).replace(/^\/+/, '');
  return `${SITE_URL}/${cleanPath}`;
}

export function rebrandText(value) {
  if (!value) return value;

  return String(value)
    .replace(/https:\/\/pagodapdf\.example/g, () => SITE_URL)
    .replace(/https:\/\/www\.bentopdf\.com/g, () => SITE_URL)
    .replace(/https:\/\/bentopdf\.com/g, () => SITE_URL)
    .replace(/http:\/\/www\.bentopdf\.com/g, () => SITE_URL)
    .replace(/http:\/\/bentopdf\.com/g, () => SITE_URL)
    .replace(/www\.bentopdf\.com/g, () => SITE_HOST)
    .replace(/bentopdf\.com/g, () => SITE_HOST)
    .replace(/@BentoPDF/g, () => `@${BRAND_NAME}`)
    .replace(/BentoPDF/g, () => BRAND_NAME);
}
