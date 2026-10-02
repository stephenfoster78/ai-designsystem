"use client";

import { useEffect, useRef, type MouseEvent } from "react";

export interface ErrorSummaryItem {
  /** Id of the element to focus, e.g. the input or the first radio. */
  targetId: string;
  message: string;
}

/**
 * Lists every error at the top of the form and takes focus when it appears, so keyboard
 * and screen reader users learn about errors immediately (WCAG 3.3.1). Each link moves
 * focus to the field and scrolls its question into view.
 */
export function ErrorSummary({ items, title = "There is a problem" }: { items: ErrorSummaryItem[]; title?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const signature = items.map((i) => i.targetId + i.message).join("|");

  useEffect(() => {
    if (items.length) ref.current?.focus();
    // Refocus when the set of errors changes (each failed submit).
  }, [signature, items.length]);

  if (!items.length) return null;

  const onClick = (event: MouseEvent<HTMLAnchorElement>, targetId: string) => {
    const target = document.getElementById(targetId);
    if (!target) return;
    event.preventDefault();
    // Scroll the whole question (legend or label) into view, not just the control.
    const question = target.closest("fieldset") ?? document.querySelector(`label[for="${targetId}"]`) ?? target;
    question.scrollIntoView();
    target.focus({ preventScroll: true });
  };

  return (
    <div
      ref={ref}
      tabIndex={-1}
      aria-labelledby="error-summary-title"
      className="mb-8 border-4 border-line-error p-4 focus:focus-ring sm:p-6"
      data-testid="error-summary"
    >
      <h2 id="error-summary-title" className="mb-4 text-heading-m font-bold">
        {title}
      </h2>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.targetId}>
            <a href={`#${item.targetId}`} onClick={(e) => onClick(e, item.targetId)} className="font-bold text-ink-error! visited:text-ink-error">
              {item.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
