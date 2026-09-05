import { t } from '../i18n/i18n';

export { goToLocalizedTools } from './localized-navigation.js';

export type ConversionMessageKey =
  | 'completeTitle'
  | 'converting'
  | 'convertingFile'
  | 'convertingProgress'
  | 'created'
  | 'creatingPdf'
  | 'creatingZip'
  | 'errorTitle'
  | 'failed'
  | 'failedWithReason'
  | 'invalidFiles'
  | 'invalidFilesTitle'
  | 'imageFiles'
  | 'loadingEngine'
  | 'loadingEngineProgress'
  | 'multipleComplete'
  | 'noFiles'
  | 'noFilesTitle'
  | 'noText'
  | 'noTextTitle'
  | 'preparing'
  | 'processing'
  | 'removeFile'
  | 'singleComplete'
  | 'textComplete';

export function conversionText(
  key: ConversionMessageKey,
  options?: Record<string, unknown>
): string {
  return t(`tools:conversion.${key}`, options);
}

export function filterFilesByExtensions(
  input: FileList | readonly File[] | null,
  extensions: readonly string[]
): { validFiles: File[]; rejectedCount: number } {
  const files = input ? Array.from(input) : [];
  const normalizedExtensions = extensions.map((extension) =>
    extension.toLowerCase().startsWith('.')
      ? extension.toLowerCase()
      : `.${extension.toLowerCase()}`
  );
  const validFiles = files.filter((file) => {
    const name = file.name.toLowerCase();
    return normalizedExtensions.some((extension) => name.endsWith(extension));
  });

  return {
    validFiles,
    rejectedCount: files.length - validFiles.length,
  };
}
