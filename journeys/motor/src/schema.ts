import { defineJourney, type Expr, type FieldDef, type JourneyDef, type OptionDef } from "@qf/journey-engine";
import { predicates } from "./predicates";
import { CONVICTION_CODES, INDUSTRIES, OCCUPATIONS } from "./reference";

const opts = (...values: string[]): OptionDef[] => values.map((value) => ({ value }));
const yesNo = opts("yes", "no");

/** Fields shared by the main driver and additional drivers are built from one definition. */
const employmentStatus = opts("employed", "selfEmployed", "student", "retired", "unemployed", "homemaker", "notWorkingHealth");
const working = (statusField: string): Expr => ({ in: [{ var: statusField }, ["employed", "selfEmployed"]] });
const maritalStatus = opts("single", "married", "civilPartnership", "cohabiting", "divorced", "separated", "widowed");
const titles = opts("mr", "mrs", "miss", "ms", "mx", "dr");
const licenceTypes = opts("fullManual", "fullAutomatic", "provisional", "euEea", "international");

const dateOfBirth = (id: string): FieldDef => ({
  id,
  type: "date",
  required: true,
  autocomplete: id === "dateOfBirth" ? "bday" : undefined,
  // Eligibility: aged 17 to 85.
  validate: [{ rule: "notFuture" }, { rule: "minYearsAgo", value: 17 }, { rule: "maxAge", value: 85 }],
});

const licenceDate = (id: string, dobField: string): FieldDef => ({
  id,
  type: "date",
  precision: "month",
  required: true,
  validate: [{ rule: "notFuture" }, { rule: "notBeforeAnniversary", field: dobField, years: 17, code: "beforeAge17" }],
});

const POSTCODE = "^[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}$";
/** Eligibility: a fixed UK address, excluding the Channel Islands and Isle of Man. */
const NOT_CROWN_DEPENDENCY = { rule: "notPattern" as const, value: "^(GY|JE|IM)[0-9]", code: "outsideUk" };

/** "Who did this happen to?": you, or one of the drivers added earlier in the journey. */
const who = (id: string): FieldDef => ({
  id,
  type: "radio",
  required: true,
  optionsFrom: { repeater: "drivers", labelFields: ["driverFirstName", "driverLastName"], prepend: [{ value: "you", labelKey: "who.option.you" }] },
});

const withinFiveYears = [{ rule: "notFuture" as const }, { rule: "withinYears" as const, value: 5 }];

/**
 * Motor quote journey, milestone 2: screens 1–11 for the direct-site guest path.
 * Eligibility (refused insurance, unspent convictions, bankruptcy/CCJs, DVLA medical,
 * UK address, age 85 or under) is confirmed on the Start page, so those are not asked here.
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
    // 2 ----------------------------------------------------------------------------------------
    {
      id: "carRegistration",
      section: "your-car",
      path: "car/registration",
      groups: [
        {
          id: "vehicle",
          fields: [
            // Reg lookup component spec: A–Z, 0–9 and spaces, 1–8 characters.
            { id: "registration", type: "vehicle", required: true, validate: [{ rule: "pattern", value: "^[A-Z0-9 ]{1,8}$" }] },
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
            {
              id: "modifications",
              type: "checkboxes",
              required: true,
              showWhen: { "==": [{ var: "modified" }, "yes"] },
              options: opts("engine", "suspension", "wheels", "bodywork", "interior", "adaptations", "other"),
            },
            { id: "imported", type: "radio", required: true, options: yesNo },
          ],
        },
        {
          id: "cover",
          // Start date input component: Today / Tomorrow / Another date (+ calendar modal).
          fields: [{ id: "coverStart", type: "startDate", required: true, validate: [{ rule: "notPast" }, { rule: "maxDaysAhead", value: 30 }] }],
        },
      ],
    },
    // 3 ----------------------------------------------------------------------------------------
    {
      id: "carUsage",
      section: "your-car",
      path: "car/usage",
      groups: [
        {
          id: "purchase",
          fields: [
            { id: "purchased", type: "radio", required: true, options: opts("yes", "notYet") },
            { id: "purchaseDate", type: "date", required: true, showWhen: { "==": [{ var: "purchased" }, "yes"] }, validate: [{ rule: "notFuture" }] },
            {
              id: "carValue",
              type: "currency",
              required: true,
              prefix: "£",
              width: 10,
              inputMode: "numeric",
              validate: [
                { rule: "min", value: 100 },
                { rule: "max", value: 250000 },
              ],
            },
          ],
        },
        {
          id: "ownership",
          fields: [
            { id: "legalOwner", type: "radio", required: true, options: opts("proposer", "spouse", "company", "financeCompany", "other") },
            { id: "registeredKeeper", type: "radio", required: true, options: opts("proposer", "spouse", "company", "other") },
            { id: "usage", type: "radio", required: true, options: opts("sdp", "commuting", "business") },
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
              validate: [{ rule: "pattern", value: POSTCODE, code: "postcode" }, NOT_CROWN_DEPENDENCY],
            },
            { id: "overnightLocation", type: "radio", required: true, options: opts("garage", "driveway", "road", "carPark", "other") },
          ],
        },
      ],
    },
    // 4 ----------------------------------------------------------------------------------------
    {
      id: "signIn",
      section: "about-you",
      path: "you/sign-in",
      skipWhen: { pred: "isSignedIn" },
      groups: [
        {
          id: "account",
          fields: [
            {
              id: "accountChoice",
              type: "radio",
              required: true,
              options: opts("signIn", "register", "guest"),
              // Sign in and register arrive in milestone 4.
              validate: [{ rule: "pattern", value: "^guest$", code: "notAvailable" }],
            },
          ],
        },
      ],
    },
    // 5 ----------------------------------------------------------------------------------------
    {
      id: "yourDetails",
      section: "about-you",
      path: "you/details",
      groups: [
        {
          id: "name",
          fields: [
            { id: "title", type: "select", required: true, autocomplete: "honorific-prefix", options: titles },
            { id: "firstName", type: "text", required: true, autocomplete: "given-name", width: 20, validate: [{ rule: "maxLength", value: 50 }] },
            { id: "lastName", type: "text", required: true, autocomplete: "family-name", width: 20, validate: [{ rule: "maxLength", value: 50 }] },
            dateOfBirth("dateOfBirth"),
          ],
        },
        {
          id: "contact",
          fields: [
            { id: "email", type: "email", required: true, autocomplete: "email", width: 30, validate: [{ rule: "pattern", value: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", code: "email" }] },
            {
              id: "phone",
              type: "tel",
              required: true,
              autocomplete: "tel",
              width: 20,
              validate: [{ rule: "pattern", value: "^(\\+44\\s?|0)[0-9\\s]{9,13}$", code: "phone" }],
            },
            { id: "homeAddress", type: "address", required: true, validate: [{ rule: "pattern", value: POSTCODE, code: "postcode" }, NOT_CROWN_DEPENDENCY] },
          ],
        },
        {
          id: "circumstances",
          fields: [
            { id: "maritalStatus", type: "radio", required: true, options: maritalStatus },
            { id: "ukResidentSinceBirth", type: "radio", required: true, options: yesNo },
            {
              id: "ukResidentSince",
              type: "date",
              precision: "month",
              required: true,
              showWhen: { "==": [{ var: "ukResidentSinceBirth" }, "no"] },
              validate: [{ rule: "notFuture" }, { rule: "notBeforeAnniversary", field: "dateOfBirth", years: 0, code: "beforeBirth" }],
            },
            { id: "homeowner", type: "radio", required: true, options: yesNo },
            { id: "childrenUnder16", type: "radio", required: true, options: yesNo },
          ],
        },
        {
          id: "marketing",
          fields: [{ id: "marketingChannels", type: "checkboxes", options: opts("email", "sms", "post") }],
        },
      ],
    },
    // 6 ----------------------------------------------------------------------------------------
    {
      id: "occupation",
      section: "about-you",
      path: "you/occupation",
      groups: [
        {
          id: "main",
          fields: [
            { id: "employmentStatus", type: "radio", required: true, options: employmentStatus },
            { id: "occupation", type: "typeahead", required: true, options: OCCUPATIONS, showWhen: working("employmentStatus") },
            { id: "industry", type: "typeahead", required: true, options: INDUSTRIES, showWhen: working("employmentStatus") },
          ],
        },
        {
          id: "secondary",
          fields: [
            { id: "hasSecondaryOccupation", type: "radio", required: true, options: yesNo },
            { id: "secondaryOccupation", type: "typeahead", required: true, options: OCCUPATIONS, showWhen: { "==": [{ var: "hasSecondaryOccupation" }, "yes"] } },
            { id: "secondaryIndustry", type: "typeahead", required: true, options: INDUSTRIES, showWhen: { "==": [{ var: "hasSecondaryOccupation" }, "yes"] } },
          ],
        },
      ],
    },
    // 7 ----------------------------------------------------------------------------------------
    {
      id: "licence",
      section: "about-you",
      path: "you/licence",
      groups: [
        {
          id: "licence",
          fields: [
            { id: "licenceType", type: "radio", required: true, options: licenceTypes },
            licenceDate("licenceDate", "dateOfBirth"),
          ],
        },
      ],
    },
    // 10 ---------------------------------------------------------------------------------------
    {
      id: "additionalDrivers",
      section: "drivers-household",
      path: "drivers/additional-drivers",
      groups: [
        {
          id: "drivers",
          fields: [
            { id: "addDrivers", type: "radio", required: true, options: yesNo },
            {
              id: "drivers",
              type: "repeater",
              required: true,
              showWhen: { "==": [{ var: "addDrivers" }, "yes"] },
              repeater: {
                maxItems: 4,
                summaryFields: ["driverFirstName", "driverLastName"],
                steps: [
                  {
                    id: "details",
                    groups: [
                      {
                        id: "person",
                        fields: [
                          { id: "driverRelationship", type: "radio", required: true, options: opts("spouse", "partner", "parent", "child", "sibling", "otherFamily", "other") },
                          { id: "driverTitle", type: "select", required: true, options: titles },
                          { id: "driverFirstName", type: "text", required: true, width: 20, validate: [{ rule: "maxLength", value: 50 }] },
                          { id: "driverLastName", type: "text", required: true, width: 20, validate: [{ rule: "maxLength", value: 50 }] },
                          dateOfBirth("driverDateOfBirth"),
                          { id: "driverMaritalStatus", type: "radio", required: true, options: maritalStatus },
                          { id: "driverLivesWithYou", type: "radio", required: true, options: yesNo },
                        ],
                      },
                    ],
                  },
                  {
                    id: "employment",
                    groups: [
                      {
                        id: "work",
                        fields: [
                          { id: "driverEmploymentStatus", type: "radio", required: true, options: employmentStatus },
                          { id: "driverOccupation", type: "typeahead", required: true, options: OCCUPATIONS, showWhen: working("driverEmploymentStatus") },
                          { id: "driverIndustry", type: "typeahead", required: true, options: INDUSTRIES, showWhen: working("driverEmploymentStatus") },
                        ],
                      },
                    ],
                  },
                  {
                    id: "licence",
                    groups: [
                      {
                        id: "licence",
                        fields: [{ id: "driverLicenceType", type: "radio", required: true, options: licenceTypes }, licenceDate("driverLicenceDate", "driverDateOfBirth")],
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
    // 8 ----------------------------------------------------------------------------------------
    {
      id: "householdCars",
      section: "drivers-household",
      path: "drivers/household-cars",
      groups: [
        {
          id: "household",
          fields: [
            { id: "otherCarsInHousehold", type: "radio", required: true, options: opts("none", "one", "two", "threePlus") },
            {
              id: "otherCarsInsuredWithUs",
              type: "radio",
              required: true,
              options: opts("yes", "no", "notSure"),
              // Guests self-declare; a signed-in lookup of the customer's own policies arrives in milestone 4.
              showWhen: { "!=": [{ var: "otherCarsInHousehold" }, "none"] },
            },
          ],
        },
      ],
    },
    // 9 ----------------------------------------------------------------------------------------
    {
      id: "claimsConvictions",
      section: "claims-no-claims",
      path: "history/claims-convictions",
      groups: [
        {
          id: "claims",
          fields: [
            { id: "hasClaims", type: "radio", required: true, options: yesNo },
            {
              id: "claims",
              type: "repeater",
              required: true,
              showWhen: { "==": [{ var: "hasClaims" }, "yes"] },
              repeater: {
                maxItems: 5,
                summaryFields: ["claimType", "claimDate"],
                steps: [
                  {
                    id: "claim",
                    groups: [
                      {
                        id: "claim",
                        fields: [
                          who("claimWho"),
                          { id: "claimDate", type: "date", required: true, validate: withinFiveYears },
                          { id: "claimType", type: "radio", required: true, options: opts("accident", "theft", "fire", "windscreen", "vandalism", "weather", "other") },
                          { id: "claimFault", type: "radio", required: true, options: opts("atFault", "notAtFault", "undecided") },
                          { id: "claimNcdAffected", type: "radio", required: true, options: opts("yes", "no", "notSure") },
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
        {
          id: "convictions",
          fields: [
            { id: "hasConvictions", type: "radio", required: true, options: yesNo },
            {
              id: "convictions",
              type: "repeater",
              required: true,
              showWhen: { "==": [{ var: "hasConvictions" }, "yes"] },
              repeater: {
                maxItems: 5,
                summaryFields: ["convictionCode", "convictionDate"],
                steps: [
                  {
                    id: "conviction",
                    groups: [
                      {
                        id: "conviction",
                        fields: [
                          who("convictionWho"),
                          { id: "convictionCode", type: "typeahead", required: true, options: CONVICTION_CODES },
                          { id: "convictionDate", type: "date", required: true, validate: withinFiveYears },
                          { id: "convictionPoints", type: "number", required: true, width: 4, inputMode: "numeric", validate: [{ rule: "min", value: 0 }, { rule: "max", value: 12 }] },
                          { id: "convictionBanMonths", type: "number", required: true, width: 4, inputMode: "numeric", suffix: "months", validate: [{ rule: "min", value: 0 }, { rule: "max", value: 120 }] },
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
    // 11 ---------------------------------------------------------------------------------------
    {
      id: "noClaims",
      section: "claims-no-claims",
      path: "history/no-claims",
      groups: [
        {
          id: "ncd",
          fields: [
            { id: "ncdYears", type: "select", required: true, options: opts("0", "1", "2", "3", "4", "5", "6", "7", "8", "9plus") },
            { id: "ncdEarnedHow", type: "radio", required: true, options: opts("ownPolicy", "namedDriver", "companyCar", "abroad"), showWhen: { "!=": [{ var: "ncdYears" }, "0"] } },
            { id: "ncdInUseElsewhere", type: "radio", required: true, options: yesNo, showWhen: { "!=": [{ var: "ncdYears" }, "0"] } },
            {
              id: "protectNcd",
              type: "radio",
              required: true,
              options: yesNo,
              showWhen: { in: [{ var: "ncdYears" }, ["2", "3", "4", "5", "6", "7", "8", "9plus"]] },
            },
          ],
        },
      ],
    },
  ],
};

export const motorJourney = defineJourney(motorJourneyDef);
