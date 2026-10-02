"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  activeItemSteps,
  checkAccess,
  commitItemStep,
  commitStep,
  commitValid,
  firstIncompleteStep,
  ITEM_ID,
  navigation,
  parseDateParts,
  readStep,
  removeItem,
  repeaterField,
  upsertItem,
  type Answers,
  type FieldErrors,
  type JsonValue,
  type StepDef,
} from "@qf/journey-engine";
import { normaliseReg } from "@qf/adapters";
import { motorJourney } from "@qf/journey-motor";
import { config } from "@/lib/config";
import { enrichInput, runLookup, type LookupResult } from "@/lib/enrich";
import { resolveEntry } from "@/lib/entry";
import { paths } from "@/lib/paths";
import { evalContext, readQuoteSession, remainingMs, touchQuoteSession } from "@/lib/quote-session";
import { services } from "@/lib/services";
import { errorView, type ErrorView } from "@/lib/step-view";
import type { StepFormState } from "./form-state";

async function setSessionCookie(sessionId: string) {
  (await cookies()).set(config.sessionCookie, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

function errorViews(errors: FieldErrors, options: { addressListShown?: Set<string> } = {}): ErrorView[] {
  return Object.entries(errors).map(([fieldId, error]) => {
    const entry = motorJourney.fieldById.get(fieldId);
    if (!entry) throw new Error(`Unknown field ${fieldId}`);
    return errorView(entry.field, error, services.content, { addressListShown: options.addressListShown?.has(fieldId) });
  });
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

export interface StartState {
  error?: string;
}

/** Starts a new quote once the user confirms they meet the eligibility conditions. */
export async function startQuote(_previous: StartState, formData: FormData): Promise<StartState> {
  if (formData.get("eligible") !== "true") return { error: "Confirm you meet the conditions to get a quote online" };
  const reg = formData.get("reg");
  const entry = resolveEntry({ reg: typeof reg === "string" ? reg : null });
  const draft = await services.drafts.create({ journeyId: motorJourney.id, entry });
  // Evidence of the eligibility statement the customer confirmed (content version).
  await services.drafts.save(draft.id, { contentSeen: { "start:eligibility": services.content.version } });
  const session = await services.sessions.create(draft.id);
  await setSessionCookie(session.id);
  const first = motorJourney.steps[0];
  if (!first) throw new Error("Journey has no steps");
  redirect(paths.step(first));
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

async function requireAccessibleStep(stepId: string) {
  const quote = await readQuoteSession();
  if (quote.state === "ended") redirect(paths.sessionEnded);
  if (quote.state === "none") redirect(paths.start);
  const step = motorJourney.stepById.get(stepId);
  if (!step) notFound();
  const ctx = evalContext(quote.draft);
  const access = checkAccess(motorJourney, step.id, ctx);
  if (!access.ok) redirect(access.redirectTo ? paths.step(access.redirectTo) : paths.check);
  await touchQuoteSession(quote.session);
  return { quote, step, ctx };
}

const compositeValues = (step: StepDef, values: Answers) =>
  Object.fromEntries(
    step.groups
      .flatMap((g) => g.fields)
      .filter((f) => f.type === "vehicle" || f.type === "address")
      .map((f) => [f.id, values[f.id] ?? null]),
  ) as Record<string, JsonValue>;

/**
 * Handles a step submit.
 * - intent "lookup:<field>" runs a car or address lookup and returns without saving.
 * - intent "manual:<field>" / "reset:<field>" switch a composite field's mode (no-JavaScript path).
 * - intent "save" keeps the valid answers and goes to the saved page.
 * - otherwise: validate, autosave, issue the reference on first save, and move on.
 */
export async function submitStep(stepId: string, previous: StepFormState, formData: FormData): Promise<StepFormState> {
  const { quote, step, ctx } = await requireAccessibleStep(stepId);
  const intent = String(formData.get("intent") ?? "continue");
  const [verb, target] = intent.split(":");
  const base = { submission: previous.submission + 1, errors: [] as ErrorView[] };

  if (target && (verb === "lookup" || verb === "manual" || verb === "reset")) {
    const field = step.groups.flatMap((g) => g.fields).find((f) => f.id === target);
    if (!field) return { ...base, raw: null };
    const input = readStep(step, formData, { today: ctx.today });
    if (verb === "lookup") {
      const lookup = await runLookup(field, input, (key) => services.content.t(key, { label: services.content.t(`${field.id}.label`) }));
      return { ...base, raw: input.raw, lookups: { [field.id]: lookup }, focusField: field.id };
    }
    return { ...base, raw: input.raw, modes: { [field.id]: verb }, focusField: field.id };
  }

  const input = await enrichInput(step.groups, readStep(step, formData, { today: ctx.today }));

  if (intent === "save") {
    const answers = commitValid(motorJourney, step, input, ctx);
    await services.drafts.save(quote.draft.id, { answers });
    await services.drafts.ensureReference(quote.draft.id);
    redirect(paths.saved);
  }

  const result = commitStep(motorJourney, step, input, ctx);
  if (!result.ok) {
    // Bring back the address list when the user found addresses but did not choose one.
    const lookups: Record<string, LookupResult> = {};
    for (const [fieldId, error] of Object.entries(result.errors)) {
      const field = motorJourney.fieldById.get(fieldId)?.field;
      if (field?.type === "address" && error.code === "addressNotSelected") {
        lookups[fieldId] = await runLookup(field, input, (key) => services.content.t(key));
      }
    }
    const listed = new Set(Object.entries(lookups).filter(([, l]) => l.status === "found").map(([id]) => id));
    return { ...base, errors: errorViews(result.errors, { addressListShown: listed }), raw: input.raw, values: compositeValues(step, input.values), lookups };
  }

  await services.drafts.save(quote.draft.id, { answers: result.answers, contentSeen: { [step.id]: services.content.version } });
  await services.drafts.ensureReference(quote.draft.id);
  const { next } = navigation(motorJourney, step.id, { ...ctx, answers: result.answers });
  redirect(next ? paths.step(next) : paths.check);
}

// ---------------------------------------------------------------------------
// Repeater items (modal journeys)
// ---------------------------------------------------------------------------

export interface ItemStepResult {
  errors: ErrorView[];
  raw: Record<string, unknown> | null;
  /** The item with this step's answers merged in. */
  item?: Answers;
  /** Next item step to show, or null when the item was saved. */
  next?: string | null;
}

/**
 * Validates one step of an item's modal journey. On the last active step the whole item is
 * validated again and saved to the draft. The client holds the partly completed item between
 * steps; nothing it sends is trusted without validation.
 */
export async function saveItemStep(stepId: string, fieldId: string, itemStepId: string, itemJson: string, formData: FormData): Promise<ItemStepResult> {
  const { quote, step, ctx } = await requireAccessibleStep(stepId);
  const field = repeaterField(motorJourney, fieldId);
  if (motorJourney.fieldById.get(fieldId)?.step.id !== step.id) notFound();
  const itemStep = field.repeater!.steps.find((s) => s.id === itemStepId);
  if (!itemStep) notFound();

  let item: Answers;
  try {
    const parsed = JSON.parse(itemJson) as unknown;
    item = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Answers) : {};
  } catch {
    item = {};
  }
  // Ids are issued by the server; an id must already belong to this draft to edit that item.
  const existing = Array.isArray(ctx.answers[fieldId]) ? (ctx.answers[fieldId] as Answers[]) : [];
  if (typeof item[ITEM_ID] !== "string" || !existing.some((i) => i[ITEM_ID] === item[ITEM_ID])) item[ITEM_ID] = randomUUID();

  const input = await enrichInput(itemStep.groups, readStep(itemStep, formData, { today: ctx.today }));
  const result = commitItemStep(motorJourney, itemStep, input, item, ctx);
  if (!result.ok) return { errors: errorViews(result.errors), raw: input.raw };

  const steps = activeItemSteps(motorJourney, field, result.item, ctx);
  const next = steps[steps.findIndex((s) => s.id === itemStepId) + 1];
  if (next) return { errors: [], raw: null, item: result.item, next: next.id };

  const saved = upsertItem(motorJourney, fieldId, result.item, ctx);
  if (!saved.ok) return { errors: errorViews(saved.errors), raw: null, item: result.item };
  await services.drafts.save(quote.draft.id, { answers: saved.answers });
  await services.drafts.ensureReference(quote.draft.id);
  return { errors: [], raw: null, item: result.item, next: null };
}

export async function removeRepeaterItem(stepId: string, fieldId: string, itemId: string): Promise<void> {
  const { quote, ctx } = await requireAccessibleStep(stepId);
  if (motorJourney.fieldById.get(fieldId)?.step.id !== stepId) notFound();
  await services.drafts.save(quote.draft.id, { answers: removeItem(motorJourney, fieldId, itemId, ctx) });
}

// ---------------------------------------------------------------------------
// Resume
// ---------------------------------------------------------------------------

export interface ResumeState {
  errors: Array<{ targetId: string; message: string }>;
  values?: Record<string, string>;
}

const GENERIC_FAILURE = "We could not find a saved quote with those details. Check them and try again.";

/**
 * Resumes a saved quote with its reference plus a second factor: date of birth, or the car
 * registration if the quote was saved before date of birth was given. Five failures lock the
 * reference for 15 minutes. Messages never reveal whether a reference exists.
 */
export async function resumeQuote(_previous: ResumeState, formData: FormData): Promise<ResumeState> {
  const reference = String(formData.get("reference") ?? "").trim().toUpperCase();
  const day = String(formData.get("resumeDob-day") ?? "");
  const month = String(formData.get("resumeDob-month") ?? "");
  const year = String(formData.get("resumeDob-year") ?? "");
  const reg = normaliseReg(String(formData.get("resumeReg") ?? ""));
  const values = { reference, day, month, year, reg };

  const errors: ResumeState["errors"] = [];
  if (!reference) errors.push({ targetId: "reference", message: "Enter your quote reference" });
  const dob = parseDateParts({ day, month, year });
  if (!dob.ok) errors.push({ targetId: "resumeDob-input", message: "Date of birth must be a real date" });
  if (dob.ok && !dob.value && !reg) errors.push({ targetId: "resumeDob-input", message: "Enter your date of birth" });
  if (errors.length) return { errors, values };

  const limit = await services.resumeLimiter.check(reference);
  if (!limit.allowed) {
    const minutes = Math.ceil(limit.retryAfterMs / 60_000);
    return { errors: [{ targetId: "reference", message: `You’ve tried too many times. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}, or call us.` }], values };
  }

  const draft = await services.drafts.findByReference(reference);
  const answers = draft?.answers ?? {};
  const savedReg = typeof answers.registration === "object" && answers.registration && !Array.isArray(answers.registration) ? String((answers.registration as Record<string, JsonValue>).reg ?? "") : "";
  const matches =
    draft !== null &&
    draft.status !== "purchased" &&
    (typeof answers.dateOfBirth === "string"
      ? dob.ok && dob.value === answers.dateOfBirth
      : Boolean(reg) && reg === normaliseReg(savedReg));

  if (!matches || !draft) {
    await services.resumeLimiter.recordFailure(reference);
    return { errors: [{ targetId: "reference", message: GENERIC_FAILURE }], values };
  }

  await services.resumeLimiter.reset(reference);
  const session = await services.sessions.create(draft.id);
  await setSessionCookie(session.id);
  const next = firstIncompleteStep(motorJourney, evalContext(draft));
  redirect(next ? paths.step(next) : paths.check);
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

/** Extends the session from the timeout warning. Returns the new remaining time in ms. */
export async function extendSession(): Promise<number> {
  const quote = await readQuoteSession();
  if (quote.state !== "active") throw new Error("Session is no longer active");
  return remainingMs(await touchQuoteSession(quote.session));
}

/** Ends the session (timeout or user choice). The draft is already saved. */
export async function endSession(): Promise<void> {
  const quote = await readQuoteSession();
  if (quote.state === "active") {
    await services.drafts.ensureReference(quote.draft.id);
    await services.sessions.end(quote.session.id);
  }
}
