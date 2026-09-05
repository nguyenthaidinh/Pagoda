import { createIcons, icons } from 'lucide';
import {
  getVisualPageSpace,
  drawInVisualPageSpace,
} from '../utils/pdf-page-space.js';
import { showAlert, showLoader, hideLoader } from '../ui.js';
import {
  downloadFile,
  hexToRgb,
  formatBytes,
  isPdfFile,
  parsePageRangesStrict,
} from '../utils/helpers.js';
import { rgb, StandardFonts } from 'pdf-lib';
import { loadPdfWithPasswordPrompt } from '../utils/password-prompt.js';
import { HeaderFooterState } from '@/types';
import { loadPdfDocument } from '../utils/load-pdf-document.js';
import { t } from '../i18n/i18n.js';
import { embedFontForText } from '../utils/pdf-font.js';
import { goToLocalizedTools } from '../utils/localized-navigation.js';

const pageState: HeaderFooterState = { file: null, pdfDoc: null };

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
  if (processBtn) processBtn.addEventListener('click', addHeaderFooter);
}

function handleFileUpload(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files?.length) handleFiles(input.files);
}

async function handleFiles(files: FileList) {
  const file = files[0];
  if (!file || !isPdfFile(file)) {
    showAlert(t('common.error'), t('tools:headerFooter.invalidFile'));
    return;
  }
  try {
    const result = await loadPdfWithPasswordPrompt(file);
    if (!result) return;
    showLoader(t('tools:headerFooter.loading'));

    pageState.pdfDoc = await loadPdfDocument(result.bytes);
    pageState.file = result.file;
    result.pdf.destroy();

    updateFileDisplay();
    document.getElementById('options-panel')?.classList.remove('hidden');
    const totalPagesSpan = document.getElementById('total-pages');
    if (totalPagesSpan)
      totalPagesSpan.textContent = String(pageState.pdfDoc.getPageCount());
  } catch (error) {
    console.error(error);
    showAlert(t('common.error'), t('tools:headerFooter.loadFailed'));
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
  metaSpan.textContent = t('tools:headerFooter.fileMeta', {
    size: formatBytes(pageState.file.size),
    count: pageState.pdfDoc.getPageCount(),
  });
  infoContainer.append(nameSpan, metaSpan);
  const removeBtn = document.createElement('button');
  removeBtn.className = 'ml-4 text-red-400 hover:text-red-300 flex-shrink-0';
  removeBtn.innerHTML = '<i data-lucide="trash-2" class="w-4 h-4"></i>';
  removeBtn.title = t('tools:headerFooter.removeFile');
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

async function addHeaderFooter() {
  if (!pageState.pdfDoc) {
    showAlert(t('common.error'), t('tools:headerFooter.uploadFirst'));
    return;
  }
  try {
    const workingDoc = await loadPdfDocument(await pageState.pdfDoc.save());
    const allPages = workingDoc.getPages();
    const totalPages = allPages.length;
    const margin = 40;
    const requestedFontSize = Number(
      (document.getElementById('font-size') as HTMLInputElement)?.value || '10'
    );
    const fontSize = Number.isFinite(requestedFontSize)
      ? Math.min(72, Math.max(6, requestedFontSize))
      : 10;
    const colorHex =
      (document.getElementById('font-color') as HTMLInputElement)?.value ||
      '#000000';
    const fontColor = hexToRgb(colorHex);
    const pageRangeInput =
      (document.getElementById('page-range') as HTMLInputElement)?.value || '';
    const texts = {
      headerLeft:
        (document.getElementById('header-left') as HTMLInputElement)?.value ||
        '',
      headerCenter:
        (document.getElementById('header-center') as HTMLInputElement)?.value ||
        '',
      headerRight:
        (document.getElementById('header-right') as HTMLInputElement)?.value ||
        '',
      footerLeft:
        (document.getElementById('footer-left') as HTMLInputElement)?.value ||
        '',
      footerCenter:
        (document.getElementById('footer-center') as HTMLInputElement)?.value ||
        '',
      footerRight:
        (document.getElementById('footer-right') as HTMLInputElement)?.value ||
        '',
    };
    if (!Object.values(texts).some((text) => text.trim())) {
      showAlert(t('common.error'), t('tools:headerFooter.textRequired'));
      return;
    }
    const indicesToProcess = parsePageRangesStrict(pageRangeInput, totalPages);
    if (indicesToProcess.length === 0) {
      showAlert(t('common.error'), t('tools:headerFooter.invalidRange'));
      return;
    }
    showLoader(t('tools:headerFooter.processing'));
    const helveticaFont = await embedFontForText(
      workingDoc,
      Object.values(texts).join(' '),
      StandardFonts.Helvetica
    );
    const drawOptions = {
      font: helveticaFont,
      size: fontSize,
      color: rgb(fontColor.r, fontColor.g, fontColor.b),
    };

    for (const pageIndex of indicesToProcess) {
      const page = allPages[pageIndex];
      const { width, height } = getVisualPageSpace(page);
      const pageX = 0,
        pageY = 0;
      const pageNumber = pageIndex + 1;
      const processText = (text: string) =>
        text
          .replace(/{page}/g, String(pageNumber))
          .replace(/{total}/g, String(totalPages));
      const processed = {
        headerLeft: processText(texts.headerLeft),
        headerCenter: processText(texts.headerCenter),
        headerRight: processText(texts.headerRight),
        footerLeft: processText(texts.footerLeft),
        footerCenter: processText(texts.footerCenter),
        footerRight: processText(texts.footerRight),
      };
      drawInVisualPageSpace(page, () => {
        if (processed.headerLeft)
          page.drawText(processed.headerLeft, {
            ...drawOptions,
            x: pageX + margin,
            y: pageY + height - margin,
          });
        if (processed.headerCenter)
          page.drawText(processed.headerCenter, {
            ...drawOptions,
            x:
              pageX +
              width / 2 -
              helveticaFont.widthOfTextAtSize(
                processed.headerCenter,
                fontSize
              ) /
                2,
            y: pageY + height - margin,
          });
        if (processed.headerRight)
          page.drawText(processed.headerRight, {
            ...drawOptions,
            x:
              pageX +
              width -
              margin -
              helveticaFont.widthOfTextAtSize(processed.headerRight, fontSize),
            y: pageY + height - margin,
          });
        if (processed.footerLeft)
          page.drawText(processed.footerLeft, {
            ...drawOptions,
            x: pageX + margin,
            y: pageY + margin,
          });
        if (processed.footerCenter)
          page.drawText(processed.footerCenter, {
            ...drawOptions,
            x:
              pageX +
              width / 2 -
              helveticaFont.widthOfTextAtSize(
                processed.footerCenter,
                fontSize
              ) /
                2,
            y: pageY + margin,
          });
        if (processed.footerRight)
          page.drawText(processed.footerRight, {
            ...drawOptions,
            x:
              pageX +
              width -
              margin -
              helveticaFont.widthOfTextAtSize(processed.footerRight, fontSize),
            y: pageY + margin,
          });
      });
    }
    const newPdfBytes = await workingDoc.save();
    downloadFile(
      new Blob([new Uint8Array(newPdfBytes)], { type: 'application/pdf' }),
      pageState.file?.name || 'document.pdf'
    );
    showAlert(
      t('common.success'),
      t('tools:headerFooter.success'),
      'success',
      () => {
        resetState();
      }
    );
  } catch (e: unknown) {
    console.error(e);
    showAlert(t('common.error'), t('tools:headerFooter.failed'));
  } finally {
    hideLoader();
  }
}
