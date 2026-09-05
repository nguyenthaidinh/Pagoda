import { describe, expect, it } from 'vitest';
import {
  captureIndexedPageState,
  restoreIndexedPageState,
} from '../js/utils/multi-tool-page-state';

describe('multi-tool page identity through edits', () => {
  const pages = ['a', 'b', 'c', 'd'].map((id) => ({ id }));
  const captured = () =>
    captureIndexedPageState(pages, new Set([1, 3]), new Set([1, 2]));

  it('moves selections and split markers with the dragged page', () => {
    const result = restoreIndexedPageState(
      [pages[1], pages[0], pages[2], pages[3]],
      captured()
    );
    expect(result.selectedPages).toEqual(new Set([0, 3]));
    expect(result.splitMarkers).toEqual(new Set([0, 2]));
  });

  it('removes deleted identities and shifts the remaining markers', () => {
    const result = restoreIndexedPageState(
      [pages[0], pages[2], pages[3]],
      captured()
    );
    expect(result.selectedPages).toEqual(new Set([2]));
    expect(result.splitMarkers).toEqual(new Set([1]));
  });

  it('does not transfer selections or split markers onto inserted duplicates', () => {
    const result = restoreIndexedPageState(
      [pages[0], { id: 'copy' }, ...pages.slice(1)],
      captured()
    );
    expect(result.selectedPages).toEqual(new Set([2, 4]));
    expect(result.splitMarkers).toEqual(new Set([2, 3]));
  });
});
