-- 论坛的学员自发帖：交流 + 约球。
-- 在 Supabase SQL Editor 里执行（也已并入 supabase/APPLY-PENDING.sql）。
--
-- 与精选墙的关键差别——两者共用一个页面，但性质相反：
--
--   总结 / 复盘   教练把学员的私人文字发布出去 → 必须匿名，只留等级档
--   交流 / 约球   学员自己发布自己的话         → 必须实名，否则约球没法约
--
-- 审核策略也相反。精选墙的审核发生在「教练选它」那一刻；这里做不到，
-- 因为约球是有时效的——一条等你批准的约球帖等于废帖。所以改成事后审核：
-- 登录学员发出即可见，教练可随时隐藏。27 个彼此认识的实名学员，事前审核
-- 是过度设计，而且会直接把功能扼杀掉。

create table if not exists public.forum_posts (
  id uuid primary key default gen_random_uuid(),
  -- 'discussion' 交流 | 'meetup' 约球
  kind text not null check (kind in ('discussion', 'meetup')),
  -- 由服务端从登录凭据解析得出，不接受客户端传入。
  student_id text not null,
  display_name text not null check (length(btrim(display_name)) between 1 and 30),
  title text check (title is null or length(btrim(title)) <= 80),
  body text not null check (length(btrim(body)) between 1 and 2000),

  -- 仅约球使用
  play_at timestamptz,
  location text check (location is null or length(btrim(location)) <= 80),
  players_needed smallint check (players_needed is null or players_needed between 1 and 20),

  -- 事后审核：教练隐藏，作者也可删自己的（走 DELETE）
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

-- 读取路径：按类型取未隐藏的，新的在前。
create index if not exists forum_posts_visible_idx
  on public.forum_posts (kind, created_at desc)
  where hidden = false;

-- 约球按开打时间取，过期的在查询层过滤掉。
create index if not exists forum_posts_meetup_idx
  on public.forum_posts (play_at)
  where kind = 'meetup' and hidden = false;

alter table public.forum_posts enable row level security;
revoke all on public.forum_posts from anon, authenticated;
