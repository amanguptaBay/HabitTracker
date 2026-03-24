import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

type Status = boolean | null; // true = done, null = neutral, false = failed

const W = 80;
const H = 32;

interface Props {
  value: Status;
  onChange: (value: Status) => void;
}

export default function TriStateSlider({ value, onChange }: Props) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const transition = (next: Status) => {
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 0.88, useNativeDriver: true, speed: 40, bounciness: 0 }),
      Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true, speed: 20, bounciness: 6 }),
    ]).start();
    onChange(next);
  };

  const isDone    = value === true;
  const isFailed  = value === false;
  const isNeutral = value === null;

  const pillBg = isDone ? '#4CAF50' : isFailed ? '#ef5350' : '#e0e0e0';

  return (
    <Animated.View style={[styles.pill, { backgroundColor: pillBg, transform: [{ scale: scaleAnim }] }]}>
      {isNeutral ? (
        // ── Neutral: left half = check, right half = reject ──────────────────
        <>
          <Pressable style={styles.half} onPress={() => transition(true)}>
            <Text style={styles.iconNeutral}>✓</Text>
          </Pressable>
          <View style={styles.divider} />
          <Pressable style={styles.half} onPress={() => transition(false)}>
            <Text style={styles.iconNeutral}>✕</Text>
          </Pressable>
        </>
      ) : (
        // ── Checked / Rejected: full pill, tap anywhere → neutral ─────────────
        <Pressable style={styles.full} onPress={() => transition(null)}>
          <Text style={styles.iconActive}>{isDone ? '✓' : '✕'}</Text>
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    width: W,
    height: H,
    borderRadius: H / 2,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  // Neutral halves
  half: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    marginVertical: 7,
    backgroundColor: '#bbb',
  },
  iconNeutral: {
    fontSize: 13,
    fontWeight: '700',
    color: '#999',
  },
  // Active (checked / rejected) full-pill
  full: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconActive: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
});
