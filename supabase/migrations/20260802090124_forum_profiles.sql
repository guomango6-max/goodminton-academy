-- Student-chosen public forum nicknames.
-- Identity still comes from the server-resolved student credential; clients
-- cannot attach a nickname to another student_id.

create table if not exists public.forum_profiles (
  student_id text primary key,
  nickname text not null check (char_length(btrim(nickname)) between 2 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists forum_profiles_nickname_unique_idx
  on public.forum_profiles (lower(nickname));

alter table public.forum_profiles enable row level security;
revoke all on public.forum_profiles from anon, authenticated;
