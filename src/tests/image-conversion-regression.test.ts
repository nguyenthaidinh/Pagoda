// @vitest-environment node
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import * as PDF from 'pdf-lib';
import createQpdf from '@neslinesli93/qpdf-wasm';
import {
  createCanvas,
  Image,
  loadImage,
  DOMMatrix,
  ImageData,
  Path2D,
} from '@napi-rs/canvas';
import {
  compressImageBytes,
  compressImageFile,
} from '../js/utils/image-compress';
import { extractPagesWithQpdf } from '../js/utils/split-pdf-helpers';

Object.assign(globalThis, { DOMMatrix, ImageData, Path2D });
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const openPdf = (bytes: Uint8Array) =>
  pdfjs.getDocument({
    data: bytes.slice(),
    useSystemFonts: true,
    standardFontDataUrl:
      resolve('node_modules/pdfjs-dist/standard_fonts') + '/',
  }).promise;

// Load page handlers without registering their DOMContentLoaded listeners.
function extract(scope: Record<string, any>, path: string, names: string[]) {
  const ast = ts.createSourceFile(
    path,
    readFileSync(path, 'utf8'),
    ts.ScriptTarget.Latest,
    true
  );
  const nodes = names.map((name) => {
    const node = ast.statements.find(
      (item) =>
        (ts.isFunctionDeclaration(item) && item.name?.text === name) ||
        (ts.isVariableStatement(item) &&
          item.declarationList.declarations.some(
            (d) => d.name.getText(ast) === name
          ))
    );
    if (!node) throw new Error(`Missing source function: ${name}`);
    return node.getText(ast);
  });
  const code = ts.transpileModule(nodes.join('\n'), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText;
  new Function(
    'scope',
    `with(scope) { ${code}\nObject.assign(scope,{${names.join(',')}}); }`
  )(scope);
}

function canvasDocument() {
  return { createElement: () => createCanvas(1, 1) };
}

afterEach(() => vi.unstubAllGlobals());

describe('transparent image conversion', () => {
  function installImageAdapter() {
    const blobs = new Map<string, Blob>();
    let id = 0;
    vi.stubGlobal('URL', {
      createObjectURL: (blob: Blob) => {
        const url = `test:${++id}`;
        blobs.set(url, blob);
        return url;
      },
      revokeObjectURL: (url: string) => blobs.delete(url),
    });
    vi.stubGlobal('Image', function () {
      const image = new Image();
      const setter = Object.getOwnPropertyDescriptor(
        Image.prototype,
        'src'
      )!.set!;
      Object.defineProperty(image, 'src', {
        set(url: string) {
          blobs
            .get(url)!
            .arrayBuffer()
            .then((bytes) => setter.call(image, Buffer.from(bytes)));
        },
      });
      return image;
    });
    vi.stubGlobal('document', canvasDocument());
    return blobs;
  }

  function artwork(format: 'png' | 'webp' = 'png') {
    const canvas = createCanvas(100, 80);
    canvas.getContext('2d').fillRect(30, 20, 40, 40);
    return new Uint8Array(
      format === 'png'
        ? canvas.toBuffer('image/png')
        : canvas.toBuffer('image/webp')
    );
  }

  async function pixels(bytes: Uint8Array) {
    const image = await loadImage(Buffer.from(bytes));
    const canvas = createCanvas(image.width, image.height);
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    return {
      background: [...context.getImageData(5, 5, 1, 1).data],
      mark: [...context.getImageData(50, 40, 1, 1).data],
    };
  }

  it.each(['medium', 'low'] as const)(
    'composites transparent PNG against white at %s',
    async (quality) => {
      const blobs = installImageAdapter();
      const result = await compressImageBytes(artwork(), quality);
      expect(result.type).toBe('jpeg');
      expect(await pixels(result.bytes)).toEqual({
        background: [255, 255, 255, 255],
        mark: [0, 0, 0, 255],
      });
      expect(blobs.size).toBe(0);
    }
  );

  it('keeps PNG bytes and alpha unchanged at high quality', async () => {
    const bytes = artwork();
    const result = await compressImageBytes(bytes, 'high');
    expect(result.bytes).toBe(bytes);
    expect(result.type).toBe('png');
    expect((await pixels(result.bytes)).background[3]).toBe(0);
  });

  it('decodes high-quality WebP to actual PNG while retaining alpha', async () => {
    const blobs = installImageAdapter();
    const result = await compressImageBytes(artwork('webp'), 'high');
    expect(result.type).toBe('png');
    expect([...result.bytes.slice(0, 8)]).toEqual([
      137, 80, 78, 71, 13, 10, 26, 10,
    ]);
    expect((await pixels(result.bytes)).background[3]).toBe(0);
    expect(blobs.size).toBe(0);
  });

  it('does not mislabel high-quality JPEG as PNG', async () => {
    const bytes = new Uint8Array(createCanvas(10, 10).toBuffer('image/jpeg'));
    const result = await compressImageBytes(bytes, 'high');
    expect(result.type).toBe('jpeg');
    expect(result.bytes).toBe(bytes);
  });

  it('composites files in the general image conversion path', async () => {
    const blobs = installImageAdapter();
    const file = await compressImageFile(
      new File([artwork()], 'transparent.png', { type: 'image/png' }),
      'medium'
    );
    expect(file.type).toBe('image/jpeg');
    expect(file.name).toBe('transparent.jpg');
    expect(
      (await pixels(new Uint8Array(await file.arrayBuffer()))).background
    ).toEqual([255, 255, 255, 255]);
    expect(blobs.size).toBe(0);
  });
});

describe('blank-page detection', () => {
  const scope: Record<string, any> = { document: canvasDocument() };
  extract(scope, 'src/js/logic/remove-blank-pages-page.ts', ['isPageBlank']);

  it.each([0.1, 1.08, 5])(
    'keeps a sparse text page at threshold %s',
    async (threshold) => {
      const doc = await PDF.PDFDocument.create();
      doc
        .addPage([595, 842])
        .drawText('PAYMENT CONFIRMED', { x: 60, y: 700, size: 18 });
      const reader = await openPdf(await doc.save());
      try {
        expect(
          await scope.isPageBlank(await reader.getPage(1), threshold)
        ).toBe(false);
      } finally {
        await reader.destroy();
      }
    }
  );

  it('still detects a genuinely blank page', async () => {
    const doc = await PDF.PDFDocument.create();
    doc.addPage([595, 842]);
    const reader = await openPdf(await doc.save());
    try {
      expect(await scope.isPageBlank(await reader.getPage(1), 1.08)).toBe(true);
    } finally {
      await reader.destroy();
    }
  });

  it('keeps an empty form field even without text content', async () => {
    const doc = await PDF.PDFDocument.create();
    const page = doc.addPage([595, 842]);
    doc
      .getForm()
      .createTextField('empty')
      .addToPage(page, { x: 50, y: 50, width: 100, height: 20 });
    const reader = await openPdf(await doc.save());
    try {
      expect(await scope.isPageBlank(await reader.getPage(1), 5)).toBe(false);
    } finally {
      await reader.destroy();
    }
  });
});

describe('blank-page removal retains document structures', () => {
  let qpdf: Awaited<ReturnType<typeof createQpdf>>;
  beforeAll(async () => {
    const options = {
      locateFile: () =>
        resolve('node_modules/@neslinesli93/qpdf-wasm/dist/qpdf.wasm'),
      wasmBinary: readFileSync(
        'node_modules/@neslinesli93/qpdf-wasm/dist/qpdf.wasm'
      ),
      noInitialRun: true,
    };
    qpdf = await createQpdf(options);
  });

  it.each([0, 1])(
    'retains form and bookmark when removing page index %i before their target',
    async (removed) => {
      const doc = await PDF.PDFDocument.create();
      doc.addPage([595, 842]);
      doc.addPage([595, 842]);
      const page = doc.addPage([400, 600]);
      doc.setTitle('Keep metadata');
      const field = doc.getForm().createTextField('customer');
      field.setText('Customer A');
      field.addToPage(page, { x: 50, y: 100, width: 150, height: 25 });
      const root = doc.context.obj({ Type: 'Outlines', Count: 1 });
      const rootRef = doc.context.register(root);
      const entry = doc.context.register(
        doc.context.obj({
          Title: PDF.PDFHexString.fromText('Customer'),
          Parent: rootRef,
          Dest: [page.ref, 'Fit'],
        })
      );
      root.set(PDF.PDFName.of('First'), entry);
      root.set(PDF.PDFName.of('Last'), entry);
      doc.catalog.set(PDF.PDFName.of('Outlines'), rootRef);
      const bytes = await doc.save();
      const downloads: Blob[] = [];
      const scope: Record<string, any> = {
        pageState: {
          pdfDoc: doc,
          file: new File([new Uint8Array(bytes)], 'input.pdf'),
        },
        document: {
          getElementById: () => ({
            querySelectorAll: () => [
              { dataset: { pageIndex: String(removed) } },
            ],
          }),
        },
        t: (s: string) => s,
        showLoader: vi.fn(),
        hideLoader: vi.fn(),
        showAlert: vi.fn(),
        resetState: vi.fn(),
        downloadFile: (blob: Blob) => downloads.push(blob),
        initializeQpdf: async () => qpdf,
        extractPagesWithQpdf,
      };
      extract(scope, 'src/js/logic/remove-blank-pages-page.ts', [
        'processRemoveBlankPages',
      ]);
      await scope.processRemoveBlankPages();
      expect(downloads).toHaveLength(1);
      const output = new Uint8Array(await downloads[0].arrayBuffer());
      const saved = await PDF.PDFDocument.load(output);
      expect(saved.getPageCount()).toBe(2);
      expect(saved.getTitle()).toBe('Keep metadata');
      expect(saved.getPage(1).getSize()).toEqual({ width: 400, height: 600 });
      expect(saved.getForm().getTextField('customer').getText()).toBe(
        'Customer A'
      );
      saved.getForm().getTextField('customer').setText('Still editable');
      expect(
        (await PDF.PDFDocument.load(await saved.save()))
          .getForm()
          .getTextField('customer')
          .getText()
      ).toBe('Still editable');
      const reader = await openPdf(output);
      try {
        const outline = await reader.getOutline();
        expect(outline).toHaveLength(1);
        expect(await reader.getPageIndex(outline![0].dest[0])).toBe(1);
      } finally {
        await reader.destroy();
      }
      expect(doc.getPageCount()).toBe(3);
      expect(() => qpdf.FS.readFile('/remove-blank-pages-input.pdf')).toThrow();
      expect(() =>
        qpdf.FS.readFile('/remove-blank-pages-output.pdf')
      ).toThrow();
    }
  );
});

describe('TXT renderer options', () => {
  const scope: Record<string, any> = { exports: {} };
  extract(scope, 'src/js/utils/helpers.ts', ['escapeHtml']);
  extract(scope, 'src/js/logic/txt-to-pdf-page.ts', [
    'RTL_PATTERN',
    'hasRtlCharacters',
    'textPdfHtml',
  ]);

  it('includes color, font, size and escaped literal text', () => {
    const html = scope.textPdfHtml(
      '<script>alert(1)</script> & text\r\nnext',
      'cour',
      24,
      '#ff0000'
    );
    expect(html).toContain('color: #ff0000');
    expect(html).toContain('font-family: monospace');
    expect(html).toContain('font-size: 24pt');
    expect(html).toContain(
      '&lt;script&gt;alert(1)&lt;/script&gt; &amp; text<br>next'
    );
    expect(html).not.toContain('<script>');
  });

  it('retains RTL direction and validates CSS values', () => {
    const html = scope.textPdfHtml(
      '\u05e9\u05dc\u05d5\u05dd',
      'invalid;font',
      100,
      'red;display:none'
    );
    expect(html).toContain('direction: rtl; text-align: right;');
    expect(html).toContain('font-family: sans-serif');
    expect(html).toContain('font-size: 72pt');
    expect(html).toContain('color: #000000');
    expect(html).not.toContain('display:none');
  });
});
