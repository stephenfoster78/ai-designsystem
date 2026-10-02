import type { AnchorHTMLAttributes, ReactNode } from "react";
import { cx } from "../utils";

export interface ProgressItem {
  id: string;
  label: string;
  status: "complete" | "current" | "upcoming";
  /** Link for completed sections so users can go back and change answers. */
  href?: string;
}

/**
 * Section progress. Status is conveyed in text, not only by colour or icon (WCAG 1.4.1).
 * Small screens get a one-line summary; wider screens get the full list.
 */
export function SectionProgress({ items, label = "Quote progress", renderLink }: {
  items: ProgressItem[];
  label?: string;
  /** Lets the app supply its router link component. */
  renderLink?: (props: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => ReactNode;
}) {
  const currentIndex = items.findIndex((i) => i.status === "current");
  const current = items[currentIndex];
  const link = renderLink ?? (({ children, ...rest }) => <a {...rest}>{children}</a>);

  return (
    <nav aria-label={label} className="mb-8">
      {current && (
        <p className="text-body-small font-bold md:hidden">
          Section {currentIndex + 1} of {items.length}: {current.label}
        </p>
      )}
      <ol className="hidden gap-1 md:flex">
        {items.map((item, index) => (
          <li
            key={item.id}
            aria-current={item.status === "current" ? "step" : undefined}
            className={cx(
              "flex-1 border-t-4 pt-2 text-body-small",
              item.status === "current" && "border-brand font-bold",
              item.status === "complete" && "border-ink-success",
              item.status === "upcoming" && "border-line text-ink-muted",
            )}
          >
            <span className="visually-hidden">
              {`Section ${index + 1}: `}
            </span>
            {item.status === "complete" && item.href ? link({ href: item.href, children: item.label }) : item.label}
            <span className="visually-hidden">
              {item.status === "complete" ? " (completed)" : item.status === "current" ? " (current section)" : " (not started)"}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function BackLink({ href, children = "Back", renderLink }: { href: string; children?: ReactNode; renderLink?: (props: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => ReactNode }) {
  const className = "mb-6 inline-flex items-center gap-2 text-body-small text-ink! visited:text-ink";
  const content = (
    <>
      <span aria-hidden="true">‹</span>
      {children}
    </>
  );
  return renderLink ? renderLink({ href, className, children: content }) : (
    <a href={href} className={className}>
      {content}
    </a>
  );
}

/** Highlighted outcome panel, e.g. for a saved quote reference. */
export function Panel({ title, children, tone = "brand" }: { title: ReactNode; children?: ReactNode; tone?: "brand" | "success" }) {
  return (
    <div className={cx("mb-8 p-6 text-center sm:p-8", tone === "brand" ? "bg-brand text-ink-inverse" : "bg-ink-success text-ink-inverse")}>
      <h1 className="mb-4 text-heading-l font-bold">{title}</h1>
      {children && <div className="text-heading-s">{children}</div>}
    </div>
  );
}

export function InsetText({ children }: { children: ReactNode }) {
  return <div className="mb-8 border-l-4 border-line-strong pl-4">{children}</div>;
}
