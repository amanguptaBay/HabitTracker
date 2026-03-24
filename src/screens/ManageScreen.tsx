import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
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
  reorderRoutines,
  addGoal,
  updateGoal,
  deleteGoal,
  reorderGoals,
} from '../store/slices/routinesSlice';
import { Goal, Routine } from '../types';
import RoutineModal from '../components/manage/RoutineModal';
import GoalModal from '../components/manage/GoalModal';

export default function ManageScreen() {
  const dispatch = useAppDispatch();
  const { routines, goals } = useAppSelector((s) => s.routines);
  const sortedRoutines = [...routines].sort((a, b) => a.order - b.order);

  const [routineModal, setRoutineModal] = useState<{ visible: boolean; routine?: Routine | null }>({ visible: false });
  const [goalModal, setGoalModal] = useState<{ visible: boolean; goal?: Goal | null; defaultRoutineId?: string }>({ visible: false });

  const goalsFor = (routine: Routine): Goal[] =>
    routine.goalIds.map((id) => goals.find((g) => g.id === id)!).filter(Boolean);

  const handleDeleteRoutine = (routine: Routine) => {
    Alert.alert(
      `Delete "${routine.name}"?`,
      'This will also delete all habits in this routine.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => dispatch(deleteRoutine(routine.id)) },
      ]
    );
  };

  const handleDeleteGoal = (goal: Goal) => {
    Alert.alert(
      `Delete "${goal.name}"?`,
      undefined,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => dispatch(deleteGoal(goal.id)) },
      ]
    );
  };

  const renderGoalItem = (routineId: string) =>
    ({ item, drag, isActive }: RenderItemParams<Goal>) => (
      <ScaleDecorator>
        <Pressable
          onLongPress={drag}
          delayLongPress={150}
          style={[styles.goalRow, isActive && styles.goalRowActive]}
        >
          <Text style={styles.dragHandle}>☰</Text>
          <View style={styles.goalInfo}>
            <Text style={styles.goalName}>{item.name}</Text>
            {!item.required && <Text style={styles.optionalBadge}>optional</Text>}
          </View>
          <View style={styles.goalActions}>
            <Pressable
              hitSlop={8}
              onPress={() => setGoalModal({ visible: true, goal: item })}
            >
              <Text style={styles.actionIcon}>✏️</Text>
            </Pressable>
            <Pressable hitSlop={8} onPress={() => handleDeleteGoal(item)}>
              <Text style={styles.actionIcon}>🗑️</Text>
            </Pressable>
          </View>
        </Pressable>
      </ScaleDecorator>
    );

  const renderRoutineItem = ({ item: routine, drag, isActive }: RenderItemParams<Routine>) => {
    const routineGoals = goalsFor(routine);
    return (
      <ScaleDecorator>
        <View style={[styles.routineCard, isActive && styles.routineCardActive]}>
          {/* Routine header */}
          <View style={styles.routineHeader}>
            <Pressable onLongPress={drag} delayLongPress={150} hitSlop={8}>
              <Text style={styles.dragHandle}>☰</Text>
            </Pressable>
            <Text style={styles.routineName}>{routine.name}</Text>
            <View style={styles.routineActions}>
              <Pressable
                hitSlop={8}
                onPress={() => setRoutineModal({ visible: true, routine })}
              >
                <Text style={styles.actionIcon}>✏️</Text>
              </Pressable>
              <Pressable hitSlop={8} onPress={() => handleDeleteRoutine(routine)}>
                <Text style={styles.actionIcon}>🗑️</Text>
              </Pressable>
            </View>
          </View>

          {/* Goals within routine */}
          {routineGoals.length > 0 && (
            <View style={styles.goalsContainer}>
              <DraggableFlatList
                data={routineGoals}
                keyExtractor={(g) => g.id}
                renderItem={renderGoalItem(routine.id)}
                onDragEnd={({ data }) =>
                  dispatch(reorderGoals({ routineId: routine.id, goalIds: data.map((g) => g.id) }))
                }
                scrollEnabled={false}
              />
            </View>
          )}

          {/* Add habit button */}
          <Pressable
            style={styles.addHabitBtn}
            onPress={() => setGoalModal({ visible: true, goal: null, defaultRoutineId: routine.id })}
          >
            <Text style={styles.addHabitText}>+ Add Habit</Text>
          </Pressable>
        </View>
      </ScaleDecorator>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <DraggableFlatList
          data={sortedRoutines}
          keyExtractor={(r) => r.id}
          renderItem={renderRoutineItem}
          onDragEnd={({ data }) => dispatch(reorderRoutines(data.map((r) => r.id)))}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={
            <Pressable
              style={styles.addRoutineBtn}
              onPress={() => setRoutineModal({ visible: true, routine: null })}
            >
              <Text style={styles.addRoutineText}>+ Add Routine</Text>
            </Pressable>
          }
        />

        {/* Routine modal */}
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

        {/* Goal modal */}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  routineCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    marginBottom: 12,
  },
  routineCardActive: {
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },
  routineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  routineName: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  routineActions: {
    flexDirection: 'row',
    gap: 12,
  },
  goalsContainer: {
    paddingHorizontal: 8,
    paddingTop: 4,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    gap: 10,
    borderRadius: 8,
  },
  goalRowActive: {
    backgroundColor: '#f8f8f8',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  goalInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  goalName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  optionalBadge: {
    fontSize: 11,
    color: '#aaa',
    fontStyle: 'italic',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  goalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  dragHandle: {
    fontSize: 16,
    color: '#ccc',
  },
  actionIcon: {
    fontSize: 15,
  },
  addHabitBtn: {
    padding: 14,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#f0f0f0',
  },
  addHabitText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4CAF50',
  },
  addRoutineBtn: {
    marginTop: 4,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 14,
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
