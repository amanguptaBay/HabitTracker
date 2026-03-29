# Ritual — Habit & Time Tracker

A personal habit and time-tracking app built with React Native (Expo) and Firebase. Organize habits into routines, track tri-state completion, log time with concurrent timers, and review your day on a zoomable 24-hour timeline.

## What It Does

- **Routines & Habits** — group habits into ordered routines (e.g. Morning, Evening). Each habit can be required or optional, with its own success criteria.
- **Tri-State Completion** — every habit is either done (green), failed (red), or no response (neutral). This is tracked per-habit, per-day.
- **Concurrent Timers** — start/stop timers on any habit or routine. Timers persist in Firestore and sync across devices in real time.
- **Day Timeline** — view your day as a zoomable 0000–2359 calendar. Timing segments render as colour-coded blocks at their exact start time, with overlap tiling and adaptive grid granularity.
- **Timezone-Aware Rollover** — the logical day boundary is midnight in your chosen IANA timezone. Timers that run past midnight are automatically split across days.
- **Date Navigation** — browse any historical date with arrow buttons or a calendar picker.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React Native + Expo (managed workflow) |
| Database | Cloud Firestore (Firebase JS SDK v12) |
| Auth | Firebase Auth (Google Sign-In) |
| Real-time sync | Firestore `onSnapshot` listeners |
| State | React Context (`HabitDataProvider`) |
| Drag & drop | `react-native-draggable-flatlist` |
| Animations | `react-native-reanimated` 4.x |
| Gestures | `react-native-gesture-handler` 2.30 |

## Running Locally

```bash
npm install
npx expo start          # Expo dev server
# Press 'w' for web, 'i' for iOS simulator
```

Requires a Firebase project with Firestore and Auth enabled. Config lives in `src/services/firebase.ts`.

## Project Structure

```
src/
├── components/
│   ├── DayTimeline.tsx       # Zoomable 24-hour calendar view
│   ├── DayStartSetting.tsx   # Timezone picker (modal)
│   ├── GoalCard.tsx          # Habit row: name + timer + tri-state slider
│   ├── RoutineCard.tsx       # Routine header + nested goals
│   ├── TimerButton.tsx       # Start/stop with live elapsed display
│   └── TriStateSlider.tsx    # Done / failed / neutral toggle
├── context/
│   └── HabitDataContext.tsx   # Single context for all Firestore state + mutations
├── screens/
│   ├── HomeScreen.tsx         # Routines list + timeline toggle + date nav
│   ├── ManageScreen.tsx       # CRUD + drag-to-reorder + timezone settings
│   └── LoginScreen.tsx        # Google + phone auth
├── services/
│   ├── firebase.ts            # Firebase app init
│   ├── firestoreService.ts    # All Firestore listeners, reads, and writes
│   └── auth.ts                # Auth helpers (Google, phone, sign-out)
├── utils/
│   └── date.ts                # getLogicalDate, nextMidnightInTZ, splitByLogicalDay
├── types/
│   └── index.ts               # All TypeScript interfaces
└── navigation/
    └── types.ts               # React Navigation param list
```

## Data Model

See [`PLAN.md`](PLAN.md) for the full data model, Firestore schema, timer lifecycle, and timezone handling.
