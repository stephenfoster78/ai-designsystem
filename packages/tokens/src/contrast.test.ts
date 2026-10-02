import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { contrastRatio } from "./contrast";

const flat = JSON.parse(
  readFileSync(fileURLToPath(new URL("../dist/tokens.flat.json", import.meta.url)), "utf8"),
) as Record<string, string>;

const c = (name: string) => {
  const value = flat[`color-${name}`];
  if (!value) throw new Error(`Unknown colour token color-${name}`);
  return value;
};

// [foreground, background, minimum ratio, reason]
const pairs: Array<[string, string, number, string]> = [
  ["ink", "page", 4.5, "body text"],
  ["ink", "surface-subtle", 4.5, "body text on subtle panels"],
  ["ink", "surface-muted", 4.5, "body text on muted panels"],
  ["ink-muted", "page", 4.5, "hint text"],
  ["ink-muted", "surface-subtle", 4.5, "hint text on subtle panels"],
  ["ink-error", "page", 4.5, "error messages"],
  ["ink-error", "surface-error", 4.5, "error summary"],
  ["ink-success", "surface-success", 4.5, "success panels"],
  ["ink-warning", "surface-warning", 4.5, "warning panels"],
  ["ink", "surface-info", 4.5, "info panels"],
  ["link", "page", 4.5, "links"],
  ["link-hover", "page", 4.5, "hovered links"],
  ["link-visited", "page", 4.5, "visited links"],
  ["ink-inverse", "brand", 4.5, "primary button label, UK prefix"],
  ["ink-inverse", "brand-hover", 4.5, "hovered primary button"],
  ["focus-ink", "focus", 4.5, "text on focus colour"],
  ["line-strong", "page", 3, "form control boundary (1.4.11)"],
  ["line-error", "page", 3, "error control boundary (1.4.11)"],
  ["brand", "page", 3, "primary button boundary (1.4.11)"],
  ["focus-ink", "page", 3, "outer focus ring on light surfaces"],
  ["focus", "brand", 3, "inner focus ring on brand surfaces"],
];

describe("colour token contrast (WCAG 2.2 AA)", () => {
  it.each(pairs)("%s on %s ≥ %d:1 (%s)", (fg, bg, min) => {
    expect(contrastRatio(c(fg), c(bg))).toBeGreaterThanOrEqual(min);
  });
});

describe("contrastRatio", () => {
  it("returns 21 for black on white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
  });
  it("is symmetric", () => {
    expect(contrastRatio("#1d4f91", "#ffffff")).toBe(contrastRatio("#ffffff", "#1d4f91"));
  });
});
