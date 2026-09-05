/**
 * Footer Interactive Helper
 * Handles one-click copy of the official support email with animated visual feedback.
 */

export function initFooterContact(): void {
  const copyButtons =
    document.querySelectorAll<HTMLButtonElement>('[data-copy-email]');

  copyButtons.forEach((btn) => {
    if (btn.dataset.copyBound === 'true') return;
    btn.dataset.copyBound = 'true';

    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const email = btn.dataset.copyEmail || 'hotropagoda@liotnu.com';

      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(email);
        } else {
          const textarea = document.createElement('textarea');
          textarea.value = email;
          textarea.style.position = 'fixed';
          textarea.style.left = '-9999px';
          textarea.style.top = '0';
          textarea.setAttribute('readonly', '');
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
        }
      } catch {
        window.prompt('Copy email:', email);
        return;
      }

      const textEl = btn.querySelector<HTMLElement>('.copy-text');
      const iconEl = btn.querySelector<HTMLElement>('.copy-icon');
      const originalText = textEl?.textContent || 'Sao chép';

      btn.classList.add('is-copied');

      const lang = document.documentElement.lang || 'vi';
      let copiedLabel = 'Đã sao chép!';
      if (lang === 'en') copiedLabel = 'Copied!';
      else if (lang === 'de') copiedLabel = 'Kopiert!';

      if (textEl) textEl.textContent = copiedLabel;

      if (iconEl) {
        iconEl.innerHTML =
          '<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
      }

      setTimeout(() => {
        btn.classList.remove('is-copied');
        if (textEl) textEl.textContent = originalText;
        if (iconEl) {
          iconEl.innerHTML =
            '<svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path></svg>';
        }
      }, 2000);
    });
  });
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initFooterContact());
  } else {
    initFooterContact();
  }
}
