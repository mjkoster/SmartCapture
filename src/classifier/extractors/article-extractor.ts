/**
 * ArticleExtractor — extracts article-specific metadata.
 */

import type { ArticleFields } from '../../types/capture';
import type { TypeExtractor } from '../types';
import { getMeta, getJsonLd, nestedString } from './base-extractor';

export class ArticleExtractor implements TypeExtractor {
  extract(doc: Document): ArticleFields {
    const ld = getJsonLd(doc, 'Article')
      ?? getJsonLd(doc, 'NewsArticle')
      ?? getJsonLd(doc, 'BlogPosting');

    return {
      author:
        this.resolveAuthor(ld) ??
        getMeta(doc, 'name', 'author') ??
        doc.querySelector('[rel="author"]')?.textContent?.trim(),
      publishedDate:
        (ld?.datePublished as string | undefined) ??
        getMeta(doc, 'property', 'article:published_time'),
      modifiedDate:
        (ld?.dateModified as string | undefined) ??
        getMeta(doc, 'property', 'article:modified_time'),
      section:
        getMeta(doc, 'property', 'article:section'),
      publisher:
        nestedString(ld, 'publisher', 'name') ??
        getMeta(doc, 'property', 'og:site_name'),
      readingTimeMinutes: this.estimateReadingTime(doc),
    };
  }

  private resolveAuthor(ld: Record<string, unknown> | null): string | undefined {
    if (!ld?.author) return undefined;
    const author = ld.author;
    if (typeof author === 'string') return author;
    if (Array.isArray(author)) {
      return author.map((a) => (typeof a === 'object' ? (a as Record<string, unknown>).name : a)).join(', ') as string;
    }
    if (typeof author === 'object') {
      return (author as Record<string, unknown>).name as string | undefined;
    }
    return undefined;
  }

  private estimateReadingTime(doc: Document): number {
    const main = doc.querySelector('article, main, [role="main"]');
    const words = (main?.textContent ?? '').split(/\s+/).length;
    return Math.max(1, Math.ceil(words / 200));
  }
}
