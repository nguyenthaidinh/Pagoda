// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { PDFDocument, PDFString, degrees, rgb, StandardFonts } from 'pdf-lib';
import { createCanvas, DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas';
import { resolve } from 'node:path';
import { prependPageBackgrounds } from '../js/utils/pdf-background.js';
import {
  getVisualPageSpace,
  drawInVisualPageSpace,
} from '../js/utils/pdf-page-space.js';
import { recolorPdfText } from '../js/utils/pdf-text-color.js';
import { sanitizeBookmarkTarget } from '../js/utils/bookmark-target.js';
import { deduplicateFileName } from '../js/utils/deduplicate-filename.js';

Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const open = (bytes: Uint8Array) =>
  pdfjs.getDocument({
    data: bytes.slice(),
    useSystemFonts: true,
    standardFontDataUrl:
      resolve('node_modules/pdfjs-dist/standard_fonts') + '/',
  }).promise;

async function render(bytes: Uint8Array, pageNumber = 1) {
  const doc = await open(bytes);
  try {
    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d');
    await page.render({
      canvas: canvas as unknown as HTMLCanvasElement,
      canvasContext: context as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise;
    return {
      text: (await page.getTextContent()).items
        .filter((i) => 'str' in i)
        .map((i) => i.str)
        .join(' '),
      pixel: (x: number, y: number) => [
        ...context.getImageData(x, y, 1, 1).data,
      ],
      data: context.getImageData(0, 0, canvas.width, canvas.height).data,
    };
  } finally {
    await doc.destroy();
  }
}

describe('background preservation', () => {
  it('retains editable fields, links, page geometry and metadata', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([600, 800]);
    page.drawText('Original content');
    page.setCropBox(20, 30, 500, 700);
    page.setRotation(degrees(270));
    doc.setTitle('Original title');
    const field = doc.getForm().createTextField('value');
    field.setText('KEEP ME');
    field.addToPage(page, { x: 100, y: 100, width: 150, height: 30 });
    const link = doc.context.register(
      doc.context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: [50, 50, 100, 100],
        A: { S: 'URI', URI: PDFString.of('https://example.com/') },
      })
    );
    page.node.addAnnot(link);
    prependPageBackgrounds(doc, { r: 0.8, g: 0.9, b: 1 });
    const saved = await PDFDocument.load(await doc.save());
    expect(saved.getForm().getTextField('value').getText()).toBe('KEEP ME');
    saved.getForm().getTextField('value').setText('STILL EDITABLE');
    expect(saved.getPage(0).node.Annots()?.size()).toBe(2);
    expect(saved.getPage(0).getCropBox()).toEqual({
      x: 20,
      y: 30,
      width: 500,
      height: 700,
    });
    expect(saved.getPage(0).getRotation().angle).toBe(270);
    expect(saved.getTitle()).toBe('Original title');
  });

  it('works on a blank page and draws behind opaque content', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([100, 100]);
    doc.addPage([100, 100]).drawRectangle({
      x: 10,
      y: 10,
      width: 20,
      height: 20,
      color: rgb(1, 0, 0),
    });
    prependPageBackgrounds(doc, { r: 0, g: 1, b: 0 });
    const bytes = await doc.save();
    expect((await render(bytes)).pixel(50, 50)).toEqual([0, 255, 0, 255]);
    expect((await render(bytes, 2)).pixel(20, 80)).toEqual([255, 0, 0, 255]);
  });
});

describe('visual page coordinates', () => {
  for (const rotation of [0, 90, 180, 270]) {
    for (const offset of [false, true]) {
      it(`maps drawing with rotation ${rotation}, crop offset ${offset}`, async () => {
        const doc = await PDFDocument.create();
        const page = doc.addPage([600, 800]);
        page.setRotation(degrees(rotation));
        if (offset) page.setCropBox(100, 200, 350, 500);
        const space = getVisualPageSpace(page);
        drawInVisualPageSpace(page, () =>
          page.drawText('MARK', { x: 30, y: 40, size: 12 })
        );
        const pdf = await open(await doc.save());
        try {
          const rendered = await pdf.getPage(1);
          const viewport = rendered.getViewport({ scale: 1 });
          const item = (await rendered.getTextContent()).items.find(
            (i) => 'str' in i && i.str === 'MARK'
          );
          expect(item && 'transform' in item).toBeTruthy();
          if (!item || !('transform' in item)) throw new Error('Missing text');
          const transform = pdfjs.Util.transform(
            viewport.transform,
            item.transform
          );
          expect(transform[4]).toBeCloseTo(30);
          expect(transform[5]).toBeCloseTo(space.height - 40);
          expect(transform[0]).toBeCloseTo(12);
          expect(transform[1]).toBeCloseTo(0);
          expect(viewport.width).toBe(space.width);
        } finally {
          await pdf.destroy();
        }
      });
    }
  }
});

describe('text recoloring with real PDFium', () => {
  it('preserves the visible page geometry instead of rasterizing it', async () => {
    for (const rotation of [0, 90, 180, 270]) {
      const doc = await PDFDocument.create();
      const page = doc.addPage([600, 800]);
      page.setCropBox(50, 60, 450, 700);
      page.setRotation(degrees(rotation));
      page.drawText('GEOMETRY', { x: 100, y: 300 });
      const result = await recolorPdfText(await doc.save(), {
        r: 0,
        g: 1,
        b: 0,
      });
      const saved = await PDFDocument.load(result.bytes);
      expect(saved.getPageCount()).toBe(1);
      expect(saved.getPage(0).getCropBox()).toEqual(page.getCropBox());
      expect(saved.getPage(0).getMediaBox()).toEqual(page.getMediaBox());
      expect(saved.getPage(0).getRotation().angle).toBe(rotation);
      expect((await render(result.bytes)).text).toContain('GEOMETRY');
    }
  });
  async function content() {
    const doc = await PDFDocument.create();
    const page = doc.addPage([300, 300]);
    page.drawText('RED TEXT', {
      x: 30,
      y: 200,
      size: 22,
      color: rgb(1, 0, 0),
      font: await doc.embedFont(StandardFonts.Helvetica),
    });
    page.drawRectangle({
      x: 30,
      y: 30,
      width: 50,
      height: 50,
      color: rgb(0, 0, 0),
    });
    return doc;
  }

  it('recolors text inside nested Form XObjects on multiple pages', async () => {
    const original = await content();
    const middle = await PDFDocument.create();
    const embedded = await middle.embedPage(original.getPage(0));
    middle.addPage([300, 300]).drawPage(embedded);
    const savedMiddle = await PDFDocument.load(await middle.save());
    const outer = await PDFDocument.create();
    const nested = await outer.embedPage(savedMiddle.getPage(0));
    outer.addPage([300, 300]).drawPage(nested);
    outer.addPage([300, 300]).drawPage(nested);
    const result = await recolorPdfText(await outer.save(), {
      r: 0,
      g: 1,
      b: 0,
    });
    expect(result.textObjects).toBeGreaterThan(0);
    expect((await PDFDocument.load(result.bytes)).getPageCount()).toBe(2);
    for (const number of [1, 2]) {
      const image = await render(result.bytes, number);
      expect(image.text).toContain('RED TEXT');
      expect(image.pixel(50, 250)).toEqual([0, 0, 0, 255]);
      let red = 0,
        green = 0;
      for (let i = 0; i < image.data.length; i += 4) {
        if (image.data[i] > 200 && image.data[i + 1] < 40) red++;
        if (
          image.data[i] < 40 &&
          image.data[i + 1] > 200 &&
          image.data[i + 2] < 40
        )
          green++;
      }
      expect(red).toBe(0);
      expect(green).toBeGreaterThan(20);
    }
  });

  it('keeps image pixels and filled widgets intact', async () => {
    const doc = await content();
    const canvas = createCanvas(20, 20);
    canvas.getContext('2d').fillRect(0, 0, 20, 20);
    const image = await doc.embedPng(canvas.toBuffer('image/png'));
    doc.getPage(0).drawImage(image, { x: 200, y: 50, width: 20, height: 20 });
    const field = doc.getForm().createTextField('name');
    field.setText('SAVED');
    field.addToPage(doc.getPage(0), { x: 30, y: 100, width: 150, height: 30 });
    const result = await recolorPdfText(await doc.save(), { r: 0, g: 1, b: 0 });
    const saved = await PDFDocument.load(result.bytes);
    expect(saved.getForm().getTextField('name').getText()).toBe('SAVED');
    expect((await render(result.bytes)).pixel(210, 240)).toEqual([
      0, 0, 0, 255,
    ]);
  });

  it('reports no text and leaves image-only PDFs byte-for-byte unchanged', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([100, 100]).drawRectangle({ width: 100, height: 100 });
    const bytes = await doc.save();
    const result = await recolorPdfText(bytes, { r: 1, g: 0, b: 0 });
    expect(result.textObjects).toBe(0);
    expect(result.bytes).toEqual(bytes);
  });
});

describe('bookmark targets and output names', () => {
  it.each([
    ['Fit', []],
    ['FitB', []],
    ['FitH', [700]],
    ['FitBH', [null]],
    ['FitV', [40]],
    ['FitBV', [50]],
    ['FitR', [20, 30, 400, 600]],
    ['XYZ', [20.25, 700.5, 1.25]],
  ])('keeps %s parameters through JSON round trips', (type, args) => {
    const target = { kind: 'destination', type, args };
    expect(sanitizeBookmarkTarget(JSON.parse(JSON.stringify(target)))).toEqual(
      target
    );
  });
  it('retains website actions and rejects executable URL schemes', () => {
    expect(
      sanitizeBookmarkTarget({
        kind: 'uri',
        url: 'https://example.com/',
        newWindow: true,
      })
    ).toEqual({ kind: 'uri', url: 'https://example.com/', newWindow: true });
    expect(
      sanitizeBookmarkTarget({ kind: 'uri', url: 'javascript:alert(1)' })
    ).toBeUndefined();
    expect(
      sanitizeBookmarkTarget({ kind: 'destination', type: 'FitR', args: [1] })
    ).toBeUndefined();
  });
  it('retains every file even when generated suffixes already exist', () => {
    const used = new Set<string>();
    expect(
      ['report.pdf', 'report.pdf', 'report (1).pdf', 'report.pdf'].map((name) =>
        deduplicateFileName(name, used)
      )
    ).toEqual([
      'report.pdf',
      'report (1).pdf',
      'report (1) (1).pdf',
      'report (2).pdf',
    ]);
  });
});
