-- Let the peer wall carry the coach's written feedback, opt-in per row.
-- Run once in the Supabase SQL editor (or via `supabase db push`).
--
-- Why a separate flag instead of just showing coach_feedback whenever a row is
-- featured:
--
-- coach_feedback is written TO one student. Real examples from 2026-08-01
-- mention an elbow injury and a student's history of quitting on previous
-- coaches. Those are fine in a private thread and not fine on a wall the whole
-- roster reads — and "C1 学员" plus a specific stuck point is usually enough
-- for a classmate to work out who it is.
--
-- featured_angle stays what it always was: a line the coach writes FOR the
-- wall. This flag is the deliberate act of also publishing the private reply.

alter table public.student_history_records
  add column if not exists featured_include_feedback boolean not null default false;
