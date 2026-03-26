import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useHabitData } from '../context/HabitDataContext';
import { Goal, Routine } from '../types';
import GoalCard from '../components/GoalCard';
import RoutineCard from '../components/RoutineCard';
import { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

/** Parse a YYYY-MM-DD string into a local-midnight Date for the picker. */
function dateFromString(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Format a YYYY-MM-DD string for display. */
function formatViewingDate(s: string, isToday: boolean): string {
  const d = dateFromString(s);
  if (isToday) return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

/** Shift a YYYY-MM-DD string by ±1 day. */
function shiftDate(s: string, days: number): string {
  const d = dateFromString(s);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const {
    loading, logicalToday, viewingDate, setViewingDate,
    routines, goals, entries, timingSegments, activeTimers,
    setGoalStatus, startTimer, stopTimer,
  } = useHabitData();

  const [showPicker, setShowPicker] = useState(false);

  const isToday  = viewingDate === logicalToday;
  const isPast   = viewingDate < logicalToday;

  // ── Helpers ────────────────────────────────────────────────────────────────
  const getGoalsForRoutine = (routine: Routine): Goal[] =>
    routine.goalIds.map((id) => goals.find((g) => g.id === id)!).filter(Boolean);

  const getEntry = (goalId: string) =>
    entries.find((e) => e.goalId === goalId && e.date === viewingDate);

  // ── Goal timers ────────────────────────────────────────────────────────────
  const getActiveGoalTimer = (goalId: string) =>
    activeTimers.find((t) => t.targetId === goalId && t.targetType === 'goal') ?? null;

  const getGoalSegmentMs = (goalId: string) =>
    timingSegments
      .filter((s) => s.targetId === goalId && s.targetType === 'goal' && s.date === viewingDate)
      .reduce((sum, s) => sum + s.durationMs, 0);

  const handleGoalTimerToggle = (goalId: string) => {
    getActiveGoalTimer(goalId) ? stopTimer(goalId) : startTimer(goalId, 'goal');
  };

  // ── Routine timers ─────────────────────────────────────────────────────────
  const getActiveRoutineTimer = (routineId: string) =>
    activeTimers.find((t) => t.targetId === routineId && t.targetType === 'routine') ?? null;

  const getRoutineSegmentMs = (routineId: string) =>
    timingSegments
      .filter((s) => s.targetId === routineId && s.targetType === 'routine' && s.date === viewingDate)
      .reduce((sum, s) => sum + s.durationMs, 0);

  const handleRoutineTimerToggle = (routineId: string) => {
    getActiveRoutineTimer(routineId) ? stopTimer(routineId) : startTimer(routineId, 'routine');
  };

  // ── Routine completion ─────────────────────────────────────────────────────
  const getRoutineStatus = (routine: Routine): 'complete' | 'failed' | 'pending' => {
    const required = getGoalsForRoutine(routine).filter((g) => g.required);
    const statuses = required.map((g) => getEntry(g.id)?.completed ?? null);
    if (statuses.length === 0) return 'pending';
    if (statuses.every((s) => s === true)) return 'complete';
    if (statuses.some((s) => s === false)) return 'failed';
    return 'pending';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* ── Top bar: date label + Manage ──────────────────────────────────── */}
      <View style={styles.topBar}>
        <Text style={[styles.dateLabel, !isToday && styles.dateLabelPast]}>
          {formatViewingDate(viewingDate, isToday)}
        </Text>
        <Pressable onPress={() => navigation.navigate('Manage')} hitSlop={8}>
          <Text style={styles.manageBtn}>Manage</Text>
        </Pressable>
      </View>

      {/* ── Date navigation row ───────────────────────────────────────────── */}
      <View style={styles.navRow}>
        {/* Prev */}
        <Pressable
          style={styles.navArrow}
          onPress={() => setViewingDate(shiftDate(viewingDate, -1))}
          hitSlop={8}
        >
          <Text style={styles.navArrowText}>‹</Text>
        </Pressable>

        {/* Calendar picker button */}
        <Pressable style={styles.calBtn} onPress={() => setShowPicker(true)}>
          <Text style={styles.calIcon}>📅</Text>
          {!isToday && (
            <Pressable
              style={styles.todayPill}
              onPress={() => setViewingDate(logicalToday)}
              hitSlop={4}
            >
              <Text style={styles.todayPillText}>Today</Text>
            </Pressable>
          )}
        </Pressable>

        {/* Next */}
        <Pressable
          style={styles.navArrow}
          onPress={() => setViewingDate(shiftDate(viewingDate, 1))}
          hitSlop={8}
        >
          <Text style={styles.navArrowText}>›</Text>
        </Pressable>
      </View>

      {/* ── Date picker (iOS/Android modal, web inline) ───────────────────── */}
      {showPicker && (
        <DateTimePicker
          value={dateFromString(viewingDate)}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          onChange={(_, selected) => {
            if (Platform.OS !== 'ios') setShowPicker(false);
            if (selected) {
              setViewingDate(selected.toISOString().split('T')[0]);
            }
          }}
          onTouchCancel={() => setShowPicker(false)}
          // Close iOS picker when user taps outside by tracking Done
          {...(Platform.OS === 'ios' ? {
            style: styles.iosPicker,
          } : {})}
        />
      )}
      {showPicker && Platform.OS === 'ios' && (
        <Pressable style={styles.pickerDone} onPress={() => setShowPicker(false)}>
          <Text style={styles.pickerDoneText}>Done</Text>
        </Pressable>
      )}

      {/* ── Routines ──────────────────────────────────────────────────────── */}
      {routines.map((routine) => {
        const routineGoals = getGoalsForRoutine(routine);
        const status = getRoutineStatus(routine);
        return (
          <RoutineCard
            key={routine.id}
            routine={routine}
            status={status}
            isTimerRunning={!!getActiveRoutineTimer(routine.id)}
            timerStartedAt={getActiveRoutineTimer(routine.id)?.startedAt ?? null}
            totalTimerMs={getRoutineSegmentMs(routine.id)}
            onTimerToggle={() => handleRoutineTimerToggle(routine.id)}
          >
            {routineGoals.map((goal) => {
              const entry = getEntry(goal.id);
              return (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  completed={entry?.completed ?? null}
                  onDone={() => setGoalStatus(goal.id, goal.routineId, viewingDate, true)}
                  onFail={() => setGoalStatus(goal.id, goal.routineId, viewingDate, false)}
                  onClear={() => setGoalStatus(goal.id, goal.routineId, viewingDate, null)}
                  isTimerRunning={!!getActiveGoalTimer(goal.id)}
                  timerStartedAt={getActiveGoalTimer(goal.id)?.startedAt ?? null}
                  totalTimerMs={getGoalSegmentMs(goal.id)}
                  onTimerToggle={() => handleGoalTimerToggle(goal.id)}
                />
              );
            })}
          </RoutineCard>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 16,
    gap: 12,
    paddingTop: 60,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  dateLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    flex: 1,
  },
  dateLabelPast: {
    color: '#888',
  },
  manageBtn: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4CAF50',
  },

  // Nav row
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  navArrow: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navArrowText: {
    fontSize: 32,
    color: '#4CAF50',
    lineHeight: 38,
  },
  calBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  calIcon: {
    fontSize: 20,
  },
  todayPill: {
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  todayPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },

  // iOS date picker
  iosPicker: {
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  pickerDone: {
    alignSelf: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    marginTop: -8,
  },
  pickerDoneText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
