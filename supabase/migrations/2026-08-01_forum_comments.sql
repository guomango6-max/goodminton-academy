-- Forum comments on featured student submissions (学员精华墙评论).
-- Run once in the Supabase SQL editor (or via `supabase db push`).
--
-- Replaces the in-memory globalThis store in /api/forum-comment, which reset
-- on every server restart.
--
-- Moderation contract (unchanged from the demo store): a comment is written
-- as 'pending' and is never returned to readers until the coach approves it.
-- Nothing a student types reaches another student's screen unreviewed.

create table if not exists public.forum_comments (
  id uuid primary key default gen_random_uuid(),
  -- external_id of the featured student_history_records row being commented on.
  post_id text not null,
  -- Free-text display name the commenter typed. Not a verified identity —
  -- treat it as a label, never as proof of who wrote the comment.
  display_name text not null check (length(btrim(display_name)) between 1 and 30),
  body text not null check (length(btrim(body)) between 1 and 500),
  -- 'pending' | 'approved' | 'rejected'
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  -- Set when the comment came from a logged-in student page session, so the
  -- coach can see who wrote it even though readers only see display_name.
  student_id text,
  created_at timestamptz not null default now(),
  moderated_at timestamptz
);

-- Reader path: approved comments for a set of posts, newest last.
create index if not exists forum_comments_approved_idx
  on public.forum_comments (post_id, created_at)
  where status = 'approved';

-- Coach path: the moderation queue.
create index if not exists forum_comments_pending_idx
  on public.forum_comments (created_at)
  where status = 'pending';

-- RLS: every read and write goes through server routes holding the service
-- role key. No anon/authenticated policy is granted, so a leaked publishable
-- key cannot read the pending queue or write a pre-approved comment.
alter table public.forum_comments enable row level security;

revoke all on public.forum_comments from anon, authenticated;
