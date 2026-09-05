export function isValidMergePageRange(
  input: string,
  totalPages: number
): boolean {
  const value = input.trim();
  if (!value || !Number.isSafeInteger(totalPages) || totalPages < 1)
    return false;

  return value.split(',').every((part) => {
    const bounds = part.trim().split('-');
    if (bounds.length > 2 || !bounds.every((bound) => /^\d+$/.test(bound)))
      return false;
    const [start, end = start] = bounds.map(Number);
    return start >= 1 && end >= start && end <= totalPages;
  });
}
