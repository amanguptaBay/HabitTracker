import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAppSelector, useAppDispatch } from '../store';
import { setGoalStatus, startTimer, stopTimer } from '../store/slices/routinesSlice';
import { Goal, Routine } from '../types';
import GoalCard from '../components/GoalCard';
import RoutineCard from '../components/RoutineCard';
import { RootStackParamList } from '../navigation/types';

const today = new Date().toISOString().split('T')[0];

type Nav = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export default function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const { routines, goals, entries, timingSegments, activeTimers } = useAppSelector(
    (state) => state.routines
  );

  const getGoalsForRoutine = (routine: Routine): Goal[] =>
    routine.goalIds.map((id) => goals.find((g) => g.id === id)!).filter(Boolean);

  const getEntry = (goalId: string) =>
    entries.find((e) => e.goalId === goalId && e.date === today);

  const getActiveTimer = (goalId: string) =>
    activeTimers.find((t) => t.targetId === goalId && t.targetType === 'goal') ?? null;

  const getTotalSegmentMs = (goalId: string) =>
    timingSegments
      .filter((s) => s.targetId === goalId && s.targetType === 'goal' && s.date === today)
      .reduce((sum, s) => sum + s.durationMs, 0);

  const handleTimerToggle = (goalId: string) => {
    const active = getActiveTimer(goalId);
    if (active) {
      dispatch(stopTimer({ targetId: goalId }));
    } else {
      dispatch(startTimer({ targetId: goalId, targetType: 'goal' }));
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.date}>{formattedDate}</Text>
        <Pressable onPress={() => navigation.navigate('Manage')} hitSlop={8}>
          <Text style={styles.manageBtn}>Manage</Text>
        </Pressable>
      </View>

      {routines
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((routine) => {
          const routineGoals = getGoalsForRoutine(routine);
          const status = getRoutineStatus(routine);
          return (
            <RoutineCard key={routine.id} routine={routine} status={status}>
              {routineGoals.map((goal) => {
                const entry = getEntry(goal.id);
                return (
                  <GoalCard
                    key={goal.id}
                    goal={goal}
                    completed={entry?.completed ?? null}
                    onDone={() => dispatch(setGoalStatus({ goalId: goal.id, date: today, status: true }))}
                    onFail={() => dispatch(setGoalStatus({ goalId: goal.id, date: today, status: false }))}
                    onClear={() => dispatch(setGoalStatus({ goalId: goal.id, date: today, status: null }))}
                    isTimerRunning={!!getActiveTimer(goal.id)}
                    timerStartedAt={getActiveTimer(goal.id)?.startedAt ?? null}
                    totalTimerMs={getTotalSegmentMs(goal.id)}
                    onTimerToggle={() => handleTimerToggle(goal.id)}
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
});
