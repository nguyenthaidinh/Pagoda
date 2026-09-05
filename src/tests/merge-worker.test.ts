// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createContext, runInContext, type Context } from 'node:vm';
import { webcrypto } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import type { MergeJob } from '@/types';

describe('merge worker with the bundled CoherentPDF engine', () => {
  let context: Context;
  const postMessage = vi.fn();
  let a: Uint8Array;
  let b: Uint8Array;

  beforeAll(async () => {
    context = createContext({
      console,
      Uint8Array,
      ArrayBuffer,
      TextEncoder,
      TextDecoder,
      crypto: webcrypto,
      setTimeout,
      clearTimeout,
      postMessage,
    });
    context.self = context;
    runInContext(
      readFileSync('public/coherentpdf.browser.min.js', 'utf8'),
      context
    );
    runInContext(
      readFileSync('public/workers/merge.worker.js', 'utf8'),
      context
    );
    const first = await PDFDocument.create();
    first.addPage([101, 200]);
    first.addPage([102, 200]);
    const second = await PDFDocument.create();
    second.addPage([201, 200]);
    a = await first.save();
    b = await second.save();
  });
  beforeEach(() => postMessage.mockClear());

  async function merge(jobs: MergeJob[]) {
    await context.onmessage({
      data: {
        command: 'merge',
        cpdfUrl: '/coherentpdf.browser.min.js',
        jobs,
        files: [
          { name: 'a', data: a.buffer },
          { name: 'b', data: b.buffer },
        ],
      },
    });
    return postMessage.mock.calls.at(-1)![0];
  }

  it('writes the selected pages in the exact requested order', async () => {
    const result = await merge([
      { fileName: 'b', rangeType: 'all' },
      { fileName: 'a', rangeType: 'specific', rangeString: '2,1' },
    ]);
    expect(result.status).toBe('success');
    const output = await PDFDocument.load(result.pdfBytes);
    expect(output.getPages().map((page) => page.getWidth())).toEqual([
      201, 102, 101,
    ]);
  });

  it('returns an error for malformed ranges instead of including every page', async () => {
    const result = await merge([
      { fileName: 'a', rangeType: 'specific', rangeString: 'nonsense' },
    ]);
    expect(result.status).toBe('error');
    expect(result.pdfBytes).toBeUndefined();
    expect(result.message).toContain('Invalid page range');
  });

  it('can merge again after a failed operation', async () => {
    await merge([{ fileName: 'missing', rangeType: 'all' }]);
    const result = await merge([
      { fileName: 'a', rangeType: 'single', pageIndex: 0 },
    ]);
    expect(result.status).toBe('success');
    expect((await PDFDocument.load(result.pdfBytes)).getPageCount()).toBe(1);
  });
});
