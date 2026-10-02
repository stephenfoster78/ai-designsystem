import "server-only";
import type { ContentAdapter } from "@qf/adapters";
import type { FieldDef, FieldError, JsonValue, StepDef } from "@qf/journey-engine";

/** Serialisable, content-resolved description of a step for the client renderer. */
export interface FieldView {
  id: string;
  type: FieldDef["type"];
  label: string;
  hint?: string;
  options?: Array<{ value: string; label: string; hint?: string }>;
  width?: FieldDef["width"];
  prefix?: string;
  suffix?: string;
  autocomplete?: string;
  inputMode?: FieldDef["inputMode"];
}

export interface GroupView {
  id: string;
  legend?: string;
  hint?: string;
  fieldIds: string[];
}

export interface StepView {
  id: string;
  title: string;
  sectionTitle: string;
  groups: GroupView[];
  fields: Record<string, FieldView>;
}

export interface ErrorView {
  fieldId: string;
  /** Element the error summary link focuses. */
  targetId: string;
  message: string;
  /** Date parts to highlight. */
  parts?: Array<"day" | "month" | "year">;
}

export const stepTitleKey = (step: StepDef) => step.titleKey ?? `step.${step.id}.title`;
export const sectionTitleKey = (id: string) => `section.${id}.title`;
const labelKey = (field: FieldDef) => field.labelKey ?? `${field.id}.label`;

export function buildStepView(step: StepDef, content: ContentAdapter): StepView {
  const fields: Record<string, FieldView> = {};
  const groups = step.groups.map((group): GroupView => {
    for (const field of group.fields) {
      fields[field.id] = {
        id: field.id,
        type: field.type,
        label: content.t(labelKey(field)),
        hint: content.maybe(field.hintKey ?? `${field.id}.hint`),
        options: field.options?.map((o) => {
          const key = o.labelKey ?? `${field.id}.option.${o.value}`;
          return { value: o.value, label: content.t(key), hint: content.maybe(o.hintKey ?? `${key}.hint`) };
        }),
        width: field.width,
        prefix: field.prefix,
        suffix: field.suffix,
        autocomplete: field.autocomplete,
        inputMode: field.inputMode,
      };
    }
    return {
      id: group.id,
      legend: group.legendKey ? content.t(group.legendKey) : undefined,
      hint: group.hintKey ? content.maybe(group.hintKey) : undefined,
      fieldIds: group.fields.map((f) => f.id),
    };
  });
  return { id: step.id, title: content.t(stepTitleKey(step)), sectionTitle: content.t(sectionTitleKey(step.section)), groups, fields };
}

function joinWords(words: string[]): string {
  return words.length <= 1 ? (words[0] ?? "") : `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
}

/**
 * Resolves an error to copy: field-specific key first (`registration.error.pattern`), then a
 * type-specific generic (`error.radio.required`), then the generic (`error.pattern`).
 */
export function errorView(field: FieldDef, error: FieldError, content: ContentAdapter): ErrorView {
  const label = content.t(labelKey(field));
  const params: Record<string, string | number> = { label, ...error.params };
  let parts: ErrorView["parts"];
  if (error.code === "incompleteDate") {
    const missing = String(error.params?.missing ?? "").split(",").filter(Boolean) as Array<"day" | "month" | "year">;
    params.missing = joinWords(missing);
    parts = missing;
  }
  const message = content.t(`${field.id}.error.${error.code}`, params, `error.${field.type}.${error.code}`, `error.${error.code}`);
  const targetId = field.type === "date" ? `${field.id}-input` : field.id;
  return { fieldId: field.id, targetId, message, parts };
}

/** Initial value for a field: saved answer, else entry prefill (e.g. ?reg= from the direct site). */
export function initialValues(step: StepDef, answers: Record<string, JsonValue>, prefill: Record<string, string | undefined> = {}) {
  const values: Record<string, JsonValue> = {};
  for (const group of step.groups) {
    for (const field of group.fields) {
      values[field.id] = answers[field.id] ?? prefill[field.id] ?? null;
    }
  }
  return values;
}
