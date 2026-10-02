import type { ReactNode } from "react";
import { cx } from "../utils";

export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="visually-hidden">{children}</span>;
}

/** First focusable element on the page (WCAG 2.4.1). Visible only when focused. */
export function SkipLink({ href = "#main-content", children = "Skip to main content" }: { href?: string; children?: ReactNode }) {
  return (
    <a href={href} className="qf-skip-link">
      {children}
    </a>
  );
}

export function Hint({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div id={id} className="mb-3 text-body-small text-ink-muted">
      {children}
    </div>
  );
}

/** Error text, prefixed for screen readers so the message is unambiguous out of visual context. */
export function ErrorMessage({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={id} className="mb-3 font-bold text-ink-error">
      <VisuallyHidden>Error: </VisuallyHidden>
      {children}
    </p>
  );
}

/** Wraps a question. The left bar marks the question in error without relying on colour alone. */
export function FormGroup({ error, children, className }: { error?: boolean; children: ReactNode; className?: string }) {
  return <div className={cx("mb-8", error && "border-l-4 border-line-error pl-4", className)}>{children}</div>;
}

type LegendSize = "s" | "m" | "l";
const legendSizes: Record<LegendSize, string> = {
  s: "text-body font-bold",
  m: "text-heading-m font-bold",
  l: "text-heading-l font-bold",
};

export function Legend({ children, size = "s", asPageHeading }: { children: ReactNode; size?: LegendSize; asPageHeading?: boolean }) {
  const className = cx("mb-3", legendSizes[size]);
  return <legend className={className}>{asPageHeading ? <h1 className="m-0 text-inherit">{children}</h1> : children}</legend>;
}

export function Label({ htmlFor, children, asPageHeading }: { htmlFor: string; children: ReactNode; asPageHeading?: boolean }) {
  const label = (
    <label htmlFor={htmlFor} className={cx("mb-1 block", asPageHeading ? "text-heading-l font-bold" : "font-bold")}>
      {children}
    </label>
  );
  return asPageHeading ? <h1 className="m-0">{label}</h1> : label;
}
