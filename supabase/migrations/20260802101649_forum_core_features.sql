-- CLI-compatible consolidation of the four legacy forum migrations whose
-- filenames predate Supabase's required timestamp format. Statements remain
-- idempotent so this is safe if any section was applied manually.

alter table public.student_history_records
  add column if not exists featured boolean not null default false,
  add column if not exists featured_at timestamptz,
  add column if not exists featured_angle text,
  add column if not exists featured_category text,
  add column if not exists featured_tier text;

create index if not exists student_history_records_featured_idx
  on public.student_history_records (featured_at desc)
  where featured = true;

create table if not exists public.student_messages (
  id uuid primary key default gen_random_uuid(),
  student_id text not null,
  direction text not null check (direction in ('coach_to_student', 'student_to_coach')),
  body text not null check (length(btrim(body)) > 0),
  source_external_id text,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists student_messages_thread_idx
  on public.student_messages (student_id, created_at desc);
create index if not exists student_messages_unread_idx
  on public.student_messages (student_id)
  where direction = 'coach_to_student' and read_at is null;
alter table public.student_messages enable row level security;
revoke all on public.student_messages from anon, authenticated;

create table if not exists public.forum_comments (
  id uuid primary key default gen_random_uuid(),
  post_id text not null,
  display_name text not null check (length(btrim(display_name)) between 1 and 30),
  body text not null check (length(btrim(body)) between 1 and 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  student_id text,
  created_at timestamptz not null default now(),
  moderated_at timestamptz
);

create index if not exists forum_comments_approved_idx
  on public.forum_comments (post_id, created_at)
  where status = 'approved';
create index if not exists forum_comments_pending_idx
  on public.forum_comments (created_at)
  where status = 'pending';
alter table public.forum_comments enable row level security;
revoke all on public.forum_comments from anon, authenticated;

create table if not exists public.forum_posts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('discussion', 'meetup')),
  student_id text not null,
  display_name text not null check (length(btrim(display_name)) between 1 and 30),
  title text check (title is null or length(btrim(title)) <= 80),
  body text not null check (length(btrim(body)) between 1 and 2000),
  play_at timestamptz,
  location text check (location is null or length(btrim(location)) <= 80),
  players_needed smallint check (players_needed is null or players_needed between 1 and 20),
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists forum_posts_visible_idx
  on public.forum_posts (kind, created_at desc)
  where hidden = false;
create index if not exists forum_posts_meetup_idx
  on public.forum_posts (play_at)
  where kind = 'meetup' and hidden = false;
alter table public.forum_posts enable row level security;
revoke all on public.forum_posts from anon, authenticated;
