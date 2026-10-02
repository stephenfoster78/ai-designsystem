/**
 * Content layer. Journeys reference copy by key; an adapter resolves it. The demo adapter
 * reads a JSON dictionary. A CMS adapter can implement the same interface later without
 * touching journeys.
 */

export type ContentParams = Record<string, string | number>;

export interface ContentAdapter {
  /** Version of the content set, recorded against drafts as evidence of what was shown. */
  readonly version: string;
  has(key: string): boolean;
  /** Resolves a key, interpolating {placeholders}. Falls back through `fallbacks` in order. */
  t(key: string, params?: ContentParams, ...fallbacks: string[]): string;
  /** Like `t`, but returns undefined instead of a missing-key marker (for optional hints). */
  maybe(key: string, params?: ContentParams): string | undefined;
}

export type ContentDictionary = Record<string, string>;

export function interpolate(template: string, params: ContentParams = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

export function createJsonContent(
  dictionary: ContentDictionary,
  options: { version: string; onMissing?: (key: string) => void } = { version: "dev" },
): ContentAdapter {
  const onMissing = options.onMissing ?? ((key: string) => console.warn(`[content] missing key "${key}"`));
  return {
    version: options.version,
    has: (key) => key in dictionary,
    maybe: (key, params) => (key in dictionary ? interpolate(dictionary[key] as string, params) : undefined),
    t(key, params, ...fallbacks) {
      for (const candidate of [key, ...fallbacks]) {
        const value = dictionary[candidate];
        if (value !== undefined) return interpolate(value, params);
      }
      onMissing(key);
      // Visible marker so missing copy is caught in review rather than shipping blank labels.
      return `[${key}]`;
    },
  };
}
