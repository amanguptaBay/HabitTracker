/**
 * DayTimeline
 *
 * Scrollable 0000–2359 calendar view. Each TimingRun is rendered as an
 * absolutely-positioned block at its actual local time position.
 * Active timers appear as live "running" blocks that grow in real time.
 */

import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ActiveTimer, Goal, Routine, TimingSegment } from '../types';

interface Props {
  timingSegments: TimingSegment[];
  activeTimers:   ActiveTimer[];
  goals:          Goal[];
  routines:       Routine[];
  timezone:       string;
  isToday:        boolean;
}

// ─── Layout constants ────────────────────────────────────────────────────────

const HOUR_HEIGHT = 64;   // px per hour
const TOTAL_HEIGHT = 24 * HOUR_HEIGHT;
const GUTTER_W = 52;      // left column for hour labels

// ─── Time helpers ─────────────────────────────────────────────────────────────

/** ISO UTC string → minutes since midnight in the given IANA timezone */
function localMinutes(iso: string, tz: string): number {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: tz,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(new Date(iso));
  let h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  if (h === 24) h = 0; // midnight edge case
  return h * 60 + m;
}

function minsToY(mins: number): number {
  return (mins / 60) * HOUR_HEIGHT;
}

function msToHeight(ms: number): number {
  return Math.max(22, (ms / 3_600_000) * HOUR_HEIGHT);
}

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m > 0 ? `${m}m` : ''}`.trim();
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

// ─── Colour palette ───────────────────────────────────────────────────────────

const PALETTE = [
  '#1b5e36', // forest green
  '#1a4a7a', // navy blue
  '#5e2376', // purple
  '#7a4a1a', // amber brown
  '#1a5e5e', // teal
  '#5e1a1a', // maroon
  '#3a5e1a', // olive
  '#1a3a5e', // steel blue
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
  startMins:  number;
  heightPx:   number;
  durationMs: number;
  isLive:     boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DayTimeline({
  timingSegments,
  activeTimers,
  goals,
  routines,
  timezone,
  isToday,
}: Props) {
  const scrollRef = useRef<ScrollView>(null);

  // Live clock — updates every 30 s so the "now" line and live blocks stay current
  const [nowMins, setNowMins] = useState(() =>
    localMinutes(new Date().toISOString(), timezone)
  );
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const tick = () => {
      setNowMins(localMinutes(new Date().toISOString(), timezone));
      setNowMs(Date.now());
    };
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [timezone]);

  // Scroll to current time on mount (past days start at 08:00)
  useEffect(() => {
    const targetMins = isToday ? nowMins : 8 * 60;
    const y = Math.max(0, minsToY(targetMins) - 180);
    setTimeout(() => scrollRef.current?.scrollTo({ y, animated: false }), 80);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Build blocks from stored segments ──────────────────────────────────────
  const completedBlocks: Block[] = timingSegments.flatMap((seg) => {
    const label =
      goals.find((g) => g.id === seg.targetId)?.name ??
      routines.find((r) => r.id === seg.targetId)?.name ??
      seg.targetId;
    const color = blockColor(seg.targetId);

    return seg.segments.map((run, i) => ({
      id:         `${seg.targetId}-${i}`,
      label,
      color,
      startMins:  localMinutes(run.startTime, timezone),
      heightPx:   msToHeight(run.durationMs),
      durationMs: run.durationMs,
      isLive:     false,
    }));
  });

  // ── Build live "currently running" blocks ──────────────────────────────────
  const liveBlocks: Block[] = activeTimers.map((timer) => {
    const label =
      goals.find((g) => g.id === timer.targetId)?.name ??
      routines.find((r) => r.id === timer.targetId)?.name ??
      timer.targetId;
    const durationMs = nowMs - new Date(timer.startedAt).getTime();
    return {
      id:         `live-${timer.targetId}`,
      label:      `▶ ${label}`,
      color:      blockColor(timer.targetId),
      startMins:  localMinutes(timer.startedAt, timezone),
      heightPx:   msToHeight(durationMs),
      durationMs,
      isLive:     true,
    };
  });

  const allBlocks = [...completedBlocks, ...liveBlocks];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
      contentContainerStyle={{ height: TOTAL_HEIGHT }}
      showsVerticalScrollIndicator={false}
    >
      {/* Gutter (hour labels) */}
      <View style={styles.gutter}>
        {Array.from({ length: 24 }, (_, h) => (
          <View key={h} style={[styles.hourLabelWrap, { top: h * HOUR_HEIGHT - 8 }]}>
            <Text style={styles.hourText}>{String(h).padStart(2, '0')}:00</Text>
          </View>
        ))}
      </View>

      {/* Timeline column */}
      <View style={styles.timeline}>
        {/* Full-hour lines */}
        {Array.from({ length: 24 }, (_, h) => (
          <View key={h} style={[styles.hourLine, { top: h * HOUR_HEIGHT }]} />
        ))}
        {/* Half-hour tick lines */}
        {Array.from({ length: 24 }, (_, h) => (
          <View
            key={`h${h}`}
            style={[styles.halfLine, { top: h * HOUR_HEIGHT + HOUR_HEIGHT / 2 }]}
          />
        ))}

        {/* Timing blocks */}
        {allBlocks.map((block) => (
          <View
            key={block.id}
            style={[
              styles.block,
              {
                top:             minsToY(block.startMins),
                height:          block.heightPx,
                backgroundColor: block.color,
              },
              block.isLive && styles.blockLive,
            ]}
          >
            <Text style={styles.blockLabel} numberOfLines={1}>
              {block.label}
            </Text>
            {block.heightPx >= 36 && (
              <Text style={styles.blockDuration}>
                {formatDuration(block.durationMs)}
              </Text>
            )}
          </View>
        ))}

        {/* "Now" indicator — only on today */}
        {isToday && (
          <View style={[styles.nowRow, { top: minsToY(nowMins) }]}>
            <View style={styles.nowDot} />
            <View style={styles.nowBar} />
          </View>
        )}
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    flexDirection: 'row',
  },
  gutter: {
    width: GUTTER_W,
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
  },
  hourLabelWrap: {
    position: 'absolute',
    width: GUTTER_W,
    alignItems: 'flex-end',
    paddingRight: 8,
  },
  hourText: {
    fontSize: 10,
    color: '#555',
    fontVariant: ['tabular-nums'],
  },
  timeline: {
    position: 'absolute',
    left: GUTTER_W,
    right: 0,
    top: 0,
    height: TOTAL_HEIGHT,
    borderLeftWidth: 1,
    borderLeftColor: '#2a2a2e',
  },
  hourLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#2e2e33',
  },
  halfLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#1e1e22',
  },
  block: {
    position: 'absolute',
    left: 4,
    right: 4,
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  blockLive: {
    opacity: 0.8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  blockLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  blockDuration: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 1,
  },
  nowRow: {
    position: 'absolute',
    left: -4,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 20,
  },
  nowDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ff3b30',
  },
  nowBar: {
    flex: 1,
    height: 2,
    backgroundColor: '#ff3b30',
  },
});
