-- RPC functions for atomic timing segment operations.
-- These replace Firestore's arrayUnion + increment which aren't available in Postgres.

-- Enable real-time for all tables
alter publication supabase_realtime add table routines;
alter publication supabase_realtime add table goals;
alter publication supabase_realtime add table entries;
alter publication supabase_realtime add table active_timers;
alter publication supabase_realtime add table timing_segments;
alter publication supabase_realtime add table user_settings;

-- Atomically appends a timing run and increments total_ms.
create or replace function append_timing_run(
  p_target_id   text,
  p_target_type text,
  p_date        date,
  p_start_time  text,   -- ISO 8601 string
  p_end_time    text,
  p_duration_ms bigint
) returns void language plpgsql security definer as $$
declare
  v_run jsonb;
begin
  v_run := jsonb_build_object(
    'startTime',  p_start_time,
    'endTime',    p_end_time,
    'durationMs', p_duration_ms
  );

  insert into timing_segments (user_id, target_id, target_type, date, total_ms, segments)
  values (auth.uid(), p_target_id, p_target_type, p_date, p_duration_ms, jsonb_build_array(v_run))
  on conflict (user_id, target_id, date) do update
    set total_ms = timing_segments.total_ms + p_duration_ms,
        segments = timing_segments.segments || jsonb_build_array(v_run);
end;
$$;
