import { describe, it, expect } from 'vitest';
import { tiffIfdToRgba } from '../js/utils/tiff-utils';
import { decode } from 'tiff';

describe('tiffIfdToRgba', () => {
  describe('RGB (3 channels)', () => {
    it('converts RGB data to RGBA with full opacity', () => {
      const src = new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255]);
      const result = tiffIfdToRgba(src, 3, 1, 3, 2);
      expect(Array.from(result)).toEqual([
        255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255,
      ]);
    });

    it('handles a 2x2 RGB image', () => {
      const src = new Uint8Array([
        10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120,
      ]);
      const result = tiffIfdToRgba(src, 2, 2, 3, 2);
      expect(result.length).toBe(16);
      expect(result[0]).toBe(10);
      expect(result[1]).toBe(20);
      expect(result[2]).toBe(30);
      expect(result[3]).toBe(255);
      expect(result[4]).toBe(40);
      expect(result[5]).toBe(50);
      expect(result[6]).toBe(60);
      expect(result[7]).toBe(255);
    });
  });

  describe('RGBA (4 channels)', () => {
    it('copies all 4 channels directly', () => {
      const src = new Uint8Array([255, 128, 64, 200, 0, 0, 0, 0]);
      const result = tiffIfdToRgba(src, 2, 1, 4, 2);
      expect(Array.from(result)).toEqual([255, 128, 64, 200, 0, 0, 0, 0]);
    });

    it('preserves alpha = 0 (fully transparent)', () => {
      const src = new Uint8Array([100, 100, 100, 0]);
      const result = tiffIfdToRgba(src, 1, 1, 4, 2);
      expect(result[3]).toBe(0);
    });

    it('preserves alpha = 255 (fully opaque)', () => {
      const src = new Uint8Array([100, 100, 100, 255]);
      const result = tiffIfdToRgba(src, 1, 1, 4, 2);
      expect(result[3]).toBe(255);
    });
  });

  describe('Grayscale (1 channel)', () => {
    it('expands grayscale to RGB with full opacity', () => {
      const src = new Uint8Array([128]);
      const result = tiffIfdToRgba(src, 1, 1, 1, 1);
      expect(Array.from(result)).toEqual([128, 128, 128, 255]);
    });

    it('handles black pixel', () => {
      const src = new Uint8Array([0]);
      const result = tiffIfdToRgba(src, 1, 1, 1, 1);
      expect(Array.from(result)).toEqual([0, 0, 0, 255]);
    });

    it('handles white pixel', () => {
      const src = new Uint8Array([255]);
      const result = tiffIfdToRgba(src, 1, 1, 1, 1);
      expect(Array.from(result)).toEqual([255, 255, 255, 255]);
    });

    it('handles multiple grayscale pixels', () => {
      const src = new Uint8Array([0, 128, 255]);
      const result = tiffIfdToRgba(src, 3, 1, 1, 1);
      expect(result.length).toBe(12);
      expect(result[0]).toBe(0);
      expect(result[4]).toBe(128);
      expect(result[8]).toBe(255);
      expect(result[3]).toBe(255);
      expect(result[7]).toBe(255);
      expect(result[11]).toBe(255);
    });
  });

  describe('Grayscale + Alpha (2 channels)', () => {
    it('expands grayscale and copies alpha', () => {
      const src = new Uint8Array([200, 100]);
      const result = tiffIfdToRgba(src, 1, 1, 2, 1);
      expect(Array.from(result)).toEqual([200, 200, 200, 100]);
    });

    it('handles fully transparent grayscale', () => {
      const src = new Uint8Array([255, 0]);
      const result = tiffIfdToRgba(src, 1, 1, 2, 1);
      expect(result[3]).toBe(0);
    });
  });

  describe('WhiteIsZero (photometric type 0)', () => {
    it('preserves black after decoder normalization', () => {
      const src = new Uint8Array([0]);
      const result = tiffIfdToRgba(src, 1, 1, 1, 0);
      expect(Array.from(result)).toEqual([0, 0, 0, 255]);
    });

    it('preserves normalized mid-gray', () => {
      const src = new Uint8Array([200]);
      const result = tiffIfdToRgba(src, 1, 1, 1, 0);
      expect(result[0]).toBe(200);
      expect(result[1]).toBe(200);
      expect(result[2]).toBe(200);
    });

    it('preserves white after decoder normalization', () => {
      const src = new Uint8Array([255]);
      const result = tiffIfdToRgba(src, 1, 1, 1, 0);
      expect(Array.from(result)).toEqual([255, 255, 255, 255]);
    });

    it('does not invert alpha in grayscale+alpha', () => {
      const src = new Uint8Array([0, 128]);
      const result = tiffIfdToRgba(src, 1, 1, 2, 0);
      expect(result[0]).toBe(0);
      expect(result[3]).toBe(128);
    });

    it('does not affect RGB images', () => {
      const src = new Uint8Array([100, 150, 200]);
      const result = tiffIfdToRgba(src, 1, 1, 3, 0);
      expect(result[0]).toBe(100);
      expect(result[1]).toBe(150);
      expect(result[2]).toBe(200);
    });
  });

  describe('16-bit images', () => {
    it('normalizes 16-bit RGB to 8-bit', () => {
      const src = new Uint16Array([65535, 0, 32768]);
      const result = tiffIfdToRgba(src, 1, 1, 3, 2);
      expect(result[0]).toBe(255);
      expect(result[1]).toBe(0);
      expect(result[2]).toBe(128);
      expect(result[3]).toBe(255);
    });

    it('normalizes 16-bit grayscale to 8-bit', () => {
      const src = new Uint16Array([65535]);
      const result = tiffIfdToRgba(src, 1, 1, 1, 1);
      expect(result[0]).toBe(255);
      expect(result[1]).toBe(255);
      expect(result[2]).toBe(255);
    });

    it('handles 16-bit zero values', () => {
      const src = new Uint16Array([0, 0, 0]);
      const result = tiffIfdToRgba(src, 1, 1, 3, 2);
      expect(result[0]).toBe(0);
      expect(result[1]).toBe(0);
      expect(result[2]).toBe(0);
    });

    it('normalizes 16-bit RGBA including alpha', () => {
      const src = new Uint16Array([65535, 32768, 0, 49152]);
      const result = tiffIfdToRgba(src, 1, 1, 4, 2);
      expect(result[0]).toBe(255);
      expect(result[1]).toBe(128);
      expect(result[2]).toBe(0);
      expect(result[3]).toBe(192);
    });
  });

  describe('Float32 images', () => {
    it('normalizes float RGB (0.0-1.0) to 8-bit', () => {
      const src = new Float32Array([1.0, 0.0, 0.5]);
      const result = tiffIfdToRgba(src, 1, 1, 3, 2);
      expect(result[0]).toBe(255);
      expect(result[1]).toBe(0);
      expect(result[2]).toBe(128);
      expect(result[3]).toBe(255);
    });

    it('clamps float values above 1.0', () => {
      const src = new Float32Array([1.5, 0.0, 0.0]);
      const result = tiffIfdToRgba(src, 1, 1, 3, 2);
      expect(result[0]).toBe(255);
    });

    it('clamps float values below 0.0', () => {
      const src = new Float32Array([-0.5, 0.0, 0.0]);
      const result = tiffIfdToRgba(src, 1, 1, 3, 2);
      expect(result[0]).toBe(0);
    });

    it('normalizes float grayscale', () => {
      const src = new Float32Array([0.5]);
      const result = tiffIfdToRgba(src, 1, 1, 1, 1);
      expect(result[0]).toBe(128);
      expect(result[1]).toBe(128);
      expect(result[2]).toBe(128);
    });
  });

  describe('Float64 images', () => {
    it('normalizes float64 RGB to 8-bit', () => {
      const src = new Float64Array([1.0, 0.5, 0.0]);
      const result = tiffIfdToRgba(src, 1, 1, 3, 2);
      expect(result[0]).toBe(255);
      expect(result[1]).toBe(128);
      expect(result[2]).toBe(0);
    });
  });

  describe('output buffer size', () => {
    it('always outputs width * height * 4 bytes', () => {
      const src1 = new Uint8Array([100, 200, 50]);
      expect(tiffIfdToRgba(src1, 1, 1, 3, 2).length).toBe(4);

      const src2 = new Uint8Array([100]);
      expect(tiffIfdToRgba(src2, 1, 1, 1, 1).length).toBe(4);

      const src3 = new Uint8Array(new Array(12).fill(128));
      expect(tiffIfdToRgba(src3, 2, 2, 3, 2).length).toBe(16);
    });

    it('returns Uint8ClampedArray', () => {
      const src = new Uint8Array([0, 0, 0]);
      const result = tiffIfdToRgba(src, 1, 1, 3, 2);
      expect(result).toBeInstanceOf(Uint8ClampedArray);
    });
  });

  describe('edge cases', () => {
    it('handles 1x1 pixel image', () => {
      const src = new Uint8Array([42, 84, 126]);
      const result = tiffIfdToRgba(src, 1, 1, 3, 2);
      expect(Array.from(result)).toEqual([42, 84, 126, 255]);
    });

    it('handles 5+ channel images (uses first 4)', () => {
      const src = new Uint8Array([10, 20, 30, 40, 99]);
      const result = tiffIfdToRgba(src, 1, 1, 5, 2);
      expect(result[0]).toBe(10);
      expect(result[1]).toBe(20);
      expect(result[2]).toBe(30);
      expect(result[3]).toBe(40);
    });
  });
});

// Two pixels: white/black for grayscale, red/green for palette images.
function makeTiff(photo: number, bits: number): ArrayBuffer {
  const dataLength = bits === 1 ? 1 : 2;
  const tags = [
    [256, 4, 1, 2],
    [257, 4, 1, 1],
    [258, 3, 1, bits],
    [259, 3, 1, 1],
    [262, 3, 1, photo],
    [273, 4, 1, 0],
    [277, 3, 1, 1],
    [278, 4, 1, 1],
    [279, 4, 1, dataLength],
  ];
  if (photo === 3) tags.push([320, 3, 768, 0]);
  const paletteOffset = 8 + 2 + tags.length * 12 + 4;
  const dataOffset = paletteOffset + (photo === 3 ? 1536 : 0);
  tags.find((tag) => tag[0] === 273)![3] = dataOffset;
  if (photo === 3) tags.find((tag) => tag[0] === 320)![3] = paletteOffset;
  const bytes = new ArrayBuffer(dataOffset + dataLength);
  const view = new DataView(bytes);
  view.setUint16(0, 0x4949, true);
  view.setUint16(2, 42, true);
  view.setUint32(4, 8, true);
  view.setUint16(8, tags.length, true);
  tags.forEach(([tag, type, count, value], i) => {
    const offset = 10 + i * 12;
    view.setUint16(offset, tag, true);
    view.setUint16(offset + 2, type, true);
    view.setUint32(offset + 4, count, true);
    view.setUint32(offset + 8, value, true);
  });
  if (photo === 3) {
    view.setUint16(paletteOffset, 65535, true);
    view.setUint16(paletteOffset + 257 * 2, 65535, true);
    view.setUint8(dataOffset + 1, 1);
  } else if (bits === 1) {
    view.setUint8(dataOffset, photo === 0 ? 0b01000000 : 0b10000000);
  } else {
    view.setUint8(dataOffset, photo === 0 ? 0 : 255);
    view.setUint8(dataOffset + 1, photo === 0 ? 255 : 0);
  }
  return bytes;
}

describe('actual TIFF decoder contract', () => {
  it.each([
    [0, 8],
    [1, 8],
    [0, 1],
    [1, 1],
  ])('retains white and black for photometric=%i, bits=%i', (photo, bits) => {
    const [ifd] = decode(makeTiff(photo, bits));
    const rgba = tiffIfdToRgba(
      ifd.data,
      ifd.width,
      ifd.height,
      ifd.samplesPerPixel,
      ifd.type,
      ifd.bitsPerSample
    );
    expect([...rgba]).toEqual([255, 255, 255, 255, 0, 0, 0, 255]);
  });

  it('uses the decoded 16-bit ColorMap instead of grayscale indices', () => {
    const [ifd] = decode(makeTiff(3, 8));
    const rgba = tiffIfdToRgba(
      ifd.data,
      ifd.width,
      ifd.height,
      ifd.samplesPerPixel,
      ifd.type,
      ifd.bitsPerSample,
      ifd.palette
    );
    expect([...rgba]).toEqual([255, 0, 0, 255, 0, 255, 0, 255]);
  });

  it('rejects a missing palette instead of silently exporting wrong colors', () => {
    expect(() => tiffIfdToRgba(new Uint8Array([0]), 1, 1, 1, 3, 8)).toThrow(
      'Missing or invalid TIFF palette entry'
    );
  });
});
