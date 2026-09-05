import {
  PDFDocument,
  PDFArray,
  rgb,
  pushGraphicsState,
  popGraphicsState,
  setFillingColor,
  rectangle,
  fill,
} from 'pdf-lib';

export function prependPageBackgrounds(
  doc: PDFDocument,
  color: { r: number; g: number; b: number }
): void {
  for (const page of doc.getPages()) {
    const { x, y, width, height } = page.getMediaBox();
    const stream = doc.context.contentStream([
      pushGraphicsState(),
      setFillingColor(rgb(color.r, color.g, color.b)),
      rectangle(x, y, width, height),
      fill(),
      popGraphicsState(),
    ]);
    // Keep the original page and document dictionaries (widgets, boxes, outlines).
    page.node.normalize();
    const contents = page.node.Contents();
    if (!contents) {
      page.node.addContentStream(doc.context.register(stream));
      continue;
    }
    if (!(contents instanceof PDFArray))
      throw new Error('Invalid page contents');
    contents.insert(0, doc.context.register(stream));
  }
}
