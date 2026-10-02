"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { AddAnotherList, Button, Dialog, ErrorSummary } from "@qf/design-system";
import { holds, readStep, type Answers, type EvalContext, type FieldDef, type JsonValue } from "@qf/journey-engine";
import { removeRepeaterItem, saveItemStep, type ItemStepResult } from "@/app/quote/actions";
import type { FieldView } from "@/lib/step-view";
import { Field } from "./Field";

interface RepeaterHostProps {
  stepId: string;
  field: FieldDef;
  view: FieldView;
  ctx: EvalContext;
  error?: string;
}

type Editing = { item: Answers; stepIndex: number; isNew: boolean };

/**
 * Hosts a repeater: the "add another" list on the page, and a modal journey for adding or
 * changing one item, one item step at a time. Each step is validated on the server; the item
 * is saved to the draft after its last step, then the page refreshes to show it.
 *
 * The modal is portalled to <body> so its forms are not nested inside the step's form.
 */
export function RepeaterHost({ stepId, field, view, ctx, error }: RepeaterHostProps) {
  const repeater = view.repeater!;
  const router = useRouter();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [result, setResult] = useState<ItemStepResult | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [pending, startTransition] = useTransition();
  const [live, setLive] = useState<Answers>({});
  const [mounted, setMounted] = useState(false);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => setMounted(true), []);

  const itemCtx = (item: Answers): EvalContext => ({ ...ctx, answers: { ...ctx.answers, ...item, ...live } });
  // Item steps with at least one visible field for the item so far.
  const steps = (item: Answers) =>
    field.repeater!.steps.filter((s) => s.groups.some((g) => holds(g.showWhen, itemCtx(item)) && g.fields.some((f) => holds(f.showWhen, itemCtx(item)))));

  const open = (item: Answers, isNew: boolean) => {
    setEditing({ item, stepIndex: 0, isNew });
    setResult(null);
    setLive({});
  };

  const close = () => {
    setEditing(null);
    setResult(null);
  };

  const current = editing ? steps(editing.item)[editing.stepIndex] : undefined;
  const stepView = current ? repeater.steps.find((s) => s.id === current.id) : undefined;
  const total = editing ? steps(editing.item).length : 0;

  useEffect(() => {
    // Move focus to the new step's heading so screen reader users know the content changed.
    if (editing && editing.stepIndex > 0) stepHeadingRef.current?.focus();
  }, [editing?.stepIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!editing || !current) return;
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const response = await saveItemStep(stepId, field.id, current.id, JSON.stringify(editing.item), formData);
      setAttempt((n) => n + 1);
      if (response.errors.length) {
        setResult(response);
        return;
      }
      setResult(null);
      setLive({});
      if (response.next && response.item) {
        const nextIndex = steps(response.item).findIndex((s) => s.id === response.next);
        setEditing({ ...editing, item: response.item, stepIndex: nextIndex });
        return;
      }
      close();
      setAnnouncement(repeater.addedText);
      router.refresh();
    });
  };

  const back = () => {
    if (!editing || editing.stepIndex === 0) return close();
    setResult(null);
    setEditing({ ...editing, stepIndex: editing.stepIndex - 1 });
  };

  const values = editing?.item ?? {};
  const errorFor = (id: string) => result?.errors.find((e) => e.fieldId === id);

  return (
    <>
      <p className="visually-hidden" role="status">
        {announcement}
      </p>
      <AddAnotherList
        id={field.id}
        label={view.label}
        hint={view.hint}
        error={error}
        items={repeater.items.map((i) => ({ id: i.id, label: i.label }))}
        addLabel={repeater.items.length ? repeater.addAnotherLabel : repeater.addLabel}
        emptyText={repeater.emptyText}
        maxItems={repeater.maxItems}
        maxReachedText={repeater.maxText}
        itemNoun={repeater.noun}
        onAdd={() => open({}, true)}
        onChange={(id) => {
          const item = repeater.items.find((i) => i.id === id);
          if (item) open(item.answers, false);
        }}
        onRemove={(id) =>
          new Promise<void>((resolve) =>
            startTransition(async () => {
              await removeRepeaterItem(stepId, field.id, id);
              router.refresh();
              resolve();
            }),
          )
        }
      />
      <noscript>
        <p className="font-bold">You need to turn on JavaScript to add {repeater.noun}s.</p>
      </noscript>
      {mounted &&
        createPortal(
          <Dialog open={Boolean(editing)} title={editing?.isNew ? repeater.itemTitle : repeater.itemEditTitle} onClose={close} size="l">
            {editing && current && stepView && (
              <form key={`${current.id}-${attempt}`} onSubmit={submit} onChange={(e) => setLive(readStep(current, new FormData(e.currentTarget)).values)} noValidate>
                <ErrorSummary items={(result?.errors ?? []).map((e) => ({ targetId: e.targetId, message: e.message }))} />
                {total > 1 && (
                  <p className="mb-1 text-body-small text-ink-muted">
                    Step {editing.stepIndex + 1} of {total}
                  </p>
                )}
                <h3 ref={stepHeadingRef} tabIndex={-1} className="mb-6 text-heading-m font-bold focus:outline-none">
                  {stepView.title}
                </h3>
                {current.groups.map((group) =>
                  group.fields.map((f) => {
                    const shown = Boolean(errorFor(f.id)) || (holds(group.showWhen, itemCtx(values)) && holds(f.showWhen, itemCtx(values)));
                    return (
                      <div key={f.id} hidden={!shown}>
                        <Field
                          field={repeater.fields[f.id]!}
                          value={(values[f.id] ?? null) as JsonValue}
                          raw={result?.raw?.[f.id] as never}
                          error={errorFor(f.id)}
                        />
                      </div>
                    );
                  }),
                )}
                <div className="flex flex-wrap items-center gap-6">
                  <Button type="submit" disabled={pending} aria-disabled={pending || undefined}>
                    {editing.stepIndex + 1 < total ? "Continue" : `Save ${repeater.noun}`}
                  </Button>
                  <Button variant="link" onClick={back}>
                    {editing.stepIndex === 0 ? "Cancel" : "Back"}
                  </Button>
                </div>
              </form>
            )}
          </Dialog>,
          document.body,
        )}
    </>
  );
}
