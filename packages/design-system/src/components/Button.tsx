import type { ButtonHTMLAttributes, Ref } from "react";
import { cx } from "../utils";

export type ButtonVariant = "primary" | "secondary" | "link";

const base = "inline-flex items-center justify-center gap-2 text-body focus-visible:focus-ring disabled:cursor-not-allowed disabled:opacity-60";
// Solid buttons share box styles; the link variant must not inherit padding or target height
// from them (conflicting utilities resolve by stylesheet order, not class order).
const solid = "min-h-[var(--qf-size-target-min)] rounded-small border-2 border-brand px-5 py-2 font-bold no-underline";

const variants: Record<ButtonVariant, string> = {
  primary: `${solid} bg-brand text-ink-inverse! hover:border-brand-hover hover:bg-brand-hover`,
  secondary: `${solid} bg-surface text-brand! hover:bg-brand-subtle`,
  link: "font-normal text-link underline underline-offset-[0.15em] hover:text-link-hover hover:decoration-[3px]",
};

/** Class names for an element that should look like a button (e.g. a Next.js Link). */
export function buttonClasses(variant: ButtonVariant = "primary", className?: string): string {
  return cx(base, variants[variant], className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  ref?: Ref<HTMLButtonElement>;
}

/** Defaults to type="button" so a button never submits a form by accident. */
export function Button({ variant = "primary", type = "button", className, ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, className)} {...props} />;
}
