import "server-only";
import type { ContentAdapter } from "@qf/adapters";
import { activeSteps, isIsoDate, visibleFields, type EvalContext, type FieldDef, type JsonValue } from "@qf/journey-engine";
import type { Journey } from "@qf/journey-engine";
import { paths } from "./paths";
import { stepTitleKey } from "./step-view";

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

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

function formatAnswer(field: FieldDef, value: JsonValue | undefined, content: ContentAdapter): string {
  if (value === null || value === undefined || value === "") return "Not answered";
  const optionLabel = (v: string) => {
    const option = field.options?.find((o) => o.value === v);
    return option ? content.t(option.labelKey ?? `${field.id}.option.${option.value}`) : v;
  };
  if (Array.isArray(value)) return value.map((v) => optionLabel(String(v))).join(", ");
  if (field.options) return optionLabel(String(value));
  if (field.type === "date" && isIsoDate(value)) return dateFormat.format(new Date(`${value}T00:00:00Z`));
  if (typeof value === "number") return `${value.toLocaleString("en-GB")}${field.suffix ? ` ${field.suffix}` : ""}`;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

/** Answers grouped by step, for the review page. Only visible questions on active steps. */
export function answersSummary(journey: Journey, ctx: EvalContext, content: ContentAdapter): SummarySection[] {
  return activeSteps(journey, ctx).map((step) => ({
    stepId: step.id,
    title: content.t(stepTitleKey(step)),
    rows: visibleFields(journey, step, ctx).map((field) => ({
      fieldId: field.id,
      question: content.t(field.labelKey ?? `${field.id}.label`),
      answer: formatAnswer(field, ctx.answers[field.id], content),
      changeHref: `${paths.step(step)}#${field.type === "date" ? `${field.id}-input` : field.id}`,
    })),
  }));
}
