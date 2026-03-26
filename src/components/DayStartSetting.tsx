/**
 * TimezoneSetting
 *
 * Lets the user pick their IANA timezone.
 * The day resets at midnight in the chosen timezone.
 * Device timezone is auto-detected and shown at the top.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useHabitData } from '../context/HabitDataContext';

const DEVICE_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

const TIMEZONES: { region: string; zones: { label: string; tz: string }[] }[] = [
  {
    region: 'Americas',
    zones: [
      { label: 'Pacific (LA)',       tz: 'America/Los_Angeles' },
      { label: 'Mountain (Denver)',  tz: 'America/Denver' },
      { label: 'Central (Chicago)',  tz: 'America/Chicago' },
      { label: 'Eastern (NY)',       tz: 'America/New_York' },
      { label: 'São Paulo',          tz: 'America/Sao_Paulo' },
    ],
  },
  {
    region: 'Europe',
    zones: [
      { label: 'London',            tz: 'Europe/London' },
      { label: 'Paris / Berlin',    tz: 'Europe/Paris' },
      { label: 'Helsinki',          tz: 'Europe/Helsinki' },
    ],
  },
  {
    region: 'Asia / Middle East',
    zones: [
      { label: 'Dubai',             tz: 'Asia/Dubai' },
      { label: 'India (IST)',       tz: 'Asia/Kolkata' },
      { label: 'Bangkok',           tz: 'Asia/Bangkok' },
      { label: 'Singapore / KL',    tz: 'Asia/Singapore' },
      { label: 'Tokyo / Seoul',     tz: 'Asia/Tokyo' },
    ],
  },
  {
    region: 'Pacific',
    zones: [
      { label: 'Sydney',            tz: 'Australia/Sydney' },
      { label: 'Auckland',          tz: 'Pacific/Auckland' },
    ],
  },
];

export default function DayStartSetting() {
  const { settings, updateSettings } = useHabitData();
  const current = settings.timezone;

  const select = (tz: string) => updateSettings({ timezone: tz });

  return (
    <View style={styles.wrapper}>
      <Text style={styles.sectionLabel}>Timezone</Text>
      <Text style={styles.hint}>Day resets at midnight in this timezone.</Text>

      {/* Device auto-detect */}
      <TouchableOpacity
        style={[styles.row, current === DEVICE_TZ && styles.rowActive]}
        onPress={() => select(DEVICE_TZ)}
      >
        <View style={styles.rowLeft}>
          <Text style={[styles.rowLabel, current === DEVICE_TZ && styles.rowLabelActive]}>
            Auto-detect
          </Text>
          <Text style={styles.rowSub}>{DEVICE_TZ}</Text>
        </View>
        {current === DEVICE_TZ && <Text style={styles.check}>✓</Text>}
      </TouchableOpacity>

      {/* Region groups */}
      {TIMEZONES.map(({ region, zones }) => (
        <View key={region}>
          <Text style={styles.regionLabel}>{region}</Text>
          {zones.map(({ label, tz }) => {
            const active = current === tz;
            return (
              <TouchableOpacity
                key={tz}
                style={[styles.row, active && styles.rowActive]}
                onPress={() => select(tz)}
              >
                <View style={styles.rowLeft}>
                  <Text style={[styles.rowLabel, active && styles.rowLabelActive]}>
                    {label}
                  </Text>
                  <Text style={styles.rowSub}>{tz}</Text>
                </View>
                {active && <Text style={styles.check}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 4,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#aaa',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  hint: {
    fontSize: 12,
    color: '#bbb',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  regionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ccc',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 4,
    paddingLeft: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#f9f9f9',
    marginBottom: 4,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  rowActive: {
    backgroundColor: '#e8f5e9',
    borderColor: '#4CAF50',
  },
  rowLeft: {
    gap: 1,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  rowLabelActive: {
    color: '#2E7D32',
  },
  rowSub: {
    fontSize: 11,
    color: '#aaa',
  },
  check: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: '700',
  },
});
