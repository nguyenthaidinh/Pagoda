import { createIcons, icons } from 'lucide';
import { showAlert, showLoader, hideLoader } from '../ui.js';
import {
  downloadFile,
  hexToRgb,
  formatBytes,
  isPdfFile,
} from '../utils/helpers.js';
import { recolorPdfText } from '../utils/pdf-text-color.js';
import { TextColorState } from '@/types';
import { loadPdfWithPasswordPrompt } from '../utils/password-prompt.js';
import { loadPdfDocument } from '../utils/load-pdf-document.js';
import { t } from '../i18n/i18n.js';
import { goToLocalizedTools } from '../utils/localized-navigation.js';
import '../utils/setup-pdf-worker.js';

const pageState: TextColorState = { file: null, pdfDoc: null };

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
      if (e.dataTransfer?.files.length) handleFiles(e.dataTransfer.files);
    });
  }
  if (backBtn)
    backBtn.addEventListener('click', () => {
      goToLocalizedTools();
    });
  if (processBtn) processBtn.addEventListener('click', changeTextColor);
}

function handleFileUpload(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files?.length) handleFiles(input.files);
}

async function handleFiles(files: FileList) {
  const file = files[0];
  if (!file || !isPdfFile(file)) {
    showAlert(t('common.error'), t('tools:changeTextColor.invalidFile'));
    return;
  }
  try {
    const result = await loadPdfWithPasswordPrompt(file);
    if (!result) return;
    showLoader(t('tools:changeTextColor.loading'));
    result.pdf.destroy();
    pageState.pdfDoc = await loadPdfDocument(result.bytes);
    pageState.file = result.file;
    updateFileDisplay();
    document.getElementById('options-panel')?.classList.remove('hidden');
  } catch (error) {
    console.error(error);
    showAlert(t('common.error'), t('tools:changeTextColor.loadFailed'));
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
  metaSpan.textContent = t('tools:changeTextColor.fileMeta', {
    size: formatBytes(pageState.file.size),
    count: pageState.pdfDoc.getPageCount(),
  });
  infoContainer.append(nameSpan, metaSpan);
  const removeBtn = document.createElement('button');
  removeBtn.className = 'ml-4 text-red-400 hover:text-red-300 flex-shrink-0';
  removeBtn.innerHTML = '<i data-lucide="trash-2" class="w-4 h-4"></i>';
  removeBtn.title = t('tools:changeTextColor.removeFile');
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

async function changeTextColor() {
  if (!pageState.pdfDoc || !pageState.file) {
    showAlert(t('common.error'), t('tools:changeTextColor.uploadFirst'));
    return;
  }
  const colorHex = (
    document.getElementById('text-color-input') as HTMLInputElement
  ).value;
  const { r, g, b } = hexToRgb(colorHex);
  showLoader(t('tools:changeTextColor.processing'));
  try {
    const result = await recolorPdfText(
      new Uint8Array(await pageState.pdfDoc.save()),
      { r, g, b },
      (current, total) => {
        showLoader(
          t('tools:changeTextColor.processingPage', { current, total })
        );
      }
    );
    if (!result.textObjects) {
      showAlert(t('common.error'), t('tools:changeTextColor.noText'));
      return;
    }
    downloadFile(
      new Blob([new Uint8Array(result.bytes)], { type: 'application/pdf' }),
      pageState.file?.name || 'document.pdf'
    );
    showAlert(
      t('common.success'),
      t('tools:changeTextColor.success'),
      'success',
      () => {
        resetState();
      }
    );
  } catch (e) {
    console.error(e);
    showAlert(t('common.error'), t('tools:changeTextColor.failed'));
  } finally {
    hideLoader();
  }
}
