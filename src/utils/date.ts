/**
 * Logical date utilities.
 *
 * A "logical day" starts at dayStartHour (user setting) rather than midnight.
 * Example: dayStartHour=4 means 3:59am Tuesday is still "Monday" logically.
 */

/**
 * Returns the logical date string (YYYY-MM-DD) for a given timestamp.
 * Shifts the timestamp back by dayStartHour hours before extracting the date,
 * so anything before dayStartHour is attributed to the previous calendar day.
 */
export function getLogicalDate(dayStartHour: number, at: Date = new Date()): string {
  const shifted = new Date(at.getTime() - dayStartHour * 3_600_000);
  return shifted.toISOString().split('T')[0];
}

/**
 * Returns the exact UTC timestamp when the logical day boundary occurs
 * AFTER the given reference time.
 *
 * Used by stopTimer to detect if a timer crossed into a new logical day.
 */
export function nextDayBoundary(dayStartHour: number, after: Date = new Date()): Date {
  // The boundary is dayStartHour:00:00 UTC each calendar day.
  // Find the next one strictly after `after`.
  const boundary = new Date(after);
  boundary.setUTCHours(dayStartHour, 0, 0, 0);
  if (boundary <= after) {
    // Today's boundary already passed — use tomorrow's
    boundary.setUTCDate(boundary.getUTCDate() + 1);
  }
  return boundary;
}

/**
 * Split a [startTime, endTime] span into one or more {date, startTime, endTime}
 * chunks, each belonging to a single logical day.
 *
 * Most timers produce exactly one chunk. A timer that runs overnight produces two.
 */
export function splitByLogicalDay(
  startTime: string,
  endTime: string,
  dayStartHour: number
): Array<{ date: string; startTime: string; endTime: string; durationMs: number }> {
  const chunks: Array<{ date: string; startTime: string; endTime: string; durationMs: number }> = [];

  let cursor = new Date(startTime);
  const end  = new Date(endTime);

  while (cursor < end) {
    const chunkDate   = getLogicalDate(dayStartHour, cursor);
    const boundary    = nextDayBoundary(dayStartHour, cursor);
    const chunkEnd    = boundary < end ? boundary : end;
    const durationMs  = chunkEnd.getTime() - cursor.getTime();

    chunks.push({
      date:       chunkDate,
      startTime:  cursor.toISOString(),
      endTime:    chunkEnd.toISOString(),
      durationMs,
    });

    cursor = chunkEnd;
  }

  return chunks;
}
