/**
 * TimezoneSetting
 *
 * Renders a compact summary row with the current timezone.
 * Tapping "Change" opens a full-screen Modal with a scrollable picker.
 * This avoids embedding a long list inside a FlatList footer, which
 * causes overflow on short screens and web.
 */
import React, { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useHabitData } from '../context/HabitDataContext';

const DEVICE_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

const TIMEZONES: { region: string; zones: { label: string; tz: string }[] }[] = [
  {
    region: 'Americas',
    zones: [
      { label: 'Pacific (LA)',      tz: 'America/Los_Angeles' },
      { label: 'Mountain (Denver)', tz: 'America/Denver' },
      { label: 'Central (Chicago)', tz: 'America/Chicago' },
      { label: 'Eastern (NY)',      tz: 'America/New_York' },
      { label: 'São Paulo',         tz: 'America/Sao_Paulo' },
    ],
  },
  {
    region: 'Europe',
    zones: [
      { label: 'London',         tz: 'Europe/London' },
      { label: 'Paris / Berlin', tz: 'Europe/Paris' },
      { label: 'Helsinki',       tz: 'Europe/Helsinki' },
    ],
  },
  {
    region: 'Asia / Middle East',
    zones: [
      { label: 'Dubai',          tz: 'Asia/Dubai' },
      { label: 'India (IST)',    tz: 'Asia/Kolkata' },
      { label: 'Bangkok',        tz: 'Asia/Bangkok' },
      { label: 'Singapore / KL', tz: 'Asia/Singapore' },
      { label: 'Tokyo / Seoul',  tz: 'Asia/Tokyo' },
    ],
  },
  {
    region: 'Pacific',
    zones: [
      { label: 'Sydney',   tz: 'Australia/Sydney' },
      { label: 'Auckland', tz: 'Pacific/Auckland' },
    ],
  },
];

export default function DayStartSetting() {
  const { settings, updateSettings } = useHabitData();
  const current = settings.timezone;
  const [open, setOpen] = useState(false);

  const select = (tz: string) => {
    updateSettings({ timezone: tz });
    setOpen(false);
  };

  return (
    <>
      {/* ── Compact summary row ── */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryLeft}>
          <Text style={styles.summaryTitle}>Timezone</Text>
          <Text style={styles.summarySub}>{current}</Text>
        </View>
        <Pressable style={styles.changeBtn} onPress={() => setOpen(true)}>
          <Text style={styles.changeBtnText}>Change</Text>
        </Pressable>
      </View>

      {/* ── Full-screen picker modal ── */}
      <Modal
        visible={open}
        animationType="slide"
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
        onRequestClose={() => setOpen(false)}
      >
        <SafeAreaView style={styles.modal}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Choose Timezone</Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={12}>
              <Text style={styles.modalClose}>Done</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.hint}>Day resets at midnight in this timezone.</Text>

            {/* Auto-detect */}
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
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // ── Summary row ──────────────────────────────────────────────────────────
  summaryRow: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    backgroundColor: '#fff',
    borderRadius:    12,
    padding:         16,
  },
  summaryLeft: {
    gap: 2,
  },
  summaryTitle: {
    fontSize:   14,
    fontWeight: '600',
    color:      '#333',
  },
  summarySub: {
    fontSize: 12,
    color:    '#aaa',
  },
  changeBtn: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 14,
    paddingVertical:   7,
    borderRadius:      8,
  },
  changeBtnText: {
    color:      '#fff',
    fontSize:   13,
    fontWeight: '700',
  },

  // ── Modal ─────────────────────────────────────────────────────────────────
  modal: {
    flex:            1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingHorizontal: 20,
    paddingVertical:   14,
    backgroundColor:   '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize:   17,
    fontWeight: '700',
    color:      '#111',
  },
  modalClose: {
    fontSize:   16,
    color:      '#4CAF50',
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding:       16,
    paddingBottom: 40,
    gap:           4,
  },
  hint: {
    fontSize:     12,
    color:        '#bbb',
    fontStyle:    'italic',
    marginBottom: 8,
  },

  // ── Rows ─────────────────────────────────────────────────────────────────
  regionLabel: {
    fontSize:      11,
    fontWeight:    '700',
    color:         '#ccc',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop:     12,
    marginBottom:  4,
    paddingLeft:   4,
  },
  row: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingVertical:   10,
    paddingHorizontal: 12,
    borderRadius:      10,
    backgroundColor:   '#f9f9f9',
    marginBottom:      4,
    borderWidth:       1.5,
    borderColor:       'transparent',
  },
  rowActive: {
    backgroundColor: '#e8f5e9',
    borderColor:     '#4CAF50',
  },
  rowLeft: {
    gap: 1,
  },
  rowLabel: {
    fontSize:   14,
    fontWeight: '600',
    color:      '#333',
  },
  rowLabelActive: {
    color: '#2E7D32',
  },
  rowSub: {
    fontSize: 11,
    color:    '#aaa',
  },
  check: {
    fontSize:   16,
    color:      '#4CAF50',
    fontWeight: '700',
  },
});
