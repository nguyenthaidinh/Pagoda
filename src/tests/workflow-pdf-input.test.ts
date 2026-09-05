import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import {
  PDFInputNode,
  EncryptedPDFError,
} from '../js/workflow/nodes/pdf-input-node';
import { isPdfPasswordProtected } from '../js/utils/pdf-encryption';
import { loadPdfDocument } from '../js/utils/load-pdf-document';
import { decryptPdfBytes } from '../js/utils/pdf-decrypt';

vi.mock('../js/utils/helpers.js', () => ({
  readFileAsArrayBuffer: vi.fn(async () => new Uint8Array([1, 2, 3]).buffer),
}));
vi.mock('../js/utils/pdf-encryption.js', () => ({
  isPdfPasswordProtected: vi.fn(),
}));
vi.mock('../js/utils/load-pdf-document.js', () => ({
  loadPdfDocument: vi.fn(),
}));
vi.mock('../js/utils/pdf-decrypt.js', () => ({ decryptPdfBytes: vi.fn() }));

describe('workflow PDF input', () => {
  const file = new File(['encrypted content'], 'input.pdf', {
    type: 'application/pdf',
  });
  beforeEach(() => vi.resetAllMocks());

  it('requests a password before encrypted streams can enter the workflow', async () => {
    vi.mocked(isPdfPasswordProtected).mockResolvedValue(true);
    const node = new PDFInputNode();
    await expect(node.addFile(file)).rejects.toBeInstanceOf(EncryptedPDFError);
    expect(loadPdfDocument).not.toHaveBeenCalled();
    expect(node.hasFile()).toBe(false);
  });

  it('rejects unreadable files without reporting them as password-protected', async () => {
    vi.mocked(isPdfPasswordProtected).mockResolvedValue(false);
    vi.mocked(loadPdfDocument).mockRejectedValue(new Error('Invalid PDF'));
    const node = new PDFInputNode();
    await expect(node.addFile(file)).rejects.not.toBeInstanceOf(
      EncryptedPDFError
    );
    expect(node.hasFile()).toBe(false);
  });

  it('decrypts owner-restricted PDFs that open with an empty user password', async () => {
    vi.mocked(isPdfPasswordProtected).mockResolvedValue(false);
    const decryptedDoc = await PDFDocument.create();
    const decryptedBytes = new Uint8Array(await decryptedDoc.save());
    vi.mocked(loadPdfDocument)
      .mockResolvedValueOnce({ isEncrypted: true } as PDFDocument)
      .mockResolvedValueOnce(decryptedDoc);
    vi.mocked(decryptPdfBytes).mockResolvedValue({
      bytes: decryptedBytes,
      engine: 'cpdf',
    });
    const node = new PDFInputNode();
    await node.addFile(file);
    expect(decryptPdfBytes).toHaveBeenCalledWith(expect.any(Uint8Array), '');
    expect((await node.data({})).pdf).toMatchObject({
      bytes: decryptedBytes,
      document: decryptedDoc,
    });
  });

  it('accepts an ordinary PDF without running decryption', async () => {
    vi.mocked(isPdfPasswordProtected).mockResolvedValue(false);
    vi.mocked(loadPdfDocument).mockResolvedValue(await PDFDocument.create());
    const node = new PDFInputNode();
    await node.addFile(file);
    expect(node.getFileCount()).toBe(1);
    expect(decryptPdfBytes).not.toHaveBeenCalled();
  });
});
