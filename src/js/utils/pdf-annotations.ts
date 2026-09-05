import { PDFDict, PDFDocument, PDFName } from 'pdf-lib';

export function removeNonWidgetAnnotations(pdfDoc: PDFDocument): number {
  let removedCount = 0;

  for (const page of pdfDoc.getPages()) {
    const annotations = page.node.Annots();
    if (!annotations) continue;

    for (let index = annotations.size() - 1; index >= 0; index--) {
      const annotation = annotations.lookupMaybe(index, PDFDict);
      const subtype = annotation?.lookupMaybe(PDFName.of('Subtype'), PDFName);

      if (subtype?.asString() !== '/Widget') {
        annotations.remove(index);
        removedCount++;
      }
    }

    if (annotations.size() === 0) {
      page.node.delete(PDFName.of('Annots'));
    }
  }

  return removedCount;
}
