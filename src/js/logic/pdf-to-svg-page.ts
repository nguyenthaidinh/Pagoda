import { showLoader, hideLoader, showAlert } from '../ui.js';
import { downloadFile, formatBytes } from '../utils/helpers.js';
import { createIcons, icons } from 'lucide';
import JSZip from 'jszip';
import { loadPyMuPDF, isPyMuPDFAvailable } from '../utils/pymupdf-loader.js';
import type { PyMuPDFInstance } from '@/types';
import { batchDecryptIfNeeded } from '../utils/password-prompt.js';
import { showWasmRequiredDialog } from '../utils/wasm-provider.js';
import { deduplicateFileName } from '../utils/deduplicate-filename.js';
import { filterPdfFiles, pdfExportText } from '../utils/pdf-export-page.js';
import { goToLocalizedTools } from '../utils/localized-navigation.js';

let pymupdf: PyMuPDFInstance | null = null;
let files: File[] = [];

const updateUI = () => {
  const fileDisplayArea = document.getElementById('file-display-area');
  const optionsPanel = document.getElementById('options-panel');
  const fileControls = document.getElementById('file-controls');

  if (!fileDisplayArea || !optionsPanel) return;

  fileDisplayArea.innerHTML = '';

  if (files.length > 0) {
    optionsPanel.classList.remove('hidden');
    if (fileControls) fileControls.classList.remove('hidden');

    files.forEach((file, index) => {
      const fileDiv = document.createElement('div');
      fileDiv.className =
        'flex items-center justify-between bg-gray-700 p-3 rounded-lg text-sm';

      const infoContainer = document.createElement('div');
      infoContainer.className = 'flex flex-col overflow-hidden';

      const nameSpan = document.createElement('div');
      nameSpan.className = 'truncate font-medium text-gray-200 text-sm mb-1';
      nameSpan.textContent = file.name;

      const metaSpan = document.createElement('div');
      metaSpan.className = 'text-xs text-gray-400';
      metaSpan.textContent = formatBytes(file.size);

      infoContainer.append(nameSpan, metaSpan);

      const removeBtn = document.createElement('button');
      removeBtn.className =
        'ml-4 text-red-400 hover:text-red-300 flex-shrink-0';
      removeBtn.innerHTML = '<i data-lucide="trash-2" class="w-4 h-4"></i>';
      removeBtn.title = pdfExportText('removeFile');
      removeBtn.onclick = () => {
        files = files.filter((_, i) => i !== index);
        updateUI();
      };

      fileDiv.append(infoContainer, removeBtn);
      fileDisplayArea.appendChild(fileDiv);
    });

    createIcons({ icons });
  } else {
    optionsPanel.classList.add('hidden');
    if (fileControls) fileControls.classList.add('hidden');
  }
};

const resetState = () => {
  files = [];
  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  if (fileInput) fileInput.value = '';
  updateUI();
};

async function convert() {
  if (files.length === 0) {
    showAlert(pdfExportText('noFilesTitle'), pdfExportText('noFiles'));
    return;
  }

  // Check if PyMuPDF is configured
  if (!isPyMuPDFAvailable()) {
    showWasmRequiredDialog('pymupdf');
    return;
  }

  showLoader(pdfExportText('loadingEngine'));

  try {
    // Load PyMuPDF dynamically if not already loaded
    if (!pymupdf) {
      pymupdf = await loadPyMuPDF();
    }

    hideLoader();
    files = await batchDecryptIfNeeded(files);
    showLoader(pdfExportText('converting', { format: 'SVG' }));

    const isSingleFile = files.length === 1;

    if (isSingleFile) {
      const doc = await pymupdf.open(files[0]);
      try {
        const pageCount = doc.pageCount;
        const baseName = files[0].name.replace(/\.[^/.]+$/, '');

        if (pageCount === 1) {
          showLoader(pdfExportText('converting', { format: 'SVG' }));
          const page = doc.getPage(0);
          const svgContent = page.toSvg();
          const svgBlob = new Blob([svgContent], { type: 'image/svg+xml' });
          downloadFile(svgBlob, `${baseName}.svg`);
          showAlert(
            pdfExportText('conversionCompleteTitle'),
            pdfExportText('singleConverted', {
              file: files[0].name,
              format: 'SVG',
            }),
            'success',
            () => resetState()
          );
        } else {
          const zip = new JSZip();
          for (let i = 0; i < pageCount; i++) {
            showLoader(
              pdfExportText('convertingPage', {
                current: i + 1,
                total: pageCount,
              })
            );
            const page = doc.getPage(i);
            const svgContent = page.toSvg();
            zip.file(`page_${i + 1}.svg`, svgContent);
          }
          showLoader(pdfExportText('creatingZip'));
          const zipBlob = await zip.generateAsync({ type: 'blob' });
          downloadFile(zipBlob, `${baseName}_svg.zip`);
          showAlert(
            pdfExportText('conversionCompleteTitle'),
            pdfExportText('pagesConverted', {
              count: pageCount,
              format: 'SVG',
            }),
            'success',
            () => resetState()
          );
        }
      } finally {
        doc.close();
      }
    } else {
      const zip = new JSZip();
      const usedNames = new Set<string>();
      let totalPages = 0;

      for (let f = 0; f < files.length; f++) {
        const file = files[f];
        showLoader(
          pdfExportText('processingFile', {
            current: f + 1,
            total: files.length,
          })
        );
        const doc = await pymupdf.open(file);
        try {
          const pageCount = doc.pageCount;
          const baseName = file.name.replace(/\.[^/.]+$/, '');

          for (let i = 0; i < pageCount; i++) {
            showLoader(
              pdfExportText('processingFilePage', {
                fileCurrent: f + 1,
                fileTotal: files.length,
                pageCurrent: i + 1,
                pageTotal: pageCount,
              })
            );
            const page = doc.getPage(i);
            const svgContent = page.toSvg();
            const fileName =
              pageCount === 1
                ? `${baseName}.svg`
                : `${baseName}_page_${i + 1}.svg`;
            zip.file(deduplicateFileName(fileName, usedNames), svgContent);
            totalPages++;
          }
        } finally {
          doc.close();
        }
      }

      showLoader(pdfExportText('creatingZip'));
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      downloadFile(zipBlob, 'pdf_to_svg.zip');
      showAlert(
        pdfExportText('conversionCompleteTitle'),
        pdfExportText('filesPagesConverted', {
          files: files.length,
          pages: totalPages,
          format: 'SVG',
        }),
        'success',
        () => resetState()
      );
    }
  } catch (e) {
    console.error(e);
    const message = e instanceof Error ? e.message : String(e);
    showAlert(
      pdfExportText('conversionErrorTitle'),
      pdfExportText('conversionFailed', { format: 'SVG', message })
    );
  } finally {
    hideLoader();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  const dropZone = document.getElementById('drop-zone');
  const processBtn = document.getElementById('process-btn');
  const backBtn = document.getElementById('back-to-tools');
  const addMoreBtn = document.getElementById('add-more-btn');
  const clearFilesBtn = document.getElementById('clear-files-btn');

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      goToLocalizedTools();
    });
  }

  const handleFileSelect = (newFiles: FileList | null, replace = false) => {
    if (!newFiles || newFiles.length === 0) return;
    const { validFiles, rejectedCount } = filterPdfFiles(newFiles);

    if (validFiles.length === 0) {
      showAlert(
        pdfExportText('invalidFilesTitle'),
        pdfExportText('invalidFiles')
      );
      return;
    }

    if (rejectedCount > 0) {
      showAlert(
        pdfExportText('invalidFilesTitle'),
        pdfExportText('invalidFiles')
      );
    }

    if (replace) {
      files = validFiles;
    } else {
      files = [...files, ...validFiles];
    }
    updateUI();
  };

  if (fileInput && dropZone) {
    fileInput.addEventListener('change', (e) => {
      handleFileSelect(
        (e.target as HTMLInputElement).files,
        files.length === 0
      );
    });

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('bg-gray-700');
    });

    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dropZone.classList.remove('bg-gray-700');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('bg-gray-700');
      handleFileSelect(e.dataTransfer?.files ?? null, files.length === 0);
    });

    fileInput.addEventListener('click', () => {
      fileInput.value = '';
    });
  }

  if (addMoreBtn)
    addMoreBtn.addEventListener('click', () => fileInput?.click());
  if (clearFilesBtn) clearFilesBtn.addEventListener('click', resetState);
  if (processBtn) processBtn.addEventListener('click', convert);
});
