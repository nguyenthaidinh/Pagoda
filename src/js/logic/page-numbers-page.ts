import { createIcons, icons } from 'lucide';
import { showAlert, showLoader, hideLoader } from '../ui.js';
import {
  downloadFile,
  hexToRgb,
  formatBytes,
  isPdfFile,
} from '../utils/helpers.js';
import { PDFDocument as PDFLibDocument } from 'pdf-lib';
import { loadPdfWithPasswordPrompt } from '../utils/password-prompt.js';
import {
  addPageNumbers as addPageNumbersToPdf,
  type PageNumberPosition,
  type PageNumberFormat,
} from '../utils/pdf-operations.js';
import { loadPdfDocument } from '../utils/load-pdf-document.js';
import { t } from '../i18n/i18n.js';
import { goToLocalizedTools } from '../utils/localized-navigation.js';

interface PageState {
  file: File | null;
  pdfDoc: PDFLibDocument | null;
}

const pageState: PageState = {
  file: null,
  pdfDoc: null,
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePage);
} else {
  initializePage();
}

function initializePage() {
  createIcons({ icons });

  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  const dropZone = document.getElementById('drop-zone');
  const backBtn = document.getElementById('back-to-tools');
  const processBtn = document.getElementById('process-btn');

  if (fileInput) {
    fileInput.addEventListener('change', handleFileUpload);
    fileInput.addEventListener('click', () => {
      fileInput.value = '';
    });
  }

  if (dropZone) {
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('border-indigo-500');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('border-indigo-500');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('border-indigo-500');
      if (e.dataTransfer?.files.length) {
        handleFiles(e.dataTransfer.files);
      }
    });
  }

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      goToLocalizedTools();
    });
  }

  if (processBtn) {
    processBtn.addEventListener('click', addPageNumbers);
  }
}

function handleFileUpload(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files?.length) {
    handleFiles(input.files);
  }
}

async function handleFiles(files: FileList) {
  const file = files[0];
  if (!file || !isPdfFile(file)) {
    showAlert(t('common.error'), t('tools:pageNumbers.invalidFile'));
    return;
  }

  try {
    const result = await loadPdfWithPasswordPrompt(file);
    if (!result) return;
    showLoader(t('tools:pageNumbers.loading'));

    pageState.pdfDoc = await loadPdfDocument(result.bytes);
    pageState.file = result.file;
    result.pdf.destroy();

    updateFileDisplay();
    document.getElementById('options-panel')?.classList.remove('hidden');
  } catch (error) {
    console.error(error);
    showAlert(t('common.error'), t('tools:pageNumbers.loadFailed'));
  } finally {
    hideLoader();
  }
}

function updateFileDisplay() {
  const fileDisplayArea = document.getElementById('file-display-area');
  if (!fileDisplayArea || !pageState.file || !pageState.pdfDoc) return;

  fileDisplayArea.innerHTML = '';
  const fileDiv = document.createElement('div');
  fileDiv.className =
    'flex items-center justify-between bg-gray-700 p-3 rounded-lg';

  const infoContainer = document.createElement('div');
  infoContainer.className = 'flex flex-col flex-1 min-w-0';

  const nameSpan = document.createElement('div');
  nameSpan.className = 'truncate font-medium text-gray-200 text-sm mb-1';
  nameSpan.textContent = pageState.file.name;

  const metaSpan = document.createElement('div');
  metaSpan.className = 'text-xs text-gray-400';
  metaSpan.textContent = t('tools:pageNumbers.fileMeta', {
    size: formatBytes(pageState.file.size),
    count: pageState.pdfDoc.getPageCount(),
  });

  infoContainer.append(nameSpan, metaSpan);

  const removeBtn = document.createElement('button');
  removeBtn.className = 'ml-4 text-red-400 hover:text-red-300 flex-shrink-0';
  removeBtn.innerHTML = '<i data-lucide="trash-2" class="w-4 h-4"></i>';
  removeBtn.title = t('tools:pageNumbers.removeFile');
  removeBtn.onclick = resetState;

  fileDiv.append(infoContainer, removeBtn);
  fileDisplayArea.appendChild(fileDiv);
  createIcons({ icons });
}

function resetState() {
  pageState.file = null;
  pageState.pdfDoc = null;
  const fileDisplayArea = document.getElementById('file-display-area');
  if (fileDisplayArea) fileDisplayArea.innerHTML = '';
  document.getElementById('options-panel')?.classList.add('hidden');
  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  if (fileInput) fileInput.value = '';
}

async function addPageNumbers() {
  if (!pageState.pdfDoc) {
    showAlert(t('common.error'), t('tools:pageNumbers.uploadFirst'));
    return;
  }

  showLoader(t('tools:pageNumbers.processing'));
  try {
    const position = (document.getElementById('position') as HTMLSelectElement)
      .value as PageNumberPosition;
    const requestedFontSize = Number(
      (document.getElementById('font-size') as HTMLInputElement).value
    );
    const fontSize = Number.isFinite(requestedFontSize)
      ? Math.min(72, Math.max(6, requestedFontSize))
      : 12;
    const format =
      (document.getElementById('number-format') as HTMLSelectElement).value ===
      'page_x_of_y'
        ? ('page_x_of_y' as PageNumberFormat)
        : ('simple' as PageNumberFormat);
    const colorHex = (document.getElementById('text-color') as HTMLInputElement)
      .value;
    const textColor = hexToRgb(colorHex);

    const pdfBytes = new Uint8Array(await pageState.pdfDoc.save());
    const resultBytes = await addPageNumbersToPdf(pdfBytes, {
      position,
      fontSize,
      format,
      color: textColor,
    });

    downloadFile(
      new Blob([new Uint8Array(resultBytes)], {
        type: 'application/pdf',
      }),
      pageState.file?.name || 'document.pdf'
    );
    showAlert(
      t('common.success'),
      t('tools:pageNumbers.success'),
      'success',
      () => {
        resetState();
      }
    );
  } catch (e) {
    console.error(e);
    showAlert(t('common.error'), t('tools:pageNumbers.failed'));
  } finally {
    hideLoader();
  }
}
