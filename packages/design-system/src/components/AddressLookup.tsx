"use client";

import { useEffect, useRef, useState } from "react";
import { cx, errorId, hintId } from "../utils";
import { Button } from "./Button";
import { ErrorMessage, FormGroup, Hint, Legend } from "./primitives";

export interface LookupAddress {
  postcode: string;
  line1?: string;
  line2?: string;
  town?: string;
  addressId?: string;
  source?: "lookup" | "manual";
}

export type AddressLookupResult =
  | { status: "found"; postcode: string; addresses: Array<{ id: string; label: string }> }
  | { status: "notFound" | "invalid"; message: string };

export interface AddressLookupProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  /** Which input the error belongs to, so it is shown and linked there. */
  errorTarget?: "postcode" | "address" | "line1" | "town";
  value?: LookupAddress | null;
  /** Raw inputs from a failed submit, redisplayed as typed. */
  raw?: Record<string, string>;
  lookup?: AddressLookupResult;
  /** Start in manual entry (no-JavaScript "enter manually" submit). */
  manual?: boolean;
  focusOnMount?: boolean;
  intentName?: string;
}

const control =
  "min-h-[var(--qf-size-target-min)] max-w-full rounded-none border-[length:var(--qf-border-width-control)] bg-surface px-2 text-body text-ink focus:focus-ring";

/**
 * Postcode lookup with a list of addresses and a manual entry fallback. "Find address" submits
 * the form, so it works without JavaScript; switching to manual entry also has a no-JS path.
 */
export function AddressLookup({ id, label, hint, error, errorTarget = "postcode", value, raw, lookup, manual, focusOnMount, intentName = "intent" }: AddressLookupProps) {
  // A complete address (saved, or resolved from this submit) is shown as text with "Change address".
  const resolved = !lookup && !manual && value?.line1 && (!error || errorTarget === "postcode") ? value : null;
  const initialMode = resolved && !error ? "resolved" : manual || raw?.manual === "true" ? "manual" : "search";
  const [mode, setMode] = useState<"resolved" | "search" | "manual">(initialMode);
  const [hydrated, setHydrated] = useState(false);
  const postcodeRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const line1Ref = useRef<HTMLInputElement>(null);
  const postcode = lookup?.status === "found" ? lookup.postcode : (raw?.postcode ?? value?.postcode ?? "");
  const lookupMessage = lookup && lookup.status !== "found" ? lookup.message : undefined;

  useEffect(() => {
    setHydrated(true);
    if (!focusOnMount) return;
    if (mode === "manual") line1Ref.current?.focus();
    else if (lookup?.status === "found") selectRef.current?.focus();
    else postcodeRef.current?.focus();
    // Mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchTo = (next: "search" | "manual") => {
    setMode(next);
    requestAnimationFrame(() => (next === "manual" ? line1Ref : postcodeRef).current?.focus());
  };

  const errorFor = (target: NonNullable<AddressLookupProps["errorTarget"]>) => (errorTarget === target ? error : undefined);
  const postcodeError = lookupMessage ?? errorFor("postcode");

  return (
    <FormGroup error={Boolean(error || lookupMessage)}>
      <fieldset aria-describedby={hint ? hintId(id) : undefined}>
        <Legend>{label}</Legend>
        {hint && <Hint id={hintId(id)}>{hint}</Hint>}

        {mode === "resolved" && resolved && (
          <div className="flex flex-col gap-3">
            <p className="whitespace-pre-line" data-testid="address-resolved">
              {[resolved.line1, resolved.line2, resolved.town, resolved.postcode].filter(Boolean).join("\n")}
            </p>
            <input type="hidden" name={`${id}-postcode`} value={resolved.postcode} />
            {resolved.source === "manual" ? (
              <>
                <input type="hidden" name={`${id}-manual`} value="true" />
                <input type="hidden" name={`${id}-line1`} value={resolved.line1 ?? ""} />
                <input type="hidden" name={`${id}-line2`} value={resolved.line2 ?? ""} />
                <input type="hidden" name={`${id}-town`} value={resolved.town ?? ""} />
              </>
            ) : (
              <input type="hidden" name={`${id}-address`} value={resolved.addressId ?? ""} />
            )}
            {hydrated && (
              <p>
                <Button variant="secondary" onClick={() => switchTo("search")}>
                  Change address
                </Button>
              </p>
            )}
          </div>
        )}

        {mode === "search" && (
          <>
            <label htmlFor={`${id}-postcode`} className="mb-1 block">
              Postcode
            </label>
            <div aria-live="polite">{postcodeError && <ErrorMessage id={errorId(`${id}-postcode`)}>{postcodeError}</ErrorMessage>}</div>
            <div className="mb-4 flex flex-wrap items-stretch gap-3">
              <input
                ref={postcodeRef}
                id={`${id}-postcode`}
                name={`${id}-postcode`}
                defaultValue={postcode}
                autoComplete="postal-code"
                spellCheck={false}
                aria-describedby={postcodeError ? errorId(`${id}-postcode`) : undefined}
                aria-invalid={postcodeError ? true : undefined}
                className={cx(control, "w-[12ch] uppercase", postcodeError ? "border-line-error" : "border-line-strong")}
              />
              <Button variant="secondary" type="submit" name={intentName} value={`lookup:${id}`}>
                Find address
              </Button>
            </div>
            {lookup?.status === "found" && (
              <div className="mb-4">
                <label htmlFor={`${id}-address`} className="mb-1 block font-bold">
                  Select your address
                </label>
                {errorFor("address") && <ErrorMessage id={errorId(`${id}-address`)}>{errorFor("address")}</ErrorMessage>}
                <select
                  ref={selectRef}
                  id={`${id}-address`}
                  name={`${id}-address`}
                  defaultValue={raw?.addressId ?? ""}
                  aria-describedby={errorFor("address") ? errorId(`${id}-address`) : undefined}
                  className={cx(control, "w-full max-w-[30rem]", errorFor("address") ? "border-line-error" : "border-line-strong")}
                >
                  <option value="">
                    {lookup.addresses.length} {lookup.addresses.length === 1 ? "address" : "addresses"} found
                  </option>
                  {lookup.addresses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {!lookup && errorFor("address") && <ErrorMessage id={errorId(`${id}-address`)}>{errorFor("address")}</ErrorMessage>}
            <p>
              {hydrated ? (
                <Button variant="link" onClick={() => switchTo("manual")}>
                  I cannot find my address in the list
                </Button>
              ) : (
                <Button variant="link" type="submit" name={intentName} value={`manual:${id}`}>
                  I cannot find my address in the list
                </Button>
              )}
            </p>
          </>
        )}

        {mode === "manual" && (
          <>
            <input type="hidden" name={`${id}-manual`} value="true" />
            {(
              [
                ["line1", "Address line 1", "address-line1", true],
                ["line2", "Address line 2 (optional)", "address-line2", false],
                ["town", "Town or city", "address-level2", true],
                ["postcode", "Postcode", "postal-code", true],
              ] as const
            ).map(([key, text, autocomplete]) => {
              const fieldError = key === "postcode" ? errorFor("postcode") : errorFor(key as "line1" | "town");
              const inputId = `${id}-${key}`;
              const initial = raw?.[key] ?? (key === "postcode" ? postcode : (value?.[key as "line1" | "line2" | "town"] ?? ""));
              return (
                <div key={key} className="mb-4">
                  <label htmlFor={inputId} className="mb-1 block">
                    {text}
                  </label>
                  {fieldError && <ErrorMessage id={errorId(inputId)}>{fieldError}</ErrorMessage>}
                  <input
                    ref={key === "line1" ? line1Ref : undefined}
                    id={inputId}
                    name={inputId}
                    defaultValue={initial}
                    autoComplete={autocomplete}
                    aria-describedby={fieldError ? errorId(inputId) : undefined}
                    aria-invalid={fieldError ? true : undefined}
                    className={cx(control, key === "postcode" ? "w-[12ch] uppercase" : "w-full max-w-[30rem]", fieldError ? "border-line-error" : "border-line-strong")}
                  />
                </div>
              );
            })}
            {hydrated && (
              <Button variant="link" onClick={() => switchTo("search")}>
                Search by postcode instead
              </Button>
            )}
          </>
        )}
      </fieldset>
    </FormGroup>
  );
}
