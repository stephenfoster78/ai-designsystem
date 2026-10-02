import { collectReferences } from "./conditions";
import type { Expr, FieldDef, JourneyDef, StepDef } from "./types";

export class JourneyDefinitionError extends Error {
  override name = "JourneyDefinitionError";
}

/** A validated journey with lookup indexes. Treat as immutable. */
export interface Journey extends JourneyDef {
  readonly stepById: ReadonlyMap<string, StepDef>;
  readonly stepByPath: ReadonlyMap<string, StepDef>;
  /** Every field, including repeater item fields (with their parent repeater). */
  readonly fieldById: ReadonlyMap<string, { field: FieldDef; step: StepDef; parent?: FieldDef }>;
}

const RESERVED_IDS = new Set(["entry", "today"]);
const ID = /^[a-zA-Z][a-zA-Z0-9]*$/;

/**
 * Validates a journey definition at load time so schema mistakes fail fast in tests and
 * at build, not halfway through a customer's quote.
 */
export function defineJourney(def: JourneyDef): Journey {
  const problems: string[] = [];
  const sectionIds = new Set(def.sections.map((s) => s.id));
  const stepById = new Map<string, StepDef>();
  const stepByPath = new Map<string, StepDef>();
  const fieldById = new Map<string, { field: FieldDef; step: StepDef; parent?: FieldDef }>();
  const conditions: Array<[string, Expr | undefined]> = [];

  // Field ids are unique across the journey, including repeater item fields, because item
  // conditions see the item's answers layered over the journey's.
  const register = (field: FieldDef, step: StepDef, parent?: FieldDef) => {
    if (!ID.test(field.id)) problems.push(`Field id "${field.id}" must be camelCase alphanumeric`);
    if (RESERVED_IDS.has(field.id)) problems.push(`Field id "${field.id}" is reserved`);
    if (fieldById.has(field.id)) problems.push(`Duplicate field id "${field.id}"`);
    if (["radio", "select", "checkboxes", "typeahead"].includes(field.type) && !field.options?.length && !field.optionsFrom) {
      problems.push(`Field "${field.id}" (${field.type}) needs options`);
    }
    fieldById.set(field.id, { field, step, parent });
    conditions.push([`field ${field.id} showWhen`, field.showWhen]);
  };

  for (const step of def.steps) {
    if (stepById.has(step.id)) problems.push(`Duplicate step id "${step.id}"`);
    if (stepByPath.has(step.path)) problems.push(`Duplicate step path "${step.path}"`);
    if (!sectionIds.has(step.section)) problems.push(`Step "${step.id}" references unknown section "${step.section}"`);
    if (!/^[a-z0-9-]+(\/[a-z0-9-]+)*$/.test(step.path)) problems.push(`Step "${step.id}" has an invalid path "${step.path}"`);
    stepById.set(step.id, step);
    stepByPath.set(step.path, step);
    conditions.push([`step ${step.id} skipWhen`, step.skipWhen]);

    for (const group of step.groups) {
      conditions.push([`group ${group.id} showWhen`, group.showWhen]);
      for (const field of group.fields) {
        register(field, step);
        if (field.type === "repeater") {
          if (!field.repeater?.steps.length) problems.push(`Repeater "${field.id}" needs item steps`);
          for (const itemStep of field.repeater?.steps ?? []) {
            for (const itemGroup of itemStep.groups) {
              conditions.push([`repeater ${field.id} group ${itemGroup.id} showWhen`, itemGroup.showWhen]);
              for (const itemField of itemGroup.fields) {
                if (itemField.type === "repeater") problems.push(`Repeater "${field.id}" cannot contain another repeater ("${itemField.id}")`);
                register(itemField, step, field);
              }
            }
          }
        }
      }
    }
  }

  const predicateNames = new Set(Object.keys(def.predicates ?? {}));
  for (const { field } of fieldById.values()) {
    if (field.optionsFrom && fieldById.get(field.optionsFrom.repeater)?.field.type !== "repeater") {
      problems.push(`Field "${field.id}" takes options from "${field.optionsFrom.repeater}", which is not a repeater`);
    }
    for (const rule of field.validate ?? []) {
      if (rule.rule === "notBeforeAnniversary" && !fieldById.has(rule.field)) problems.push(`Field "${field.id}" compares with unknown field "${rule.field}"`);
    }
  }
  for (const [where, expr] of conditions) {
    const refs = collectReferences(expr);
    for (const p of refs.preds) if (!predicateNames.has(p)) problems.push(`${where}: unknown predicate "${p}"`);
    for (const v of refs.vars) {
      const head = v.split(".")[0] ?? "";
      if (!RESERVED_IDS.has(head) && !fieldById.has(head)) problems.push(`${where}: unknown field "${head}"`);
    }
  }

  if (problems.length) throw new JourneyDefinitionError(`Invalid journey "${def.id}":\n- ${problems.join("\n- ")}`);
  return Object.freeze({ ...def, stepById, stepByPath, fieldById });
}
