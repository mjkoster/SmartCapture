/**
 * Base helper utilities shared by all type-specific extractors.
 */

/** Read a <meta> tag by attribute key/value. */
export function getMeta(doc: Document, attr: string, value: string): string | undefined {
  return doc.querySelector(`meta[${attr}="${value}"]`)?.getAttribute('content') || undefined;
}

/** Parse the first JSON-LD block matching the given @type (case-insensitive). */
export function getJsonLd(doc: Document, type: string): Record<string, unknown> | null {
  const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
  for (const script of scripts) {
    try {
      const data = JSON.parse(script.textContent ?? '{}');

      // Check @graph arrays
      if (Array.isArray(data['@graph'])) {
        for (const item of data['@graph']) {
          if (matchesType(item, type)) return item;
        }
      }

      if (matchesType(data, type)) return data;
    } catch {
      // skip
    }
  }
  return null;
}

function matchesType(data: Record<string, unknown>, type: string): boolean {
  const raw = data['@type'];
  if (!raw) return false;
  const types = Array.isArray(raw) ? raw : [raw];
  return types.some((t: unknown) =>
    typeof t === 'string' && t.toLowerCase() === type.toLowerCase(),
  );
}

/** Safely extract a nested string value. */
export function nestedString(obj: unknown, ...keys: string[]): string | undefined {
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === 'string' ? current : undefined;
}

/** Safely extract a number. */
export function toNumber(val: unknown): number | undefined {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const n = parseFloat(val.replace(/[^0-9.-]/g, ''));
    return isNaN(n) ? undefined : n;
  }
  return undefined;
}
