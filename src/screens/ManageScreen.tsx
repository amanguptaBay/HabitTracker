import React, { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAppDispatch, useAppSelector } from '../store';
import {
  addRoutine,
  updateRoutine,
  deleteRoutine,
  addGoal,
  updateGoal,
  deleteGoal,
  applyDragResult,
} from '../store/slices/routinesSlice';
import { Goal, Routine } from '../types';
import RoutineModal from '../components/manage/RoutineModal';
import GoalModal from '../components/manage/GoalModal';

// ─── Flat list item types ─────────────────────────────────────────────────────
type RoutineItem  = { type: 'routine';  key: string; routine: Routine };
type GoalItem     = { type: 'goal';     key: string; goal: Goal };
type AddGoalItem  = { type: 'add-goal'; key: string; routineId: string };
type FlatItem = RoutineItem | GoalItem | AddGoalItem;

// ─── Component ────────────────────────────────────────────────────────────────
export default function ManageScreen() {
  const dispatch  = useAppDispatch();
  const { routines, goals } = useAppSelector((s) => s.routines);

  const [routineModal, setRoutineModal] = useState<{ visible: boolean; routine?: Routine | null }>({ visible: false });
  const [goalModal, setGoalModal] = useState<{ visible: boolean; goal?: Goal | null; defaultRoutineId?: string }>({ visible: false });

  const sortedRoutines = useMemo(
    () => [...routines].sort((a, b) => a.order - b.order),
    [routines],
  );

  // Build a single flat array: [Routine header, ...goals, Add-goal button, Routine header, ...]
  const flatItems = useMemo((): FlatItem[] => {
    const items: FlatItem[] = [];
    for (const routine of sortedRoutines) {
      items.push({ type: 'routine', key: `r-${routine.id}`, routine });
      routine.goalIds
        .map((id) => goals.find((g) => g.id === id)!)
        .filter(Boolean)
        .forEach((goal) => items.push({ type: 'goal', key: `g-${goal.id}`, goal }));
      items.push({ type: 'add-goal', key: `add-${routine.id}`, routineId: routine.id });
    }
    return items;
  }, [sortedRoutines, goals]);

  // Track whether a routine header (vs a goal) initiated the current drag
  const draggingRoutineId = useRef<string | null>(null);

  const handleDragBegin = (index: number) => {
    const item = flatItems[index];
    draggingRoutineId.current = item?.type === 'routine' ? item.routine.id : null;
  };

  // ── Drag end: walk the new order and rebuild routine/goal assignments ────────
  const handleDragEnd = ({ data }: { data: FlatItem[] }) => {
    const routineBeingDragged = draggingRoutineId.current;
    draggingRoutineId.current = null;

    let processedData = data;

    if (routineBeingDragged) {
      // When a routine header is dragged, DraggableFlatList only moves that
      // single item — its goal items stay at their original flat-list positions
      // and get wrongly assigned to whatever routine header now sits above them.
      //
      // Fix: strip the routine's own goals from wherever they ended up, then
      // re-splice them immediately after the routine header in the new order.
      //
      // Side-effect (intentional): any goals from OTHER routines that appear
      // between the routine header and the re-spliced goals remain there,
      // so dropping a routine "into the middle" of another naturally splits
      // those goals between the two routines.

      const originalGoalIds = routines.find((r) => r.id === routineBeingDragged)?.goalIds ?? [];
      const ownGoalIdSet = new Set(originalGoalIds);

      // Collect the routine's goal items in their original order
      const ownGoalItems = originalGoalIds
        .map((id) => data.find((item): item is GoalItem => item.type === 'goal' && item.goal.id === id))
        .filter((item): item is GoalItem => item !== undefined);

      // Remove own goals from wherever they are in the reordered list
      const stripped = data.filter(
        (item) => item.type !== 'goal' || !ownGoalIdSet.has(item.goal.id),
      );

      // Re-insert them right after the routine header
      const headerIdx = stripped.findIndex(
        (item) => item.type === 'routine' && item.routine.id === routineBeingDragged,
      );

      if (headerIdx >= 0) {
        processedData = [
          ...stripped.slice(0, headerIdx + 1),
          ...ownGoalItems,
          ...stripped.slice(headerIdx + 1),
        ];
      }
    }

    // Standard reconstruction: walk the (possibly adjusted) order and assign goals to routines
    const routineOrder: string[] = [];
    const routineGoals: Record<string, string[]> = {};
    let currentRoutineId: string | null = null;

    for (const item of processedData) {
      if (item.type === 'routine') {
        currentRoutineId = item.routine.id;
        routineOrder.push(currentRoutineId);
        routineGoals[currentRoutineId] = [];
      } else if (item.type === 'goal' && currentRoutineId) {
        routineGoals[currentRoutineId].push(item.goal.id);
      }
      // 'add-goal' items are skipped — they're static UI only
    }

    dispatch(applyDragResult({ routineOrder, routineGoals }));
  };

  // ── Delete helpers ───────────────────────────────────────────────────────────
  const handleDeleteRoutine = (routine: Routine) =>
    Alert.alert(
      `Delete "${routine.name}"?`,
      'This will also delete all habits in this routine.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => dispatch(deleteRoutine(routine.id)) },
      ],
    );

  const handleDeleteGoal = (goal: Goal) =>
    Alert.alert(
      `Delete "${goal.name}"?`,
      undefined,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => dispatch(deleteGoal(goal.id)) },
      ],
    );

  // ── Render each flat item ────────────────────────────────────────────────────
  const renderItem = ({ item, drag, isActive }: RenderItemParams<FlatItem>) => {
    // ── Routine header ────────────────────────────────────────────────────────
    if (item.type === 'routine') {
      return (
        <ScaleDecorator>
          <Pressable
            onLongPress={drag}
            delayLongPress={200}
            style={[styles.routineHeader, isActive && styles.activeRow]}
          >
            <Text style={styles.dragHandle}>☰</Text>
            <Text style={styles.routineName}>{item.routine.name}</Text>
            <View style={styles.rowActions}>
              <Pressable hitSlop={10} onPress={() => setRoutineModal({ visible: true, routine: item.routine })}>
                <Text style={styles.actionIcon}>✏️</Text>
              </Pressable>
              <Pressable hitSlop={10} onPress={() => handleDeleteRoutine(item.routine)}>
                <Text style={styles.actionIcon}>🗑️</Text>
              </Pressable>
            </View>
          </Pressable>
        </ScaleDecorator>
      );
    }

    // ── Goal row ──────────────────────────────────────────────────────────────
    if (item.type === 'goal') {
      return (
        <ScaleDecorator>
          <Pressable
            onLongPress={drag}
            delayLongPress={200}
            style={[styles.goalRow, isActive && styles.activeRow]}
          >
            <Text style={styles.dragHandle}>⠿</Text>
            <View style={styles.goalInfo}>
              <Text style={styles.goalName}>{item.goal.name}</Text>
              {!item.goal.required && <Text style={styles.optionalBadge}>optional</Text>}
            </View>
            <View style={styles.rowActions}>
              <Pressable hitSlop={10} onPress={() => setGoalModal({ visible: true, goal: item.goal })}>
                <Text style={styles.actionIcon}>✏️</Text>
              </Pressable>
              <Pressable hitSlop={10} onPress={() => handleDeleteGoal(item.goal)}>
                <Text style={styles.actionIcon}>🗑️</Text>
              </Pressable>
            </View>
          </Pressable>
        </ScaleDecorator>
      );
    }

    // ── Add-habit row (not draggable — drag is never called) ──────────────────
    return (
      <Pressable
        style={styles.addGoalRow}
        onPress={() => setGoalModal({ visible: true, goal: null, defaultRoutineId: item.routineId })}
      >
        <Text style={styles.addGoalText}>＋ Add Habit</Text>
      </Pressable>
    );
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <DraggableFlatList
          data={flatItems}
          keyExtractor={(item) => item.key}
          renderItem={renderItem}
          onDragBegin={handleDragBegin}
          onDragEnd={handleDragEnd}
          activationDistance={10}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={
            <Pressable
              style={styles.addRoutineBtn}
              onPress={() => setRoutineModal({ visible: true, routine: null })}
            >
              <Text style={styles.addRoutineText}>＋ Add Routine</Text>
            </Pressable>
          }
        />

        <RoutineModal
          visible={routineModal.visible}
          routine={routineModal.routine}
          onSave={(name) => {
            if (routineModal.routine) {
              dispatch(updateRoutine({ id: routineModal.routine.id, name }));
            } else {
              dispatch(addRoutine({ name }));
            }
          }}
          onClose={() => setRoutineModal({ visible: false })}
        />

        <GoalModal
          visible={goalModal.visible}
          goal={goalModal.goal}
          routines={sortedRoutines}
          defaultRoutineId={goalModal.defaultRoutineId}
          onSave={(data) => {
            if (data.id) {
              dispatch(updateGoal({ ...data, id: data.id } as Goal));
            } else {
              dispatch(addGoal(data as Omit<Goal, 'id'>));
            }
          }}
          onClose={() => setGoalModal({ visible: false })}
        />
      </View>
    </GestureHandlerRootView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  listContent: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    gap: 2,
  },

  // Routine header row
  routineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1a1a1a',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginTop: 14,
  },
  routineName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },

  // Goal row
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  goalInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  goalName: {
    fontSize: 15,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  optionalBadge: {
    fontSize: 11,
    color: '#aaa',
    fontStyle: 'italic',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },

  // Active drag state (applies to both)
  activeRow: {
    opacity: 0.92,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    borderRadius: 10,
  },

  // Add habit row
  addGoalRow: {
    backgroundColor: '#fff',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  addGoalText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
    textAlign: 'center',
  },

  // Shared
  dragHandle: {
    fontSize: 16,
    color: '#bbb',
    width: 20,
    textAlign: 'center',
  },
  rowActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  actionIcon: {
    fontSize: 15,
  },

  // Add routine footer
  addRoutineBtn: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
  },
  addRoutineText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#888',
  },
});
