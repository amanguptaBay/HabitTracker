# Habit Tracker - Architecture & Data Model

This document outlines the detailed architecture, data model, and implementation strategy for the Habit Tracker application.

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Data Model](#data-model)
3. [Architecture](#architecture)
4. [API Endpoints](#api-endpoints)
5. [State Management](#state-management)
6. [Implementation Strategy](#implementation-strategy)

---

## Core Concepts

### Routines
- Collections of related habits (e.g., "Morning", "Misc")
- Track overall completion for the day (all required habits completed = ✅)
- Can have their own timers
- Support concurrent timers across contained habits

### Goals (Habits)
- Individual tasks/habits within a routine
- Each goal defines its own **success criteria** (e.g., "took it", "went to gym")
- Can be **required** (must complete for routine to be complete) or **optional** (no impact on routine status)
- Optionally track time spent

### Daily Entries
- Per-goal, per-day records
- Independent tracking of **completion** and **time spent**
  - You can log time without marking complete, or vice versa
- Support for notes and modification history

### Timers
- Track time spent on goals
- Support concurrent timers (multiple running simultaneously)
- Tied to a specific goal on a specific date
- Auto-save to daily entry when stopped

### Completion Status
- Each goal has a binary completion status per day
- Completion ≠ time spent (independent)
- Success is meeting the goal's defined success criteria
- Changes to status are tracked with timestamps

---

## Data Model

### Firestore Structure

```
/users/{userId}
  /profile
    - email: string
    - name: string
    - created_at: timestamp

  /routines/{routineId}
    - name: string
    - order: number (for sorting)
    - goals: [goalId, goalId, ...] (denormalized for quick access)
    - created_at: timestamp
    - updated_at: timestamp

  /goals/{goalId}
    - routine_id: string (reference)
    - name: string
    - description: string (fine-grained details)
    - success_criteria: string (what success looks like)
    - required: boolean (required for routine completion)
    - time_tracked: boolean (whether to track time)
    - created_at: timestamp
    - updated_at: timestamp

  /entries/{entryId}
    - goal_id: string
    - routine_id: string
    - user_id: string (for queries)
    - date: string (format: "YYYY-MM-DD")
    - completed: boolean
    - time_spent: number (minutes)
    - notes: string (optional)
    - created_at: timestamp
    - updated_at: timestamp
    - history: [
        {
          timestamp: timestamp,
          field: string (e.g., "completed", "time_spent"),
          old_value: any,
          new_value: any
        }
      ]

  /timers/{timerId}
    - goal_id: string
    - routine_id: string
    - date: string (date timer was created)
    - started_at: timestamp
    - paused_at: timestamp (null if running)
    - active: boolean (timer currently running)
    - created_at: timestamp
```

### Firestore Indexes

```
Collection: entries
  Index 1: (user_id, date) → query entries for a specific day
  Index 2: (user_id, goal_id, date) → query entries for a specific goal across dates

Collection: timers
  Index 1: (user_id, active) → query active timers
```

---

## Architecture

### Frontend Structure (React Native with Expo)

```
src/
├── components/
│   ├── TimerButton.tsx
│   ├── GoalCard.tsx
│   ├── RoutineCard.tsx
│   ├── CompletionToggle.tsx
│   └── ... (other reusable components)
│
├── screens/
│   ├── HomeScreen.tsx (today's routines/goals overview)
│   ├── RoutineDetailScreen.tsx (view & manage a routine)
│   ├── AnalyticsScreen.tsx (trends & insights)
│   ├── GoalSetupScreen.tsx (create/edit goals)
│   ├── RoutineSetupScreen.tsx (create/edit routines)
│   └── SettingsScreen.tsx
│
├── services/
│   ├── firebase.ts (Firebase config & initialization)
│   ├── routineService.ts (CRUD for routines)
│   ├── goalService.ts (CRUD for goals)
│   ├── entryService.ts (CRUD for entries)
│   ├── timerService.ts (timer logic)
│   └── analyticsService.ts (calculations & aggregations)
│
├── context/
│   ├── RoutineContext.tsx (routines state)
│   ├── GoalContext.tsx (goals state)
│   ├── EntryContext.tsx (daily entries state)
│   ├── TimerContext.tsx (active timers state)
│   └── UserContext.tsx (auth & user data)
│
├── utils/
│   ├── dateUtils.ts (date formatting, comparisons)
│   ├── timeUtils.ts (duration formatting, conversions)
│   ├── analyticsUtils.ts (adherence %, averages, trends)
│   └── validation.ts
│
└── types/
    └── index.ts (TypeScript interfaces for all data structures)
```

### Key Services

#### Timer Service
- Manages concurrent timers in memory
- Handles start/pause/stop/resume actions
- Saves to Firestore on stop
- Supports offline (persists to AsyncStorage)

#### Entry Service
- Create/update/delete daily entries
- Track modification history
- Calculate routine completion status
- Sync with Firestore

#### Analytics Service
- Calculate adherence rates (% of required habits completed)
- Calculate time averages per habit
- Generate trend data over time ranges
- Build timeline data for daily view

### State Management

Use React Context API + Custom Hooks for:
- Current user & auth state
- Today's routines and goals
- Today's entries and their status
- Active timers

Offline persistence:
- AsyncStorage for temporary data
- Firestore offline persistence for queries
- Manual sync when back online

---

## API Endpoints (Future)

For Apple Shortcuts integration:

### Authentication
```
POST /api/auth/token
  - Get Firebase token for headless requests
```

### Timer Operations
```
POST /api/timers/start
  { goal_id, routine_id, date }
  → Returns timer_id

POST /api/timers/{timerId}/stop
  → Returns { goal_id, time_spent }

POST /api/timers/{timerId}/pause
  → Pauses current timer

POST /api/timers/{timerId}/resume
  → Resumes paused timer

GET /api/timers/active
  → Returns all active timers for today
```

### Entry Operations
```
POST /api/entries
  { goal_id, routine_id, date, completed, time_spent, notes }
  → Creates/updates entry

PATCH /api/entries/{entryId}
  { completed?, time_spent?, notes? }
  → Updates existing entry

GET /api/entries?date=YYYY-MM-DD
  → Get all entries for a date
```

### Routine Operations
```
GET /api/routines/{routineId}/status?date=YYYY-MM-DD
  → Get routine completion status for date
  → Returns { completed: boolean, required_goals: n, completed_goals: n }
```

### Analytics
```
GET /api/analytics/adherence?goal_id=X&days=30
  → Returns adherence % for last N days

GET /api/analytics/average-time?goal_id=X&days=30
  → Returns average time spent (minutes)
```

---

## Implementation Strategy

### Phase 1: Core Data & Offline (Weeks 1-2)

- [x] Firestore structure & security rules
- [ ] User authentication (Firebase Auth)
- [ ] Routine CRUD (create, read, update, delete)
- [ ] Goal CRUD
- [ ] Daily Entry CRUD with history tracking
- [ ] Offline persistence setup
- [ ] Sync/conflict resolution logic

### Phase 2: UI & Timer (Weeks 3-4)

- [ ] Home screen (today's overview)
- [ ] Routine detail screen
- [ ] Timer UI & logic
- [ ] Entry creation/editing UI
- [ ] Completion toggle UI

### Phase 3: Analytics (Week 5)

- [ ] Analytics service (adherence, averages, trends)
- [ ] Analytics screen
- [ ] Daily timeline visualization

### Phase 4: Setup & Settings (Week 5-6)

- [ ] Goal setup flow
- [ ] Routine setup flow
- [ ] Settings screen
- [ ] Edit/delete flows

### Phase 5: API & Integration (Week 6-7)

- [ ] Cloud Functions for API endpoints
- [ ] Apple Shortcuts examples
- [ ] Testing & refinement

### Phase 6: Polish & Deploy (Week 7+)

- [ ] Testing across web/mobile
- [ ] Performance optimization
- [ ] Deploy to Firebase hosting (web) & app stores

---

## Key Design Decisions

1. **Independent Time & Completion**: Allows flexible logging (time without completion, or vice versa)

2. **Denormalized Goals in Routines**: Fetch goals without extra query; trade off storage efficiency for read speed

3. **Flat Entry Structure**: Easier to query entries by date or goal; avoids deep nesting

4. **History Array in Entries**: Audit trail without subcollections; simpler reads

5. **Concurrent Timers**: Support multi-tasking workflows naturally

6. **Offline-First with Cloud Sync**: Firestore offline persistence + manual sync handles network interruptions

7. **Required vs. Optional**: Simple boolean allows gradual habit building without breaking routines

8. **Custom Success Criteria**: Flexible per-habit definitions eliminate one-size-fits-all constraints

---

## Notes

- Use TypeScript throughout for type safety
- Implement proper Firebase security rules (user data isolation)
- Plan for data export/backup
- Consider privacy: all data stored in user's Firebase project
- Future: Consider data aggregation for trends (weekly, monthly summaries)
