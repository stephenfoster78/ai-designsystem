import type { RawInput } from "@qf/journey-engine";
import type { ErrorView } from "@/lib/step-view";

export interface StepFormState {
  /** Increments on every failed submit, so inputs remount with the redisplayed values. */
  submission: number;
  errors: ErrorView[];
  /** What the user typed, redisplayed exactly when validation fails. */
  raw: RawInput | null;
}

export const initialStepFormState: StepFormState = { submission: 0, errors: [], raw: null };
