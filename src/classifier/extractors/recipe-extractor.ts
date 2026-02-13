/**
 * RecipeExtractor — extracts recipe-specific metadata.
 */

import type { RecipeFields } from '../../types/capture';
import type { TypeExtractor } from '../types';
import { getJsonLd, toNumber } from './base-extractor';

export class RecipeExtractor implements TypeExtractor {
  extract(doc: Document): RecipeFields {
    const ld = getJsonLd(doc, 'Recipe');

    return {
      recipeName: (ld?.name as string) ??
        doc.querySelector('[itemprop="name"], h1')?.textContent?.trim(),
      prepTime: this.parseDuration(ld?.prepTime) ??
        this.parseDuration(doc.querySelector('[itemprop="prepTime"]')?.getAttribute('content')),
      cookTime: this.parseDuration(ld?.cookTime) ??
        this.parseDuration(doc.querySelector('[itemprop="cookTime"]')?.getAttribute('content')),
      totalTime: this.parseDuration(ld?.totalTime) ??
        this.parseDuration(doc.querySelector('[itemprop="totalTime"]')?.getAttribute('content')),
      servings: (ld?.recipeYield as string) ??
        doc.querySelector('[itemprop="recipeYield"]')?.textContent?.trim(),
      calories: this.extractCalories(doc, ld),
      ingredients: this.extractIngredients(doc, ld),
      cuisineType: (ld?.recipeCuisine as string) ??
        doc.querySelector('[itemprop="recipeCuisine"]')?.textContent?.trim(),
    };
  }

  private extractIngredients(doc: Document, ld: Record<string, unknown> | null): string[] {
    // From JSON-LD
    if (Array.isArray(ld?.recipeIngredient)) {
      return ld!.recipeIngredient as string[];
    }
    // From itemprop
    const els = doc.querySelectorAll('[itemprop="recipeIngredient"]');
    return Array.from(els).map((el) => el.textContent?.trim() ?? '').filter(Boolean);
  }

  private extractCalories(doc: Document, ld: Record<string, unknown> | null): number | undefined {
    const nutrition = ld?.nutrition;
    if (nutrition && typeof nutrition === 'object') {
      return toNumber((nutrition as Record<string, unknown>).calories);
    }
    return toNumber(doc.querySelector('[itemprop="calories"]')?.textContent);
  }

  /**
   * Parse ISO 8601 duration (PT30M, PT1H15M) to minutes.
   */
  private parseDuration(val: unknown): number | undefined {
    if (!val || typeof val !== 'string') return undefined;
    const match = val.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    if (!match) return undefined;
    const h = parseInt(match[1] ?? '0', 10);
    const m = parseInt(match[2] ?? '0', 10);
    return h * 60 + m || undefined;
  }
}
