type TiffDataArray = Uint8Array | Uint16Array | Float32Array | Float64Array;

export function tiffIfdToRgba(
  src: TiffDataArray,
  width: number,
  height: number,
  channels: number,
  photometricType: number,
  bitsPerSample = src instanceof Uint16Array ? 16 : 8,
  palette?: ReadonlyArray<readonly [number, number, number]>
): Uint8ClampedArray {
  const totalPixels = width * height;
  const dst = new Uint8ClampedArray(totalPixels * 4);

  let maxVal = 255;
  if (src instanceof Uint16Array) maxVal = 65535;
  else if (src instanceof Float32Array || src instanceof Float64Array)
    maxVal = 1;
  else if (bitsPerSample === 1) maxVal = 1;

  const norm = (v: number) => {
    if (maxVal === 255) return v;
    if (maxVal === 1) return Math.round(Math.min(1, Math.max(0, v)) * 255);
    return v >> 8;
  };

  for (let p = 0; p < totalPixels; p++) {
    const si = p * channels;
    const di = p * 4;

    if (photometricType === 3) {
      const color = palette?.[src[si]];
      if (!color) throw new Error('Missing or invalid TIFF palette entry');
      dst[di] = color[0] >> 8;
      dst[di + 1] = color[1] >> 8;
      dst[di + 2] = color[2] >> 8;
      dst[di + 3] = 255;
    } else if (channels >= 3) {
      dst[di] = norm(src[si]);
      dst[di + 1] = norm(src[si + 1]);
      dst[di + 2] = norm(src[si + 2]);
      dst[di + 3] = channels >= 4 ? norm(src[si + 3]) : 255;
    } else {
      // The tiff decoder has already normalized WhiteIsZero samples.
      const gray = norm(src[si]);
      dst[di] = gray;
      dst[di + 1] = gray;
      dst[di + 2] = gray;
      dst[di + 3] = channels === 2 ? norm(src[si + 1]) : 255;
    }
  }

  return dst;
}
