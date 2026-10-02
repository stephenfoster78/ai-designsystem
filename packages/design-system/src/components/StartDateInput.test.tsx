import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axeViolations } from "../../test/axe";
import { AnalyticsProvider } from "../analytics";
import { StartDateInput } from "./StartDateInput";

const TODAY = "2026-10-02"; // Friday
const frame = () => act(() => new Promise((r) => requestAnimationFrame(() => r(undefined))));

function setup(props: Partial<Parameters<typeof StartDateInput>[0]> = {}) {
  const track = vi.fn();
  const user = userEvent.setup();
  const utils = render(
    <AnalyticsProvider track={track}>
      <form data-testid="form">
        <StartDateInput id="coverStart" label="When do you want your cover to start?" hint="Your cover can start today or on any date up to {latest}." today={TODAY} {...props} />
      </form>
    </AnalyticsProvider>,
  );
  const formData = () => new FormData(screen.getByTestId("form") as HTMLFormElement);
  return { ...utils, user, track, formData };
}

describe("StartDateInput", () => {
  it("labels the quick choices with their dates and states the last date", async () => {
    const { container } = setup();
    const group = screen.getByRole("group", { name: "When do you want your cover to start?" });
    expect(within(group).getByLabelText("Today (Friday 2 October)")).toBeInTheDocument();
    expect(within(group).getByLabelText("Tomorrow (Saturday 3 October)")).toBeInTheDocument();
    expect(group).toHaveAccessibleDescription("Your cover can start today or on any date up to 1 November 2026.");
    expect(await axeViolations(container)).toEqual([]);
  });

  it("reveals the date field for another date, with an unambiguous example", async () => {
    const { user, track, formData } = setup();
    const input = screen.getByLabelText("Date");
    expect(input).not.toBeVisible();
    await user.click(screen.getByLabelText("Tomorrow (Saturday 3 October)"));
    expect(track).toHaveBeenCalledWith({ action: "valueSelected", field: "coverStart", inputMethod: "quickSelect" });
    expect(formData().get("coverStart-choice")).toBe("tomorrow");
    await user.click(screen.getByLabelText("Another date"));
    expect(input).toBeVisible();
    expect(input).toHaveAccessibleDescription("For example, 13/10/2026. It must be on or before 1 November 2026.");
    await user.type(input, "15/10/2026");
    expect(formData().get("coverStart")).toBe("15/10/2026");
  });

  it("redisplays saved values on the matching option", () => {
    setup({ value: "2026-10-03" });
    expect(screen.getByLabelText("Tomorrow (Saturday 3 October)")).toBeChecked();
  });

  it("shows date errors on the input and choice errors on the group", async () => {
    const first = setup({ raw: { choice: "other", date: "31/02/2026" }, error: "Enter a real date, like 15/10/2026", errorTarget: "date" });
    const input = screen.getByLabelText("Date");
    expect(input).toHaveValue("31/02/2026");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(/Error: Enter a real date/);
    expect(await axeViolations(first.container)).toEqual([]);
    first.unmount();
    setup({ error: "Select when you want your cover to start" });
    expect(screen.getByRole("group")).toHaveAccessibleDescription(/Error: Select when you want your cover to start/);
  });

  it("chooses a date from the calendar modal with the keyboard", async () => {
    const { user, track, formData, container } = setup({ raw: { choice: "other", date: "" } });
    await user.click(screen.getByRole("button", { name: "Choose a date from the calendar" }));
    const dialog = screen.getByRole("dialog", { name: "Choose a start date" });
    expect(track).toHaveBeenCalledWith({ action: "calendarOpened", field: "coverStart" });
    // October and November are shown; focus starts on today.
    expect(within(dialog).getAllByRole("grid").map((g) => g.getAttribute("aria-labelledby") && g.querySelector("caption")?.textContent)).toEqual([
      "October 2026",
      "November 2026",
    ]);
    const todayButton = within(dialog).getByRole("button", { name: "Friday 2 October 2026, today" });
    expect(todayButton).toHaveFocus();
    // One tab stop for all the days.
    expect(within(dialog).getAllByRole("button").filter((b) => b.closest("table") && b.tabIndex === 0)).toHaveLength(1);
    // Earlier days are not buttons.
    expect(within(dialog).queryByRole("button", { name: "Thursday 1 October 2026" })).toBeNull();
    expect(within(dialog).getByText("Thursday 1 October 2026, not available")).toBeInTheDocument();
    expect(await axeViolations(container)).toEqual([]);

    await user.keyboard("{ArrowLeft}"); // clamped at today
    expect(todayButton).toHaveFocus();
    await user.keyboard("{ArrowDown}{ArrowRight}"); // +8 days
    expect(within(dialog).getByRole("button", { name: "Saturday 10 October 2026" })).toHaveFocus();
    await user.keyboard("{End}");
    expect(within(dialog).getByRole("button", { name: "Sunday 11 October 2026" })).toHaveFocus();
    await user.keyboard("{PageDown}"); // 11 November is beyond 1 November: clamped
    expect(within(dialog).getByRole("button", { name: "Sunday 1 November 2026" })).toHaveFocus();
    await user.keyboard("{Enter}");
    await frame();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByLabelText("Date")).toHaveValue("01/11/2026");
    expect(screen.getByLabelText("Date")).toHaveFocus();
    expect(screen.getByLabelText("Another date")).toBeChecked();
    expect(formData().get("coverStart-choice")).toBe("other");
    expect(track).toHaveBeenCalledWith({ action: "valueSelected", field: "coverStart", inputMethod: "calendarPicker" });
  });

  it("closes the calendar with Escape or Cancel without changing the value", async () => {
    const { user, track } = setup({ raw: { choice: "other", date: "15/10/2026" } });
    await user.click(screen.getByRole("button", { name: "Choose a date from the calendar" }));
    // Opens on the typed date.
    expect(screen.getByRole("button", { name: "Thursday 15 October 2026" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Thursday 15 October 2026" }).closest("td")).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(track).toHaveBeenCalledWith({ action: "calendarClosed", field: "coverStart", selected: false });
    await user.click(screen.getByRole("button", { name: "Choose a date from the calendar" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByLabelText("Date")).toHaveValue("15/10/2026");
  });
});
