"use client";

import { addDays, isIsoDate, isoToUk, parseUkDate } from "@qf/journey-engine";
import { useEffect, useRef, useState } from "react";
import { useTrack } from "../analytics";
import { cx, errorId, hintId } from "../utils";
import { Button } from "./Button";
import { CalendarDialog, fullDateName } from "./CalendarDialog";
import { ErrorMessage, FormGroup, Hint, Legend } from "./primitives";

export type StartDateChoice = "today" | "tomorrow" | "other";

const defaultText = {
  today: "Today",
  tomorrow: "Tomorrow",
  other: "Another date",
  dateLabel: "Date",
  dateHint: "For example, {example}. It must be on or before {latest}.",
  calendarButton: "Choose a date from the calendar",
  calendarTitle: "Choose a start date",
  cancel: "Cancel",
};

export interface StartDateInputProps {
  id: string;
  /** The question (legend). */
  label: string;
  /** Hint under the question. {latest} is replaced with the last allowed date. */
  hint?: string;
  error?: string;
  /** Which control the error belongs to. */
  errorTarget?: "choice" | "date";
  /** Today's date from the server (ISO, UK time). The device clock is never used. */
  today: string;
  /** Last allowed date is today + this many days (inclusive). */
  maxDaysAhead?: number;
  /** Saved answer (ISO). */
  value?: string | null;
  /** What was submitted, redisplayed after a failed submit. */
  raw?: { choice?: string; date?: string };
  asPageHeading?: boolean;
  text?: Partial<typeof defaultText>;
}

const longDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
/** "Friday 2 October" */
const dayMonth = (iso: string) => fullDateName(iso).replace(/ \d{4}$/, "");
const asDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m);

/**
 * Start date in a short future window: Today / Tomorrow radios with their dates, or Another
 * date with a forgiving DD/MM/YYYY input and an optional calendar in a modal dialog.
 *
 * Posts `{id}-choice` and `{id}` as plain form fields, so it works without JavaScript; the
 * server turns the choice into an ISO date and validates it. Without JavaScript the date
 * input is always visible and the calendar button is not offered.
 */
export function StartDateInput({ id, label, hint, error, errorTarget = "choice", today, maxDaysAhead = 30, value, raw, asPageHeading, text: overrides }: StartDateInputProps) {
  const text = { ...defaultText, ...overrides };
  const tomorrow = addDays(today, 1);
  const latest = addDays(today, maxDaysAhead);
  const savedChoice: StartDateChoice | undefined = value === today ? "today" : value === tomorrow ? "tomorrow" : isIsoDate(value) ? "other" : undefined;
  const [choice, setChoice] = useState<string | undefined>(raw?.choice ?? savedChoice);
  const [dateText, setDateText] = useState(raw?.date ?? (savedChoice === "other" && value ? isoToUk(value) : ""));
  const [hydrated, setHydrated] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const calendarButtonRef = useRef<HTMLButtonElement>(null);
  const focusTracked = useRef(false);
  const track = useTrack();

  useEffect(() => setHydrated(true), []);

  const parsed = parseUkDate(dateText);
  const typedIso = parsed.ok ? parsed.value : null;
  // An in-window example with a day above 12, so day and month cannot be confused.
  const example = isoToUk(Array.from({ length: maxDaysAhead }, (_, i) => addDays(today, i + 1)).find((d) => Number(d.slice(8)) > 12) ?? tomorrow);
  const values = { latest: longDate.format(asDate(latest)), example };
  const choiceError = errorTarget === "choice" ? error : undefined;
  const dateError = errorTarget === "date" ? error : undefined;
  const showDate = !hydrated || choice === "other";

  const options: Array<{ value: StartDateChoice; label: string }> = [
    { value: "today", label: `${text.today} (${dayMonth(today)})` },
    { value: "tomorrow", label: `${text.tomorrow} (${dayMonth(tomorrow)})` },
    { value: "other", label: text.other },
  ];

  const choose = (next: StartDateChoice) => {
    setChoice(next);
    if (next !== "other") track({ action: "valueSelected", field: id, inputMethod: "quickSelect" });
  };

  const closeCalendar = (selected: boolean) => {
    setCalendarOpen(false);
    track({ action: "calendarClosed", field: id, selected });
  };

  return (
    <FormGroup error={Boolean(error)}>
      {/* onFocus only records first interaction for analytics; it changes nothing for the user. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <fieldset
        aria-describedby={[hint && hintId(id), choiceError && errorId(id)].filter(Boolean).join(" ") || undefined}
        onFocus={() => {
          if (focusTracked.current) return;
          focusTracked.current = true;
          track({ action: "fieldFocus", field: id });
        }}
      >
        <Legend size={asPageHeading ? "l" : "s"} asPageHeading={asPageHeading}>
          {label}
        </Legend>
        {hint && <Hint id={hintId(id)}>{fill(hint, values)}</Hint>}
        {choiceError && <ErrorMessage id={errorId(id)}>{choiceError}</ErrorMessage>}
        <div className="flex flex-col gap-2">
          {options.map((option, index) => {
            const optionId = index === 0 ? `${id}-choice` : `${id}-choice-${option.value}`;
            return (
              <div key={option.value}>
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    id={optionId}
                    name={`${id}-choice`}
                    value={option.value}
                    checked={choice === option.value}
                    onChange={() => choose(option.value)}
                    aria-controls={option.value === "other" ? `${id}-other` : undefined}
                    className="mt-2.5 size-6 shrink-0 accent-brand focus-visible:focus-ring"
                  />
                  <label htmlFor={optionId} className="block min-h-[var(--qf-size-target-min)] cursor-pointer py-2">
                    {option.label}
                  </label>
                </div>
                {option.value === "other" && (
                  <div id={`${id}-other`} hidden={!showDate} className={cx("mt-2 ml-3 border-l-4 pl-6", dateError ? "border-line-error" : "border-line-strong")}>
                    <label htmlFor={id} className="mb-1 block font-bold">
                      {text.dateLabel}
                    </label>
                    <Hint id={hintId(`${id}-date`)}>{fill(text.dateHint, values)}</Hint>
                    {dateError && <ErrorMessage id={errorId(`${id}-date`)}>{dateError}</ErrorMessage>}
                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        ref={inputRef}
                        id={id}
                        name={id}
                        value={dateText}
                        onChange={(e) => setDateText(e.target.value)}
                        onBlur={() => {
                          // Analytics only: no validation or messages on blur.
                          if (typedIso) track({ action: "valueSelected", field: id, inputMethod: "textInput" });
                        }}
                        autoComplete="off"
                        spellCheck={false}
                        maxLength={10}
                        aria-describedby={[hintId(`${id}-date`), dateError && errorId(`${id}-date`)].filter(Boolean).join(" ")}
                        aria-invalid={dateError ? true : undefined}
                        className={cx(
                          "min-h-[var(--qf-size-target-min)] w-[13ch] rounded-none border-[length:var(--qf-border-width-control)] bg-surface px-2 text-body text-ink focus:focus-ring",
                          dateError ? "border-line-error" : "border-line-strong",
                        )}
                      />
                      {hydrated && (
                        <Button
                          ref={calendarButtonRef}
                          variant="secondary"
                          aria-haspopup="dialog"
                          onClick={() => {
                            setCalendarOpen(true);
                            track({ action: "calendarOpened", field: id });
                          }}
                        >
                          <svg aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" />
                            <path d="M16 2v4M8 2v4M3 10h18" />
                          </svg>
                          {text.calendarButton}
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </fieldset>
      {hydrated && (
        <CalendarDialog
          open={calendarOpen}
          title={text.calendarTitle}
          min={today}
          max={latest}
          today={today}
          selected={typedIso}
          cancelLabel={text.cancel}
          onClose={() => closeCalendar(false)}
          onSelect={(date) => {
            setDateText(isoToUk(date));
            setChoice("other");
            closeCalendar(true);
            track({ action: "valueSelected", field: id, inputMethod: "calendarPicker" });
            // The dialog restores focus to the button; then move it to the filled input.
            requestAnimationFrame(() => inputRef.current?.focus());
          }}
        />
      )}
    </FormGroup>
  );
}
