import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Routine } from '../types';
import TimerButton from './TimerButton';

interface Props {
  routine: Routine;
  status: 'complete' | 'failed' | 'pending';
  children: React.ReactNode;
  // Timer
  isTimerRunning: boolean;
  timerStartedAt: string | null;
  totalTimerMs: number;
  onTimerToggle: () => void;
}

const STATUS_BADGE: Record<string, string> = {
  complete: '✅',
  failed:   '❌',
  pending:  '⏳',
};

export default function RoutineCard({
  routine,
  status,
  children,
  isTimerRunning,
  timerStartedAt,
  totalTimerMs,
  onTimerToggle,
}: Props) {
  return (
    <View
      style={[
        styles.card,
        status === 'failed'   && styles.cardFailed,
        isTimerRunning        && styles.cardTiming,
      ]}
    >
      <View style={styles.header}>
        {/* Name */}
        <Text style={styles.name}>{routine.name}</Text>

        {/* Timer + status badge grouped on the right */}
        <View style={styles.right}>
          <TimerButton
            isRunning={isTimerRunning}
            startedAt={timerStartedAt}
            totalSegmentMs={totalTimerMs}
            onToggle={onTimerToggle}
          />
          <Text style={styles.badge}>{STATUS_BADGE[status]}</Text>
        </View>
      </View>

      {/* Habits */}
      <View style={styles.goals}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: 'transparent',
  },
  cardFailed: {
    borderLeftColor: '#FF5252',
  },
  cardTiming: {
    borderLeftColor: '#4CAF50',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    flex: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  badge: {
    fontSize: 20,
  },
  goals: {
    gap: 8,
  },
});
