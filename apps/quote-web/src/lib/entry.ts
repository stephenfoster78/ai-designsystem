import { normaliseReg, REG_PATTERN } from "@qf/adapters";
import type { EntryContext } from "@qf/journey-engine";

/**
 * Resolves how the user arrived. Milestone 1 handles the direct site: a guest, optionally
 * with a registration typed on the direct site (?reg=). Other sources are stubs.
 *
 * Identity never comes from the URL. A signed-in handoff will use a short-lived, single-use
 * token exchanged server-side for the customer id (milestone 4).
 */
export function resolveEntry(input: { reg?: string | null }): EntryContext {
  const reg = input.reg ? normaliseReg(input.reg) : "";
  return {
    source: "direct",
    identity: "guest",
    coverSet: "direct",
    prefill: REG_PATTERN.test(reg) ? { reg } : undefined,
  };
}

/** Cleans a ?reg= value for display on the start page, or returns null if invalid. */
export function cleanRegParam(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return null;
  const reg = normaliseReg(raw);
  return REG_PATTERN.test(reg) ? reg : null;
}
