import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import {
  cleanupLazyRendering,
  renderPagesProgressively,
} from '../js/utils/render-utils';

vi.mock('../js/utils/setup-pdf-worker.js', () => ({}));

describe('progressive PDF previews', () => {
  type ObserverCallback = ConstructorParameters<typeof IntersectionObserver>[0];
  let callback: ObserverCallback;
  const observer = {
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  };
  let container: HTMLElement;

  beforeEach(() => {
    cleanupLazyRendering();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: ObserverCallback) {
          callback = cb;
        }
        observe = observer.observe;
        unobserve = observer.unobserve;
        disconnect = observer.disconnect;
      }
    );
    vi.stubGlobal('requestIdleCallback', (cb: () => void) => {
      cb();
      return 0;
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      {} as CanvasRenderingContext2D
    );
    container = document.createElement('div');
    document.body.append(container);
  });
  afterEach(() => {
    cleanupLazyRendering();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function makeDoc() {
    return {
      numPages: 21,
      getPage: vi.fn(async () => ({
        getViewport: () => ({ width: 100, height: 200 }),
        render: () => ({ promise: Promise.resolve() }),
      })),
    } as unknown as PDFDocumentProxy;
  }
  const wrapper =
    (name: string) => (_canvas: HTMLCanvasElement, page: number) => {
      const card = document.createElement('div');
      card.textContent = `${name}:${page}`;
      return card;
    };
  function intersect(...elements: Element[]) {
    callback(
      elements.map((target) => ({
        target,
        isIntersecting: true,
      })) as IntersectionObserverEntry[],
      observer as unknown as IntersectionObserver
    );
  }

  it('renders equal page numbers from different PDFs using their own documents', async () => {
    const a = makeDoc();
    const b = makeDoc();
    const config = { eagerLoadBatches: 0 };
    await renderPagesProgressively(a, container, wrapper('A'), config);
    const firstPlaceholder = container.lastElementChild!;
    await renderPagesProgressively(b, container, wrapper('B'), config);
    const secondPlaceholder = container.lastElementChild!;
    container.prepend(firstPlaceholder);
    intersect(firstPlaceholder, secondPlaceholder);
    await vi.waitFor(() =>
      expect(container.firstElementChild?.textContent).toBe('A:21')
    );
    expect(container.lastElementChild?.textContent).toBe('B:21');
    expect(container.children).toHaveLength(42);
    expect(a.getPage).toHaveBeenLastCalledWith(21);
    expect(b.getPage).toHaveBeenLastCalledWith(21);
  });

  it('does not resurrect a page removed during asynchronous rendering', async () => {
    const doc = makeDoc();
    await renderPagesProgressively(doc, container, wrapper('A'), {
      eagerLoadBatches: 0,
    });
    const placeholder = container.lastElementChild!;
    let complete!: () => void;
    const rendered = new Promise<void>((resolve) => {
      complete = resolve;
    });
    vi.mocked(doc.getPage).mockResolvedValueOnce({
      getViewport: () => ({ width: 100, height: 200 }),
      render: () => ({ promise: rendered }),
    } as never);
    intersect(placeholder);
    await Promise.resolve();
    placeholder.remove();
    complete();
    await rendered;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(container.children).toHaveLength(20);
    expect(container.textContent).not.toContain('A:21');
  });
});
