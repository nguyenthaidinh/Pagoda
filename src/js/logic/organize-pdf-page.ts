import { createIcons, icons } from 'lucide';
import { showAlert, showLoader, hideLoader } from '../ui.js';
import { formatBytes, downloadFile, initializeQpdf } from '../utils/helpers.js';
import { extractPagesWithQpdf } from '../utils/split-pdf-helpers.js';
import { initPagePreview } from '../utils/page-preview.js';
import { PDFDocument } from 'pdf-lib';
import { loadPdfWithPasswordPrompt } from '../utils/password-prompt.js';
import * as pdfjsLib from 'pdfjs-dist';
import Sortable from 'sortablejs';
import { loadPdfDocument } from '../utils/load-pdf-document.js';
import { t } from '../i18n/i18n';
import '../utils/setup-pdf-worker.js';

interface OrganizeState {
  file: File | null;
  pdfDoc: PDFDocument | null;
  sourceBytes: Uint8Array | null;
  pdfJsDoc: pdfjsLib.PDFDocumentProxy | null;
  totalPages: number;
  sortableInstance: Sortable | null;
}

const organizeState: OrganizeState = {
  file: null,
  pdfDoc: null,
  sourceBytes: null,
  pdfJsDoc: null,
  totalPages: 0,
  sortableInstance: null,
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
  const processBtn = document.getElementById('process-btn');

  if (fileInput) fileInput.addEventListener('change', handleFileUpload);

  if (dropZone) {
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('bg-gray-700');
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('bg-gray-700');
    });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('bg-gray-700');
      const droppedFiles = e.dataTransfer?.files;
      if (droppedFiles && droppedFiles.length > 0) handleFile(droppedFiles[0]);
    });
    // Clear value on click to allow re-selecting the same file
    fileInput?.addEventListener('click', () => {
      if (fileInput) fileInput.value = '';
    });
  }

  if (processBtn) processBtn.addEventListener('click', saveChanges);

  document.getElementById('back-to-tools')?.addEventListener('click', () => {
    window.location.href = import.meta.env.BASE_URL;
  });

  const applyOrderBtn = document.getElementById('apply-order-btn');
  if (applyOrderBtn) applyOrderBtn.addEventListener('click', applyCustomOrder);
}

function applyCustomOrder() {
  const orderInput = document.getElementById(
    'page-order-input'
  ) as HTMLInputElement;
  const grid = document.getElementById('page-grid');

  if (!orderInput || !grid) return;

  const orderString = orderInput.value.trim();
  if (!orderString) {
    showAlert(
      t('tools:duplicateOrganize.invalidOrderTitle'),
      t('tools:duplicateOrganize.enterOrder')
    );
    return;
  }

  const orderParts = orderString.split(',').map((value) => value.trim());
  const currentGridCount = grid.children.length;
  const validNumbers = orderParts.every((value) => /^[1-9]\d*$/.test(value));
  if (!validNumbers) {
    showAlert(
      t('tools:duplicateOrganize.invalidNumbersTitle'),
      t('tools:duplicateOrganize.positiveNumbers')
    );
    return;
  }
  const newOrder = orderParts.map(Number);

  if (newOrder.length !== currentGridCount) {
    showAlert(
      t('tools:duplicateOrganize.incorrectCountTitle'),
      t('tools:duplicateOrganize.incorrectCount', {
        specified: newOrder.length,
        current: currentGridCount,
      })
    );
    return;
  }

  const uniqueNumbers = new Set(newOrder);
  if (uniqueNumbers.size !== newOrder.length) {
    showAlert(
      t('tools:duplicateOrganize.duplicateNumbersTitle'),
      t('tools:duplicateOrganize.duplicateNumbers')
    );
    return;
  }

  const currentThumbnails = Array.from(grid.children) as HTMLElement[];
  const reorderedThumbnails = newOrder
    .map((pageNum) => currentThumbnails[pageNum - 1])
    .filter((thumbnail): thumbnail is HTMLElement => Boolean(thumbnail));

  if (reorderedThumbnails.length !== currentGridCount) {
    showAlert(
      t('tools:duplicateOrganize.invalidPageOrderTitle'),
      t('tools:duplicateOrganize.invalidPageOrder')
    );
    return;
  }

  // Clear the grid and append the reordered thumbnails
  grid.innerHTML = '';
  reorderedThumbnails.forEach((thumb) => grid.appendChild(thumb));
  renumberPages();

  initializeSortable(); // Re-initialize sortable on the new order

  showAlert(
    t('common.success'),
    t('tools:duplicateOrganize.reordered'),
    'success'
  );
}

function handleFileUpload(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files && input.files.length > 0) handleFile(input.files[0]);
}

async function handleFile(file: File) {
  if (
    file.type !== 'application/pdf' &&
    !file.name.toLowerCase().endsWith('.pdf')
  ) {
    showAlert(t('common.error'), t('tools:duplicateOrganize.invalidFile'));
    return;
  }

  organizeState.file = file;

  try {
    const result = await loadPdfWithPasswordPrompt(file);
    if (!result) return;
    showLoader(t('tools:duplicateOrganize.loadingPdf'));

    organizeState.pdfDoc = await loadPdfDocument(result.bytes);
    organizeState.sourceBytes = new Uint8Array(result.bytes.slice(0));
    organizeState.pdfJsDoc = result.pdf;
    organizeState.file = result.file;
    organizeState.totalPages = organizeState.pdfDoc.getPageCount();

    updateFileDisplay();
    await renderThumbnails();
    hideLoader();
  } catch (error) {
    console.error('Error loading PDF:', error);
    hideLoader();
    showAlert(t('common.error'), t('tools:duplicateOrganize.loadFailed'));
  }
}

function updateFileDisplay() {
  const fileDisplayArea = document.getElementById('file-display-area');
  if (!fileDisplayArea || !organizeState.file) return;

  fileDisplayArea.innerHTML = '';
  const fileDiv = document.createElement('div');
  fileDiv.className =
    'flex items-center justify-between bg-gray-700 p-3 rounded-lg';

  const infoContainer = document.createElement('div');
  infoContainer.className = 'flex flex-col flex-1 min-w-0';

  const nameSpan = document.createElement('div');
  nameSpan.className = 'truncate font-medium text-gray-200 text-sm mb-1';
  nameSpan.textContent = organizeState.file.name;

  const metaSpan = document.createElement('div');
  metaSpan.className = 'text-xs text-gray-400';
  metaSpan.textContent = `${formatBytes(organizeState.file.size)} • ${organizeState.totalPages} ${t('common.pages')}`;

  infoContainer.append(nameSpan, metaSpan);

  const removeBtn = document.createElement('button');
  removeBtn.className = 'ml-4 text-red-400 hover:text-red-300 flex-shrink-0';
  removeBtn.title = t('common.remove');
  removeBtn.innerHTML = '<i data-lucide="trash-2" class="w-4 h-4"></i>';
  removeBtn.onclick = () => resetState();

  fileDiv.append(infoContainer, removeBtn);
  fileDisplayArea.appendChild(fileDiv);
  createIcons({ icons });
}

function renumberPages() {
  const grid = document.getElementById('page-grid');
  if (!grid) return;
  const labels = grid.querySelectorAll('.page-number');
  labels.forEach((label, index) => {
    label.textContent = (index + 1).toString();
  });
}

function attachEventListeners(element: HTMLElement) {
  const duplicateBtn = element.querySelector('.duplicate-btn');
  const deleteBtn = element.querySelector('.delete-btn');

  duplicateBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const clone = element.cloneNode(true) as HTMLElement;
    element.after(clone);
    attachEventListeners(clone);
    renumberPages();
    createIcons({ icons });
    initializeSortable();
  });

  deleteBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const grid = document.getElementById('page-grid');
    if (grid && grid.children.length > 1) {
      element.remove();
      renumberPages();
      initializeSortable();
    } else {
      showAlert(
        t('tools:duplicateOrganize.cannotDeleteTitle'),
        t('tools:duplicateOrganize.cannotDelete')
      );
    }
  });
}

async function renderThumbnails() {
  const grid = document.getElementById('page-grid');
  const processBtn = document.getElementById('process-btn');
  const advancedSettings = document.getElementById('advanced-settings');
  if (!grid || !processBtn || !advancedSettings) return;

  grid.innerHTML = '';
  grid.classList.remove('hidden');
  processBtn.classList.remove('hidden');
  advancedSettings.classList.remove('hidden');

  for (let i = 1; i <= organizeState.totalPages; i++) {
    const page = await organizeState.pdfJsDoc.getPage(i);
    const viewport = page.getViewport({ scale: 1 });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvas: null, canvasContext: ctx, viewport }).promise;

    const wrapper = document.createElement('div');
    wrapper.className =
      'page-thumbnail relative cursor-move flex flex-col items-center gap-1 p-2 border-2 border-gray-600 hover:border-indigo-500 rounded-lg bg-gray-700 transition-colors group';
    wrapper.dataset.originalPageIndex = (i - 1).toString();
    wrapper.dataset.pageNumber = i.toString();

    const imgContainer = document.createElement('div');
    imgContainer.className = 'relative';

    const img = document.createElement('img');
    img.src = canvas.toDataURL();
    img.className = 'rounded-md shadow-md max-w-full h-auto';
    imgContainer.appendChild(img);

    const pageLabel = document.createElement('div');
    pageLabel.className =
      'page-number absolute top-1 left-1 bg-indigo-600 text-white text-xs px-2 py-1 rounded-md font-semibold shadow-lg z-10 pointer-events-none';
    pageLabel.textContent = i.toString();
    imgContainer.appendChild(pageLabel);

    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'flex items-center justify-center gap-4';

    const duplicateBtn = document.createElement('button');
    duplicateBtn.className =
      'duplicate-btn bg-green-600 hover:bg-green-700 text-white rounded-full w-8 h-8 flex items-center justify-center';
    duplicateBtn.title = t('tools:duplicateOrganize.duplicatePage');
    duplicateBtn.innerHTML = '<i data-lucide="copy-plus" class="w-5 h-5"></i>';

    const deleteBtn = document.createElement('button');
    deleteBtn.className =
      'delete-btn bg-red-600 hover:bg-red-700 text-white rounded-full w-8 h-8 flex items-center justify-center';
    deleteBtn.title = t('tools:duplicateOrganize.deletePage');
    deleteBtn.innerHTML = '<i data-lucide="x-circle" class="w-5 h-5"></i>';

    controlsDiv.append(duplicateBtn, deleteBtn);
    wrapper.append(imgContainer, controlsDiv);
    grid.appendChild(wrapper);

    attachEventListeners(wrapper);
  }

  createIcons({ icons });
  initializeSortable();
  initPagePreview(grid, organizeState.pdfJsDoc);
}

function initializeSortable() {
  const grid = document.getElementById('page-grid');
  if (!grid) return;

  if (organizeState.sortableInstance) organizeState.sortableInstance.destroy();

  organizeState.sortableInstance = Sortable.create(grid, {
    animation: 150,
    ghostClass: 'sortable-ghost',
    chosenClass: 'sortable-chosen',
    dragClass: 'sortable-drag',
    filter: '.duplicate-btn, .delete-btn',
    preventOnFilter: true,
    onStart: (evt) => {
      if (evt.item) evt.item.style.opacity = '0.5';
    },
    onEnd: (evt) => {
      if (evt.item) evt.item.style.opacity = '1';
      renumberPages();
    },
  });
}

async function saveChanges() {
  const grid = document.getElementById('page-grid');
  if (!grid) return;

  showLoader(t('tools:duplicateOrganize.buildingPdf'));

  try {
    const finalPageElements = grid.querySelectorAll('.page-thumbnail');
    const finalIndices = Array.from(finalPageElements)
      .map((el) =>
        parseInt((el as HTMLElement).dataset.originalPageIndex || '', 10)
      )
      .filter((index) => !isNaN(index) && index >= 0);

    if (finalIndices.length === 0) {
      hideLoader();
      showAlert(t('common.error'), t('tools:duplicateOrganize.noValidPages'));
      return;
    }

    if (!organizeState.sourceBytes) return;
    const qpdf = await initializeQpdf();
    showLoader(t('tools:duplicateOrganize.buildingPdf'));
    const inputPath = '/organize-input.pdf';
    qpdf.FS.writeFile(inputPath, organizeState.sourceBytes);
    let pdfBytes: Uint8Array;
    try {
      pdfBytes = extractPagesWithQpdf(qpdf, inputPath, finalIndices);
    } finally {
      qpdf.FS.unlink(inputPath);
    }
    downloadFile(
      new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' }),
      organizeState.file?.name || 'document.pdf'
    );

    hideLoader();
    showAlert(
      t('common.success'),
      t('tools:duplicateOrganize.organized'),
      'success',
      () => resetState()
    );
  } catch (error) {
    console.error('Error saving changes:', error);
    hideLoader();
    showAlert(t('common.error'), t('tools:duplicateOrganize.saveFailed'));
  }
}

function resetState() {
  if (organizeState.sortableInstance) {
    organizeState.sortableInstance.destroy();
    organizeState.sortableInstance = null;
  }

  organizeState.pdfJsDoc?.destroy();
  organizeState.file = null;
  organizeState.pdfDoc = null;
  organizeState.sourceBytes = null;
  organizeState.pdfJsDoc = null;
  organizeState.totalPages = 0;

  const grid = document.getElementById('page-grid');
  if (grid) {
    grid.innerHTML = '';
    grid.classList.add('hidden');
  }
  document.getElementById('process-btn')?.classList.add('hidden');
  document.getElementById('advanced-settings')?.classList.add('hidden');
  const orderInput = document.getElementById(
    'page-order-input'
  ) as HTMLInputElement | null;
  if (orderInput) orderInput.value = '';
  const fileDisplayArea = document.getElementById('file-display-area');
  if (fileDisplayArea) fileDisplayArea.innerHTML = '';
}
