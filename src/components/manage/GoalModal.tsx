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
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Re-seed state whenever the modal opens or the incoming goal/defaultRoutineId changes
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
      setRoutineId(defaultRoutineId ?? routines[0]?.id ?? '');
    }
    setDropdownOpen(false);
  }, [goal, visible, defaultRoutineId]);

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

  const selectedRoutineName = routines.find((r) => r.id === routineId)?.name ?? 'Select routine…';

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
              {/* Dropdown trigger */}
              <Pressable
                style={[styles.dropdown, dropdownOpen && styles.dropdownOpen]}
                onPress={() => setDropdownOpen((o) => !o)}
              >
                <Text style={styles.dropdownValue}>{selectedRoutineName}</Text>
                <Text style={styles.dropdownChevron}>{dropdownOpen ? '▲' : '▼'}</Text>
              </Pressable>
              {/* Dropdown options */}
              {dropdownOpen && (
                <View style={styles.dropdownList}>
                  {routines.map((r, i) => (
                    <Pressable
                      key={r.id}
                      style={[
                        styles.dropdownOption,
                        r.id === routineId && styles.dropdownOptionActive,
                        i < routines.length - 1 && styles.dropdownOptionBorder,
                      ]}
                      onPress={() => { setRoutineId(r.id); setDropdownOpen(false); }}
                    >
                      <Text style={[styles.dropdownOptionText, r.id === routineId && styles.dropdownOptionTextActive]}>
                        {r.name}
                      </Text>
                      {r.id === routineId && <Text style={styles.dropdownCheck}>✓</Text>}
                    </Pressable>
                  ))}
                </View>
              )}

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
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  dropdownOpen: {
    borderColor: '#4CAF50',
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  dropdownValue: {
    fontSize: 15,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  dropdownChevron: {
    fontSize: 11,
    color: '#888',
  },
  dropdownList: {
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderColor: '#4CAF50',
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dropdownOptionBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f0f0f0',
  },
  dropdownOptionActive: {
    backgroundColor: '#f1f8f1',
  },
  dropdownOptionText: {
    fontSize: 15,
    color: '#555',
  },
  dropdownOptionTextActive: {
    color: '#2E7D32',
    fontWeight: '600',
  },
  dropdownCheck: {
    fontSize: 14,
    color: '#4CAF50',
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
