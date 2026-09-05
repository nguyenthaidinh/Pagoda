import { getLanguageFromUrl, getLocalizedPath } from '../i18n/i18n.js';

export function getLocalizedToolsPath(): string {
  return getLocalizedPath(
    getLanguageFromUrl(),
    `${import.meta.env.BASE_URL}tools.html`
  );
}

export function goToLocalizedTools(): void {
  window.location.href = getLocalizedToolsPath();
}
