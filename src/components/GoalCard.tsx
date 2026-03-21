import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Goal } from '../types';
import TriStateSlider from './TriStateSlider';

interface Props {
  goal: Goal;
  completed: boolean | null;
  onDone: () => void;
  onFail: () => void;
  onClear: () => void;
}

export default function GoalCard({ goal, completed, onDone, onFail, onClear }: Props) {
  const isDone = completed === true;
  const isFailed = completed === false;

  const handleChange = (value: boolean | null) => {
    if (value === true) onDone();
    else if (value === false) onFail();
    else onClear();
  };

  return (
    <View style={styles.row}>
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, isDone && styles.nameDone, isFailed && styles.nameFailed]}>
            {goal.name}
          </Text>
          {!goal.required && <Text style={styles.optional}>optional</Text>}
        </View>
        {goal.successCriteria ? (
          <Text style={styles.criteria}>{goal.successCriteria}</Text>
        ) : null}
      </View>

      <TriStateSlider value={completed} onChange={handleChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  info: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  nameDone: {
    color: '#aaa',
    textDecorationLine: 'line-through',
  },
  nameFailed: {
    color: '#ccc',
    textDecorationLine: 'line-through',
  },
  optional: {
    fontSize: 11,
    color: '#aaa',
    fontStyle: 'italic',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  criteria: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
});
