"use client";

import { useActionState, useRef, useState } from "react";
import { Button, Checkbox, Dialog, ErrorSummary } from "@qf/design-system";
import { startQuote, type StartState } from "../actions";
import { EligibilityConditions } from "@/components/eligibility";

/**
 * Start form: the eligibility conditions are one click away in a modal (and on their own page
 * without JavaScript), and the user confirms them before the quote begins.
 */
export function StartForm({ reg }: { reg: string | null }) {
  const [state, action, pending] = useActionState<StartState, FormData>(startQuote, {});
  const [open, setOpen] = useState(false);
  const checkboxWrapper = useRef<HTMLDivElement>(null);

  const confirm = () => {
    setOpen(false);
    const box = checkboxWrapper.current?.querySelector<HTMLInputElement>("input[type=checkbox]");
    if (box) {
      box.checked = true;
      box.focus();
    }
  };

  return (
    <>
      <ErrorSummary items={state.error ? [{ targetId: "eligible", message: state.error }] : []} />
      <h2 className="mt-8 mb-4 text-heading-m font-bold">Check you can get a quote online</h2>
      <p className="mb-4">
        There are some conditions you and any other drivers must meet.{" "}
        <a
          href="/quote/conditions"
          aria-haspopup="dialog"
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey) return;
            e.preventDefault();
            setOpen(true);
          }}
        >
          Read the conditions
        </a>
        .
      </p>
      <form action={action} noValidate>
        {reg && <input type="hidden" name="reg" value={reg} />}
        <div ref={checkboxWrapper}>
          <Checkbox id="eligible" label="I confirm that I and any other drivers meet the conditions" error={state.error} />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-[var(--qf-size-target-min)] items-center gap-3 rounded-small border-2 border-brand bg-brand px-6 py-3 text-heading-s font-bold text-ink-inverse hover:border-brand-hover hover:bg-brand-hover focus-visible:focus-ring disabled:opacity-60"
        >
          Start now
          <svg aria-hidden="true" focusable="false" width="17" height="19" viewBox="0 0 33 40" fill="currentColor">
            <path d="M0 0h13l20 20-20 20H0l20-20z" />
          </svg>
        </button>
      </form>
      <Dialog open={open} title="Conditions for an online quote" onClose={() => setOpen(false)} size="l">
        <EligibilityConditions />
        <div className="mt-8 flex flex-wrap items-center gap-6">
          <Button onClick={confirm}>I meet these conditions</Button>
          <Button variant="link" onClick={() => setOpen(false)}>
            Close
          </Button>
        </div>
      </Dialog>
    </>
  );
}
