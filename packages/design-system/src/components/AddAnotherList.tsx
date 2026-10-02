"use client";

import { useRef, useState, type ReactNode } from "react";
import { errorId } from "../utils";
import { Button } from "./Button";
import { ErrorMessage, FormGroup } from "./primitives";

export interface AddAnotherItem {
  id: string;
  /** Short description, e.g. "Ann Taylor" or "Accident, 4 March 2024". */
  label: string;
  /** Extra line under the label, e.g. "Needs more details". */
  status?: string;
}

export interface AddAnotherListProps {
  /** Id of the question; the Add button carries it so error summary links land on it. */
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  items: AddAnotherItem[];
  addLabel: string;
  emptyText?: string;
  maxItems: number;
  maxReachedText?: string;
  onAdd: () => void;
  onChange: (id: string) => void;
  onRemove: (id: string) => void | Promise<void>;
  /** Noun for screen reader announcements and hidden button text, e.g. "driver". */
  itemNoun: string;
}

/**
 * "Add another" list: a summary of items with change and remove actions, and an add button
 * that opens the item's modal journey. Removals are announced, and focus moves to a stable
 * place so keyboard users are not dropped at the top of the page.
 */
export function AddAnotherList({ id, label, hint, error, items, addLabel, emptyText, maxItems, maxReachedText, onAdd, onChange, onRemove, itemNoun }: AddAnotherListProps) {
  const [announcement, setAnnouncement] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const full = items.length >= maxItems;

  const remove = async (item: AddAnotherItem) => {
    await onRemove(item.id);
    setAnnouncement(`${item.label} removed.`);
    headingRef.current?.focus();
  };

  return (
    <FormGroup error={Boolean(error)}>
      <h2 ref={headingRef} tabIndex={-1} className="mb-2 text-heading-s font-bold focus:outline-none">
        {label}
      </h2>
      {hint && <p className="mb-3 text-body-small text-ink-muted">{hint}</p>}
      {error && <ErrorMessage id={errorId(id)}>{error}</ErrorMessage>}
      <p className="visually-hidden" role="status">
        {announcement}
      </p>
      {items.length > 0 ? (
        <ul className="mb-6 border-t border-line" data-testid={`${id}-list`}>
          {items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-line py-3">
              <span className="flex-1 font-bold">
                {item.label}
                {item.status && <span className="block font-normal text-ink-error">{item.status}</span>}
              </span>
              <Button variant="link" onClick={() => onChange(item.id)}>
                Change <span className="visually-hidden">{item.label}</span>
              </Button>
              <Button variant="link" onClick={() => remove(item)}>
                Remove <span className="visually-hidden">{item.label}</span>
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        emptyText && <p className="mb-4 text-ink-muted">{emptyText}</p>
      )}
      {full ? (
        <p className="font-bold">{maxReachedText ?? `You can add up to ${maxItems} ${itemNoun}s.`}</p>
      ) : (
        <Button id={id} variant="secondary" onClick={onAdd} aria-describedby={error ? errorId(id) : undefined}>
          {addLabel}
        </Button>
      )}
    </FormGroup>
  );
}
