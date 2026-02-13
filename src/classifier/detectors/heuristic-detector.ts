/**
 * HeuristicDetector — detects page type from DOM signals.
 * Lowest priority; max confidence 0.8.
 * Counts indicator signals for each page type and picks the strongest match.
 */

import { PageType } from '../../types/capture';
import type { DetectionResult, PageDetector } from '../types';

type ScoreFn = (doc: Document) => number;

const SCORERS: Array<{ type: PageType; score: ScoreFn }> = [
  { type: PageType.ARTICLE, score: scoreArticle },
  { type: PageType.PRODUCT, score: scoreProduct },
  { type: PageType.VIDEO, score: scoreVideo },
  { type: PageType.RECIPE, score: scoreRecipe },
  { type: PageType.DOCUMENTATION, score: scoreDocumentation },
  { type: PageType.FORUM_THREAD, score: scoreForumThread },
];

// ---------------------------------------------------------------------------
// Scoring functions — each returns a weighted signal count (0+)
// ---------------------------------------------------------------------------

function scoreArticle(doc: Document): number {
  let s = 0;
  if (doc.querySelector('article')) s += 2;
  if (doc.querySelector('[itemprop="articleBody"]')) s += 2;
  if (doc.querySelector('time[datetime]')) s += 1;
  if (doc.querySelector('[itemprop="author"], [rel="author"]')) s += 1;
  if (doc.querySelector('meta[property="article:published_time"]')) s += 1;
  // Long-form text body is a good indicator
  const main = doc.querySelector('article, main, [role="main"]');
  if (main && (main.textContent?.split(/\s+/).length ?? 0) > 500) s += 1;
  return s;
}

function scoreProduct(doc: Document): number {
  let s = 0;
  if (doc.querySelector('[itemprop="price"]')) s += 2;
  if (doc.querySelector('[itemprop="priceCurrency"]')) s += 1;
  if (doc.querySelector('[itemprop="aggregateRating"], [itemprop="ratingValue"]')) s += 2;
  if (doc.querySelector('[data-product-id], [data-sku]')) s += 1;
  // "Add to cart" buttons
  const buttons = doc.querySelectorAll('button, [role="button"]');
  for (const btn of buttons) {
    const text = btn.textContent?.toLowerCase() ?? '';
    if (text.includes('add to cart') || text.includes('buy now')) {
      s += 2;
      break;
    }
  }
  return s;
}

function scoreVideo(doc: Document): number {
  let s = 0;
  if (doc.querySelector('video')) s += 2;
  if (doc.querySelector('iframe[src*="youtube"], iframe[src*="vimeo"]')) s += 2;
  if (doc.querySelector('[itemprop="duration"]')) s += 2;
  if (doc.querySelector('[itemprop="uploadDate"]')) s += 1;
  if (doc.querySelector('[itemprop="thumbnailUrl"]')) s += 1;
  return s;
}

function scoreRecipe(doc: Document): number {
  let s = 0;
  if (doc.querySelector('[itemprop="recipeIngredient"]')) s += 3;
  if (doc.querySelector('[itemprop="recipeInstructions"]')) s += 3;
  if (doc.querySelector('[itemprop="prepTime"]')) s += 1;
  if (doc.querySelector('[itemprop="cookTime"]')) s += 1;
  if (doc.querySelector('[itemprop="recipeYield"]')) s += 1;
  return s;
}

function scoreDocumentation(doc: Document): number {
  let s = 0;
  // Sidebar navigation
  if (doc.querySelector('nav.sidebar, .docs-sidebar, .toc, #toc')) s += 2;
  // Breadcrumbs
  if (doc.querySelector('[aria-label="breadcrumb"], .breadcrumb')) s += 1;
  // Code blocks
  const codeBlocks = doc.querySelectorAll('pre > code, .highlight, .codehilite');
  if (codeBlocks.length >= 2) s += 2;
  // Version selector
  if (doc.querySelector('select[name*="version"], .version-selector')) s += 1;
  return s;
}

function scoreForumThread(doc: Document): number {
  let s = 0;
  // Multiple "answer" or "comment" blocks
  const answers = doc.querySelectorAll(
    '.answer, .comment, [itemprop="suggestedAnswer"], [itemprop="acceptedAnswer"]',
  );
  if (answers.length >= 2) s += 3;
  // Vote counts
  if (doc.querySelector('.vote-count, [itemprop="upvoteCount"]')) s += 2;
  // Question tags
  if (doc.querySelector('.post-tag, .tag-list')) s += 1;
  return s;
}

// ---------------------------------------------------------------------------
// Detector
// ---------------------------------------------------------------------------

/** Minimum raw score to consider a match. */
const MIN_SCORE = 3;

export class HeuristicDetector implements PageDetector {
  readonly name = 'heuristic';

  detect(doc: Document): DetectionResult | null {
    let bestType: PageType = PageType.UNKNOWN;
    let bestScore = 0;

    for (const { type, score } of SCORERS) {
      const s = score(doc);
      if (s > bestScore) {
        bestScore = s;
        bestType = type;
      }
    }

    if (bestScore < MIN_SCORE) return null;

    // Map raw score to confidence (0.5 – 0.8 range)
    const confidence = Math.min(0.5 + bestScore * 0.05, 0.8);
    return { type: bestType, confidence };
  }
}
