import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { refreshMergeUI, merge } from '../js/logic/merge-pdf-page';
import { state } from '../js/state';
import { getDocument } from 'pdfjs-dist';
import { renderPagesProgressively } from '../js/utils/render-utils';
import { showAlert } from '../js/ui';

const worker = vi.hoisted(() => ({
  postMessage: vi.fn(),
  onmessage: null as null | ((e: { data: object }) => void),
  onerror: null as null | ((e: object) => void),
}));
vi.hoisted(() => {
  globalThis.Worker = class {
    constructor() {
      return worker;
    }
  } as unknown as typeof Worker;
});
vi.mock('pdfjs-dist', () => ({ getDocument: vi.fn() }));
vi.mock('lucide', () => ({ createIcons: vi.fn(), icons: {} }));
vi.mock('sortablejs', () => ({
  default: { create: vi.fn(() => ({ destroy: vi.fn() })) },
}));
vi.mock('../js/ui.js', () => ({
  showLoader: vi.fn(),
  hideLoader: vi.fn(),
  showAlert: vi.fn(),
}));
vi.mock('../js/utils/helpers.js', () => ({ downloadFile: vi.fn() }));
vi.mock('../js/state.js', () => ({ state: { files: [] } }));
vi.mock('../js/utils/password-prompt.js', () => ({
  batchDecryptIfNeeded: vi.fn(async (files) => files),
}));
vi.mock('../js/utils/page-preview.js', () => ({ initPagePreview: vi.fn() }));
vi.mock('../js/utils/setup-pdf-worker.js', () => ({}));
vi.mock('../js/utils/cpdf-helper.js', () => ({ isCpdfAvailable: () => true }));
vi.mock('../js/utils/wasm-provider.js', () => ({
  WasmProvider: { getUrl: () => '/engine/' },
  showWasmRequiredDialog: vi.fn(),
}));
vi.mock('../js/i18n/i18n', () => ({ t: (key: string) => key }));
vi.mock('../js/utils/render-utils.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../js/utils/render-utils')>();
  return {
    ...actual,
    renderPagesProgressively: vi.fn(async (pdf, container, _wrap, config) => {
      for (let n = 1; n <= pdf.numPages; n++)
        container.append(config.createPlaceholder(n));
    }),
  };
});

describe('merge page operation', () => {
  let source: ArrayBuffer;
  beforeEach(async () => {
    vi.clearAllMocks();
    document.body.innerHTML = `
      <button id="process-btn"></button><button id="file-mode-btn"></button><button id="page-mode-btn"></button>
      <div id="file-mode-panel"></div><div id="page-mode-panel"></div>
      <ul id="file-list"></ul><div id="page-merge-preview"></div>`;
    source = new Uint8Array([37, 80, 68, 70]).buffer;
    state.files = [
      {
        name: 'first.pdf',
        size: 4,
        lastModified: 1,
        arrayBuffer: async () => source,
      } as File,
    ];
    vi.mocked(getDocument).mockReturnValue({
      promise: Promise.resolve({ numPages: 50 }),
    } as never);
    await refreshMergeUI();
    document.getElementById('file-mode-btn')!.click();
  });
  afterEach(() => {
    worker.onmessage?.({ data: { status: 'error', message: 'Test cleanup' } });
  });

  it('does not start a merge when a requested page does not exist', async () => {
    (document.querySelector('#file-list input') as HTMLInputElement).value =
      '51';
    await merge();
    expect(worker.postMessage).not.toHaveBeenCalled();
    expect(showAlert).toHaveBeenCalledWith(
      'common.error',
      'tools:mergePdf.invalidPageRange'
    );
    expect(
      (document.getElementById('process-btn') as HTMLButtonElement).disabled
    ).toBe(false);
  });

  it('transfers copies of source data, blocks concurrent merges and allows retry', async () => {
    await merge();
    const [message, transfer] = worker.postMessage.mock.calls[0];
    expect(message.files[0].data).not.toBe(source);
    expect(transfer).not.toContain(source);
    await merge();
    expect(worker.postMessage).toHaveBeenCalledTimes(1);
    worker.onmessage!({ data: { status: 'error', message: 'Retry' } });
    await merge();
    expect(worker.postMessage).toHaveBeenCalledTimes(2);
    expect(worker.postMessage.mock.calls[1][0].files[0].data.byteLength).toBe(
      4
    );
  });

  it('includes every page even before its thumbnail has rendered', async () => {
    document.getElementById('page-mode-btn')!.click();
    await vi.waitFor(() => expect(renderPagesProgressively).toHaveBeenCalled());
    await merge();
    expect(worker.postMessage).toHaveBeenCalledOnce();
    expect(worker.postMessage.mock.calls[0][0].jobs).toEqual([
      {
        fileName: '0_first.pdf',
        rangeType: 'range',
        startPage: 1,
        endPage: 50,
      },
    ]);
  });
});
