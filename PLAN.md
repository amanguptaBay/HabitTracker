# Ritual — Architecture & Data Model

This document describes the actual implemented architecture, data model, and key design decisions. It is kept in sync with the codebase.

---

## Table of Contents

1. [Data Model](#data-model)
2. [Firestore Schema](#firestore-schema)
3. [Timer Lifecycle](#timer-lifecycle)
4. [Timezone & Day Rollover](#timezone--day-rollover)
5. [Timeline Rendering](#timeline-rendering)
6. [State Management](#state-management)
7. [Authentication](#authentication)
8. [Key Design Decisions](#key-design-decisions)
9. [Future Roadmap](#future-roadmap)

---

## Data Model

### TypeScript Interfaces (`src/types/index.ts`)

```typescript
interface Routine {
  id: string;             // UUID
  name: string;
  order: number;          // sort position
  goalIds: string[];      // ordered references to Goal documents
}

interface Goal {
  id: string;             // UUID
  routineId: string;      // parent Routine
  name: string;
  description?: string;
  successCriteria?: string;
  required: boolean;      // if true, must complete for routine to count as done
}

interface Entry {
  id: string;             // "entry-{goalId}-{date}"
  goalId: string;
  routineId: string;
  date: string;           // YYYY-MM-DD (logical date in user's timezone)
  completed: boolean | null;  // null = no response, true = done, false = failed
  notes?: string;
}

interface TimingRun {
  startTime: string;      // ISO 8601 UTC
  endTime: string;        // ISO 8601 UTC
  durationMs: number;
}

interface TimingSegment {
  targetId: string;                  // Goal or Routine ID
  targetType: 'goal' | 'routine';
  date: string;                      // YYYY-MM-DD (logical date)
  totalMs: number;                   // sum of all runs for this target on this date
  segments: TimingRun[];             // individual timing runs
}

interface ActiveTimer {
  targetId: string;
  targetType: 'goal' | 'routine';
  startedAt: string;      // ISO 8601 UTC
}

interface UserSettings {
  timezone: string;        // IANA timezone (e.g. "America/Chicago")
}
```

### Key Points

- **Completion is tri-state**: `null` (no response), `true` (done), `false` (failed). This is distinct from binary — the user explicitly marks failure vs. simply not responding.
- **TimingRun stores absolute UTC timestamps**: all time math is in UTC. Timezone is only used to determine which logical date a moment belongs to.
- **One TimingSegment per (target × date)**: if a user times the same habit three times on one day, all three runs accumulate in a single Firestore document via `arrayUnion` and `increment`.

---

## Firestore Schema

```
users/{uid}/
│
├── routines/{routineId}
│     id, name, order, goalIds[]
│
├── goals/{goalId}
│     id, routineId, name, description?, successCriteria?, required
│
├── entries/{entryId}
│     id, goalId, routineId, date, completed, notes?
│
├── dates/{YYYY-MM-DD}/timingSegments/{targetId}
│     targetId, targetType, date, totalMs, segments[]
│
├── activeTimers/{targetId}
│     targetId, targetType, startedAt
│
└── settings/preferences
      timezone
```

### Why This Structure

| Collection | Indexed by | Reasoning |
|------------|------------|-----------|
| `routines` | uid | Small set, loaded once, listened globally |
| `goals` | uid | Small set, loaded once, listened globally |
| `entries` | uid + date | Filtered per viewing date — listener re-subscribes on date change |
| `timingSegments` | uid + date + targetId | Nested under `/dates/{date}/` so loading a day fetches only that day's timing data. One doc per target means upsert is a known path (no query needed) |
| `activeTimers` | uid + targetId | At most one per target. Keyed by targetId so start = `setDoc`, stop = `deleteDoc` — no query needed |
| `settings` | uid | Single document per user |

### Concurrent-Write Safety

`upsertTimingSegment` uses Firestore atomic field transforms:

```typescript
setDoc(segRef, {
  totalMs:  increment(run.durationMs),   // atomic add
  segments: arrayUnion(run),             // atomic append
}, { merge: true });
```

This means two devices stopping timers for the same target on the same day will both succeed without overwriting each other.

---

## Timer Lifecycle

### Start → Run → Stop → Store

```
┌──────────────────────────────────────────────────────────────────┐
│ 1. START                                                         │
│    startTimer(targetId, 'goal')                                  │
│    → setDoc('activeTimers/{targetId}', { startedAt: now() })     │
│    → onSnapshot fires → UI shows running timer                   │
│                                                                  │
│ 2. RUNNING                                                       │
│    ActiveTimer doc persists in Firestore                         │
│    TimerButton polls Date.now() every 1s for elapsed display     │
│    Works across tabs/devices (same onSnapshot)                   │
│                                                                  │
│ 3. STOP                                                          │
│    stopTimer(targetId)                                           │
│    → deleteDoc('activeTimers/{targetId}')  ← UI clears instantly │
│    → splitByLogicalDay(startedAt, endTime, timezone)             │
│    → for each chunk:                                             │
│        upsertTimingSegment(uid, chunk.date, targetId, ...)       │
│    → onSnapshot fires → timeline blocks appear                   │
│                                                                  │
│ 4. DELETE (optional)                                             │
│    deleteRun(date, targetId, run)                                │
│    → updateDoc with arrayRemove(run) + increment(-durationMs)    │
└──────────────────────────────────────────────────────────────────┘
```

### Cross-Midnight Splitting

When a timer runs past midnight in the user's timezone, `splitByLogicalDay` emits multiple chunks:

```
Timer: start 2026-03-28T22:30 CDT → stop 2026-03-29T01:15 CDT
Timezone: America/Chicago (CDT = UTC-5)
Midnight CDT = 2026-03-29T05:00:00Z

Chunk 1: date = "2026-03-28"
         startTime = 2026-03-29T03:30:00Z (10:30 PM CDT)
         endTime   = 2026-03-29T05:00:00Z (midnight CDT)
         durationMs = 5,400,000 (1h 30m)

Chunk 2: date = "2026-03-29"
         startTime = 2026-03-29T05:00:00Z (midnight CDT)
         endTime   = 2026-03-29T06:15:00Z (1:15 AM CDT)
         durationMs = 4,500,000 (1h 15m)

Each chunk → upsertTimingSegment under its respective date path.
```

### Deleting a Run

`arrayRemove` requires an exact field-for-field match with the stored object. Since `splitByLogicalDay` includes a `date` field in each chunk (and that field gets stored via `arrayUnion`), the `run` object passed to `deleteTimingRun` must include `date` as well. The app obtains this directly from the Firestore document's `segments` array (which preserves all stored fields regardless of the TypeScript type).

---

## Timezone & Day Rollover

### Core Principle

All times are stored as UTC ISO strings. The user's IANA timezone determines only one thing: **which YYYY-MM-DD date a given UTC moment belongs to**.

### Implementation (`src/utils/date.ts`)

**`getLogicalDate(timezone, at)`** — returns the YYYY-MM-DD for a moment in a timezone.

Uses `Intl.DateTimeFormat('sv', { timeZone })` — the Swedish locale natively outputs `YYYY-MM-DD`.

**`nextMidnightInTZ(timezone, after)`** — returns the exact UTC millisecond of the next midnight.

Uses binary search over a ±14-hour window around UTC midnight (covers every real-world UTC offset, including DST transitions). The search converges to within 1 second.

**`splitByLogicalDay(startTime, endTime, timezone)`** — walks from start to end, emitting one chunk per logical day boundary.

### Why Binary Search

DST transitions shift midnight by ±1 hour. Rather than maintaining a timezone rules database, the binary search asks `Intl.DateTimeFormat` directly: "what date is it at this UTC millisecond in this timezone?" This is provably correct for any IANA timezone, including historical and future DST changes.

---

## Timeline Rendering

### DayTimeline Component (`src/components/DayTimeline.tsx`)

The timeline is a scrollable 24-hour view (0000–2359) that renders timing segments as positioned blocks.

### Positioning Algorithm

```
1. Compute midnightUTC = UTC millisecond of 00:00:00 on viewingDate in timezone
   (same binary search technique as nextMidnightInTZ)

2. For each TimingRun:
   topY     = (run.startUTC − midnightUTC) / 60,000 × (hourHeight / 60)
   heightPx = max(minBlockH, run.durationMs / 3,600,000 × hourHeight)

3. Overlap detection: greedy column assignment
   - Sort blocks by topY
   - For each block, find the leftmost column where it doesn't overlap
   - Divide available width among occupied columns
```

### Pinch-to-Zoom

`hourHeight` ranges from 16px (entire day fits on screen) to 720px (minute-level detail).

- **Native**: `Gesture.Pinch()` from react-native-gesture-handler + Reanimated shared values
- **Web**: `Ctrl/Cmd + scroll wheel` listener (also catches trackpad pinch)

Focal-point anchoring: the time under the pinch center stays fixed during zoom by adjusting the scroll position.

### Adaptive Grid

| hourHeight | Tick interval | Label interval |
|------------|--------------|----------------|
| ≥ 720 px/hr | 1 min | 10 min |
| ≥ 480 px/hr | 5 min | 15 min |
| ≥ 200 px/hr | 5 min | 30 min |
| ≥ 100 px/hr | 15 min | 30 min |
| ≥ 48 px/hr | 15 min | 1 hr |
| ≥ 24 px/hr | 30 min | 2 hr |
| < 24 px/hr | 60 min | 4 hr |

### Ghost Blocks

Runs shorter than the minimum block height (which scales with zoom) are inflated to stay visible. These "ghost" blocks render at reduced opacity (0.35) to signal that their visual size exceeds their actual duration.

### Block Details Modal

Tapping a completed block opens a modal showing: target name, ID, duration (HH:MM:SS), start/end times, and a delete button with inline confirmation.

---

## State Management

### HabitDataContext (`src/context/HabitDataContext.tsx`)

A single React Context holds all app state and mutations:

```
HabitDataCtx
├── Auth: uid, loading
├── Settings: settings (timezone), logicalToday, viewingDate
├── Collections (all from onSnapshot):
│   ├── routines: Routine[]
│   ├── goals: Goal[]
│   ├── entries: Entry[]          ← re-subscribes when viewingDate changes
│   ├── timingSegments: TimingSegment[]  ← re-subscribes when viewingDate changes
│   └── activeTimers: ActiveTimer[]
└── Mutations:
    ├── Routines: add, update, delete, reorderAll
    ├── Goals: add, update, delete, moveGoal
    ├── Entries: setGoalStatus
    ├── Settings: updateSettings
    └── Timers: startTimer, stopTimer, deleteRun
```

### Real-Time Sync

Every collection uses Firestore `onSnapshot`. When any device writes, all connected devices update within ~1 second. There is no local cache or Redux — Firestore is the single source of truth.

### Listener Lifecycle

- **Global listeners** (routines, goals, activeTimers, settings): subscribe once when `uid` is set, unsubscribe on sign-out.
- **Date-scoped listeners** (entries, timingSegments): re-subscribe whenever `viewingDate` changes, so only the viewed day's data is loaded.

---

## Authentication

### Supported Methods

| Method | Platform | Implementation |
|--------|----------|----------------|
| Google Sign-In | iOS/Android | `expo-auth-session` → `signInWithCredential` |
| Google Sign-In | Web | `signInWithPopup` (Firebase popup flow) |
| Phone (SMS) | iOS/Android | `expo-firebase-recaptcha` + `PhoneAuthProvider.verifyPhoneNumber` |

### Auth Flow

1. `App.tsx` subscribes to `onAuthStateChanged`
2. No user → show `LoginScreen`
3. User signs in → wrap app in `HabitDataProvider` → Firestore listeners start
4. Firestore security rules: `allow read, write: if request.auth != null && request.auth.uid == uid`

---

## Key Design Decisions

1. **Firestore as single source of truth** — no local Redux/state cache. All reads come from `onSnapshot`, all writes go to Firestore. This eliminates sync conflicts at the cost of requiring connectivity for writes.

2. **One TimingSegment doc per (target × date)** — keyed by targetId so upsert is a `setDoc` to a known path, not a query. Uses `arrayUnion` + `increment` for concurrent-write safety.

3. **Date-scoped subcollections** (`dates/{YYYY-MM-DD}/timingSegments/`) — loading a day's timing data is one collection read with no filtering. Want to purge old data? Delete the date node.

4. **Binary search for midnight** — avoids timezone rule databases. Works for any IANA timezone including DST edges. Provably correct.

5. **Tri-state completion** — `null` / `true` / `false` distinguishes "hasn't responded yet" from "explicitly failed." This matters for tracking adherence honestly.

6. **Denormalized goalIds in Routine** — avoids a second query to get the ordered list of goals for a routine. Trade-off: must update the array when goals are added/removed/reordered.

7. **Split-on-midnight for timers** — overnight sessions are split into per-day chunks at the timezone boundary. Each chunk is stored under its logical date. This keeps per-day queries correct without post-processing.

8. **Pinch-to-zoom with focal anchoring** — the timeline scales from day overview to minute detail. The point under your fingers stays fixed. Web uses Ctrl+wheel (standard pattern: Google Maps, Figma).

---

## Future Roadmap

- **Apple Shortcuts API** — Cloud Functions exposing start/stop timer, log completion, fetch stats. Enables "Hey Siri, start my morning routine" automation.
- **Analytics dashboard** — adherence rates, time averages, streak tracking, trend charts.
- **Push notifications** — reminders for routines at user-defined times.
- **Data export** — CSV/JSON export of entries and timing data.
