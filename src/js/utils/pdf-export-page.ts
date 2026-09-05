import { t } from '../i18n/i18n.js';

export type PdfExportMessageKey =
  | 'addMoreFiles'
  | 'clearAll'
  | 'conversionCompleteTitle'
  | 'conversionErrorTitle'
  | 'conversionFailed'
  | 'convertToCsv'
  | 'convertToDocx'
  | 'convertToExcel'
  | 'convertToGreyscale'
  | 'convertToMarkdown'
  | 'convertToSvg'
  | 'converting'
  | 'convertingFile'
  | 'convertingPage'
  | 'convertingProgress'
  | 'creatingExcel'
  | 'creatingZip'
  | 'downloadAllZip'
  | 'downloadImage'
  | 'extractForAi'
  | 'extractImagesButton'
  | 'extracting'
  | 'extractingFile'
  | 'extractingImages'
  | 'extractingProgress'
  | 'extractingTables'
  | 'extractingText'
  | 'extractingTextFile'
  | 'extractingTextMultiple'
  | 'extractingTextProgress'
  | 'extractionCompleteTitle'
  | 'extractionErrorTitle'
  | 'extractionFailed'
  | 'extractionPartialTitle'
  | 'extractedImagesTitle'
  | 'filesPagesConverted'
  | 'greyscaleFormat'
  | 'imagesFound'
  | 'includeImages'
  | 'invalidFile'
  | 'invalidFileTitle'
  | 'invalidFiles'
  | 'invalidFilesTitle'
  | 'loadingConverter'
  | 'loadingEngine'
  | 'loadingProcessor'
  | 'multipleAiComplete'
  | 'multipleConverted'
  | 'noFile'
  | 'noFileTitle'
  | 'noFiles'
  | 'noFilesTitle'
  | 'noImages'
  | 'noImagesTitle'
  | 'noTables'
  | 'noTablesTitle'
  | 'pageCountUnavailable'
  | 'pagesConverted'
  | 'partialAiComplete'
  | 'processingFile'
  | 'processingFilePage'
  | 'removeFile'
  | 'scanningPage'
  | 'singleAiComplete'
  | 'singleConverted'
  | 'tablesExtracted'
  | 'textExtracted'
  | 'textFilesExtracted';

export function pdfExportText(
  key: PdfExportMessageKey,
  options?: Record<string, unknown>
): string {
  return t(`tools:pdfExport.${key}`, options);
}

export function filterPdfFiles(input: FileList | readonly File[] | null): {
  validFiles: File[];
  rejectedCount: number;
} {
  const files = input ? Array.from(input) : [];
  const validFiles = files.filter(
    (file) =>
      file.type === 'application/pdf' ||
      file.name.toLowerCase().endsWith('.pdf')
  );

  return {
    validFiles,
    rejectedCount: files.length - validFiles.length,
  };
}

export function pdfFileMeta(
  formattedSize: string,
  pageCount?: number | null
): string {
  if (pageCount === null) {
    return `${formattedSize} \u2022 ${pdfExportText('pageCountUnavailable')}`;
  }

  const pageLabel =
    pageCount === undefined
      ? t('common.loadingPageCount')
      : `${pageCount} ${pageCount === 1 ? t('common.page') : t('common.pages')}`;

  return `${formattedSize} \u2022 ${pageLabel}`;
}
