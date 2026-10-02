import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { useState } from "react";
import { AddAnotherList } from "./AddAnotherList";
import { AddressLookup } from "./AddressLookup";
import { RegLookup, type LookupVehicleTree } from "./RegLookup";
import { Typeahead } from "./Typeahead";

const meta: Meta = { title: "Components/Lookups and lists" };
export default meta;
type Story = StoryObj;

const tree: LookupVehicleTree = {
  Ford: { Fiesta: { Manual: { "2015": ["1.1 Trend 5dr", "1.25 Zetec 5dr"] } } },
  Toyota: { Yaris: { Automatic: { "2018": ["1.5 Hybrid Icon 5dr CVT"] } } },
};
const loadTree = async () => tree;
const fiesta = { reg: "AB12CDE", make: "Ford", model: "Fiesta", year: 2012, transmission: "Manual", variant: "1.25 Zetec 5dr", source: "lookup" as const };

export const RegLookupDefault: Story = {
  name: "Reg lookup: default",
  render: () => (
    <form className="max-w-[40rem]" onSubmit={(e) => e.preventDefault()}>
      <RegLookup id="registration" label="Car registration" hint="For example, AB12 CDE." loadTree={loadTree} />
    </form>
  ),
};

export const RegLookupResult: Story = {
  name: "Reg lookup: results",
  render: () => (
    <form className="max-w-[40rem]" onSubmit={(e) => e.preventDefault()}>
      <RegLookup id="registration" label="Car registration" lookup={{ status: "found", vehicle: fiesta }} loadTree={loadTree} />
    </form>
  ),
};

export const RegLookupError: Story = {
  name: "Reg lookup: not found",
  render: () => (
    <form className="max-w-[40rem]" onSubmit={(e) => e.preventDefault()}>
      <RegLookup
        id="registration"
        label="Car registration"
        value={{ reg: "ZZ99ZZZ" }}
        lookup={{ status: "notFound", message: "We could not find a car with that registration. Check it, or find your car manually" }}
        loadTree={loadTree}
      />
    </form>
  ),
};

export const AddressLookupStates: Story = {
  name: "Address lookup",
  render: () => (
    <div className="flex max-w-[40rem] flex-col gap-8">
      <AddressLookup id="a1" label="What is your home address?" />
      <AddressLookup id="a2" label="What is your home address?" lookup={{ status: "found", postcode: "LS1 4AP", addresses: [{ id: "1", label: "1 High Street, Leeds" }, { id: "2", label: "3 High Street, Leeds" }] }} />
      <AddressLookup id="a3" label="What is your home address?" value={{ postcode: "LS1 4AP", line1: "1 High Street", town: "Leeds", source: "lookup", addressId: "1" }} />
    </div>
  ),
};

export const TypeaheadStory: Story = {
  name: "Typeahead",
  render: () => (
    <div className="max-w-[40rem]">
      <Typeahead
        id="occupation"
        label="What is your job title?"
        hint="Start typing, then choose from the list. For example, nurse."
        options={["Nurse", "Dental nurse", "Engineer", "Electrician", "Teacher", "Teaching assistant"].map((label, i) => ({ value: String(i), label }))}
      />
    </div>
  ),
};

export const AddAnother: Story = {
  name: "Add another list",
  render: function Render() {
    const [items, setItems] = useState([
      { id: "d1", label: "Ann Taylor" },
      { id: "d2", label: "Joe Taylor" },
    ]);
    return (
      <AddAnotherList
        id="drivers"
        label="Drivers you’ve added"
        items={items}
        addLabel="Add another driver"
        maxItems={4}
        itemNoun="driver"
        onAdd={fn()}
        onChange={fn()}
        onRemove={(id) => setItems((list) => list.filter((i) => i.id !== id))}
      />
    );
  },
};
