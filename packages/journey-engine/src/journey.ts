import { collectReferences } from "./conditions";
import type { Expr, FieldDef, JourneyDef, StepDef } from "./types";

export class JourneyDefinitionError extends Error {
  override name = "JourneyDefinitionError";
}

/** A validated journey with lookup indexes. Treat as immutable. */
export interface Journey extends JourneyDef {
  readonly stepById: ReadonlyMap<string, StepDef>;
  readonly stepByPath: ReadonlyMap<string, StepDef>;
  readonly fieldById: ReadonlyMap<string, { field: FieldDef; step: StepDef }>;
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
  const fieldById = new Map<string, { field: FieldDef; step: StepDef }>();
  const conditions: Array<[string, Expr | undefined]> = [];

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
        if (!ID.test(field.id)) problems.push(`Field id "${field.id}" must be camelCase alphanumeric`);
        if (RESERVED_IDS.has(field.id)) problems.push(`Field id "${field.id}" is reserved`);
        if (fieldById.has(field.id)) problems.push(`Duplicate field id "${field.id}"`);
        if (["radio", "select", "checkboxes"].includes(field.type) && !field.options?.length) {
          problems.push(`Field "${field.id}" (${field.type}) needs options`);
        }
        fieldById.set(field.id, { field, step });
        conditions.push([`field ${field.id} showWhen`, field.showWhen]);
      }
    }
  }

  const predicateNames = new Set(Object.keys(def.predicates ?? {}));
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
