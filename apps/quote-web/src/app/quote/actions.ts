"use server";

import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { checkAccess, commitStep, commitValid, navigation, readStep } from "@qf/journey-engine";
import { motorJourney } from "@qf/journey-motor";
import { config } from "@/lib/config";
import { resolveEntry } from "@/lib/entry";
import { paths } from "@/lib/paths";
import { evalContext, readQuoteSession, remainingMs, touchQuoteSession } from "@/lib/quote-session";
import { services } from "@/lib/services";
import { errorView } from "@/lib/step-view";
import type { StepFormState } from "./form-state";

/** Starts a new quote: creates a draft and a session, then goes to the first step. */
export async function startQuote(formData: FormData): Promise<void> {
  const reg = formData.get("reg");
  const entry = resolveEntry({ reg: typeof reg === "string" ? reg : null });
  const draft = await services.drafts.create({ journeyId: motorJourney.id, entry });
  const session = await services.sessions.create(draft.id);
  (await cookies()).set(config.sessionCookie, session.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  const first = motorJourney.steps[0];
  if (!first) throw new Error("Journey has no steps");
  redirect(paths.step(first));
}

/**
 * Handles a step submit. Valid → saves (autosave on every step), issues the quote reference
 * on the first save and moves on. Invalid → returns errors and the raw input for redisplay.
 * Intent "save" keeps the valid answers and goes to the saved page.
 */
export async function submitStep(stepId: string, previous: StepFormState, formData: FormData): Promise<StepFormState> {
  const quote = await readQuoteSession();
  if (quote.state === "ended") redirect(paths.sessionEnded);
  if (quote.state === "none") redirect(paths.start);

  const step = motorJourney.stepById.get(stepId);
  if (!step) notFound();

  const ctx = evalContext(quote.draft);
  const access = checkAccess(motorJourney, step.id, ctx);
  if (!access.ok) redirect(access.redirectTo ? paths.step(access.redirectTo) : paths.check);

  const input = readStep(step, formData);
  await touchQuoteSession(quote.session);

  if (formData.get("intent") === "save") {
    const answers = commitValid(motorJourney, step, input, ctx);
    await services.drafts.save(quote.draft.id, { answers });
    await services.drafts.ensureReference(quote.draft.id);
    redirect(paths.saved);
  }

  const result = commitStep(motorJourney, step, input, ctx);
  if (!result.ok) {
    const errors = Object.entries(result.errors).map(([fieldId, error]) => {
      const entry = motorJourney.fieldById.get(fieldId);
      if (!entry) throw new Error(`Unknown field ${fieldId}`);
      return errorView(entry.field, error, services.content);
    });
    return { submission: previous.submission + 1, errors, raw: input.raw };
  }

  await services.drafts.save(quote.draft.id, { answers: result.answers, contentSeen: { [step.id]: services.content.version } });
  await services.drafts.ensureReference(quote.draft.id);
  const { next } = navigation(motorJourney, step.id, { ...ctx, answers: result.answers });
  redirect(next ? paths.step(next) : paths.check);
}

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
