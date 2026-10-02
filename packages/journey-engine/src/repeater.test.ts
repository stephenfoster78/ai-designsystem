import { describe, expect, it } from "vitest";
import {
  commitItemStep,
  commitStep,
  defineJourney,
  ITEM_ID,
  JourneyDefinitionError,
  readStep,
  removeItem,
  sanitiseAnswers,
  upsertItem,
  validateField,
  type EvalContext,
  type FieldDef,
} from "./index";

const TODAY = "2026-10-02";
const entry = { source: "direct", identity: "guest", coverSet: "direct" } as const;
const ctx = (answers = {}): EvalContext => ({ answers, entry, today: TODAY });
const form = (entries: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.append(k, v);
  return fd;
};

const journey = defineJourney({
  id: "rep",
  basePath: "/q",
  sections: [{ id: "s" }],
  steps: [
    {
      id: "drivers",
      section: "s",
      path: "drivers",
      groups: [
        {
          id: "g",
          fields: [
            { id: "addDrivers", type: "radio", required: true, options: [{ value: "yes" }, { value: "no" }] },
            {
              id: "drivers",
              type: "repeater",
              required: true,
              showWhen: { "==": [{ var: "addDrivers" }, "yes"] },
              repeater: {
                maxItems: 2,
                summaryFields: ["driverFirstName"],
                steps: [
                  { id: "name", groups: [{ id: "n", fields: [{ id: "driverFirstName", type: "text", required: true }] }] },
                  {
                    id: "licence",
                    groups: [
                      {
                        id: "l",
                        fields: [
                          { id: "driverHasLicence", type: "radio", required: true, options: [{ value: "yes" }, { value: "no" }] },
                          { id: "driverLicenceDate", type: "date", precision: "month", required: true, showWhen: { "==": [{ var: "driverHasLicence" }, "yes"] } },
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      ],
    },
    {
      id: "claims",
      section: "s",
      path: "claims",
      groups: [
        {
          id: "c",
          fields: [
            {
              id: "claimant",
              type: "radio",
              required: true,
              optionsFrom: { repeater: "drivers", labelFields: ["driverFirstName"], prepend: [{ value: "you" }] },
            },
          ],
        },
      ],
    },
  ],
});

describe("repeaters", () => {
  const drivers = journey.fieldById.get("drivers")!.field;
  const licenceStep = drivers.repeater!.steps[1]!;

  it("rejects nested repeaters and unknown option sources at definition time", () => {
    expect(() =>
      defineJourney({
        id: "bad",
        basePath: "/q",
        sections: [{ id: "s" }],
        steps: [
          {
            id: "a",
            section: "s",
            path: "a",
            groups: [
              {
                id: "g",
                fields: [
                  { id: "outer", type: "repeater", repeater: { maxItems: 1, summaryFields: [], steps: [{ id: "x", groups: [{ id: "y", fields: [{ id: "inner", type: "repeater" }] }] }] } },
                  { id: "pick", type: "radio", optionsFrom: { repeater: "nope", labelFields: [] } },
                ],
              },
            ],
          },
        ],
      }),
    ).toThrow(JourneyDefinitionError);
  });

  it("validates one item step at a time, with item conditions", () => {
    const partial = commitItemStep(journey, licenceStep, readStep(licenceStep, form({ driverHasLicence: "yes" })), { [ITEM_ID]: "d1", driverFirstName: "Ann" }, ctx());
    expect(partial).toEqual({ ok: false, errors: { driverLicenceDate: { code: "required" } } });
    const done = commitItemStep(journey, licenceStep, readStep(licenceStep, form({ driverHasLicence: "yes", "driverLicenceDate-month": "6", "driverLicenceDate-year": "2012" })), { [ITEM_ID]: "d1", driverFirstName: "Ann" }, ctx());
    expect(done).toMatchObject({ ok: true, item: { driverLicenceDate: "2012-06-01" } });
  });

  it("upserts complete items, enforces the maximum, and removes", () => {
    const ann = { [ITEM_ID]: "d1", driverFirstName: "Ann", driverHasLicence: "no" };
    const bo = { [ITEM_ID]: "d2", driverFirstName: "Bo", driverHasLicence: "no" };
    const one = upsertItem(journey, "drivers", ann, ctx({ addDrivers: "yes" }));
    expect(one.ok).toBe(true);
    const two = upsertItem(journey, "drivers", bo, ctx(one.ok ? one.answers : {}));
    const answers = two.ok ? two.answers : {};
    expect((answers.drivers as unknown[]).length).toBe(2);
    expect(upsertItem(journey, "drivers", { ...ann, [ITEM_ID]: "d3" }, ctx(answers))).toMatchObject({ ok: false, errors: { drivers: { code: "maxItems" } } });
    // Editing an existing item replaces it in place.
    const edited = upsertItem(journey, "drivers", { ...ann, driverFirstName: "Anne" }, ctx(answers));
    expect(edited.ok && (edited.answers.drivers as Array<Record<string, unknown>>)[0]?.driverFirstName).toBe("Anne");
    expect((removeItem(journey, "drivers", "d1", ctx(answers)).drivers as unknown[]).length).toBe(1);
  });

  it("rejects incomplete items and strips hidden item answers", () => {
    expect(upsertItem(journey, "drivers", { [ITEM_ID]: "d1", driverFirstName: "Ann" }, ctx())).toMatchObject({ ok: false, errors: { driverHasLicence: { code: "required" } } });
    const answers = { addDrivers: "yes", drivers: [{ [ITEM_ID]: "d1", driverFirstName: "Ann", driverHasLicence: "no", driverLicenceDate: "2012-06-01" }] };
    expect(sanitiseAnswers(journey, answers, ctx(answers)).drivers).toEqual([{ [ITEM_ID]: "d1", driverFirstName: "Ann", driverHasLicence: "no" }]);
  });

  it("requires at least one item when visible, and drops the list when the parent answer changes", () => {
    const step = journey.stepById.get("drivers")!;
    expect(commitStep(journey, step, readStep(step, form({ addDrivers: "yes" })), ctx())).toMatchObject({ ok: false, errors: { drivers: { code: "required" } } });
    const withItems = { addDrivers: "yes", drivers: [{ [ITEM_ID]: "d1", driverFirstName: "Ann", driverHasLicence: "no" }] };
    expect(commitStep(journey, step, readStep(step, form({ addDrivers: "no" })), ctx(withItems))).toEqual({ ok: true, answers: { addDrivers: "no" } });
  });

  it("builds options from another repeater and rejects references to removed items", () => {
    const claimant = journey.fieldById.get("claimant")!.field;
    const answers = { drivers: [{ [ITEM_ID]: "d1", driverFirstName: "Ann", driverHasLicence: "no" }] };
    expect(validateField(claimant, "d1", ctx(answers))).toBeNull();
    expect(validateField(claimant, "you", ctx(answers))).toBeNull();
    expect(validateField(claimant, "d9", ctx(answers))).toEqual({ code: "invalidOption" });
  });
});

describe("composite and reference fields", () => {
  const field = (f: Partial<FieldDef> & Pick<FieldDef, "type">): FieldDef => ({ id: "f", required: true, ...f });

  it("matches typeahead text to an option label, case-insensitively", () => {
    const f = field({ type: "typeahead", options: [{ value: "N01", label: "Nurse" }] });
    const step = { groups: [{ id: "g", fields: [f] }] };
    expect(readStep(step, form({ f: "  nurse " })).values.f).toBe("N01");
    expect(readStep(step, form({ f: "Astronaut" })).parseErrors.f).toEqual({ code: "noMatch" });
  });

  it("requires a resolved vehicle and checks the registration format", () => {
    const f = field({ type: "vehicle", validate: [{ rule: "pattern", value: "^[A-Z0-9 ]{1,8}$" }] });
    expect(validateField(f, null, ctx())).toEqual({ code: "required" });
    expect(validateField(f, { reg: "TOO LONG 1" }, ctx())).toEqual({ code: "pattern" });
    expect(validateField(f, { reg: "AB12CDE" }, ctx())).toEqual({ code: "vehicleNotFound" });
    expect(validateField(f, { reg: "AB12CDE", make: "Ford" }, ctx())).toBeNull();
  });

  it("reads manual vehicle details posted from the manual lookup", () => {
    const step = { groups: [{ id: "g", fields: [field({ type: "vehicle" })] }] };
    const values = readStep(step, form({ f: "", "f-make": "Ford", "f-model": "Fiesta", "f-transmission": "Manual", "f-vehicle-year": "2015", "f-variant": "1.0 Zetec" })).values;
    expect(values.f).toMatchObject({ make: "Ford", year: 2015, source: "manual" });
  });

  it("validates addresses: excluded areas, selection and manual entry", () => {
    const f = field({ type: "address", validate: [{ rule: "notPattern", value: "^(GY|JE|IM)", code: "outsideUk" }] });
    expect(validateField(f, { postcode: "JE2 3AB", line1: "1 Rue" }, ctx())).toEqual({ code: "outsideUk" });
    expect(validateField(f, { postcode: "LS1 4AP" }, ctx())).toEqual({ code: "addressNotSelected" });
    expect(validateField(f, { postcode: "LS1 4AP", source: "manual", line1: "1 High St" }, ctx())).toEqual({ code: "townRequired" });
    const step = { groups: [{ id: "g", fields: [f] }] };
    expect(readStep(step, form({ "f-postcode": "ls14ap" })).values.f).toEqual({ postcode: "LS1 4AP" });
  });

  it("applies age, recency and cross-field date rules", () => {
    const dob = field({ type: "date", validate: [{ rule: "maxAge", value: 85 }] });
    expect(validateField(dob, "1941-10-03", ctx())).toBeNull(); // 84, 85 tomorrow
    expect(validateField(dob, "1940-10-03", ctx())).toBeNull(); // 85
    expect(validateField(dob, "1940-10-02", ctx())).toEqual({ code: "maxAge", params: { years: 85 } }); // 86 today
    const claim = field({ type: "date", validate: [{ rule: "withinYears", value: 5 }] });
    expect(validateField(claim, "2021-10-01", ctx())).toEqual({ code: "withinYears", params: { years: 5 } });
    const licence = field({ type: "date", precision: "month", validate: [{ rule: "notBeforeAnniversary", field: "dateOfBirth", years: 17, code: "beforeAge17" }] });
    expect(validateField(licence, "2006-12-01", ctx({ dateOfBirth: "1990-01-15" }))).toEqual({ code: "beforeAge17", params: { years: 17 } });
    expect(validateField(licence, "2007-01-01", ctx({ dateOfBirth: "1990-01-15" }))).toBeNull();
  });
});
