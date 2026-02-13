/**
 * VideoExtractor — extracts video-specific metadata.
 */

import type { VideoFields } from '../../types/capture';
import type { TypeExtractor } from '../types';
import { getJsonLd, toNumber, getMeta } from './base-extractor';

export class VideoExtractor implements TypeExtractor {
  extract(doc: Document, url: string): VideoFields {
    const ld = getJsonLd(doc, 'VideoObject');

    return {
      title: this.extractTitle(doc, ld),
      duration: this.extractDuration(doc, ld),
      channel: this.extractChannel(doc, ld, url),
      channelUrl: this.extractChannelUrl(doc, url),
      uploadDate: (ld?.uploadDate as string) ?? getMeta(doc, 'property', 'og:video:release_date'),
      viewCount: this.extractViewCount(doc, ld),
      thumbnailUrl: this.extractThumbnail(doc, ld),
      embedUrl: (ld?.embedUrl as string) ?? undefined,
    };
  }

  private extractTitle(doc: Document, ld: Record<string, unknown> | null): string | undefined {
    return (ld?.name as string) ??
      getMeta(doc, 'property', 'og:title') ??
      doc.title;
  }

  private extractDuration(_doc: Document, ld: Record<string, unknown> | null): number | undefined {
    const raw = ld?.duration;
    if (typeof raw === 'string') return this.parseISO8601Duration(raw);
    return undefined;
  }

  private extractChannel(doc: Document, ld: Record<string, unknown> | null, url: string): string | undefined {
    // JSON-LD author
    const author = ld?.author;
    if (typeof author === 'string') return author;
    if (author && typeof author === 'object') {
      return (author as Record<string, unknown>).name as string | undefined;
    }

    // YouTube-specific
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return doc.querySelector('#channel-name a, ytd-channel-name a')?.textContent?.trim();
    }

    return undefined;
  }

  private extractChannelUrl(doc: Document, url: string): string | undefined {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const link = doc.querySelector('#channel-name a, ytd-channel-name a') as HTMLAnchorElement | null;
      return link?.href ?? undefined;
    }
    return undefined;
  }

  private extractViewCount(doc: Document, ld: Record<string, unknown> | null): number | undefined {
    return toNumber(ld?.interactionCount) ??
      toNumber(doc.querySelector('[itemprop="interactionCount"]')?.getAttribute('content'));
  }

  private extractThumbnail(doc: Document, ld: Record<string, unknown> | null): string | undefined {
    const tn = ld?.thumbnailUrl;
    if (typeof tn === 'string') return tn;
    if (Array.isArray(tn)) return tn[0] as string;
    return getMeta(doc, 'property', 'og:image') ?? undefined;
  }

  /**
   * Parse an ISO 8601 duration string (e.g. "PT1H23M45S") into seconds.
   */
  private parseISO8601Duration(iso: string): number | undefined {
    const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return undefined;
    const h = parseInt(match[1] ?? '0', 10);
    const m = parseInt(match[2] ?? '0', 10);
    const s = parseInt(match[3] ?? '0', 10);
    return h * 3600 + m * 60 + s;
  }
}
