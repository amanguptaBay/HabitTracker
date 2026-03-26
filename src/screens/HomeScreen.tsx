import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useHabitData } from '../context/HabitDataContext';
import { Goal, Routine } from '../types';
import GoalCard from '../components/GoalCard';
import RoutineCard from '../components/RoutineCard';
import { RootStackParamList } from '../navigation/types';

const today = new Date().toISOString().split('T')[0];

type Nav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const {
    loading,
    routines, goals, entries, timingSegments, activeTimers,
    setGoalStatus,
    startTimer, stopTimer,
  } = useHabitData();

  const getGoalsForRoutine = (routine: Routine): Goal[] =>
    routine.goalIds.map((id) => goals.find((g) => g.id === id)!).filter(Boolean);

  const getEntry = (goalId: string) =>
    entries.find((e) => e.goalId === goalId && e.date === today);

  // ── Goal timers ──────────────────────────────────────────────────────────
  const getActiveGoalTimer = (goalId: string) =>
    activeTimers.find((t) => t.targetId === goalId && t.targetType === 'goal') ?? null;

  const getGoalSegmentMs = (goalId: string) =>
    timingSegments
      .filter((s) => s.targetId === goalId && s.targetType === 'goal' && s.date === today)
      .reduce((sum, s) => sum + s.durationMs, 0);

  const handleGoalTimerToggle = (goalId: string) => {
    if (getActiveGoalTimer(goalId)) {
      stopTimer(goalId);
    } else {
      startTimer(goalId, 'goal');
    }
  };

  // ── Routine timers ───────────────────────────────────────────────────────
  const getActiveRoutineTimer = (routineId: string) =>
    activeTimers.find((t) => t.targetId === routineId && t.targetType === 'routine') ?? null;

  const getRoutineSegmentMs = (routineId: string) =>
    timingSegments
      .filter((s) => s.targetId === routineId && s.targetType === 'routine' && s.date === today)
      .reduce((sum, s) => sum + s.durationMs, 0);

  const handleRoutineTimerToggle = (routineId: string) => {
    if (getActiveRoutineTimer(routineId)) {
      stopTimer(routineId);
    } else {
      startTimer(routineId, 'routine');
    }
  };

  const getRoutineStatus = (routine: Routine): 'complete' | 'failed' | 'pending' => {
    const required = getGoalsForRoutine(routine).filter((g) => g.required);
    const statuses = required.map((g) => getEntry(g.id)?.completed ?? null);
    if (statuses.length === 0) return 'pending';
    if (statuses.every((s) => s === true)) return 'complete';
    if (statuses.some((s) => s === false)) return 'failed';
    return 'pending';
  };

  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.date}>{formattedDate}</Text>
        <Pressable onPress={() => navigation.navigate('Manage')} hitSlop={8}>
          <Text style={styles.manageBtn}>Manage</Text>
        </Pressable>
      </View>

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
                  onDone={() => setGoalStatus(goal.id, goal.routineId, today, true)}
                  onFail={() => setGoalStatus(goal.id, goal.routineId, today, false)}
                  onClear={() => setGoalStatus(goal.id, goal.routineId, today, null)}
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
    gap: 16,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  date: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    flex: 1,
  },
  manageBtn: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4CAF50',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
});
