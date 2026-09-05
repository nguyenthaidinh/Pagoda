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
  const convertOptions = document.getElementById('convert-options');
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
    if (!fileDisplayArea || !convertOptions || !processBtn || !fileControls)
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
          state.files = state.files.filter((_: File, i: number) => i !== index);
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
        } catch {
          metaSpan.textContent = pdfFileMeta(formatBytes(file.size), null);
        }
      }

      createIcons({ icons });
      fileControls.classList.remove('hidden');
      convertOptions.classList.remove('hidden');
      (processBtn as HTMLButtonElement).disabled = false;
    } else {
      fileDisplayArea.innerHTML = '';
      fileControls.classList.add('hidden');
      convertOptions.classList.add('hidden');
      (processBtn as HTMLButtonElement).disabled = true;
    }
  };

  const resetState = () => {
    state.files = [];
    state.pdfDoc = null;
    updateUI();
  };

  const convert = async () => {
    try {
      if (state.files.length === 0) {
        showAlert(pdfExportText('noFilesTitle'), pdfExportText('noFiles'));
        return;
      }

      showLoader(pdfExportText('loadingConverter'));
      const pymupdf = await loadPyMuPDF();

      hideLoader();
      state.files = await batchDecryptIfNeeded(state.files);
      showLoader(pdfExportText('converting', { format: 'DOCX' }));

      if (state.files.length === 1) {
        const file = state.files[0];
        showLoader(pdfExportText('convertingFile', { file: file.name }));

        const docxBlob = await pymupdf.pdfToDocx(file);
        const outName = file.name.replace(/\.pdf$/i, '') + '.docx';

        downloadFile(docxBlob, outName);
        hideLoader();

        showAlert(
          pdfExportText('conversionCompleteTitle'),
          pdfExportText('singleConverted', {
            file: file.name,
            format: 'DOCX',
          }),
          'success',
          () => resetState()
        );
      } else {
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();
        const usedNames = new Set<string>();

        for (let i = 0; i < state.files.length; i++) {
          const file = state.files[i];
          showLoader(
            pdfExportText('convertingProgress', {
              current: i + 1,
              total: state.files.length,
              file: file.name,
            })
          );

          const docxBlob = await pymupdf.pdfToDocx(file);
          const baseName = file.name.replace(/\.pdf$/i, '');
          const arrayBuffer = await docxBlob.arrayBuffer();
          const zipEntryName = deduplicateFileName(
            `${baseName}.docx`,
            usedNames
          );
          zip.file(zipEntryName, arrayBuffer);
        }

        showLoader(pdfExportText('creatingZip'));
        const zipBlob = await zip.generateAsync({ type: 'blob' });

        downloadFile(zipBlob, 'converted-documents.zip');
        hideLoader();

        showAlert(
          pdfExportText('conversionCompleteTitle'),
          pdfExportText('multipleConverted', {
            count: state.files.length,
            format: 'DOCX',
          }),
          'success',
          () => resetState()
        );
      }
    } catch (e: unknown) {
      hideLoader();
      showAlert(
        pdfExportText('conversionErrorTitle'),
        pdfExportText('conversionFailed', {
          format: 'DOCX',
          message: e instanceof Error ? e.message : String(e),
        })
      );
    }
  };

  const handleFileSelect = (files: FileList | null) => {
    if (files && files.length > 0) {
      const { validFiles: pdfFiles, rejectedCount } = filterPdfFiles(files);
      state.files = [...state.files, ...pdfFiles];
      updateUI();
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
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        handleFileSelect(files);
      }
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
    clearFilesBtn.addEventListener('click', () => {
      resetState();
    });
  }

  if (processBtn) {
    processBtn.addEventListener('click', convert);
  }
});
