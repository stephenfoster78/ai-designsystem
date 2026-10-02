import { expect, test } from "@playwright/test";
import { completeCarRegistration, expectNoAxeViolations, fillDate, startQuote } from "./helpers";

test("start page passes axe and carries a registration through from the direct site", async ({ page }) => {
  await page.goto("/quote/start?reg=ab12cde");
  await expect(page).toHaveTitle("Get a car insurance quote – Car insurance quote");
  await expect(page.getByText("We’ll use the registration AB12CDE")).toBeVisible();
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Reject additional cookies" }).click();
  await page.getByRole("button", { name: "Start now" }).click();
  await expect(page.getByLabel("Car registration")).toHaveValue("AB12CDE");
});

test("validation errors: summary takes focus, title is prefixed, links move focus to the field", async ({ page }) => {
  await startQuote(page);
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Continue" }).click();

  const summary = page.getByTestId("error-summary");
  await expect(summary).toBeFocused();
  await expect(page).toHaveTitle(/^Error: Tell us about your car/);
  await expect(summary.getByRole("link")).toHaveText([
    "Enter your car registration",
    "Enter how many miles you expect to drive in a year",
    "Select yes if the car has been modified",
    "Select yes if the car was imported",
    "Enter the date you want your cover to start",
  ]);
  await expectNoAxeViolations(page);

  await summary.getByRole("link", { name: "Select yes if the car was imported" }).click();
  await expect(page.getByRole("group", { name: /Was the car imported\?/ }).getByLabel("Yes")).toBeFocused();

  // Typed values survive a failed submit, and specific errors replace generic ones.
  await page.getByLabel("Car registration").fill("TOO LONG 123");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByLabel("Car registration")).toHaveValue("TOO LONG 123");
  await expect(summary.getByRole("link").first()).toHaveText(/must only include letters/);
});

test("happy path through the slice with a conditional question, autosave and a reference", async ({ page }) => {
  await startQuote(page);
  await completeCarRegistration(page);

  // Conditional reveal: purchase date only when the car has been bought.
  const purchaseDate = page.getByRole("group", { name: "When did you buy the car?" });
  await expect(purchaseDate).toBeHidden();
  await page.getByRole("group", { name: "Have you bought the car yet?" }).getByLabel("Yes").check();
  await expect(purchaseDate).toBeVisible();
  await fillDate(page, "When did you buy the car?", { day: "14", month: "3", year: "2024" });

  await page.getByLabel("Me", { exact: true }).check();
  await page.getByLabel("Social and commuting").check();
  await page.getByRole("group", { name: /kept at your home address/ }).getByLabel("No").check();
  await page.getByLabel("What is the postcode where the car is kept overnight?").fill("ls1 4ap");
  await page.getByLabel("On a private driveway").check();
  await expectNoAxeViolations(page);
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page).toHaveURL(/\/quote\/you\/details$/);
  // Focus moves to the new page heading after client-side navigation.
  await expect(page.getByRole("heading", { level: 1, name: "Your details" })).toBeFocused();
  await expect(page.getByRole("navigation", { name: "Quote progress" }).locator("[aria-current=step]")).toContainText("About you");

  await page.getByLabel("First name").fill("Sam");
  await page.getByLabel("Last name").fill("Taylor");
  await fillDate(page, "What is your date of birth?", { day: "5", month: "5", year: "1990" });
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page).toHaveURL(/\/quote\/check$/);
  await expect(page.getByTestId("quote-reference")).toHaveText(/^MQ-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  await expect(page.getByText("AB12 CDE")).toBeVisible();
  await expect(page.getByText("14 March 2024")).toBeVisible();
  await expect(page.getByText("LS1 4AP")).toBeVisible();
  await expectNoAxeViolations(page);
});

test("backing out of a branch drops its stale answer", async ({ page }) => {
  await startQuote(page);
  await completeCarRegistration(page);
  await page.getByRole("group", { name: "Have you bought the car yet?" }).getByLabel("Yes").check();
  await fillDate(page, "When did you buy the car?", { day: "14", month: "3", year: "2024" });
  await page.getByRole("group", { name: "Have you bought the car yet?" }).getByLabel("Not yet").check();
  await page.getByLabel("Me", { exact: true }).check();
  await page.getByLabel("Social, domestic and pleasure").check();
  await page.getByRole("group", { name: /kept at your home address/ }).getByLabel("Yes").check();
  await page.getByLabel("In a locked garage").check();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/quote\/you\/details$/);

  await page.goto("/quote/car/usage");
  await page.getByRole("group", { name: "Have you bought the car yet?" }).getByLabel("Yes").check();
  // The date was never stored, so it is empty when the branch is reopened.
  await expect(page.getByRole("group", { name: "When did you buy the car?" }).getByLabel("Year")).toHaveValue("");
});
