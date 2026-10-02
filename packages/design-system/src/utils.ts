/** Joins class names, skipping falsy values. */
export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/** Space-separated id list for aria-describedby, or undefined when empty. */
export function describedBy(...ids: unknown[]): string | undefined {
  const list = ids.filter((id): id is string => typeof id === "string" && id !== "").join(" ");
  return list || undefined;
}

export const hintId = (id: string) => `${id}-hint`;
export const errorId = (id: string) => `${id}-error`;
