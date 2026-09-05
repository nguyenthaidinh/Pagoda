import type { BookmarkTarget } from '../types/bookmark-pdf-type.js';

export function sanitizeBookmarkTarget(
  value: unknown
): BookmarkTarget | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const target = value as Record<string, unknown>;
  if (target.kind === 'uri' && typeof target.url === 'string') {
    try {
      const url = new URL(target.url);
      if (
        !['http:', 'https:', 'ftp:', 'mailto:', 'tel:'].includes(url.protocol)
      )
        return undefined;
      return {
        kind: 'uri',
        url: target.url,
        newWindow: target.newWindow === true,
      };
    } catch {
      return undefined;
    }
  }
  const counts: Record<string, number> = {
    XYZ: 3,
    Fit: 0,
    FitH: 1,
    FitV: 1,
    FitR: 4,
    FitB: 0,
    FitBH: 1,
    FitBV: 1,
  };
  if (
    target.kind !== 'destination' ||
    typeof target.type !== 'string' ||
    !Object.hasOwn(counts, target.type) ||
    !Array.isArray(target.args) ||
    target.args.length !== counts[target.type] ||
    !target.args.every(
      (v) => v === null || (typeof v === 'number' && Number.isFinite(v))
    )
  )
    return undefined;
  return { kind: 'destination', type: target.type, args: [...target.args] };
}
