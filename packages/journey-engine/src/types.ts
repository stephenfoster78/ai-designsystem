/**
 * Journey schema types. A journey is data: sections, steps, groups and fields, with
 * declarative conditions. Layout is code (a step may name a custom layout), which is
 * the "hybrid" model: schema for structure and rules, code for presentation.
 */

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

/** Answers are a flat map keyed by field id. Field ids are unique across a journey. */
export type Answers = Record<string, JsonValue>;

export type EntrySource = "direct" | "aggregator" | "account" | "app" | "email" | "seo" | "ecommerce";
export type Identity = "guest" | "recognised" | "signedIn";

/** Resolved once per session from the entry point. Steps never read raw URL parameters. */
export interface EntryContext {
  source: EntrySource;
  identity: Identity;
  coverSet: "direct" | "aggregator";
  prefill?: { reg?: string };
}

// ---------------------------------------------------------------------------
// Conditions: a small JSON Logic-style expression language.
// ---------------------------------------------------------------------------

export type Expr =
  | JsonPrimitive
  | Expr[]
  | { var: string }
  | { "==": [Expr, Expr] }
  | { "!=": [Expr, Expr] }
  | { "<": [Expr, Expr] }
  | { "<=": [Expr, Expr] }
  | { ">": [Expr, Expr] }
  | { ">=": [Expr, Expr] }
  | { "!": Expr }
  | { and: Expr[] }
  | { or: Expr[] }
  | { in: [Expr, Expr] }
  | { pred: string };

export interface EvalContext {
  answers: Answers;
  entry: EntryContext;
  /** Today's date in the journey's local time zone, ISO YYYY-MM-DD. Passed in so rules are deterministic. */
  today: string;
}

/** Escape hatch for logic too complex for an expression. Registered in code per journey. */
export type Predicate = (ctx: EvalContext) => boolean;

// ---------------------------------------------------------------------------
// Fields, groups, steps, sections.
// ---------------------------------------------------------------------------

export type FieldType =
  | "text"
  | "email"
  | "tel"
  | "number"
  | "currency"
  | "radio"
  | "select"
  | "checkbox"
  | "checkboxes"
  | "date";

export interface OptionDef {
  value: string;
  /** Defaults to `${fieldId}.option.${value}`. */
  labelKey?: string;
  hintKey?: string;
}

export type ValidationRule =
  | { rule: "pattern"; value: string; code?: string }
  | { rule: "minLength"; value: number }
  | { rule: "maxLength"; value: number }
  | { rule: "min"; value: number }
  | { rule: "max"; value: number }
  /** Date must be today or earlier. */
  | { rule: "notFuture" }
  /** Date must be today or later. */
  | { rule: "notPast" }
  /** Date must be no more than `value` days after today. */
  | { rule: "maxDaysAhead"; value: number }
  /** Date must be at least `value` years before today (minimum age). */
  | { rule: "minYearsAgo"; value: number };

export interface FieldDef {
  id: string;
  type: FieldType;
  required?: boolean;
  /** Content keys default to `${id}.label`, `${id}.hint`. */
  labelKey?: string;
  hintKey?: string;
  options?: OptionDef[];
  showWhen?: Expr;
  validate?: ValidationRule[];
  /** Normalisation applied before validation and storage. */
  transform?: "uppercase";
  /** HTML autocomplete token (WCAG 1.3.5). */
  autocomplete?: string;
  inputMode?: "text" | "numeric" | "decimal" | "email" | "tel";
  /** Visual width hint for text inputs, in characters. */
  width?: 2 | 4 | 5 | 10 | 20 | 30 | "full";
  /** Fixed visual prefix, e.g. "£" or "UK". Not part of the value. */
  prefix?: string;
  suffix?: string;
}

export interface GroupDef {
  id: string;
  /** When set, the group renders as a fieldset with this legend. */
  legendKey?: string;
  hintKey?: string;
  showWhen?: Expr;
  fields: FieldDef[];
}

export interface StepVariant {
  mode: "readOnlySummary" | "skip";
}

export interface StepDef {
  id: string;
  section: string;
  /** Route below the journey base path, e.g. "car/usage" → /quote/car/usage. */
  path: string;
  /** Defaults to `step.${id}.title`. */
  titleKey?: string;
  /** Name of a custom layout registered in code. Omitted → default layout. */
  layout?: string;
  groups: GroupDef[];
  skipWhen?: Expr;
  /** Per-entry-source overrides, e.g. aggregator users see a read-only summary. */
  variants?: Partial<Record<EntrySource, StepVariant>>;
}

export interface SectionDef {
  id: string;
  /** Defaults to `section.${id}.title`. */
  titleKey?: string;
}

export interface JourneyDef {
  id: string;
  basePath: string;
  sections: SectionDef[];
  steps: StepDef[];
  predicates?: Record<string, Predicate>;
}

// ---------------------------------------------------------------------------
// Validation results.
// ---------------------------------------------------------------------------

export interface FieldError {
  code: string;
  params?: Record<string, string | number>;
}

export type FieldErrors = Record<string, FieldError>;

/** Raw submitted values, kept so invalid input can be redisplayed exactly as typed. */
export type RawInput = Record<string, string | string[] | { day: string; month: string; year: string }>;
