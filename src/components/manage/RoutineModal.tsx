import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Routine } from '../../types';

interface Props {
  visible: boolean;
  routine?: Routine | null;
  onSave: (name: string) => void;
  onClose: () => void;
}

export default function RoutineModal({ visible, routine, onSave, onClose }: Props) {
  const [name, setName] = useState('');

  useEffect(() => {
    setName(routine?.name ?? '');
  }, [routine, visible]);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave(name.trim());
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetWrap}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{routine ? 'Edit Routine' : 'New Routine'}</Text>
          <TextInput
            style={styles.input}
            placeholder="Routine name (e.g. Morning)"
            value={name}
            onChangeText={setName}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSave}
          />
          <View style={styles.row}>
            <Pressable style={[styles.btn, styles.btnCancel]} onPress={onClose}>
              <Text style={styles.btnCancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnSave, !name.trim() && styles.btnDisabled]} onPress={handleSave}>
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
    gap: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#e0e0e0',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#1a1a1a',
  },
  row: {
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
