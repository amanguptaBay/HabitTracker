/**
 * DayStartSetting
 *
 * Lets the user pick the hour + minute at which their logical day resets.
 * Hours: 12am–6am. Minutes: every 5 mins (fine enough for testing).
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useHabitData } from '../context/HabitDataContext';

const HOURS = [
  { label: '12am', hour: 0 },
  { label: '1am',  hour: 1 },
  { label: '2am',  hour: 2 },
  { label: '3am',  hour: 3 },
  { label: '4am',  hour: 4 },
  { label: '5am',  hour: 5 },
  { label: '6am',  hour: 6 },
];

const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

export default function DayStartSetting() {
  const { settings, updateSettings } = useHabitData();
  const { dayStartHour, dayStartMinute } = settings;

  const hourLabel   = HOURS.find(h => h.hour === dayStartHour)?.label ?? '12am';
  const minuteLabel = `:${pad(dayStartMinute)}`;

  return (
    <View style={styles.wrapper}>
      <Text style={styles.sectionLabel}>Day resets at</Text>
      <Text style={styles.currentValue}>{hourLabel}{minuteLabel}</Text>

      {/* Hour row */}
      <Text style={styles.rowLabel}>Hour</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pills}
      >
        {HOURS.map(({ label, hour }) => {
          const active = hour === dayStartHour;
          return (
            <TouchableOpacity
              key={hour}
              style={[styles.pill, active && styles.pillActive]}
              onPress={() => updateSettings({ dayStartHour: hour })}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Minute row */}
      <Text style={styles.rowLabel}>Minute</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pills}
      >
        {MINUTES.map((minute) => {
          const active = minute === dayStartMinute;
          return (
            <TouchableOpacity
              key={minute}
              style={[styles.pill, active && styles.pillActive]}
              onPress={() => updateSettings({ dayStartMinute: minute })}
            >
              <Text style={[styles.pillText, active && styles.pillTextActive]}>
                :{pad(minute)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={styles.hint}>
        Anything before {hourLabel}{minuteLabel} counts toward the previous day.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#aaa',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  currentValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  rowLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#bbb',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 4,
  },
  pills: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  pillActive: {
    backgroundColor: '#e8f5e9',
    borderColor: '#4CAF50',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#777',
  },
  pillTextActive: {
    color: '#2E7D32',
    fontWeight: '700',
  },
  hint: {
    fontSize: 12,
    color: '#bbb',
    fontStyle: 'italic',
    marginTop: 4,
  },
});
