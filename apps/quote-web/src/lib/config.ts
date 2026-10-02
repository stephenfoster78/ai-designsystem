/** Runtime configuration, read once. Values are seconds in the environment, ms in code. */

function seconds(name: string, fallback: number): number {
  const raw = process.env[name];
  const value = raw ? Number(raw) : fallback;
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive number of seconds`);
  return value * 1000;
}

/** "30 minutes", for copy that mentions the idle limit. */
export function idleLimitText(): string {
  const minutes = Math.round(config.sessionIdleMs / 60_000);
  return minutes >= 1 ? `${minutes} minute${minutes === 1 ? "" : "s"}` : `${Math.round(config.sessionIdleMs / 1000)} seconds`;
}

export const config = {
  /** Idle session length. Default 30 minutes. */
  sessionIdleMs: seconds("QF_SESSION_IDLE_SECONDS", 30 * 60),
  /** Warning shown this long before the session ends. Default 2 minutes. */
  sessionWarningMs: seconds("QF_SESSION_WARNING_SECONDS", 2 * 60),
  sessionCookie: "qf_session",
  timeZone: "Europe/London",
  /** Cookie domain shared with the direct site so consent is not asked twice. Unset locally. */
  consentDomain: process.env.NEXT_PUBLIC_CONSENT_DOMAIN || undefined,
};
