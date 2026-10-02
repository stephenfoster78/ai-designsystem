import type { StepDef } from "@qf/journey-engine";

export const paths = {
  start: "/quote/start",
  saved: "/quote/saved",
  check: "/quote/check",
  sessionEnded: "/quote/session-ended",
  step: (step: Pick<StepDef, "path">) => `/quote/${step.path}`,
};
