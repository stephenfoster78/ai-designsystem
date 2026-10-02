import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { cx, describedBy, errorId, hintId } from "../utils";
import { ErrorMessage, FormGroup, Hint, Label, Legend } from "./primitives";

const control =
  "min-h-[var(--qf-size-target-min)] rounded-none border-[length:var(--qf-border-width-control)] bg-surface px-2 text-body text-ink focus:focus-ring";
const controlBorder = (error?: boolean) => (error ? "border-line-error" : "border-line-strong");

export type InputWidth = 2 | 4 | 5 | 10 | 20 | 30 | "full";
const widths: Record<string, string> = {
  "2": "w-[5ch]",
  "4": "w-[7ch]",
  "5": "w-[8ch]",
  "10": "w-[14ch]",
  "20": "w-[25ch]",
  "30": "w-[35ch]",
  full: "w-full",
};

interface QuestionProps {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** Render the label/legend as the page's h1 (one-question pages). */
  asPageHeading?: boolean;
}

// ---------------------------------------------------------------------------

export interface TextInputProps extends QuestionProps, Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "prefix" | "width"> {
  width?: InputWidth;
  prefix?: string;
  suffix?: string;
}

export function TextInput({ id, name, label, hint, error, asPageHeading, width = "full", prefix, suffix, className, ...input }: TextInputProps) {
  const affixClass = "flex min-h-[var(--qf-size-target-min)] items-center border-[length:var(--qf-border-width-control)] border-line-strong bg-surface-muted px-3 font-bold";
  return (
    <FormGroup error={Boolean(error)}>
      <Label htmlFor={id} asPageHeading={asPageHeading}>
        {label}
      </Label>
      {hint && <Hint id={hintId(id)}>{hint}</Hint>}
      {error && <ErrorMessage id={errorId(id)}>{error}</ErrorMessage>}
      <div className="flex max-w-full items-stretch">
        {prefix && (
          <span className={cx(affixClass, "border-r-0")} aria-hidden="true">
            {prefix}
          </span>
        )}
        <input
          id={id}
          name={name ?? id}
          className={cx(control, controlBorder(Boolean(error)), widths[String(width)], "max-w-full", className)}
          aria-describedby={describedBy(hint && hintId(id), error && errorId(id))}
          aria-invalid={error ? true : undefined}
          {...input}
        />
        {suffix && (
          <span className={cx(affixClass, "border-l-0")} aria-hidden="true">
            {suffix}
          </span>
        )}
      </div>
    </FormGroup>
  );
}

// ---------------------------------------------------------------------------

export interface ChoiceOption {
  value: string;
  label: ReactNode;
  hint?: ReactNode;
}

export interface RadiosProps extends QuestionProps {
  name?: string;
  options: ChoiceOption[];
  value?: string | null;
  inline?: boolean;
  required?: boolean;
}

/** One question with mutually exclusive answers, grouped in a fieldset (WCAG 1.3.1). */
export function Radios({ id, name = id, label, hint, error, asPageHeading, options, value, inline, required }: RadiosProps) {
  return (
    <FormGroup error={Boolean(error)}>
      <fieldset aria-describedby={describedBy(hint && hintId(id), error && errorId(id))}>
        <Legend size={asPageHeading ? "l" : "s"} asPageHeading={asPageHeading}>
          {label}
        </Legend>
        {hint && <Hint id={hintId(id)}>{hint}</Hint>}
        {error && <ErrorMessage id={errorId(id)}>{error}</ErrorMessage>}
        <div className={cx("flex", inline ? "flex-row flex-wrap gap-x-6" : "flex-col gap-2")}>
          {options.map((option, index) => {
            // First option carries the question id so error summary links land on it.
            const optionId = index === 0 ? id : `${id}-${option.value}`;
            return (
              <div key={option.value} className="flex items-start gap-3">
                <input
                  type="radio"
                  id={optionId}
                  name={name}
                  value={option.value}
                  defaultChecked={value === option.value}
                  required={required}
                  aria-describedby={option.hint ? hintId(optionId) : undefined}
                  className="mt-2.5 size-6 shrink-0 accent-brand focus-visible:focus-ring"
                />
                <div>
                  <label htmlFor={optionId} className="block min-h-[var(--qf-size-target-min)] cursor-pointer py-2">
                    {option.label}
                  </label>
                  {option.hint && (
                    <div id={hintId(optionId)} className="-mt-2 pb-2 text-body-small text-ink-muted">
                      {option.hint}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </fieldset>
    </FormGroup>
  );
}

// ---------------------------------------------------------------------------

export interface CheckboxProps extends QuestionProps {
  name?: string;
  checked?: boolean;
}

/** A single yes/no checkbox (e.g. a declaration). Posts "true" when ticked. */
export function Checkbox({ id, name = id, label, hint, error, checked }: CheckboxProps) {
  return (
    <FormGroup error={Boolean(error)}>
      {error && <ErrorMessage id={errorId(id)}>{error}</ErrorMessage>}
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id={id}
          name={name}
          value="true"
          defaultChecked={checked}
          aria-describedby={describedBy(hint && hintId(id), error && errorId(id))}
          aria-invalid={error ? true : undefined}
          className="mt-2.5 size-6 shrink-0 accent-brand focus-visible:focus-ring"
        />
        <div>
          <label htmlFor={id} className="block min-h-[var(--qf-size-target-min)] cursor-pointer py-2">
            {label}
          </label>
          {hint && <Hint id={hintId(id)}>{hint}</Hint>}
        </div>
      </div>
    </FormGroup>
  );
}

export interface CheckboxesProps extends QuestionProps {
  name?: string;
  options: ChoiceOption[];
  value?: string[] | null;
}

export function Checkboxes({ id, name = id, label, hint, error, asPageHeading, options, value }: CheckboxesProps) {
  const selected = new Set(value ?? []);
  return (
    <FormGroup error={Boolean(error)}>
      <fieldset aria-describedby={describedBy(hint && hintId(id), error && errorId(id))}>
        <Legend size={asPageHeading ? "l" : "s"} asPageHeading={asPageHeading}>
          {label}
        </Legend>
        {hint && <Hint id={hintId(id)}>{hint}</Hint>}
        {error && <ErrorMessage id={errorId(id)}>{error}</ErrorMessage>}
        <div className="flex flex-col gap-2">
          {options.map((option, index) => {
            const optionId = index === 0 ? id : `${id}-${option.value}`;
            return (
              <div key={option.value} className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id={optionId}
                  name={name}
                  value={option.value}
                  defaultChecked={selected.has(option.value)}
                  className="mt-2.5 size-6 shrink-0 accent-brand focus-visible:focus-ring"
                />
                <label htmlFor={optionId} className="block min-h-[var(--qf-size-target-min)] cursor-pointer py-2">
                  {option.label}
                </label>
              </div>
            );
          })}
        </div>
      </fieldset>
    </FormGroup>
  );
}

// ---------------------------------------------------------------------------

export interface SelectProps extends QuestionProps, Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> {
  options: ChoiceOption[];
  placeholder?: string;
}

export function Select({ id, name, label, hint, error, asPageHeading, options, placeholder = "Select an option", defaultValue, ...select }: SelectProps) {
  return (
    <FormGroup error={Boolean(error)}>
      <Label htmlFor={id} asPageHeading={asPageHeading}>
        {label}
      </Label>
      {hint && <Hint id={hintId(id)}>{hint}</Hint>}
      {error && <ErrorMessage id={errorId(id)}>{error}</ErrorMessage>}
      <select
        id={id}
        name={name ?? id}
        defaultValue={defaultValue ?? ""}
        className={cx(control, controlBorder(Boolean(error)), "max-w-full pr-8")}
        aria-describedby={describedBy(hint && hintId(id), error && errorId(id))}
        aria-invalid={error ? true : undefined}
        {...select}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FormGroup>
  );
}

// ---------------------------------------------------------------------------

export interface DateInputProps extends QuestionProps {
  value?: { day: string; month: string; year: string };
  /** Parts to highlight; defaults to all parts when there is an error. */
  errorParts?: Array<"day" | "month" | "year">;
  /** "bday" adds birthday autocomplete tokens (WCAG 1.3.5). */
  autocomplete?: "bday";
}

/** Memorable-date input: three labelled boxes in a fieldset, numeric keypad on mobile. */
export function DateInput({ id, label, hint, error, asPageHeading, value, errorParts, autocomplete }: DateInputProps) {
  const highlighted = new Set(error ? (errorParts?.length ? errorParts : ["day", "month", "year"]) : []);
  const parts = [
    { key: "day" as const, label: "Day", width: "w-[5ch]" },
    { key: "month" as const, label: "Month", width: "w-[5ch]" },
    { key: "year" as const, label: "Year", width: "w-[8ch]" },
  ];
  // Focus target for the error summary: the first part in error.
  const firstPart = parts.find((p) => highlighted.has(p.key))?.key ?? "day";
  return (
    <FormGroup error={Boolean(error)}>
      <fieldset role="group" aria-describedby={describedBy(hint && hintId(id), error && errorId(id))}>
        <Legend size={asPageHeading ? "l" : "s"} asPageHeading={asPageHeading}>
          {label}
        </Legend>
        {hint && <Hint id={hintId(id)}>{hint}</Hint>}
        {error && <ErrorMessage id={errorId(id)}>{error}</ErrorMessage>}
        <div className="flex gap-4" id={id}>
          {parts.map((part) => {
            const partId = part.key === firstPart ? `${id}-input` : `${id}-${part.key}`;
            return (
              <div key={part.key}>
                <label htmlFor={partId} className="mb-1 block">
                  {part.label}
                </label>
                <input
                  id={partId}
                  name={`${id}-${part.key}`}
                  inputMode="numeric"
                  autoComplete={autocomplete ? `bday-${part.key}` : "off"}
                  defaultValue={value?.[part.key] ?? ""}
                  aria-invalid={highlighted.has(part.key) ? true : undefined}
                  className={cx(control, controlBorder(highlighted.has(part.key)), part.width)}
                />
              </div>
            );
          })}
        </div>
      </fieldset>
    </FormGroup>
  );
}

/** Element id the error summary should link to for a date input. */
export const dateInputTargetId = (id: string) => `${id}-input`;
