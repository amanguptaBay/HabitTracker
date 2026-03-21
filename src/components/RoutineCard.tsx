import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Routine } from '../types';

interface Props {
  routine: Routine;
  status: 'complete' | 'failed' | 'pending';
  children: React.ReactNode;
}

const STATUS_BADGE = {
  complete: '✅',
  failed: '❌',
  pending: '⏳',
};

export default function RoutineCard({ routine, status, children }: Props) {
  return (
    <View style={[styles.card, status === 'failed' && styles.cardFailed]}>
      <View style={styles.header}>
        <Text style={styles.name}>{routine.name}</Text>
        <Text style={styles.badge}>{STATUS_BADGE[status]}</Text>
      </View>
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
  },
  cardFailed: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF5252',
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
  },
  badge: {
    fontSize: 20,
  },
  goals: {
    gap: 8,
  },
});
