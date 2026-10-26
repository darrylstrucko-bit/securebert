// Alerts carry `minutes_ago` (minutes before "now"), not an absolute date --
// see securebert-api's docs/codex-noise-time-spec.md. Resolving it to a real
// calendar date happens here, client-side, against the viewer's actual current
// time, not baked in at build/export time -- otherwise it would just go stale
// again the same way the old hardcoded 2026 dates did.
//
// `nowMs` is passed in rather than read via Date.now() inline so every row in
// a table/timeline resolves against the exact same reference instant (no
// per-row drift), and so callers can defer resolution to a post-mount effect
// -- computing it directly during render would bake whatever the server's
// build-time "now" was into the static HTML and mismatch the client's real
// "now" at hydration.

const DATE_FMT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const TIME_FMT = new Intl.DateTimeFormat("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

export function resolveDate(minutesAgo: number | null | undefined, nowMs: number): Date | null {
  if (minutesAgo == null) return null;
  return new Date(nowMs - minutesAgo * 60_000);
}

export function formatDateTime(minutesAgo: number | null | undefined, nowMs: number | null): string {
  if (nowMs == null) return "--";
  const d = resolveDate(minutesAgo, nowMs);
  if (!d) return "--";
  return `${DATE_FMT.format(d)}, ${TIME_FMT.format(d)}`;
}

// Oldest (largest minutes_ago) first -- "past to present" reading order.
export function sortByMinutesAgoDesc<T extends { minutes_ago?: number | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => (b.minutes_ago ?? 0) - (a.minutes_ago ?? 0));
}
