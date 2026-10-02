import type { EvalContext, Expr, JsonValue, Predicate } from "./types";

export class ConditionError extends Error {
  override name = "ConditionError";
}

const BINARY = ["==", "!=", "<", "<=", ">", ">="] as const;
type BinaryOp = (typeof BINARY)[number];

/** JSON Logic truthiness: empty arrays are false, everything else follows JavaScript. */
export function isTruthy(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value);
}

function resolveVar(path: string, ctx: EvalContext): unknown {
  const [head, ...rest] = path.split(".");
  if (head === undefined || head === "") return undefined;
  let current: unknown = head === "entry" ? ctx.entry : head === "today" ? ctx.today : ctx.answers[head];
  for (const key of rest) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current ?? null;
}

function compare(op: BinaryOp, a: unknown, b: unknown): boolean {
  switch (op) {
    // Strict equality: schema authors compare against literal option values, so coercion would hide mistakes.
    case "==":
      return a === b;
    case "!=":
      return a !== b;
  }
  if (a === null || a === undefined || b === null || b === undefined) return false;
  // Ordering works for numbers and for ISO dates/strings.
  const [x, y] = [a as number | string, b as number | string];
  switch (op) {
    case "<":
      return x < y;
    case "<=":
      return x <= y;
    case ">":
      return x > y;
    case ">=":
      return x >= y;
  }
}

/**
 * Evaluates a condition expression. Pure: the same expression and context always give
 * the same result, so it is shared by the client renderer and the server.
 */
export function evaluate(
  expr: Expr,
  ctx: EvalContext,
  predicates: Record<string, Predicate> = {},
): unknown {
  if (expr === null || typeof expr !== "object") return expr;
  if (Array.isArray(expr)) return expr.map((e) => evaluate(e, ctx, predicates));

  const keys = Object.keys(expr);
  if (keys.length !== 1) throw new ConditionError(`Expression must have exactly one operator, got ${JSON.stringify(expr)}`);
  const op = keys[0] as string;
  const arg = (expr as Record<string, unknown>)[op];

  if (op === "var") {
    if (typeof arg !== "string") throw new ConditionError(`"var" expects a string path`);
    return resolveVar(arg, ctx);
  }
  if (op === "pred") {
    const fn = typeof arg === "string" ? predicates[arg] : undefined;
    if (!fn) throw new ConditionError(`Unknown predicate "${String(arg)}"`);
    return fn(ctx);
  }
  if (op === "!") return !isTruthy(evaluate(arg as Expr, ctx, predicates));
  if (op === "and" || op === "or") {
    if (!Array.isArray(arg)) throw new ConditionError(`"${op}" expects an array`);
    // Short-circuit so later operands can safely assume earlier ones held.
    if (op === "and") return arg.every((e) => isTruthy(evaluate(e as Expr, ctx, predicates)));
    return arg.some((e) => isTruthy(evaluate(e as Expr, ctx, predicates)));
  }
  if (op === "in") {
    const [needle, haystack] = evaluateArgs(op, arg, ctx, predicates);
    if (Array.isArray(haystack)) return haystack.includes(needle as JsonValue);
    if (typeof haystack === "string" && typeof needle === "string") return haystack.includes(needle);
    return false;
  }
  if ((BINARY as readonly string[]).includes(op)) {
    const [a, b] = evaluateArgs(op, arg, ctx, predicates);
    return compare(op as BinaryOp, a, b);
  }
  throw new ConditionError(`Unknown operator "${op}"`);
}

function evaluateArgs(op: string, arg: unknown, ctx: EvalContext, predicates: Record<string, Predicate>) {
  if (!Array.isArray(arg) || arg.length !== 2) throw new ConditionError(`"${op}" expects two operands`);
  return [evaluate(arg[0] as Expr, ctx, predicates), evaluate(arg[1] as Expr, ctx, predicates)] as const;
}

/** True when the condition holds; an absent condition always holds. */
export function holds(expr: Expr | undefined, ctx: EvalContext, predicates?: Record<string, Predicate>): boolean {
  return expr === undefined ? true : isTruthy(evaluate(expr, ctx, predicates));
}

/** Collects every predicate name and var path an expression references, for definition-time checks. */
export function collectReferences(expr: Expr | undefined, acc = { preds: new Set<string>(), vars: new Set<string>() }) {
  if (expr === null || expr === undefined || typeof expr !== "object") return acc;
  if (Array.isArray(expr)) {
    expr.forEach((e) => collectReferences(e, acc));
    return acc;
  }
  for (const [op, arg] of Object.entries(expr)) {
    if (op === "pred" && typeof arg === "string") acc.preds.add(arg);
    else if (op === "var" && typeof arg === "string") acc.vars.add(arg);
    else collectReferences(arg as Expr, acc);
  }
  return acc;
}
