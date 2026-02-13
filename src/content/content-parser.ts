/**
 * ContentParser — extracts the main readable content from a page,
 * generates an excerpt, extracts keywords, and estimates reading time.
 */

import type { ContentSummary } from '../types/capture';
import { normalizeWhitespace, truncate } from '../utils/sanitizer';

/** Common English stop words to exclude from keyword extraction. */
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'this', 'that', 'these', 'those', 'is',
  'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'shall', 'should', 'may',
  'might', 'must', 'can', 'could', 'it', 'its', 'he', 'she', 'they',
  'we', 'you', 'i', 'me', 'my', 'your', 'their', 'our', 'him', 'her',
  'them', 'us', 'not', 'no', 'if', 'so', 'as', 'about', 'more', 'also',
  'just', 'than', 'then', 'when', 'what', 'which', 'who', 'how', 'all',
  'each', 'every', 'both', 'few', 'some', 'any', 'most', 'other', 'into',
  'over', 'after', 'before', 'between', 'under', 'above', 'such', 'only',
  'very', 'there', 'here', 'where', 'why', 'while', 'during', 'through',
  'because', 'since', 'until', 'although', 'though', 'even', 'still',
  'however', 'already', 'always', 'never', 'often', 'sometimes', 'like',
  'well', 'back', 'much', 'many', 'make', 'made', 'get', 'got', 'take',
  'took', 'come', 'came', 'want', 'need', 'use', 'used', 'using', 'new',
  'first', 'last', 'long', 'great', 'little', 'own', 'old', 'right',
  'big', 'high', 'different', 'small', 'large', 'next', 'early', 'young',
  'important', 'public', 'good', 'same', 'able', 'know', 'said', 'says',
]);

/** Average words-per-minute for reading estimation. */
const WPM = 200;

export class ContentParser {
  parseContent(): ContentSummary {
    const mainEl = this.findMainContent();
    const text = normalizeWhitespace(mainEl.textContent ?? '');
    const words = text.split(/\s+/).filter(Boolean);

    return {
      excerpt: this.generateExcerpt(text),
      keywords: this.extractKeywords(words),
      readingTimeMinutes: Math.max(1, Math.ceil(words.length / WPM)),
      wordCount: words.length,
    };
  }

  // ---- main content detection ----

  /**
   * Find the most likely "main content" element using a priority list
   * of selectors, with a fallback heuristic that picks the largest
   * text block in the body.
   */
  private findMainContent(): Element {
    const selectors = [
      'article',
      '[role="main"]',
      'main',
      '.post-content',
      '.article-content',
      '.entry-content',
      '.story-body',
      '#article-body',
      '#content',
      '.content',
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && this.wordCount(el) > 80) {
        return el;
      }
    }

    // Fallback: walk top-level children of body and pick the one
    // with the most text content (ignoring nav/header/footer/aside).
    return this.findLargestTextBlock();
  }

  private findLargestTextBlock(): Element {
    const candidates = document.querySelectorAll(
      'body > *:not(nav):not(header):not(footer):not(aside):not(script):not(style)',
    );
    let best: Element = document.body;
    let bestLen = 0;
    for (const el of candidates) {
      const len = this.wordCount(el);
      if (len > bestLen) {
        bestLen = len;
        best = el;
      }
    }
    return best;
  }

  // ---- excerpt ----

  private generateExcerpt(text: string): string {
    if (!text) return '';
    return truncate(text, 300);
  }

  // ---- keyword extraction ----

  /**
   * Simple frequency-based keyword extraction.
   * Returns the top 10 meaningful words by occurrence count.
   */
  private extractKeywords(words: string[]): string[] {
    const freq = new Map<string, number>();
    for (const raw of words) {
      const w = raw.toLowerCase().replace(/[^a-z0-9\-]/g, '');
      if (w.length < 4 || STOP_WORDS.has(w)) continue;
      freq.set(w, (freq.get(w) ?? 0) + 1);
    }

    return Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  // ---- helpers ----

  private wordCount(el: Element): number {
    return (el.textContent ?? '').split(/\s+/).filter(Boolean).length;
  }
}
