"use client";

import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cx } from "../utils";

export interface DialogProps {
  open: boolean;
  title: ReactNode;
  children: ReactNode;
  /** Called on Escape and on any close not initiated by the parent. */
  onClose: () => void;
  /** Extra id to reference for the accessible description. */
  describedBy?: string;
  /** Element to focus on open. Defaults to the dialog heading. */
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  size?: "s" | "m" | "l";
  /** Show the × close button in the corner. */
  showClose?: boolean;
  closeLabel?: string;
}

/**
 * The open dialog element. Popovers (e.g. a typeahead's list) must render inside it: a modal
 * <dialog> makes everything outside it inert, so a list portalled to <body> could not be used.
 */
const DialogContainerContext = createContext<Element | null>(null);
export const useDialogContainer = () => useContext(DialogContainerContext);

const sizes = { s: "max-w-[30rem]", m: "max-w-[40rem]", l: "max-w-[52rem]" };

/**
 * Modal dialog built on the native <dialog> element with showModal(): the browser makes the
 * rest of the page inert, traps focus, handles Escape and restores focus on close. We add a
 * labelled heading, initial focus and explicit focus restoration for older browsers.
 */
export function Dialog({ open, title, children, onClose, describedBy, initialFocusRef, size = "m", showClose = true, closeLabel = "Close" }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const [container, setContainer] = useState<HTMLDialogElement | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocus.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
      (initialFocusRef?.current ?? headingRef.current)?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
      returnFocus.current?.focus?.();
    }
  }, [open, initialFocusRef]);

  // If the component unmounts while open, restore focus to where the user was.
  useEffect(() => () => returnFocus.current?.focus?.(), []);

  return (
    <DialogContainerContext.Provider value={container}>
    <dialog
      ref={(node) => {
        ref.current = node;
        setContainer(node);
      }}
      aria-labelledby={titleId}
      aria-describedby={describedBy}
      onCancel={(event) => {
        // Escape: let the parent decide (it owns `open`).
        event.preventDefault();
        onClose();
      }}
      className={cx("m-auto w-[calc(100%-2rem)] border-0 bg-surface p-0 text-ink", sizes[size])}
    >
      <div className="relative max-h-[85vh] overflow-y-auto p-6 sm:p-8">
        <h2 id={titleId} ref={headingRef} tabIndex={-1} className="mb-4 pr-12 text-heading-l font-bold focus:outline-none">
          {title}
        </h2>
        {showClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 inline-flex size-[var(--qf-size-target-min)] items-center justify-center text-heading-m focus-visible:focus-ring"
          >
            <span aria-hidden="true">×</span>
            <span className="visually-hidden">{closeLabel}</span>
          </button>
        )}
        {children}
      </div>
    </dialog>
    </DialogContainerContext.Provider>
  );
}
