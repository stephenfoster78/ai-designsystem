"use client";

import { CookieSettings } from "@qf/design-system";
import { writeConsentCookie, type Consent } from "@qf/design-system/consent";

export function CookiesPageForm({ consent, consentDomain }: { consent: Consent | null; consentDomain?: string }) {
  return <CookieSettings consent={consent} onSave={(next) => writeConsentCookie(next, { domain: consentDomain })} />;
}
