/**
 * Logical date utilities — timezone aware.
 *
 * The logical day rolls over at midnight (00:00:00) in the user's chosen
 * IANA timezone. Everything is stored as UTC ISO strings; the timezone is
 * only used to determine which calendar date a moment belongs to.
 *
 * Example: timezone = "America/New_York" (UTC-5 in winter)
 *   2026-03-26T04:59:00Z  → local 11:59pm Mar 25  → logical date = 2026-03-25
 *   2026-03-26T05:00:00Z  → local 12:00am Mar 26  → logical date = 2026-03-26
 */

/**
 * Returns the logical date (YYYY-MM-DD) for `at` in the given IANA timezone.
 * Swedish locale ('sv') produces YYYY-MM-DD format natively.
 */
export function getLogicalDate(timezone: string, at: Date = new Date()): string {
  return new Intl.DateTimeFormat('sv', { timeZone: timezone }).format(at);
}

/**
 * Returns the exact UTC timestamp of the next midnight in `timezone` after `after`.
 * Uses binary search over a ±14-hour window (covers all real-world UTC offsets).
 */
export function nextMidnightInTZ(timezone: string, after: Date = new Date()): Date {
  // Determine tomorrow's date string in the timezone
  const todayStr    = getLogicalDate(timezone, after);
  const [y, m, d]   = todayStr.split('-').map(Number);
  const nextDay     = new Date(y, m - 1, d + 1); // handles month/year rollover
  const tomorrowStr = new Intl.DateTimeFormat('sv').format(nextDay); // YYYY-MM-DD

  // Binary search: find the UTC ms when the TZ date first becomes tomorrowStr.
  // Search ±14 h around UTC midnight of that date (covers all UTC offsets + DST).
  const [ty, tm, td] = tomorrowStr.split('-').map(Number);
  let lo = Date.UTC(ty, tm - 1, td) - 14 * 3_600_000;
  let hi = Date.UTC(ty, tm - 1, td) + 14 * 3_600_000;

  while (hi - lo > 1000) {
    const mid       = Math.floor((lo + hi) / 2);
    const midStr    = getLogicalDate(timezone, new Date(mid));
    if (midStr < tomorrowStr) lo = mid; else hi = mid;
  }

  return new Date(hi);
}

/**
 * Split a [startTime, endTime] span into per-logical-day chunks.
 * Most timers produce one chunk. An overnight timer produces two.
 */
export function splitByLogicalDay(
  startTime: string,
  endTime:   string,
  timezone:  string,
): Array<{ date: string; startTime: string; endTime: string; durationMs: number }> {
  const chunks: Array<{ date: string; startTime: string; endTime: string; durationMs: number }> = [];

  let cursor = new Date(startTime);
  const end  = new Date(endTime);

  while (cursor < end) {
    const chunkDate  = getLogicalDate(timezone, cursor);
    const boundary   = nextMidnightInTZ(timezone, cursor);
    const chunkEnd   = boundary < end ? boundary : end;
    const durationMs = chunkEnd.getTime() - cursor.getTime();

    chunks.push({
      date:      chunkDate,
      startTime: cursor.toISOString(),
      endTime:   chunkEnd.toISOString(),
      durationMs,
    });

    cursor = chunkEnd;
  }

  return chunks;
}
