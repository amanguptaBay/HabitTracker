/**
 * DayStartSetting
 *
 * Lets the user pick the hour at which their logical day resets.
 * Displayed as a row of hour pills (every 3 hours for compactness).
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useHabitData } from '../context/HabitDataContext';

// Offer midnight + every 3 hours up to 6am as sensible options
const OPTIONS = [
  { label: '12 am', hour: 0 },
  { label: '1 am',  hour: 1 },
  { label: '2 am',  hour: 2 },
  { label: '3 am',  hour: 3 },
  { label: '4 am',  hour: 4 },
  { label: '5 am',  hour: 5 },
  { label: '6 am',  hour: 6 },
];

export default function DayStartSetting() {
  const { settings, updateSettings } = useHabitData();
  const current = settings.dayStartHour;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>Day resets at</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pills}
      >
        {OPTIONS.map(({ label, hour }) => {
          const active = hour === current;
          return (
            <Pressable
              key={hour}
              style={[styles.pill, active && styles.pillActive]}
              onPress={() => updateSettings({ dayStartHour: hour })}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Text style={styles.hint}>
        Habits before {OPTIONS.find(o => o.hour === current)?.label ?? '12 am'} count toward the previous day.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pills: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  pillActive: {
    backgroundColor: '#e8f5e9',
    borderColor: '#4CAF50',
  },
  pillText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  pillTextActive: {
    color: '#2E7D32',
    fontWeight: '700',
  },
  hint: {
    fontSize: 12,
    color: '#aaa',
    fontStyle: 'italic',
  },
});
