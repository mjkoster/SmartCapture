/**
 * RepositoryExtractor — extracts metadata from source code repository pages
 * (GitHub, GitLab, etc.).
 */

import type { RepositoryFields } from '../../types/capture';
import type { TypeExtractor } from '../types';
import { getMeta } from './base-extractor';

export class RepositoryExtractor implements TypeExtractor {
  extract(doc: Document, url: string): RepositoryFields {
    // Try to parse owner/name from URL path
    const { owner, name } = this.parseRepoUrl(url);

    return {
      name,
      owner,
      fullName: owner && name ? `${owner}/${name}` : undefined,
      description: this.extractDescription(doc),
      stars: this.extractNumber(doc, '[id="repo-stars-counter-star"]') ??
             this.extractNumber(doc, '.social-count'),
      forks: this.extractNumber(doc, '[id="repo-network-counter"]'),
      language: this.extractLanguage(doc),
      license: this.extractLicense(doc),
      topics: this.extractTopics(doc),
    };
  }

  private parseRepoUrl(url: string): { owner?: string; name?: string } {
    const match = url.match(
      /(?:github\.com|gitlab\.com|bitbucket\.org|codeberg\.org)\/([\w.-]+)\/([\w.-]+)/,
    );
    if (!match) return {};
    return { owner: match[1], name: match[2] };
  }

  private extractDescription(doc: Document): string | undefined {
    return getMeta(doc, 'property', 'og:description') ??
      doc.querySelector('[itemprop="about"], .repository-description, .f4')?.textContent?.trim();
  }

  private extractLanguage(doc: Document): string | undefined {
    // GitHub shows primary language with a colored circle
    return doc.querySelector('[itemprop="programmingLanguage"], .repo-language-color + span')?.textContent?.trim();
  }

  private extractLicense(doc: Document): string | undefined {
    // GitHub license badge area
    const licenseEl = doc.querySelector('[data-analytics-event*="license"], .octicon-law');
    return licenseEl?.parentElement?.textContent?.trim();
  }

  private extractTopics(doc: Document): string[] {
    const topicEls = doc.querySelectorAll('.topic-tag, [data-octo-click="topic_click"]');
    return Array.from(topicEls)
      .map((el) => el.textContent?.trim() ?? '')
      .filter(Boolean);
  }

  private extractNumber(doc: Document, selector: string): number | undefined {
    const el = doc.querySelector(selector);
    if (!el) return undefined;
    const text = el.textContent?.trim().replace(/,/g, '') ?? '';
    // Handle "1.2k" style numbers
    const kMatch = text.match(/([\d.]+)k/i);
    if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1000);
    const n = parseInt(text, 10);
    return isNaN(n) ? undefined : n;
  }
}
