"use strict";
/**
 * Timezone-aware date utilities — ported from src/utils/date.ts.
 * Logical day rolls over at midnight in the user's IANA timezone.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLogicalDate = getLogicalDate;
exports.splitByLogicalDay = splitByLogicalDay;
function getLogicalDate(timezone, at = new Date()) {
    return new Intl.DateTimeFormat('sv', { timeZone: timezone }).format(at);
}
function nextMidnightInTZ(timezone, after = new Date()) {
    const todayStr = getLogicalDate(timezone, after);
    const [y, m, d] = todayStr.split('-').map(Number);
    const nextDay = new Date(y, m - 1, d + 1);
    const tomorrowStr = new Intl.DateTimeFormat('sv').format(nextDay);
    let lo = after.getTime();
    let hi = lo + 14 * 60 * 60 * 1000;
    while (hi - lo > 1000) {
        const mid = Math.floor((lo + hi) / 2);
        const midStr = getLogicalDate(timezone, new Date(mid));
        if (midStr < tomorrowStr)
            lo = mid;
        else
            hi = mid;
    }
    return new Date(hi);
}
function splitByLogicalDay(startTime, endTime, timezone) {
    const chunks = [];
    let cursor = new Date(startTime);
    const end = new Date(endTime);
    while (cursor < end) {
        const chunkDate = getLogicalDate(timezone, cursor);
        const boundary = nextMidnightInTZ(timezone, cursor);
        const chunkEnd = boundary < end ? boundary : end;
        const durationMs = chunkEnd.getTime() - cursor.getTime();
        chunks.push({
            date: chunkDate,
            startTime: cursor.toISOString(),
            endTime: chunkEnd.toISOString(),
            durationMs,
        });
        cursor = chunkEnd;
    }
    return chunks;
}
//# sourceMappingURL=date.js.map