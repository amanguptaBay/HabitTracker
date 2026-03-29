import React, { useMemo, useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView, TouchableOpacity } from 'react-native-gesture-handler';
import { useHabitData } from '../context/HabitDataContext';
import { signOut } from '../services/auth';
import DayStartSetting from '../components/DayStartSetting';
import { Goal, Routine } from '../types';
import RoutineModal from '../components/manage/RoutineModal';
import GoalModal from '../components/manage/GoalModal';

// ─── Flat list item types ─────────────────────────────────────────────────────
type RoutineItem  = { type: 'routine';  key: string; routine: Routine };
type GoalItem     = { type: 'goal';     key: string; goal: Goal };
type AddGoalItem  = { type: 'add-goal'; key: string; routineId: string };
type FlatItem = RoutineItem | GoalItem | AddGoalItem;

function uid7() {
  return Math.random().toString(36).slice(2, 9);
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ManageScreen() {
  const {
    routines, goals,
    addRoutine, updateRoutine, deleteRoutine, reorderAll,
    addGoal, updateGoal, deleteGoal, moveGoal,
  } = useHabitData();

  const [routineModal, setRoutineModal] = useState<{ visible: boolean; routine?: Routine | null }>({ visible: false });
  const [goalModal, setGoalModal] = useState<{ visible: boolean; goal?: Goal | null; defaultRoutineId?: string }>({ visible: false });

  const sortedRoutines = useMemo(
    () => [...routines].sort((a, b) => a.order - b.order),
    [routines],
  );

  // Build a single flat array: [Routine header, ...goals, Add-goal button, ...]
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

  const draggingRoutineId = useRef<string | null>(null);

  const handleDragBegin = (index: number) => {
    const item = flatItems[index];
    draggingRoutineId.current = item?.type === 'routine' ? item.routine.id : null;
  };

  // ── Drag end ────────────────────────────────────────────────────────────────
  const handleDragEnd = async ({ data }: { data: FlatItem[] }) => {
    const routineBeingDragged = draggingRoutineId.current;
    draggingRoutineId.current = null;

    let processedData = data;

    if (routineBeingDragged) {
      const originalGoalIds = routines.find((r) => r.id === routineBeingDragged)?.goalIds ?? [];
      const ownGoalIdSet = new Set(originalGoalIds);

      const ownGoalItems = originalGoalIds
        .map((id) => data.find((item): item is GoalItem => item.type === 'goal' && item.goal.id === id))
        .filter((item): item is GoalItem => item !== undefined);

      const stripped = data.filter(
        (item) => item.type !== 'goal' || !ownGoalIdSet.has(item.goal.id),
      );

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

    // Rebuild routine order + goal assignments from the new flat order
    const routineOrder: Routine[] = [];
    const routineGoals: Record<string, string[]> = {};
    let currentRoutineId: string | null = null;

    for (const item of processedData) {
      if (item.type === 'routine') {
        currentRoutineId = item.routine.id;
        routineOrder.push(item.routine);
        routineGoals[currentRoutineId] = [];
      } else if (item.type === 'goal' && currentRoutineId) {
        routineGoals[currentRoutineId].push(item.goal.id);
      }
    }

    // Persist new routine order
    const reordered = routineOrder.map((r, i) => ({ ...r, order: i }));
    await reorderAll(reordered);

    // Persist any goal reassignments
    for (const goal of goals) {
      const newRoutineId = Object.entries(routineGoals).find(([, ids]) =>
        ids.includes(goal.id)
      )?.[0];
      if (newRoutineId && newRoutineId !== goal.routineId) {
        await moveGoal(goal.id, goal.routineId, newRoutineId, routineGoals[newRoutineId]);
      }
    }

    // Update goal order within each routine
    for (const [rId, goalIds] of Object.entries(routineGoals)) {
      const routine = routines.find((r) => r.id === rId);
      if (routine && JSON.stringify(routine.goalIds) !== JSON.stringify(goalIds)) {
        // only call if order actually changed and we didn't already call moveGoal
        const anyMoved = goalIds.some((id) => {
          const g = goals.find((g) => g.id === id);
          return g && g.routineId !== rId;
        });
        if (!anyMoved) {
          // Pure reorder within same routine
          const { updateGoalOrder } = await import('../services/firestoreService');
          const { auth } = await import('../services/firebase');
          if (auth.currentUser) {
            await updateGoalOrder(auth.currentUser.uid, rId, goalIds);
          }
        }
      }
    }
  };

  // ── Render each flat item ────────────────────────────────────────────────────
  const renderItem = ({ item, drag, isActive }: RenderItemParams<FlatItem>) => {
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
              <TouchableOpacity hitSlop={10} onPress={() => setRoutineModal({ visible: true, routine: item.routine })}>
                <Text style={styles.actionIcon}>✏️</Text>
              </TouchableOpacity>
              <TouchableOpacity hitSlop={10} onPress={() => deleteRoutine(item.routine)}>
                <Text style={styles.actionIcon}>🗑️</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </ScaleDecorator>
      );
    }

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
              <TouchableOpacity hitSlop={10} onPress={() => setGoalModal({ visible: true, goal: item.goal })}>
                <Text style={styles.actionIcon}>✏️</Text>
              </TouchableOpacity>
              <TouchableOpacity hitSlop={10} onPress={() => deleteGoal(item.goal.id, item.goal.routineId)}>
                <Text style={styles.actionIcon}>🗑️</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </ScaleDecorator>
      );
    }

    return (
      <Pressable
        style={styles.addGoalRow}
        onPress={() => setGoalModal({ visible: true, goal: null, defaultRoutineId: item.routineId })}
      >
        <Text style={styles.addGoalText}>＋ Add Habit</Text>
      </Pressable>
    );
  };

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
            <View style={styles.footer}>
              <Pressable
                style={styles.addRoutineBtn}
                onPress={() => setRoutineModal({ visible: true, routine: null })}
              >
                <Text style={styles.addRoutineText}>＋ Add Routine</Text>
              </Pressable>

              <DayStartSetting />

              <Pressable
                style={styles.signOutBtn}
                onPress={() => signOut()}
              >
                <Text style={styles.signOutText}>Sign Out</Text>
              </Pressable>
            </View>
          }
        />

        <RoutineModal
          visible={routineModal.visible}
          routine={routineModal.routine}
          onSave={async (name) => {
            if (routineModal.routine) {
              await updateRoutine({ ...routineModal.routine, name });
            } else {
              const id = uid7();
              await addRoutine({
                id,
                name,
                order: routines.length,
                goalIds: [],
              });
            }
            setRoutineModal({ visible: false });
          }}
          onClose={() => setRoutineModal({ visible: false })}
        />

        <GoalModal
          visible={goalModal.visible}
          goal={goalModal.goal}
          routines={sortedRoutines}
          defaultRoutineId={goalModal.defaultRoutineId}
          onSave={async (data) => {
            if (data.id) {
              await updateGoal(data as Goal);
            } else {
              await addGoal({ ...data, id: uid7() } as Goal);
            }
            setGoalModal({ visible: false });
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
  activeRow: {
    opacity: 0.92,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    borderRadius: 10,
  },
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
  footer: {
    gap: 12,
    marginTop: 20,
    paddingBottom: 32,
  },
  addRoutineBtn: {
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
  signOutBtn: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#ffcdd2',
    backgroundColor: '#fff5f5',
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FF5252',
  },
});
