/** Date helpers that work on ISO calendar dates (YYYY-MM-DD) without time-zone drift. */

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = ISO.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

function toUtc(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const date = toUtc(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return fromUtc(date);
}

/** Subtracts whole years, clamping 29 February to 28 February in non-leap years. */
export function subtractYears(iso: string, years: number): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const target = new Date(Date.UTC(y - years, m - 1, 1));
  const lastDay = new Date(Date.UTC(y - years, m, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return fromUtc(target);
}

/** Today's calendar date in a given IANA time zone (default UK). */
export function todayIn(timeZone = "Europe/London", now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export type DateParts = { day: string; month: string; year: string };

export type DatePartsResult =
  | { ok: true; value: string | null }
  | { ok: false; code: "incompleteDate"; missing: Array<keyof DateParts> }
  | { ok: false; code: "invalidDate" };

/** Parses three-part date input. All parts empty → null (left to the "required" rule). */
export function parseDateParts(parts: DateParts): DatePartsResult {
  const trimmed = { day: parts.day.trim(), month: parts.month.trim(), year: parts.year.trim() };
  const missing = (Object.keys(trimmed) as Array<keyof DateParts>).filter((k) => trimmed[k] === "");
  if (missing.length === 3) return { ok: true, value: null };
  if (missing.length > 0) return { ok: false, code: "incompleteDate", missing };
  if (!/^\d{1,2}$/.test(trimmed.day) || !/^\d{1,2}$/.test(trimmed.month) || !/^\d{4}$/.test(trimmed.year)) {
    return { ok: false, code: "invalidDate" };
  }
  const iso = `${trimmed.year}-${trimmed.month.padStart(2, "0")}-${trimmed.day.padStart(2, "0")}`;
  return isIsoDate(iso) ? { ok: true, value: iso } : { ok: false, code: "invalidDate" };
}

export function isoToParts(iso: unknown): DateParts {
  if (!isIsoDate(iso)) return { day: "", month: "", year: "" };
  const [year, month, day] = iso.split("-") as [string, string, string];
  return { day: String(Number(day)), month: String(Number(month)), year };
}

/**
 * Forgiving UK (day-first) date parser for a single text field: accepts D/M/YYYY with / - . ,
 * or spaces as separators, DDMMYYYY or DDMMYY without separators (numeric keypads have no
 * slash key), and two-digit years as 20xx. Returns ISO, null for empty, or an error.
 */
export function parseUkDate(text: string): { ok: true; value: string | null } | { ok: false; code: "invalidDate" } {
  const s = text.trim();
  if (!s) return { ok: true, value: null };
  let parts: string[];
  if (/^\d{8}$/.test(s)) parts = [s.slice(0, 2), s.slice(2, 4), s.slice(4)];
  else if (/^\d{6}$/.test(s)) parts = [s.slice(0, 2), s.slice(2, 4), s.slice(4)];
  else parts = s.split(/[\s/.,-]+/);
  if (parts.length !== 3 || !parts.every((p) => /^\d+$/.test(p))) return { ok: false, code: "invalidDate" };
  const [d, m, y] = parts as [string, string, string];
  if (d.length > 2 || m.length > 2 || (y.length !== 2 && y.length !== 4)) return { ok: false, code: "invalidDate" };
  const year = y.length === 2 ? `20${y}` : y;
  const iso = `${year}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  return isIsoDate(iso) ? { ok: true, value: iso } : { ok: false, code: "invalidDate" };
}

/** ISO date → DD/MM/YYYY. */
export function isoToUk(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
