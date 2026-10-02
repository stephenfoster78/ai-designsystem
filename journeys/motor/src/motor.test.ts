import { describe, expect, it } from "vitest";
import { activeSteps, commitStep, readStep, type EvalContext } from "@qf/journey-engine";
import { motorContent, motorJourney } from "./index";

const ctx: EvalContext = { answers: {}, entry: { source: "direct", identity: "guest", coverSet: "direct" }, today: "2026-10-02" };

describe("motor journey content", () => {
  // Every key the schema needs must exist, so missing copy fails in CI rather than in front of a customer.
  const missing: string[] = [];
  for (const section of motorJourney.sections) {
    const key = section.titleKey ?? `section.${section.id}.title`;
    if (!(key in motorContent)) missing.push(key);
  }
  for (const step of motorJourney.steps) {
    const title = step.titleKey ?? `step.${step.id}.title`;
    if (!(title in motorContent)) missing.push(title);
    for (const group of step.groups) {
      for (const field of group.fields) {
        const label = field.labelKey ?? `${field.id}.label`;
        if (!(label in motorContent)) missing.push(label);
        for (const option of field.options ?? []) {
          const optionKey = option.labelKey ?? `${field.id}.option.${option.value}`;
          if (!(optionKey in motorContent)) missing.push(optionKey);
        }
        if (field.required && !(`${field.id}.error.required` in motorContent)) missing.push(`${field.id}.error.required`);
      }
    }
  }

  it("has copy for every section, step, field, option and required error", () => {
    expect(missing).toEqual([]);
  });
});

describe("motor journey schema", () => {
  it("starts with the car section", () => {
    expect(activeSteps(motorJourney, ctx).map((s) => s.path)).toEqual(["car/registration", "car/usage", "you/details"]);
  });

  it("asks for the overnight postcode only when the car is not kept at home", () => {
    const step = motorJourney.stepById.get("carUsage")!;
    const base = { purchased: "notYet", legalOwner: "proposer", usage: "sdp", overnightLocation: "road" };
    const form = (extra: Record<string, string>) => {
      const fd = new FormData();
      for (const [k, v] of Object.entries({ ...base, ...extra })) fd.append(k, v);
      return fd;
    };
    expect(commitStep(motorJourney, step, readStep(step, form({ keptAtHome: "yes" })), ctx).ok).toBe(true);
    expect(commitStep(motorJourney, step, readStep(step, form({ keptAtHome: "no" })), ctx)).toMatchObject({
      ok: false,
      errors: { overnightPostcode: { code: "required" } },
    });
    expect(commitStep(motorJourney, step, readStep(step, form({ keptAtHome: "no", overnightPostcode: "ls1 4ap" })), ctx).ok).toBe(true);
  });
});
