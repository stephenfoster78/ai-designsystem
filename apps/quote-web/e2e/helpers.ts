import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** Fails the test on any WCAG 2.2 A/AA violation axe can detect on the current page. */
export async function expectNoAxeViolations(page: Page) {
  // Wait for a rendered page, not a mid-navigation transition.
  await page.waitForLoadState("domcontentloaded");
  await expect(page.locator("main h1").first()).toBeVisible();
  await expect(page).toHaveTitle(/.+/);
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.map((n) => n.target.join(" ")).join("\n  ")}`);
  expect(summary, summary.join("\n")).toEqual([]);
}

/** Dismisses the cookie banner so it does not interfere with journey assertions. */
export async function rejectCookies(page: Page) {
  const reject = page.getByRole("button", { name: "Reject additional cookies" });
  if (await reject.isVisible()) {
    await reject.click();
    await page.getByRole("button", { name: "Hide cookie message" }).click();
  }
}

export async function fillDate(page: Page, legend: string | RegExp, date: { day: string; month: string; year: string }) {
  const group = page.getByRole("group", { name: legend });
  await group.getByLabel("Day").fill(date.day);
  await group.getByLabel("Month").fill(date.month);
  await group.getByLabel("Year").fill(date.year);
}

/** A date `days` from today in UK time, as form parts. */
export function ukDate(days = 0) {
  const now = new Date(Date.now() + days * 86_400_000);
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(now).split("-") as [string, string, string];
  return { day: String(Number(day)), month: String(Number(month)), year };
}

export async function startQuote(page: Page, query = "") {
  await page.goto(`/quote/start${query}`);
  await rejectCookies(page);
  await page.getByRole("button", { name: "Start now" }).click();
  await expect(page).toHaveURL(/\/quote\/car\/registration$/);
}

export async function completeCarRegistration(page: Page) {
  await page.getByLabel("Car registration").fill("ab12 cde");
  await page.getByLabel("How many miles do you expect to drive in a year?").fill("8000");
  await page.getByRole("group", { name: "Has the car been modified?" }).getByLabel("No").check();
  await page.getByRole("group", { name: "Was the car imported?" }).getByLabel("No").check();
  await fillDate(page, "When do you want your cover to start?", ukDate(1));
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/quote\/car\/usage$/);
}
