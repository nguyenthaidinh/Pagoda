import { describe, expect, it, vi } from 'vitest';
import UTIF from 'utif';
import { encodeBmp } from '../js/utils/bmp-encoder';
import { joinTiffPages } from '../js/utils/tiff-pages';
import { sanitizeEmailHtml } from '../js/utils/helpers';
import { convertPdfToGreyscale } from '../js/utils/pdf-greyscale';

const { open } = vi.hoisted(() => ({ open: vi.fn() }));
vi.mock('../js/utils/pymupdf-loader', () => ({
  loadPyMuPDF: async () => ({ open }),
}));

function pixels(width: number, height: number, data: number[]): ImageData {
  return {
    width,
    height,
    data: new Uint8ClampedArray(data),
    colorSpace: 'srgb',
  };
}

describe('BMP encoding', () => {
  it('writes a real BMP header, bottom-up BGR rows and padding', () => {
    const bytes = encodeBmp(pixels(1, 2, [255, 0, 0, 255, 0, 0, 255, 255]));
    const header = new DataView(bytes.buffer);
    expect([...bytes.slice(0, 2)]).toEqual([0x42, 0x4d]);
    expect(header.getUint32(2, true)).toBe(62);
    expect(header.getUint32(10, true)).toBe(54);
    expect(header.getUint16(28, true)).toBe(24);
    expect([...bytes.slice(54)]).toEqual([255, 0, 0, 0, 0, 0, 255, 0]);
  });

  it('composites transparency onto white', () => {
    const bytes = encodeBmp(pixels(2, 1, [0, 0, 0, 0, 255, 0, 0, 128]));
    expect([...bytes.slice(54, 60)]).toEqual([255, 255, 255, 127, 127, 255]);
  });

  it('does not add padding to already aligned rows', () => {
    expect(encodeBmp(pixels(4, 1, Array(16).fill(255))).length).toBe(66);
  });

  it('rejects invalid dimensions instead of producing a malformed file', () => {
    expect(() => encodeBmp(pixels(0, 1, []))).toThrow('Invalid BMP dimensions');
    expect(() => encodeBmp(pixels(1, 1, []))).toThrow('Invalid BMP dimensions');
  });
});

describe('TIFF page assembly', () => {
  function page(w: number, h: number, color: number[]) {
    const data = new Uint8Array(w * h * 4);
    for (let i = 0; i < data.length; i += 4) data.set(color, i);
    return new Uint8Array(UTIF.encodeImage(data, w, h));
  }

  it('keeps unequal dimensions, order and pixel data with a real TIFF reader', () => {
    const first = page(2, 1, [255, 0, 0, 255]);
    const second = page(1, 3, [0, 255, 0, 255]);
    const original = second.slice();
    const output = joinTiffPages([first, second]);
    const frames = UTIF.decode(output.buffer);
    expect(frames).toHaveLength(2);
    frames.forEach((frame) => UTIF.decodeImage(output.buffer, frame));
    expect(frames.map((f) => [f.width, f.height])).toEqual([
      [2, 1],
      [1, 3],
    ]);
    expect([...UTIF.toRGBA8(frames[0]).slice(0, 4)]).toEqual([255, 0, 0, 255]);
    expect([...UTIF.toRGBA8(frames[1]).slice(0, 4)]).toEqual([0, 255, 0, 255]);
    expect(second).toEqual(original);
  });

  it('keeps a single frame when given one page', () => {
    expect(
      UTIF.decode(joinTiffPages([page(2, 1, [0, 0, 0, 255])]).buffer)
    ).toHaveLength(1);
  });

  it('rejects invalid or multipage source containers', () => {
    expect(() => joinTiffPages([])).toThrow('No TIFF pages');
    expect(() => joinTiffPages([new Uint8Array(3)])).toThrow(
      'Invalid TIFF offset'
    );
    const two = joinTiffPages([
      page(1, 1, [0, 0, 0, 255]),
      page(1, 1, [0, 0, 0, 255]),
    ]);
    expect(() => joinTiffPages([two])).toThrow('Expected one IFD');
  });
});

describe('Email sanitization', () => {
  it('preserves long content while still stripping active HTML', () => {
    const html =
      '<div>Full message.</div>'.repeat(6000) +
      '<div>FINAL CONFIRMATION 7391</div><script>alert(1)</script>';
    const output = sanitizeEmailHtml(html);
    expect(output).toContain('FINAL CONFIRMATION 7391');
    expect(output).not.toContain('<script');
    expect(output.length).toBeGreaterThan(100000);
  });
});

describe('Object-preserving greyscale conversion', () => {
  const file = new File(['pdf'], 'input.pdf');

  it('recolors the open document and saves without rebuilding pages', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const doc = {
      docVar: '_doc1',
      runPython: vi.fn(),
      save: vi.fn(() => bytes),
      close: vi.fn(),
    };
    open.mockResolvedValue(doc);
    expect(await convertPdfToGreyscale(file)).toBe(bytes);
    expect(doc.runPython).toHaveBeenCalledWith(
      expect.stringContaining('_pagoda_recolor(_doc1)')
    );
    expect(doc.save).toHaveBeenCalledWith({
      garbage: 1,
      deflate: true,
      clean: false,
    });
    expect(doc.close).toHaveBeenCalledOnce();
  });

  it('closes the document and propagates a recoloring failure', async () => {
    const doc = {
      docVar: '_doc1',
      runPython: vi.fn(() => {
        throw new Error('Recolor failed');
      }),
      save: vi.fn(),
      close: vi.fn(),
    };
    open.mockResolvedValue(doc);
    await expect(convertPdfToGreyscale(file)).rejects.toThrow('Recolor failed');
    expect(doc.save).not.toHaveBeenCalled();
    expect(doc.close).toHaveBeenCalledOnce();
  });

  it('rejects incompatible wrappers without falling back to a raster PDF', async () => {
    const doc = { docVar: '_doc1', save: vi.fn(), close: vi.fn() };
    open.mockResolvedValue(doc);
    await expect(convertPdfToGreyscale(file)).rejects.toThrow(
      'does not support'
    );
    expect(doc.save).not.toHaveBeenCalled();
    expect(doc.close).toHaveBeenCalledOnce();
  });
});
