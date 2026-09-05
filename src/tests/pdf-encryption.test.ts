import { describe, expect, it, vi } from 'vitest';
import type { DocumentInitParameters } from 'pdfjs-dist/types/src/display/api';
import { getPDFDocument } from '../js/utils/helpers';
import { isPdfPasswordProtected } from '../js/utils/pdf-encryption';

vi.mock('../js/utils/helpers.js', () => ({ getPDFDocument: vi.fn() }));

describe('PDF password probe', () => {
  it('resolves the password prompt even though PDF.js is waiting for input', async () => {
    const task = {
      onPassword: undefined as undefined | (() => void),
      promise: new Promise(() => {}),
      destroy: vi.fn(async () => {}),
    };
    vi.mocked(getPDFDocument).mockReturnValue(
      task as unknown as ReturnType<typeof getPDFDocument>
    );
    const bytes = new ArrayBuffer(4);
    const result = isPdfPasswordProtected(bytes);
    task.onPassword!();
    await expect(result).resolves.toBe(true);
    expect(task.destroy).toHaveBeenCalledOnce();
    expect(
      (
        vi
          .mocked(getPDFDocument)
          .mock.calls.at(-1)![0] as DocumentInitParameters
      ).data
    ).not.toBe(bytes);
  });

  it('releases an unprotected document after detection', async () => {
    const destroy = vi.fn(async () => {});
    vi.mocked(getPDFDocument).mockReturnValue({
      promise: Promise.resolve({ destroy }),
    } as unknown as ReturnType<typeof getPDFDocument>);
    await expect(isPdfPasswordProtected(new ArrayBuffer(4))).resolves.toBe(
      false
    );
    expect(destroy).toHaveBeenCalledOnce();
  });
});
