import { showLoader, hideLoader, showAlert } from '../ui.js';
import {
  downloadFile,
  readFileAsArrayBuffer,
  formatBytes,
  getPDFDocument,
} from '../utils/helpers.js';
import { loadPdfWithPasswordPrompt } from '../utils/password-prompt.js';
import { state } from '../state.js';
import { compressRenderedPdf } from '../utils/compress.js';
import { createIcons, icons } from 'lucide';
import { showWasmRequiredDialog } from '../utils/wasm-provider.js';
import { loadPyMuPDF, isPyMuPDFAvailable } from '../utils/pymupdf-loader.js';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { t } from '../i18n/i18n';
import '../utils/setup-pdf-worker.js';

const CONDENSE_PRESETS = {
  light: {
    images: { quality: 90, dpiTarget: 150, dpiThreshold: 200 },
    scrub: { metadata: false, thumbnails: true },
    subsetFonts: true,
  },
  balanced: {
    images: { quality: 75, dpiTarget: 96, dpiThreshold: 150 },
    scrub: { metadata: true, thumbnails: true },
    subsetFonts: true,
  },
  aggressive: {
    images: { quality: 50, dpiTarget: 72, dpiThreshold: 100 },
    scrub: { metadata: true, thumbnails: true, xmlMetadata: true },
    subsetFonts: true,
  },
  extreme: {
    images: { quality: 30, dpiTarget: 60, dpiThreshold: 96 },
    scrub: { metadata: true, thumbnails: true, xmlMetadata: true },
    subsetFonts: true,
  },
};

async function performCondenseCompression(
  fileBlob: Blob,
  level: string,
  customSettings?: {
    imageQuality?: number;
    dpiTarget?: number;
    dpiThreshold?: number;
    removeMetadata?: boolean;
    subsetFonts?: boolean;
    convertToGrayscale?: boolean;
    removeThumbnails?: boolean;
  }
) {
  // Load PyMuPDF dynamically from user-provided URL
  const pymupdf = await loadPyMuPDF();

  const preset =
    CONDENSE_PRESETS[level as keyof typeof CONDENSE_PRESETS] ||
    CONDENSE_PRESETS.balanced;

  const dpiTarget = customSettings?.dpiTarget ?? preset.images.dpiTarget;
  const userThreshold =
    customSettings?.dpiThreshold ?? preset.images.dpiThreshold;
  const dpiThreshold = Math.max(userThreshold, dpiTarget + 10);

  const options = {
    images: {
      enabled: true,
      quality: customSettings?.imageQuality ?? preset.images.quality,
      dpiTarget,
      dpiThreshold,
      convertToGray: customSettings?.convertToGrayscale ?? false,
    },
    scrub: {
      metadata: customSettings?.removeMetadata ?? preset.scrub.metadata,
      thumbnails: customSettings?.removeThumbnails ?? preset.scrub.thumbnails,
      xmlMetadata:
        'xmlMetadata' in preset.scrub
          ? (preset.scrub as { xmlMetadata: boolean }).xmlMetadata
          : false,
    },
    subsetFonts: customSettings?.subsetFonts ?? preset.subsetFonts,
    save: {
      garbage: 4 as const,
      deflate: true,
      clean: true,
      useObjstms: true,
    },
  };

  try {
    const result = await pymupdf.compressPdf(fileBlob, options);
    return result;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (
      errorMessage.includes('PatternType') ||
      errorMessage.includes('pattern')
    ) {
      console.warn(
        '[CompressPDF] Pattern error detected, retrying without image rewriting:',
        errorMessage
      );

      const fallbackOptions = {
        ...options,
        images: {
          ...options.images,
          enabled: false,
        },
      };

      const result = await pymupdf.compressPdf(fileBlob, fallbackOptions);
      return { ...result, usedFallback: true };
    }

    throw new Error(`PDF compression failed: ${errorMessage}`, {
      cause: error,
    });
  }
}

async function performPhotonCompression(
  arrayBuffer: ArrayBuffer,
  level: string,
  file?: File
) {
  let pdfJsDoc: PDFDocumentProxy;
  if (file) {
    hideLoader();
    const result = await loadPdfWithPasswordPrompt(file);
    if (!result) return null;
    showLoader(t('tools:compressPdf.runningPhoton'));
    pdfJsDoc = result.pdf;
  } else {
    pdfJsDoc = await getPDFDocument({ data: arrayBuffer }).promise;
  }
  return compressRenderedPdf(pdfJsDoc, level);
}

document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  const dropZone = document.getElementById('drop-zone');
  const compressOptions = document.getElementById('compress-options');
  const addMoreBtn = document.getElementById('add-more-btn');
  const clearFilesBtn = document.getElementById('clear-files-btn');
  const processBtn = document.getElementById('process-btn');
  const backBtn = document.getElementById('back-to-tools');
  const algorithmSelect = document.getElementById(
    'compression-algorithm'
  ) as HTMLSelectElement;
  const condenseInfo = document.getElementById('condense-info');
  const photonInfo = document.getElementById('photon-info');
  const toggleCustomSettings = document.getElementById(
    'toggle-custom-settings'
  );
  const customSettingsPanel = document.getElementById('custom-settings-panel');
  const customSettingsChevron = document.getElementById(
    'custom-settings-chevron'
  );

  let useCustomSettings = false;

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      window.location.href = import.meta.env.BASE_URL;
    });
  }

  // Toggle algorithm info
  if (algorithmSelect && condenseInfo && photonInfo) {
    algorithmSelect.addEventListener('change', () => {
      if (algorithmSelect.value === 'condense') {
        condenseInfo.classList.remove('hidden');
        photonInfo.classList.add('hidden');
      } else {
        condenseInfo.classList.add('hidden');
        photonInfo.classList.remove('hidden');
      }
    });
  }

  // Toggle custom settings panel
  if (toggleCustomSettings && customSettingsPanel && customSettingsChevron) {
    toggleCustomSettings.addEventListener('click', () => {
      customSettingsPanel.classList.toggle('hidden');
      customSettingsChevron.style.transform =
        customSettingsPanel.classList.contains('hidden')
          ? 'rotate(0deg)'
          : 'rotate(180deg)';
      // Mark that user wants to use custom settings
      if (!customSettingsPanel.classList.contains('hidden')) {
        useCustomSettings = true;
      }
    });
  }

  const updateUI = async () => {
    if (!compressOptions) return;

    if (state.files.length > 0) {
      const fileDisplayArea = document.getElementById('file-display-area');
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
          removeBtn.title = t('common.remove');
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
      compressOptions.classList.remove('hidden');
    } else {
      compressOptions.classList.add('hidden');
      // Clear file display area
      const fileDisplayArea = document.getElementById('file-display-area');
      if (fileDisplayArea) fileDisplayArea.innerHTML = '';
    }
  };

  const resetState = () => {
    state.files = [];
    state.pdfDoc = null;

    const compressionLevel = document.getElementById(
      'compression-level'
    ) as HTMLSelectElement;
    if (compressionLevel) compressionLevel.value = 'balanced';

    if (algorithmSelect) algorithmSelect.value = 'condense';

    useCustomSettings = false;
    if (customSettingsPanel) customSettingsPanel.classList.add('hidden');
    if (customSettingsChevron)
      customSettingsChevron.style.transform = 'rotate(0deg)';

    const imageQuality = document.getElementById(
      'image-quality'
    ) as HTMLInputElement;
    const dpiTarget = document.getElementById('dpi-target') as HTMLInputElement;
    const dpiThreshold = document.getElementById(
      'dpi-threshold'
    ) as HTMLInputElement;
    const removeMetadata = document.getElementById(
      'remove-metadata'
    ) as HTMLInputElement;
    const subsetFonts = document.getElementById(
      'subset-fonts'
    ) as HTMLInputElement;
    const convertToGrayscale = document.getElementById(
      'convert-to-grayscale'
    ) as HTMLInputElement;
    const removeThumbnails = document.getElementById(
      'remove-thumbnails'
    ) as HTMLInputElement;

    if (imageQuality) imageQuality.value = '75';
    if (dpiTarget) dpiTarget.value = '96';
    if (dpiThreshold) dpiThreshold.value = '150';
    if (removeMetadata) removeMetadata.checked = true;
    if (subsetFonts) subsetFonts.checked = true;
    if (convertToGrayscale) convertToGrayscale.checked = false;
    if (removeThumbnails) removeThumbnails.checked = true;

    if (condenseInfo) condenseInfo.classList.remove('hidden');
    if (photonInfo) photonInfo.classList.add('hidden');

    updateUI();
  };

  const compress = async () => {
    const level = (
      document.getElementById('compression-level') as HTMLSelectElement
    ).value;
    const convertToGrayscale =
      (document.getElementById('convert-to-grayscale') as HTMLInputElement)
        ?.checked ?? false;

    let customSettings:
      | {
          imageQuality?: number;
          dpiTarget?: number;
          dpiThreshold?: number;
          removeMetadata?: boolean;
          subsetFonts?: boolean;
          convertToGrayscale?: boolean;
          removeThumbnails?: boolean;
        }
      | undefined;

    if (useCustomSettings) {
      const imageQuality =
        parseInt(
          (document.getElementById('image-quality') as HTMLInputElement)?.value
        ) || 75;
      const dpiTarget =
        parseInt(
          (document.getElementById('dpi-target') as HTMLInputElement)?.value
        ) || 96;
      const dpiThreshold =
        parseInt(
          (document.getElementById('dpi-threshold') as HTMLInputElement)?.value
        ) || 150;
      const removeMetadata =
        (document.getElementById('remove-metadata') as HTMLInputElement)
          ?.checked ?? true;
      const subsetFonts =
        (document.getElementById('subset-fonts') as HTMLInputElement)
          ?.checked ?? true;
      const removeThumbnails =
        (document.getElementById('remove-thumbnails') as HTMLInputElement)
          ?.checked ?? true;

      customSettings = {
        imageQuality,
        dpiTarget,
        dpiThreshold,
        removeMetadata,
        subsetFonts,
        convertToGrayscale,
        removeThumbnails,
      };
    } else {
      customSettings = convertToGrayscale ? { convertToGrayscale } : undefined;
    }

    try {
      if (state.files.length === 0) {
        showAlert(
          t('tools:compressPdf.noFilesTitle'),
          t('tools:compressPdf.noFiles')
        );
        hideLoader();
        return;
      }

      // Check WASM availability for Condense mode
      const algorithm = (
        document.getElementById('compression-algorithm') as HTMLSelectElement
      ).value;
      if (algorithm === 'condense' && !isPyMuPDFAvailable()) {
        showWasmRequiredDialog('pymupdf');
        return;
      }

      if (state.files.length === 1) {
        const originalFile = state.files[0];

        let resultBlob: Blob;
        let resultSize: number;
        let usedMethod: string;

        if (algorithm === 'condense') {
          showLoader(t('tools:compressPdf.runningCondense'));
          const result = await performCondenseCompression(
            originalFile,
            level,
            customSettings
          );
          resultBlob = result.blob;
          resultSize = result.compressedSize;
          usedMethod = 'Condense';

          // Check if fallback was used
          if ((result as { usedFallback?: boolean }).usedFallback) {
            usedMethod = t('tools:compressPdf.fallbackMethod', {
              method: usedMethod,
            });
          }
        } else {
          showLoader(t('tools:compressPdf.runningPhoton'));
          const arrayBuffer = (await readFileAsArrayBuffer(
            originalFile
          )) as ArrayBuffer;
          const resultBytes = await performPhotonCompression(
            arrayBuffer,
            level,
            originalFile
          );
          if (!resultBytes) return;
          const buffer = resultBytes.buffer.slice(
            resultBytes.byteOffset,
            resultBytes.byteOffset + resultBytes.byteLength
          ) as ArrayBuffer;
          resultBlob = new Blob([buffer], { type: 'application/pdf' });
          resultSize = resultBytes.length;
          usedMethod = 'Photon';
        }

        const originalSize = formatBytes(originalFile.size);
        const compressedSize = formatBytes(resultSize);
        const savings = originalFile.size - resultSize;
        const savingsPercent =
          savings > 0 ? ((savings / originalFile.size) * 100).toFixed(1) : 0;

        downloadFile(resultBlob, originalFile.name);

        hideLoader();

        if (savings > 0) {
          showAlert(
            t('tools:compressPdf.completeTitle'),
            t('tools:compressPdf.singleSavings', {
              method: usedMethod,
              original: originalSize,
              compressed: compressedSize,
              percent: savingsPercent,
            }),
            'success',
            () => resetState()
          );
        } else {
          showAlert(
            t('tools:compressPdf.finishedTitle'),
            t('tools:compressPdf.singleNoSavings', {
              method: usedMethod,
              original: originalSize,
              compressed: compressedSize,
            }),
            'warning',
            () => resetState()
          );
        }
      } else {
        showLoader(t('tools:compressPdf.compressingMultiple'));
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();
        let totalOriginalSize = 0;
        let totalCompressedSize = 0;

        for (let i = 0; i < state.files.length; i++) {
          const file = state.files[i];
          showLoader(
            t('tools:compressPdf.compressingFile', {
              current: i + 1,
              total: state.files.length,
              name: file.name,
            })
          );
          totalOriginalSize += file.size;

          let resultBytes: Uint8Array;
          if (algorithm === 'condense') {
            const result = await performCondenseCompression(
              file,
              level,
              customSettings
            );
            resultBytes = new Uint8Array(await result.blob.arrayBuffer());
          } else {
            const arrayBuffer = (await readFileAsArrayBuffer(
              file
            )) as ArrayBuffer;
            const photonResult = await performPhotonCompression(
              arrayBuffer,
              level,
              file
            );
            if (!photonResult) return;
            resultBytes = photonResult;
          }

          totalCompressedSize += resultBytes.length;
          zip.file(file.name, resultBytes);
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const totalSavings = totalOriginalSize - totalCompressedSize;
        const totalSavingsPercent =
          totalSavings > 0
            ? ((totalSavings / totalOriginalSize) * 100).toFixed(1)
            : 0;

        downloadFile(zipBlob, 'compressed-pdfs.zip');

        hideLoader();

        if (totalSavings > 0) {
          showAlert(
            t('tools:compressPdf.completeTitle'),
            t('tools:compressPdf.multipleSavings', {
              count: state.files.length,
              original: formatBytes(totalOriginalSize),
              compressed: formatBytes(totalCompressedSize),
              percent: totalSavingsPercent,
            }),
            'success',
            () => resetState()
          );
        } else {
          showAlert(
            t('tools:compressPdf.finishedTitle'),
            t('tools:compressPdf.multipleNoSavings', {
              count: state.files.length,
              size: formatBytes(totalCompressedSize),
            }),
            'info',
            () => resetState()
          );
        }
      }
    } catch (e: unknown) {
      hideLoader();
      console.error('[CompressPDF] Error:', e);
      showAlert(
        t('common.error'),
        t('tools:compressPdf.compressionError', {
          error: e instanceof Error ? e.message : String(e),
        })
      );
    }
  };

  const handleFileSelect = (files: FileList | null) => {
    if (files && files.length > 0) {
      const selectedFiles = Array.from(files);
      const validFiles = selectedFiles.filter(
        (file) =>
          file.type === 'application/pdf' ||
          file.name.toLowerCase().endsWith('.pdf')
      );
      if (validFiles.length !== selectedFiles.length) {
        showAlert(
          t('tools:compressPdf.invalidFilesTitle'),
          t('tools:compressPdf.invalidFiles')
        );
      }
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
        const pdfFiles = Array.from(files).filter(
          (f) => f.type === 'application/pdf'
        );
        if (pdfFiles.length > 0) {
          const dataTransfer = new DataTransfer();
          pdfFiles.forEach((f) => dataTransfer.items.add(f));
          handleFileSelect(dataTransfer.files);
        }
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
    processBtn.addEventListener('click', compress);
  }
});
