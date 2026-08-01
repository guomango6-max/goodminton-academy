'use client';

// 学员精华 (Student Highlights) — public wall of coach-curated student submissions.
// Reads /api/peer-feed (same sanitized source as the student-page peer wall) and
// falls back to demo items when the feed is empty, so the page always renders.
// Comments are name-only + coach moderation; the demo API keeps them in memory.

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useLang, type Lang } from '../components/LangContext';
import ContactFooter from '../components/ContactFooter';
import type { PeerFeedItem } from '../../lib/peer-feed-types';

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
    kicker: '学员精华',
    title: '真实的课后总结，配教练导读',
    desc: '由教练从学员的课后总结和比赛复盘里精选，匿名展示。看别人怎么卡住、怎么想通，比只看正确动作更有用。',
    demoNote: '示例数据（演示）——正式内容由教练每周精选后发布。',
    optOutNote: '内容经教练精选并匿名化展示。如不希望自己的总结出现在这里，告诉教练即可。',
    coachAngle: '教练导读',
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
    } as Record<string, string>,
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
    kicker: 'Student highlights',
    title: 'Real lesson notes, with coach framing',
    desc: 'Curated by the coach from student lesson summaries and match reviews, shown anonymously. Seeing how others get stuck and think it through beats only seeing perfect form.',
    demoNote: 'Demo data — real highlights are published weekly by the coach.',
    optOutNote: 'Content is coach-curated and anonymized. If you prefer your notes stay private, just tell the coach.',
    coachAngle: 'Coach note',
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
    } as Record<string, string>,
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

      <CommentSection postId={item.id} comments={comments} lang={lang} />
    </article>
  );
}

export default function ForumPage() {
  const { lang, toggle } = useLang();
  const t = copy[lang];
  const [items, setItems] = useState<PeerFeedItem[]>([]);
  const [usingDemo, setUsingDemo] = useState(false);
  const [comments, setComments] = useState<Record<string, ForumComment[]>>({});

  useEffect(() => {
    let isMounted = true;

    async function loadFeed() {
      try {
        const response = await fetch('/api/peer-feed?limit=20');
        const payload = (await response.json()) as { items?: PeerFeedItem[] };
        if (!isMounted) return;
        if (response.ok && payload.items?.length) {
          setItems(payload.items);
        } else {
          setItems(DEMO_ITEMS);
          setUsingDemo(true);
        }
      } catch {
        if (!isMounted) return;
        setItems(DEMO_ITEMS);
        setUsingDemo(true);
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

        <div className="mt-8 grid gap-6">
          {items.map((item) => (
            <HighlightCard key={item.id} item={item} lang={lang} comments={comments[item.id] || []} />
          ))}
        </div>

        <p className="cjk-wrap mt-10 border-t border-[#e6e1d4] pt-5 text-[13px] leading-6 text-[#8a969b]">{t.optOutNote}</p>
      </main>

      <ContactFooter lang={lang} />
    </div>
  );
}
