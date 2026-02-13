/**
 * ProductExtractor — extracts product-specific metadata.
 */

import type { ProductFields } from '../../types/capture';
import type { TypeExtractor } from '../types';
import { getJsonLd, toNumber } from './base-extractor';

export class ProductExtractor implements TypeExtractor {
  extract(doc: Document): ProductFields {
    const ld = getJsonLd(doc, 'Product');

    return {
      name: this.extractName(doc, ld),
      price: this.extractPrice(doc, ld),
      currency: this.extractCurrency(doc, ld),
      rating: this.extractRating(doc, ld),
      reviewCount: this.extractReviewCount(doc, ld),
      inStock: this.extractAvailability(doc, ld),
      sku: this.extractSku(doc, ld),
      brand: this.extractBrand(doc, ld),
      imageUrl: this.extractImage(doc, ld),
    };
  }

  private extractName(doc: Document, ld: Record<string, unknown> | null): string | undefined {
    return (ld?.name as string) ??
      doc.querySelector('[itemprop="name"]')?.textContent?.trim();
  }

  private extractPrice(doc: Document, ld: Record<string, unknown> | null): string | undefined {
    const offers = ld?.offers;
    if (offers && typeof offers === 'object') {
      const o = Array.isArray(offers) ? offers[0] : offers;
      if ((o as Record<string, unknown>).price) {
        return String((o as Record<string, unknown>).price);
      }
    }
    return doc.querySelector('[itemprop="price"]')?.getAttribute('content') ??
      doc.querySelector('[itemprop="price"]')?.textContent?.trim();
  }

  private extractCurrency(doc: Document, ld: Record<string, unknown> | null): string | undefined {
    const offers = ld?.offers;
    if (offers && typeof offers === 'object') {
      const o = Array.isArray(offers) ? offers[0] : offers;
      if ((o as Record<string, unknown>).priceCurrency) {
        return String((o as Record<string, unknown>).priceCurrency);
      }
    }
    return doc.querySelector('[itemprop="priceCurrency"]')?.getAttribute('content') ?? undefined;
  }

  private extractRating(doc: Document, ld: Record<string, unknown> | null): number | undefined {
    const rating = ld?.aggregateRating;
    if (rating && typeof rating === 'object') {
      return toNumber((rating as Record<string, unknown>).ratingValue);
    }
    return toNumber(doc.querySelector('[itemprop="ratingValue"]')?.getAttribute('content'));
  }

  private extractReviewCount(doc: Document, ld: Record<string, unknown> | null): number | undefined {
    const rating = ld?.aggregateRating;
    if (rating && typeof rating === 'object') {
      return toNumber((rating as Record<string, unknown>).reviewCount);
    }
    return toNumber(doc.querySelector('[itemprop="reviewCount"]')?.getAttribute('content'));
  }

  private extractAvailability(_doc: Document, ld: Record<string, unknown> | null): boolean | undefined {
    const offers = ld?.offers;
    if (offers && typeof offers === 'object') {
      const o = Array.isArray(offers) ? offers[0] : offers;
      const avail = String((o as Record<string, unknown>).availability ?? '');
      if (avail.includes('InStock')) return true;
      if (avail.includes('OutOfStock')) return false;
    }
    return undefined;
  }

  private extractSku(doc: Document, ld: Record<string, unknown> | null): string | undefined {
    return (ld?.sku as string) ??
      doc.querySelector('[itemprop="sku"]')?.getAttribute('content') ??
      doc.querySelector('[data-sku]')?.getAttribute('data-sku') ?? undefined;
  }

  private extractBrand(doc: Document, ld: Record<string, unknown> | null): string | undefined {
    const brand = ld?.brand;
    if (typeof brand === 'string') return brand;
    if (brand && typeof brand === 'object') {
      return (brand as Record<string, unknown>).name as string | undefined;
    }
    return doc.querySelector('[itemprop="brand"]')?.textContent?.trim();
  }

  private extractImage(doc: Document, ld: Record<string, unknown> | null): string | undefined {
    const img = ld?.image;
    if (typeof img === 'string') return img;
    if (Array.isArray(img)) return img[0] as string;
    return doc.querySelector('[itemprop="image"]')?.getAttribute('src') ?? undefined;
  }
}
