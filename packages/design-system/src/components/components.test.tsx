import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axeViolations } from "../../test/axe";
import { parseConsent, serialiseConsent, makeConsent, CONSENT_VERSION } from "../consent";
import { CookieBanner, CookieSettings } from "./Cookies";
import { ErrorSummary } from "./ErrorSummary";
import { DateInput, Radios, TextInput } from "./fields";
import { SessionTimeout, formatDuration, thresholdFor } from "./SessionTimeout";
import { SectionProgress } from "./layout";

describe("TextInput", () => {
  it("links hint and error via aria-describedby and marks invalid", async () => {
    const { container } = render(<TextInput id="reg" label="Registration" hint="For example, AB12 CDE" error="Enter your registration" />);
    const input = screen.getByLabelText("Registration");
    expect(input).toHaveAttribute("aria-describedby", "reg-hint reg-error");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Enter your registration").closest("p")).toHaveTextContent("Error: Enter your registration");
    expect(await axeViolations(container)).toEqual([]);
  });

  it("hides decorative prefixes from assistive technology", () => {
    render(<TextInput id="amount" label="Amount" prefix="£" />);
    expect(screen.getByText("£")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("Radios", () => {
  it("groups options in a named fieldset and gives the first option the question id", async () => {
    const { container } = render(
      <Radios id="purchased" label="Have you bought the car yet?" options={[{ value: "yes", label: "Yes" }, { value: "notYet", label: "Not yet" }]} value="notYet" error="Select an answer" />,
    );
    const group = screen.getByRole("group", { name: "Have you bought the car yet?" });
    expect(within(group).getByLabelText("Yes")).toHaveAttribute("id", "purchased");
    expect(within(group).getByLabelText("Not yet")).toBeChecked();
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe("DateInput", () => {
  it("labels each part and highlights only the parts in error", async () => {
    const { container } = render(<DateInput id="dob" label="Date of birth" error="Date of birth must include a year" errorParts={["year"]} value={{ day: "1", month: "2", year: "" }} />);
    expect(screen.getByLabelText("Day")).not.toHaveAttribute("aria-invalid");
    expect(screen.getByLabelText("Year")).toHaveAttribute("aria-invalid", "true");
    // The error summary target is the first part in error.
    expect(screen.getByLabelText("Year")).toHaveAttribute("id", "dob-input");
    expect(screen.getByLabelText("Day")).toHaveAttribute("inputmode", "numeric");
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe("ErrorSummary", () => {
  it("takes focus and moves focus to the field when a link is followed", async () => {
    const user = userEvent.setup();
    render(
      <>
        <ErrorSummary items={[{ targetId: "reg", message: "Enter your registration" }]} />
        <TextInput id="reg" label="Registration" error="Enter your registration" />
      </>,
    );
    expect(screen.getByTestId("error-summary")).toHaveFocus();
    Element.prototype.scrollIntoView = vi.fn();
    await user.click(screen.getByRole("link", { name: "Enter your registration" }));
    expect(screen.getByLabelText("Registration")).toHaveFocus();
  });
});

describe("SessionTimeout", () => {
  it("formats durations and picks announcement thresholds", () => {
    expect(formatDuration(105)).toBe("1 minute 45 seconds");
    expect(formatDuration(60)).toBe("1 minute");
    expect(formatDuration(0)).toBe("0 seconds");
    const t = [120, 60, 50, 30, 10];
    expect(thresholdFor(121, t)).toBeNull();
    expect(thresholdFor(119, t)).toBe(120);
    expect(thresholdFor(55, t)).toBe(60);
    expect(thresholdFor(10, t)).toBe(10);
  });

  it("warns, announces only at thresholds, extends and expires", async () => {
    vi.useFakeTimers();
    try {
      const onExtend = vi.fn().mockResolvedValue(30 * 60_000);
      const onExpire = vi.fn();
      render(<SessionTimeout remainingMs={125_000} onExtend={onExtend} onExpire={onExpire} />);
      const dialog = document.querySelector("dialog")!;
      expect(dialog).not.toHaveAttribute("open");

      await act(() => vi.advanceTimersByTimeAsync(6_000)); // 119 s left
      expect(dialog).toHaveAttribute("open");
      const live = screen.getByTestId("countdown-announcement");
      expect(live).toHaveAttribute("aria-live", "polite");
      expect(live).toHaveTextContent("Your session will end in 2 minutes.");
      expect(screen.getByTestId("countdown")).toHaveAttribute("aria-hidden", "true");

      await act(() => vi.advanceTimersByTimeAsync(30_000)); // 89 s: no new announcement
      expect(live).toHaveTextContent("2 minutes.");
      await act(() => vi.advanceTimersByTimeAsync(30_000)); // 59 s
      expect(live).toHaveTextContent("Your session will end in 1 minute.");

      await act(async () => screen.getByRole("button", { name: "Continue with my quote" }).click());
      expect(onExtend).toHaveBeenCalledOnce();
      expect(dialog).not.toHaveAttribute("open");

      await act(() => vi.advanceTimersByTimeAsync(30 * 60_000));
      expect(onExpire).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });

  it("treats Escape as continue", async () => {
    vi.useFakeTimers();
    try {
      const onExtend = vi.fn().mockResolvedValue(60_000 * 30);
      render(<SessionTimeout remainingMs={100_000} onExtend={onExtend} onExpire={() => {}} />);
      await act(() => vi.advanceTimersByTimeAsync(1_000));
      await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
      expect(onExtend).toHaveBeenCalledOnce();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("cookies", () => {
  it("round-trips consent and rejects other versions or malformed values", () => {
    const consent = makeConsent({ analytics: true, marketing: false }, new Date("2026-10-02T09:00:00Z"));
    expect(parseConsent(serialiseConsent(consent))).toEqual(consent);
    expect(parseConsent(serialiseConsent({ ...consent, version: CONSENT_VERSION + 1 }))).toBeNull();
    expect(parseConsent("not-json")).toBeNull();
  });

  it("does not render when consent already exists (shared with the direct site)", () => {
    render(<CookieBanner initialConsent={makeConsent({ analytics: false, marketing: false })} onDecision={() => {}} onManage={() => {}} />);
    expect(screen.queryByTestId("cookie-banner")).toBeNull();
  });

  it("records a decision and moves focus to the confirmation", async () => {
    const user = userEvent.setup();
    const onDecision = vi.fn();
    const { container } = render(<CookieBanner initialConsent={null} onDecision={onDecision} onManage={() => {}} />);
    expect(await axeViolations(container)).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Reject additional cookies" }));
    expect(onDecision).toHaveBeenCalledWith(expect.objectContaining({ analytics: false, marketing: false }));
    expect(screen.getByText(/You have rejected additional cookies/).closest("[tabindex]")).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Hide cookie message" }));
    expect(screen.queryByTestId("cookie-banner")).toBeNull();
  });

  it("saves granular settings", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<CookieSettings consent={null} onSave={onSave} />);
    const analytics = screen.getByRole("group", { name: "Do you want to accept analytics cookies?" });
    await user.click(within(analytics).getByLabelText("Yes"));
    await user.click(screen.getByRole("button", { name: "Save cookie settings" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ analytics: true, marketing: false }));
    expect(screen.getByRole("status")).toHaveTextContent("saved");
  });
});

describe("SectionProgress", () => {
  it("conveys status in text and marks the current section", async () => {
    const { container } = render(
      <SectionProgress
        items={[
          { id: "car", label: "Your car", status: "complete", href: "/quote/car/registration" },
          { id: "you", label: "About you", status: "current" },
          { id: "drivers", label: "Drivers", status: "upcoming" },
        ]}
      />,
    );
    const nav = screen.getByRole("navigation", { name: "Quote progress" });
    const current = nav.querySelector("[aria-current=step]");
    expect(current).toHaveTextContent("Section 2: About you (current section)");
    expect(within(nav).getByRole("link", { name: /Your car/ })).toHaveAttribute("href", "/quote/car/registration");
    expect(await axeViolations(container)).toEqual([]);
  });
});
