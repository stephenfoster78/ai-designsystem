import { describe, expect, it } from "vitest";
import { commitStep, defineJourney, parseUkDate, readStep, type EvalContext } from "./index";

describe("parseUkDate", () => {
  it.each([
    ["15/10/2026", "2026-10-15"],
    ["15-10-2026", "2026-10-15"],
    ["15.10.2026", "2026-10-15"],
    ["15 10 2026", "2026-10-15"],
    [" 1/2/2027 ", "2027-02-01"],
    ["15102026", "2026-10-15"],
    ["151026", "2026-10-15"],
    ["15/10/26", "2026-10-15"],
  ])("parses %s", (text, iso) => {
    expect(parseUkDate(text)).toEqual({ ok: true, value: iso });
  });

  it.each(["31/02/2026", "15/13/2026", "2026-10-15", "15/10", "fifteen", "1510202"])("rejects %s", (text) => {
    expect(parseUkDate(text)).toEqual({ ok: false, code: "invalidDate" });
  });

  it("treats empty as no value", () => {
    expect(parseUkDate("  ")).toEqual({ ok: true, value: null });
  });
});

describe("startDate field", () => {
  const journey = defineJourney({
    id: "t",
    basePath: "/q",
    sections: [{ id: "s" }],
    steps: [
      {
        id: "cover",
        section: "s",
        path: "cover",
        groups: [{ id: "g", fields: [{ id: "coverStart", type: "startDate", required: true, validate: [{ rule: "notPast" }, { rule: "maxDaysAhead", value: 30 }] }] }],
      },
    ],
  });
  const step = journey.stepById.get("cover")!;
  const TODAY = "2026-12-20";
  const ctx: EvalContext = { answers: {}, entry: { source: "direct", identity: "guest", coverSet: "direct" }, today: TODAY };
  const submit = (entries: Record<string, string>) => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(entries)) fd.append(k, v);
    return commitStep(journey, step, readStep(step, fd, { today: TODAY }), ctx);
  };

  it("resolves today and tomorrow on the server, across a year end", () => {
    expect(submit({ "coverStart-choice": "today" })).toEqual({ ok: true, answers: { coverStart: "2026-12-20" } });
    expect(submit({ "coverStart-choice": "tomorrow", coverStart: "ignored" })).toEqual({ ok: true, answers: { coverStart: "2026-12-21" } });
  });

  it("validates the typed date for another date", () => {
    expect(submit({})).toMatchObject({ ok: false, errors: { coverStart: { code: "required" } } });
    expect(submit({ "coverStart-choice": "other" })).toMatchObject({ ok: false, errors: { coverStart: { code: "dateRequired" } } });
    expect(submit({ "coverStart-choice": "other", coverStart: "31/02/2027" })).toMatchObject({ ok: false, errors: { coverStart: { code: "invalidDate" } } });
    expect(submit({ "coverStart-choice": "other", coverStart: "19/12/2026" })).toMatchObject({ ok: false, errors: { coverStart: { code: "notPast" } } });
    expect(submit({ "coverStart-choice": "other", coverStart: "19/01/2027" })).toEqual({ ok: true, answers: { coverStart: "2027-01-19" } });
    expect(submit({ "coverStart-choice": "other", coverStart: "20/01/2027" })).toMatchObject({
      ok: false,
      errors: { coverStart: { code: "maxDaysAhead", params: { days: 30, latest: "2027-01-19" } } },
    });
  });

  it("needs the server's today to resolve relative choices", () => {
    const fd = new FormData();
    fd.append("coverStart-choice", "today");
    expect(() => readStep(step, fd)).toThrow(/options.today/);
  });
});
