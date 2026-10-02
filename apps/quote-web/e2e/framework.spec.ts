import { expect, test } from "@playwright/test";
import { completeCarRegistration, expectNoAxeViolations, fillDate, rejectCookies, startQuote } from "./helpers";

test.describe("route guard", () => {
  test("without a session, quote steps redirect to the start page", async ({ page }) => {
    await page.goto("/quote/car/usage");
    await expect(page).toHaveURL(/\/quote\/start$/);
  });

  test("deep links past the first incomplete step redirect back to it", async ({ page }) => {
    await startQuote(page);
    await page.goto("/quote/you/details");
    await expect(page).toHaveURL(/\/quote\/car\/registration$/);
    await page.goto("/quote/check");
    await expect(page).toHaveURL(/\/quote\/car\/registration$/);
  });

  test("unknown steps return a 404", async ({ page }) => {
    const response = await page.goto("/quote/car/nope");
    expect(response?.status()).toBe(404);
  });
});

test("save and come back later keeps valid answers, and the quote can be resumed with its reference", async ({ page, browser }) => {
  await startQuote(page);
  await page.getByLabel("Car registration").fill("KM19 XYZ");
  await page.getByLabel("How many miles do you expect to drive in a year?").fill("lots");
  await page.getByRole("button", { name: "Save and come back later" }).click();

  await expect(page).toHaveURL(/\/quote\/saved$/);
  await expect(page.getByRole("heading", { level: 1, name: "Your quote has been saved" })).toBeVisible();
  const reference = (await page.getByTestId("quote-reference").textContent())!.trim();
  expect(reference).toMatch(/^MQ-/);
  await expectNoAxeViolations(page);

  await page.getByRole("link", { name: "Continue your quote" }).click();
  // The registration was looked up on save; the invalid mileage was not kept.
  await expect(page.getByRole("region", { name: "Your car" })).toContainText("Volkswagen Golf");
  await expect(page.getByLabel("How many miles do you expect to drive in a year?")).toHaveValue("");

  // Resume on another device: wrong details give a generic message; the right ones restore the quote.
  const other = await browser.newContext();
  const resume = await other.newPage();
  await resume.goto("/quote/resume");
  await expectNoAxeViolations(resume);
  await resume.getByLabel("Quote reference").fill(reference.toLowerCase());
  await fillDate(resume, "What is your date of birth?", { day: "1", month: "1", year: "1990" });
  await resume.getByRole("button", { name: "Continue your quote" }).click();
  await expect(resume.getByTestId("error-summary")).toContainText("We could not find a saved quote with those details");

  // Saved before date of birth was given: the car registration is the second factor.
  await resume.getByLabel("Quote reference").fill(reference);
  await resume.getByText("I saved my quote before giving my date of birth").click();
  await resume.getByLabel("Car registration").fill("km19xyz");
  await resume.getByRole("button", { name: "Continue your quote" }).click();
  await expect(resume).toHaveURL(/\/quote\/car\/registration$/);
  await expect(resume.getByRole("region", { name: "Your car" })).toContainText("Volkswagen Golf");
  await other.close();
});

test("resume locks a reference after five failed attempts", async ({ page }) => {
  await page.goto("/quote/resume");
  await rejectCookies(page);
  for (let attempt = 1; attempt <= 6; attempt++) {
    await page.getByLabel("Quote reference").fill("MQ-AAAA-BBBB");
    await fillDate(page, "What is your date of birth?", { day: "1", month: "1", year: "1990" });
    await page.getByRole("button", { name: "Continue your quote" }).click();
    await expect(page.getByTestId("error-summary")).toBeVisible();
  }
  await expect(page.getByTestId("error-summary")).toContainText("You’ve tried too many times. Try again in 15 minutes");
});

test.describe("cookie consent", () => {
  test("banner passes axe, records the choice and is not shown again", async ({ page }) => {
    await page.goto("/quote/start");
    const banner = page.getByRole("region", { name: "Cookies on this service" });
    await expect(banner).toBeVisible();
    await expectNoAxeViolations(page);
    await banner.getByRole("button", { name: "Accept additional cookies" }).click();
    await expect(banner.getByText("You have accepted additional cookies.")).toBeVisible();
    const consent = (await page.context().cookies()).find((c) => c.name === "qf_cookie_consent");
    expect(decodeURIComponent(consent?.value ?? "")).toContain('"analytics":true');
    await page.reload();
    await expect(page.getByRole("region", { name: "Cookies on this service" })).toHaveCount(0);
  });

  test("respects consent already set by the direct site on the shared domain", async ({ page, context }) => {
    const value = encodeURIComponent(JSON.stringify({ version: 1, analytics: false, marketing: false, decidedAt: "2026-10-01T00:00:00Z" }));
    await context.addCookies([{ name: "qf_cookie_consent", value, url: "http://localhost:3100" }]);
    await page.goto("/quote/start");
    await expect(page.getByRole("region", { name: "Cookies on this service" })).toHaveCount(0);
  });

  test("settings open in a modal dialog from the footer, trap focus and close with Escape", async ({ page }) => {
    await page.goto("/quote/start");
    await rejectCookies(page);
    const footerLink = page.getByRole("contentinfo").getByRole("link", { name: "Cookies" });
    await footerLink.click();
    const dialog = page.getByRole("dialog", { name: "Cookie settings" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: "Cookie settings" })).toBeFocused();
    await expectNoAxeViolations(page);
    // Background is inert while the modal is open.
    for (let i = 0; i < 12; i++) await page.keyboard.press("Tab");
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(footerLink).toBeFocused();
  });

  test("footer links work without JavaScript", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto("/quote/start");
    await page.getByRole("contentinfo").getByRole("link", { name: "Accessibility statement" }).click();
    await expect(page).toHaveURL(/\/accessibility$/);
    await expect(page.getByRole("heading", { level: 1, name: "Accessibility statement" })).toBeVisible();
    await context.close();
  });
});

test("steps work without JavaScript (progressive enhancement)", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/quote/start");
  await page.getByLabel("I confirm that I and any other drivers meet the conditions").check();
  await page.getByRole("button", { name: "Start now" }).click();
  await expect(page).toHaveURL(/\/quote\/car\/registration$/);
  // Find car is a submit button, so the lookup works without JavaScript.
  await page.getByLabel("Car registration").fill("AB12CDE");
  await page.getByRole("button", { name: "Find car", exact: true }).click();
  await expect(page.getByRole("region", { name: "Your car" })).toContainText("Ford Fiesta");
  await page.getByLabel("How many miles do you expect to drive in a year?").fill("9000");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByTestId("error-summary")).toBeVisible();
  await expect(page.getByRole("region", { name: "Your car" })).toContainText("Ford Fiesta");
  await expect(page.getByLabel("How many miles do you expect to drive in a year?")).toHaveValue("9000");
  await context.close();
});

test.describe("session timeout", () => {
  test("warns two minutes before the end, can be extended, then ends with the reference shown", async ({ page }) => {
    await page.clock.install();
    await startQuote(page);
    await completeCarRegistration(page);
    const dialog = page.getByRole("dialog", { name: "Your session is about to end" });
    await expect(dialog).toBeHidden();

    await page.clock.fastForward("28:01");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Continue with my quote" })).toBeFocused();
    await expect(page.getByTestId("countdown")).toHaveAttribute("aria-hidden", "true");
    await expect(page.getByTestId("countdown-announcement")).toHaveText("Your session will end in 2 minutes.");
    await expectNoAxeViolations(page);

    await page.clock.fastForward("01:00");
    await expect(page.getByTestId("countdown-announcement")).toHaveText("Your session will end in 1 minute.");

    await dialog.getByRole("button", { name: "Continue with my quote" }).click();
    await expect(dialog).toBeHidden();

    await page.clock.fastForward("30:01");
    await expect(page).toHaveURL(/\/quote\/session-ended$/);
    await expect(page.getByTestId("quote-reference")).toHaveText(/^MQ-/);
    await expectNoAxeViolations(page);

    // The ended session cannot be used to continue.
    await page.goto("/quote/car/usage");
    await expect(page).toHaveURL(/\/quote\/session-ended$/);
  });
});
