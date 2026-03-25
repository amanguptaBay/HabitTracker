import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface Props {
  isRunning: boolean;
  startedAt: string | null; // ISO timestamp of the current active run (null if stopped)
  totalSegmentMs: number;   // sum of all completed segments for today
  onToggle: () => void;
}

export default function TimerButton({ isRunning, startedAt, totalSegmentMs, onToggle }: Props) {
  // Tick every second only while running — Redux stays untouched
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  const runningMs =
    isRunning && startedAt ? Date.now() - new Date(startedAt).getTime() : 0;
  const totalMs = totalSegmentMs + runningMs;

  return (
    <Pressable
      onPress={onToggle}
      style={[styles.container, isRunning && styles.containerRunning]}
      hitSlop={8}
    >
      <Text style={[styles.icon, isRunning && styles.iconRunning]}>⏱</Text>
      {totalMs > 0 && (
        <Text style={[styles.time, isRunning && styles.timeRunning]}>
          {formatTime(totalMs)}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  containerRunning: {
    backgroundColor: '#e8f5e9',
    borderColor: '#4CAF50',
  },
  icon: {
    fontSize: 13,
  },
  iconRunning: {
    // no change — emoji colour is fine
  },
  time: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
    fontVariant: ['tabular-nums'],
  },
  timeRunning: {
    color: '#2E7D32',
  },
});
