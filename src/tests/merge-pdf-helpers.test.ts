import { describe, expect, it } from 'vitest';
import { isValidMergePageRange } from '../js/utils/merge-pdf-helpers';

describe('merge page selection validation', () => {
  it.each(['1', '1-3', '3, 1-2', ' 1, 3-5 ', '1,1'])(
    'accepts an explicit selection: %s',
    (value) => {
      expect(isValidMergePageRange(value, 5)).toBe(true);
    }
  );
  it.each([
    '',
    '0',
    '6',
    '3-1',
    '1-6',
    'abc',
    '1.5',
    '1-2-3',
    '1,',
    '1,,2',
    '-1',
    '1e0',
  ])('rejects invalid input instead of merging all pages: %s', (value) => {
    expect(isValidMergePageRange(value, 5)).toBe(false);
  });
});
