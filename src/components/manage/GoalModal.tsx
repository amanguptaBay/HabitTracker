import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Goal, Routine } from '../../types';

interface Props {
  visible: boolean;
  goal?: Goal | null;
  routines: Routine[];
  defaultRoutineId?: string;
  onSave: (goal: Omit<Goal, 'id'> & { id?: string }) => void;
  onClose: () => void;
}

export default function GoalModal({ visible, goal, routines, defaultRoutineId, onSave, onClose }: Props) {
  const [name, setName] = useState('');
  const [successCriteria, setSuccessCriteria] = useState('');
  const [required, setRequired] = useState(true);

  const [routineId, setRoutineId] = useState(defaultRoutineId ?? routines[0]?.id ?? '');

  useEffect(() => {
    if (goal) {
      setName(goal.name);
      setSuccessCriteria(goal.successCriteria ?? '');
      setRequired(goal.required);

      setRoutineId(goal.routineId);
    } else {
      setName('');
      setSuccessCriteria('');
      setRequired(true);
      setTimeTracked(false);
      setRoutineId(defaultRoutineId ?? routines[0]?.id ?? '');
    }
  }, [goal, visible]);

  const handleSave = () => {
    if (!name.trim() || !routineId) return;
    onSave({
      id: goal?.id,
      name: name.trim(),
      successCriteria: successCriteria.trim() || undefined,
      required,

      routineId,
    });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetWrap}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{goal ? 'Edit Habit' : 'New Habit'}</Text>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.fields}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Brush Teeth"
                value={name}
                onChangeText={setName}
                autoFocus
                returnKeyType="next"
              />

              <Text style={styles.label}>Success Criteria</Text>
              <TextInput
                style={styles.input}
                placeholder="What does success look like?"
                value={successCriteria}
                onChangeText={setSuccessCriteria}
                returnKeyType="done"
              />

              <Text style={styles.label}>Routine</Text>
              <View style={styles.pillRow}>
                {routines.map((r) => (
                  <Pressable
                    key={r.id}
                    onPress={() => setRoutineId(r.id)}
                    style={[styles.pill, routineId === r.id && styles.pillActive]}
                  >
                    <Text style={[styles.pillText, routineId === r.id && styles.pillTextActive]}>
                      {r.name}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.label}>Options</Text>
              <View style={styles.toggleRow}>
                <Pressable
                  onPress={() => setRequired(!required)}
                  style={[styles.toggle, required && styles.toggleActive]}
                >
                  <Text style={[styles.toggleText, required && styles.toggleTextActive]}>
                    Required
                  </Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>

          <View style={styles.btnRow}>
            <Pressable style={[styles.btn, styles.btnCancel]} onPress={onClose}>
              <Text style={styles.btnCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.btn, styles.btnSave, !name.trim() && styles.btnDisabled]}
              onPress={handleSave}
            >
              <Text style={styles.btnSaveText}>Save</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheetWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '85%',
    gap: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  fields: {
    gap: 8,
    paddingBottom: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    marginTop: 8,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#1a1a1a',
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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
    color: '#555',
    fontWeight: '500',
  },
  pillTextActive: {
    color: '#2E7D32',
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  toggle: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  toggleActive: {
    backgroundColor: '#e8f5e9',
    borderColor: '#4CAF50',
  },
  toggleText: {
    fontSize: 14,
    color: '#555',
    fontWeight: '500',
  },
  toggleTextActive: {
    color: '#2E7D32',
    fontWeight: '700',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  btn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnCancel: {
    backgroundColor: '#f5f5f5',
  },
  btnSave: {
    backgroundColor: '#1a1a1a',
  },
  btnDisabled: {
    opacity: 0.4,
  },
  btnCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#555',
  },
  btnSaveText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});
