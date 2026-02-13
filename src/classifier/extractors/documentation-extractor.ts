/**
 * DocumentationExtractor — extracts metadata from documentation pages.
 */

import type { DocumentationFields } from '../../types/capture';
import type { TypeExtractor } from '../types';

export class DocumentationExtractor implements TypeExtractor {
  extract(doc: Document): DocumentationFields {
    return {
      sectionTitle: this.extractSectionTitle(doc),
      breadcrumb: this.extractBreadcrumb(doc),
      tableOfContents: this.extractTOC(doc),
      version: this.extractVersion(doc),
      framework: this.extractFramework(doc),
    };
  }

  private extractSectionTitle(doc: Document): string | undefined {
    return doc.querySelector('h1')?.textContent?.trim();
  }

  private extractBreadcrumb(doc: Document): string[] {
    const bcNav = doc.querySelector('[aria-label="breadcrumb"], .breadcrumb, .breadcrumbs, nav.crumbs');
    if (!bcNav) return [];
    const items = bcNav.querySelectorAll('a, li, span');
    return Array.from(items)
      .map((el) => el.textContent?.trim() ?? '')
      .filter(Boolean)
      // Remove duplicates from nested structures
      .filter((val, idx, arr) => arr.indexOf(val) === idx);
  }

  private extractTOC(doc: Document): Array<{ title: string; anchor: string }> {
    const tocContainer = doc.querySelector(
      '.toc, #toc, .table-of-contents, nav[aria-label*="table of contents"]',
    );
    if (!tocContainer) return [];

    const links = tocContainer.querySelectorAll('a[href^="#"]');
    return Array.from(links).map((a) => ({
      title: a.textContent?.trim() ?? '',
      anchor: (a as HTMLAnchorElement).getAttribute('href') ?? '',
    })).filter((entry) => entry.title);
  }

  private extractVersion(doc: Document): string | undefined {
    // Look for version selectors or badges
    const versionEl = doc.querySelector(
      'select[name*="version"] option[selected], .version-selector .current, .version-badge, [data-version]',
    );
    if (versionEl) {
      return versionEl.textContent?.trim() ?? versionEl.getAttribute('data-version') ?? undefined;
    }
    // Look for version in title
    const match = doc.title.match(/v?([\d]+\.[\d]+(?:\.[\d]+)?)/);
    return match?.[0];
  }

  private extractFramework(doc: Document): string | undefined {
    // Common doc platform identifiers
    const generators = doc.querySelector('meta[name="generator"]')?.getAttribute('content');
    if (generators) return generators;

    // Check title for known frameworks
    const title = doc.title.toLowerCase();
    const frameworks = ['react', 'vue', 'angular', 'svelte', 'next.js', 'django', 'flask', 'rails', 'express'];
    return frameworks.find((f) => title.includes(f));
  }
}
