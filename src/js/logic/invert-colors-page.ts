import { createIcons, icons } from 'lucide';
import { showAlert, showLoader, hideLoader } from '../ui.js';
import {
  canvasToBlob,
  downloadFile,
  formatBytes,
  getPDFDocument,
  isPdfFile,
} from '../utils/helpers.js';
import { PDFDocument as PDFLibDocument } from 'pdf-lib';
import { applyInvertColors } from '../utils/image-effects.js';
import * as pdfjsLib from 'pdfjs-dist';
import { InvertColorsState } from '@/types';
import { loadPdfWithPasswordPrompt } from '../utils/password-prompt.js';
import { loadPdfDocument } from '../utils/load-pdf-document.js';
import { t } from '../i18n/i18n.js';
import { goToLocalizedTools } from '../utils/localized-navigation.js';
import '../utils/setup-pdf-worker.js';

const pageState: InvertColorsState = { file: null, pdfDoc: null };

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
  if (processBtn) processBtn.addEventListener('click', invertColors);
}

function handleFileUpload(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files?.length) handleFiles(input.files);
}

async function handleFiles(files: FileList) {
  const file = files[0];
  if (!file || !isPdfFile(file)) {
    showAlert(t('common.error'), t('tools:invertColors.invalidFile'));
    return;
  }
  try {
    const result = await loadPdfWithPasswordPrompt(file);
    if (!result) return;
    showLoader(t('tools:invertColors.loading'));
    result.pdf.destroy();
    pageState.pdfDoc = await loadPdfDocument(result.bytes);
    pageState.file = result.file;
    updateFileDisplay();
    document.getElementById('options-panel')?.classList.remove('hidden');
  } catch (error) {
    console.error(error);
    showAlert(t('common.error'), t('tools:invertColors.loadFailed'));
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
  metaSpan.textContent = t('tools:invertColors.fileMeta', {
    size: formatBytes(pageState.file.size),
    count: pageState.pdfDoc.getPageCount(),
  });
  infoContainer.append(nameSpan, metaSpan);
  const removeBtn = document.createElement('button');
  removeBtn.className = 'ml-4 text-red-400 hover:text-red-300 flex-shrink-0';
  removeBtn.innerHTML = '<i data-lucide="trash-2" class="w-4 h-4"></i>';
  removeBtn.title = t('tools:invertColors.removeFile');
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

async function invertColors() {
  if (!pageState.pdfDoc || !pageState.file) {
    showAlert(t('common.error'), t('tools:invertColors.uploadFirst'));
    return;
  }
  showLoader(t('tools:invertColors.processing'));
  let pdfjsDoc: pdfjsLib.PDFDocumentProxy | null = null;
  try {
    const newPdfDoc = await PDFLibDocument.create();
    const pdfBytes = await pageState.pdfDoc.save();
    pdfjsDoc = await getPDFDocument({ data: pdfBytes }).promise;

    for (let i = 1; i <= pdfjsDoc.numPages; i++) {
      showLoader(
        t('tools:invertColors.processingPage', {
          current: i,
          total: pdfjsDoc.numPages,
        })
      );
      const page = await pdfjsDoc.getPage(i);
      const originalViewport = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d')!;
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      applyInvertColors(imageData);
      ctx.putImageData(imageData, 0, 0);

      const pngImageBytes = await (await canvasToBlob(canvas)).arrayBuffer();

      const image = await newPdfDoc.embedPng(pngImageBytes);
      const newPage = newPdfDoc.addPage([
        originalViewport.width,
        originalViewport.height,
      ]);
      newPage.drawImage(image, {
        x: 0,
        y: 0,
        width: originalViewport.width,
        height: originalViewport.height,
      });
    }
    const newPdfBytes = await newPdfDoc.save();
    downloadFile(
      new Blob([new Uint8Array(newPdfBytes)], { type: 'application/pdf' }),
      pageState.file?.name || 'document.pdf'
    );
    showAlert(
      t('common.success'),
      t('tools:invertColors.success'),
      'success',
      () => {
        resetState();
      }
    );
  } catch (e) {
    console.error(e);
    showAlert(t('common.error'), t('tools:invertColors.failed'));
  } finally {
    pdfjsDoc?.destroy();
    hideLoader();
  }
}
