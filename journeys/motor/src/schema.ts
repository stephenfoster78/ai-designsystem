import { defineJourney, type JourneyDef, type OptionDef } from "@qf/journey-engine";
import { predicates } from "./predicates";

const yesNo: OptionDef[] = [{ value: "yes" }, { value: "no" }];

/**
 * Motor quote journey. Milestone 1 defines all seven sections and the first three steps as
 * a vertical slice; later milestones add steps without changing the engine.
 */
export const motorJourneyDef: JourneyDef = {
  id: "motor",
  basePath: "/quote",
  predicates,
  sections: [
    { id: "your-car" },
    { id: "about-you" },
    { id: "drivers-household" },
    { id: "claims-no-claims" },
    { id: "your-quote" },
    { id: "review" },
    { id: "payment" },
  ],
  steps: [
    {
      id: "carRegistration",
      section: "your-car",
      path: "car/registration",
      groups: [
        {
          id: "vehicle",
          fields: [
            {
              id: "registration",
              type: "text",
              required: true,
              transform: "uppercase",
              prefix: "UK",
              width: 10,
              autocomplete: "off",
              // From the reg lookup component spec. The full lookup component arrives in milestone 2.
              validate: [{ rule: "pattern", value: "^[A-Z0-9 ]{1,8}$" }],
            },
            {
              id: "annualMileage",
              type: "number",
              required: true,
              width: 10,
              inputMode: "numeric",
              suffix: "miles",
              validate: [
                { rule: "min", value: 1 },
                { rule: "max", value: 100000 },
              ],
            },
          ],
        },
        {
          id: "condition",
          fields: [
            { id: "modified", type: "radio", required: true, options: yesNo },
            { id: "imported", type: "radio", required: true, options: yesNo },
          ],
        },
        {
          id: "cover",
          fields: [
            {
              id: "coverStart",
              type: "date",
              required: true,
              validate: [{ rule: "notPast" }, { rule: "maxDaysAhead", value: 30 }],
            },
          ],
        },
      ],
    },
    {
      id: "carUsage",
      section: "your-car",
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
        {
          id: "ownership",
          fields: [
            {
              id: "legalOwner",
              type: "radio",
              required: true,
              options: [{ value: "proposer" }, { value: "spouse" }, { value: "company" }, { value: "financeCompany" }, { value: "other" }],
            },
            {
              id: "usage",
              type: "radio",
              required: true,
              options: [{ value: "sdp" }, { value: "commuting" }, { value: "business" }],
            },
          ],
        },
        {
          id: "overnight",
          fields: [
            { id: "keptAtHome", type: "radio", required: true, options: yesNo },
            {
              id: "overnightPostcode",
              type: "text",
              required: true,
              transform: "uppercase",
              width: 10,
              autocomplete: "postal-code",
              showWhen: { "==": [{ var: "keptAtHome" }, "no"] },
              validate: [{ rule: "pattern", value: "^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$", code: "postcode" }],
            },
            {
              id: "overnightLocation",
              type: "radio",
              required: true,
              options: [{ value: "garage" }, { value: "driveway" }, { value: "road" }, { value: "carPark" }, { value: "other" }],
            },
          ],
        },
      ],
    },
    {
      id: "yourDetails",
      section: "about-you",
      path: "you/details",
      groups: [
        {
          id: "name",
          fields: [
            { id: "firstName", type: "text", required: true, autocomplete: "given-name", width: 20, validate: [{ rule: "maxLength", value: 50 }] },
            { id: "lastName", type: "text", required: true, autocomplete: "family-name", width: 20, validate: [{ rule: "maxLength", value: 50 }] },
          ],
        },
        {
          id: "birth",
          fields: [{ id: "dateOfBirth", type: "date", required: true, validate: [{ rule: "notFuture" }, { rule: "minYearsAgo", value: 17 }] }],
        },
      ],
    },
  ],
};

export const motorJourney = defineJourney(motorJourneyDef);
