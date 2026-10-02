"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "./Button";
import { Dialog } from "./Dialog";

export interface SessionTimeoutProps {
  /** Milliseconds until the server expires the session, measured when the page rendered. */
  remainingMs: number;
  /** How long before expiry to warn. Default 2 minutes. */
  warningMs?: number;
  /** Seconds-remaining thresholds announced to screen readers. Default 2 min, 1 min, 50, 30, 10 s. */
  announceAt?: number[];
  /** Extends the session on the server; resolves with the new remaining time in ms. */
  onExtend: () => Promise<number>;
  /** Called once when time runs out (navigate to the session-ended page). */
  onExpire: () => void;
  /** Ends the session now (the draft is already saved). */
  onEnd?: () => void;
  text?: Partial<typeof defaultText>;
}

const defaultText = {
  title: "Your session is about to end",
  lead: "We have saved your answers. For your security, your session will end in",
  extend: "Continue with my quote",
  end: "End session now",
  extendFailed: "We could not extend your session. Your answers are saved.",
};

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  const parts: string[] = [];
  if (minutes) parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);
  if (seconds || !minutes) parts.push(`${seconds} second${seconds === 1 ? "" : "s"}`);
  return parts.join(" ");
}

/** The announcement for the highest threshold at or above `secondsLeft`, rounded to that threshold. */
export function thresholdFor(secondsLeft: number, thresholds: number[]): number | null {
  const crossed = thresholds.filter((t) => secondsLeft <= t).sort((a, b) => a - b);
  return crossed[0] ?? null;
}

/**
 * Warns before an idle session times out and lets the user extend it (WCAG 2.2.1).
 *
 * The visual countdown updates every second but is hidden from assistive technology; a
 * separate polite live region announces only at fixed thresholds so screen reader users
 * are not interrupted every second.
 */
export function SessionTimeout({
  remainingMs,
  warningMs = 120_000,
  announceAt = [120, 60, 50, 30, 10],
  onExtend,
  onExpire,
  onEnd,
  text: textOverrides,
}: SessionTimeoutProps) {
  const text = { ...defaultText, ...textOverrides };
  const deadline = useRef(Date.now() + remainingMs);
  const expired = useRef(false);
  const lastAnnounced = useRef<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(remainingMs / 1000));
  const [open, setOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const descriptionId = useId();
  const extendRef = useRef<HTMLButtonElement>(null);

  // A new server render (e.g. after a step submit) resets the clock.
  useEffect(() => {
    deadline.current = Date.now() + remainingMs;
    expired.current = false;
  }, [remainingMs]);

  const tick = useCallback(() => {
    const leftMs = deadline.current - Date.now();
    const left = Math.ceil(leftMs / 1000);
    setSecondsLeft(left);
    if (leftMs <= 0) {
      if (!expired.current) {
        expired.current = true;
        onExpire();
      }
      return;
    }
    if (leftMs <= warningMs) {
      setOpen(true);
      const threshold = thresholdFor(left, announceAt);
      if (threshold !== null && threshold !== lastAnnounced.current) {
        lastAnnounced.current = threshold;
        setAnnouncement(`Your session will end in ${formatDuration(threshold)}.`);
      }
    }
  }, [announceAt, onExpire, warningMs]);

  useEffect(() => {
    tick();
    const interval = setInterval(tick, 1000);
    // Background tabs throttle timers; recheck as soon as the tab is visible again.
    const onVisible = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [tick]);

  const extend = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const next = await onExtend();
      deadline.current = Date.now() + next;
      lastAnnounced.current = null;
      setAnnouncement("");
      setOpen(false);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} title={text.title} onClose={extend} describedBy={descriptionId} initialFocusRef={extendRef} showClose={false} size="s">
      <p id={descriptionId} className="mb-6">
        {text.lead}{" "}
        <strong aria-hidden="true" data-testid="countdown">
          {formatDuration(secondsLeft)}
        </strong>
        <span className="visually-hidden" aria-live="polite" aria-atomic="true" data-testid="countdown-announcement">
          {announcement}
        </span>
      </p>
      {failed && (
        <p role="alert" className="mb-4 font-bold text-ink-error">
          {text.extendFailed}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-6">
        <Button ref={extendRef} onClick={extend} disabled={busy} aria-disabled={busy || undefined}>
          {text.extend}
        </Button>
        {onEnd && (
          <Button variant="link" onClick={onEnd}>
            {text.end}
          </Button>
        )}
      </div>
    </Dialog>
  );
}
