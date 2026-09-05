import {
  PDFPage,
  concatTransformationMatrix,
  pushGraphicsState,
  popGraphicsState,
} from 'pdf-lib';

/** Bottom-left coordinates of the visible page, independent of CropBox/Rotate. */
export function getVisualPageSpace(page: PDFPage) {
  const crop = page.getCropBox();
  const media = page.getMediaBox();
  const x = Math.max(crop.x, media.x);
  const y = Math.max(crop.y, media.y);
  const w = Math.min(crop.x + crop.width, media.x + media.width) - x;
  const h = Math.min(crop.y + crop.height, media.y + media.height) - y;
  const rotation = ((page.getRotation().angle % 360) + 360) % 360;
  let matrix: [number, number, number, number, number, number];
  switch (rotation) {
    case 90:
      matrix = [0, 1, -1, 0, x + w, y];
      break;
    case 180:
      matrix = [-1, 0, 0, -1, x + w, y + h];
      break;
    case 270:
      matrix = [0, -1, 1, 0, x, y + h];
      break;
    default:
      matrix = [1, 0, 0, 1, x, y];
  }
  return {
    width: rotation % 180 ? h : w,
    height: rotation % 180 ? w : h,
    matrix,
  };
}

export function drawInVisualPageSpace(page: PDFPage, draw: () => void): void {
  const { matrix } = getVisualPageSpace(page);
  page.pushOperators(
    pushGraphicsState(),
    concatTransformationMatrix(...matrix)
  );
  try {
    draw();
  } finally {
    page.pushOperators(popGraphicsState());
  }
}
