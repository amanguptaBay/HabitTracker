import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native';
import { useAppSelector, useAppDispatch } from '../store';
import { setGoalStatus } from '../store/slices/routinesSlice';
import { Goal, Routine } from '../types';
import GoalCard from '../components/GoalCard';
import RoutineCard from '../components/RoutineCard';

const today = new Date().toISOString().split('T')[0];

export default function HomeScreen() {
  const dispatch = useAppDispatch();
  const { routines, goals, entries } = useAppSelector((state) => state.routines);

  const getGoalsForRoutine = (routine: Routine): Goal[] =>
    routine.goalIds.map((id) => goals.find((g) => g.id === id)!).filter(Boolean);

  const getEntry = (goalId: string) =>
    entries.find((e) => e.goalId === goalId && e.date === today);

  // Complete = all required goals explicitly done (true)
  // Failed = any required goal explicitly failed (false)
  // Pending = at least one required goal has no response (null)
  const getRoutineStatus = (routine: Routine): 'complete' | 'failed' | 'pending' => {
    const required = getGoalsForRoutine(routine).filter((g) => g.required);
    const statuses = required.map((g) => getEntry(g.id)?.completed ?? null);
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
      <Text style={styles.date}>{formattedDate}</Text>
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
  },
  date: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
});
