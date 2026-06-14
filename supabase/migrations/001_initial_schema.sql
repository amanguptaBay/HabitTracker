-- HabitTracker schema
-- Mirrors the Firestore document structure as relational tables.
-- All tables are scoped to auth.uid() via Row Level Security,
-- which replaces the custom auth middleware in the Cloud Functions.

-- ─── Extensions ────────────────────────────────────────────────────────────────

create extension if not exists "uuid-ossp";

-- ─── Tables ────────────────────────────────────────────────────────────────────

create table if not exists user_settings (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  timezone  text not null default 'UTC'
);

create table if not exists routines (
  id         text primary key,           -- kept as text to match Firestore IDs
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  "order"    integer not null default 0,
  goal_ids   text[] not null default '{}'  -- ordered array of goal IDs
);

create table if not exists goals (
  id                text primary key,
  user_id           uuid not null references auth.users(id) on delete cascade,
  routine_id        text not null references routines(id) on delete cascade,
  name              text not null,
  description       text,
  success_criteria  text,
  required          boolean not null default true
);

create table if not exists entries (
  id          text primary key,           -- "entry-{goalId}-{date}"
  user_id     uuid not null references auth.users(id) on delete cascade,
  goal_id     text not null references goals(id) on delete cascade,
  routine_id  text not null,
  date        date not null,              -- logical date in user's timezone
  completed   boolean,                   -- true=done, false=failed, null=no response
  notes       text
);

create table if not exists active_timers (
  target_id    text not null,
  user_id      uuid not null references auth.users(id) on delete cascade,
  target_type  text not null check (target_type in ('goal', 'routine')),
  started_at   timestamptz not null default now(),
  primary key (user_id, target_id)
);

create table if not exists timing_segments (
  user_id      uuid not null references auth.users(id) on delete cascade,
  target_id    text not null,
  target_type  text not null check (target_type in ('goal', 'routine')),
  date         date not null,
  total_ms     bigint not null default 0,
  segments     jsonb not null default '[]',  -- array of {startTime, endTime, durationMs}
  primary key (user_id, target_id, date)
);

-- ─── Indexes ───────────────────────────────────────────────────────────────────

create index if not exists entries_user_date     on entries (user_id, date);
create index if not exists routines_user_order   on routines (user_id, "order");
create index if not exists goals_user_routine    on goals (user_id, routine_id);
create index if not exists timing_user_date      on timing_segments (user_id, date);

-- ─── Row Level Security ────────────────────────────────────────────────────────
-- Each table is fully locked down: users can only see and modify their own rows.
-- This replaces the auth middleware in the Cloud Functions entirely.

alter table user_settings    enable row level security;
alter table routines         enable row level security;
alter table goals            enable row level security;
alter table entries          enable row level security;
alter table active_timers    enable row level security;
alter table timing_segments  enable row level security;

-- user_settings
create policy "own settings"  on user_settings  for all using (auth.uid() = user_id);

-- routines
create policy "own routines"  on routines       for all using (auth.uid() = user_id);

-- goals
create policy "own goals"     on goals          for all using (auth.uid() = user_id);

-- entries
create policy "own entries"   on entries        for all using (auth.uid() = user_id);

-- active_timers
create policy "own timers"    on active_timers  for all using (auth.uid() = user_id);

-- timing_segments
create policy "own segments"  on timing_segments for all using (auth.uid() = user_id);

-- ─── Auto-create user_settings row on sign-up ──────────────────────────────────

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.user_settings (user_id)
  values (new.id)
  on conflict do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
