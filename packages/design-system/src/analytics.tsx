"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Vendor-neutral analytics events emitted by components. An app maps them to its own schema
 * (data layer, Adobe eVars) and decides whether to send them (consent). Components never call
 * a vendor directly, and never send personal data or message text.
 */
export type AnalyticsEvent =
  | { action: "fieldFocus"; field: string }
  | { action: "valueSelected"; field: string; inputMethod: "quickSelect" | "textInput" | "calendarPicker" }
  | { action: "calendarOpened"; field: string }
  | { action: "calendarClosed"; field: string; selected: boolean }
  | { action: "validationError"; field: string; code: string };

export type Track = (event: AnalyticsEvent) => void;

const AnalyticsContext = createContext<Track>(() => {});

export function AnalyticsProvider({ track, children }: { track: Track; children: ReactNode }) {
  return <AnalyticsContext.Provider value={track}>{children}</AnalyticsContext.Provider>;
}

export const useTrack = () => useContext(AnalyticsContext);
