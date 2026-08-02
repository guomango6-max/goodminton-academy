-- Peer Wall (其他学员墙) — coach-curated featured submissions visible to all students.
-- Run once in the Supabase SQL editor (or via `supabase db push`).
--
-- Adds 5 columns + 1 partial index to student_history_records.
-- All columns are optional / default-safe so existing rows continue to work.

alter table public.student_history_records
  add column if not exists featured boolean not null default false,
  add column if not exists featured_at timestamptz,
  add column if not exists featured_angle text,           -- 教练导读 / Coach framing (one line)
  add column if not exists featured_category text,        -- 'correction' | 'drill_seed' | 'honest_stuck' | 'good_question'
  add column if not exists featured_tier text;            -- Anonymous level tier label, e.g. 'C2', 'B1'

-- Partial index so the peer-feed query stays fast even with thousands of rows.
create index if not exists student_history_records_featured_idx
  on public.student_history_records (featured_at desc)
  where featured = true;
