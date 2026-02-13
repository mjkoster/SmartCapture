/**
 * SchemaOrgDetector — detects page type from JSON-LD / schema.org blocks.
 * Highest-confidence detector (0.95) because structured data is authoritative.
 */

import { PageType } from '../../types/capture';
import type { DetectionResult, PageDetector } from '../types';

/** Map schema.org @type values (lowercased) to our PageType enum. */
const SCHEMA_TYPE_MAP: Record<string, PageType> = {
  article: PageType.ARTICLE,
  newsarticle: PageType.ARTICLE,
  blogposting: PageType.ARTICLE,
  technicalarticle: PageType.ARTICLE,
  scholarlyarticle: PageType.ARTICLE,
  report: PageType.ARTICLE,
  product: PageType.PRODUCT,
  videoobject: PageType.VIDEO,
  recipe: PageType.RECIPE,
  softwaresourcecode: PageType.REPOSITORY,
  softwareapplication: PageType.REPOSITORY,
  howto: PageType.DOCUMENTATION,
  qapage: PageType.FORUM_THREAD,
  discussionforumposting: PageType.FORUM_THREAD,
  socialmediaposting: PageType.SOCIAL_POST,
};

export class SchemaOrgDetector implements PageDetector {
  readonly name = 'schema.org';

  detect(doc: Document): DetectionResult | null {
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]');

    for (const script of scripts) {
      try {
        const data = JSON.parse(script.textContent ?? '{}');
        const result = this.resolveType(data);
        if (result) return result;
      } catch {
        // malformed JSON — skip
      }
    }

    return null;
  }

  private resolveType(data: Record<string, unknown>): DetectionResult | null {
    // Handle @graph arrays
    if (Array.isArray(data['@graph'])) {
      for (const item of data['@graph']) {
        const result = this.matchType(item);
        if (result) return result;
      }
      return null;
    }

    return this.matchType(data);
  }

  private matchType(data: Record<string, unknown>): DetectionResult | null {
    const rawType = data['@type'];
    if (!rawType) return null;

    // @type can be a string or an array
    const types = Array.isArray(rawType) ? rawType : [rawType];

    for (const t of types) {
      if (typeof t !== 'string') continue;
      const mapped = SCHEMA_TYPE_MAP[t.toLowerCase()];
      if (mapped) {
        return { type: mapped, confidence: 0.95 };
      }
    }

    return null;
  }
}
