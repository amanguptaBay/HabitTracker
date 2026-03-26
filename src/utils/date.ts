/**
 * Logical date utilities.
 *
 * A "logical day" starts at dayStartHour:dayStartMinute (user setting).
 * Example: hour=4, minute=30 → anything before 4:30am is "yesterday" logically.
 */

/** Total offset in milliseconds for a given hour + minute boundary. */
const boundaryOffsetMs = (hour: number, minute: number) =>
  (hour * 60 + minute) * 60_000;

/**
 * Returns the logical date string (YYYY-MM-DD) for a given timestamp.
 * Shifts the timestamp back by the boundary offset before extracting the date.
 */
export function getLogicalDate(
  dayStartHour: number,
  dayStartMinute: number = 0,
  at: Date = new Date()
): string {
  const shifted = new Date(at.getTime() - boundaryOffsetMs(dayStartHour, dayStartMinute));
  return shifted.toISOString().split('T')[0];
}

/**
 * Returns the exact UTC timestamp of the next logical day boundary after `after`.
 */
export function nextDayBoundary(
  dayStartHour: number,
  dayStartMinute: number = 0,
  after: Date = new Date()
): Date {
  const boundary = new Date(after);
  boundary.setUTCHours(dayStartHour, dayStartMinute, 0, 0);
  if (boundary <= after) {
    boundary.setUTCDate(boundary.getUTCDate() + 1);
  }
  return boundary;
}

/**
 * Split a [startTime, endTime] span into per-logical-day chunks.
 * Most timers produce one chunk. An overnight timer produces two.
 */
export function splitByLogicalDay(
  startTime: string,
  endTime: string,
  dayStartHour: number,
  dayStartMinute: number = 0
): Array<{ date: string; startTime: string; endTime: string; durationMs: number }> {
  const chunks: Array<{ date: string; startTime: string; endTime: string; durationMs: number }> = [];

  let cursor   = new Date(startTime);
  const end    = new Date(endTime);

  while (cursor < end) {
    const chunkDate  = getLogicalDate(dayStartHour, dayStartMinute, cursor);
    const boundary   = nextDayBoundary(dayStartHour, dayStartMinute, cursor);
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
