-- Coach ↔ student direct messages (站内私信).
-- Run once in the Supabase SQL editor (or via `supabase db push`).
--
-- Scope decision (2026-08-01): coach ↔ student only. There is no
-- student ↔ student channel, so no reporting / blocking / moderation
-- surface is required.
--
-- Minors do not hold accounts: for underage students the account belongs to
-- the parent (see `account_holder` on the student manifest). Coach messages on
-- those threads are addressed to the guardian, about the child.
--
-- Privacy posture (coach decision, 2026-08-01): the student page is gated by a
-- short per-student credential with no rate limiting, so this channel is
-- treated as SEMI-PUBLIC by design. Do not put anything here that would be
-- damaging if read by someone other than the intended recipient.

create table if not exists public.student_messages (
  id uuid primary key default gen_random_uuid(),
  student_id text not null,
  -- 'coach_to_student' | 'student_to_coach'
  direction text not null check (direction in ('coach_to_student', 'student_to_coach')),
  body text not null check (length(btrim(body)) > 0),
  -- Optional provenance: links a coach message back to the history record it
  -- came from, so feedback written against a submission stays traceable.
  source_external_id text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists student_messages_thread_idx
  on public.student_messages (student_id, created_at desc);

create index if not exists student_messages_unread_idx
  on public.student_messages (student_id)
  where direction = 'coach_to_student' and read_at is null;

-- RLS: all access goes through server routes using the service role key.
-- No anon/authenticated policy is granted, so a leaked publishable key cannot
-- read anyone's thread directly.
alter table public.student_messages enable row level security;

revoke all on public.student_messages from anon, authenticated;
