'use client';

// 学员精华 (Student Highlights) — public wall of coach-curated student submissions.
// Reads /api/peer-feed (same sanitized source as the student-page peer wall) and
// falls back to demo items when the feed is empty, so the page always renders.
// Comments are name-only + coach moderation; the demo API keeps them in memory.

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLang, type Lang } from '../components/LangContext';
import ContactFooter from '../components/ContactFooter';
import { PEER_FEED_CATEGORIES, type PeerFeedItem } from '../../lib/peer-feed-types';

type ForumComment = {
  id: string;
  postId: string;
  name: string;
  body: string;
  createdAt: string;
};

const DEMO_ITEMS: PeerFeedItem[] = [
  {
    id: 'mock-correction-1',
    featuredAt: '2026-05-30T14:23:00Z',
    category: 'correction',
    angle: '她敢承认接发后第二拍总是慢半拍——先注意自己慢，比直接练快更重要。',
    tier: 'C2',
    submissionType: 'match',
    happenedAt: '2026-05-29',
    excerpt: {
      match: '周末双打练习赛',
      score: '21-18 / 17-21',
      whatWorked: '上半局拉吊结合用得不错。',
      nextAdjustment:
        '今天打练习赛发现接发后我总是站着等下一拍。教练之前提醒过我接发完要主动上前压网，但实际打的时候大脑没切换过来。第二局对手吃透了这个习惯，连续靠这点打了我 4 个分。',
      experience: '接发完成的那一拍就要心里默念"上"。',
    },
  },
  {
    id: 'mock-drill-2',
    featuredAt: '2026-05-28T10:00:00Z',
    category: 'drill_seed',
    angle: '这个"重心往下 + 打到地上"是个好 drill 雏形，可以系统化做。',
    tier: 'B1',
    submissionType: 'lesson',
    happenedAt: '2026-05-28',
    excerpt: {
      title: '接杀防守',
      reflection: '今天教练说我接杀总是站太高，让我练习重心往下、把球打到地上的感觉。',
      question: '想多练几种接杀回球的路线。',
    },
  },
  {
    id: 'mock-stuck-3',
    featuredAt: '2026-05-27T10:00:00Z',
    category: 'honest_stuck',
    angle: '"我就是练不会反手"——承认卡点本身已经是进步。',
    tier: 'C2',
    submissionType: 'lesson',
    happenedAt: '2026-05-27',
    excerpt: {
      title: '反手训练',
      reflection: '我就是练不会反手高远球，每次都打不到位，想放弃。',
      question: '反手有没有什么循序渐进的练法？',
    },
  },
];

const copy = {
  zh: {
    brand: 'Goodminton Academy',
    backHome: '返回首页',
    kicker: 'Goodminton 论坛',
    title: '一起练，一起想明白',
    desc: '教练精选的课后总结和比赛复盘、学员之间的交流，还有约球。看别人怎么卡住、怎么想通，比只看正确动作更有用。',
    demoNote: '示例数据（演示）——正式内容由教练每周精选后发布。',
    emptyNote: '教练还没有精选内容。每周训练之后会陆续更新，欢迎再来看。',
    optOutNote: '内容经教练精选并匿名化展示。如不希望自己的总结出现在这里，告诉教练即可。',
    coachAngle: '教练导读',
    coachFeedback: '教练点评',
    anonStudent: (tier: string) => (tier ? `${tier} 学员` : '学员'),
    typeLesson: '课后总结',
    typeMatch: '比赛复盘',
    expand: '展开完整',
    collapse: '收起',
    category: {
      correction: '纠错点',
      drill_seed: 'Drill 种子',
      honest_stuck: '诚实的卡住点',
      good_question: '好问题',
      breakthrough: '想通了',
    } as Record<string, string>,
    filterAll: '全部',
    tabs: { lesson: '课后总结', match: '比赛复盘', discussion: '交流讨论', meetup: '球友约球' } as Record<string, string>,
    tabHint: {
      lesson: '教练从学员课后总结里精选，匿名展示。',
      match: '教练从比赛复盘里精选，匿名展示。',
      discussion: '学员自己发的话题。实名，发出即可见。',
      meetup: '缺人就发一条。写清时间、地点、缺几个，过期自动下墙。',
    } as Record<string, string>,
    postsEmpty: '还没有内容，来发第一条。',
    composeTitle: '标题（可选）',
    composeBody: '想说的话',
    composeMeetupBody: '补充说明，比如水平、场地费、带不带球',
    composePlayAt: '开打时间',
    composeLocation: '地点',
    composeNeeded: '缺几人',
    composeSubmit: '发布',
    composeSubmitting: '发布中…',
    composeNeedLogin: '发帖需要先在学员页登录。登录后回到这里即可。',
    composeFailed: '发布失败。',
    postDelete: '删除',
    meetupAt: '开打',
    meetupNeed: (n: number) => `缺 ${n} 人`,
    commentsTitle: '留言',
    commentsEmpty: '还没有留言。',
    commentName: '你的名字',
    commentBody: '想说的话或想问的问题',
    commentSubmit: '提交留言',
    commentSubmitting: '提交中…',
    commentPending: '已提交，教练审核通过后会显示在这里。',
    commentError: '提交失败，请稍后重试。',
    commentRequired: '名字和内容都要填。',
  },
  en: {
    brand: 'Goodminton Academy',
    backHome: 'Back to home',
    kicker: 'Goodminton Forum',
    title: 'Train together, think it through together',
    desc: 'Coach-curated lesson summaries and match reviews, student talk, and games to join. Seeing how others get stuck and think it through beats only seeing perfect form.',
    demoNote: 'Demo data — real highlights are published weekly by the coach.',
    emptyNote: 'The coach has not featured anything yet. New highlights go up after each week of training — check back soon.',
    optOutNote: 'Content is coach-curated and anonymized. If you prefer your notes stay private, just tell the coach.',
    coachAngle: 'Coach note',
    coachFeedback: 'Coach feedback',
    anonStudent: (tier: string) => (tier ? `${tier} Student` : 'A student'),
    typeLesson: 'Lesson summary',
    typeMatch: 'Match review',
    expand: 'Show full',
    collapse: 'Collapse',
    category: {
      correction: 'Correction',
      drill_seed: 'Drill seed',
      honest_stuck: 'Honest stuck point',
      good_question: 'Good question',
      breakthrough: 'Broke through',
    } as Record<string, string>,
    filterAll: 'All',
    tabs: { lesson: 'Lesson summaries', match: 'Match reviews', discussion: 'Discussion', meetup: 'Find players' } as Record<string, string>,
    tabHint: {
      lesson: 'Coach-curated from student lesson summaries, shown anonymously.',
      match: 'Coach-curated from match reviews, shown anonymously.',
      discussion: 'Posted by students under their own name, visible immediately.',
      meetup: 'Short a player? Post the time, the place, and how many you need. Expired posts drop off.',
    } as Record<string, string>,
    postsEmpty: 'Nothing here yet — post the first one.',
    composeTitle: 'Title (optional)',
    composeBody: 'What do you want to say?',
    composeMeetupBody: 'Anything else — level, court fee, who brings shuttles',
    composePlayAt: 'When',
    composeLocation: 'Where',
    composeNeeded: 'Players needed',
    composeSubmit: 'Post',
    composeSubmitting: 'Posting…',
    composeNeedLogin: 'Log in on the student page first, then come back here to post.',
    composeFailed: 'Could not post.',
    postDelete: 'Delete',
    meetupAt: 'Plays',
    meetupNeed: (n: number) => `needs ${n}`,
    commentsTitle: 'Comments',
    commentsEmpty: 'No comments yet.',
    commentName: 'Your name',
    commentBody: 'A thought or a question',
    commentSubmit: 'Submit',
    commentSubmitting: 'Submitting…',
    commentPending: 'Submitted. It will appear here once the coach approves it.',
    commentError: 'Submission failed. Please try again later.',
    commentRequired: 'Both name and message are required.',
  },
};

function buildParagraphs(item: PeerFeedItem): string[] {
  const paragraphs: string[] = [];
  if (item.submissionType === 'lesson') {
    if (item.excerpt.title) paragraphs.push(`【${item.excerpt.title}】`);
    if (item.excerpt.reflection) paragraphs.push(item.excerpt.reflection);
    if (item.excerpt.question) paragraphs.push(item.excerpt.question);
  } else {
    if (item.excerpt.match) paragraphs.push(`${item.excerpt.match}${item.excerpt.score ? ` · ${item.excerpt.score}` : ''}`);
    if (item.excerpt.whatWorked) paragraphs.push(item.excerpt.whatWorked);
    if (item.excerpt.nextAdjustment) paragraphs.push(item.excerpt.nextAdjustment);
    if (item.excerpt.experience) paragraphs.push(item.excerpt.experience);
  }
  return paragraphs;
}

function ExcerptParagraphs({ paragraphs, expanded, charLimit }: { paragraphs: string[]; expanded: boolean; charLimit: number }) {
  if (expanded) {
    return (
      <>
        {paragraphs.map((p, i) => (
          <p key={i} className={i > 0 ? 'mt-2' : ''}>
            {p}
          </p>
        ))}
      </>
    );
  }
  let used = 0;
  const trimmed: string[] = [];
  for (const p of paragraphs) {
    if (used >= charLimit) break;
    const remaining = charLimit - used;
    if (p.length <= remaining) {
      trimmed.push(p);
      used += p.length;
    } else {
      trimmed.push(p.slice(0, remaining) + '…');
      used = charLimit;
      break;
    }
  }
  return (
    <>
      {trimmed.map((p, i) => (
        <p key={i} className={i > 0 ? 'mt-2' : ''}>
          {p}
        </p>
      ))}
    </>
  );
}

function CommentSection({
  postId,
  comments,
  lang,
}: {
  postId: string;
  comments: ForumComment[];
  lang: Lang;
}) {
  const t = copy[lang];
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [honeypot, setHoneypot] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState<'pending' | 'error' | 'required' | ''>('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    if (!name.trim() || !body.trim()) {
      setNotice('required');
      return;
    }
    setSubmitting(true);
    setNotice('');
    try {
      const response = await fetch('/api/forum-comment', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ postId, name: name.trim(), body: body.trim(), website: honeypot }),
      });
      if (!response.ok) throw new Error('submit failed');
      setNotice('pending');
      setName('');
      setBody('');
    } catch {
      setNotice('error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-4 border-t border-[#e6e1d4] pt-4">
      <p className="text-[13px] font-semibold text-[#40525b]">{t.commentsTitle}</p>
      {comments.length ? (
        <ul className="mt-3 space-y-3">
          {comments.map((comment) => (
            <li key={comment.id} className="rounded-[8px] bg-[#f4f7f1] px-3 py-2.5">
              <p className="text-[13px] font-semibold text-[#1f4a38]">
                {comment.name}
                <span className="ml-2 font-normal text-[#8a969b]">{comment.createdAt.slice(0, 10)}</span>
              </p>
              <p className="cjk-wrap mt-1 text-[14px] leading-6 text-[#52636b]">{comment.body}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[13px] text-[#8a969b]">{t.commentsEmpty}</p>
      )}

      <form onSubmit={handleSubmit} className="mt-4 grid gap-2">
        {/* Honeypot: hidden from humans, bots fill it and get silently dropped. */}
        <input
          value={honeypot}
          onChange={(event) => setHoneypot(event.target.value)}
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="hidden"
        />
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder={t.commentName}
          maxLength={30}
          className="h-10 rounded-[8px] border border-[#cfe8d9] bg-white px-3 text-[14px] text-[#101820] outline-none transition-colors placeholder:text-[#8a969b] focus:border-[#14bf96]"
        />
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder={t.commentBody}
          maxLength={500}
          rows={2}
          className="rounded-[8px] border border-[#cfe8d9] bg-white px-3 py-2 text-[14px] leading-6 text-[#101820] outline-none transition-colors placeholder:text-[#8a969b] focus:border-[#14bf96]"
        />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="press inline-flex h-9 items-center rounded-[6px] bg-[#dff4ea] px-4 text-[13px] font-semibold text-[#1f4a38] transition-colors hover:bg-[#cbeedd] disabled:cursor-not-allowed disabled:text-[#768c7d]"
          >
            {submitting ? t.commentSubmitting : t.commentSubmit}
          </button>
          {notice === 'pending' ? <p className="text-[13px] text-[#16845f]">{t.commentPending}</p> : null}
          {notice === 'error' ? <p className="text-[13px] text-[#b42318]">{t.commentError}</p> : null}
          {notice === 'required' ? <p className="text-[13px] text-[#b42318]">{t.commentRequired}</p> : null}
        </div>
      </form>
    </div>
  );
}

function HighlightCard({ item, lang, comments }: { item: PeerFeedItem; lang: Lang; comments: ForumComment[] }) {
  const t = copy[lang];
  const [expanded, setExpanded] = useState(false);

  const categoryLabel = t.category[item.category] || item.category;
  const tierLabel = t.anonStudent(item.tier);
  const typeLabel = item.submissionType === 'match' ? t.typeMatch : t.typeLesson;
  const happenedLabel = item.happenedAt ? item.happenedAt.slice(0, 10) : item.featuredAt.slice(0, 10);
  const paragraphs = buildParagraphs(item);
  const totalChars = paragraphs.reduce((sum, p) => sum + p.length, 0);
  const collapseLimit = 180;
  const showToggle = totalChars > collapseLimit;

  return (
    <article className="rounded-[8px] border border-[#dfe7dc] bg-white p-5 shadow-[0_18px_40px_-32px_rgba(18,18,18,0.28)]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[#e9fbf3] px-2.5 py-0.5 text-xs font-semibold text-[#0e6f4d]">{categoryLabel}</span>
        <span className="text-xs text-[#64737a]">{tierLabel}</span>
        <span className="text-xs text-[#a3aeb4]">·</span>
        <span className="text-xs text-[#64737a]">{happenedLabel}</span>
        <span className="text-xs text-[#a3aeb4]">·</span>
        <span className="text-xs text-[#64737a]">{typeLabel}</span>
      </div>

      <div className="mt-3 rounded-md border-l-4 border-[#14bf96] bg-[#f4f8f1] px-3 py-2">
        <div className="text-xs font-semibold text-[#0e6f4d]">{t.coachAngle}</div>
        <div className="cjk-wrap mt-1 text-sm leading-6 text-[#21242c]">{item.angle}</div>
      </div>

      {paragraphs.length ? (
        <div className="cjk-wrap mt-3 text-sm leading-6 text-[#52636b]">
          <ExcerptParagraphs paragraphs={paragraphs} expanded={expanded} charLimit={collapseLimit} />
        </div>
      ) : null}

      {showToggle ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="mt-3 text-sm font-medium text-[#16845f] hover:text-[#0e5a40]"
        >
          {expanded ? t.collapse : t.expand}
        </button>
      ) : null}

      {/* Present only when the coach opted this row in — see
          featured_include_feedback. Private by default. */}
      {item.coachFeedback ? (
        <div className="mt-3 rounded-md border border-[#cfe3d4] bg-[#f9fdf9] px-3 py-2">
          <div className="text-xs font-semibold text-[#0e6f4d]">{t.coachFeedback}</div>
          <div className="cjk-wrap mt-1 whitespace-pre-wrap text-sm leading-6 text-[#21242c]">
            {item.coachFeedback}
          </div>
        </div>
      ) : null}

      <CommentSection postId={item.id} comments={comments} lang={lang} />
    </article>
  );
}

type ForumPost = {
  id: string;
  kind: 'discussion' | 'meetup';
  student_id: string;
  display_name: string;
  title: string | null;
  body: string;
  play_at: string | null;
  location: string | null;
  players_needed: number | null;
  created_at: string;
};

type TabKey = 'lesson' | 'match' | 'discussion' | 'meetup';
const TABS: TabKey[] = ['lesson', 'match', 'discussion', 'meetup'];

// 学员凭据存在学员页登录时写的 sessionStorage 里。发帖读它，
// 服务端再据此解析身份——客户端传什么名字都不作数。
const STUDENT_CREDENTIAL_KEY = 'goodminton-student-credential';

function readCredential() {
  try {
    return window.sessionStorage.getItem(STUDENT_CREDENTIAL_KEY) || '';
  } catch {
    return '';
  }
}

function PostCard({ post, lang, onDelete }: { post: ForumPost; lang: Lang; onDelete: (id: string) => void }) {
  const t = copy[lang];
  const isMeetup = post.kind === 'meetup';
  return (
    <article className="rounded-lg border border-[#e6e1d4] bg-white p-5">
      <div className="flex flex-wrap items-baseline gap-2 text-[13px] text-[#64737a]">
        <span className="font-semibold text-[#21242c]">{post.display_name}</span>
        <span>· {new Date(post.created_at).toLocaleDateString()}</span>
        {isMeetup && post.players_needed ? (
          <span className="rounded bg-[#e8f7f1] px-1.5 py-0.5 font-semibold text-[#0e6f4d]">
            {t.meetupNeed(post.players_needed)}
          </span>
        ) : null}
      </div>

      {post.title ? <h3 className="cjk-wrap mt-2 text-[17px] font-semibold text-[#101820]">{post.title}</h3> : null}

      {isMeetup ? (
        <p className="mt-2 text-[14px] text-[#0e6f4d]">
          {t.meetupAt}：{post.play_at ? new Date(post.play_at).toLocaleString() : ''}
          {post.location ? ` · ${post.location}` : ''}
        </p>
      ) : null}

      <p className="cjk-wrap mt-2 whitespace-pre-wrap text-[15px] leading-7 text-[#52636b]">{post.body}</p>

      <button
        type="button"
        onClick={() => onDelete(post.id)}
        className="mt-3 text-[13px] text-[#8a969b] hover:text-[#c0392b]"
      >
        {t.postDelete}
      </button>
    </article>
  );
}

function Composer({ kind, lang, onPosted }: { kind: 'discussion' | 'meetup'; lang: Lang; onPosted: () => void }) {
  const t = copy[lang];
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [playAt, setPlayAt] = useState('');
  const [location, setLocation] = useState('');
  const [needed, setNeeded] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !body.trim()) return;
    const credential = readCredential();
    if (!credential) {
      setError(t.composeNeedLogin);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/forum-posts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          credential,
          kind,
          title: title.trim(),
          body: body.trim(),
          ...(kind === 'meetup'
            ? { playAt, location: location.trim(), playersNeeded: Number(needed) || undefined }
            : {}),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || t.composeFailed);
      setTitle('');
      setBody('');
      setPlayAt('');
      setLocation('');
      setNeeded('');
      onPosted();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.composeFailed);
    } finally {
      setBusy(false);
    }
  }

  const field =
    'w-full rounded-lg border border-[#e6e1d4] bg-white px-3 py-2 text-[15px] text-[#21242c] outline-none focus:border-[#9fb7a7]';

  return (
    <form onSubmit={submit} className="mt-6 space-y-2 rounded-lg border border-[#e6e1d4] bg-[#fdfcf8] p-4">
      <input value={title} onChange={(e) => setTitle(e.target.value)} className={field} placeholder={t.composeTitle} maxLength={80} />
      {kind === 'meetup' ? (
        <div className="grid gap-2 sm:grid-cols-3">
          <input type="datetime-local" value={playAt} onChange={(e) => setPlayAt(e.target.value)} className={field} />
          <input value={location} onChange={(e) => setLocation(e.target.value)} className={field} placeholder={t.composeLocation} maxLength={80} />
          <input type="number" min={1} max={20} value={needed} onChange={(e) => setNeeded(e.target.value)} className={field} placeholder={t.composeNeeded} />
        </div>
      ) : null}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        maxLength={2000}
        className={field}
        placeholder={kind === 'meetup' ? t.composeMeetupBody : t.composeBody}
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={busy || !body.trim()}
          className="press rounded-[8px] border border-[#d8d0bf] bg-white px-3 py-1.5 text-[14px] font-semibold text-[#40525b] transition-colors hover:border-[#9fb7a7] disabled:opacity-50"
        >
          {busy ? t.composeSubmitting : t.composeSubmit}
        </button>
        {error ? <span className="text-[13px] text-[#c0392b]">{error}</span> : null}
      </div>
    </form>
  );
}

export default function ForumPage() {
  const { lang, toggle } = useLang();
  const t = copy[lang];
  const [items, setItems] = useState<PeerFeedItem[]>([]);
  const [usingDemo, setUsingDemo] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // '' = 全部。一个流 + 属性筛选，不分板块：27 人的规模撑不起多个板块，
  // 空板块比没有板块更伤。
  const [activeCategory, setActiveCategory] = useState('');
  const [comments, setComments] = useState<Record<string, ForumComment[]>>({});
  const [tab, setTab] = useState<TabKey>('lesson');
  const [posts, setPosts] = useState<ForumPost[]>([]);

  const curatedTab = tab === 'lesson' || tab === 'match';
  // 总结 / 复盘 是同一批精选内容按来源分；record_type 早就在数据里。
  const tabItems = items.filter((item) => item.submissionType === (tab === 'match' ? 'match' : 'lesson'));

  // Order follows PEER_FEED_CATEGORIES so the chips do not reshuffle as the
  // feed changes; only categories with at least one post are offered.
  const presentCategories = PEER_FEED_CATEGORIES.filter((category) =>
    tabItems.some((item) => item.category === category),
  );
  const visibleItems = activeCategory
    ? tabItems.filter((item) => item.category === activeCategory)
    : tabItems;

  const loadPosts = useCallback(async () => {
    try {
      const response = await fetch('/api/forum-posts');
      const payload = (await response.json()) as { posts?: ForumPost[] };
      setPosts(payload.posts || []);
    } catch {
      setPosts([]);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void fetch('/api/forum-posts')
      .then(async (response) => (await response.json()) as { posts?: ForumPost[] })
      .then((payload) => {
        if (active) setPosts(payload.posts || []);
      })
      .catch(() => {
        if (active) setPosts([]);
      });
    return () => {
      active = false;
    };
  }, []);

  async function deletePost(id: string) {
    const credential = readCredential();
    if (!credential) return;
    await fetch('/api/forum-posts', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, credential }),
    }).catch(() => null);
    void loadPosts();
  }

  const tabPosts = posts.filter((post) => post.kind === tab);

  useEffect(() => {
    let isMounted = true;

    // The demo posts are invented. This page is linked from the site nav and
    // is headed "真实的课后总结", so showing them to a visitor by default would
    // be a straight-up false claim. They are kept for previewing the layout
    // and now require an explicit ?demo=1.
    const wantsDemo = new URLSearchParams(window.location.search).get('demo') === '1';

    async function loadFeed() {
      function fallback() {
        if (wantsDemo) {
          setItems(DEMO_ITEMS);
          setUsingDemo(true);
        } else {
          setItems([]);
        }
      }

      try {
        const response = await fetch('/api/peer-feed?limit=20');
        const payload = (await response.json()) as { items?: PeerFeedItem[] };
        if (!isMounted) return;
        if (response.ok && payload.items?.length) {
          setItems(payload.items);
        } else {
          fallback();
        }
      } catch {
        if (!isMounted) return;
        fallback();
      } finally {
        if (isMounted) setLoaded(true);
      }
    }

    async function loadComments() {
      try {
        const response = await fetch('/api/forum-comment');
        const payload = (await response.json()) as { comments?: Record<string, ForumComment[]> };
        if (response.ok && payload.comments && isMounted) {
          setComments(payload.comments);
        }
      } catch {
        // Comments are optional; the wall still renders without them.
      }
    }

    void loadFeed();
    void loadComments();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className={`min-h-screen overflow-x-hidden bg-[#fbfaf6] text-[#21242c] ${lang === 'zh' ? 'goodminton-zh' : ''}`}>
      <header className="sticky top-0 z-40 border-b border-[#e6e1d4] bg-[#fbfaf6]/92 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[860px] items-center gap-4 px-5 py-4">
          <Link href="/" className="text-[15px] font-medium text-[#121212] hover:text-[#16845f]">
            ← {t.backHome}
          </Link>
          <span className="ml-auto text-[15px] font-medium text-[#64737a]">{t.brand}</span>
          <button
            type="button"
            onClick={toggle}
            aria-label={lang === 'zh' ? 'Switch to English' : '切换到中文'}
            className="press h-9 shrink-0 rounded-[8px] border border-[#d8d0bf] bg-white px-3 text-sm font-semibold text-[#40525b] transition-colors hover:border-[#9fb7a7]"
          >
            {lang === 'zh' ? 'EN' : '中文'}
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[860px] px-5 pb-16 pt-10">
        <p className="text-[13px] font-semibold text-[#16845f]">{t.kicker}</p>
        <h1 className="cjk-wrap mt-2 text-[34px] font-semibold leading-tight tracking-[-0.015em] text-[#101820]">{t.title}</h1>
        <p className="cjk-wrap mt-4 max-w-[640px] text-[16px] leading-8 text-[#52636b]">{t.desc}</p>

        {usingDemo ? (
          <p className="mt-5 inline-block rounded-[6px] border border-[#e8d9a0] bg-[#fdf6dd] px-3 py-1.5 text-[13px] font-semibold text-[#7a6420]">
            {t.demoNote}
          </p>
        ) : null}

        <nav className="mt-7 flex flex-wrap gap-2 border-b border-[#e6e1d4] pb-3">
          {TABS.map((key) => {
            const active = tab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setTab(key);
                  setActiveCategory('');
                }}
                aria-pressed={active}
                className={`press rounded-[8px] px-3 py-1.5 text-[15px] font-semibold transition-colors ${
                  active ? 'bg-[#e8f7f1] text-[#0e6f4d]' : 'text-[#52636b] hover:text-[#0e6f4d]'
                }`}
              >
                {t.tabs[key]}
              </button>
            );
          })}
        </nav>
        <p className="cjk-wrap mt-3 text-[14px] leading-6 text-[#8a969b]">{t.tabHint[tab]}</p>

        {!curatedTab ? (
          <>
            <Composer kind={tab === 'meetup' ? 'meetup' : 'discussion'} lang={lang} onPosted={loadPosts} />
            {tabPosts.length === 0 ? (
              <p className="cjk-wrap mt-6 rounded-md border border-[#e6e1d4] bg-[#f8f6ef] px-4 py-3 text-[15px] leading-7 text-[#52636b]">
                {t.postsEmpty}
              </p>
            ) : (
              <div className="mt-6 grid gap-4">
                {tabPosts.map((post) => (
                  <PostCard key={post.id} post={post} lang={lang} onDelete={deletePost} />
                ))}
              </div>
            )}
          </>
        ) : loaded && tabItems.length === 0 ? (
          <p className="cjk-wrap mt-8 rounded-md border border-[#e6e1d4] bg-[#f8f6ef] px-4 py-3 text-[15px] leading-7 text-[#52636b]">
            {t.emptyNote}
          </p>
        ) : (
          <>
            {/* Chips are built from the categories actually present, so a filter
                never leads to an empty result — the reason for not splitting
                this into boards in the first place. Hidden below two kinds,
                where filtering buys nothing. */}
            {presentCategories.length > 1 ? (
              <div className="mt-7 flex flex-wrap gap-2">
                {['', ...presentCategories].map((value) => {
                  const active = activeCategory === value;
                  return (
                    <button
                      key={value || 'all'}
                      type="button"
                      onClick={() => setActiveCategory(value)}
                      aria-pressed={active}
                      className={`press rounded-full border px-3 py-1 text-[13px] font-semibold transition-colors ${
                        active
                          ? 'border-[#14bf96] bg-[#e8f7f1] text-[#0e6f4d]'
                          : 'border-[#e6e1d4] bg-white text-[#52636b] hover:border-[#9fb7a7]'
                      }`}
                    >
                      {value ? t.category[value] || value : t.filterAll}
                    </button>
                  );
                })}
              </div>
            ) : null}

            <div className="mt-8 grid gap-6">
              {visibleItems.map((item) => (
                <HighlightCard key={item.id} item={item} lang={lang} comments={comments[item.id] || []} />
              ))}
            </div>
          </>
        )}

        <p className="cjk-wrap mt-10 border-t border-[#e6e1d4] pt-5 text-[13px] leading-6 text-[#8a969b]">{t.optOutNote}</p>
      </main>

      <ContactFooter lang={lang} />
    </div>
  );
}
