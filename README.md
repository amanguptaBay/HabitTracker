# Habit Tracker

A personal habit and time tracking application designed to help you build routines, track daily progress, and gain insights into your habits and time allocation.

## Overview

Habit Tracker lets you organize habits into routines (e.g., Morning, Misc), track completion status, log time spent on each activity, and view analytics about your adherence and time patterns. Future integration with Apple Shortcuts enables automation through your device's native tools.

## Key Features

- **Routine-Based Organization**: Group related habits into routines for better structure
- **Completion Tracking**: Track daily progress with custom success criteria per habit
- **Concurrent Time Tracking**: Start/stop multiple timers simultaneously across different habits
- **Flexible Completion Levels**: Required vs. optional habits with clear success definitions
- **Historical Data**: Track habits over time with full history of changes
- **Offline Support**: Works seamlessly offline with automatic cloud sync
- **Analytics & Insights**:
  - Adherence rates (how consistent are you?)
  - Time averages (how long does each habit take?)
  - Daily timeline visualization
  - Historical trends
- **Editable History**: Correct times and completion status retroactively with audit trails
- **API Integration**: Future Apple Shortcuts automation via API endpoints

## Tech Stack

- **Frontend**: React Native with Expo (single codebase for web & mobile)
- **Backend**: Firebase (Firestore database)
- **Real-time Sync**: Firestore real-time listeners with offline persistence
- **Hosting**: Firebase
- **Automation**: Apple Shortcuts (future integration via API)

## Project Structure

```
habit-tracker/
├── app/                    # Expo app entry
├── src/
│   ├── components/        # Reusable UI components
│   ├── screens/           # App screens (home, routine, analytics, etc.)
│   ├── services/          # Firebase, API, storage services
│   ├── context/           # State management (routines, timers, entries)
│   ├── utils/             # Helpers, date utilities, calculations
│   └── types/             # TypeScript types
├── README.md             # This file
└── PLAN.md               # Detailed architecture & data model
```

## Getting Started

See `PLAN.md` for detailed architecture, data model, and implementation strategy.

## Future Roadmap

- Apple Shortcuts integration (start/stop timers, log data, fetch stats)
- Analytics dashboards with charts and trends
- Goal templates and import/export
- Social features (optional: share progress)
- Push notifications and reminders
