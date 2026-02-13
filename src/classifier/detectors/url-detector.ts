/**
 * UrlPatternDetector — detects page type from well-known URL patterns.
 * Confidence: 0.85–0.9 depending on specificity.
 */

import { PageType } from '../../types/capture';
import type { DetectionResult, PageDetector } from '../types';

interface UrlRule {
  pattern: RegExp;
  type: PageType;
  confidence: number;
}

const URL_RULES: UrlRule[] = [
  // Repositories
  { pattern: /github\.com\/[\w.-]+\/[\w.-]+\/?$/,            type: PageType.REPOSITORY, confidence: 0.9 },
  { pattern: /gitlab\.com\/[\w.-]+\/[\w.-]+\/?$/,            type: PageType.REPOSITORY, confidence: 0.9 },
  { pattern: /bitbucket\.org\/[\w.-]+\/[\w.-]+\/?$/,         type: PageType.REPOSITORY, confidence: 0.9 },
  { pattern: /codeberg\.org\/[\w.-]+\/[\w.-]+\/?$/,          type: PageType.REPOSITORY, confidence: 0.85 },

  // Video
  { pattern: /youtube\.com\/watch/,                          type: PageType.VIDEO, confidence: 0.9 },
  { pattern: /youtu\.be\//,                                  type: PageType.VIDEO, confidence: 0.9 },
  { pattern: /vimeo\.com\/\d+/,                              type: PageType.VIDEO, confidence: 0.9 },
  { pattern: /dailymotion\.com\/video\//,                    type: PageType.VIDEO, confidence: 0.85 },
  { pattern: /twitch\.tv\/videos\//,                         type: PageType.VIDEO, confidence: 0.85 },

  // Products
  { pattern: /amazon\.\w+\/.*\/dp\//,                        type: PageType.PRODUCT, confidence: 0.9 },
  { pattern: /ebay\.\w+\/itm\//,                             type: PageType.PRODUCT, confidence: 0.9 },
  { pattern: /etsy\.com\/listing\//,                         type: PageType.PRODUCT, confidence: 0.9 },
  { pattern: /shopify\.com\/products\//,                     type: PageType.PRODUCT, confidence: 0.85 },

  // Social posts
  { pattern: /(twitter\.com|x\.com)\/\w+\/status\/\d+/,     type: PageType.SOCIAL_POST, confidence: 0.9 },
  { pattern: /mastodon\.\w+\/@\w+\/\d+/,                    type: PageType.SOCIAL_POST, confidence: 0.85 },
  { pattern: /reddit\.com\/r\/\w+\/comments\//,              type: PageType.SOCIAL_POST, confidence: 0.85 },
  { pattern: /linkedin\.com\/posts\//,                       type: PageType.SOCIAL_POST, confidence: 0.85 },

  // Forum threads
  { pattern: /stackoverflow\.com\/questions\/\d+/,           type: PageType.FORUM_THREAD, confidence: 0.9 },
  { pattern: /stackexchange\.com\/questions\/\d+/,           type: PageType.FORUM_THREAD, confidence: 0.9 },
  { pattern: /discourse\.\w+\/t\//,                          type: PageType.FORUM_THREAD, confidence: 0.85 },
  { pattern: /news\.ycombinator\.com\/item\?id=/,            type: PageType.FORUM_THREAD, confidence: 0.85 },

  // Recipes
  { pattern: /allrecipes\.com\/recipe\//,                    type: PageType.RECIPE, confidence: 0.9 },
  { pattern: /food\.com\/recipe\//,                          type: PageType.RECIPE, confidence: 0.9 },
  { pattern: /epicurious\.com\/recipes\//,                   type: PageType.RECIPE, confidence: 0.9 },
  { pattern: /seriouseats\.com\/recipes\//,                  type: PageType.RECIPE, confidence: 0.85 },

  // Documentation (broader patterns — lower confidence)
  { pattern: /docs\.\w+\.\w+/,                              type: PageType.DOCUMENTATION, confidence: 0.75 },
  { pattern: /developer\.\w+\.\w+/,                         type: PageType.DOCUMENTATION, confidence: 0.7 },
  { pattern: /wiki\.\w+\.\w+/,                              type: PageType.DOCUMENTATION, confidence: 0.7 },
  { pattern: /readthedocs\.\w+/,                             type: PageType.DOCUMENTATION, confidence: 0.85 },
];

export class UrlPatternDetector implements PageDetector {
  readonly name = 'url-pattern';

  detect(_doc: Document, url: string): DetectionResult | null {
    for (const rule of URL_RULES) {
      if (rule.pattern.test(url)) {
        return { type: rule.type, confidence: rule.confidence };
      }
    }
    return null;
  }
}
