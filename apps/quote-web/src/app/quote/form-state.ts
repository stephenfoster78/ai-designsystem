import type { JsonValue, RawInput } from "@qf/journey-engine";
import type { LookupResult } from "@/lib/enrich";
import type { ErrorView } from "@/lib/step-view";

export interface StepFormState {
  /** Increments on every server response, so inputs remount with the redisplayed values. */
  submission: number;
  errors: ErrorView[];
  /** What the user typed, redisplayed exactly when validation fails. */
  raw: RawInput | null;
  /** Server-resolved composite values (vehicle, address) from this submit, for redisplay. */
  values?: Record<string, JsonValue>;
  /** Result of a "Find car" / "Find address" submit. */
  lookups?: Record<string, LookupResult>;
  /** Composite fields switched to manual entry, or reset, by a no-JavaScript submit. */
  modes?: Record<string, "manual" | "reset">;
  /** Field to move focus to after this response (the one the user just acted on). */
  focusField?: string;
}

export const initialStepFormState: StepFormState = { submission: 0, errors: [], raw: null };
