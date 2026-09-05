'use client';

// 一个时间流，四种内容属性：课后总结 / 比赛复盘 / 交流讨论 / 球友约球。
// 精选内容来自 /api/peer-feed，自发内容来自 /api/forum-posts；属性只用于
// 筛选，不把规模很小的学员社区切成四个空板块。

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLang, type Lang } from '../components/LangContext';
import ContactFooter from '../components/ContactFooter';
import type { PeerFeedItem } from '../../lib/peer-feed-types';
import { getForumPublishedDateLabel, sortForumFeedEntries } from '../../lib/forum-feed-sort.mjs';
import { validateForumNickname } from '../../lib/forum-nickname';
import { readStudentCredential, saveStudentSession } from '../../lib/student-session';

type ForumIdentity =
  | { kind: 'student'; label: string }
  | { kind: 'guest'; label: string };

const FORUM_IDENTITY_KEY = 'goodminton-forum-identity';

// 自发帖没有标题时，用正文首句顶上。
const SENTENCE_BREAK = new RegExp('[\r\n。！？!?]');

// 身份存两处，是有意的：
//   游客昵称  → localStorage。它不是凭据，忘掉它没有任何安全收益，只会让
//              同一个人这次叫「小王」下次叫「王同学」，留言前后对不上号。
//   学员身份  → sessionStorage。它由登录凭据换来，跨浏览器会话保留反而更糟
//              （共用设备时下一个人打开就是你）。
function saveIdentity(identity: ForumIdentity) {
  const raw = JSON.stringify(identity);
  try {
    if (identity.kind === 'guest') window.localStorage.setItem(FORUM_IDENTITY_KEY, raw);
    else window.sessionStorage.setItem(FORUM_IDENTITY_KEY, raw);
  } catch {
    // 隐私模式下写入会抛异常，忽略即可——只是这次不记住。
  }
}

function loadIdentity(): ForumIdentity | null {
  try {
    const raw =
      window.sessionStorage.getItem(FORUM_IDENTITY_KEY) || window.localStorage.getItem(FORUM_IDENTITY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ForumIdentity;
    return parsed?.kind === 'student' || parsed?.kind === 'guest' ? parsed : null;
  } catch {
    return null;
  }
}

function clearIdentity() {
  try {
    window.sessionStorage.removeItem(FORUM_IDENTITY_KEY);
    window.localStorage.removeItem(FORUM_IDENTITY_KEY);
  } catch {
    // 同上。
  }
}

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
    studentPage: '切换到学生页面',
    imStudent: '我是学员',
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
    pinned: '加精',
    gateBrowse: '先随便看看',
    gateNeedIdentity: '留言前先选个身份',
    filters: { all: '全部', lesson: '课后总结', match: '比赛复盘', discussion: '交流讨论', meetup: '球友约球' } as Record<string, string>,
    filterHint: {
      all: '四种内容按发布时间混在同一条流里。',
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
    nicknameLabel: '论坛昵称',
    nicknamePlaceholder: '给自己起个昵称（2–20 字）',
    nicknameHelp: '昵称会显示在你之后发布的交流和约球帖上。',
    nicknameSave: '保存昵称',
    nicknameSaved: '已保存',
    nicknameNeedLogin: '先在学员页登录，才能设置昵称。',
    nicknameFailed: '昵称保存失败。',
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
    studentPage: 'Student page',
    imStudent: "I'm a student",
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
    pinned: 'Editor’s pick',
    gateBrowse: 'Just browse for now',
    gateNeedIdentity: 'Choose an identity to comment',
    filters: { all: 'All', lesson: 'Lesson summaries', match: 'Match reviews', discussion: 'Discussion', meetup: 'Find players' } as Record<string, string>,
    filterHint: {
      all: 'All four content types share one stream, ordered by publication time.',
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
    nicknameLabel: 'Forum nickname',
    nicknamePlaceholder: 'Choose a nickname (2–20 characters)',
    nicknameHelp: 'Your nickname appears on discussion and meetup posts you publish after saving it.',
    nicknameSave: 'Save nickname',
    nicknameSaved: 'Saved',
    nicknameNeedLogin: 'Log in on the student page before setting a nickname.',
    nicknameFailed: 'Could not save nickname.',
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
    if (item.excerpt.reflection) paragraphs.push(item.excerpt.reflection);
    if (item.excerpt.question) paragraphs.push(item.excerpt.question);
  } else {
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
  identity,
  onNeedIdentity,
}: {
  postId: string;
  comments: ForumComment[];
  lang: Lang;
  identity: ForumIdentity | null | undefined;
  onNeedIdentity: () => void;
}) {
  const t = copy[lang];
  const [name, setName] = useState(identity?.label || '');
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
        body: JSON.stringify({
          postId,
          name: name.trim(),
          body: body.trim(),
          website: honeypot,
          ...(identity?.kind === 'student' ? { credential: readCredential() } : {}),
        }),
      });
      if (!response.ok) throw new Error('submit failed');
      setNotice('pending');
      setName(identity?.label || '');
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

      {!identity ? (
        <button
          type="button"
          onClick={onNeedIdentity}
          className="mt-4 w-full rounded-lg border border-[#cfe3d4] py-2.5 text-sm font-semibold text-[#0e6f4d] hover:bg-[#f2faf6]"
        >
          {t.gateNeedIdentity}
        </button>
      ) : (
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
      )}
    </div>
  );
}

// 论坛默认收起：一行一条，属性前置。19 条全展开是一堵内容墙，扫不动；
// 收起后一屏能看完全部标题，想看哪条点哪条。
function ThreadRow({
  open,
  onToggle,
  pinned,
  pinnedLabel,
  tag,
  tagTone,
  title,
  meta,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  pinned?: boolean;
  pinnedLabel: string;
  tag: string;
  tagTone: 'curated' | 'post';
  title: string;
  meta: string;
  children: React.ReactNode;
}) {
  return (
    <article className={`rounded-[8px] border bg-white ${open ? 'border-[#cfe3d4] shadow-[0_18px_40px_-32px_rgba(18,18,18,0.28)]' : 'border-[#e6e1d4]'}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start gap-2 px-4 py-3 text-left hover:bg-[#fbfaf6]"
      >
        {pinned ? (
          <span className="mt-[3px] shrink-0 rounded bg-[#fdf0d5] px-1.5 py-0.5 text-[11px] font-bold text-[#8a6212]">★ {pinnedLabel}</span>
        ) : null}
        <span
          className={`mt-[3px] shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold ${
            tagTone === 'curated' ? 'bg-[#e9fbf3] text-[#0e6f4d]' : 'bg-[#eef2f7] text-[#40525b]'
          }`}
        >
          {tag}
        </span>
        <span className="min-w-0 flex-1">
          <span className="cjk-wrap block text-[15px] font-semibold leading-6 text-[#101820]">{title}</span>
          <span className="mt-0.5 block text-[12px] text-[#8a969b]">{meta}</span>
        </span>
        <span aria-hidden="true" className="mt-1 shrink-0 text-[#a3aeb4]">{open ? '−' : '+'}</span>
      </button>
      {open ? <div className="border-t border-[#eee9dd] px-4 pb-4 pt-3">{children}</div> : null}
    </article>
  );
}

function HighlightCard({ item, lang, comments, identity, onNeedIdentity, open, onToggle }: { item: PeerFeedItem; lang: Lang; comments: ForumComment[]; identity: ForumIdentity | null | undefined; onNeedIdentity: () => void; open: boolean; onToggle: () => void }) {
  const t = copy[lang];
  const [expanded, setExpanded] = useState(false);

  const categoryLabel = t.category[item.category] || item.category;
  const tierLabel = t.anonStudent(item.tier);
  const typeLabel = item.submissionType === 'match' ? t.typeMatch : t.typeLesson;
  const contentTitle = item.submissionType === 'match'
    ? [item.excerpt.match, item.excerpt.score].filter(Boolean).join(' · ')
    : item.excerpt.title || '';
  const publishedLabel = getForumPublishedDateLabel(item);
  const paragraphs = buildParagraphs(item);
  const totalChars = paragraphs.reduce((sum, p) => sum + p.length, 0);
  const collapseLimit = 180;
  const showToggle = totalChars > collapseLimit;

  // 标题优先用教练拟的短标题；没有就退回导读（长，但至少每条不同），
  // 课次标题不能用——它会在多条之间重复。
  const rowTitle = item.title || item.angle;
  const meta = [categoryLabel, tierLabel, contentTitle, publishedLabel].filter(Boolean).join(' · ');

  return (
    <ThreadRow
      open={open}
      onToggle={onToggle}
      pinned={item.pinned}
      pinnedLabel={t.pinned}
      tag={typeLabel}
      tagTone="curated"
      title={rowTitle}
      meta={meta}
    >
      <div className="rounded-md border-l-4 border-[#14bf96] bg-[#f4f8f1] px-3 py-2">
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

      <CommentSection
        key={`${item.id}-${identity?.kind || 'none'}-${identity?.label || ''}`}
        postId={item.id}
        comments={comments}
        lang={lang}
        identity={identity}
        onNeedIdentity={onNeedIdentity}
      />
    </ThreadRow>
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

type ContentKind = 'lesson' | 'match' | 'discussion' | 'meetup';
type ContentFilter = 'all' | ContentKind;
const FILTERS: ContentFilter[] = ['all', 'lesson', 'match', 'discussion', 'meetup'];

type FeedEntry =
  | { source: 'curated'; kind: 'lesson' | 'match'; sortAt: string; pinned: boolean; item: PeerFeedItem }
  | { source: 'post'; kind: 'discussion' | 'meetup'; sortAt: string; pinned: boolean; post: ForumPost };

// 学员凭据由 lib/student-session 统一读写。发帖读它，服务端再据此解析
// 身份——客户端传什么名字都不作数。
function readCredential() {
  try {
    return readStudentCredential();
  } catch {
    return '';
  }
}

function ForumEntryGate({ lang, onEnter, onBrowse }: { lang: Lang; onEnter: (identity: ForumIdentity) => void; onBrowse: () => void }) {
  const [mode, setMode] = useState<'student' | 'guest' | ''>('');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const entry = new URLSearchParams(window.location.search).get('entry');
    if (entry !== 'guest' && entry !== 'student') return;
    const timer = window.setTimeout(() => setMode(entry), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!mode || busy) return;
    setError('');

    if (mode === 'guest') {
      const checked = validateForumNickname(value);
      if (checked.error) {
        setError(checked.error);
        return;
      }
      const identity: ForumIdentity = { kind: 'guest', label: checked.nickname };
      saveIdentity(identity);
      onEnter(identity);
      return;
    }

    const credential = value.trim();
    if (!credential) return;
    setBusy(true);
    try {
      const response = await fetch('/api/student-data', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ studentId: credential, accessCode: '' }),
      });
      const payload = (await response.json().catch(() => ({}))) as { student?: { name?: string }; error?: string };
      if (!response.ok || !payload.student) throw new Error(payload.error || '学员 ID 不正确。');
      // 连同学员快照一起存：学生页靠快照决定「已登录」，只存凭据的话从论坛
      // 切过去还会再被问一次 ID——而这恰恰是头部那个入口最常走的路。
      saveStudentSession(credential, JSON.stringify(payload.student));

      let nickname = '';
      const profileResponse = await fetch('/api/forum-profile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ credential }),
      }).catch(() => null);
      if (profileResponse?.ok) {
        const profile = (await profileResponse.json().catch(() => ({}))) as { nickname?: string };
        nickname = profile.nickname || '';
      }

      const identity: ForumIdentity = {
        kind: 'student',
        label: nickname || (lang === 'zh' ? '学员' : 'Student'),
      };
      saveIdentity(identity);
      onEnter(identity);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '登录失败。');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-[#10261f]/45 px-4 py-8 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="forum-entry-title" className="w-full max-w-md rounded-2xl border border-[#d9e5dc] bg-[#fffdf8] p-5 shadow-[0_28px_80px_rgba(10,36,27,.28)] sm:p-6">
        <p className="text-xs font-bold tracking-wide text-[#16845f]">GOODMINTON FORUM</p>
        <h1 id="forum-entry-title" className="mt-2 text-2xl font-semibold text-[#101820]">
          {lang === 'zh' ? '你以什么身份进入？' : 'How would you like to enter?'}
        </h1>
        <p className="mt-2 text-sm leading-6 text-[#64737a]">
          {lang === 'zh' ? '学员可以发帖和留言；游客可以浏览和留言。' : 'Students can post and comment. Guests can browse and comment.'}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button type="button" onClick={() => { setMode('student'); setValue(''); setError(''); }} className={`min-h-20 rounded-xl border p-3 text-left ${mode === 'student' ? 'border-[#14bf96] bg-[#e8f7f1]' : 'border-[#dfe7dc] bg-white'}`}>
            <span className="block text-base font-bold text-[#1f4a38]">{lang === 'zh' ? '我是学员' : 'Student'}</span>
            <span className="mt-1 block text-xs text-[#64737a]">{lang === 'zh' ? '使用学员 ID' : 'Use student ID'}</span>
          </button>
          <button type="button" onClick={() => { setMode('guest'); setValue(''); setError(''); }} className={`min-h-20 rounded-xl border p-3 text-left ${mode === 'guest' ? 'border-[#14bf96] bg-[#e8f7f1]' : 'border-[#dfe7dc] bg-white'}`}>
            <span className="block text-base font-bold text-[#1f4a38]">{lang === 'zh' ? '我是游客' : 'Guest'}</span>
            <span className="mt-1 block text-xs text-[#64737a]">{lang === 'zh' ? '设置一个昵称' : 'Choose a nickname'}</span>
          </button>
        </div>
        {mode ? (
          <form onSubmit={submit} className="mt-4 space-y-3">
            <input
              type="text"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder={mode === 'student' ? (lang === 'zh' ? '学员 ID' : 'Student ID') : (lang === 'zh' ? '游客昵称（2–20 字）' : 'Guest nickname')}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              autoFocus
              maxLength={mode === 'guest' ? 20 : 80}
              className="h-12 w-full rounded-lg border border-[#cfe3d4] bg-white px-3 text-[15px] outline-none focus:border-[#14bf96]"
            />
            <button type="submit" disabled={busy || !value.trim()} className="h-12 w-full rounded-lg bg-[#0e6f4d] text-sm font-bold text-white disabled:opacity-50">
              {busy ? (lang === 'zh' ? '验证中…' : 'Checking…') : (lang === 'zh' ? '进入论坛' : 'Enter forum')}
            </button>
          </form>
        ) : null}
        {error ? <p className="mt-3 text-sm text-[#b42318]">{error}</p> : null}
        <button
          type="button"
          onClick={onBrowse}
          className="mt-4 block w-full rounded-lg border border-[#cfe3d4] py-2.5 text-center text-sm font-semibold text-[#0e6f4d] hover:bg-[#f2faf6]"
        >
          {copy[lang].gateBrowse}
        </button>
        <Link href="/" className="mt-3 inline-block text-sm text-[#64737a] hover:text-[#1f4a38]">
          ← {lang === 'zh' ? '返回首页' : 'Back home'}
        </Link>
      </section>
    </div>
  );
}

function PostCard({ post, lang, onDelete, open, onToggle }: { post: ForumPost; lang: Lang; onDelete: (id: string) => void; open: boolean; onToggle: () => void }) {
  const t = copy[lang];
  const isMeetup = post.kind === 'meetup';
  // 自发帖有标题就用标题；没有就拿正文首句顶上，别让列表出现空行。
  const rowTitle =
    post.title || post.body.split(SENTENCE_BREAK)[0].slice(0, 40) || post.body.slice(0, 40);
  const meta = [
    post.display_name,
    isMeetup && post.play_at ? `${t.meetupAt} ${new Date(post.play_at).toLocaleString()}` : '',
    isMeetup && post.location ? post.location : '',
    isMeetup && post.players_needed ? t.meetupNeed(post.players_needed) : '',
    new Date(post.created_at).toLocaleDateString(),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <ThreadRow open={open} onToggle={onToggle} pinnedLabel={t.pinned} tag={t.filters[post.kind]} tagTone="post" title={rowTitle} meta={meta}>
      {isMeetup ? (
        <p className="text-[14px] text-[#0e6f4d]">
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
    </ThreadRow>
  );
}

function NicknameEditor({ lang }: { lang: Lang }) {
  const t = copy[lang];
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const credential = readCredential();
    if (!credential) return;
    let active = true;
    void fetch('/api/forum-profile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ credential }),
    })
      .then(async (response) => (await response.json()) as { nickname?: string })
      .then((payload) => {
        if (active && payload.nickname) setNickname(payload.nickname);
      })
      .catch(() => null);
    return () => {
      active = false;
    };
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const credential = readCredential();
    if (!credential) {
      setNotice(t.nicknameNeedLogin);
      return;
    }
    if (busy || !nickname.trim()) return;

    setBusy(true);
    setNotice('');
    try {
      const response = await fetch('/api/forum-profile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ credential, nickname }),
      });
      const payload = (await response.json().catch(() => ({}))) as { nickname?: string; error?: string };
      if (!response.ok) throw new Error(payload.error || t.nicknameFailed);
      setNickname(payload.nickname || nickname.trim());
      setNotice(t.nicknameSaved);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t.nicknameFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="mt-6 rounded-lg border border-[#dfe7dc] bg-[#f4f8f1] p-4">
      <label htmlFor="forum-nickname" className="text-sm font-bold text-[#1f4a38]">
        {t.nicknameLabel}
      </label>
      <p className="mt-1 text-[13px] leading-5 text-[#64737a]">{t.nicknameHelp}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          id="forum-nickname"
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          minLength={2}
          maxLength={20}
          placeholder={t.nicknamePlaceholder}
          className="h-10 min-w-0 flex-1 rounded-lg border border-[#cfe3d4] bg-white px-3 text-[15px] text-[#21242c] outline-none focus:border-[#14bf96]"
        />
        <button
          type="submit"
          disabled={busy || nickname.trim().length < 2}
          className="press h-10 rounded-lg bg-[#0e6f4d] px-4 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? t.composeSubmitting : t.nicknameSave}
        </button>
      </div>
      {notice ? <p className="mt-2 text-[13px] text-[#52636b]">{notice}</p> : null}
    </form>
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
  const [comments, setComments] = useState<Record<string, ForumComment[]>>({});
  const [activeFilter, setActiveFilter] = useState<ContentFilter>('all');
  // 同时只展开一条：点开几条之后又变回内容墙，收起就白收了。
  const [openId, setOpenId] = useState('');
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [postsLoaded, setPostsLoaded] = useState(false);
  const [identity, setIdentity] = useState<ForumIdentity | null | undefined>(undefined);
  // 论坛挂在主导航上，任何人点进来都该先看到内容。身份只在「要动手」时才问：
  // 一个想了解教练的访客，不该先被一张表单挡住。
  const [browsing, setBrowsing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const timer = window.setTimeout(async () => {
      const saved = loadIdentity();
      if (saved) {
        setIdentity(saved);
        return;
      }

      // 已经在学员页登录过的人，不该在这里再输一遍学员 ID。凭据同源存在
      // sessionStorage 里，直接拿它换昵称、自动认成学员身份。
      // 不需要新接口——/api/forum-profile 本来就接受凭据。
      const credential = readCredential();
      if (!credential) {
        if (!cancelled) setIdentity(null);
        return;
      }

      try {
        const response = await fetch('/api/forum-profile', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify({ credential }),
        });
        if (!response.ok) throw new Error('unauthorized');
        const payload = (await response.json()) as { nickname?: string };
        if (cancelled) return;
        const auto: ForumIdentity = {
          kind: 'student',
          label: payload.nickname || (lang === 'zh' ? '学员' : 'Student'),
        };
        saveIdentity(auto);
        setIdentity(auto);
      } catch {
        // 凭据失效或接口不可用 → 退回正常的身份门，不把人卡住。
        if (!cancelled) setIdentity(null);
      }
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [lang]);

  function switchIdentity() {
    clearIdentity();
    setIdentity(null);
  }

  const feedEntries: FeedEntry[] = sortForumFeedEntries([
    ...items.map((item): FeedEntry => ({
      source: 'curated',
      kind: item.submissionType,
      // 精选内容显示的是发布时间；课程发生日在原始学员记录里保留，不参与论坛时间线。
      sortAt: item.featuredAt,
      pinned: Boolean(item.pinned),
      item,
    })),
    ...posts.map((post): FeedEntry => ({
      source: 'post',
      kind: post.kind,
      sortAt: post.created_at,
      pinned: false,
      post,
    })),
  ].filter((entry) => activeFilter === 'all' || entry.kind === activeFilter));

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
      })
      .finally(() => {
        if (active) setPostsLoaded(true);
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
        // 带上语言：英文版由服务端换成 featured_en 里的译文，没翻到的字段
        // 仍然回中文原文。
        const response = await fetch(`/wall-data?limit=20&lang=${lang}`);
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
    // 语言变了要重新拉一次：译文在服务端替换，切语言不重拉就还是旧语言的内容。
  }, [lang]);

  return (
    <div className={`min-h-screen overflow-x-hidden bg-[#fbfaf6] text-[#21242c] ${lang === 'zh' ? 'goodminton-zh' : ''}`}>
      {identity === null && !browsing ? (
        <ForumEntryGate lang={lang} onEnter={setIdentity} onBrowse={() => setBrowsing(true)} />
      ) : null}
      <header className="sticky top-0 z-40 border-b border-[#e6e1d4] bg-[#fbfaf6]/92 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[980px] items-center gap-3 px-4 py-3 sm:gap-5 sm:px-5 sm:py-4">
          <Link href="/" className="text-[15px] font-medium text-[#121212] hover:text-[#16845f]">
            ← {t.backHome}
          </Link>
          <span className="ml-auto hidden text-[15px] font-medium text-[#64737a] sm:inline">{t.brand}</span>
          {/* 学员登录后，头部这个位置最有用的动作是回自己的学生页，不是换身份——
              换身份几乎没人用。访客还没有学生页可去，对他们保留身份门入口。 */}
          {identity?.kind === 'student' ? (
            <Link href="/student" className="rounded-[8px] border border-[#b9ddca] bg-[#edf8f2] px-3 py-2 text-sm font-semibold text-[#0e6f4d] hover:bg-[#e3f4eb]">
              {t.studentPage}
            </Link>
          ) : identity ? (
            <button type="button" onClick={switchIdentity} className="rounded-[8px] border border-[#b9ddca] bg-[#edf8f2] px-3 py-2 text-sm font-semibold text-[#0e6f4d] hover:bg-[#e3f4eb]">
              {t.imStudent}
            </button>
          ) : null}
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

      <main className="mx-auto w-full max-w-[980px] px-4 pb-20 pt-7 sm:px-5 sm:pb-16 sm:pt-10">
        <p className="text-[13px] font-semibold text-[#16845f]">{t.kicker}</p>
        <h1 className="cjk-wrap mt-2 text-[34px] font-semibold leading-tight tracking-[-0.015em] text-[#101820]">{t.title}</h1>
        <p className="cjk-wrap mt-4 max-w-[640px] text-[16px] leading-8 text-[#52636b]">{t.desc}</p>

        {usingDemo ? (
          <p className="mt-5 inline-block rounded-[6px] border border-[#e8d9a0] bg-[#fdf6dd] px-3 py-1.5 text-[13px] font-semibold text-[#7a6420]">
            {t.demoNote}
          </p>
        ) : null}

        <nav className="mt-7 flex flex-wrap gap-2 border-b border-[#e6e1d4] pb-3" aria-label={lang === 'zh' ? '按内容属性筛选' : 'Filter by content type'}>
          {FILTERS.map((key) => {
            const active = activeFilter === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActiveFilter(key)}
                aria-pressed={active}
                className={`press rounded-[8px] px-3 py-1.5 text-[15px] font-semibold transition-colors ${
                  active ? 'bg-[#e8f7f1] text-[#0e6f4d]' : 'text-[#52636b] hover:text-[#0e6f4d]'
                }`}
              >
                {t.filters[key]}
              </button>
            );
          })}
        </nav>
        <p className="cjk-wrap mt-3 text-[14px] leading-6 text-[#8a969b]">{t.filterHint[activeFilter]}</p>

        {(activeFilter === 'discussion' || activeFilter === 'meetup') && identity?.kind === 'student' ? (
          <>
            <NicknameEditor lang={lang} />
            <Composer kind={activeFilter} lang={lang} onPosted={loadPosts} />
          </>
        ) : activeFilter === 'discussion' || activeFilter === 'meetup' ? (
          <p className="mt-6 rounded-lg border border-[#dfe7dc] bg-[#f4f8f1] p-4 text-sm text-[#52636b]">
            {lang === 'zh' ? '游客可以浏览和留言；发布交流或约球帖需要切换为学员身份。' : 'Guests can browse and comment. Switch to a student identity to publish discussions or meetups.'}
          </p>
        ) : null}

        {loaded && postsLoaded && feedEntries.length === 0 ? (
          <p className="cjk-wrap mt-8 rounded-md border border-[#e6e1d4] bg-[#f8f6ef] px-4 py-3 text-[15px] leading-7 text-[#52636b]">
            {activeFilter === 'lesson' || activeFilter === 'match' ? t.emptyNote : t.postsEmpty}
          </p>
        ) : (
          <div className="mt-6 grid gap-2">
            {feedEntries.map((entry) =>
              entry.source === 'curated' ? (
                <HighlightCard
                  key={`curated:${entry.item.id}`}
                  item={entry.item}
                  lang={lang}
                  comments={comments[entry.item.id] || []}
                  identity={identity}
                  onNeedIdentity={() => setBrowsing(false)}
                  open={openId === `curated:${entry.item.id}`}
                  onToggle={() =>
                    setOpenId((current) => (current === `curated:${entry.item.id}` ? '' : `curated:${entry.item.id}`))
                  }
                />
              ) : (
                <PostCard
                  key={`post:${entry.post.id}`}
                  post={entry.post}
                  lang={lang}
                  onDelete={deletePost}
                  open={openId === `post:${entry.post.id}`}
                  onToggle={() => setOpenId((current) => (current === `post:${entry.post.id}` ? '' : `post:${entry.post.id}`))}
                />
              ),
            )}
          </div>
        )}

        <p className="cjk-wrap mt-10 border-t border-[#e6e1d4] pt-5 text-[13px] leading-6 text-[#8a969b]">{t.optOutNote}</p>
      </main>

      <ContactFooter lang={lang} />
    </div>
  );
}
