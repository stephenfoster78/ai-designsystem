import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** Fails the test on any WCAG 2.2 A/AA violation axe can detect on the current page. */
export async function expectNoAxeViolations(page: Page, include?: string) {
  // Wait for a rendered page, not a mid-navigation transition.
  await page.waitForLoadState("domcontentloaded");
  await expect(page.locator("main h1").first()).toBeVisible();
  await expect(page).toHaveTitle(/.+/);
  let builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]);
  if (include) builder = builder.include(include);
  const results = await builder.analyze();
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

export async function fillDate(scope: Page | ReturnType<Page["getByRole"]>, legend: string | RegExp, date: { day?: string; month: string; year: string }) {
  const group = scope.getByRole("group", { name: legend });
  if (date.day !== undefined) await group.getByLabel("Day").fill(date.day);
  await group.getByLabel("Month").fill(date.month);
  await group.getByLabel("Year").fill(date.year);
}

/** A date `days` from today in UK time, as form parts. */
export function ukDate(days = 0) {
  const now = new Date(Date.now() + days * 86_400_000);
  const [year, month, day] = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(now).split("-") as [string, string, string];
  return { day: String(Number(day)), month: String(Number(month)), year };
}

export const radio = (page: Page, question: string | RegExp, answer: string) =>
  page.getByRole("group", { name: question }).getByLabel(answer, { exact: true }).check();

export const continueButton = (page: Page) => page.getByRole("button", { name: "Continue", exact: true });

export async function startQuote(page: Page, query = "") {
  await page.goto(`/quote/start${query}`);
  await rejectCookies(page);
  await page.getByLabel("I confirm that I and any other drivers meet the conditions").check();
  await page.getByRole("button", { name: "Start now" }).click();
  await expect(page).toHaveURL(/\/quote\/car\/registration$/);
}

export async function completeCarRegistration(page: Page, reg = "AB12 CDE") {
  await page.getByLabel("Car registration").fill(reg);
  await page.getByRole("button", { name: "Find car", exact: true }).click();
  await expect(page.getByRole("region", { name: "Your car" })).toBeVisible();
  await page.getByLabel("How many miles do you expect to drive in a year?").fill("8000");
  await radio(page, "Has the car been modified?", "No");
  await radio(page, "Was the car imported?", "No");
  await page.getByRole("group", { name: "When do you want your cover to start?" }).getByLabel(/^Tomorrow \(/).check();
  await continueButton(page).click();
  await expect(page).toHaveURL(/\/quote\/car\/usage$/);
}

export async function completeCarUsage(page: Page) {
  await radio(page, "Have you bought the car yet?", "Not yet");
  await page.getByLabel("How much is the car worth?").fill("8500");
  await radio(page, "Who is the legal owner of the car?", "Me");
  await radio(page, "Who is the registered keeper?", "Me");
  await radio(page, "What will you use the car for?", "Social, domestic and pleasure");
  await radio(page, /kept at your home address/, "Yes");
  await radio(page, "Where is the car parked overnight?", "On a private driveway");
  await continueButton(page).click();
  await expect(page).toHaveURL(/\/quote\/you\/sign-in$/);
}

export async function completeSignIn(page: Page) {
  await radio(page, "How do you want to continue?", "Continue as a guest");
  await continueButton(page).click();
  await expect(page).toHaveURL(/\/quote\/you\/details$/);
}

export async function completeYourDetails(page: Page) {
  await page.getByLabel("Title").selectOption("Mr");
  await page.getByLabel("First name").fill("Sam");
  await page.getByLabel("Last name").fill("Taylor");
  await fillDate(page, "What is your date of birth?", { day: "5", month: "5", year: "1990" });
  await page.getByLabel("Email address").fill("sam@example.com");
  await page.getByLabel("Phone number").fill("07700 900982");
  await page.getByLabel("Postcode").fill("LS1 4AP");
  await page.getByRole("button", { name: "Find address" }).click();
  await page.getByLabel("Select your address").selectOption({ index: 3 });
  await radio(page, "What is your marital status?", "Married");
  await radio(page, "Have you lived in the UK since you were born?", "Yes");
  await radio(page, "Do you own your home?", "Yes");
  await radio(page, "Do you have any children under 16?", "No");
  await continueButton(page).click();
  await expect(page).toHaveURL(/\/quote\/you\/occupation$/);
}

export async function chooseTypeahead(page: Page, label: string, typed: string, option: string) {
  const input = page.getByRole("combobox", { name: label });
  await input.fill(typed);
  await page.getByRole("option", { name: option, exact: true }).click();
  await expect(input).toHaveValue(option);
}

export async function completeOccupation(page: Page) {
  await radio(page, "What is your employment status?", "Employed");
  await chooseTypeahead(page, "What is your job title?", "nur", "Nurse");
  await chooseTypeahead(page, "What industry do you work in?", "health", "Health care");
  await radio(page, "Do you have another job?", "No");
  await continueButton(page).click();
  await expect(page).toHaveURL(/\/quote\/you\/licence$/);
}

export async function completeLicence(page: Page) {
  await radio(page, "What type of driving licence do you have?", "Full UK licence (manual)");
  await fillDate(page, "When did you get this licence?", { month: "6", year: "2010" });
  await continueButton(page).click();
  await expect(page).toHaveURL(/\/quote\/drivers\/additional-drivers$/);
}

/** Runs from Start to the additional drivers step. */
export async function reachDrivers(page: Page) {
  await startQuote(page);
  await completeCarRegistration(page);
  await completeCarUsage(page);
  await completeSignIn(page);
  await completeYourDetails(page);
  await completeOccupation(page);
  await completeLicence(page);
}
