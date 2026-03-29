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
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import { ActiveTimer, Goal, Routine, TimingRun, TimingSegment } from '../types';
import { useHabitData } from '../context/HabitDataContext';

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

const BASE_HOUR_H = 64;          // default pixels per hour
const MIN_HOUR_H  = 16;          // fully zoomed out  (~26 h visible at once)
const MAX_HOUR_H  = 720;         // fully zoomed in   (~5 min visible at once)
const GUTTER      = 52;
const TIMELINE_W_FALLBACK = 320;

// ─── Adaptive grid helpers ────────────────────────────────────────────────────

/**
 * How many minutes between each grid line at this zoom level.
 * Chosen so lines are never denser than ~4 px apart.
 */
function tickMins(hourH: number): number {
  const pxPerMin = hourH / 60;
  if (pxPerMin >= 8)  return 1;
  if (pxPerMin >= 2)  return 5;
  if (pxPerMin >= 1)  return 15;
  if (pxPerMin >= 0.5) return 30;
  return 60;
}

/**
 * How many minutes between visible time labels.
 * Chosen so labels are never closer than ~28 px.
 */
function labelMins(hourH: number): number {
  if (hourH >= 480) return 10;
  if (hourH >= 200) return 15;
  if (hourH >= 100) return 30;
  if (hourH >= 48)  return 60;
  if (hourH >= 24)  return 120;
  return 240;
}

/** Format total-minutes offset since midnight as a clock string. */
function fmtMinOffset(totalMins: number): string {
  const h = Math.floor(totalMins / 60) % 24;
  const m = totalMins % 60;
  if (m === 0) {
    const ampm = h < 12 ? 'am' : 'pm';
    const h12  = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}${ampm}`;
  }
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

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

/** Position a UTC ISO string on the day grid given the midnight anchor and hourH. */
function isoToY(iso: string, midnight: number, hourH: number): number {
  const elapsedMs   = new Date(iso).getTime() - midnight;
  const elapsedMins = Math.max(0, elapsedMs / 60_000);
  return (elapsedMins / 60) * hourH;
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

/** HH:MM:SS for the modal duration display */
function fmtDurationHMS(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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
  targetId:   string;
  color:      string;
  topY:       number;
  heightPx:   number;
  durationMs: number;
  timeLabel:  string;
  endTimeLabel: string;
  isLive:      boolean;
  isGhost:     boolean;
  isCrossDay:  boolean;  // chunk from an overnight timer — started at midnight
  // For deletion — null on live blocks
  run:        TimingRun | null;
  runDate:    string;
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

// ─── Edit-time helpers ────────────────────────────────────────────────────────

/** Convert a UTC ISO string to "HH:MM" in the user's timezone, given midnight UTC ms. */
function isoToHHMM(iso: string, midnight: number): string {
  const elapsedMins = Math.round((new Date(iso).getTime() - midnight) / 60_000);
  const clamped = Math.max(0, Math.min(24 * 60 - 1, elapsedMins));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Parse "HH:MM" offset-since-midnight back to a UTC ISO string.
 * Returns null if the format is invalid.
 */
function hhmmToIso(hhmm: string, midnight: number): string | null {
  const match = hhmm.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h > 23 || m > 59) return null;
  return new Date(midnight + (h * 60 + m) * 60_000).toISOString();
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
  const { deleteRun, updateRun } = useHabitData();
  const [selectedBlock, setSelectedBlock] = useState<LayoutBlock | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editStart, setEditStart] = useState('');   // "HH:MM"
  const [editEnd,   setEditEnd]   = useState('');   // "HH:MM"
  const [editError, setEditError] = useState<string | null>(null);
  const [saving,    setSaving]    = useState(false);

  const scrollRef  = useRef<ScrollView>(null);
  const [timelineW, setTimelineW] = useState(TIMELINE_W_FALLBACK);
  const onTimelineLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number } } }) =>
      setTimelineW(e.nativeEvent.layout.width),
    [],
  );

  // ── Zoom state ─────────────────────────────────────────────────────────────
  const [hourH, setHourHState] = useState(BASE_HOUR_H);
  const hourHRef    = useRef(BASE_HOUR_H);   // sync access from gesture handler
  const scrollYRef  = useRef(0);             // current scroll offset (manual tracking)
  const pinchBaseH  = useSharedValue(BASE_HOUR_H); // hourH at gesture start (UI thread)

  // Keep pinchBaseH in sync so the next gesture starts from the right value
  useEffect(() => { pinchBaseH.value = hourH; }, [hourH, pinchBaseH]);

  const applyZoom = useCallback((newH: number, focalY: number) => {
    const oldH      = hourHRef.current;
    const timeMins  = (scrollYRef.current + focalY) * 60 / oldH;
    const newScroll = Math.max(0, timeMins * newH / 60 - focalY);
    hourHRef.current  = newH;
    scrollYRef.current = newScroll;
    setHourHState(newH);
    scrollRef.current?.scrollTo({ y: newScroll, animated: false });
  }, []);

  const pinchGesture = Gesture.Pinch()
    .onStart(() => { pinchBaseH.value = hourHRef.current; })
    .onUpdate((e) => {
      const clamped = Math.min(MAX_HOUR_H, Math.max(MIN_HOUR_H,
        Math.round(pinchBaseH.value * e.scale)));
      runOnJS(applyZoom)(clamped, e.focalY);
    });

  // ── Web: Ctrl/Cmd + scroll wheel zoom (also fires from trackpad pinch on web) ──
  const containerRef = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = containerRef.current as unknown as HTMLElement | null;
    if (!node) return;

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault(); // stop browser from zooming the page
      // deltaY > 0 → zoom out, < 0 → zoom in
      const factor   = e.deltaY > 0 ? 0.85 : 1 / 0.85;
      const newH     = Math.min(MAX_HOUR_H, Math.max(MIN_HOUR_H, Math.round(hourHRef.current * factor)));
      const rect     = node.getBoundingClientRect();
      applyZoom(newH, e.clientY - rect.top);
    };

    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [applyZoom]);

  // Derived layout values
  const totalH   = hourH * 24;
  const minsToY  = (m: number) => (m / 60) * hourH;
  const tick     = tickMins(hourH);
  const lblStep  = labelMins(hourH);
  const tickCount = Math.floor(24 * 60 / tick);
  const lblCount  = Math.floor(24 * 60 / lblStep);

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

  // ── Edit handlers (must come after midnight) ──────────────────────────────
  const openEdit = useCallback((block: LayoutBlock) => {
    setEditStart(isoToHHMM(block.run!.startTime, midnight));
    setEditEnd(isoToHHMM(block.run!.endTime, midnight));
    setEditError(null);
    setEditing(true);
  }, [midnight]);

  const saveEdit = useCallback(async () => {
    if (!selectedBlock?.run) return;
    const newStartIso = hhmmToIso(editStart, midnight);
    const newEndIso   = hhmmToIso(editEnd,   midnight);
    if (!newStartIso) { setEditError('Invalid start time — use HH:MM'); return; }
    if (!newEndIso)   { setEditError('Invalid end time — use HH:MM');   return; }
    const newDurationMs = new Date(newEndIso).getTime() - new Date(newStartIso).getTime();
    if (newDurationMs <= 0) { setEditError('End time must be after start time'); return; }
    setSaving(true);
    setEditError(null);
    try {
      const newRun = { startTime: newStartIso, endTime: newEndIso, durationMs: newDurationMs };
      await updateRun(selectedBlock.runDate, selectedBlock.targetId, selectedBlock.run, newRun);
      setEditing(false);
      setSelectedBlock(null);
    } catch (e) {
      setEditError('Save failed — check console');
      console.error('[DayTimeline] saveEdit error:', e);
    } finally {
      setSaving(false);
    }
  }, [selectedBlock, editStart, editEnd, midnight, updateRun]);

  // ── Build blocks ──────────────────────────────────────────────────────────

  const labelFor = (id: string) =>
    goals.find((g) => g.id === id)?.name ??
    routines.find((r) => r.id === id)?.name ??
    id;

  const minBlockH = Math.max(4, hourH / 16); // min block height scales with zoom

  const completedBlocks: Block[] = timingSegments.flatMap((seg) =>
    (seg.segments ?? []).map((run, i) => {
      const naturalH   = (run.durationMs / 3_600_000) * hourH;
      const heightPx   = Math.max(minBlockH, naturalH);
      // Within 2 s of midnight → this is the tail of an overnight split
      const isCrossDay = new Date(run.startTime).getTime() - midnight < 2_000;
      return {
        id:           `${seg.targetId}-${i}`,
        label:        labelFor(seg.targetId),
        targetId:     seg.targetId,
        color:        blockColor(seg.targetId),
        topY:         isoToY(run.startTime, midnight, hourH),
        heightPx,
        durationMs:   run.durationMs,
        timeLabel:    fmtLocalTime(run.startTime, midnight, timezone),
        endTimeLabel: fmtLocalTime(run.endTime,   midnight, timezone),
        isLive:       false,
        isGhost:      naturalH < minBlockH,
        isCrossDay,
        run,
        runDate:      seg.date,
      };
    })
  );

  const liveBlocks: Block[] = activeTimers.map((t) => {
    const durationMs = nowMs - new Date(t.startedAt).getTime();
    const naturalH   = (durationMs / 3_600_000) * hourH;
    const heightPx   = Math.max(minBlockH, naturalH);
    return {
      id:           `live-${t.targetId}`,
      label:        labelFor(t.targetId),
      targetId:     t.targetId,
      color:        blockColor(t.targetId),
      topY:         isoToY(t.startedAt, midnight, hourH),
      heightPx,
      durationMs,
      timeLabel:    fmtLocalTime(t.startedAt, midnight, timezone),
      endTimeLabel: 'now',
      isLive:       true,
      isGhost:      naturalH < minBlockH,
      isCrossDay:   false,
      run:          null,
      runDate:      viewingDate,
    };
  });

  const allBlocks: LayoutBlock[] = assignColumns([...completedBlocks, ...liveBlocks]);


  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
    <GestureDetector gesture={pinchGesture}>
    <View ref={containerRef} style={styles.outerContainer}>
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
      showsVerticalScrollIndicator={false}
      onScroll={(e) => { scrollYRef.current = e.nativeEvent.contentOffset.y; }}
      scrollEventThrottle={16}
    >
      {/* Single View — height drives scroll; row lays out gutter + timeline */}
      <View style={[styles.dayView, { height: totalH }]}>

        {/* Adaptive time labels in gutter */}
        <View style={styles.gutter}>
          {Array.from({ length: lblCount + 1 }, (_, i) => {
            const mins = i * lblStep;
            if (mins > 24 * 60) return null;
            return (
              <View key={mins} style={[styles.hourLabelRow, { top: minsToY(mins) - 7 }]}>
                <Text style={styles.hourText}>{fmtMinOffset(mins)}</Text>
              </View>
            );
          })}
        </View>

        {/* Timeline */}
        <View style={[styles.timeline, { height: totalH }]} onLayout={onTimelineLayout}>

          {/* Adaptive grid lines */}
          {Array.from({ length: tickCount + 1 }, (_, i) => {
            const mins = i * tick;
            if (mins > 24 * 60) return null;
            const isHour = mins % 60 === 0;
            return (
              <View
                key={mins}
                style={[
                  isHour ? styles.hourLine : styles.tickLine,
                  { top: minsToY(mins) },
                ]}
              />
            );
          })}

          {/* Blocks */}
          {allBlocks.map((block) => {
            const GAP        = 2;
            const totalGap   = GAP * (block.numCols - 1);
            const colW       = (timelineW - 8 - totalGap) / block.numCols;
            const blockLeft  = 4 + block.col * (colW + GAP);
            const blockRight = 4 + (block.numCols - block.col - 1) * (colW + GAP);
            return (
              <Pressable
                key={block.id}
                onPress={() => setSelectedBlock(block)}
                style={[
                  styles.block,
                  {
                    top:             block.topY + 1,
                    height:          block.heightPx - 2,
                    left:            blockLeft,
                    right:           blockRight,
                    backgroundColor: block.color,
                    opacity:         block.isGhost ? 0.35 : 1,
                  },
                  block.isLive && styles.blockLive,
                  block.isGhost && styles.blockGhost,
                ]}
              >
                <Text style={styles.blockName} numberOfLines={1}>
                  {block.isLive ? '▶ ' : ''}{block.isCrossDay ? '↩ ' : ''}{block.label}
                </Text>
                {block.heightPx >= 44 && (
                  <Text style={styles.blockMeta} numberOfLines={1}>
                    {block.timeLabel} · {fmtDuration(block.durationMs)}
                  </Text>
                )}
              </Pressable>
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
    </View>
    </GestureDetector>

    {/* Block detail modal */}
    <Modal
      visible={selectedBlock !== null}
      transparent
      animationType="fade"
      onRequestClose={() => { setSelectedBlock(null); setConfirmingDelete(false); setEditing(false); }}
    >
      <Pressable
        style={styles.modalBackdrop}
        onPress={() => { setSelectedBlock(null); setConfirmingDelete(false); setEditing(false); }}
      >
        <Pressable style={styles.modalCard} onPress={() => {}}>
          {selectedBlock && (
            <>
              {/* Colour stripe */}
              <View style={[styles.modalStripe, { backgroundColor: selectedBlock.color }]} />

              <View style={styles.modalBody}>
                {/* ID + name always visible */}
                <Text style={styles.modalId}>{selectedBlock.targetId}</Text>
                <Text style={styles.modalName}>{selectedBlock.label}</Text>

                {editing ? (
                  /* ── Edit mode ── */
                  <>
                    <Text style={styles.editLabel}>Start time (HH:MM)</Text>
                    <TextInput
                      style={styles.editInput}
                      value={editStart}
                      onChangeText={setEditStart}
                      placeholder="e.g. 08:30"
                      autoCapitalize="none"
                      keyboardType="numbers-and-punctuation"
                    />
                    <Text style={styles.editLabel}>End time (HH:MM)</Text>
                    <TextInput
                      style={styles.editInput}
                      value={editEnd}
                      onChangeText={setEditEnd}
                      placeholder="e.g. 09:15"
                      autoCapitalize="none"
                      keyboardType="numbers-and-punctuation"
                    />
                    {editError && <Text style={styles.editError}>{editError}</Text>}

                    <View style={styles.confirmBtns}>
                      <Pressable
                        style={styles.confirmCancel}
                        onPress={() => { setEditing(false); setEditError(null); }}
                      >
                        <Text style={styles.confirmCancelText}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        style={[styles.confirmDelete, { backgroundColor: '#1565c0' }]}
                        onPress={saveEdit}
                        disabled={saving}
                      >
                        <Text style={styles.confirmDeleteText}>
                          {saving ? 'Saving…' : 'Save'}
                        </Text>
                      </Pressable>
                    </View>
                  </>
                ) : (
                  /* ── View mode ── */
                  <>
                    {/* Duration */}
                    <Text style={styles.modalDuration}>
                      {fmtDurationHMS(selectedBlock.durationMs)}
                    </Text>

                    {/* Meta */}
                    <View style={styles.modalMeta}>
                      <Text style={styles.modalMetaText}>Start  {selectedBlock.timeLabel}</Text>
                      <Text style={styles.modalMetaText}>End    {selectedBlock.endTimeLabel}</Text>
                      <Text style={styles.modalMetaText}>Date   {selectedBlock.runDate}</Text>
                      {selectedBlock.isLive && (
                        <Text style={[styles.modalMetaText, { color: '#2e7d32' }]}>▶ Running</Text>
                      )}
                      {selectedBlock.isGhost && (
                        <Text style={[styles.modalMetaText, { color: '#9e9e9e' }]}>
                          Short run (inflated for visibility)
                        </Text>
                      )}
                      {selectedBlock.isCrossDay && (
                        <Text style={[styles.modalMetaText, { color: '#1565c0' }]}>
                          ↩ Continued from previous day
                        </Text>
                      )}
                    </View>

                    {/* Edit button — completed runs only */}
                    {!selectedBlock.isLive && selectedBlock.run && (
                      <Pressable
                        style={styles.editBtn}
                        onPress={() => openEdit(selectedBlock)}
                      >
                        <Text style={styles.editBtnText}>Edit start / end time</Text>
                      </Pressable>
                    )}

                    {/* Delete */}
                    {!selectedBlock.isLive && selectedBlock.run && (
                      confirmingDelete ? (
                        <View style={styles.confirmRow}>
                          <Text style={styles.confirmText}>Remove this run?</Text>
                          <View style={styles.confirmBtns}>
                            <Pressable
                              style={styles.confirmCancel}
                              onPress={() => setConfirmingDelete(false)}
                            >
                              <Text style={styles.confirmCancelText}>Cancel</Text>
                            </Pressable>
                            <Pressable
                              style={styles.confirmDelete}
                              onPress={async () => {
                                try {
                                  await deleteRun(selectedBlock.runDate, selectedBlock.targetId, selectedBlock.run!);
                                  setConfirmingDelete(false);
                                  setSelectedBlock(null);
                                } catch (e) {
                                  console.error('[DayTimeline] deleteRun threw:', e);
                                }
                              }}
                            >
                              <Text style={styles.confirmDeleteText}>Delete</Text>
                            </Pressable>
                          </View>
                        </View>
                      ) : (
                        <Pressable
                          style={styles.deleteBtn}
                          onPress={() => setConfirmingDelete(true)}
                        >
                          <Text style={styles.deleteBtnText}>Delete this run</Text>
                        </Pressable>
                      )
                    )}

                    <Pressable
                      style={styles.closeBtn}
                      onPress={() => { setSelectedBlock(null); setConfirmingDelete(false); }}
                    >
                      <Text style={styles.closeBtnText}>Close</Text>
                    </Pressable>
                  </>
                )}
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
  },
  scroll: {
    flex:            1,
    backgroundColor: '#ffffff',
  },
  dayView: {
    // height is set inline (totalH = hourH * 24, changes with zoom)
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
    // height set inline
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
    backgroundColor: '#d0d0d0',
  },
  tickLine: {
    position:        'absolute',
    left:            0,
    right:           0,
    height:          StyleSheet.hairlineWidth,
    backgroundColor: '#ebebeb',
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
  blockGhost: {
    borderWidth:  1,
    borderStyle:  'dashed',
    borderColor:  'rgba(0,0,0,0.25)',
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

  // Modal
  modalBackdrop: {
    flex:            1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent:  'center',
    alignItems:      'center',
    padding:         24,
  },
  modalCard: {
    width:           '100%',
    maxWidth:        400,
    backgroundColor: '#fff',
    borderRadius:    16,
    overflow:        'hidden',
    shadowColor:     '#000',
    shadowOpacity:   0.2,
    shadowRadius:    12,
    shadowOffset:    { width: 0, height: 4 },
    elevation:       8,
  },
  modalStripe: {
    height: 6,
  },
  modalBody: {
    padding: 20,
  },
  modalId: {
    fontSize:    11,
    color:       '#9e9e9e',
    fontFamily:  'monospace',
    marginBottom: 4,
  },
  modalName: {
    fontSize:     22,
    fontWeight:   '700',
    color:        '#212121',
    marginBottom: 6,
  },
  modalDuration: {
    fontSize:     32,
    fontWeight:   '300',
    color:        '#212121',
    letterSpacing: 1,
    marginBottom:  16,
    fontVariant:  ['tabular-nums'],
  },
  modalMeta: {
    gap:          6,
    marginBottom: 20,
  },
  modalMetaText: {
    fontSize: 13,
    color:    '#616161',
  },
  editBtn: {
    backgroundColor: '#e3f2fd',
    borderRadius:    10,
    paddingVertical: 12,
    alignItems:      'center',
    marginBottom:    10,
  },
  editBtnText: {
    fontSize:   14,
    fontWeight: '600',
    color:      '#1565c0',
  },
  editLabel: {
    fontSize:     12,
    color:        '#616161',
    marginBottom: 4,
    marginTop:    12,
  },
  editInput: {
    borderWidth:   1,
    borderColor:   '#e0e0e0',
    borderRadius:  8,
    paddingVertical:  10,
    paddingHorizontal: 12,
    fontSize:      16,
    color:         '#212121',
    backgroundColor: '#fafafa',
    fontVariant:   ['tabular-nums'],
  },
  editError: {
    fontSize:   12,
    color:      '#c62828',
    marginTop:  8,
    textAlign:  'center',
  },
  deleteBtn: {
    backgroundColor: '#ffebee',
    borderRadius:    10,
    paddingVertical: 12,
    alignItems:      'center',
    marginBottom:    10,
  },
  deleteBtnText: {
    fontSize:   14,
    fontWeight: '600',
    color:      '#c62828',
  },
  confirmRow: {
    marginBottom: 10,
  },
  confirmText: {
    fontSize:     13,
    color:        '#c62828',
    marginBottom: 8,
    textAlign:    'center',
  },
  confirmBtns: {
    flexDirection: 'row',
    gap:           8,
  },
  confirmCancel: {
    flex:            1,
    backgroundColor: '#f5f5f5',
    borderRadius:    10,
    paddingVertical: 11,
    alignItems:      'center',
  },
  confirmCancelText: {
    fontSize:   14,
    fontWeight: '500',
    color:      '#424242',
  },
  confirmDelete: {
    flex:            1,
    backgroundColor: '#c62828',
    borderRadius:    10,
    paddingVertical: 11,
    alignItems:      'center',
  },
  confirmDeleteText: {
    fontSize:   14,
    fontWeight: '600',
    color:      '#fff',
  },
  closeBtn: {
    backgroundColor: '#f5f5f5',
    borderRadius:    10,
    paddingVertical: 12,
    alignItems:      'center',
  },
  closeBtnText: {
    fontSize:   14,
    fontWeight: '500',
    color:      '#424242',
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
