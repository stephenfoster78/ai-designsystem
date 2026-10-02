"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cx, errorId, hintId } from "../utils";
import { Button } from "./Button";
import { Dialog } from "./Dialog";
import { ErrorMessage, FormGroup, Hint } from "./primitives";

export interface LookupVehicle {
  reg: string;
  make?: string;
  model?: string;
  year?: number;
  transmission?: string;
  variant?: string;
  source?: "lookup" | "manual";
}

/** make → model → transmission → year → variants */
export type LookupVehicleTree = Record<string, Record<string, Partial<Record<string, Record<string, string[]>>>>>;

export type VehicleLookupResult = { status: "found"; vehicle: LookupVehicle } | { status: "notFound" | "failed" | "invalid"; message: string };

export interface RegLookupProps {
  id: string;
  label: string;
  hint?: string;
  /** Validation error from a Continue submit. */
  error?: string;
  /** Saved answer: a resolved vehicle, or just a registration (e.g. from ?reg=). */
  value?: LookupVehicle | null;
  /** Result of the most recent "Find car" submit, if this render follows one. */
  lookup?: VehicleLookupResult;
  /** Loads the tree for the manual lookup modal. */
  loadTree: () => Promise<LookupVehicleTree>;
  /** Submit the lookup on first render (registration passed in the URL). */
  autoLookup?: boolean;
  /** Move focus to the outcome on mount (this render follows a lookup). */
  focusOnMount?: boolean;
  /** Form control name of the submit "intent" used for lookups. */
  intentName?: string;
}

const prefixClass = "flex items-center bg-brand px-3 font-bold text-ink-inverse";

/**
 * Car registration lookup (from the project's component spec): UK prefix input, Find car,
 * results card replacing the input, "Not correct vehicle" reset, and a manual lookup modal
 * with dependent dropdowns. "Find car" submits the form, so lookup works without JavaScript;
 * the manual modal is offered only once JavaScript is running.
 */
export function RegLookup({ id, label, hint, error, value, lookup, loadTree, autoLookup, focusOnMount, intentName = "intent" }: RegLookupProps) {
  const found = lookup ? (lookup.status === "found" ? lookup.vehicle : null) : value?.make ? value : null;
  const [vehicle, setVehicle] = useState<LookupVehicle | null>(found);
  const [reg, setReg] = useState(lookup?.status === "found" ? lookup.vehicle.reg : value?.reg ?? "");
  const [manualOpen, setManualOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);
  const findRef = useRef<HTMLButtonElement>(null);
  const resultsId = useId();
  const lookupMessage = lookup && lookup.status !== "found" ? lookup.message : undefined;
  const message = lookupMessage ?? error;

  useEffect(() => {
    setHydrated(true);
    if (focusOnMount) (vehicle ? resultsHeadingRef.current : inputRef.current)?.focus();
    // ?reg= passed through from the direct site: look it up straight away (spec).
    if (autoLookup && !vehicle && reg) findRef.current?.form?.requestSubmit(findRef.current);
    // Mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = () => {
    setVehicle(null);
    // Return focus to the input once it is back in the document (spec: reset flow).
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <FormGroup error={Boolean(message)}>
      {vehicle ? (
        <section aria-labelledby={resultsId} className="border-2 border-line-strong p-4 sm:p-6" data-testid="vehicle-result">
          <h2 id={resultsId} ref={resultsHeadingRef} tabIndex={-1} className="mb-4 text-heading-s font-bold focus:outline-none">
            Your car
          </h2>
          <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
            <dt className="font-bold">Registration</dt>
            <dd>{vehicle.reg || "Not given"}</dd>
            <dt className="font-bold">Make and model</dt>
            <dd>
              {vehicle.make} {vehicle.model}
            </dd>
            <dt className="font-bold">Year</dt>
            <dd>{vehicle.year}</dd>
            <dt className="font-bold">Transmission</dt>
            <dd>{vehicle.transmission}</dd>
            <dt className="font-bold">Variant</dt>
            <dd>{vehicle.variant}</dd>
          </dl>
          <input type="hidden" name={id} value={vehicle.reg} />
          {vehicle.source === "manual" && (
            <>
              <input type="hidden" name={`${id}-make`} value={vehicle.make} />
              <input type="hidden" name={`${id}-model`} value={vehicle.model} />
              <input type="hidden" name={`${id}-transmission`} value={vehicle.transmission} />
              <input type="hidden" name={`${id}-vehicle-year`} value={String(vehicle.year ?? "")} />
              <input type="hidden" name={`${id}-variant`} value={vehicle.variant} />
            </>
          )}
          {hydrated ? (
            <Button variant="secondary" onClick={reset}>
              Not correct vehicle
            </Button>
          ) : (
            <Button variant="secondary" type="submit" name={intentName} value={`reset:${id}`}>
              Not correct vehicle
            </Button>
          )}
        </section>
      ) : (
        <>
          <label htmlFor={id} className="mb-1 block font-bold">
            {label}
          </label>
          {/* Spec order: error between the input row and the hint is unusual; we keep hint first so
              it is read before typing, and the error directly above the input as elsewhere. */}
          {hint && <Hint id={hintId(id)}>{hint}</Hint>}
          <div aria-live="polite">{message && <ErrorMessage id={errorId(id)}>{message}</ErrorMessage>}</div>
          <div className="flex max-w-full flex-wrap items-stretch gap-3">
            <div className="flex">
              <span className={prefixClass} aria-hidden="true">
                UK
              </span>
              <input
                ref={inputRef}
                id={id}
                name={id}
                value={reg}
                onChange={(e) => setReg(e.target.value.toUpperCase().replace(/[^A-Z0-9 ]/g, ""))}
                maxLength={8}
                autoComplete="off"
                spellCheck={false}
                autoCapitalize="characters"
                aria-describedby={[hint && hintId(id), message && errorId(id)].filter(Boolean).join(" ") || undefined}
                aria-invalid={message ? true : undefined}
                className={cx(
                  "min-h-[var(--qf-size-target-min)] w-[11ch] rounded-none border-[length:var(--qf-border-width-control)] bg-surface px-2 text-heading-s font-bold tracking-wider text-ink uppercase focus:focus-ring",
                  message ? "border-line-error" : "border-line-strong",
                )}
              />
            </div>
            <Button ref={findRef} variant="secondary" type="submit" name={intentName} value={`lookup:${id}`}>
              Find car
            </Button>
          </div>
          {hydrated && (
            <p className="mt-3">
              <Button variant="link" onClick={() => setManualOpen(true)}>
                Manually find car
              </Button>
            </p>
          )}
        </>
      )}
      {hydrated && (
        <ManualVehicleDialog
          open={manualOpen}
          reg={reg}
          loadTree={loadTree}
          onCancel={() => setManualOpen(false)}
          onConfirm={(v) => {
            setVehicle(v);
            setManualOpen(false);
            requestAnimationFrame(() => resultsHeadingRef.current?.focus());
          }}
        />
      )}
    </FormGroup>
  );
}

type Selection = { make: string; model: string; transmission: string; year: string; variant: string };
const EMPTY: Selection = { make: "", model: "", transmission: "", year: "", variant: "" };
const LEVELS: Array<{ key: keyof Selection; label: string }> = [
  { key: "make", label: "Make" },
  { key: "model", label: "Model" },
  { key: "transmission", label: "Transmission" },
  { key: "year", label: "Year of manufacture" },
  { key: "variant", label: "Variant" },
];

function optionsFor(tree: LookupVehicleTree, s: Selection, level: keyof Selection): string[] {
  switch (level) {
    case "make":
      return Object.keys(tree).sort();
    case "model":
      return Object.keys(tree[s.make] ?? {}).sort();
    case "transmission":
      return Object.keys(tree[s.make]?.[s.model] ?? {});
    case "year":
      return Object.keys(tree[s.make]?.[s.model]?.[s.transmission] ?? {}).sort((a, b) => Number(b) - Number(a));
    case "variant":
      return tree[s.make]?.[s.model]?.[s.transmission]?.[s.year] ?? [];
  }
}

/** Dependent dropdowns, revealed one at a time so each choice narrows the next list. */
function ManualVehicleDialog({ open, reg, loadTree, onCancel, onConfirm }: { open: boolean; reg: string; loadTree: () => Promise<LookupVehicleTree>; onCancel: () => void; onConfirm: (v: LookupVehicle) => void }) {
  const [tree, setTree] = useState<LookupVehicleTree | null>(null);
  const [failed, setFailed] = useState(false);
  const [sel, setSel] = useState<Selection>(EMPTY);
  const [missing, setMissing] = useState<keyof Selection | null>(null);

  useEffect(() => {
    if (!open || tree) return;
    loadTree().then(setTree, () => setFailed(true));
  }, [open, tree, loadTree]);

  useEffect(() => {
    if (open) {
      setSel(EMPTY);
      setMissing(null);
    }
  }, [open]);

  const choose = (level: keyof Selection, value: string) => {
    const index = LEVELS.findIndex((l) => l.key === level);
    const next = { ...sel, [level]: value };
    for (const later of LEVELS.slice(index + 1)) next[later.key] = "";
    setSel(next);
    setMissing(null);
  };

  const confirm = () => {
    const first = LEVELS.find((l) => !sel[l.key]);
    if (first) {
      setMissing(first.key);
      requestAnimationFrame(() => document.getElementById(`manual-${first.key}`)?.focus());
      return;
    }
    onConfirm({ reg, make: sel.make, model: sel.model, transmission: sel.transmission, year: Number(sel.year), variant: sel.variant, source: "manual" });
  };

  const visible = LEVELS.filter((l, i) => i === 0 || sel[LEVELS[i - 1]!.key]);

  return (
    <Dialog open={open} title="Find your car" onClose={onCancel} size="m">
      {failed ? (
        <p role="alert" className="mb-6 font-bold text-ink-error">
          We could not load the list of cars. Try again later.
        </p>
      ) : !tree ? (
        <p className="mb-6">Loading the list of cars…</p>
      ) : (
        <>
          <p className="mb-6">Choose your car’s details. Each answer narrows the next list.</p>
          {visible.map((level) => {
            const isMissing = missing === level.key;
            return (
              <FormGroup key={level.key} error={isMissing}>
                <label htmlFor={`manual-${level.key}`} className="mb-1 block font-bold">
                  {level.label}
                </label>
                {isMissing && <ErrorMessage id={`manual-${level.key}-error`}>{`Select the ${level.label.toLowerCase()}`}</ErrorMessage>}
                <select
                  id={`manual-${level.key}`}
                  value={sel[level.key]}
                  onChange={(e) => choose(level.key, e.target.value)}
                  aria-describedby={isMissing ? `manual-${level.key}-error` : undefined}
                  aria-invalid={isMissing || undefined}
                  className={cx(
                    "min-h-[var(--qf-size-target-min)] w-full max-w-[30rem] rounded-none border-[length:var(--qf-border-width-control)] bg-surface px-2 text-body focus:focus-ring",
                    isMissing ? "border-line-error" : "border-line-strong",
                  )}
                >
                  <option value="">Select</option>
                  {optionsFor(tree, sel, level.key).map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </FormGroup>
            );
          })}
        </>
      )}
      <div className="flex flex-wrap items-center gap-6">
        {tree && <Button onClick={confirm}>Use this car</Button>}
        <Button variant="link" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Dialog>
  );
}
