/**
 * Philippine timezone helpers. Uses the Intl API — no date library required.
 */

export const BUSINESS_TIMEZONE = "Asia/Manila";

type DateInput = Date | string | number;

function toDate(input: DateInput): Date {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) throw new RangeError(`Invalid date: ${String(input)}`);
  return d;
}

/** YYYY-MM-DD for the given instant, in Asia/Manila. */
export function toManilaDateString(
  input: DateInput = new Date(),
  timeZone = BUSINESS_TIMEZONE,
): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(toDate(input));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Human-readable date, e.g. "31 Oct 2026". */
export function formatManilaDate(
  input: DateInput | null | undefined,
  timeZone = BUSINESS_TIMEZONE,
): string {
  if (input === null || input === undefined || input === "") return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(toDate(input));
}

/** Human-readable date and time, e.g. "31 Oct 2026, 2:05 PM". */
export function formatManilaDateTime(
  input: DateInput | null | undefined,
  timeZone = BUSINESS_TIMEZONE,
): string {
  if (input === null || input === undefined || input === "") return "—";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(toDate(input));
}

/** Start of the given Manila calendar day as a UTC Date (for range queries). */
export function startOfManilaDay(dateString: string, timeZone = BUSINESS_TIMEZONE): Date {
  const offsetMinutes = timezoneOffsetMinutes(new Date(`${dateString}T00:00:00Z`), timeZone);
  return new Date(Date.parse(`${dateString}T00:00:00Z`) - offsetMinutes * 60_000);
}

/** Minutes east of UTC for the given timezone at the given instant (Manila is +480, no DST). */
export function timezoneOffsetMinutes(at: Date, timeZone = BUSINESS_TIMEZONE): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUTC = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return Math.round((asUTC - at.getTime()) / 60_000);
}
