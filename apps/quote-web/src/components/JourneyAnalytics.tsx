"use client";

import { useCallback, type ReactNode } from "react";
import { AnalyticsProvider, type AnalyticsEvent } from "@qf/design-system";
import { readConsentCookie } from "@qf/design-system/consent";

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

/**
 * Sends component analytics events to the data layer, only when the user has accepted
 * analytics cookies. A tag manager can map them to Adobe Analytics (e.g. action → eVar10,
 * step → eVar3) without the components knowing about any vendor.
 */
export function JourneyAnalytics({ journey, step, children }: { journey: string; step: string; children: ReactNode }) {
  const track = useCallback(
    (event: AnalyticsEvent) => {
      if (!readConsentCookie()?.analytics) return;
      window.dataLayer = window.dataLayer ?? [];
      window.dataLayer.push({ event: "fieldInteraction", journey, step, ...event });
    },
    [journey, step],
  );
  return <AnalyticsProvider track={track}>{children}</AnalyticsProvider>;
}
