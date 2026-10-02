import { addDays, isIsoDate, subtractYears } from "./dates";
import type { EvalContext, FieldDef, FieldError, FieldErrors, JsonValue, ValidationRule } from "./types";

export function isEmpty(value: JsonValue | undefined): boolean {
  return value === undefined || value === null || value === "" || value === false || (Array.isArray(value) && value.length === 0);
}

function checkRule(rule: ValidationRule, value: JsonValue, today: string): FieldError | null {
  switch (rule.rule) {
    case "pattern":
      return typeof value === "string" && !new RegExp(rule.value).test(value) ? { code: rule.code ?? "pattern" } : null;
    case "minLength":
      return typeof value === "string" && value.length < rule.value ? { code: "minLength", params: { min: rule.value } } : null;
    case "maxLength":
      return typeof value === "string" && value.length > rule.value ? { code: "maxLength", params: { max: rule.value } } : null;
    case "min":
      return typeof value === "number" && value < rule.value ? { code: "min", params: { min: rule.value } } : null;
    case "max":
      return typeof value === "number" && value > rule.value ? { code: "max", params: { max: rule.value } } : null;
    case "notFuture":
      return isIsoDate(value) && value > today ? { code: "notFuture" } : null;
    case "notPast":
      return isIsoDate(value) && value < today ? { code: "notPast" } : null;
    case "maxDaysAhead":
      return isIsoDate(value) && value > addDays(today, rule.value) ? { code: "maxDaysAhead", params: { days: rule.value } } : null;
    case "minYearsAgo":
      return isIsoDate(value) && value > subtractYears(today, rule.value) ? { code: "minYearsAgo", params: { years: rule.value } } : null;
  }
}

/**
 * Validates one field. Order: parse error → required → option membership → rules.
 * Only the first error is reported, so each field shows one clear message.
 */
export function validateField(field: FieldDef, value: JsonValue | undefined, ctx: Pick<EvalContext, "today">, parseError?: FieldError): FieldError | null {
  if (parseError) return parseError;
  if (isEmpty(value ?? null)) return field.required ? { code: "required" } : null;

  const allowed = field.options?.map((o) => o.value);
  if (allowed) {
    const values = Array.isArray(value) ? value : [value];
    if (values.some((v) => typeof v !== "string" || !allowed.includes(v))) return { code: "invalidOption" };
  }

  for (const rule of field.validate ?? []) {
    const error = checkRule(rule, value as JsonValue, ctx.today);
    if (error) return error;
  }
  return null;
}

export function validateFields(
  fields: FieldDef[],
  values: Record<string, JsonValue>,
  ctx: Pick<EvalContext, "today">,
  parseErrors: Record<string, FieldError> = {},
): FieldErrors {
  const errors: FieldErrors = {};
  for (const field of fields) {
    const error = validateField(field, values[field.id], ctx, parseErrors[field.id]);
    if (error) errors[field.id] = error;
  }
  return errors;
}
