import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { axeViolations } from "../../test/axe";
import { AddAnotherList } from "./AddAnotherList";
import { AddressLookup } from "./AddressLookup";
import { RegLookup, type LookupVehicleTree } from "./RegLookup";
import { Typeahead } from "./Typeahead";

const tree: LookupVehicleTree = { Ford: { Fiesta: { Manual: { "2015": ["1.1 Trend 5dr"] } } } };
const fiesta = { reg: "AB12CDE", make: "Ford", model: "Fiesta", year: 2012, transmission: "Manual", variant: "1.25 Zetec 5dr", source: "lookup" as const };

describe("Typeahead", () => {
  const options = [
    { value: "OCC-1", label: "Dental nurse" },
    { value: "OCC-2", label: "Nurse" },
    { value: "OCC-3", label: "Plumber" },
  ];

  it("labels the input, keeps its id for error links, and lists matches alphabetically", async () => {
    const user = userEvent.setup();
    const { container } = render(<Typeahead id="occupation" label="What is your job title?" hint="Start typing" error="Choose from the list" options={options} />);
    const input = screen.getByRole("combobox", { name: "What is your job title?" });
    expect(input).toHaveAttribute("id", "occupation");
    expect(input.getAttribute("aria-describedby")).toBeTruthy();
    expect(await axeViolations(container)).toEqual([]);
    await user.type(input, "nur");
    const listbox = await screen.findByRole("listbox");
    expect(within(listbox).getAllByRole("option").map((o) => o.textContent)).toEqual(["Dental nurse", "Nurse"]);
    await user.click(within(listbox).getByRole("option", { name: "Nurse" }));
    expect(input).toHaveValue("Nurse");
  });
});

describe("RegLookup", () => {
  it("shows a results card with a reset that returns focus to the input", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <form>
        <RegLookup id="registration" label="Car registration" lookup={{ status: "found", vehicle: fiesta }} loadTree={async () => tree} />
      </form>,
    );
    const card = screen.getByRole("region", { name: "Your car" });
    expect(card).toHaveTextContent("Ford Fiesta");
    expect(await axeViolations(container)).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Not correct vehicle" }));
    await act(() => new Promise((r) => requestAnimationFrame(() => r(undefined))));
    expect(screen.getByLabelText("Car registration")).toHaveFocus();
    expect(screen.getByLabelText("Car registration")).toHaveValue("AB12CDE");
  });

  it("restricts input to the allowed characters and uppercases", async () => {
    const user = userEvent.setup();
    render(<RegLookup id="registration" label="Car registration" loadTree={async () => tree} />);
    await user.type(screen.getByLabelText("Car registration"), "ab-12 c!de");
    expect(screen.getByLabelText("Car registration")).toHaveValue("AB12 CDE");
  });

  it("announces lookup failures and links the message to the input", () => {
    render(<RegLookup id="registration" label="Car registration" value={{ reg: "ZZ99ZZZ" }} lookup={{ status: "notFound", message: "We could not find a car with that registration" }} loadTree={async () => tree} />);
    const input = screen.getByLabelText("Car registration");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toContain("registration-error");
    expect(screen.getByText(/We could not find a car/).closest("[aria-live]")).toHaveAttribute("aria-live", "polite");
  });

  it("finds a car manually with dependent dropdowns and posts the details", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <form data-testid="form">
        <RegLookup id="registration" label="Car registration" loadTree={async () => tree} />
      </form>,
    );
    await user.click(screen.getByRole("button", { name: "Manually find car" }));
    const dialog = await screen.findByRole("dialog", { name: "Find your car" });
    await user.click(within(dialog).getByRole("button", { name: "Use this car" }));
    await act(() => new Promise((r) => requestAnimationFrame(() => r(undefined))));
    expect(within(dialog).getByLabelText("Make")).toHaveFocus();
    await user.selectOptions(within(dialog).getByLabelText("Make"), "Ford");
    await user.selectOptions(within(dialog).getByLabelText("Model"), "Fiesta");
    await user.selectOptions(within(dialog).getByLabelText("Transmission"), "Manual");
    await user.selectOptions(within(dialog).getByLabelText("Year of manufacture"), "2015");
    await user.selectOptions(within(dialog).getByLabelText("Variant"), "1.1 Trend 5dr");
    await user.click(within(dialog).getByRole("button", { name: "Use this car" }));
    const data = new FormData(screen.getByTestId("form") as HTMLFormElement);
    expect(data.get("registration-make")).toBe("Ford");
    expect(data.get("registration-vehicle-year")).toBe("2015");
    expect(screen.getByRole("region", { name: "Your car" })).toHaveTextContent("1.1 Trend 5dr");
    expect(await axeViolations(container)).toEqual([]);
  });
});

describe("AddressLookup", () => {
  it("lists found addresses and switches to manual entry", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <AddressLookup id="homeAddress" label="What is your home address?" lookup={{ status: "found", postcode: "LS1 4AP", addresses: [{ id: "a1", label: "1 High Street, Leeds" }] }} />,
    );
    expect(screen.getByLabelText("Select your address")).toHaveDisplayValue("1 address found");
    expect(await axeViolations(container)).toEqual([]);
    await user.click(screen.getByRole("button", { name: "I cannot find my address in the list" }));
    await act(() => new Promise((r) => requestAnimationFrame(() => r(undefined))));
    expect(screen.getByLabelText("Address line 1")).toHaveFocus();
    expect(screen.getByLabelText("Postcode")).toHaveValue("LS1 4AP");
  });

  it("shows a saved address as text with a change option", () => {
    render(<AddressLookup id="homeAddress" label="Home address" value={{ postcode: "LS1 4AP", line1: "1 High Street", town: "Leeds", addressId: "a1", source: "lookup" }} />);
    expect(screen.getByTestId("address-resolved")).toHaveTextContent("1 High Street");
    expect(screen.getByRole("button", { name: "Change address" })).toBeInTheDocument();
  });
});

describe("AddAnotherList", () => {
  it("lists items with named change and remove buttons and announces removal", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    const { container } = render(
      <AddAnotherList
        id="drivers"
        label="Other drivers"
        items={[{ id: "d1", label: "Ann Taylor" }]}
        addLabel="Add another driver"
        maxItems={4}
        itemNoun="driver"
        onAdd={() => {}}
        onChange={() => {}}
        onRemove={onRemove}
      />,
    );
    expect(await axeViolations(container)).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Remove Ann Taylor" }));
    expect(onRemove).toHaveBeenCalledWith("d1");
    expect(screen.getByRole("status")).toHaveTextContent("Ann Taylor removed.");
    expect(screen.getByRole("heading", { name: "Other drivers" })).toHaveFocus();
  });

  it("replaces the add button when the maximum is reached", () => {
    render(
      <AddAnotherList id="drivers" label="Drivers" items={[{ id: "d1", label: "A" }]} addLabel="Add" maxItems={1} itemNoun="driver" onAdd={() => {}} onChange={() => {}} onRemove={() => {}} />,
    );
    expect(screen.queryByRole("button", { name: "Add" })).toBeNull();
    expect(screen.getByText("You can add up to 1 drivers.")).toBeInTheDocument();
  });
});
