/**
 * DOM and text sanitization utilities.
 */

/** Escape HTML entities for safe display. */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (c) => map[c] ?? c);
}

/** Strip all HTML tags from a string. */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

/**
 * Truncate text to maxLen characters, breaking at the last word boundary
 * and appending an ellipsis.
 */
export function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const truncated = text.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(' ');
  const breakPoint = lastSpace > maxLen * 0.6 ? lastSpace : maxLen;
  return truncated.slice(0, breakPoint).trimEnd() + '\u2026';
}

/** Collapse multiple whitespace characters into single spaces. */
export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}
