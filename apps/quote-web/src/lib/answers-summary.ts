import "server-only";
import type { ContentAdapter } from "@qf/adapters";
import { activeSteps, isIsoDate, visibleFields, type Answers, type EvalContext, type FieldDef, type JsonValue, type Journey } from "@qf/journey-engine";
import { paths } from "./paths";
import { formatDate, itemLabel, labelKey, optionViews, stepTitleKey } from "./step-view";

export interface SummaryRow {
  fieldId: string;
  question: string;
  answer: string;
  changeHref: string;
}

export interface SummarySection {
  stepId: string;
  title: string;
  rows: SummaryRow[];
}

const record = (v: JsonValue | undefined) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, JsonValue>) : null);

function formatAnswer(field: FieldDef, value: JsonValue | undefined, content: ContentAdapter, answers: Answers): string {
  if (value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
    return field.type === "checkboxes" ? "None selected" : "Not answered";
  }
  if (field.type === "vehicle") {
    const v = record(value);
    return [v?.reg, [v?.make, v?.model].filter(Boolean).join(" "), v?.variant, v?.year].filter(Boolean).join(", ");
  }
  if (field.type === "address") {
    const a = record(value);
    return [a?.line1, a?.line2, a?.town, a?.postcode].filter(Boolean).join(", ");
  }
  if (field.type === "repeater" && Array.isArray(value)) {
    return value.map((item) => itemLabel(field, item as Answers, content, answers)).join("; ");
  }
  const options = optionViews(field, content, answers);
  const optionLabel = (v: string) => options?.find((o) => o.value === v)?.label ?? v;
  if (Array.isArray(value)) return value.map((v) => optionLabel(String(v))).join(", ");
  if (options) return optionLabel(String(value));
  if (field.type === "date" && isIsoDate(value)) return formatDate(value, field.precision);
  if (field.type === "currency" && typeof value === "number") return `£${value.toLocaleString("en-GB")}`;
  if (typeof value === "number") return `${value.toLocaleString("en-GB")}${field.suffix ? ` ${field.suffix}` : ""}`;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

const targetFor = (field: FieldDef) =>
  field.type === "date" ? `${field.id}-input` : field.type === "address" ? `${field.id}-postcode` : field.id;

/** Answers grouped by step, for the review page. Only visible questions on active steps. */
export function answersSummary(journey: Journey, ctx: EvalContext, content: ContentAdapter): SummarySection[] {
  return activeSteps(journey, ctx).map((step) => ({
    stepId: step.id,
    title: content.t(stepTitleKey(step)),
    rows: visibleFields(journey, step, ctx).map((field) => ({
      fieldId: field.id,
      question: content.t(labelKey(field)),
      answer: formatAnswer(field, ctx.answers[field.id], content, ctx.answers),
      changeHref: `${paths.step(step)}#${targetFor(field)}`,
    })),
  }));
}
