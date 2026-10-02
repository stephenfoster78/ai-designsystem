import "server-only";
import { cookies } from "next/headers";
import { isActive, type Draft, type Session } from "@qf/adapters";
import { todayIn, type EvalContext } from "@qf/journey-engine";
import { config } from "./config";
import { services } from "./services";

export type QuoteSession =
  | { state: "none" }
  | { state: "ended"; session: Session; draft: Draft | null }
  | { state: "active"; session: Session; draft: Draft };

/** Reads the session cookie and resolves the session and its draft. Does not record activity. */
export async function readQuoteSession(): Promise<QuoteSession> {
  const id = (await cookies()).get(config.sessionCookie)?.value;
  if (!id) return { state: "none" };
  const session = await services.sessions.get(id);
  if (!session) return { state: "none" };
  const draft = await services.drafts.get(session.draftId);
  if (!isActive(session) || !draft) return { state: "ended", session, draft };
  return { state: "active", session, draft };
}

/** Records activity (a page view or submit), pushing the idle expiry out. */
export async function touchQuoteSession(session: Session): Promise<Session> {
  return (await services.sessions.touch(session.id)) ?? session;
}

export function evalContext(draft: Draft): EvalContext {
  return { answers: draft.answers, entry: draft.entry, today: todayIn(config.timeZone) };
}

export function remainingMs(session: Session): number {
  return Math.max(0, session.expiresAt - Date.now());
}
