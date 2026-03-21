import React, { useRef, useEffect } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

type Status = boolean | null; // true = done, null = neutral, false = failed

const TRACK_WIDTH = 72;
const TRACK_HEIGHT = 28;
const THUMB_SIZE = 22;
const THUMB_PADDING = 3;

const POS_DONE = THUMB_PADDING;
const POS_NEUTRAL = (TRACK_WIDTH - THUMB_SIZE) / 2;
const POS_FAILED = TRACK_WIDTH - THUMB_SIZE - THUMB_PADDING;

function valueToPos(v: Status): number {
  if (v === true) return POS_DONE;
  if (v === false) return POS_FAILED;
  return POS_NEUTRAL;
}

interface Props {
  value: Status;
  onChange: (value: Status) => void;
}

export default function TriStateSlider({ value, onChange }: Props) {
  const animX = useRef(new Animated.Value(valueToPos(value))).current;

  useEffect(() => {
    Animated.spring(animX, {
      toValue: valueToPos(value),
      useNativeDriver: true,
      damping: 18,
      stiffness: 220,
      mass: 0.8,
    }).start();
  }, [value]);

  const set = (next: Status) => onChange(next === value ? null : next);

  const isDone = value === true;
  const isFailed = value === false;

  const trackBg = isDone ? '#4CAF50' : isFailed ? '#ef5350' : '#e0e0e0';
  const thumbColor = isDone ? '#fff' : isFailed ? '#fff' : '#bdbdbd';

  return (
    <View style={styles.wrapper}>
      {/* ✓ label */}
      <Pressable onPress={() => set(true)} hitSlop={8}>
        <Text style={[styles.icon, isDone ? styles.iconDone : styles.iconInactive]}>✓</Text>
      </Pressable>

      {/* Track */}
      <View style={[styles.track, { backgroundColor: trackBg }]}>
        {/* Center tap zone → neutral */}
        <Pressable style={StyleSheet.absoluteFill} onPress={() => set(null)} />

        {/* Thumb */}
        <Animated.View
          pointerEvents="none"
          style={[styles.thumb, { backgroundColor: thumbColor, transform: [{ translateX: animX }] }]}
        />
      </View>

      {/* ✕ label */}
      <Pressable onPress={() => set(false)} hitSlop={8}>
        <Text style={[styles.icon, isFailed ? styles.iconFailed : styles.iconInactive]}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    fontSize: 15,
    fontWeight: '700',
    width: 18,
    textAlign: 'center',
  },
  iconDone: {
    color: '#4CAF50',
  },
  iconFailed: {
    color: '#ef5350',
  },
  iconInactive: {
    color: '#ccc',
  },
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    justifyContent: 'center',
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
