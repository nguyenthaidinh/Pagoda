import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import Sortable from 'sortablejs';
import { downloadFile, getPDFDocument } from '../js/utils/helpers';
import { loadPdfWithPasswordPrompt } from '../js/utils/password-prompt';
import { renderPageToCanvas } from '../js/utils/render-utils';

vi.mock('lucide', () => ({ createIcons: vi.fn(), icons: {} }));
vi.mock('heic2any', () => ({ default: vi.fn() }));
vi.mock('sortablejs', () => ({
  default: { create: vi.fn(() => ({ destroy: vi.fn() })) },
}));
vi.mock('../js/utils/helpers', () => ({
  downloadFile: vi.fn(),
  getPDFDocument: vi.fn(),
}));
vi.mock('../js/utils/password-prompt.js', () => ({
  loadPdfWithPasswordPrompt: vi.fn(),
}));
vi.mock('../js/utils/shortcuts-init.js', () => ({
  initializeGlobalShortcuts: vi.fn(),
}));
vi.mock('../js/logic/repair-pdf.js', () => ({
  repairPdfFile: vi.fn(async () => null),
}));
vi.mock('../js/utils/images-to-pdf-lib.js', () => ({
  convertImagesToPdfFile: vi.fn(),
}));
vi.mock('../js/utils/setup-pdf-worker.js', () => ({}));
vi.mock('../js/i18n/i18n', () => ({ t: (key: string) => key }));
vi.mock('../js/utils/render-utils', () => ({
  cleanupLazyRendering: vi.fn(),
  observePlaceholder: vi.fn(),
  renderPageToCanvas: vi.fn(async () => document.createElement('canvas')),
  renderPagesProgressively: vi.fn(async (pdf, container, wrap, config) => {
    for (let page = 1; page <= pdf.numPages; page++) {
      container.append(
        page <= 20
          ? wrap(document.createElement('canvas'), page)
          : config.createPlaceholder(page)
      );
    }
  }),
}));

describe('multi-tool controls and exported PDFs', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    document.body.innerHTML = `
      <div id="pages-container"></div><div id="upload-area"></div>
      <input id="pdf-file-input" type="file"><input id="insert-pdf-input" type="file">
      <button id="export-pdf-btn"></button><button id="bulk-download-btn"></button>
      <button id="select-all-btn"></button><button id="bulk-delete-btn"></button>
      <button id="undo-btn"></button><button id="reset-btn"></button>`;
    await import('../js/logic/pdf-multi-tool');
  });
  afterEach(() => {
    document.getElementById('reset-btn')?.click();
    vi.restoreAllMocks();
  });

  async function upload(pageCount: number) {
    const pdf = await PDFDocument.create();
    for (let i = 0; i < pageCount; i++) pdf.addPage([101 + i, 200]);
    const bytes = new Uint8Array(await pdf.save());
    const file = new File([bytes], 'source.pdf', { type: 'application/pdf' });
    Object.defineProperty(file, 'arrayBuffer', {
      value: async () => bytes.buffer.slice(0),
    });
    vi.mocked(loadPdfWithPasswordPrompt).mockResolvedValue({
      file,
      bytes: bytes.buffer,
      pdf: { destroy: vi.fn() },
    } as never);
    vi.mocked(getPDFDocument).mockReturnValue({
      promise: Promise.resolve({ numPages: pageCount, destroy: vi.fn() }),
    } as never);
    const input = document.getElementById('pdf-file-input') as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file],
    });
    input.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(cards()).toHaveLength(pageCount));
  }

  const cards = () =>
    Array.from(
      document.querySelectorAll<HTMLElement>('#pages-container > div')
    );
  const actions = (card: HTMLElement) =>
    card.querySelectorAll<HTMLButtonElement>(
      '.flex.items-center.gap-1 > button'
    );
  async function downloadedBytes() {
    await vi.waitFor(() => expect(downloadFile).toHaveBeenCalledOnce());
    const blob = vi.mocked(downloadFile).mock.calls[0][0] as Blob;
    if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer();
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = reject;
      reader.readAsArrayBuffer(blob);
    });
  }

  it('exports the selected page and split sections correctly after dragging', async () => {
    await upload(3);
    const [a, b] = cards();
    b.querySelector<HTMLButtonElement>('button.absolute')!.click();
    actions(b)[4].click();
    b.parentElement!.insertBefore(b, a);
    const onEnd = vi.mocked(Sortable.create).mock.calls.at(-1)![1]!.onEnd!;
    onEnd.call(
      {} as Sortable,
      { oldIndex: 1, newIndex: 0 } as Sortable.SortableEvent
    );
    expect(cards()[0].querySelector('.split-marker')).not.toBeNull();
    expect(cards()[1].querySelector('.split-marker')).toBeNull();
    document.getElementById('bulk-download-btn')!.click();
    const selected = await PDFDocument.load(await downloadedBytes());
    expect(selected.getPages().map((page) => page.getWidth())).toEqual([102]);
    vi.mocked(downloadFile).mockClear();
    document.getElementById('export-pdf-btn')!.click();
    const zip = await JSZip.loadAsync(await downloadedBytes());
    const widths = [];
    for (const file of Object.values(zip.files)) {
      const output = await PDFDocument.load(await file.async('uint8array'));
      widths.push(output.getPages().map((page) => page.getWidth()));
    }
    expect(widths).toEqual([[102], [101, 103]]);
  });

  it('duplicates an unrendered page and keeps undo working after deleting everything', async () => {
    await upload(21);
    expect(cards()[20].querySelector('canvas')).toBeNull();
    actions(cards()[20])[2].click();
    await vi.waitFor(() => expect(cards()).toHaveLength(22));
    expect(renderPageToCanvas).toHaveBeenCalledWith(expect.anything(), 21, 0.5);
    document.getElementById('select-all-btn')!.click();
    document.getElementById('bulk-delete-btn')!.click();
    expect(cards()).toHaveLength(0);
    document.getElementById('undo-btn')!.click();
    expect(cards()).toHaveLength(22);
    document.getElementById('export-pdf-btn')!.click();
    const result = await PDFDocument.load(await downloadedBytes());
    expect(result.getPages().map((page) => page.getWidth())).toEqual([
      ...Array.from({ length: 21 }, (_, i) => 101 + i),
      121,
    ]);
  });
});
