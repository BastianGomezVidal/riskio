/**
 * Formatting helpers for timestamps from the backend.
 *
 * All backend timestamps are ISO 8601 strings in UTC. Every formatter
 * here renders in UTC with the "UTC" suffix, so that the displayed time
 * is unambiguous regardless of the viewer's location.
 *
 * Use these instead of `Date.prototype.toLocaleString` anywhere a
 * timestamp from the API is rendered.
 */

type DateInput = string | Date;

/**
 * Formatters are built once, at module load.
 *
 * They used to be constructed inside every call, and the call sites are inside
 * loops: a storm card formats its timestamp twice, a list of N cards built 2N
 * `Intl.DateTimeFormat` objects per render. `Intl` construction is one of the
 * more expensive things you can do in a render, and it all landed in the
 * keystroke handler of the storm search box — which is the INP we were trying to
 * protect. A `useMemo` would not have helped; this is not a hook.
 */
const UTC_DATE_TIME = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

const UTC_DATE = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeZone: "UTC",
});

const UTC_TIME = new Intl.DateTimeFormat("en", {
  timeStyle: "short",
  timeZone: "UTC",
});

/**
 * Same reasoning as the absolute formatters, and the same call sites: every
 * storm card footer renders a relative timestamp.
 */
const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function formatUTC(value: DateInput): string {
  const date = new Date(value);
  return UTC_DATE_TIME.format(date) + " UTC";
}

export function formatUTCDate(value: DateInput): string {
  const date = new Date(value);
  return UTC_DATE.format(date) + " UTC";
}

export function formatUTCTime(value: DateInput): string {
  const date = new Date(value);
  return UTC_TIME.format(date) + " UTC";
}

/**
 * Relative time from now, in the user's language.
 * Example: "3 hours ago", "in 2 days"
 *
 * Relative expressions are time-zone agnostic — "3 hours ago" is the same
 * regardless of where the viewer is — so this one does NOT force UTC.
 */
export function formatRelative(value: DateInput): string {
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diffMs / 60_000);

  if (Math.abs(minutes) < 60) return RELATIVE.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return RELATIVE.format(-hours, "hour");
  const days = Math.round(hours / 24);
  return RELATIVE.format(-days, "day");
}

/**
 * Human duration between two ISO timestamps.
 *
 * Returns "8 hours", "3 days", "2 weeks", or "3 months" depending on the
 * magnitude.
 */
export function formatDuration(fromIso: string, toIso: string): string {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  const ms = Math.abs(to - from);

  const hours = ms / (1000 * 60 * 60);
  if (hours < 24) {
    const rounded = Math.max(1, Math.round(hours));
    return `${rounded} ${rounded === 1 ? "hour" : "hours"}`;
  }

  const days = hours / 24;
  if (days < 14) {
    const rounded = Math.round(days);
    return `${rounded} ${rounded === 1 ? "day" : "days"}`;
  }

  const weeks = days / 7;
  if (weeks < 8) {
    const rounded = Math.round(weeks);
    return `${rounded} ${rounded === 1 ? "week" : "weeks"}`;
  }

  const months = days / 30.44;
  const rounded = Math.round(months);
  return `${rounded} ${rounded === 1 ? "month" : "months"}`;
}
