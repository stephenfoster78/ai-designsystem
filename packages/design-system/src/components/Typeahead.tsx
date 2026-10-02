"use client";

import { ComboBox, ComboBoxStateContext, Input, Label, ListBox, ListBoxItem, Popover, Text, useFilter } from "react-aria-components";
import { useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { cx } from "../utils";
import { useDialogContainer } from "./Dialog";
import { FormGroup, VisuallyHidden } from "./primitives";

export interface TypeaheadOption {
  value: string;
  label: string;
}

export interface TypeaheadProps {
  id: string;
  name?: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  options: TypeaheadOption[];
  /** Text shown initially (the saved option's label, or what was typed). */
  defaultInputValue?: string;
  width?: "m" | "l" | "full";
}

const widths = { m: "w-[25ch]", l: "w-[35ch]", full: "w-full" };

/**
 * Safety net: if text arrives in one go (paste, autofill, voice dictation) and React Aria has not
 * opened the list once the update settles, open it. Reads the latest state through a ref, so a
 * re-render between the input event and the check cannot leave it acting on stale state.
 */
function EnsureOpenOnInput({ inputId }: { inputId: string }) {
  const state = useContext(ComboBoxStateContext);
  const latest = useRef(state);
  latest.current = state;
  useEffect(() => {
    const input = document.getElementById(inputId);
    if (!input) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onInput = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const current = latest.current;
        const text = (input as HTMLInputElement).value.trim();
        // Do not reopen if an option was chosen meanwhile (its text is now the input's value).
        const justChosen = current?.selectedItem?.textValue === (input as HTMLInputElement).value;
        if (current && !current.isOpen && !justChosen && document.activeElement === input && text) current.open(null, "input");
      }, 50);
    };
    input.addEventListener("input", onInput);
    return () => {
      clearTimeout(timer);
      input.removeEventListener("input", onInput);
    };
  }, [inputId]);
  return null;
}

/**
 * Typeahead built on React Aria's ComboBox (ARIA 1.2 combobox pattern, tested with major screen
 * readers). React Aria filters the options itself, so the list opens however the text arrives:
 * typing, pasting, autofill or voice dictation.
 *
 * The visible text is submitted, so it also works without JavaScript: the server matches the
 * text to an option and asks the user to choose from the list when there is no match.
 */
export function Typeahead({ id, name = id, label, hint, error, options, defaultInputValue = "", width = "l" }: TypeaheadProps) {
  const { contains } = useFilter({ sensitivity: "base" });
  const container = useDialogContainer();
  const sorted = useMemo(() => [...options].sort((a, b) => a.label.localeCompare(b.label, "en-GB")), [options]);

  return (
    <FormGroup error={Boolean(error)}>
      <ComboBox
        name={name}
        allowsCustomValue
        menuTrigger="input"
        defaultInputValue={defaultInputValue}
        defaultItems={sorted}
        defaultFilter={contains}
        isInvalid={Boolean(error)}
        id={`${id}-combobox`}
        className="relative"
      >
        {/* React Aria wires the label, hint and error to the input (aria-labelledby/-describedby). */}
        <Label className="mb-1 block font-bold">{label}</Label>
        {hint && (
          <Text slot="description" className="mb-3 block text-body-small text-ink-muted">
            {hint}
          </Text>
        )}
        {error && (
          <Text slot="errorMessage" className="mb-3 block font-bold text-ink-error">
            <VisuallyHidden>Error: </VisuallyHidden>
            {error}
          </Text>
        )}
        <Input
          id={id}
          // Keep room below the input for the list, rather than flipping it over the question.
          onFocus={(e) => {
            if (e.currentTarget.getBoundingClientRect().bottom > window.innerHeight * 0.55) e.currentTarget.scrollIntoView({ block: "center" });
          }}
          autoComplete="off"
          spellCheck={false}
          className={cx(
            "min-h-[var(--qf-size-target-min)] max-w-full rounded-none border-[length:var(--qf-border-width-control)] bg-surface px-2 text-body text-ink focus:focus-ring",
            error ? "border-line-error" : "border-line-strong",
            widths[width],
          )}
        />
        <EnsureOpenOnInput inputId={id} />
        <Popover
          // Inside a modal <dialog>, render the list inside it: everything outside is inert.
          UNSTABLE_portalContainer={container ?? undefined}
          offset={4}
          placement="bottom start"
          shouldFlip={false}
          className="max-h-72 w-[var(--trigger-width)] overflow-y-auto border-2 border-line-strong bg-surface shadow-md"
        >
          <ListBox<TypeaheadOption> className="outline-none">
            {(item) => (
              <ListBoxItem
                id={item.value}
                textValue={item.label}
                className="cursor-pointer border-b border-line px-3 py-2 outline-none last:border-b-0 data-[focused]:bg-brand data-[focused]:text-ink-inverse"
              >
                {item.label}
              </ListBoxItem>
            )}
          </ListBox>
        </Popover>
      </ComboBox>
    </FormGroup>
  );
}
