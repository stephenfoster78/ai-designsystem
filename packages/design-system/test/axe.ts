import axe from "axe-core";

/** Runs axe against a container and returns violations as readable strings (empty = pass). */
export async function axeViolations(container: Element): Promise<string[]> {
  const results = await axe.run(container, {
    // Colour contrast cannot be computed in jsdom; tokens are contrast-tested separately
    // and Playwright runs axe with contrast in a real browser.
    rules: { "color-contrast": { enabled: false } },
  });
  return results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`);
}
