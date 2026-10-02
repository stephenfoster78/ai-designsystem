import { expect, test } from "@playwright/test";
import {
  completeCarRegistration,
  completeCarUsage,
  completeSignIn,
  continueButton,
  expectNoAxeViolations,
  fillDate,
  radio,
  reachDrivers,
  rejectCookies,
  startQuote,
} from "./helpers";

test("start page passes axe, shows the conditions in a modal and requires confirmation", async ({ page }) => {
  await page.goto("/quote/start?reg=ab12cde");
  await rejectCookies(page);
  await expect(page).toHaveTitle("Get a car insurance quote – Car insurance quote");
  await expect(page.getByText("We’ll use the registration AB12CDE")).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByRole("button", { name: "Start now" }).click();
  await expect(page.getByTestId("error-summary")).toBeFocused();
  await expect(page.getByTestId("error-summary")).toContainText("Confirm you meet the conditions");

  await page.getByRole("link", { name: "Read the conditions" }).click();
  const dialog = page.getByRole("dialog", { name: "Conditions for an online quote" });
  await expect(dialog).toContainText("are aged 85 or younger");
  await expectNoAxeViolations(page);
  await dialog.getByRole("button", { name: "I meet these conditions" }).click();
  await expect(page.getByLabel("I confirm that I and any other drivers meet the conditions")).toBeChecked();

  await page.getByRole("button", { name: "Start now" }).click();
  // The registration from the direct site is looked up automatically (component spec).
  await expect(page.getByRole("region", { name: "Your car" })).toContainText("Ford Fiesta");
});

test("validation errors: summary takes focus, title is prefixed, links move focus to the field", async ({ page }) => {
  await startQuote(page);
  await expectNoAxeViolations(page);
  await continueButton(page).click();

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
});

test.describe("car registration lookup", () => {
  test("finds a car, resets, reports not found and failures, and finds a car manually", async ({ page }) => {
    await startQuote(page);
    const reg = page.getByLabel("Car registration");
    await reg.fill("zz99 zzz");
    await page.getByRole("button", { name: "Find car", exact: true }).click();
    await expect(page.getByText(/We could not find a car with that registration/)).toBeVisible();
    await expect(page.getByLabel("Car registration")).toBeFocused();

    await page.getByLabel("Car registration").fill("ERR0R");
    await page.getByRole("button", { name: "Find car", exact: true }).click();
    await expect(page.getByText(/We could not look up your car just now/)).toBeVisible();

    await page.getByLabel("Car registration").fill("KM19XYZ");
    await page.getByRole("button", { name: "Find car", exact: true }).click();
    const card = page.getByRole("region", { name: "Your car" });
    await expect(card).toContainText("Volkswagen Golf");
    await expect(card.getByRole("heading", { name: "Your car" })).toBeFocused();
    await expectNoAxeViolations(page);

    await card.getByRole("button", { name: "Not correct vehicle" }).click();
    await expect(page.getByLabel("Car registration")).toBeFocused();

    await page.getByRole("button", { name: "Manually find car" }).click();
    const dialog = page.getByRole("dialog", { name: "Find your car" });
    await dialog.getByLabel("Make").selectOption("Toyota");
    await dialog.getByLabel("Model").selectOption("Yaris");
    await dialog.getByLabel("Transmission").selectOption("Automatic");
    await dialog.getByLabel("Year of manufacture").selectOption("2018");
    await dialog.getByLabel("Variant").selectOption("1.5 Hybrid Icon 5dr CVT");
    await expectNoAxeViolations(page);
    await dialog.getByRole("button", { name: "Use this car" }).click();
    await expect(page.getByRole("region", { name: "Your car" })).toContainText("Toyota Yaris");
  });
});

test.describe("address lookup", () => {
  test("rejects Crown Dependency postcodes, asks to choose from the list, and supports manual entry", async ({ page }) => {
    await startQuote(page);
    await completeCarRegistration(page);
    await completeCarUsage(page);
    await completeSignIn(page);
    const postcode = page.getByLabel("Postcode");
    await postcode.fill("JE2 3AB");
    await page.getByRole("button", { name: "Find address" }).click();
    await expect(page.getByText(/We can only quote for addresses in the UK/)).toBeVisible();
    await expect(page.getByLabel("Postcode")).toBeFocused();

    await page.getByLabel("Postcode").fill("ls14ap");
    await page.getByRole("button", { name: "Find address" }).click();
    await expect(page.getByLabel("Select your address")).toBeFocused();
    await expect(page.getByLabel("Select your address")).toHaveValue("");
    await expectNoAxeViolations(page);

    // Continue without choosing: the list comes back with an error on it.
    await continueButton(page).click();
    const summary = page.getByTestId("error-summary");
    await expect(summary).toContainText("Select your address from the list, or enter it manually");
    await summary.getByRole("link", { name: /Select your address from the list/ }).click();
    await expect(page.getByLabel("Select your address")).toBeFocused();

    await page.getByRole("button", { name: "I cannot find my address in the list" }).click();
    await expect(page.getByLabel("Address line 1")).toBeFocused();
    await expect(page.getByLabel("Postcode")).toHaveValue("LS1 4AP");
  });
});

test("full guest journey to the answers summary, with drivers, claims and convictions", async ({ page }) => {
  test.setTimeout(90_000);
  await reachDrivers(page);
  await expectNoAxeViolations(page);

  // Additional driver: a three-step modal journey.
  await radio(page, "Do you want to add other drivers to the policy?", "Yes");
  await page.getByRole("button", { name: "Add a driver" }).click();
  const dialog = page.getByRole("dialog", { name: "Add a driver" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Continue" }).click();
  await expect(dialog.getByTestId("error-summary")).toBeFocused();
  await radio(page, "What is their relationship to you?", "Spouse or civil partner");
  await dialog.getByLabel("Title").selectOption("Mrs");
  await dialog.getByLabel("First name").fill("Ann");
  await dialog.getByLabel("Last name").fill("Taylor");
  await fillDate(dialog, "What is their date of birth?", { day: "1", month: "2", year: "1988" });
  await radio(page, "What is their marital status?", "Married");
  await radio(page, "Do they live with you?", "Yes");
  await expectNoAxeViolations(page);
  await dialog.getByRole("button", { name: "Continue" }).click();
  await expect(dialog.getByRole("heading", { name: "Their work" })).toBeFocused();
  await radio(page, "What is their employment status?", "Retired");
  await dialog.getByRole("button", { name: "Continue" }).click();
  await expect(dialog.getByRole("heading", { name: "Their driving licence" })).toBeFocused();
  await radio(page, "What type of driving licence do they have?", "Full UK licence (automatic only)");
  await fillDate(dialog, "When did they get this licence?", { month: "9", year: "2008" });
  await dialog.getByRole("button", { name: "Save driver" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("drivers-list")).toContainText("Ann Taylor");
  await expectNoAxeViolations(page);
  await continueButton(page).click();

  await expect(page).toHaveURL(/\/quote\/drivers\/household-cars$/);
  await radio(page, "How many other cars are there in your household?", "1");
  await radio(page, "Are any of them insured with us?", "No");
  await continueButton(page).click();

  // Claims: "who" lists you and the added driver.
  await expect(page).toHaveURL(/\/quote\/history\/claims-convictions$/);
  await radio(page, /accidents, claims or losses/, "Yes");
  await page.getByRole("button", { name: "Add a claim" }).click();
  const claim = page.getByRole("dialog", { name: "Add a claim" });
  await expect(claim.getByRole("group", { name: "Who did this happen to?" }).getByRole("radio")).toHaveCount(2);
  await radio(page, "Who did this happen to?", "Ann Taylor");
  await fillDate(claim, "When did it happen?", { day: "4", month: "3", year: "2024" });
  await radio(page, "What happened?", "Windscreen or glass damage");
  await radio(page, "Who was found to be at fault?", "Someone else");
  await radio(page, "Did it affect the no claims discount?", "No");
  await claim.getByRole("button", { name: "Save claim" }).click();
  await expect(page.getByTestId("claims-list")).toContainText("Windscreen or glass damage, 4 March 2024");

  await radio(page, /motoring convictions/, "Yes");
  await page.getByRole("button", { name: "Add a conviction" }).click();
  const conviction = page.getByRole("dialog", { name: "Add a conviction" });
  await radio(page, "Who was convicted?", "You");
  // Typeahead inside a modal: the list renders inside the dialog so it stays usable.
  await conviction.getByRole("combobox", { name: "What was the offence code?" }).fill("sp30");
  await page.getByRole("option", { name: /^SP30/ }).click();
  await fillDate(conviction, "When were they convicted?", { day: "10", month: "1", year: "2025" });
  await conviction.getByLabel("How many penalty points were given?").fill("3");
  await conviction.getByLabel("How long was the driving ban?").fill("0");
  await conviction.getByRole("button", { name: "Save conviction" }).click();
  await expect(page.getByTestId("convictions-list")).toContainText("SP30, 10 January 2025");
  await expectNoAxeViolations(page);
  await continueButton(page).click();

  await expect(page).toHaveURL(/\/quote\/history\/no-claims$/);
  await page.getByLabel("How many years of no claims discount do you have?").selectOption("5 years");
  await radio(page, "How did you earn it?", "On a car insurance policy in my name");
  await radio(page, "Is this no claims discount being used on another car?", "No");
  await radio(page, "Do you want to protect your no claims discount?", "Yes");
  await continueButton(page).click();

  await expect(page).toHaveURL(/\/quote\/check$/);
  await expect(page.getByTestId("quote-reference")).toHaveText(/^MQ-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  for (const text of ["AB12 CDE, Ford Fiesta", "Nurse", "Ann Taylor", "SP30, 10 January 2025", "June 2010", "Leeds, LS1 4AP"]) {
    await expect(page.getByText(text, { exact: false }).first()).toBeVisible();
  }
  await expectNoAxeViolations(page);
});
