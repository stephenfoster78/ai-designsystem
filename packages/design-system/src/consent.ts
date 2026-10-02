/**
 * Cookie consent model. The quote journey shares consent with the direct site on the same
 * domain, so a user who has already chosen on the direct site is not asked again.
 * If a third-party consent platform replaces this, only these functions need to change.
 */

export const CONSENT_COOKIE = "qf_cookie_consent";
export const CONSENT_VERSION = 1;
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export type ConsentCategory = "analytics" | "marketing";

export interface Consent {
  version: number;
  analytics: boolean;
  marketing: boolean;
  /** ISO timestamp of the decision. */
  decidedAt: string;
}

export function parseConsent(raw: string | undefined | null): Consent | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(decodeURIComponent(raw)) as Partial<Consent>;
    // A policy change bumps the version, which asks everyone again.
    if (value.version !== CONSENT_VERSION) return null;
    if (typeof value.analytics !== "boolean" || typeof value.marketing !== "boolean") return null;
    return { version: CONSENT_VERSION, analytics: value.analytics, marketing: value.marketing, decidedAt: String(value.decidedAt ?? "") };
  } catch {
    return null;
  }
}

export function serialiseConsent(consent: Consent): string {
  return encodeURIComponent(JSON.stringify(consent));
}

export function makeConsent(choices: Record<ConsentCategory, boolean>, now = new Date()): Consent {
  return { version: CONSENT_VERSION, ...choices, decidedAt: now.toISOString() };
}

export function consentCookieString(consent: Consent, options: { domain?: string; secure?: boolean } = {}): string {
  return [
    `${CONSENT_COOKIE}=${serialiseConsent(consent)}`,
    "Path=/",
    `Max-Age=${ONE_YEAR_SECONDS}`,
    "SameSite=Lax",
    options.domain ? `Domain=${options.domain}` : "",
    options.secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

/** Browser only. */
export function writeConsentCookie(consent: Consent, options: { domain?: string } = {}): void {
  document.cookie = consentCookieString(consent, { ...options, secure: location.protocol === "https:" });
}

/** Browser only. */
export function readConsentCookie(): Consent | null {
  const match = document.cookie.split("; ").find((c) => c.startsWith(`${CONSENT_COOKIE}=`));
  return parseConsent(match?.slice(CONSENT_COOKIE.length + 1));
}
