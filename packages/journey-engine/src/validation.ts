import { holds } from "./conditions";
import { addDays, isIsoDate, subtractYears } from "./dates";
import {
  ITEM_ID,
  type Answers,
  type EvalContext,
  type FieldDef,
  type FieldError,
  type FieldErrors,
  type GroupDef,
  type JsonValue,
  type OptionDef,
  type Predicate,
  type ValidationRule,
} from "./types";

export function isEmpty(value: JsonValue | undefined): boolean {
  return value === undefined || value === null || value === "" || value === false || (Array.isArray(value) && value.length === 0);
}

const asRecord = (value: JsonValue | undefined): Record<string, JsonValue> | null =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, JsonValue>) : null;

/** The text a pattern rule checks: the value itself, or a composite's key text (reg, postcode). */
function textOf(value: JsonValue): string | null {
  if (typeof value === "string") return value;
  const record = asRecord(value);
  if (record && typeof record.reg === "string") return record.reg;
  if (record && typeof record.postcode === "string") return record.postcode;
  return null;
}

/** Options for a field, including options built from another repeater's items. */
export function resolveOptions(field: FieldDef, answers: Answers): OptionDef[] | undefined {
  if (!field.optionsFrom) return field.options;
  const items = answers[field.optionsFrom.repeater];
  const fromItems = (Array.isArray(items) ? items : []).flatMap((item): OptionDef[] => {
    const record = asRecord(item);
    const id = record?.[ITEM_ID];
    if (!record || typeof id !== "string") return [];
    return [{ value: id, label: field.optionsFrom!.labelFields.map((f) => record[f] ?? "").join(" ").trim() }];
  });
  return [...(field.optionsFrom.prepend ?? []), ...fromItems];
}

function checkRule(rule: ValidationRule, value: JsonValue, ctx: Pick<EvalContext, "today" | "answers">): FieldError | null {
  const text = textOf(value);
  switch (rule.rule) {
    case "pattern":
      return text !== null && !new RegExp(rule.value).test(text) ? { code: rule.code ?? "pattern" } : null;
    case "notPattern":
      return text !== null && new RegExp(rule.value).test(text) ? { code: rule.code } : null;
    case "minLength":
      return typeof value === "string" && value.length < rule.value ? { code: "minLength", params: { min: rule.value } } : null;
    case "maxLength":
      return typeof value === "string" && value.length > rule.value ? { code: "maxLength", params: { max: rule.value } } : null;
    case "min":
      return typeof value === "number" && value < rule.value ? { code: "min", params: { min: rule.value } } : null;
    case "max":
      return typeof value === "number" && value > rule.value ? { code: "max", params: { max: rule.value } } : null;
    case "notFuture":
      return isIsoDate(value) && value > ctx.today ? { code: "notFuture" } : null;
    case "notPast":
      return isIsoDate(value) && value < ctx.today ? { code: "notPast" } : null;
    case "maxDaysAhead":
      return isIsoDate(value) && value > addDays(ctx.today, rule.value) ? { code: "maxDaysAhead", params: { days: rule.value } } : null;
    case "withinYears":
      return isIsoDate(value) && value < subtractYears(ctx.today, rule.value) ? { code: "withinYears", params: { years: rule.value } } : null;
    case "minYearsAgo":
      return isIsoDate(value) && value > subtractYears(ctx.today, rule.value) ? { code: "minYearsAgo", params: { years: rule.value } } : null;
    case "maxAge":
      // Aged `value` or younger means born after today minus (value + 1) years.
      return isIsoDate(value) && value <= subtractYears(ctx.today, rule.value + 1) ? { code: "maxAge", params: { years: rule.value } } : null;
    case "notBeforeAnniversary": {
      const other = ctx.answers[rule.field];
      if (!isIsoDate(value) || !isIsoDate(other)) return null;
      // Month-precision dates are stored as the 1st, so compare at month level.
      const limit = subtractYears(other, -rule.years);
      return value.slice(0, 7) < limit.slice(0, 7) ? { code: rule.code, params: { years: rule.years } } : null;
    }
  }
}

export interface ValidationContext extends EvalContext {
  predicates?: Record<string, Predicate>;
}

/** Fields visible in a set of groups for the given answers. */
export function visibleInGroups(groups: GroupDef[], ctx: ValidationContext): FieldDef[] {
  return groups
    .filter((g) => holds(g.showWhen, ctx, ctx.predicates))
    .flatMap((g) => g.fields.filter((f) => holds(f.showWhen, ctx, ctx.predicates)));
}

/** Context for evaluating a repeater item: the item's answers layered over the journey's. */
export function itemContext(ctx: ValidationContext, item: Answers): ValidationContext {
  return { ...ctx, answers: { ...ctx.answers, ...item } };
}

/** Validates every visible field of every step of one repeater item. */
export function validateItem(field: FieldDef, item: Answers, ctx: ValidationContext): FieldErrors {
  const itemCtx = itemContext(ctx, item);
  const fields = (field.repeater?.steps ?? []).flatMap((s) => visibleInGroups(s.groups, itemCtx));
  return validateFields(fields, item, itemCtx);
}

function validateRepeater(field: FieldDef, value: JsonValue | undefined, ctx: ValidationContext): FieldError | null {
  const items = Array.isArray(value) ? value : [];
  if (items.length === 0) return field.required ? { code: "required" } : null;
  const max = field.repeater?.maxItems ?? Infinity;
  if (items.length > max) return { code: "maxItems", params: { max } };
  const incomplete = items.findIndex((item) => Object.keys(validateItem(field, (asRecord(item) ?? {}) as Answers, ctx)).length > 0);
  return incomplete === -1 ? null : { code: "itemIncomplete", params: { item: incomplete + 1 } };
}

/**
 * Validates one field. Order: parse error → required → composite completeness → option
 * membership → rules. Only the first error is reported, so each field shows one clear message.
 */
export function validateField(field: FieldDef, value: JsonValue | undefined, ctx: ValidationContext, parseError?: FieldError): FieldError | null {
  if (parseError) return parseError;
  if (field.type === "repeater") return validateRepeater(field, value, ctx);
  if (isEmpty(value ?? null)) return field.required ? { code: "required" } : null;

  if (field.type === "vehicle" || field.type === "address") {
    for (const rule of field.validate ?? []) {
      const error = checkRule(rule, value as JsonValue, ctx);
      if (error) return error;
    }
    const record = asRecord(value);
    if (field.type === "vehicle" && !record?.make) return { code: "vehicleNotFound" };
    if (field.type === "address") {
      if (record?.source === "manual") {
        if (!record.line1) return { code: "line1Required" };
        if (!record.town) return { code: "townRequired" };
      } else if (!record?.line1) {
        return { code: "addressNotSelected" };
      }
    }
    return null;
  }

  const allowed = resolveOptions(field, ctx.answers)?.map((o) => o.value);
  if (allowed) {
    const values = Array.isArray(value) ? value : [value];
    if (values.some((v) => typeof v !== "string" || !allowed.includes(v))) return { code: "invalidOption" };
  }

  for (const rule of field.validate ?? []) {
    const error = checkRule(rule, value as JsonValue, ctx);
    if (error) return error;
  }
  return null;
}

export function validateFields(
  fields: FieldDef[],
  values: Record<string, JsonValue>,
  ctx: ValidationContext,
  parseErrors: Record<string, FieldError> = {},
): FieldErrors {
  const errors: FieldErrors = {};
  for (const field of fields) {
    const error = validateField(field, values[field.id], ctx, parseErrors[field.id]);
    if (error) errors[field.id] = error;
  }
  return errors;
}
