/**
 * Internal types for the classification engine.
 */

import type { PageType, TypeSpecificFields } from '../types/capture';

/** Result returned by a detector. */
export interface DetectionResult {
  type: PageType;
  confidence: number; // 0.0 – 1.0
}

/** A detector analyses the DOM / URL and suggests a page type. */
export interface PageDetector {
  readonly name: string;
  detect(doc: Document, url: string): DetectionResult | null;
}

/** A type extractor pulls type-specific fields from the DOM. */
export interface TypeExtractor {
  extract(doc: Document, url: string): TypeSpecificFields;
}
