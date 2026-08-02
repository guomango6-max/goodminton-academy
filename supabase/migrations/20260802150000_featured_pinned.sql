-- 加精置顶：精选之上再分一档。
--
-- 全量上墙之后，墙会变长，而长墙的问题是所有内容看起来一样重要。
-- featured = 值得放上来；featured_pinned = 值得别人专门来看。
-- 前者可以多，后者必须少，否则置顶等于没置顶。

alter table public.student_history_records
  add column if not exists featured_pinned boolean not null default false;

-- 置顶项永远排在前面，因此单独给一个部分索引。
create index if not exists student_history_records_pinned_idx
  on public.student_history_records (featured_at desc)
  where featured = true and featured_pinned = true;

comment on column public.student_history_records.featured_pinned is
  'Pinned to the top of the peer wall. Keep this rare — everything pinned means nothing is.';
