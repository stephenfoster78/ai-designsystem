import { parseDateParts } from "./dates";
import type { Answers, FieldDef, FieldError, JsonValue, RawInput, StepDef } from "./types";

/** The subset of FormData / URLSearchParams the engine needs. */
export interface InputSource {
  get(name: string): FormDataEntryValue | null;
  getAll(name: string): FormDataEntryValue[];
}

export interface StepInput {
  /** Normalised values, ready to validate and store. */
  values: Answers;
  /** Exactly what was typed, for redisplay when validation fails. */
  raw: RawInput;
  /** Errors found while parsing (e.g. "31/02/2026"), before rule validation. */
  parseErrors: Record<string, FieldError>;
}

const str = (v: FormDataEntryValue | null): string => (typeof v === "string" ? v : "");

export function normaliseText(value: string, field: Pick<FieldDef, "transform">): string {
  const collapsed = value.replace(/\s+/g, " ").trim();
  return field.transform === "uppercase" ? collapsed.toUpperCase() : collapsed;
}

/** Form control names for a field. Date fields post three inputs. */
export const dateInputNames = (id: string) => ({ day: `${id}-day`, month: `${id}-month`, year: `${id}-year` });

function readField(field: FieldDef, source: InputSource): { value: JsonValue; raw: RawInput[string]; error?: FieldError } {
  switch (field.type) {
    case "date": {
      const names = dateInputNames(field.id);
      const raw = { day: str(source.get(names.day)), month: str(source.get(names.month)), year: str(source.get(names.year)) };
      const parsed = parseDateParts(raw);
      if (parsed.ok) return { value: parsed.value, raw };
      if (parsed.code === "incompleteDate") return { value: null, raw, error: { code: parsed.code, params: { missing: parsed.missing.join(",") } } };
      return { value: null, raw, error: { code: parsed.code } };
    }
    case "checkbox": {
      const raw = str(source.get(field.id));
      return { value: raw === "true", raw };
    }
    case "checkboxes": {
      const raw = source.getAll(field.id).map(str).filter(Boolean);
      return { value: raw, raw };
    }
    case "number":
    case "currency": {
      const raw = str(source.get(field.id));
      const cleaned = raw.replace(/[£,\s]/g, "");
      if (cleaned === "") return { value: null, raw };
      const n = Number(cleaned);
      const valid = field.type === "currency" ? /^\d+(\.\d{1,2})?$/.test(cleaned) : /^-?\d+$/.test(cleaned);
      return valid && Number.isFinite(n) ? { value: n, raw } : { value: null, raw, error: { code: "invalidNumber" } };
    }
    default: {
      const raw = str(source.get(field.id));
      const value = normaliseText(raw, field);
      return { value: value === "" ? null : value, raw };
    }
  }
}

/** Reads every field of a step from submitted form data. Visibility is applied later, during validation. */
export function readStep(step: StepDef, source: InputSource): StepInput {
  const result: StepInput = { values: {}, raw: {}, parseErrors: {} };
  for (const group of step.groups) {
    for (const field of group.fields) {
      const { value, raw, error } = readField(field, source);
      result.values[field.id] = value;
      result.raw[field.id] = raw;
      if (error) result.parseErrors[field.id] = error;
    }
  }
  return result;
}
