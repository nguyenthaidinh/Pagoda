import { showLoader, hideLoader, showAlert } from '../ui.js';
import {
  downloadFile,
  readFileAsArrayBuffer,
  formatBytes,
  getPDFDocument,
} from '../utils/helpers.js';
import { state } from '../state.js';
import { createIcons, icons } from 'lucide';
import { loadPyMuPDF } from '../utils/pymupdf-loader.js';
import type { PyMuPDFInstance } from '@/types';
import { batchDecryptIfNeeded } from '../utils/password-prompt.js';
import { deduplicateFileName } from '../utils/deduplicate-filename.js';
import {
  filterPdfFiles,
  pdfExportText,
  pdfFileMeta,
} from '../utils/pdf-export-page.js';
import { goToLocalizedTools } from '../utils/localized-navigation.js';

document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  const dropZone = document.getElementById('drop-zone');
  const processBtn = document.getElementById('process-btn');
  const fileDisplayArea = document.getElementById('file-display-area');
  const extractOptions = document.getElementById('extract-options');
  const fileControls = document.getElementById('file-controls');
  const addMoreBtn = document.getElementById('add-more-btn');
  const clearFilesBtn = document.getElementById('clear-files-btn');
  const backBtn = document.getElementById('back-to-tools');

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      goToLocalizedTools();
    });
  }

  const updateUI = async () => {
    if (!fileDisplayArea || !extractOptions || !processBtn || !fileControls)
      return;

    if (state.files.length > 0) {
      fileDisplayArea.innerHTML = '';

      for (let index = 0; index < state.files.length; index++) {
        const file = state.files[index];
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
        metaSpan.textContent = pdfFileMeta(formatBytes(file.size));

        infoContainer.append(nameSpan, metaSpan);

        const removeBtn = document.createElement('button');
        removeBtn.className =
          'ml-4 text-red-400 hover:text-red-300 flex-shrink-0';
        removeBtn.innerHTML = '<i data-lucide="trash-2" class="w-4 h-4"></i>';
        removeBtn.title = pdfExportText('removeFile');
        removeBtn.onclick = () => {
          state.files = state.files.filter((_, i) => i !== index);
          updateUI();
        };

        fileDiv.append(infoContainer, removeBtn);
        fileDisplayArea.appendChild(fileDiv);

        try {
          const arrayBuffer = await readFileAsArrayBuffer(file);
          const pdfDoc = await getPDFDocument({ data: arrayBuffer }).promise;
          metaSpan.textContent = pdfFileMeta(
            formatBytes(file.size),
            pdfDoc.numPages
          );
        } catch (error) {
          console.error('Error loading PDF:', error);
          metaSpan.textContent = pdfFileMeta(formatBytes(file.size), null);
        }
      }

      createIcons({ icons });
      fileControls.classList.remove('hidden');
      extractOptions.classList.remove('hidden');
      (processBtn as HTMLButtonElement).disabled = false;
    } else {
      fileDisplayArea.innerHTML = '';
      fileControls.classList.add('hidden');
      extractOptions.classList.add('hidden');
      (processBtn as HTMLButtonElement).disabled = true;
    }
  };

  const resetState = () => {
    state.files = [];
    state.pdfDoc = null;
    updateUI();
  };

  const extractForAI = async () => {
    try {
      if (state.files.length === 0) {
        showAlert(pdfExportText('noFilesTitle'), pdfExportText('noFiles'));
        return;
      }

      showLoader(pdfExportText('loadingEngine'));
      const pymupdf = await loadPyMuPDF();

      hideLoader();
      state.files = await batchDecryptIfNeeded(state.files);
      showLoader(pdfExportText('extracting'));

      const total = state.files.length;
      let completed = 0;
      let failed = 0;

      if (total === 1) {
        const file = state.files[0];
        showLoader(pdfExportText('extractingFile', { file: file.name }));

        const llamaDocs = await (pymupdf as PyMuPDFInstance).pdfToLlamaIndex(
          file
        );
        const outName = file.name.replace(/\.pdf$/i, '') + '_llm.json';
        const jsonContent = JSON.stringify(llamaDocs, null, 2);
        downloadFile(
          new Blob([jsonContent], { type: 'application/json' }),
          outName
        );

        hideLoader();
        showAlert(
          pdfExportText('extractionCompleteTitle'),
          pdfExportText('singleAiComplete'),
          'success',
          () => resetState()
        );
      } else {
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();
        const usedNames = new Set<string>();

        for (let fi = 0; fi < state.files.length; fi++) {
          try {
            const file = state.files[fi];
            showLoader(
              pdfExportText('extractingProgress', {
                file: file.name,
                current: fi + 1,
                total,
              })
            );

            const llamaDocs = await (
              pymupdf as PyMuPDFInstance
            ).pdfToLlamaIndex(file);
            const outName = file.name.replace(/\.pdf$/i, '') + '_llm.json';
            const jsonContent = JSON.stringify(llamaDocs, null, 2);
            const zipEntryName = deduplicateFileName(outName, usedNames);
            zip.file(zipEntryName, jsonContent);

            completed++;
          } catch (error) {
            console.error(`Failed to extract ${state.files[fi].name}:`, error);
            failed++;
          }
        }

        showLoader(pdfExportText('creatingZip'));
        const zipBlob = await zip.generateAsync({ type: 'blob' });

        downloadFile(zipBlob, 'pdf-for-ai.zip');

        hideLoader();

        if (failed === 0) {
          showAlert(
            pdfExportText('extractionCompleteTitle'),
            pdfExportText('multipleAiComplete', { count: completed }),
            'success',
            () => resetState()
          );
        } else {
          showAlert(
            pdfExportText('extractionPartialTitle'),
            pdfExportText('partialAiComplete', { completed, failed }),
            'warning',
            () => resetState()
          );
        }
      }
    } catch (e: unknown) {
      hideLoader();
      showAlert(
        pdfExportText('extractionErrorTitle'),
        pdfExportText('extractionFailed', {
          message: e instanceof Error ? e.message : String(e),
        })
      );
    }
  };

  const handleFileSelect = (files: FileList | null) => {
    if (files && files.length > 0) {
      const { validFiles: pdfFiles, rejectedCount } = filterPdfFiles(files);
      if (pdfFiles.length > 0) {
        state.files = [...state.files, ...pdfFiles];
        updateUI();
      }
      if (rejectedCount > 0) {
        showAlert(
          pdfExportText('invalidFilesTitle'),
          pdfExportText('invalidFiles')
        );
      }
    }
  };

  if (fileInput && dropZone) {
    fileInput.addEventListener('change', (e) => {
      handleFileSelect((e.target as HTMLInputElement).files);
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
      handleFileSelect(e.dataTransfer?.files ?? null);
    });

    fileInput.addEventListener('click', () => {
      fileInput.value = '';
    });
  }

  if (addMoreBtn) {
    addMoreBtn.addEventListener('click', () => {
      fileInput.click();
    });
  }

  if (clearFilesBtn) {
    clearFilesBtn.addEventListener('click', resetState);
  }

  if (processBtn) {
    processBtn.addEventListener('click', extractForAI);
  }
});
