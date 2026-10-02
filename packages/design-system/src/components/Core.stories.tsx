import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { Button } from "./Button";
import { CookieBanner, CookieSettings } from "./Cookies";
import { Dialog } from "./Dialog";
import { ErrorSummary } from "./ErrorSummary";
import { Checkboxes, DateInput, Radios, Select, TextInput } from "./fields";
import { BackLink, InsetText, Panel, SectionProgress } from "./layout";
import { SessionTimeout } from "./SessionTimeout";

const meta: Meta = { title: "Components/Core" };
export default meta;
type Story = StoryObj;

export const Buttons: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-6">
      <Button>Continue</Button>
      <Button variant="secondary">Find car</Button>
      <Button variant="link">Save and come back later</Button>
    </div>
  ),
};

export const TextInputs: Story = {
  render: () => (
    <div className="max-w-[40rem]">
      <TextInput id="name" label="First name" autoComplete="given-name" width={20} />
      <TextInput id="mileage" label="How many miles do you expect to drive in a year?" hint="An estimate is fine." suffix="miles" width={10} inputMode="numeric" />
      <TextInput id="value" label="How much is the car worth?" prefix="£" width={10} error="Enter how much the car is worth" />
    </div>
  ),
};

export const RadiosAndChoices: Story = {
  name: "Radios, checkboxes and select",
  render: () => (
    <div className="max-w-[40rem]">
      <Radios id="modified" label="Has the car been modified?" options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} inline />
      <Radios
        id="usage"
        label="What will you use the car for?"
        options={[
          { value: "sdp", label: "Social, domestic and pleasure", hint: "Personal journeys, but not commuting." },
          { value: "commuting", label: "Social and commuting" },
        ]}
        error="Select what you will use the car for"
      />
      <Checkboxes id="marketing" label="How would you like to hear about our insurance offers?" options={[{ value: "email", label: "Email" }, { value: "sms", label: "Text message" }]} />
      <Select id="title" label="Title" options={[{ value: "mr", label: "Mr" }, { value: "ms", label: "Ms" }]} />
    </div>
  ),
};

export const DateInputs: Story = {
  render: () => (
    <div className="max-w-[40rem]">
      <DateInput id="dob" label="What is your date of birth?" hint="For example, 27 3 1990" autocomplete="bday" />
      <DateInput id="licence" label="When did you get this licence?" precision="month" error="Date must include a year" errorParts={["year"]} />
    </div>
  ),
};

export const ErrorSummaryStory: Story = {
  name: "Error summary",
  render: () => (
    <>
      <ErrorSummary items={[{ targetId: "reg", message: "Enter your car registration" }]} />
      <TextInput id="reg" label="Car registration" error="Enter your car registration" />
    </>
  ),
};

export const Progress: Story = {
  render: () => (
    <>
      <BackLink href="#" />
      <SectionProgress
        items={[
          { id: "car", label: "Your car", status: "complete", href: "#" },
          { id: "you", label: "About you", status: "current" },
          { id: "drivers", label: "Drivers and household", status: "upcoming" },
          { id: "claims", label: "Claims and no claims", status: "upcoming" },
        ]}
      />
      <Panel title="Your quote has been saved">MQ-7KXP-3RTA</Panel>
      <InsetText>We’ll use the registration AB12CDE you entered.</InsetText>
    </>
  ),
};

export const DialogStory: Story = {
  name: "Dialog",
  render: () => (
    <Dialog open title="Conditions for an online quote" onClose={fn()}>
      <p className="mb-6">Native modal dialog: the page behind is inert, focus is trapped and Escape closes it.</p>
      <Button>I meet these conditions</Button>
    </Dialog>
  ),
};

export const SessionTimeoutStory: Story = {
  name: "Session timeout warning",
  render: () => <SessionTimeout remainingMs={115_000} onExtend={async () => 30 * 60_000} onExpire={fn()} onEnd={fn()} />,
};

export const Cookies: Story = {
  render: () => (
    <>
      <CookieBanner initialConsent={null} onDecision={fn()} onManage={fn()} />
      <div className="mt-8 max-w-[40rem]">
        <CookieSettings consent={null} onSave={fn()} />
      </div>
    </>
  ),
};
