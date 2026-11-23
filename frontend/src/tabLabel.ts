/** BR1.7: the tab label follows the Release Header date (mirrors the backend rule). */
export function tabLabel(headerDate: string | null | undefined, fallback = ''): string {
  return headerDate && headerDate.trim() !== '' ? headerDate : fallback;
}
