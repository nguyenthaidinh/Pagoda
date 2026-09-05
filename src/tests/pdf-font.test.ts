import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import {
  embedFontForText,
  embedLatinExtendedPdfFont,
} from '../js/utils/pdf-font';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('PDF text font embedding', () => {
  it('keeps a selected standard font when it supports the text', async () => {
    const document = await PDFDocument.create();
    const font = await embedFontForText(
      document,
      'Case XYZ 000001',
      StandardFonts.Courier
    );

    expect(font.name).toBe(StandardFonts.Courier);
  });

  it('embeds the bundled Latin Extended font for Vietnamese text', async () => {
    const fontBytes = readFileSync(
      resolve(
        'node_modules/@fontsource/dm-sans/files/dm-sans-latin-ext-400-normal.woff'
      )
    );
    globalThis.fetch = vi.fn(
      async () => new Response(fontBytes, { status: 200 })
    ) as typeof fetch;

    const document = await PDFDocument.create();
    const font = await embedFontForText(
      document,
      'Hồ sơ Vụ án Trang',
      StandardFonts.Helvetica
    );
    document.addPage([300, 100]).drawText('Hồ sơ Vụ án Trang', { font });

    expect((await document.save()).length).toBeGreaterThan(500);
    expect(globalThis.fetch).toHaveBeenCalledOnce();
  });

  it('creates fillable form appearances with Vietnamese text', async () => {
    const fontBytes = readFileSync(
      resolve(
        'node_modules/@fontsource/dm-sans/files/dm-sans-latin-ext-400-normal.woff'
      )
    );
    globalThis.fetch = vi.fn(
      async () => new Response(fontBytes, { status: 200 })
    ) as typeof fetch;

    const document = await PDFDocument.create();
    const page = document.addPage([300, 100]);
    const font = await embedLatinExtendedPdfFont(document, false);
    const form = document.getForm();
    const field = form.createTextField('ho_so');
    field.addToPage(page, { x: 20, y: 30, width: 250, height: 30, font });
    field.setText('Hồ sơ tiếng Việt');
    form.updateFieldAppearances(font);

    expect((await document.save()).length).toBeGreaterThan(1000);
  });
});
