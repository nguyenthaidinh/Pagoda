interface IdentifiedPage {
  id: string;
}

export interface IndexedPageState {
  selectedPageIds: Set<string>;
  splitAfterPageIds: Set<string>;
}

function idsAtIndices(
  pages: readonly IdentifiedPage[],
  indices: ReadonlySet<number>
): Set<string> {
  const ids = new Set<string>();
  indices.forEach((index) => {
    const page = pages[index];
    if (page) ids.add(page.id);
  });
  return ids;
}

export function captureIndexedPageState(
  pages: readonly IdentifiedPage[],
  selectedPages: ReadonlySet<number>,
  splitMarkers: ReadonlySet<number>
): IndexedPageState {
  return {
    selectedPageIds: idsAtIndices(pages, selectedPages),
    splitAfterPageIds: idsAtIndices(pages, splitMarkers),
  };
}

export function restoreIndexedPageState(
  pages: readonly IdentifiedPage[],
  captured: IndexedPageState
): { selectedPages: Set<number>; splitMarkers: Set<number> } {
  const selectedPages = new Set<number>();
  const splitMarkers = new Set<number>();

  pages.forEach((page, index) => {
    if (captured.selectedPageIds.has(page.id)) selectedPages.add(index);
    if (captured.splitAfterPageIds.has(page.id)) splitMarkers.add(index);
  });

  return { selectedPages, splitMarkers };
}
