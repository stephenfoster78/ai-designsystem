import { parseDateParts } from "./dates";
import type { AddressValue, Answers, FieldDef, FieldError, GroupDef, JsonValue, RawInput, VehicleValue } from "./types";

/** The subset of FormData / URLSearchParams the engine needs. */
export interface InputSource {
  get(name: string): FormDataEntryValue | null;
  getAll(name: string): FormDataEntryValue[];
}

export interface StepInput {
  /** Normalised values, ready to validate and store. Repeater fields are absent: items are saved separately. */
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

/** Form control names for a field. Date fields post three inputs (two for month precision). */
export const dateInputNames = (id: string) => ({ day: `${id}-day`, month: `${id}-month`, year: `${id}-year` });
export const vehicleInputNames = (id: string) => ({
  make: `${id}-make`,
  model: `${id}-model`,
  transmission: `${id}-transmission`,
  year: `${id}-vehicle-year`,
  variant: `${id}-variant`,
});
export const addressInputNames = (id: string) => ({
  postcode: `${id}-postcode`,
  addressId: `${id}-address`,
  line1: `${id}-line1`,
  line2: `${id}-line2`,
  town: `${id}-town`,
  manual: `${id}-manual`,
});

export const normalisePostcode = (value: string) => {
  const compact = value.replace(/\s+/g, "").toUpperCase();
  return compact.length > 3 ? `${compact.slice(0, -3)} ${compact.slice(-3)}` : compact;
};

type Read = { value: JsonValue | undefined; raw: RawInput[string]; error?: FieldError };

function readField(field: FieldDef, source: InputSource): Read {
  switch (field.type) {
    case "repeater":
      // Items are added, changed and removed through their own actions, never through the step form.
      return { value: undefined, raw: "" };
    case "date": {
      const names = dateInputNames(field.id);
      const monthOnly = field.precision === "month";
      const raw = { day: monthOnly ? "1" : str(source.get(names.day)), month: str(source.get(names.month)), year: str(source.get(names.year)) };
      const parsed = parseDateParts(monthOnly && !raw.month.trim() && !raw.year.trim() ? { day: "", month: "", year: "" } : raw);
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
    case "typeahead": {
      // The visible text is what is posted, with or without JavaScript; match it to an option.
      const raw = str(source.get(field.id));
      const text = normaliseText(raw, {});
      if (!text) return { value: null, raw };
      const lower = text.toLowerCase();
      const match = field.options?.find((o) => o.value.toLowerCase() === lower || (o.label ?? "").toLowerCase() === lower);
      return match ? { value: match.value, raw } : { value: null, raw, error: { code: "noMatch" } };
    }
    case "vehicle": {
      const names = vehicleInputNames(field.id);
      const raw: Record<string, string> = { reg: str(source.get(field.id)) };
      for (const [key, name] of Object.entries(names)) raw[key] = str(source.get(name));
      const reg = raw.reg!.replace(/\s+/g, " ").trim().toUpperCase();
      if (!reg && !raw.make) return { value: null, raw };
      const value: VehicleValue = { reg };
      if (raw.make && raw.model && raw.transmission && raw.year && raw.variant) {
        Object.assign(value, { make: raw.make, model: raw.model, transmission: raw.transmission, year: Number(raw.year), variant: raw.variant, source: "manual" });
      }
      return { value: value as unknown as JsonValue, raw };
    }
    case "address": {
      const names = addressInputNames(field.id);
      const raw: Record<string, string> = {};
      for (const [key, name] of Object.entries(names)) raw[key] = str(source.get(name));
      const postcode = normalisePostcode(raw.postcode ?? "");
      if (!postcode) return { value: null, raw };
      const value: AddressValue = { postcode };
      if (raw.manual === "true") {
        Object.assign(value, { line1: normaliseText(raw.line1 ?? "", {}), line2: normaliseText(raw.line2 ?? "", {}) || undefined, town: normaliseText(raw.town ?? "", {}), source: "manual" });
      } else if (raw.addressId) {
        value.addressId = raw.addressId;
      }
      return { value: JSON.parse(JSON.stringify(value)) as JsonValue, raw };
    }
    default: {
      const raw = str(source.get(field.id));
      const value = normaliseText(raw, field);
      return { value: value === "" ? null : value, raw };
    }
  }
}

/** Reads every field of a step (or repeater item step) from submitted form data. */
export function readStep(step: { groups: GroupDef[] }, source: InputSource): StepInput {
  const result: StepInput = { values: {}, raw: {}, parseErrors: {} };
  for (const group of step.groups) {
    for (const field of group.fields) {
      const { value, raw, error } = readField(field, source);
      if (value !== undefined) result.values[field.id] = value;
      result.raw[field.id] = raw;
      if (error) result.parseErrors[field.id] = error;
    }
  }
  return result;
}
