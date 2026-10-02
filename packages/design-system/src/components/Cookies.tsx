"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { makeConsent, type Consent, type ConsentCategory } from "../consent";
import { Button } from "./Button";
import { Radios } from "./fields";

const bannerText = {
  title: "Cookies on this service",
  body: "We use some essential cookies to make this service work. We would also like to use analytics cookies to understand how you use the service and marketing cookies to show you relevant offers.",
  accept: "Accept additional cookies",
  reject: "Reject additional cookies",
  manage: "Choose which cookies to use",
  accepted: "You have accepted additional cookies.",
  rejected: "You have rejected additional cookies.",
  changeLater: "You can change your cookie settings at any time.",
  hide: "Hide cookie message",
};

export interface CookieBannerProps {
  /** Consent already given (from the shared cookie). The banner renders nothing when set. */
  initialConsent: Consent | null;
  onDecision: (consent: Consent) => void;
  onManage: () => void;
  text?: Partial<typeof bannerText>;
}

/**
 * Non-modal cookie banner at the top of the page: the service stays usable before a choice
 * is made, and accept and reject have equal prominence. After a choice, a confirmation
 * replaces the question and takes focus so the outcome is announced.
 */
export function CookieBanner({ initialConsent, onDecision, onManage, text: overrides }: CookieBannerProps) {
  const text = { ...bannerText, ...overrides };
  const [state, setState] = useState<"ask" | "accepted" | "rejected" | "hidden">(initialConsent ? "hidden" : "ask");
  const confirmationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state === "accepted" || state === "rejected") confirmationRef.current?.focus();
  }, [state]);

  if (state === "hidden") return null;

  const decide = (all: boolean) => {
    onDecision(makeConsent({ analytics: all, marketing: all }));
    setState(all ? "accepted" : "rejected");
  };

  return (
    <section aria-label={text.title} className="border-b-2 border-line bg-surface-subtle" data-testid="cookie-banner">
      <div className="mx-auto max-w-[70rem] px-4 py-6 sm:px-6">
        {state === "ask" ? (
          <>
            <h2 className="mb-3 text-heading-m font-bold">{text.title}</h2>
            <p className="mb-5 max-w-[var(--qf-size-measure)]">{text.body}</p>
            <div className="flex flex-wrap items-center gap-4">
              <Button onClick={() => decide(true)}>{text.accept}</Button>
              <Button onClick={() => decide(false)}>{text.reject}</Button>
              <Button variant="link" onClick={onManage}>
                {text.manage}
              </Button>
            </div>
          </>
        ) : (
          <div ref={confirmationRef} tabIndex={-1} className="focus:focus-ring">
            <p className="mb-4">
              {state === "accepted" ? text.accepted : text.rejected} {text.changeLater}
            </p>
            <Button variant="secondary" onClick={() => setState("hidden")}>
              {text.hide}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

const settingsText = {
  intro: "Essential cookies are always on because the service cannot work without them. They remember your progress and keep your session secure.",
  analytics: "Do you want to accept analytics cookies?",
  analyticsHint: "These help us improve the service by measuring how people use it. The data is anonymised.",
  marketing: "Do you want to accept marketing cookies?",
  marketingHint: "These let us and our partners show you relevant offers on other websites.",
  yes: "Yes",
  no: "No",
  save: "Save cookie settings",
  saved: "Your cookie settings have been saved.",
};

export interface CookieSettingsProps {
  consent: Consent | null;
  onSave: (consent: Consent) => void;
  text?: Partial<typeof settingsText>;
}

/** Granular consent form. Defaults to "No" for every optional category when no choice exists. */
export function CookieSettings({ consent, onSave, text: overrides }: CookieSettingsProps) {
  const text = { ...settingsText, ...overrides };
  const [saved, setSaved] = useState(false);
  const statusRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (saved) statusRef.current?.focus();
  }, [saved]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const choice = (c: ConsentCategory) => data.get(c) === "yes";
    onSave(makeConsent({ analytics: choice("analytics"), marketing: choice("marketing") }));
    setSaved(true);
  };

  const options = [
    { value: "yes", label: text.yes },
    { value: "no", label: text.no },
  ];
  const current = (c: ConsentCategory) => (consent?.[c] ? "yes" : "no");

  return (
    <form onSubmit={submit} noValidate>
      {saved && (
        <p ref={statusRef} tabIndex={-1} role="status" className="mb-6 border-l-4 border-ink-success bg-surface-success p-4 font-bold text-ink-success focus:focus-ring">
          {text.saved}
        </p>
      )}
      <p className="mb-6">{text.intro}</p>
      <Radios id="analytics" label={text.analytics} hint={text.analyticsHint} options={options} value={current("analytics")} inline />
      <Radios id="marketing" label={text.marketing} hint={text.marketingHint} options={options} value={current("marketing")} inline />
      <Button type="submit">{text.save}</Button>
    </form>
  );
}
