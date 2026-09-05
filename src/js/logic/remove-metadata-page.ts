import { showAlert } from '../ui.js';
import { downloadFile, formatBytes } from '../utils/helpers.js';
import { icons, createIcons } from 'lucide';
import { loadPdfWithPasswordPrompt } from '../utils/password-prompt.js';
import { loadPdfDocument } from '../utils/load-pdf-document.js';
import { removeMetadataFromDoc } from '../utils/sanitize.js';
import { t } from '../i18n/i18n.js';
import {
  isPdfFile,
  pdfOutputName,
  securityText,
} from '../utils/security-pdf-page.js';
import { goToLocalizedTools } from '../utils/localized-navigation.js';

interface PageState {
  file: File | null;
}

const pageState: PageState = {
  file: null,
};

function resetState() {
  pageState.file = null;

  const fileDisplayArea = document.getElementById('file-display-area');
  if (fileDisplayArea) fileDisplayArea.innerHTML = '';

  const toolOptions = document.getElementById('tool-options');
  if (toolOptions) toolOptions.classList.add('hidden');

  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  if (fileInput) fileInput.value = '';
}

async function updateUI() {
  const fileDisplayArea = document.getElementById('file-display-area');
  const toolOptions = document.getElementById('tool-options');

  if (!fileDisplayArea) return;

  fileDisplayArea.innerHTML = '';

  if (pageState.file) {
    const fileDiv = document.createElement('div');
    fileDiv.className =
      'flex items-center justify-between bg-gray-700 p-3 rounded-lg text-sm';

    const infoContainer = document.createElement('div');
    infoContainer.className = 'flex flex-col overflow-hidden';

    const nameSpan = document.createElement('div');
    nameSpan.className = 'truncate font-medium text-gray-200 text-sm mb-1';
    nameSpan.textContent = pageState.file.name;

    const metaSpan = document.createElement('div');
    metaSpan.className = 'text-xs text-gray-400';
    metaSpan.textContent = formatBytes(pageState.file.size);

    infoContainer.append(nameSpan, metaSpan);

    const removeBtn = document.createElement('button');
    removeBtn.className = 'ml-4 text-red-400 hover:text-red-300 flex-shrink-0';
    removeBtn.type = 'button';
    removeBtn.title = securityText('removeFile');
    removeBtn.setAttribute('aria-label', securityText('removeFile'));
    removeBtn.innerHTML = '<i data-lucide="trash-2" class="w-4 h-4"></i>';
    removeBtn.onclick = function () {
      resetState();
    };

    fileDiv.append(infoContainer, removeBtn);
    fileDisplayArea.appendChild(fileDiv);
    createIcons({ icons });

    if (toolOptions) toolOptions.classList.remove('hidden');
  } else {
    if (toolOptions) toolOptions.classList.add('hidden');
  }
}

function handleFileSelect(files: FileList | null) {
  if (files && files.length > 0) {
    const file = files[0];
    if (isPdfFile(file)) {
      pageState.file = file;
      updateUI();
    } else {
      showAlert(
        securityText('invalidFileTitle'),
        securityText('invalidPdfMessage')
      );
    }
  }
}

async function removeMetadata() {
  if (!pageState.file) {
    showAlert(securityText('noFileTitle'), securityText('noFileMessage'));
    return;
  }

  const loaderModal = document.getElementById('loader-modal');
  const loaderText = document.getElementById('loader-text');
  if (loaderModal) loaderModal.classList.remove('hidden');
  if (loaderText) loaderText.textContent = t('tools:removeMetadata.removing');

  try {
    if (loaderModal) loaderModal.classList.add('hidden');
    const result = await loadPdfWithPasswordPrompt(pageState.file);
    if (!result) {
      if (loaderModal) loaderModal.classList.add('hidden');
      return;
    }
    if (loaderModal) loaderModal.classList.remove('hidden');
    if (loaderText) loaderText.textContent = t('tools:removeMetadata.removing');
    result.pdf.destroy();
    const pdfDoc = await loadPdfDocument(result.bytes, {
      updateMetadata: false,
    });

    removeMetadataFromDoc(pdfDoc);

    const newPdfBytes = await pdfDoc.save();
    const downloadBytes = Uint8Array.from(newPdfBytes);
    downloadFile(
      new Blob([downloadBytes.buffer], { type: 'application/pdf' }),
      pdfOutputName(pageState.file?.name || 'document.pdf', 'metadata-removed')
    );
    showAlert(
      securityText('successTitle'),
      t('tools:removeMetadata.successMessage'),
      'success',
      resetState
    );
  } catch (e) {
    console.error(e);
    showAlert(
      securityText('errorTitle'),
      t('tools:removeMetadata.failureMessage')
    );
  } finally {
    if (loaderModal) loaderModal.classList.add('hidden');
  }
}

document.addEventListener('DOMContentLoaded', function () {
  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  const dropZone = document.getElementById('drop-zone');
  const processBtn = document.getElementById('process-btn');
  const backBtn = document.getElementById('back-to-tools');

  if (backBtn) {
    backBtn.addEventListener('click', goToLocalizedTools);
  }

  if (fileInput && dropZone) {
    fileInput.addEventListener('change', function (e) {
      handleFileSelect((e.target as HTMLInputElement).files);
    });

    dropZone.addEventListener('dragover', function (e) {
      e.preventDefault();
      dropZone.classList.add('bg-gray-700');
    });

    dropZone.addEventListener('dragleave', function (e) {
      e.preventDefault();
      dropZone.classList.remove('bg-gray-700');
    });

    dropZone.addEventListener('drop', function (e) {
      e.preventDefault();
      dropZone.classList.remove('bg-gray-700');
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const pdfFiles = Array.from(files).filter(isPdfFile);
        if (pdfFiles.length > 0) {
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(pdfFiles[0]);
          handleFileSelect(dataTransfer.files);
        }
      }
    });

    fileInput.addEventListener('click', function () {
      fileInput.value = '';
    });
  }

  if (processBtn) {
    processBtn.addEventListener('click', removeMetadata);
  }
});
