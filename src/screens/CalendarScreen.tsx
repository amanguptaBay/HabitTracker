/**
 * CalendarScreen
 *
 * Monthly heatmap showing time logged per day across all routines and habits.
 * Tap any day to jump to that day's HomeScreen view.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useHabitData } from '../context/HabitDataContext';
import { fetchMonthTimingSegments } from '../services/firestoreService';
import { TimingSegment } from '../types';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Calendar'>;

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (ms <= 0) return '';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  if (h > 0) return `${h}h${m > 0 ? ` ${m}m` : ''}`;
  if (m > 0) return `${m}m`;
  return `${totalSec}s`;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function pad(n: number) { return String(n).padStart(2, '0'); }

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate(); // month is 1-based
}

/** First day-of-week (0=Sun) for the 1st of the month */
function firstDow(year: number, month: number) {
  return new Date(year, month - 1, 1).getDay();
}

/**
 * Heatmap colour based on logged time.
 * Buckets: 0 / <15m / <30m / <60m / <2h / 2h+
 */
function heatColor(ms: number): string {
  if (ms <= 0)              return '#1c1c1e';
  if (ms < 15 * 60_000)    return '#0d3320';
  if (ms < 30 * 60_000)    return '#145228';
  if (ms < 60 * 60_000)    return '#1a6b33';
  if (ms < 120 * 60_000)   return '#22913f';
  return '#2ecc71';
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function CalendarScreen() {
  const navigation = useNavigation<Nav>();
  const { uid, logicalToday, settings, setViewingDate, routines, goals } = useHabitData();

  // Parse today for default month
  const [todayY, todayM] = logicalToday.split('-').map(Number);

  const [year, setYear]   = useState(todayY);
  const [month, setMonth] = useState(todayM); // 1-based

  const [segments, setSegments]   = useState<TimingSegment[]>([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState<string | null>(null); // YYYY-MM-DD

  // ── Fetch month data ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    fetchMonthTimingSegments(uid, year, month)
      .then(setSegments)
      .finally(() => setLoading(false));
  }, [uid, year, month]);

  // ── Aggregations ───────────────────────────────────────────────────────────

  /** Total ms logged per date string */
  const totalByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const seg of segments) {
      map.set(seg.date, (map.get(seg.date) ?? 0) + seg.totalMs);
    }
    return map;
  }, [segments]);

  /** Per-target breakdown for a given date */
  const breakdownForDate = useCallback((date: string) => {
    return segments
      .filter((s) => s.date === date)
      .map((s) => {
        const label =
          goals.find((g) => g.id === s.targetId)?.name ??
          routines.find((r) => r.id === s.targetId)?.name ??
          s.targetId;
        return { label, totalMs: s.totalMs, targetType: s.targetType };
      })
      .sort((a, b) => b.totalMs - a.totalMs);
  }, [segments, goals, routines]);

  // ── Month navigation ───────────────────────────────────────────────────────
  const prevMonth = () => {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
    setSelected(null);
  };
  const nextMonth = () => {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
    setSelected(null);
  };

  // ── Calendar grid ──────────────────────────────────────────────────────────
  const numDays  = daysInMonth(year, month);
  const startDow = firstDow(year, month);

  // Pad the front with nulls so day 1 lands on the right column
  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: numDays }, (_, i) => i + 1),
  ];
  // Pad the end to complete the last row
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  // ── Tap handler ───────────────────────────────────────────────────────────
  const handleDayPress = (day: number) => {
    const dateStr = `${year}-${pad(month)}-${pad(day)}`;
    setSelected(dateStr === selected ? null : dateStr);
  };

  const goToDay = (dateStr: string) => {
    setViewingDate(dateStr);
    navigation.navigate('Home');
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const selectedBreakdown = selected ? breakdownForDate(selected) : [];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={prevMonth} style={styles.arrow} hitSlop={12}>
          <Text style={styles.arrowText}>‹</Text>
        </Pressable>
        <Text style={styles.monthTitle}>
          {MONTH_NAMES[month - 1]} {year}
        </Text>
        <Pressable onPress={nextMonth} style={styles.arrow} hitSlop={12}>
          <Text style={styles.arrowText}>›</Text>
        </Pressable>
      </View>

      {/* Day-of-week labels */}
      <View style={styles.dowRow}>
        {DAY_LABELS.map((d) => (
          <Text key={d} style={styles.dowLabel}>{d}</Text>
        ))}
      </View>

      {/* Grid */}
      {loading ? (
        <ActivityIndicator color="#4CAF50" style={{ marginTop: 40 }} />
      ) : (
        <View style={styles.grid}>
          {rows.map((row, ri) => (
            <View key={ri} style={styles.row}>
              {row.map((day, ci) => {
                if (!day) return <View key={ci} style={styles.cell} />;
                const dateStr = `${year}-${pad(month)}-${pad(day)}`;
                const total   = totalByDate.get(dateStr) ?? 0;
                const isToday = dateStr === logicalToday;
                const isSel   = dateStr === selected;

                return (
                  <Pressable
                    key={ci}
                    style={[
                      styles.cell,
                      { backgroundColor: heatColor(total) },
                      isToday && styles.cellToday,
                      isSel   && styles.cellSelected,
                    ]}
                    onPress={() => handleDayPress(day)}
                  >
                    <Text style={[styles.dayNum, isToday && styles.dayNumToday]}>
                      {day}
                    </Text>
                    {total > 0 && (
                      <Text style={styles.dayTime}>{formatDuration(total)}</Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      )}

      {/* Selected day breakdown */}
      {selected && (
        <ScrollView style={styles.breakdown} contentContainerStyle={styles.breakdownContent}>
          <View style={styles.breakdownHeader}>
            <Text style={styles.breakdownDate}>
              {new Date(selected + 'T12:00:00').toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric',
              })}
            </Text>
            <Pressable style={styles.openDayBtn} onPress={() => goToDay(selected)}>
              <Text style={styles.openDayText}>Open Day →</Text>
            </Pressable>
          </View>

          {selectedBreakdown.length === 0 ? (
            <Text style={styles.emptyBreakdown}>No time logged</Text>
          ) : (
            selectedBreakdown.map(({ label, totalMs, targetType }) => (
              <View key={label} style={styles.breakdownRow}>
                <View style={styles.breakdownLeft}>
                  <Text style={styles.breakdownType}>
                    {targetType === 'routine' ? '📋' : '✓'}
                  </Text>
                  <Text style={styles.breakdownLabel} numberOfLines={1}>{label}</Text>
                </View>
                <Text style={styles.breakdownTime}>{formatDuration(totalMs)}</Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const CELL_SIZE = 46;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  arrow: {
    width: 36,
    alignItems: 'center',
  },
  arrowText: {
    fontSize: 28,
    color: '#fff',
    fontWeight: '300',
  },
  monthTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  dowRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  dowLabel: {
    width: CELL_SIZE,
    textAlign: 'center',
    fontSize: 11,
    color: '#888',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  grid: {
    paddingHorizontal: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 4,
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1c1c1e',
  },
  cellToday: {
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  cellSelected: {
    borderWidth: 2,
    borderColor: '#fff',
  },
  dayNum: {
    fontSize: 13,
    fontWeight: '600',
    color: '#e0e0e0',
  },
  dayNumToday: {
    color: '#4CAF50',
  },
  dayTime: {
    fontSize: 8,
    color: '#a0ffa0',
    marginTop: 1,
    fontWeight: '600',
  },

  // Breakdown panel
  breakdown: {
    marginTop: 12,
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2e',
  },
  breakdownContent: {
    padding: 16,
  },
  breakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  breakdownDate: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  openDayBtn: {
    backgroundColor: '#1a4a1a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  openDayText: {
    color: '#4CAF50',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyBreakdown: {
    color: '#555',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e22',
  },
  breakdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  breakdownType: {
    fontSize: 14,
    marginRight: 8,
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#ddd',
    flex: 1,
  },
  breakdownTime: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4CAF50',
  },
});
