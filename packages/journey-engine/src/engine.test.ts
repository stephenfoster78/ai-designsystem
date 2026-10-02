import { describe, expect, it } from "vitest";
import {
  checkAccess,
  commitStep,
  commitValid,
  defineJourney,
  evaluate,
  firstIncompleteStep,
  JourneyDefinitionError,
  navigation,
  parseDateParts,
  readStep,
  sanitiseAnswers,
  sectionProgress,
  subtractYears,
  todayIn,
  type EvalContext,
  type JourneyDef,
} from "./index";

const TODAY = "2026-10-02";

const def: JourneyDef = {
  id: "test",
  basePath: "/quote",
  sections: [{ id: "car" }, { id: "you" }],
  predicates: { isSignedIn: (ctx) => ctx.entry.identity === "signedIn" },
  steps: [
    {
      id: "usage",
      section: "car",
      path: "car/usage",
      groups: [
        {
          id: "purchase",
          fields: [
            { id: "purchased", type: "radio", required: true, options: [{ value: "yes" }, { value: "notYet" }] },
            {
              id: "purchaseDate",
              type: "date",
              required: true,
              showWhen: { "==": [{ var: "purchased" }, "yes"] },
              validate: [{ rule: "notFuture" }],
            },
          ],
        },
      ],
    },
    {
      id: "signIn",
      section: "you",
      path: "you/sign-in",
      skipWhen: { pred: "isSignedIn" },
      groups: [{ id: "g", fields: [{ id: "mode", type: "radio", required: true, options: [{ value: "guest" }, { value: "signIn" }] }] }],
    },
    {
      id: "details",
      section: "you",
      path: "you/details",
      groups: [
        {
          id: "g",
          fields: [
            { id: "firstName", type: "text", required: true, validate: [{ rule: "maxLength", value: 5 }] },
            { id: "dob", type: "date", required: true, validate: [{ rule: "minYearsAgo", value: 17 }] },
          ],
        },
      ],
    },
  ],
};

const journey = defineJourney(def);
const ctx = (answers = {}, identity: "guest" | "signedIn" = "guest"): EvalContext => ({
  answers,
  entry: { source: "direct", identity, coverSet: "direct" },
  today: TODAY,
});
const form = (entries: Record<string, string | string[]>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) for (const item of [v].flat()) fd.append(k, item);
  return fd;
};

describe("evaluate", () => {
  it("handles comparison, logic and membership", () => {
    const c = ctx({ a: 3, b: "x" });
    expect(evaluate({ "==": [{ var: "b" }, "x"] }, c)).toBe(true);
    expect(evaluate({ ">": [{ var: "a" }, 2] }, c)).toBe(true);
    expect(evaluate({ and: [true, { "!": false }] }, c)).toBe(true);
    expect(evaluate({ or: [false, []] }, c)).toBe(false);
    expect(evaluate({ in: [{ var: "b" }, ["x", "y"]] }, c)).toBe(true);
    expect(evaluate({ "==": [{ var: "entry.identity" }, "guest"] }, c)).toBe(true);
  });
  it("uses strict equality so typos in option values do not silently match", () => {
    expect(evaluate({ "==": [{ var: "a" }, "3"] }, ctx({ a: 3 }))).toBe(false);
  });
  it("treats comparisons with missing answers as false", () => {
    expect(evaluate({ "<": [{ var: "missing" }, 5] }, ctx())).toBe(false);
  });
  it("throws on unknown operators", () => {
    expect(() => evaluate({ nope: 1 } as never, ctx())).toThrow(/Unknown operator/);
  });
});

describe("defineJourney", () => {
  it("rejects duplicate fields, unknown sections, predicates and vars", () => {
    const bad: JourneyDef = {
      id: "bad",
      basePath: "/q",
      sections: [{ id: "s" }],
      steps: [
        { id: "a", section: "s", path: "a", groups: [{ id: "g", fields: [{ id: "x", type: "text" }] }] },
        {
          id: "b",
          section: "missing",
          path: "b",
          skipWhen: { pred: "nope" },
          groups: [{ id: "g", fields: [{ id: "x", type: "text", showWhen: { var: "ghost" } }] }],
        },
      ],
    };
    expect(() => defineJourney(bad)).toThrow(JourneyDefinitionError);
    try {
      defineJourney(bad);
    } catch (e) {
      const message = (e as Error).message;
      expect(message).toMatch(/Duplicate field id "x"/);
      expect(message).toMatch(/unknown section "missing"/);
      expect(message).toMatch(/unknown predicate "nope"/);
      expect(message).toMatch(/unknown field "ghost"/);
    }
  });
});

describe("dates", () => {
  it("parses three-part dates and rejects impossible ones", () => {
    expect(parseDateParts({ day: "2", month: "10", year: "2026" })).toEqual({ ok: true, value: "2026-10-02" });
    expect(parseDateParts({ day: "31", month: "2", year: "2026" })).toEqual({ ok: false, code: "invalidDate" });
    expect(parseDateParts({ day: "", month: "2", year: "" })).toEqual({ ok: false, code: "incompleteDate", missing: ["day", "year"] });
    expect(parseDateParts({ day: "", month: "", year: "" })).toEqual({ ok: true, value: null });
  });
  it("clamps leap days when subtracting years", () => {
    expect(subtractYears("2028-02-29", 1)).toBe("2027-02-28");
  });
  it("computes today in the UK time zone", () => {
    // 23:30 UTC on 1 Oct is 00:30 BST on 2 Oct.
    expect(todayIn("Europe/London", new Date("2026-10-01T23:30:00Z"))).toBe("2026-10-02");
  });
});

describe("commitStep", () => {
  const usage = journey.stepById.get("usage")!;

  it("requires conditional fields only when visible", () => {
    const notYet = commitStep(journey, usage, readStep(usage, form({ purchased: "notYet" })), ctx());
    expect(notYet.ok).toBe(true);

    const yes = commitStep(journey, usage, readStep(usage, form({ purchased: "yes" })), ctx());
    expect(yes).toMatchObject({ ok: false, errors: { purchaseDate: { code: "required" } } });
  });

  it("reports parse errors before rule errors", () => {
    const input = readStep(usage, form({ purchased: "yes", "purchaseDate-day": "40", "purchaseDate-month": "1", "purchaseDate-year": "2026" }));
    expect(commitStep(journey, usage, input, ctx())).toMatchObject({ ok: false, errors: { purchaseDate: { code: "invalidDate" } } });
  });

  it("applies date rules against the supplied today", () => {
    const input = readStep(usage, form({ purchased: "yes", "purchaseDate-day": "3", "purchaseDate-month": "10", "purchaseDate-year": "2026" }));
    expect(commitStep(journey, usage, input, ctx())).toMatchObject({ ok: false, errors: { purchaseDate: { code: "notFuture" } } });
  });

  it("rejects values that are not one of the options", () => {
    const result = commitStep(journey, usage, readStep(usage, form({ purchased: "maybe" })), ctx());
    expect(result).toMatchObject({ ok: false, errors: { purchased: { code: "invalidOption" } } });
  });

  it("strips answers from a branch the user backed out of", () => {
    const before = { purchased: "yes", purchaseDate: "2026-01-01" };
    const result = commitStep(journey, usage, readStep(usage, form({ purchased: "notYet" })), ctx(before));
    expect(result).toEqual({ ok: true, answers: { purchased: "notYet" } });
  });
});

describe("commitValid (save and come back later)", () => {
  it("keeps valid answers, drops invalid new ones and keeps the previous value of invalid changes", () => {
    const details = journey.stepById.get("details")!;
    const input = readStep(details, form({ firstName: "Toolongname", "dob-day": "1", "dob-month": "1", "dob-year": "1990" }));
    expect(commitValid(journey, details, input, ctx({ purchased: "notYet", firstName: "Sam" }))).toEqual({
      purchased: "notYet",
      firstName: "Sam",
      dob: "1990-01-01",
    });
  });
});

describe("sanitiseAnswers", () => {
  it("drops unknown keys and hidden fields", () => {
    const answers = { purchased: "notYet", purchaseDate: "2026-01-01", injected: "x" };
    expect(sanitiseAnswers(journey, answers, ctx(answers))).toEqual({ purchased: "notYet" });
  });
  it("drops answers to skipped steps", () => {
    const answers = { purchased: "notYet", mode: "guest" };
    expect(sanitiseAnswers(journey, answers, ctx(answers, "signedIn"))).toEqual({ purchased: "notYet" });
  });
});

describe("navigation and route guard", () => {
  it("skips steps whose skipWhen holds", () => {
    expect(navigation(journey, "usage", ctx({}, "signedIn")).next?.id).toBe("details");
    expect(navigation(journey, "usage", ctx({}, "guest")).next?.id).toBe("signIn");
  });

  it("redirects deep links past the first incomplete step", () => {
    expect(checkAccess(journey, "details", ctx())).toEqual({ ok: false, redirectTo: journey.stepById.get("usage") });
    expect(checkAccess(journey, "usage", ctx())).toEqual({ ok: true });
  });

  it("allows revisiting completed steps and redirects away from skipped ones", () => {
    const answers = { purchased: "notYet" };
    expect(checkAccess(journey, "usage", ctx(answers, "signedIn"))).toEqual({ ok: true });
    expect(checkAccess(journey, "signIn", ctx(answers, "signedIn"))).toMatchObject({ ok: false, redirectTo: { id: "details" } });
  });

  it("finds the first incomplete step, or null when done", () => {
    expect(firstIncompleteStep(journey, ctx({ purchased: "notYet" }, "signedIn"))?.id).toBe("details");
    const done = { purchased: "notYet", firstName: "Sam", dob: "1990-05-05" };
    expect(firstIncompleteStep(journey, ctx(done, "signedIn"))).toBeNull();
  });

  it("reports section progress", () => {
    const progress = sectionProgress(journey, ctx({ purchased: "notYet" }), "signIn");
    expect(progress.map((p) => [p.section.id, p.status])).toEqual([
      ["car", "complete"],
      ["you", "current"],
    ]);
  });
});

describe("text normalisation", () => {
  it("trims, collapses spaces and uppercases when asked", () => {
    const step = defineJourney({
      id: "t",
      basePath: "/q",
      sections: [{ id: "s" }],
      steps: [{ id: "a", section: "s", path: "a", groups: [{ id: "g", fields: [{ id: "reg", type: "text", transform: "uppercase" }] }] }],
    }).stepById.get("a")!;
    expect(readStep(step, form({ reg: "  ab12   cde " })).values.reg).toBe("AB12 CDE");
  });
});
