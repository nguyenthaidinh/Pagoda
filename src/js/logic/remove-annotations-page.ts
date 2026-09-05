import { PDFDocument } from 'pdf-lib';
import { createIcons, icons } from 'lucide';
import { loadPdfWithPasswordPrompt } from '../utils/password-prompt.js';
import { loadPdfDocument } from '../utils/load-pdf-document.js';
import { escapeHtml, isPdfFile } from '../utils/helpers.js';
import { getLanguageFromUrl, getLocalizedPath, t } from '../i18n/i18n';
import { removeNonWidgetAnnotations } from '../utils/pdf-annotations';

// State management
const pageState: { pdfDoc: PDFDocument | null; file: File | null } = {
  pdfDoc: null,
  file: null,
};

// UI helpers
function showLoader(message: string = t('loader.processing')) {
  const loader = document.getElementById('loader-modal');
  const loaderText = document.getElementById('loader-text');
  if (loader) loader.classList.remove('hidden');
  if (loaderText) loaderText.textContent = message;
}

function hideLoader() {
  const loader = document.getElementById('loader-modal');
  if (loader) loader.classList.add('hidden');
}

function showAlert(
  title: string,
  message: string,
  _type: string = 'error',
  callback?: () => void
) {
  const modal = document.getElementById('alert-modal');
  const alertTitle = document.getElementById('alert-title');
  const alertMessage = document.getElementById('alert-message');
  const okBtn = document.getElementById('alert-ok');

  if (alertTitle) alertTitle.textContent = title;
  if (alertMessage) alertMessage.textContent = message;
  if (modal) modal.classList.remove('hidden');

  if (okBtn) {
    const newOkBtn = okBtn.cloneNode(true) as HTMLElement;
    okBtn.replaceWith(newOkBtn);
    newOkBtn.addEventListener('click', () => {
      modal?.classList.add('hidden');
      if (callback) callback();
    });
  }
}

function downloadFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function updateFileDisplay() {
  const displayArea = document.getElementById('file-display-area');
  if (!displayArea || !pageState.file || !pageState.pdfDoc) return;

  const fileSize =
    pageState.file.size < 1024 * 1024
      ? `${(pageState.file.size / 1024).toFixed(1)} KB`
      : `${(pageState.file.size / 1024 / 1024).toFixed(2)} MB`;
  const pageCount = pageState.pdfDoc.getPageCount();

  displayArea.innerHTML = `
        <div class="bg-gray-700 p-3 rounded-lg border border-gray-600 hover:border-indigo-500 transition-colors">
            <div class="flex items-center justify-between">
                <div class="flex-1 min-w-0">
                    <p class="truncate font-medium text-white">${escapeHtml(pageState.file.name)}</p>
                    <p class="text-gray-400 text-sm">${escapeHtml(t('tools:removeAnnotations.fileMeta', { size: fileSize, count: pageCount }))}</p>
                </div>
                <button id="remove-file" class="text-red-400 hover:text-red-300 p-2 flex-shrink-0 ml-2" title="${escapeHtml(t('tools:removeAnnotations.removeFile'))}">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </div>
        </div>
    `;

  createIcons({ icons });

  document
    .getElementById('remove-file')
    ?.addEventListener('click', () => resetState());
}

function resetState() {
  pageState.pdfDoc = null;
  pageState.file = null;
  const displayArea = document.getElementById('file-display-area');
  if (displayArea) displayArea.innerHTML = '';
  document.getElementById('options-panel')?.classList.add('hidden');
  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  if (fileInput) fileInput.value = '';
}

// File handling
async function handleFileUpload(file: File) {
  if (!isPdfFile(file)) {
    showAlert(t('common.error'), t('tools:removeAnnotations.invalidFile'));
    return;
  }

  try {
    const result = await loadPdfWithPasswordPrompt(file);
    if (!result) return;
    showLoader(t('tools:removeAnnotations.loading'));
    result.pdf.destroy();
    pageState.pdfDoc = await loadPdfDocument(result.bytes);
    pageState.file = result.file;
    updateFileDisplay();
    document.getElementById('options-panel')?.classList.remove('hidden');
  } catch (error) {
    console.error(error);
    showAlert(t('common.error'), t('tools:removeAnnotations.loadFailed'));
  } finally {
    hideLoader();
  }
}

// Process function
async function processRemoveAnnotations() {
  if (!pageState.pdfDoc) {
    showAlert(t('common.error'), t('tools:removeAnnotations.uploadFirst'));
    return;
  }

  showLoader(t('tools:removeAnnotations.processing'));
  try {
    removeNonWidgetAnnotations(pageState.pdfDoc);

    const newPdfBytes = await pageState.pdfDoc.save();
    downloadFile(
      new Blob([new Uint8Array(newPdfBytes)], { type: 'application/pdf' }),
      pageState.file?.name || 'document.pdf'
    );
    showAlert(
      t('common.success'),
      t('tools:removeAnnotations.success'),
      'success',
      resetState
    );
  } catch (e) {
    console.error(e);
    showAlert(t('common.error'), t('tools:removeAnnotations.failed'));
  } finally {
    hideLoader();
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  const dropZone = document.getElementById('drop-zone');
  const processBtn = document.getElementById('process-btn');
  const backBtn = document.getElementById('back-to-tools');

  fileInput?.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) handleFileUpload(file);
  });

  dropZone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('border-indigo-500');
  });

  dropZone?.addEventListener('dragleave', () => {
    dropZone.classList.remove('border-indigo-500');
  });

  dropZone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-indigo-500');
    const file = e.dataTransfer?.files[0];
    if (file) handleFileUpload(file);
  });

  processBtn?.addEventListener('click', processRemoveAnnotations);

  backBtn?.addEventListener('click', () => {
    window.location.href = getLocalizedPath(
      getLanguageFromUrl(),
      import.meta.env.BASE_URL
    );
  });
});
