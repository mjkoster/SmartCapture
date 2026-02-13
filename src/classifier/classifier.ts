/**
 * PageClassifier — orchestrates page type detection and type-specific extraction.
 *
 * Detection pipeline (priority order):
 *   1. SchemaOrgDetector  (confidence: 0.95)
 *   2. UrlPatternDetector (confidence: 0.85–0.9)
 *   3. HeuristicDetector  (confidence: 0.5–0.8)
 *
 * Once a type is determined, the matching TypeExtractor pulls type-specific fields.
 */

import { PageType, type ClassificationData, type TypeSpecificFields } from '../types/capture';
import { createLogger } from '../utils/logger';
import type { PageDetector, TypeExtractor } from './types';

import { SchemaOrgDetector } from './detectors/schema-detector';
import { UrlPatternDetector } from './detectors/url-detector';
import { HeuristicDetector } from './detectors/heuristic-detector';

import { ArticleExtractor } from './extractors/article-extractor';
import { ProductExtractor } from './extractors/product-extractor';
import { VideoExtractor } from './extractors/video-extractor';
import { RepositoryExtractor } from './extractors/repository-extractor';
import { DocumentationExtractor } from './extractors/documentation-extractor';
import { RecipeExtractor } from './extractors/recipe-extractor';

const log = createLogger('Classifier');

/** Minimum confidence required to accept a detection result. */
const MIN_CONFIDENCE = 0.5;

export class PageClassifier {
  private readonly detectors: PageDetector[];
  private readonly extractors: Map<PageType, TypeExtractor>;

  constructor() {
    // Detectors in priority order
    this.detectors = [
      new SchemaOrgDetector(),
      new UrlPatternDetector(),
      new HeuristicDetector(),
    ];

    // Type-specific extractors
    this.extractors = new Map<PageType, TypeExtractor>([
      [PageType.ARTICLE, new ArticleExtractor()],
      [PageType.PRODUCT, new ProductExtractor()],
      [PageType.VIDEO, new VideoExtractor()],
      [PageType.REPOSITORY, new RepositoryExtractor()],
      [PageType.DOCUMENTATION, new DocumentationExtractor()],
      [PageType.RECIPE, new RecipeExtractor()],
    ]);
  }

  /**
   * Classify the current page and extract type-specific fields.
   */
  classify(doc: Document, url: string): ClassificationData {
    // Run detectors in priority order
    for (const detector of this.detectors) {
      try {
        const result = detector.detect(doc, url);
        if (result && result.confidence >= MIN_CONFIDENCE) {
          log.info(`Detected type "${result.type}" via ${detector.name} (confidence: ${result.confidence})`);

          // Extract type-specific fields
          const extractor = this.extractors.get(result.type);
          let typeSpecificFields: TypeSpecificFields = {};
          if (extractor) {
            try {
              typeSpecificFields = extractor.extract(doc, url);
            } catch (err) {
              log.warn(`Extractor for "${result.type}" failed`, err);
            }
          }

          return {
            type: result.type,
            confidence: result.confidence,
            typeSpecificFields,
          };
        }
      } catch (err) {
        log.warn(`Detector "${detector.name}" threw an error`, err);
      }
    }

    // No match
    log.info('No page type detected — classifying as UNKNOWN');
    return {
      type: PageType.UNKNOWN,
      confidence: 0,
      typeSpecificFields: {},
    };
  }
}
