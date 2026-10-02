import { holds } from "./conditions";
import type { StepInput } from "./input";
import type { Journey } from "./journey";
import { validateFields } from "./validation";
import type { Answers, EvalContext, FieldDef, FieldErrors, SectionDef, StepDef } from "./types";

const withAnswers = (ctx: EvalContext, answers: Answers): EvalContext => ({ ...ctx, answers });

export function isStepActive(journey: Journey, step: StepDef, ctx: EvalContext): boolean {
  if (step.variants?.[ctx.entry.source]?.mode === "skip") return false;
  return step.skipWhen === undefined || !holds(step.skipWhen, ctx, journey.predicates);
}

export function activeSteps(journey: Journey, ctx: EvalContext): StepDef[] {
  return journey.steps.filter((step) => isStepActive(journey, step, ctx));
}

/** Fields the user can currently see on a step, given the answers so far. */
export function visibleFields(journey: Journey, step: StepDef, ctx: EvalContext): FieldDef[] {
  return step.groups
    .filter((group) => holds(group.showWhen, ctx, journey.predicates))
    .flatMap((group) => group.fields.filter((field) => holds(field.showWhen, ctx, journey.predicates)));
}

export function isStepComplete(journey: Journey, step: StepDef, ctx: EvalContext): boolean {
  const errors = validateFields(visibleFields(journey, step, ctx), ctx.answers, ctx);
  return Object.keys(errors).length === 0;
}

/** The first active step that is not yet valid, or null when every active step is complete. */
export function firstIncompleteStep(journey: Journey, ctx: EvalContext): StepDef | null {
  return activeSteps(journey, ctx).find((step) => !isStepComplete(journey, step, ctx)) ?? null;
}

export function navigation(journey: Journey, stepId: string, ctx: EvalContext): { previous: StepDef | null; next: StepDef | null } {
  const steps = activeSteps(journey, ctx);
  const index = steps.findIndex((s) => s.id === stepId);
  if (index === -1) return { previous: null, next: null };
  return { previous: steps[index - 1] ?? null, next: steps[index + 1] ?? null };
}

export type AccessResult = { ok: true } | { ok: false; redirectTo: StepDef | null };

/**
 * Route guard. A step can be opened when it is active and every active step before it is
 * complete, so deep links cannot skip questions. Completed steps can always be revisited.
 */
export function checkAccess(journey: Journey, stepId: string, ctx: EvalContext): AccessResult {
  const step = journey.stepById.get(stepId);
  const firstIncomplete = firstIncompleteStep(journey, ctx);
  if (!step || !isStepActive(journey, step, ctx)) return { ok: false, redirectTo: firstIncomplete };
  if (!firstIncomplete) return { ok: true };
  const steps = activeSteps(journey, ctx);
  const target = steps.indexOf(step);
  const limit = steps.indexOf(firstIncomplete);
  return target <= limit ? { ok: true } : { ok: false, redirectTo: firstIncomplete };
}

/**
 * Removes answers to fields that are no longer visible (a branch the user backed out of)
 * and to unknown keys. Repeats until stable, because removing one answer can hide others.
 * Run on the server before storing or pricing, so stale answers never reach a quote.
 */
export function sanitiseAnswers(journey: Journey, answers: Answers, ctx: EvalContext): Answers {
  let current = { ...answers };
  for (let pass = 0; pass < 10; pass++) {
    const passCtx = withAnswers(ctx, current);
    const visible = new Set(
      activeSteps(journey, passCtx).flatMap((step) => visibleFields(journey, step, passCtx).map((f) => f.id)),
    );
    const next = Object.fromEntries(Object.entries(current).filter(([id]) => visible.has(id)));
    if (Object.keys(next).length === Object.keys(current).length) return next;
    current = next;
  }
  throw new Error("sanitiseAnswers did not converge: check for circular showWhen conditions");
}

export type CommitResult =
  | { ok: true; answers: Answers }
  | { ok: false; errors: FieldErrors; answers: Answers };

/**
 * Applies a step submission: merges the input over existing answers, validates the fields
 * visible after the merge, and returns sanitised answers. Pure, so it is unit-testable and
 * safe to run on the server for every submit.
 */
export function commitStep(journey: Journey, step: StepDef, input: StepInput, ctx: EvalContext): CommitResult {
  const merged = { ...ctx.answers, ...input.values };
  const mergedCtx = withAnswers(ctx, merged);
  const errors = validateFields(visibleFields(journey, step, mergedCtx), merged, mergedCtx, input.parseErrors);
  if (Object.keys(errors).length > 0) return { ok: false, errors, answers: ctx.answers };
  return { ok: true, answers: sanitiseAnswers(journey, merged, mergedCtx) };
}

/**
 * "Save and come back later": keeps the valid parts of a submission and discards the rest,
 * so a partly completed step can be saved without storing invalid data. The step stays
 * incomplete, and the route guard brings the user back to it on resume.
 */
export function commitValid(journey: Journey, step: StepDef, input: StepInput, ctx: EvalContext): Answers {
  const merged = { ...ctx.answers, ...input.values };
  const mergedCtx = withAnswers(ctx, merged);
  const errors = validateFields(visibleFields(journey, step, mergedCtx), merged, mergedCtx, input.parseErrors);
  const kept = { ...merged };
  for (const id of Object.keys(errors)) {
    if (id in ctx.answers) kept[id] = ctx.answers[id] as Answers[string];
    else delete kept[id];
  }
  return sanitiseAnswers(journey, kept, withAnswers(ctx, kept));
}

export type SectionStatus ="complete" | "current" | "upcoming";

export interface SectionProgress {
  section: SectionDef;
  status: SectionStatus;
  /** First active step in the section, for "change" links. */
  firstStep: StepDef;
}

export function sectionProgress(journey: Journey, ctx: EvalContext, currentStepId: string | null): SectionProgress[] {
  const steps = activeSteps(journey, ctx);
  const current = currentStepId ? journey.stepById.get(currentStepId) : undefined;
  return journey.sections.flatMap((section): SectionProgress[] => {
    const inSection = steps.filter((s) => s.section === section.id);
    const firstStep = inSection[0];
    if (!firstStep) return [];
    let status: SectionStatus;
    if (current?.section === section.id) status = "current";
    else if (inSection.every((s) => isStepComplete(journey, s, ctx))) status = "complete";
    else status = "upcoming";
    return [{ section, status, firstStep }];
  });
}
