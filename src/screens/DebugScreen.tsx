import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../services/supabase/client';

// ─── Theme ────────────────────────────────────────────────────────────────────

const C = {
  bg:      '#0f1117',
  surface: '#1a1d27',
  border:  '#2a2d3a',
  text:    '#e2e8f0',
  muted:   '#64748b',
  get:     '#3b82f6',
  post:    '#22c55e',
  put:     '#f59e0b',
  del:     '#ef4444',
};

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

const EMULATOR_BASE = 'http://localhost:5001/habittracker-4feb2/us-central1/api';
const PROD_BASE     = 'https://us-central1-habittracker-4feb2.cloudfunctions.net/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';
interface ApiResponse { status: number; body: unknown; ms: number; }

// ─── Core fetch helper ────────────────────────────────────────────────────────

async function apiFetch(
  baseUrl: string,
  method: Method,
  path: string,
  body?: unknown,
): Promise<ApiResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Not signed in');

  const opts: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  const t0  = Date.now();
  const res = await fetch(baseUrl + path, opts);
  const ms  = Date.now() - t0;

  let parsed: unknown;
  try   { parsed = await res.json(); }
  catch { parsed = await res.text(); }

  return { status: res.status, body: parsed, ms };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MethodBadge({ method }: { method: Method }) {
  const color = method === 'GET' ? C.get
    : method === 'POST' ? C.post
    : method === 'PUT'  ? C.put
    : C.del;
  return (
    <View style={[s.badge, { borderColor: color }]}>
      <Text style={[s.badgeText, { color }]}>{method}</Text>
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={s.sectionHeader}>{title}</Text>;
}

function Field({
  label, value, onChange, placeholder, multiline,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; multiline?: boolean;
}) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        style={[s.fieldInput, multiline && { height: 64, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.muted}
        multiline={multiline}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

function ResponsePanel({ status, body, ms }: ApiResponse) {
  const isOk = status >= 200 && status < 300;
  const statusColor = status >= 500 ? C.del : status >= 400 ? C.put : C.post;
  const json = typeof body === 'object' ? JSON.stringify(body, null, 2) : String(body);
  return (
    <View style={s.response}>
      <View style={s.resMeta}>
        <Text style={[s.resStatus, { color: statusColor }]}>{status}</Text>
        <Text style={s.resBadge}>{isOk ? 'OK' : 'Error'}</Text>
        <Text style={s.resTime}>{ms}ms</Text>
      </View>
      <ScrollView horizontal style={s.resBody}>
        <Text style={s.resBodyText}>{json}</Text>
      </ScrollView>
    </View>
  );
}

// ─── EndpointCard ─────────────────────────────────────────────────────────────

function EndpointCard({
  method, path, desc, children, onRun,
}: {
  method: Method;
  path: string;
  desc: string;
  children?: React.ReactNode;
  onRun: () => Promise<ApiResponse>;
}) {
  const [open, setOpen]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [error, setError]       = useState<string | null>(null);

  const handleRun = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await onRun();
      setResponse(r);
    } catch (e: any) {
      setError(e.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [onRun]);

  return (
    <View style={s.card}>
      <TouchableOpacity style={s.cardHeader} onPress={() => setOpen(o => !o)} activeOpacity={0.7}>
        <MethodBadge method={method} />
        <Text style={s.cardPath}>{path}</Text>
        <Text style={s.chevron}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {!open && <Text style={s.cardDesc}>{desc}</Text>}
      {open && (
        <View style={s.cardBody}>
          {children}
          <TouchableOpacity
            style={[s.runBtn, loading && s.runBtnLoading]}
            onPress={handleRun}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator size="small" color={C.text} />
              : <Text style={s.runBtnText}>▶  Run</Text>}
          </TouchableOpacity>
          {error   && <Text style={s.errorText}>Error: {error}</Text>}
          {response && <ResponsePanel {...response} />}
        </View>
      )}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DebugScreen() {
  const navigation = useNavigation();
  const [baseUrl, setBaseUrl] = useState(EMULATOR_BASE);
  const [target, setTarget]   = useState<'emulator' | 'prod'>('emulator');

  const setTarget_ = (t: 'emulator' | 'prod') => {
    setTarget(t);
    setBaseUrl(t === 'emulator' ? EMULATOR_BASE : PROD_BASE);
  };

  // Per-endpoint input state
  const [goalsRoutineId,       setGoalsRoutineId]       = useState('');
  const [getEntriesDate,       setGetEntriesDate]       = useState('');
  const [putGoalId,            setPutGoalId]            = useState('');
  const [putCompleted,         setPutCompleted]         = useState<'true' | 'false' | 'null'>('true');
  const [putDate,              setPutDate]              = useState('');
  const [postTimerTargetId,    setPostTimerTargetId]    = useState('');
  const [postTimerTargetType,  setPostTimerTargetType]  = useState<'goal' | 'routine'>('goal');
  const [deleteTimerTargetId,  setDeleteTimerTargetId]  = useState('');

  const api = useCallback(
    (method: Method, path: string, body?: unknown) => apiFetch(baseUrl, method, path, body),
    [baseUrl],
  );

  return (
    <SafeAreaView style={s.container}>

      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={s.backBtn}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={s.title}>API Debug</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>

        {/* ── Config ── */}
        <View style={s.configCard}>
          <Text style={s.configLabel}>Target</Text>
          <View style={s.toggle}>
            <TouchableOpacity
              style={[s.toggleBtn, target === 'emulator' && s.toggleBtnActive]}
              onPress={() => setTarget_('emulator')}
            >
              <Text style={[s.toggleText, target === 'emulator' && s.toggleTextActive]}>Emulator</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.toggleBtn, target === 'prod' && s.toggleBtnActive]}
              onPress={() => setTarget_('prod')}
            >
              <Text style={[s.toggleText, target === 'prod' && s.toggleTextActive]}>Production</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.configUrl} numberOfLines={1}>{baseUrl}</Text>
          <Text style={s.configHint}>
            Auth token fetched automatically from current session.
          </Text>
        </View>

        {/* ── Discovery ── */}
        <SectionHeader title="Discovery" />

        <EndpointCard
          method="GET" path="/routines" desc="List all routines sorted by order"
          onRun={() => api('GET', '/routines')}
        />

        <EndpointCard
          method="GET" path="/goals" desc="List goals — optionally filter by routine"
          onRun={() => {
            const qs = goalsRoutineId ? `?routineId=${encodeURIComponent(goalsRoutineId)}` : '';
            return api('GET', `/goals${qs}`);
          }}
        >
          <Field label="routineId (optional)" value={goalsRoutineId}
            onChange={setGoalsRoutineId} placeholder="routine-morning" />
        </EndpointCard>

        {/* ── Entries ── */}
        <SectionHeader title="Entries" />

        <EndpointCard
          method="GET" path="/entries" desc="Get entries for a date (defaults to today)"
          onRun={() => {
            const qs = getEntriesDate ? `?date=${getEntriesDate}` : '';
            return api('GET', `/entries${qs}`);
          }}
        >
          <Field label="date (YYYY-MM-DD, optional)" value={getEntriesDate}
            onChange={setGetEntriesDate} placeholder="2026-06-11" />
        </EndpointCard>

        <EndpointCard
          method="PUT" path="/entries/:goalId" desc="Mark a goal done / failed / clear"
          onRun={() => {
            if (!putGoalId) return Promise.reject(new Error('goalId is required'));
            const completed = putCompleted === 'null' ? null : putCompleted === 'true';
            const qs = putDate ? `?date=${putDate}` : '';
            return api('PUT', `/entries/${encodeURIComponent(putGoalId)}${qs}`, { completed });
          }}
        >
          <Field label="goalId" value={putGoalId} onChange={setPutGoalId} placeholder="goal-meditate" />
          <View style={s.field}>
            <Text style={s.fieldLabel}>completed</Text>
            <View style={s.toggle}>
              {(['true', 'false', 'null'] as const).map(v => (
                <TouchableOpacity
                  key={v}
                  style={[s.toggleBtn, putCompleted === v && s.toggleBtnActive]}
                  onPress={() => setPutCompleted(v)}
                >
                  <Text style={[s.toggleText, putCompleted === v && s.toggleTextActive]}>
                    {v === 'true' ? 'true ✓' : v === 'false' ? 'false ✗' : 'null ○'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <Field label="date (YYYY-MM-DD, optional)" value={putDate}
            onChange={setPutDate} placeholder="2026-06-11" />
        </EndpointCard>

        {/* ── Timers ── */}
        <SectionHeader title="Timers" />

        <EndpointCard
          method="GET" path="/timers" desc="List all currently active timers"
          onRun={() => api('GET', '/timers')}
        />

        <EndpointCard
          method="POST" path="/timers/:targetId" desc="Start a timer for a goal or routine"
          onRun={() => {
            if (!postTimerTargetId) return Promise.reject(new Error('targetId is required'));
            return api('POST', `/timers/${encodeURIComponent(postTimerTargetId)}`,
              { targetType: postTimerTargetType });
          }}
        >
          <Field label="targetId" value={postTimerTargetId}
            onChange={setPostTimerTargetId} placeholder="goal-meditate" />
          <View style={s.field}>
            <Text style={s.fieldLabel}>targetType</Text>
            <View style={s.toggle}>
              {(['goal', 'routine'] as const).map(v => (
                <TouchableOpacity
                  key={v}
                  style={[s.toggleBtn, postTimerTargetType === v && s.toggleBtnActive]}
                  onPress={() => setPostTimerTargetType(v)}
                >
                  <Text style={[s.toggleText, postTimerTargetType === v && s.toggleTextActive]}>{v}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </EndpointCard>

        <EndpointCard
          method="DELETE" path="/timers/:targetId" desc="Stop a timer and write the timing segment"
          onRun={() => {
            if (!deleteTimerTargetId) return Promise.reject(new Error('targetId is required'));
            return api('DELETE', `/timers/${encodeURIComponent(deleteTimerTargetId)}`);
          }}
        >
          <Field label="targetId" value={deleteTimerTargetId}
            onChange={setDeleteTimerTargetId} placeholder="goal-meditate" />
        </EndpointCard>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:       { flex: 1, backgroundColor: C.bg },

  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                     paddingHorizontal: 16, paddingVertical: 12,
                     borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.border },
  backBtn:         { fontSize: 16, color: C.get, width: 60 },
  title:           { fontSize: 17, fontWeight: '700', color: C.text },

  scroll:          { flex: 1 },
  scrollContent:   { padding: 16, gap: 8 },

  configCard:      { backgroundColor: C.surface, borderRadius: 10, padding: 14,
                     borderWidth: StyleSheet.hairlineWidth, borderColor: C.border, gap: 10 },
  configLabel:     { fontSize: 11, fontWeight: '600', color: C.muted,
                     textTransform: 'uppercase', letterSpacing: 0.6 },
  configUrl:       { fontFamily: MONO, fontSize: 11, color: C.muted },
  configHint:      { fontSize: 12, color: C.muted, fontStyle: 'italic' },

  toggle:          { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  toggleBtn:       { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
                     backgroundColor: C.bg, borderWidth: 1, borderColor: C.border },
  toggleBtnActive: { backgroundColor: C.get, borderColor: C.get },
  toggleText:      { fontSize: 13, color: C.muted },
  toggleTextActive:{ color: '#fff', fontWeight: '600' },

  sectionHeader:   { fontSize: 11, fontWeight: '700', color: C.muted,
                     textTransform: 'uppercase', letterSpacing: 0.8,
                     marginTop: 12, marginBottom: 2, paddingLeft: 2 },

  card:            { backgroundColor: C.surface, borderRadius: 10, overflow: 'hidden',
                     borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  cardHeader:      { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  cardPath:        { flex: 1, fontFamily: MONO, fontSize: 13, color: C.text },
  cardDesc:        { fontSize: 12, color: C.muted, paddingHorizontal: 12, paddingBottom: 10 },
  chevron:         { fontSize: 11, color: C.muted },
  cardBody:        { padding: 12, paddingTop: 0, gap: 8,
                     borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.border },

  badge:           { borderWidth: 1, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
                     width: 60, alignItems: 'center' },
  badgeText:       { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },

  field:           { gap: 4 },
  fieldLabel:      { fontSize: 11, color: C.muted, fontWeight: '500' },
  fieldInput:      { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border,
                     borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8,
                     color: C.text, fontFamily: MONO, fontSize: 13 },

  runBtn:          { backgroundColor: '#1e293b', borderWidth: 1, borderColor: C.border,
                     borderRadius: 6, paddingVertical: 8, alignItems: 'center',
                     justifyContent: 'center', height: 36 },
  runBtnLoading:   { opacity: 0.6 },
  runBtnText:      { color: C.text, fontSize: 13, fontWeight: '600' },

  errorText:       { color: C.del, fontSize: 12, fontFamily: MONO },

  response:        { borderRadius: 6, overflow: 'hidden',
                     borderWidth: StyleSheet.hairlineWidth, borderColor: C.border },
  resMeta:         { flexDirection: 'row', alignItems: 'center', gap: 8,
                     backgroundColor: C.bg, padding: 8 },
  resStatus:       { fontFamily: MONO, fontSize: 14, fontWeight: '700' },
  resBadge:        { fontSize: 12, color: C.muted },
  resTime:         { fontSize: 12, color: C.muted, marginLeft: 'auto' },
  resBody:         { backgroundColor: '#0a0c12', maxHeight: 280 },
  resBodyText:     { fontFamily: MONO, fontSize: 12, color: '#cbd5e1',
                     padding: 10, lineHeight: 18 },
});
