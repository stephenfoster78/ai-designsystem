import { describe, expect, it } from "vitest";
import { activeSteps, commitStep, readStep, type EvalContext } from "@qf/journey-engine";
import { motorContent, motorJourney } from "./index";

const ctx = (identity: "guest" | "signedIn" = "guest"): EvalContext => ({
  answers: {},
  entry: { source: "direct", identity, coverSet: "direct" },
  today: "2026-10-02",
});

describe("motor journey content", () => {
  // Every key the schema needs must exist, so missing copy fails in CI rather than in front of a customer.
  const missing: string[] = [];
  const need = (key: string) => {
    if (!(key in motorContent)) missing.push(key);
  };
  for (const section of motorJourney.sections) need(section.titleKey ?? `section.${section.id}.title`);
  for (const step of motorJourney.steps) need(step.titleKey ?? `step.${step.id}.title`);
  for (const { field } of motorJourney.fieldById.values()) {
    need(field.labelKey ?? `${field.id}.label`);
    for (const option of [...(field.options ?? []), ...(field.optionsFrom?.prepend ?? [])]) {
      if (option.label) continue; // reference data carries its own label
      need(option.labelKey ?? `${field.id}.option.${option.value}`);
    }
    if (field.required) need(`${field.id}.error.required`);
    if (field.type === "repeater") {
      for (const key of ["add", "addAnother", "noun", "item.title", "item.editTitle", "added", "error.itemIncomplete"]) need(`${field.id}.${key}`);
      for (const itemStep of field.repeater!.steps) need(itemStep.titleKey ?? `${field.id}.step.${itemStep.id}.title`);
    }
    for (const rule of field.validate ?? []) {
      if ("code" in rule && rule.code) {
        if (!(`${field.id}.error.${rule.code}` in motorContent) && !(`error.${rule.code}` in motorContent)) missing.push(`${field.id}.error.${rule.code}`);
      }
    }
  }

  it("has copy for every section, step, field, option, required error and custom rule", () => {
    expect(missing).toEqual([]);
  });
});

describe("motor journey schema", () => {
  it("runs through screens 2–11 for a guest and skips sign-in when signed in", () => {
    expect(activeSteps(motorJourney, ctx()).map((s) => s.path)).toEqual([
      "car/registration",
      "car/usage",
      "you/sign-in",
      "you/details",
      "you/occupation",
      "you/licence",
      "drivers/additional-drivers",
      "drivers/household-cars",
      "history/claims-convictions",
      "history/no-claims",
    ]);
    expect(activeSteps(motorJourney, ctx("signedIn")).map((s) => s.path)).not.toContain("you/sign-in");
  });

  it("asks for the overnight postcode only when the car is not kept at home, and rejects Crown Dependencies", () => {
    const step = motorJourney.stepById.get("carUsage")!;
    const base = { purchased: "notYet", carValue: "8000", legalOwner: "proposer", registeredKeeper: "proposer", usage: "sdp", overnightLocation: "road" };
    const form = (extra: Record<string, string>) => {
      const fd = new FormData();
      for (const [k, v] of Object.entries({ ...base, ...extra })) fd.append(k, v);
      return fd;
    };
    expect(commitStep(motorJourney, step, readStep(step, form({ keptAtHome: "yes" })), ctx()).ok).toBe(true);
    expect(commitStep(motorJourney, step, readStep(step, form({ keptAtHome: "no" })), ctx())).toMatchObject({ ok: false, errors: { overnightPostcode: { code: "required" } } });
    expect(commitStep(motorJourney, step, readStep(step, form({ keptAtHome: "no", overnightPostcode: "je2 3ab" })), ctx())).toMatchObject({
      ok: false,
      errors: { overnightPostcode: { code: "outsideUk" } },
    });
    expect(commitStep(motorJourney, step, readStep(step, form({ keptAtHome: "no", overnightPostcode: "ls1 4ap" })), ctx()).ok).toBe(true);
  });

  it("only lets guests continue as a guest until sign-in exists", () => {
    const step = motorJourney.stepById.get("signIn")!;
    const fd = new FormData();
    fd.append("accountChoice", "signIn");
    expect(commitStep(motorJourney, step, readStep(step, fd), ctx())).toMatchObject({ ok: false, errors: { accountChoice: { code: "notAvailable" } } });
  });
});
