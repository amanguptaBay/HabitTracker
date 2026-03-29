/**
 * DayTimeline
 *
 * Scrollable 0000–2359 day view rendered in the user's IANA timezone.
 *
 * Core positioning strategy (avoids all Intl/Hermes quirks):
 *   1. Binary-search for the UTC ms of midnight on `viewingDate` in `timezone`
 *      (same technique as nextMidnightInTZ — provably correct).
 *   2. Every block's top = (startUTC − midnightUTC) / 60 000 × (HOUR_H / 60)
 *   3. The hour labels are just "00:00"…"23:00" — they always mean the user's
 *      local hours because step 2 positions blocks relative to local midnight.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ActiveTimer, Goal, Routine, TimingSegment } from '../types';

interface Props {
  timingSegments: TimingSegment[];
  activeTimers:   ActiveTimer[];
  goals:          Goal[];
  routines:       Routine[];
  timezone:       string;
  viewingDate:    string;   // YYYY-MM-DD in user's timezone
  isToday:        boolean;
}

// ─── Layout constants ─────────────────────────────────────────────────────────

const HOUR_H    = 64;
const TOTAL_H   = 24 * HOUR_H;   // 1536 px
const GUTTER    = 52;
// TIMELINE_W is the pixel width available to blocks inside the timeline column.
// On most phones the timeline takes the remaining screen width after the gutter.
// We use a runtime value via onLayout for accuracy, but fall back to a safe default.
// Overlap tiling uses this to compute per-column widths.
const TIMELINE_W_FALLBACK = 320;

// ─── Core: UTC ms of midnight for a given YYYY-MM-DD in a timezone ───────────

/**
 * Returns the UTC millisecond timestamp of 00:00:00 on `dateStr` in `tz`.
 * Binary search over ±14 h around UTC midnight — identical to nextMidnightInTZ.
 */
function midnightUTC(dateStr: string, tz: string): number {
  const [y, mo, d] = dateStr.split('-').map(Number);
  let lo = Date.UTC(y, mo - 1, d) - 14 * 3_600_000;
  let hi = Date.UTC(y, mo - 1, d) + 14 * 3_600_000;
  while (hi - lo > 1000) {
    const mid = Math.floor((lo + hi) / 2);
    const s = new Intl.DateTimeFormat('sv', { timeZone: tz }).format(new Date(mid));
    if (s < dateStr) lo = mid; else hi = mid;
  }
  return hi;
}

// ─── Layout helpers ───────────────────────────────────────────────────────────

/** Convert elapsed minutes since local midnight → px from top of timeline */
function minsToY(elapsedMins: number): number {
  return (elapsedMins / 60) * HOUR_H;
}

/** Position a UTC ISO string on the day grid given the midnight anchor */
function isoToY(iso: string, midnight: number): number {
  const elapsedMs   = new Date(iso).getTime() - midnight;
  const elapsedMins = elapsedMs / 60_000;
  return minsToY(Math.max(0, elapsedMins));
}


// ─── Formatting ───────────────────────────────────────────────────────────────

function fmtDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

/** Format a UTC ISO string as a local clock time (e.g. "8:30 AM") */
function fmtLocalTime(iso: string, midnight: number, tz: string): string {
  // Derive HH:MM from the elapsed minutes since midnight — no Intl time parsing needed
  const elapsedMins = Math.round((new Date(iso).getTime() - midnight) / 60_000);
  const h = Math.floor(elapsedMins / 60) % 24;
  const m = elapsedMins % 60;
  const ampm = h < 12 ? 'AM' : 'PM';
  const h12  = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

// ─── Colour palette ───────────────────────────────────────────────────────────

const PALETTE = [
  '#2e7d32', '#1565c0', '#6a1b9a', '#e65100',
  '#00695c', '#b71c1c', '#558b2f', '#4527a0',
];

function blockColor(targetId: string): string {
  let h = 0;
  for (const c of targetId) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return PALETTE[h % PALETTE.length];
}

// ─── Block type ───────────────────────────────────────────────────────────────

interface Block {
  id:         string;
  label:      string;
  color:      string;
  topY:       number;
  heightPx:   number;
  durationMs: number;
  timeLabel:  string;
  isLive:     boolean;
}

interface LayoutBlock extends Block {
  col:     number;   // 0-based column index within its overlap group
  numCols: number;   // total columns in its overlap group
}

// ─── Overlap layout ───────────────────────────────────────────────────────────

function blocksOverlap(a: Block, b: Block): boolean {
  return a.topY < b.topY + b.heightPx && b.topY < a.topY + a.heightPx;
}

/**
 * Assign each block a (col, numCols) pair so overlapping blocks tile
 * side-by-side rather than stacking on top of each other.
 *
 * Algorithm:
 *   1. Sort by start time.
 *   2. Greedy column assignment — place each block in the first column whose
 *      last occupant has already ended.
 *   3. For numCols, give each block the widest column count any block in its
 *      overlap cluster needs (so widths stay consistent within a cluster).
 */
function assignColumns(blocks: Block[]): LayoutBlock[] {
  if (blocks.length === 0) return [];

  const sorted = [...blocks].sort((a, b) => a.topY - b.topY);
  const cols: number[] = [];          // cols[i] = bottom-Y of last block in column i
  const assigned: LayoutBlock[] = sorted.map((b) => ({ ...b, col: 0, numCols: 1 }));

  // Step 1 — greedy column assignment
  for (let i = 0; i < assigned.length; i++) {
    const b      = assigned[i];
    const bottom = b.topY + b.heightPx;
    let placed   = -1;
    for (let c = 0; c < cols.length; c++) {
      if (cols[c] <= b.topY) { placed = c; cols[c] = bottom; break; }
    }
    if (placed === -1) { placed = cols.length; cols.push(bottom); }
    assigned[i].col = placed;
  }

  // Step 2 — compute numCols per block (max column index among all overlapping peers + 1)
  for (let i = 0; i < assigned.length; i++) {
    let maxCol = assigned[i].col;
    for (let j = 0; j < assigned.length; j++) {
      if (i !== j && blocksOverlap(assigned[i], assigned[j])) {
        maxCol = Math.max(maxCol, assigned[j].col);
      }
    }
    assigned[i].numCols = maxCol + 1;
  }

  return assigned;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DayTimeline({
  timingSegments,
  activeTimers,
  goals,
  routines,
  timezone,
  viewingDate,
  isToday,
}: Props) {
  const scrollRef  = useRef<ScrollView>(null);
  const [timelineW, setTimelineW] = useState(TIMELINE_W_FALLBACK);
  const onTimelineLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number } } }) =>
      setTimelineW(e.nativeEvent.layout.width),
    [],
  );

  // UTC ms of local midnight for the day being viewed — recompute when date or tz changes
  const midnight = useMemo(
    () => midnightUTC(viewingDate, timezone),
    [viewingDate, timezone],
  );

  // "Now" in minutes since local midnight, ticks every 30 s
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const nowMins = (nowMs - midnight) / 60_000;

  // Scroll to current time on mount / when the day changes
  useEffect(() => {
    const targetMins = isToday ? Math.max(0, nowMins - 60) : 8 * 60;
    const y = Math.max(0, minsToY(targetMins));
    const t = setTimeout(() => scrollRef.current?.scrollTo({ y, animated: false }), 100);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewingDate]);

  // ── Build blocks ──────────────────────────────────────────────────────────

  const labelFor = (id: string) =>
    goals.find((g) => g.id === id)?.name ??
    routines.find((r) => r.id === id)?.name ??
    id;

  const completedBlocks: Block[] = timingSegments.flatMap((seg) =>
    (seg.segments ?? []).map((run, i) => ({
      id:         `${seg.targetId}-${i}`,
      label:      labelFor(seg.targetId),
      color:      blockColor(seg.targetId),
      topY:       isoToY(run.startTime, midnight),
      heightPx:   Math.max(28, (run.durationMs / 3_600_000) * HOUR_H),
      durationMs: run.durationMs,
      timeLabel:  fmtLocalTime(run.startTime, midnight, timezone),
      isLive:     false,
    }))
  );

  const liveBlocks: Block[] = activeTimers.map((t) => {
    const durationMs = nowMs - new Date(t.startedAt).getTime();
    return {
      id:         `live-${t.targetId}`,
      label:      labelFor(t.targetId),
      color:      blockColor(t.targetId),
      topY:       isoToY(t.startedAt, midnight),
      heightPx:   Math.max(28, (durationMs / 3_600_000) * HOUR_H),
      durationMs,
      timeLabel:  fmtLocalTime(t.startedAt, midnight, timezone),
      isLive:     true,
    };
  });

  const allBlocks: LayoutBlock[] = assignColumns([...completedBlocks, ...liveBlocks]);

  // ── DEBUG ─────────────────────────────────────────────────────────────────
  console.log('[DayTimeline] viewingDate:', viewingDate, '| timezone:', timezone);
  console.log('[DayTimeline] midnight UTC ms:', midnight, '→', new Date(midnight).toISOString());
  console.log('[DayTimeline] timingSegments count:', timingSegments.length);
  timingSegments.forEach((seg) => {
    console.log('  seg targetId:', seg.targetId, '| totalMs:', seg.totalMs, '| runs:', seg.segments?.length ?? 0);
    (seg.segments ?? []).forEach((run, i) => {
      const topY = isoToY(run.startTime, midnight);
      console.log(`    run[${i}] startTime:`, run.startTime, '| durationMs:', run.durationMs, '| topY:', topY);
    });
  });
  console.log('[DayTimeline] allBlocks:', allBlocks.map(b => ({ id: b.id, topY: b.topY, heightPx: b.heightPx, label: b.label })));
  // ─────────────────────────────────────────────────────────────────────────

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
      showsVerticalScrollIndicator={false}
    >
      {/* Single View — height drives scroll; row lays out gutter + timeline */}
      <View style={styles.dayView}>

        {/* Hour labels */}
        <View style={styles.gutter}>
          {Array.from({ length: 25 }, (_, h) => (
            <View
              key={h}
              style={[styles.hourLabelRow, { top: h * HOUR_H - 7 }]}
            >
              <Text style={styles.hourText}>
                {`${String(h === 24 ? 0 : h).padStart(2, '0')}:00`}
              </Text>
            </View>
          ))}
        </View>

        {/* Timeline */}
        <View style={styles.timeline} onLayout={onTimelineLayout}>

          {/* Hour grid lines */}
          {Array.from({ length: 25 }, (_, h) => (
            <View key={h} style={[styles.hourLine, { top: h * HOUR_H }]} />
          ))}

          {/* Half-hour ticks */}
          {Array.from({ length: 24 }, (_, h) => (
            <View key={h} style={[styles.halfLine, { top: h * HOUR_H + HOUR_H / 2 }]} />
          ))}

          {/* Blocks */}
          {allBlocks.map((block) => {
            const GAP        = 2;                          // px gap between tiled columns
            const totalGap   = GAP * (block.numCols - 1);
            const colW       = (timelineW - 8 - totalGap) / block.numCols; // 4px margin each side
            const blockLeft  = 4 + block.col * (colW + GAP);
            const blockRight = 4 + (block.numCols - block.col - 1) * (colW + GAP);
            return (
            <View
              key={block.id}
              style={[
                styles.block,
                {
                  top:             block.topY + 1,
                  height:          block.heightPx - 2,
                  left:            blockLeft,
                  right:           blockRight,
                  backgroundColor: block.color,
                },
                block.isLive && styles.blockLive,
              ]}
            >
              <Text style={styles.blockName} numberOfLines={1}>
                {block.isLive ? '▶ ' : ''}{block.label}
              </Text>
              {block.heightPx >= 44 && (
                <Text style={styles.blockMeta} numberOfLines={1}>
                  {block.timeLabel} · {fmtDuration(block.durationMs)}
                </Text>
              )}
            </View>
            );
          })}

          {/* Now line — today only */}
          {isToday && nowMins >= 0 && nowMins <= 24 * 60 && (
            <View style={[styles.nowRow, { top: minsToY(nowMins) }]}>
              <View style={styles.nowDot} />
              <View style={styles.nowBar} />
            </View>
          )}

        </View>
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: {
    flex:            1,
    backgroundColor: '#ffffff',
  },
  dayView: {
    height:        TOTAL_H,
    flexDirection: 'row',
  },

  // Gutter
  gutter: {
    width:           GUTTER,
    position:        'relative',
    backgroundColor: '#ffffff',
  },
  hourLabelRow: {
    position:     'absolute',
    width:        GUTTER,
    alignItems:   'flex-end',
    paddingRight: 8,
  },
  hourText: {
    fontSize:    10,
    color:       '#9e9e9e',
    fontVariant: ['tabular-nums'],
  },

  // Timeline column
  timeline: {
    flex:            1,
    height:          TOTAL_H,
    position:        'relative',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: '#e0e0e0',
    backgroundColor: '#ffffff',
  },
  hourLine: {
    position:        'absolute',
    left:            0,
    right:           0,
    height:          StyleSheet.hairlineWidth,
    backgroundColor: '#e0e0e0',
  },
  halfLine: {
    position:        'absolute',
    left:            0,
    right:           0,
    height:          StyleSheet.hairlineWidth,
    backgroundColor: '#f0f0f0',
  },

  // Blocks
  block: {
    position:          'absolute',
    borderRadius:      6,
    paddingHorizontal: 8,
    paddingVertical:   4,
    overflow:          'hidden',
    justifyContent:    'center',
  },
  blockLive: {
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.15)',
  },
  blockName: {
    fontSize:   12,
    fontWeight: '700',
    color:      '#ffffff',
  },
  blockMeta: {
    fontSize:  10,
    color:     'rgba(255,255,255,0.8)',
    marginTop: 2,
  },

  // Now indicator
  nowRow: {
    position:      'absolute',
    left:          -4,
    right:         0,
    flexDirection: 'row',
    alignItems:    'center',
    zIndex:        20,
  },
  nowDot: {
    width:           8,
    height:          8,
    borderRadius:    4,
    backgroundColor: '#f44336',
  },
  nowBar: {
    flex:            1,
    height:          1.5,
    backgroundColor: '#f44336',
  },
});
