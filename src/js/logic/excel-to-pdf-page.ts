import { showLoader, hideLoader, showAlert } from '../ui.js';
import { downloadFile, formatBytes } from '../utils/helpers.js';
import { state } from '../state.js';
import { createIcons, icons } from 'lucide';
import {
  getLibreOfficeConverter,
  type LoadProgress,
} from '../utils/libreoffice-loader.js';
import { deduplicateFileName } from '../utils/deduplicate-filename.js';
import {
  conversionText,
  filterFilesByExtensions,
  goToLocalizedTools,
} from '../utils/conversion-page.js';

const EXTENSIONS = ['.xls', '.xlsx', '.ods', '.csv'] as const;
const FORMAT_LABEL = 'Excel/XLSX/XLS/ODS/CSV';

document.addEventListener('DOMContentLoaded', () => {
  state.files = [];

  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  const dropZone = document.getElementById('drop-zone');
  const convertOptions = document.getElementById('convert-options');
  const fileDisplayArea = document.getElementById('file-display-area');
  const fileControls = document.getElementById('file-controls');
  const addMoreBtn = document.getElementById('add-more-btn');
  const clearFilesBtn = document.getElementById('clear-files-btn');
  const backBtn = document.getElementById('back-to-tools');
  const processBtn = document.getElementById('process-btn');

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      goToLocalizedTools();
    });
  }

  const updateUI = async () => {
    if (!convertOptions) return;

    if (state.files.length > 0) {
      if (fileDisplayArea) {
        fileDisplayArea.innerHTML = '';

        for (let index = 0; index < state.files.length; index++) {
          const file = state.files[index];
          const fileDiv = document.createElement('div');
          fileDiv.className =
            'flex items-center justify-between bg-gray-700 p-3 rounded-lg text-sm';

          const infoContainer = document.createElement('div');
          infoContainer.className = 'flex flex-col overflow-hidden';

          const nameSpan = document.createElement('div');
          nameSpan.className =
            'truncate font-medium text-gray-200 text-sm mb-1';
          nameSpan.textContent = file.name;

          const metaSpan = document.createElement('div');
          metaSpan.className = 'text-xs text-gray-400';
          metaSpan.textContent = formatBytes(file.size);

          infoContainer.append(nameSpan, metaSpan);

          const removeBtn = document.createElement('button');
          removeBtn.className =
            'ml-4 text-red-400 hover:text-red-300 flex-shrink-0';
          removeBtn.title = conversionText('removeFile');
          removeBtn.innerHTML = '<i data-lucide="trash-2" class="w-4 h-4"></i>';
          removeBtn.onclick = () => {
            state.files = state.files.filter((_, i) => i !== index);
            updateUI();
          };

          fileDiv.append(infoContainer, removeBtn);
          fileDisplayArea.appendChild(fileDiv);
        }

        createIcons({ icons });
      }
      if (fileControls) fileControls.classList.remove('hidden');
      convertOptions.classList.remove('hidden');
    } else {
      if (fileDisplayArea) fileDisplayArea.innerHTML = '';
      if (fileControls) fileControls.classList.add('hidden');
      convertOptions.classList.add('hidden');
    }
  };

  const resetState = () => {
    state.files = [];
    state.pdfDoc = null;
    updateUI();
  };

  const convertToPdf = async () => {
    try {
      if (state.files.length === 0) {
        showAlert(
          conversionText('noFilesTitle'),
          conversionText('noFiles', { format: FORMAT_LABEL })
        );
        hideLoader();
        return;
      }

      const converter = getLibreOfficeConverter();

      // Initialize LibreOffice if not already done
      await converter.initialize((progress: LoadProgress) => {
        showLoader(
          conversionText('loadingEngineProgress', {
            percent: Math.round(progress.percent),
          }),
          progress.percent
        );
      });

      if (state.files.length === 1) {
        const originalFile = state.files[0];

        showLoader(conversionText('processing'));

        const pdfBlob = await converter.convertToPdf(originalFile);

        const fileName =
          originalFile.name.replace(/\.(xls|xlsx|ods|csv)$/i, '') + '.pdf';

        downloadFile(pdfBlob, fileName);

        hideLoader();

        showAlert(
          conversionText('completeTitle'),
          conversionText('singleComplete', { file: originalFile.name }),
          'success',
          () => resetState()
        );
      } else {
        showLoader(conversionText('processing'));
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();
        const usedNames = new Set<string>();

        for (let i = 0; i < state.files.length; i++) {
          const file = state.files[i];
          showLoader(
            conversionText('convertingProgress', {
              current: i + 1,
              total: state.files.length,
              file: file.name,
            })
          );

          const pdfBlob = await converter.convertToPdf(file);

          const baseName = file.name.replace(/\.(xls|xlsx|ods|csv)$/i, '');
          const pdfBuffer = await pdfBlob.arrayBuffer();
          zip.file(
            deduplicateFileName(`${baseName}.pdf`, usedNames),
            pdfBuffer
          );
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });

        downloadFile(zipBlob, 'excel-converted.zip');

        hideLoader();

        showAlert(
          conversionText('completeTitle'),
          conversionText('multipleComplete', {
            count: state.files.length,
            format: 'Excel',
          }),
          'success',
          () => resetState()
        );
      }
    } catch (e: unknown) {
      hideLoader();
      showAlert(
        conversionText('errorTitle'),
        conversionText('failedWithReason', {
          format: 'Excel',
          message: e instanceof Error ? e.message : String(e),
        })
      );
    }
  };

  const handleFileSelect = (files: FileList | readonly File[] | null) => {
    const { validFiles, rejectedCount } = filterFilesByExtensions(
      files,
      EXTENSIONS
    );
    if (rejectedCount > 0) {
      showAlert(
        conversionText('invalidFilesTitle'),
        conversionText('invalidFiles', { formats: FORMAT_LABEL })
      );
    }
    if (validFiles.length > 0) {
      state.files = [...state.files, ...validFiles];
      updateUI();
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

    // Clear value on click to allow re-selecting the same file
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
    processBtn.addEventListener('click', convertToPdf);
  }
});
