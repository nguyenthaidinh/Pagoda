import { createEngineModule } from '../editcore/engine-loader.js';
import {
  PDFDocument,
  PDFDict,
  PDFName,
  PDFRef,
  PDFRawStream,
  PDFArray,
  decodePDFRawStream,
} from 'pdf-lib';

// The bundled PDFium does not persist edits inside Form XObjects. Expose each
// form as a temporary page, then put its edited stream back without flattening it.
async function prepareTextColorDocument(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes);
  const pageCount = doc.getPageCount();
  const seen = new Set<PDFRawStream>();
  const forms: { ref: PDFRef; stream: PDFRawStream; resources: PDFDict }[] = [];
  const visit = (resources: PDFDict | undefined) => {
    const objects = resources?.lookupMaybe(PDFName.of('XObject'), PDFDict);
    if (!objects || !resources) return;
    for (const [name, value] of objects.entries()) {
      const stream = doc.context.lookup(value);
      if (
        !(stream instanceof PDFRawStream) ||
        stream.dict.get(PDFName.of('Subtype')) !== PDFName.of('Form') ||
        seen.has(stream)
      )
        continue;
      seen.add(stream);
      const ref =
        value instanceof PDFRef ? value : doc.context.register(stream);
      objects.set(name, ref);
      const formResources =
        stream.dict.lookupMaybe(PDFName.of('Resources'), PDFDict) ?? resources;
      forms.push({ ref, stream, resources: formResources });
      visit(formResources);
    }
  };
  for (const page of doc.getPages()) visit(page.node.Resources());
  if (!forms.length) return { bytes, pageCount, forms: 0 };
  for (const form of forms) {
    const page = doc.addPage();
    const box = form.stream.dict.lookup(PDFName.of('BBox'), PDFArray);
    page.node.set(PDFName.of('MediaBox'), box);
    page.node.set(PDFName.of('Contents'), form.ref);
    page.node.set(PDFName.of('Resources'), form.resources);
    page.node.set(PDFName.of('PagodaTextColorTarget'), form.ref);
  }
  return {
    bytes: new Uint8Array(await doc.save()),
    pageCount,
    forms: forms.length,
  };
}

async function restoreTextColorForms(
  bytes: Uint8Array,
  pageCount: number
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes);
  for (let index = doc.getPageCount() - 1; index >= pageCount; index--) {
    const page = doc.getPage(index);
    const target = page.node.get(PDFName.of('PagodaTextColorTarget'));
    if (!(target instanceof PDFRef))
      throw new Error('Missing form output target');
    const original = doc.context.lookup(target);
    if (!(original instanceof PDFRawStream))
      throw new Error('Invalid form stream');
    const contents = page.node.Contents();
    const streams =
      contents instanceof PDFArray ? contents.asArray() : [contents];
    const chunks = streams.map((ref) => {
      const stream = doc.context.lookup(ref);
      if (!(stream instanceof PDFRawStream))
        throw new Error('Invalid generated content stream');
      return decodePDFRawStream(stream).decode();
    });
    const data = new Uint8Array(
      chunks.reduce((size, chunk) => size + chunk.length + 1, 0)
    );
    let offset = 0;
    for (const chunk of chunks) {
      data.set(chunk, offset);
      offset += chunk.length;
      data[offset++] = 10;
    }
    const replacement = doc.context.flateStream(data);
    for (const [key, value] of original.dict.entries()) {
      if (
        !['/Filter', '/Length', '/DecodeParms', '/Resources'].includes(
          key.toString()
        )
      )
        replacement.dict.set(key, value);
    }
    const resources = page.node.Resources();
    if (resources) replacement.dict.set(PDFName.of('Resources'), resources);
    doc.context.assign(target, replacement);
    doc.removePage(index);
    doc.context.delete(page.ref);
  }
  return new Uint8Array(await doc.save());
}

/** Recolor text objects, never pixels or non-text page objects. */
export async function recolorPdfText(
  bytes: Uint8Array,
  color: { r: number; g: number; b: number },
  onProgress?: (current: number, total: number) => void
): Promise<{ bytes: Uint8Array; textObjects: number }> {
  const prepared = await prepareTextColorDocument(bytes);
  const result = await recolorTextPages(prepared.bytes, color, (current) => {
    onProgress?.(Math.min(current, prepared.pageCount), prepared.pageCount);
  });
  if (!result.textObjects) return { bytes: bytes.slice(), textObjects: 0 };
  return {
    bytes: prepared.forms
      ? await restoreTextColorForms(result.bytes, prepared.pageCount)
      : result.bytes,
    textObjects: result.textObjects,
  };
}

async function recolorTextPages(
  bytes: Uint8Array,
  color: { r: number; g: number; b: number },
  onProgress?: (current: number, total: number) => void
): Promise<{ bytes: Uint8Array; textObjects: number }> {
  const M = await createEngineModule();
  const config = M._malloc(48);
  M.HEAPU8.fill(0, config, config + 48);
  M.HEAPU32[config >> 2] = 2;
  M._FPDF_InitLibraryWithConfig(config);
  M._free(config);
  const input = M._malloc(bytes.length);
  const rgba = M._malloc(16);
  let doc = 0;
  let textObjects = 0;
  const r = Math.round(color.r * 255),
    g = Math.round(color.g * 255),
    b = Math.round(color.b * 255);
  try {
    M.HEAPU8.set(bytes, input);
    doc = M._FPDF_LoadMemDocument(input, bytes.length, 0);
    if (!doc) throw new Error('Unable to open PDF for text recoloring');
    const visit = (object: number): boolean => {
      const type = M._FPDFPageObj_GetType(object);
      if (type !== 1) return false;
      // Preserve opacity separately for filled and stroked glyphs.
      for (const [get, set] of [
        [M._FPDFPageObj_GetFillColor, M._FPDFPageObj_SetFillColor],
        [M._FPDFPageObj_GetStrokeColor, M._FPDFPageObj_SetStrokeColor],
      ]) {
        if (!get(object, rgba, rgba + 4, rgba + 8, rgba + 12))
          throw new Error('Unable to read text color');
        const alpha = M.HEAPU32[(rgba + 12) >> 2];
        if (!set(object, r, g, b, alpha))
          throw new Error('Unable to set text color');
      }
      textObjects++;
      return true;
    };
    const total = M._FPDF_GetPageCount(doc);
    for (let index = 0; index < total; index++) {
      onProgress?.(index + 1, total);
      const page = M._FPDF_LoadPage(doc, index);
      if (!page) throw new Error(`Unable to load page ${index + 1}`);
      try {
        let changed = false;
        for (let i = 0; i < M._FPDFPage_CountObjects(page); i++) {
          changed = visit(M._FPDFPage_GetObject(page, i)) || changed;
        }
        if (changed && !M._FPDFPage_GenerateContent(page))
          throw new Error('Unable to regenerate text content');
      } finally {
        M._FPDF_ClosePage(page);
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
    if (!textObjects) return { bytes: bytes.slice(), textObjects };
    const sizePtr = M._malloc(4);
    let output = 0;
    try {
      output = M._ec_save_document(doc, 2, sizePtr);
      const size = M.HEAPU32[sizePtr >> 2];
      if (!output || !size) throw new Error('Unable to save recolored PDF');
      return { bytes: M.HEAPU8.slice(output, output + size), textObjects };
    } finally {
      if (output) M._ec_string_free(output);
      M._free(sizePtr);
    }
  } finally {
    if (doc) M._FPDF_CloseDocument(doc);
    M._free(rgba);
    M._free(input);
    M._FPDF_DestroyLibrary();
  }
}
