export type PageSlot = number | 'gap';

/**
 * Page numbers to show around the current page, with gaps: 1 … 4 5 6 … 20.
 * Always includes the first and the last page.
 */
export function pageSlots(current: number, total: number, siblings = 1): PageSlot[] {
  if (total <= 0) return [];
  const windowSize = siblings * 2 + 5;
  if (total <= windowSize) return Array.from({ length: total }, (_, i) => i + 1);
  const start = Math.max(2, current - siblings);
  const end = Math.min(total - 1, current + siblings);
  const slots: PageSlot[] = [1];
  if (start > 2) slots.push('gap');
  for (let page = start; page <= end; page += 1) slots.push(page);
  if (end < total - 1) slots.push('gap');
  slots.push(total);
  return slots;
}
