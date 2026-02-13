/**
 * MetadataExtractor — extracts page-level metadata from the DOM.
 *
 * Pulls from multiple sources in priority order:
 *   1. Open Graph meta tags
 *   2. Twitter Card meta tags
 *   3. Standard HTML meta / link elements
 *   4. Document properties (title, lang, charset)
 */

import type { PageBasics } from '../types/capture';

export class MetadataExtractor {
  extract(): PageBasics {
    return {
      title: this.extractTitle(),
      description: this.extractDescription(),
      favicon: this.extractFavicon(),
      url: window.location.href,
      canonicalUrl: this.extractCanonicalUrl(),
      author: this.extractAuthor(),
      publishedDate: this.extractPublishedDate(),
      ogImage: this.getMeta('property', 'og:image'),
      ogType: this.getMeta('property', 'og:type'),
      ogSiteName: this.getMeta('property', 'og:site_name'),
      language: document.documentElement.lang || undefined,
      charset: this.extractCharset(),
    };
  }

  // ---- title ----

  private extractTitle(): string {
    return (
      this.getMeta('property', 'og:title') ??
      this.getMeta('name', 'twitter:title') ??
      document.title ??
      ''
    );
  }

  // ---- description ----

  private extractDescription(): string | undefined {
    return (
      this.getMeta('property', 'og:description') ??
      this.getMeta('name', 'twitter:description') ??
      this.getMeta('name', 'description')
    );
  }

  // ---- favicon ----

  private extractFavicon(): string | undefined {
    // Try several link rel variants
    const selectors = [
      'link[rel="icon"]',
      'link[rel="shortcut icon"]',
      'link[rel="apple-touch-icon"]',
    ];
    for (const sel of selectors) {
      const link = document.querySelector(sel) as HTMLLinkElement | null;
      if (link?.href) {
        try {
          return new URL(link.href, window.location.href).href;
        } catch {
          // skip malformed
        }
      }
    }
    // Default /favicon.ico
    try {
      return new URL('/favicon.ico', window.location.origin).href;
    } catch {
      return undefined;
    }
  }

  // ---- canonical URL ----

  private extractCanonicalUrl(): string | undefined {
    const link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    return link?.href || undefined;
  }

  // ---- author ----

  private extractAuthor(): string | undefined {
    return (
      this.getMeta('name', 'author') ??
      this.getMeta('property', 'article:author') ??
      document.querySelector('[rel="author"]')?.textContent?.trim() ??
      undefined
    );
  }

  // ---- published date ----

  private extractPublishedDate(): string | undefined {
    return (
      this.getMeta('property', 'article:published_time') ??
      this.getMeta('name', 'publish_date') ??
      this.getMeta('name', 'date') ??
      this.extractDateFromJsonLd()
    );
  }

  // ---- charset ----

  private extractCharset(): string {
    const meta = document.querySelector('meta[charset]');
    return (meta?.getAttribute('charset') ?? 'utf-8').toLowerCase();
  }

  // ---- helpers ----

  /**
   * Read a <meta> tag by attribute name and value.
   * e.g. getMeta('property', 'og:title') reads <meta property="og:title" content="...">
   */
  private getMeta(attr: string, value: string): string | undefined {
    const el = document.querySelector(`meta[${attr}="${value}"]`);
    return el?.getAttribute('content') || undefined;
  }

  /** Try to find a datePublished in JSON-LD blocks. */
  private extractDateFromJsonLd(): string | undefined {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent || '{}');
        if (data.datePublished) return data.datePublished as string;
      } catch {
        // ignore parse errors
      }
    }
    return undefined;
  }
}
