/** Encode opaque, bottom-up 24-bit BMP with four-byte aligned BGR rows. */
export function encodeBmp(image: ImageData): Uint8Array<ArrayBuffer> {
  const { width, height, data } = image;
  const stride = Math.ceil((width * 3) / 4) * 4;
  const size = 54 + stride * height;
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0 ||
    data.length !== width * height * 4 ||
    size > 0xffffffff
  ) {
    throw new Error('Invalid BMP dimensions');
  }
  const bytes = new Uint8Array(size);
  const header = new DataView(bytes.buffer);
  bytes.set([0x42, 0x4d]);
  header.setUint32(2, size, true);
  header.setUint32(10, 54, true);
  header.setUint32(14, 40, true);
  header.setInt32(18, width, true);
  header.setInt32(22, height, true);
  header.setUint16(26, 1, true);
  header.setUint16(28, 24, true);
  header.setUint32(34, stride * height, true);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const source = (y * width + x) * 4;
      const target = 54 + (height - 1 - y) * stride + x * 3;
      const alpha = data[source + 3] / 255;
      for (let channel = 0; channel < 3; channel++) {
        bytes[target + channel] = Math.round(
          data[source + 2 - channel] * alpha + 255 * (1 - alpha)
        );
      }
    }
  }
  return bytes;
}
