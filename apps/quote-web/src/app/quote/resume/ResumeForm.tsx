"use client";

import { useActionState } from "react";
import { Button, DateInput, ErrorSummary, TextInput } from "@qf/design-system";
import { resumeQuote, type ResumeState } from "../actions";

export function ResumeForm() {
  const [state, action, pending] = useActionState<ResumeState, FormData>(resumeQuote, { errors: [] });
  const errorFor = (id: string) => state.errors.find((e) => e.targetId === id)?.message;
  const v = state.values;

  return (
    <>
      <ErrorSummary items={state.errors} />
      <form action={action} noValidate key={JSON.stringify(state)}>
        <TextInput
          id="reference"
          label="Quote reference"
          hint="For example, MQ-7KXP-3RTA. You’ll find it in the email we sent you or on the page where you saved your quote."
          error={errorFor("reference")}
          defaultValue={v?.reference}
          width={20}
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="characters"
        />
        <DateInput
          id="resumeDob"
          label="What is your date of birth?"
          hint="For example, 27 3 1990"
          error={errorFor("resumeDob-input")}
          value={{ day: v?.day ?? "", month: v?.month ?? "", year: v?.year ?? "" }}
          autocomplete="bday"
        />
        <details className="mb-8" open={Boolean(v?.reg)}>
          <summary className="cursor-pointer text-link underline">I saved my quote before giving my date of birth</summary>
          <div className="mt-4 border-l-4 border-line-strong pl-4">
            <TextInput
              id="resumeReg"
              label="Car registration"
              hint="The registration you entered at the start of your quote."
              defaultValue={v?.reg}
              width={10}
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="characters"
            />
          </div>
        </details>
        <Button type="submit" disabled={pending}>
          Continue your quote
        </Button>
      </form>
    </>
  );
}
