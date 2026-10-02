"use client";

import { addDays } from "@qf/journey-engine";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { cx } from "../utils";
import { Button } from "./Button";
import { Dialog } from "./Dialog";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = [
  ["Mo", "Monday"],
  ["Tu", "Tuesday"],
  ["We", "Wednesday"],
  ["Th", "Thursday"],
  ["Fr", "Friday"],
  ["Sa", "Saturday"],
  ["Su", "Sunday"],
] as const;

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const clamp = (date: string, min: string, max: string) => (date < min ? min : date > max ? max : date);
/** Monday = 0 … Sunday = 6. */
const weekday = (date: string) => (utc(date).getUTCDay() + 6) % 7;

function addMonths(date: string, months: number): string {
  const d = utc(date);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d.getUTCDate(), lastDay));
  return iso(target);
}

/** "Friday 2 October 2026", built by hand so it reads the same in every browser and ICU version. */
export const fullDateName = (date: string) => `${WEEKDAYS[weekday(date)]![1]} ${Number(date.slice(8))} ${MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`;

/** Weeks (Monday first) for a month, with null for days outside it. */
function monthWeeks(year: number, month: number): Array<Array<string | null>> {
  const first = iso(new Date(Date.UTC(year, month, 1)));
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: Array<string | null> = Array.from({ length: weekday(first) }, () => null);
  for (let d = 1; d <= days; d++) cells.push(iso(new Date(Date.UTC(year, month, d))));
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
}

export interface CalendarDialogProps {
  open: boolean;
  title: string;
  /** Earliest and latest choosable dates (ISO, inclusive). */
  min: string;
  max: string;
  /** Today (ISO), marked in the grid. */
  today: string;
  selected: string | null;
  onSelect: (date: string) => void;
  onClose: () => void;
  cancelLabel?: string;
}

/**
 * Date picker in a modal dialog (WAI-ARIA APG date picker dialog pattern). Shows only the
 * months the window covers; each month is a grid with one tab stop for all days (roving
 * tabindex). Arrow keys move by day/week, Home/End to the week's start/end, Page Up/Down by
 * month, Enter/Space chooses, Escape or Close/Cancel closes. Movement stays in the window.
 */
export function CalendarDialog({ open, title, min, max, today, selected, onSelect, onClose, cancelLabel = "Cancel" }: CalendarDialogProps) {
  const initial = selected && selected >= min && selected <= max ? selected : clamp(today, min, max);
  const [focused, setFocused] = useState(initial);
  const moved = useRef(false);
  const focusedRef = useRef<HTMLButtonElement | null>(null);
  const idBase = useId();

  // Each time it opens, start from the selected date (or today).
  useEffect(() => {
    if (open) {
      setFocused(initial);
      moved.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // After keyboard movement, move DOM focus to the newly focused day.
  useEffect(() => {
    if (moved.current) focusedRef.current?.focus();
  }, [focused]);

  const months = useMemo(() => {
    const list: Array<{ year: number; month: number }> = [];
    const start = utc(min);
    const end = utc(max);
    for (let y = start.getUTCFullYear(), m = start.getUTCMonth(); y < end.getUTCFullYear() || (y === end.getUTCFullYear() && m <= end.getUTCMonth()); ) {
      list.push({ year: y, month: m });
      m += 1;
      if (m === 12) {
        m = 0;
        y += 1;
      }
    }
    return list;
  }, [min, max]);

  const onKeyDown = (event: KeyboardEvent<HTMLTableElement>) => {
    const steps: Record<string, () => string> = {
      ArrowLeft: () => addDays(focused, -1),
      ArrowRight: () => addDays(focused, 1),
      ArrowUp: () => addDays(focused, -7),
      ArrowDown: () => addDays(focused, 7),
      Home: () => addDays(focused, -weekday(focused)),
      End: () => addDays(focused, 6 - weekday(focused)),
      PageUp: () => addMonths(focused, -1),
      PageDown: () => addMonths(focused, 1),
    };
    const step = steps[event.key];
    if (!step) return;
    event.preventDefault();
    moved.current = true;
    setFocused(clamp(step(), min, max));
  };

  return (
    <Dialog open={open} title={title} onClose={onClose} initialFocusRef={focusedRef} size="l">
      <div className="mb-6 flex flex-wrap items-start gap-x-8 gap-y-6">
        {months.map(({ year, month }) => {
          const captionId = `${idBase}-${year}-${month}`;
          return (
            // A table with role="grid" is the WAI-ARIA APG date picker pattern.
            // eslint-disable-next-line jsx-a11y/no-noninteractive-element-to-interactive-role
            <table key={captionId} role="grid" aria-labelledby={captionId} onKeyDown={onKeyDown} className="border-collapse">
              <caption id={captionId} className="mb-3 text-left text-heading-s font-bold">
                {MONTHS[month]} {year}
              </caption>
              <thead>
                <tr>
                  {WEEKDAYS.map(([short, long]) => (
                    <th key={short} scope="col" className="size-11 text-center text-body-small font-bold text-ink-muted">
                      <abbr title={long} className="no-underline">
                        {short}
                      </abbr>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthWeeks(year, month).map((week, w) => (
                  <tr key={w}>
                    {week.map((date, d) => {
                      if (!date) return <td key={d} className="p-0 sm:p-0.5" />;
                      const available = date >= min && date <= max;
                      const isToday = date === today;
                      const isSelected = date === selected;
                      const day = Number(date.slice(8));
                      const name = `${fullDateName(date)}${isToday ? ", today" : ""}`;
                      return (
                        <td key={d} role="gridcell" aria-selected={available ? isSelected : undefined} className="p-0 sm:p-0.5">
                          {available ? (
                            <button
                              ref={date === focused ? focusedRef : undefined}
                              type="button"
                              tabIndex={date === focused ? 0 : -1}
                              aria-label={name}
                              onClick={() => onSelect(date)}
                              onFocus={() => setFocused(date)}
                              className={cx(
                                "flex size-11 items-center justify-center rounded-small border-2 text-body focus-visible:focus-ring",
                                isSelected ? "border-brand bg-brand font-bold text-ink-inverse hover:bg-brand-hover" : "hover:bg-brand-subtle",
                                !isSelected && isToday ? "border-brand font-bold text-brand" : !isSelected && "border-transparent text-ink",
                              )}
                            >
                              {day}
                            </button>
                          ) : (
                            <span aria-disabled="true" className="flex size-11 items-center justify-center text-ink-muted opacity-60">
                              <span aria-hidden="true">{day}</span>
                              <span className="visually-hidden">{`${fullDateName(date)}, not available`}</span>
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          );
        })}
      </div>
      <p className="mb-6 text-body-small text-ink-muted">Use the arrow keys to move between dates, and Enter to choose one.</p>
      <Button variant="secondary" onClick={onClose}>
        {cancelLabel}
      </Button>
    </Dialog>
  );
}
