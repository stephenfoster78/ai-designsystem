import "server-only";
import type { ContentAdapter } from "@qf/adapters";
import { resolveOptions, type Answers, type FieldDef, type FieldError, type GroupDef, type JsonValue, type StepDef } from "@qf/journey-engine";

/** Serialisable, content-resolved description of a field for the client renderer. */
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
  precision?: FieldDef["precision"];
  repeater?: RepeaterView;
}

export interface GroupView {
  id: string;
  legend?: string;
  hint?: string;
  fieldIds: string[];
}

export interface RepeaterView {
  addLabel: string;
  addAnotherLabel: string;
  noun: string;
  emptyText?: string;
  maxText?: string;
  addedText: string;
  itemTitle: string;
  itemEditTitle: string;
  maxItems: number;
  steps: Array<{ id: string; title: string; groups: GroupView[] }>;
  fields: Record<string, FieldView>;
  /** Saved items with display labels. */
  items: Array<{ id: string; label: string; status?: string; answers: Answers }>;
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
  /** For composite fields: which input the error belongs to. */
  subTarget?: "postcode" | "address" | "line1" | "town";
  /** For repeater item errors: which item (1-based). */
  item?: number;
}

export const stepTitleKey = (step: StepDef) => step.titleKey ?? `step.${step.id}.title`;
export const sectionTitleKey = (id: string) => `section.${id}.title`;
export const labelKey = (field: FieldDef) => field.labelKey ?? `${field.id}.label`;

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
export const formatDate = (iso: string, precision?: FieldDef["precision"]) =>
  precision === "month"
    ? new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`))
    : dateFormat.format(new Date(`${iso}T00:00:00Z`));

export function optionViews(field: FieldDef, content: ContentAdapter, answers: Answers) {
  return resolveOptions(field, answers)?.map((o) => {
    const key = o.labelKey ?? `${field.id}.option.${o.value}`;
    return { value: o.value, label: o.label ?? content.t(key), hint: o.label ? undefined : content.maybe(o.hintKey ?? `${key}.hint`) };
  });
}

function groupViews(groups: GroupDef[], content: ContentAdapter, answers: Answers, fields: Record<string, FieldView>): GroupView[] {
  return groups.map((group) => {
    for (const field of group.fields) fields[field.id] = fieldView(field, content, answers);
    return {
      id: group.id,
      legend: group.legendKey ? content.t(group.legendKey) : undefined,
      hint: group.hintKey ? content.maybe(group.hintKey) : undefined,
      fieldIds: group.fields.map((f) => f.id),
    };
  });
}

/** One-line label for a repeater item, from its summary fields (option labels and dates formatted). */
export function itemLabel(field: FieldDef, item: Answers, content: ContentAdapter, answers: Answers): string {
  const itemFields = new Map(field.repeater!.steps.flatMap((s) => s.groups.flatMap((g) => g.fields)).map((f) => [f.id, f]));
  const parts = field.repeater!.summaryFields.map((id) => {
    const value = item[id];
    const def = itemFields.get(id);
    if (value === undefined || value === null || !def) return "";
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return formatDate(value, def.precision);
    const option = optionViews(def, content, answers)?.find((o) => o.value === value);
    // Reference data labels can be long ("SP30: Exceeding…"): keep the code for the summary.
    if (option && def.type === "typeahead") return option.label.split(":")[0]!;
    return option?.label ?? String(value);
  });
  return field.type === "repeater" && field.repeater!.summaryFields.some((id) => itemFields.get(id)?.type === "date")
    ? parts.filter(Boolean).join(", ")
    : parts.filter(Boolean).join(" ");
}

function fieldView(field: FieldDef, content: ContentAdapter, answers: Answers): FieldView {
  const view: FieldView = {
    id: field.id,
    type: field.type,
    label: content.t(labelKey(field)),
    hint: content.maybe(field.hintKey ?? `${field.id}.hint`),
    options: optionViews(field, content, answers),
    width: field.width,
    prefix: field.prefix,
    suffix: field.suffix,
    autocomplete: field.autocomplete,
    inputMode: field.inputMode,
    precision: field.precision,
  };
  if (field.repeater) {
    const fields: Record<string, FieldView> = {};
    const steps = field.repeater.steps.map((s) => ({
      id: s.id,
      title: content.t(s.titleKey ?? `${field.id}.step.${s.id}.title`),
      groups: groupViews(s.groups, content, answers, fields),
    }));
    const saved = Array.isArray(answers[field.id]) ? (answers[field.id] as Answers[]) : [];
    view.repeater = {
      addLabel: content.t(`${field.id}.add`),
      addAnotherLabel: content.t(`${field.id}.addAnother`),
      noun: content.t(`${field.id}.noun`),
      emptyText: content.maybe(`${field.id}.empty`),
      maxText: content.maybe(`${field.id}.max`),
      addedText: content.t(`${field.id}.added`),
      itemTitle: content.t(`${field.id}.item.title`),
      itemEditTitle: content.t(`${field.id}.item.editTitle`),
      maxItems: field.repeater.maxItems,
      steps,
      fields,
      items: saved.map((item) => ({ id: String(item._id), label: itemLabel(field, item, content, answers), answers: item })),
    };
  }
  return view;
}

/** Builds the client view of a step. Answers are needed for options built from other answers. */
export function buildStepView(step: StepDef, content: ContentAdapter, answers: Answers): StepView {
  const fields: Record<string, FieldView> = {};
  const groups = groupViews(step.groups, content, answers, fields);
  return { id: step.id, title: content.t(stepTitleKey(step)), sectionTitle: content.t(sectionTitleKey(step.section)), groups, fields };
}

function joinWords(words: string[]): string {
  return words.length <= 1 ? (words[0] ?? "") : `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
}

const ADDRESS_TARGETS: Record<string, ErrorView["subTarget"]> = {
  addressNotSelected: "address",
  line1Required: "line1",
  townRequired: "town",
};

/**
 * Resolves an error to copy: field-specific key first (`registration.error.pattern`), then a
 * type-specific generic (`error.radio.required`), then the generic (`error.pattern`).
 */
export function errorView(field: FieldDef, error: FieldError, content: ContentAdapter, options: { addressListShown?: boolean } = {}): ErrorView {
  const label = content.t(labelKey(field));
  const params: Record<string, string | number> = { label, ...error.params };
  let parts: ErrorView["parts"];
  if (error.code === "incompleteDate") {
    const missing = String(error.params?.missing ?? "").split(",").filter(Boolean) as Array<"day" | "month" | "year">;
    params.missing = joinWords(missing);
    parts = missing;
  }
  const message = content.t(`${field.id}.error.${error.code}`, params, `error.${field.type}.${error.code}`, `error.${error.code}`);
  let targetId = field.id;
  let subTarget: ErrorView["subTarget"];
  if (field.type === "date") targetId = `${field.id}-input`;
  if (field.type === "address") {
    subTarget = ADDRESS_TARGETS[error.code] ?? "postcode";
    if (subTarget === "address" && !options.addressListShown) subTarget = "postcode";
    targetId = `${field.id}-${subTarget}`;
  }
  return { fieldId: field.id, targetId, message, parts, subTarget, item: typeof error.params?.item === "number" ? error.params.item : undefined };
}

/** Initial value for a field: saved answer, else entry prefill (e.g. ?reg= from the direct site). */
export function initialValues(step: StepDef, answers: Record<string, JsonValue>, prefill: Record<string, JsonValue | undefined> = {}) {
  const values: Record<string, JsonValue> = {};
  for (const group of step.groups) {
    for (const field of group.fields) {
      values[field.id] = answers[field.id] ?? prefill[field.id] ?? null;
    }
  }
  return values;
}
