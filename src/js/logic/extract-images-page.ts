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
import {
  filterPdfFiles,
  pdfExportText,
  pdfFileMeta,
} from '../utils/pdf-export-page.js';
import { goToLocalizedTools } from '../utils/localized-navigation.js';

interface ExtractedImage {
  data: Uint8Array;
  name: string;
  ext: string;
}

let extractedImages: ExtractedImage[] = [];
let previewUrls: string[] = [];

function clearPreviewUrls() {
  previewUrls.forEach((url) => URL.revokeObjectURL(url));
  previewUrls = [];
}

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
  const imagesContainer = document.getElementById('images-container');
  const imagesGrid = document.getElementById('images-grid');
  const downloadAllBtn = document.getElementById('download-all-btn');

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      goToLocalizedTools();
    });
  }

  const updateUI = async () => {
    if (!fileDisplayArea || !extractOptions || !processBtn || !fileControls)
      return;

    // Clear extracted images when files change
    clearPreviewUrls();
    extractedImages = [];
    if (imagesContainer) imagesContainer.classList.add('hidden');
    if (imagesGrid) imagesGrid.innerHTML = '';

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
    clearPreviewUrls();
    extractedImages = [];
    if (imagesContainer) imagesContainer.classList.add('hidden');
    if (imagesGrid) imagesGrid.innerHTML = '';
    updateUI();
  };

  const displayImages = () => {
    if (!imagesGrid || !imagesContainer) return;
    clearPreviewUrls();
    imagesGrid.innerHTML = '';

    extractedImages.forEach((img) => {
      const imageType = img.ext.toLowerCase() === 'jpg' ? 'jpeg' : img.ext;
      const blob = new Blob([new Uint8Array(img.data)], {
        type: `image/${imageType}`,
      });
      const url = URL.createObjectURL(blob);
      previewUrls.push(url);

      const card = document.createElement('div');
      card.className = 'bg-gray-700 rounded-lg overflow-hidden';

      const imgEl = document.createElement('img');
      imgEl.src = url;
      imgEl.className = 'w-full h-32 object-cover';

      const info = document.createElement('div');
      info.className = 'p-2 flex justify-between items-center';

      const name = document.createElement('span');
      name.className = 'text-xs text-gray-300 truncate';
      name.textContent = img.name;

      const downloadBtn = document.createElement('button');
      downloadBtn.className = 'text-indigo-400 hover:text-indigo-300';
      downloadBtn.innerHTML = '<i data-lucide="download" class="w-4 h-4"></i>';
      downloadBtn.title = pdfExportText('downloadImage');
      downloadBtn.onclick = () => {
        downloadFile(blob, img.name);
      };

      info.append(name, downloadBtn);
      card.append(imgEl, info);
      imagesGrid.appendChild(card);
    });

    createIcons({ icons });
    imagesContainer.classList.remove('hidden');
  };

  const extract = async () => {
    try {
      if (state.files.length === 0) {
        showAlert(pdfExportText('noFilesTitle'), pdfExportText('noFiles'));
        return;
      }

      const decryptedFiles = await batchDecryptIfNeeded(state.files);
      showLoader(pdfExportText('loadingProcessor'));
      state.files = decryptedFiles;
      const pymupdf = await loadPyMuPDF();

      extractedImages = [];
      let imgCounter = 0;

      for (let i = 0; i < state.files.length; i++) {
        const file = state.files[i];
        showLoader(pdfExportText('extractingImages', { file: file.name }));

        const doc = await pymupdf.open(file);
        try {
          const pageCount = doc.pageCount;

          for (let pageIdx = 0; pageIdx < pageCount; pageIdx++) {
            const page = doc.getPage(pageIdx);
            const images = page.getImages();

            for (const imgInfo of images) {
              try {
                const imgData = page.extractImage(imgInfo.xref);
                if (imgData && imgData.data) {
                  imgCounter++;
                  extractedImages.push({
                    data: imgData.data,
                    name: `image_${imgCounter}.${imgData.ext || 'png'}`,
                    ext: imgData.ext || 'png',
                  });
                }
              } catch (e) {
                console.warn('Failed to extract image:', e);
              }
            }
          }
        } finally {
          doc.close();
        }
      }

      hideLoader();

      if (extractedImages.length === 0) {
        showAlert(pdfExportText('noImagesTitle'), pdfExportText('noImages'));
      } else {
        displayImages();
        showAlert(
          pdfExportText('extractionCompleteTitle'),
          pdfExportText('imagesFound', {
            images: extractedImages.length,
            files: state.files.length,
          }),
          'success'
        );
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

  const downloadAll = async () => {
    if (extractedImages.length === 0) return;

    showLoader(pdfExportText('creatingZip'));
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    extractedImages.forEach((img) => {
      zip.file(img.name, img.data);
    });

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    downloadFile(zipBlob, 'extracted-images.zip');
    hideLoader();
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
    processBtn.addEventListener('click', extract);
  }

  if (downloadAllBtn) {
    downloadAllBtn.addEventListener('click', downloadAll);
  }
});
