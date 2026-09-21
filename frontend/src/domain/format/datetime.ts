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

export function formatUTC(value: DateInput): string {
  const date = new Date(value);
  return (
    new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(date) + " UTC"
  );
}

export function formatUTCDate(value: DateInput): string {
  const date = new Date(value);
  return (
    new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(date) + " UTC"
  );
}

export function formatUTCTime(value: DateInput): string {
  const date = new Date(value);
  return (
    new Intl.DateTimeFormat("en", {
      timeStyle: "short",
      timeZone: "UTC",
    }).format(date) + " UTC"
  );
}

/**
 * Relative time from now, in the user's language.
 * Example: "3 hours ago", "in 2 days"
 *
 * Relative expressions are time-zone agnostic — "3 hours ago" is the same
 * regardless of where the viewer is — so this one does NOT force UTC.
 */
export function formatRelative(value: DateInput): string {
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diffMs / 60_000);

  if (Math.abs(minutes) < 60) return rtf.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(-hours, "hour");
  const days = Math.round(hours / 24);
  return rtf.format(-days, "day");
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
