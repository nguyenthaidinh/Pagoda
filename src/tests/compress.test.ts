import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import type { DocumentInitParameters } from 'pdfjs-dist/types/src/display/api';
import { PDFDocument } from 'pdf-lib';
import {
  compressRenderedPdf,
  performPhotonCompression,
} from '../js/utils/compress';

vi.mock('../js/utils/helpers.js', () => ({ getPDFDocument: vi.fn() }));
vi.mock('../js/utils/pymupdf-loader.js', () => ({ loadPyMuPDF: vi.fn() }));

describe('Photon compression', () => {
  const drawImage = vi.fn();
  const addPage = vi.fn(() => ({ drawImage }));
  const render = vi.fn(() => ({ promise: Promise.resolve() }));
  const cleanup = vi.fn();
  const destroy = vi.fn(async () => {});
  const pdfJsDoc = {
    numPages: 1,
    getPage: vi.fn(async () => ({
      getViewport: ({ scale }: { scale: number }) => ({
        width: 595 * scale,
        height: 842 * scale,
      }),
      render,
      cleanup,
    })),
    destroy,
  } as unknown as PDFDocumentProxy;
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    vi.clearAllMocks();
    canvas = document.createElement('canvas');
    vi.spyOn(canvas, 'getContext').mockReturnValue(
      {} as CanvasRenderingContext2D
    );
    vi.spyOn(canvas, 'toBlob').mockImplementation((callback) =>
      callback({ arrayBuffer: async () => new ArrayBuffer(4) } as Blob)
    );
    vi.spyOn(document, 'createElement').mockReturnValue(canvas);
    vi.spyOn(PDFDocument, 'create').mockResolvedValue({
      embedJpg: vi.fn(async () => ({})),
      addPage,
      save: vi.fn(async () => new Uint8Array([37, 80, 68, 70])),
    } as unknown as PDFDocument);
  });
  afterEach(() => vi.restoreAllMocks());

  it.each(['light', 'balanced', 'aggressive', 'extreme'])(
    'keeps the A4 paper size at %s quality',
    async (level) => {
      await compressRenderedPdf(pdfJsDoc, level);
      expect(addPage).toHaveBeenCalledWith([595, 842]);
      expect(drawImage).toHaveBeenCalledWith(expect.anything(), {
        x: 0,
        y: 0,
        width: 595,
        height: 842,
      });
      expect(destroy).toHaveBeenCalledOnce();
      expect(canvas.width).toBe(0);
      expect(canvas.height).toBe(0);
    }
  );

  it('releases page and document memory after a rendering failure', async () => {
    render.mockImplementationOnce(() => ({
      promise: Promise.reject(new Error('render failed')),
    }));
    await expect(compressRenderedPdf(pdfJsDoc, 'balanced')).rejects.toThrow(
      'render failed'
    );
    expect(cleanup).toHaveBeenCalledOnce();
    expect(destroy).toHaveBeenCalledOnce();
    expect(canvas.width).toBe(0);
  });

  it('keeps workflow input bytes available for another run', async () => {
    const { getPDFDocument } = await import('../js/utils/helpers.js');
    vi.mocked(getPDFDocument).mockReturnValue({
      promise: Promise.resolve(pdfJsDoc),
    } as ReturnType<typeof getPDFDocument>);
    const bytes = new ArrayBuffer(4);
    await performPhotonCompression(bytes, 'light');
    const data = (
      vi.mocked(getPDFDocument).mock.calls.at(-1)![0] as DocumentInitParameters
    ).data;
    expect(data).not.toBe(bytes);
    expect(data).toEqual(bytes);
  });
});
