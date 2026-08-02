-- Public forum archive snapshots.
-- The source history row can contain private context. The forum reads these
-- reviewed snapshots instead of exposing the original payload.

alter table public.student_history_records
  add column if not exists featured_excerpt jsonb,
  add column if not exists featured_feedback text;

comment on column public.student_history_records.featured_excerpt is
  'Anonymized public snapshot used by the forum; never the private source payload.';

comment on column public.student_history_records.featured_feedback is
  'Anonymized public coach feedback snapshot; private coach_feedback remains unchanged.';
