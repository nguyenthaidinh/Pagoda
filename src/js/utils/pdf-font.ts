import fontkit from '@pdf-lib/fontkit';
import latinExtendedFontUrl from '@fontsource/dm-sans/files/dm-sans-latin-ext-400-normal.woff?url';
import { PDFDocument, PDFFont, StandardFonts } from 'pdf-lib';

let latinExtendedFontBytes: Promise<ArrayBuffer> | null = null;

async function loadLatinExtendedFont(): Promise<ArrayBuffer> {
  latinExtendedFontBytes ??= fetch(latinExtendedFontUrl).then((response) => {
    if (!response.ok) {
      throw new Error(
        `Failed to load the bundled PDF font (${response.status})`
      );
    }
    return response.arrayBuffer();
  });
  return latinExtendedFontBytes;
}

export async function embedLatinExtendedPdfFont(
  document: PDFDocument,
  subset = true
): Promise<PDFFont> {
  document.registerFontkit(fontkit);
  const fontBytes = await loadLatinExtendedFont();
  return document.embedFont(fontBytes, { subset });
}

export async function embedFontForText(
  document: PDFDocument,
  text: string,
  standardFont: StandardFonts = StandardFonts.Helvetica
): Promise<PDFFont> {
  const fallbackFont = await document.embedFont(standardFont);
  try {
    fallbackFont.encodeText(text);
    return fallbackFont;
  } catch {
    return embedLatinExtendedPdfFont(document);
  }
}
