/** Join classic single-page TIFFs emitted by vips without re-encoding pixels.
 * Keeping one IFD per source preserves unequal page dimensions and compression.
 */
export function joinTiffPages(pages: Uint8Array[]): Uint8Array<ArrayBuffer> {
  if (!pages.length) throw new Error('No TIFF pages');
  const bases: number[] = [];
  let size = 0;
  for (const page of pages) {
    bases.push(size);
    size += page.byteLength + (page.byteLength % 2);
  }
  if (size > 0xffffffff) throw new Error('Multipage TIFF exceeds 4 GiB');
  const output = new Uint8Array(size);
  const target = new DataView(output.buffer);
  let previousNext = 4;
  let byteOrder: number | undefined;
  const typeSizes = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8];

  pages.forEach((page, index) => {
    const base = bases[index];
    const view = new DataView(page.buffer, page.byteOffset, page.byteLength);
    const check = (offset: number, length: number) => {
      if (offset < 0 || offset + length > page.byteLength)
        throw new Error('Invalid TIFF offset');
    };
    check(0, 8);
    const order = view.getUint16(0);
    const little = order === 0x4949;
    if (
      (order !== 0x4949 && order !== 0x4d4d) ||
      (byteOrder !== undefined && order !== byteOrder) ||
      view.getUint16(2, little) !== 42
    ) {
      throw new Error('Expected classic TIFF pages with matching byte order');
    }
    byteOrder = order;
    const ifd = view.getUint32(4, little);
    check(ifd, 2);
    const count = view.getUint16(ifd, little);
    const next = ifd + 2 + count * 12;
    check(ifd, 2 + count * 12 + 4);
    if (view.getUint32(next, little) !== 0)
      throw new Error('Expected one IFD per encoded TIFF page');
    output.set(page, base);
    target.setUint32(previousNext, base + ifd, little);
    previousNext = base + next;

    for (let i = 0; i < count; i++) {
      const entry = ifd + 2 + i * 12;
      const tag = view.getUint16(entry, little);
      const type = view.getUint16(entry + 2, little);
      const length = view.getUint32(entry + 4, little);
      const unit = typeSizes[type];
      if (!unit) throw new Error('Unsupported TIFF field type');
      // vips output has no nested IFDs. Reject them instead of retaining stale pointers.
      if ([330, 34665, 34853, 40965].includes(tag))
        throw new Error('Nested TIFF directories are not supported');
      const valueSize = length * unit;
      const valueOffset =
        valueSize > 4 ? view.getUint32(entry + 8, little) : entry + 8;
      check(valueOffset, valueSize);
      if (valueSize > 4)
        target.setUint32(base + entry + 8, base + valueOffset, little);
      // StripOffsets, TileOffsets and JPEGInterchangeFormat contain file pointers.
      if ([273, 324, 513].includes(tag)) {
        if (type !== 4) throw new Error('Expected LONG TIFF data offsets');
        for (let j = 0; j < length; j++) {
          const offset = view.getUint32(valueOffset + j * 4, little);
          check(offset, 1);
          target.setUint32(base + valueOffset + j * 4, base + offset, little);
        }
      }
    }
  });
  return output;
}
