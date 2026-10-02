"use client";

import { useActionState, useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Button, ErrorSummary } from "@qf/design-system";
import { holds, readStep, type EvalContext, type Expr, type JsonValue, type StepDef } from "@qf/journey-engine";
import type { StepView } from "@/lib/step-view";
import type { StepFormState } from "@/app/quote/form-state";
import { initialStepFormState } from "@/app/quote/form-state";
import { Field } from "./Field";
import { RepeaterHost } from "./RepeaterHost";

type Action = (state: StepFormState, formData: FormData) => Promise<StepFormState>;

interface StepFormProps {
  step: StepDef;
  view: StepView;
  action: Action;
  /** Saved answers merged with initial values for this step. */
  values: Record<string, JsonValue>;
  ctx: EvalContext;
  /** Server-evaluated visibility, used when a condition needs a server-only predicate. */
  serverVisible: Record<string, boolean>;
  /** Look up the registration on first load (passed through from the direct site). */
  autoLookup?: string;
  saveLabel?: string;
}

// Set after the first page mounts, so later client-side navigations can move focus to the h1
// (the initial page load leaves focus at the top of the document, before the skip link).
let hasMountedBefore = false;

export function StepForm({ step, view, action, values, ctx, serverVisible, autoLookup, saveLabel = "Save and come back later" }: StepFormProps) {
  const [state, formAction] = useActionState(action, initialStepFormState);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [live, setLive] = useState<Record<string, JsonValue>>(values);

  useEffect(() => {
    if (hasMountedBefore && !state.errors.length) headingRef.current?.focus();
    hasMountedBefore = true;
    // Only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prefix the page title on errors (WCAG 2.4.2 / 3.3.1): it is the first thing announced.
  useEffect(() => {
    const base = document.title.replace(/^Error: /, "");
    document.title = state.errors.length ? `Error: ${base}` : base;
  }, [state]);

  // Conditional reveal: re-evaluate showWhen as the user answers.
  const onChange = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      const next = readStep(step, new FormData(event.currentTarget)).values;
      setLive((current) => ({ ...current, ...next }));
    },
    [step],
  );

  const visible = (id: string, expr: Expr | undefined) => {
    if (expr === undefined) return true;
    try {
      return holds(expr, { ...ctx, answers: { ...ctx.answers, ...live } });
    } catch {
      return serverVisible[id] ?? true;
    }
  };

  const errorFor = (id: string) => state.errors.find((e) => e.fieldId === id);

  return (
    <>
      <ErrorSummary items={state.errors.map((e) => ({ targetId: e.targetId, message: e.message }))} />
      <p className="mb-1 text-heading-s text-ink-muted">{view.sectionTitle}</p>
      <h1 ref={headingRef} tabIndex={-1} className="mb-8 text-heading-xl font-bold focus:outline-none">
        {view.title}
      </h1>
      <form action={formAction} onChange={onChange} noValidate>
        {step.groups.map((group) => {
          const groupView = view.groups.find((g) => g.id === group.id);
          // A field the server reported an error for is always shown: the server only validates
          // fields visible after the submit, and this keeps no-JavaScript submissions correct.
          const groupHasError = group.fields.some((f) => errorFor(f.id));
          return (
            <div key={group.id} hidden={!groupHasError && !visible(`group:${group.id}`, group.showWhen)}>
              {groupView?.legend && <h2 className="mb-4 text-heading-m font-bold">{groupView.legend}</h2>}
              {group.fields.map((field) => {
                const fieldView = view.fields[field.id]!;
                const shown = Boolean(errorFor(field.id)) || visible(field.id, field.showWhen);
                return (
                  <div key={`${field.id}-${state.submission}`} hidden={!shown} data-field={field.id}>
                    {field.type === "repeater" ? (
                      shown && <RepeaterHost stepId={step.id} field={field} view={fieldView} ctx={{ ...ctx, answers: { ...ctx.answers, ...live } }} error={errorFor(field.id)?.message} />
                    ) : (
                      <Field
                        field={fieldView}
                        value={values[field.id] ?? null}
                        raw={state.raw?.[field.id]}
                        error={errorFor(field.id)}
                        resolved={state.values?.[field.id]}
                        lookup={state.lookups?.[field.id]}
                        mode={state.modes?.[field.id]}
                        focusOnMount={state.focusField === field.id}
                        autoLookup={autoLookup === field.id && state.submission === 0}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
        <div className="mt-10 flex flex-wrap items-center gap-6">
          <Button type="submit" name="intent" value="continue">
            Continue
          </Button>
          <Button type="submit" name="intent" value="save" variant="link">
            {saveLabel}
          </Button>
        </div>
      </form>
    </>
  );
}

