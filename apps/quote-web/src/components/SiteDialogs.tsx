"use client";

import { createContext, useCallback, useContext, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { CookieBanner, CookieSettings, Dialog } from "@qf/design-system";
import { writeConsentCookie, type Consent } from "@qf/design-system/consent";
import { AccessibilityStatement, PrivacyNotice } from "./site-content";

type SiteDialog = "cookies" | "accessibility" | "privacy";

const titles: Record<SiteDialog, string> = {
  cookies: "Cookie settings",
  accessibility: "Accessibility statement",
  privacy: "How we use your information",
};

const DialogContext = createContext<(dialog: SiteDialog) => void>(() => {});

/**
 * Hosts site-wide dialogs (cookie settings, accessibility statement, privacy) and the cookie
 * banner. Footer links point at real pages and open the dialog instead when JavaScript runs.
 */
export function SiteDialogs({ initialConsent, consentDomain, children }: { initialConsent: Consent | null; consentDomain?: string; children: ReactNode }) {
  const [open, setOpen] = useState<SiteDialog | null>(null);
  const [consent, setConsent] = useState(initialConsent);

  const save = useCallback(
    (next: Consent) => {
      writeConsentCookie(next, { domain: consentDomain });
      setConsent(next);
    },
    [consentDomain],
  );

  const value = useMemo(() => (dialog: SiteDialog) => setOpen(dialog), []);

  return (
    <DialogContext.Provider value={value}>
      <CookieBanner initialConsent={initialConsent} onDecision={save} onManage={() => setOpen("cookies")} />
      {children}
      <Dialog open={open !== null} title={open ? titles[open] : ""} onClose={() => setOpen(null)} size="l">
        {open === "cookies" && <CookieSettings consent={consent} onSave={save} />}
        {open === "accessibility" && <AccessibilityStatement />}
        {open === "privacy" && <PrivacyNotice />}
      </Dialog>
    </DialogContext.Provider>
  );
}

export function DialogLink({ dialog, href, children, className }: { dialog: SiteDialog; href: string; children: ReactNode; className?: string }) {
  const openDialog = useContext(DialogContext);
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    // Let modified clicks open the page in a new tab as normal.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    openDialog(dialog);
  };
  return (
    <a href={href} onClick={onClick} className={className} aria-haspopup="dialog">
      {children}
    </a>
  );
}
