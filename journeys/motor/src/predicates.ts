import type { Predicate } from "@qf/journey-engine";

/**
 * Named predicates for logic too complex for a schema expression. Referenced from the
 * schema as { "pred": "name" } and validated at definition time.
 */
export const predicates: Record<string, Predicate> = {
  isSignedIn: (ctx) => ctx.entry.identity === "signedIn",
};
