import { t } from '../i18n/i18n.js';

export function securityText(
  key: string,
  options?: Record<string, unknown>
): string {
  return t(`tools:securityPdf.${key}`, options);
}

export function isPdfFile(file: File): boolean {
  const hasPdfExtension = /\.pdf$/i.test(file.name);
  const hasDifferentExtension = /\.[^./\\]+$/.test(file.name);

  return (
    hasPdfExtension ||
    (file.type === 'application/pdf' && !hasDifferentExtension)
  );
}

export function filterPdfFiles(
  input: FileList | readonly File[] | null
): File[] {
  return input ? Array.from(input).filter(isPdfFile) : [];
}

export function pdfOutputName(fileName: string, suffix: string): string {
  return /\.pdf$/i.test(fileName)
    ? fileName.replace(/\.pdf$/i, `_${suffix}.pdf`)
    : `${fileName}_${suffix}.pdf`;
}
