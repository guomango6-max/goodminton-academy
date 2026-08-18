'use client';

// Coach console. Three jobs that previously had no UI at all and could only be
// done by hand-rolling curl calls:
//
//   1. 精选 — put a student submission on the peer wall (公开)
//   2. 审核评论 — approve or reject comments before anyone sees them
//   3. 私信 — the private coach ↔ student thread (专属)
//
// 学员提交这一块是一个列表 + 四个标签（待处理 / 已处理 / 墙上 / 全部），
// 每条渲染成同一个 SubmissionCard：看原文、写点评、上墙、标记已处理都在卡内。
// 2026-08-16 之前是三个并列的区，同一条记录在待处理区和精选区各画一遍，
// 想回话得滚到页面底部在一百条里重新找——见 SubmissionCard 上的注释。
//
// The coach token is typed in here and kept in sessionStorage only: never in
// a file, never in the repo, gone when the tab closes. Every request below is
// rejected server-side without it.
//
// /coach is disallowed in robots.ts.

import React, { useCallback, useEffect, useState } from 'react';
import { resolveExcerpt } from '@/lib/peer-feed-excerpt';

const TOKEN_KEY = 'goodminton-coach-token';

type Submission = {
  external_id: string;
  student_id: string;
  record_type: string;
  title: string | null;
  happened_at: string | null;
  // 接口一直有返回，只是此前没在类型里声明。待处理区要显示「提交于」，
  // 因为 happened_at 是课次日期，不是提交时间——学员常常隔天补写。
  created_at?: string | null;
  // 'website' = 学员自己写的；'data/students' = 从 Obsidian 库回填的课次记录。
  source?: string | null;
  featured: boolean | null;
  featured_angle: string | null;
  featured_category: string | null;
  featured_tier: string | null;
  coach_feedback: string | null;
  // 非空 = 教练处理完了（可能回复了，也可能看过决定不回话）。撤回置 null。
  // 整个字段 undefined 表示迁移还没跑，此时 isPending 回落到旧规则。
  coach_handled_at?: string | null;
  // 后加的列，接口取不到时为 undefined——按「没置顶」显示，不猜。
  featured_pinned?: boolean | null;
  payload?: unknown;
  featured_excerpt?: unknown;
};

// 待处理判定。coach_handled_at 是权威；库里还没这一列时退回旧规则，
// 教练台不能因为迁移没跑就空着。
function isPending(submission: Submission) {
  if (submission.source !== 'website') return false;

  // 上墙即已处理，无条件出队。
  //
  // 单看 coach_handled_at 会漏：那一列只有 /api/student-submission/feature 会写，
  // 而 scripts/feature-peer-wall.mjs 精选时只写 featured，不写它。于是一条已经
  // 公开在墙上的记录，会带着 NULL 的 coach_handled_at 赖在待处理队列里——
  // 「上墙了怎么还在待处理」就是这么来的。
  // 迁移 20260813120000 的回填能救历史数据，救不了它之后每一次跑脚本。
  if (submission.featured) return false;

  if (submission.coach_handled_at === undefined) {
    return !submission.coach_feedback;
  }
  return !submission.coach_handled_at;
}

// 学员原文在墙上、翻译里、教练台里必须取同一批字段，否则看到的和发出去的不是一份。
const EXCERPT_LABELS: Record<string, string> = {
  title: '课程',
  reflection: '课后总结',
  question: '想学 / 提问',
  match: '比赛',
  score: '比分',
  whatWorked: '打得好的',
  nextAdjustment: '下次调整',
  experience: '整体感受',
};

type PendingComment = {
  id: string;
  post_id: string;
  display_name: string;
  body: string;
  student_id: string | null;
  created_at: string;
};

type Message = {
  id: string;
  from: 'coach' | 'student';
  body: string;
  createdAt: string;
};

type Thread = {
  studentId: string;
  name: string;
  accountHolder: 'parent' | 'student';
  lastMessage: string;
  lastFrom: 'coach' | 'student';
  lastAt: string;
  awaitingCoachReply: boolean;
  // 整段对话跟着列表一起来（接口那边封顶 30 条）。迁移没跑的旧响应里没有这个
  // 字段，所以是可选的——取不到就当空数组，会话视图退化成只有输入框。
  messages?: Message[];
};

const CATEGORIES = [
  { value: 'correction', label: '纠错点' },
  { value: 'drill_seed', label: 'drill 种子' },
  { value: 'honest_stuck', label: '诚实的卡住点' },
  { value: 'good_question', label: '好问题' },
  { value: 'breakthrough', label: '想通了' },
];

function card(extra = '') {
  return `rounded-lg border border-[#dfe7dc] bg-[#fffdf8] p-4 shadow-sm ${extra}`;
}

function button(extra = '') {
  return `press rounded-[8px] border border-[#d8d0bf] bg-white px-3 py-1.5 text-sm font-semibold text-[#40525b] transition-colors hover:border-[#9fb7a7] disabled:opacity-50 ${extra}`;
}

function input(extra = '') {
  return `w-full rounded-lg border border-[#dfe7dc] bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#9fb7a7] ${extra}`;
}

export default function CoachPage() {
  const [token, setToken] = useState('');
  const [adminSession, setAdminSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [tokenDraft, setTokenDraft] = useState('');
  // 只管认证。各区自己的加载 / 操作错误落在各区里，不往上冒。
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    let active = true;
    void fetch('/api/admin/session', { cache: 'no-store' })
      .then((response) => response.json().then((data) => ({ response, data })))
      .then(({ response, data }) => {
        if (!active) return;
        if (response.ok && data.authenticated) setAdminSession(true);
        else setToken(window.sessionStorage.getItem(TOKEN_KEY) || '');
      })
      .catch(() => {
        if (active) setToken(window.sessionStorage.getItem(TOKEN_KEY) || '');
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const call = useCallback(
    async (url: string, init?: { method?: string; body?: unknown }) => {
      const response = await fetch(url, {
        method: init?.method || 'GET',
        headers: {
          'content-type': 'application/json',
          ...(token ? { 'x-goodminton-coach-token': token } : {}),
        },
        cache: 'no-store',
        ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
      });
      const payload = (await response.json().catch(() => ({}))) as CallResult;

      // 401 不是「这次操作失败了」，是令牌废了——这台子没有一个区还能工作。
      // 与其在四个区各写一行 Unauthorized、让页面看着还能用，不如退回登录口。
      // 抛出去只为让调用方停下；错误文案由 errorText 吞掉，因为这棵树马上就不渲染了。
      if (response.status === 401) {
        window.sessionStorage.removeItem(TOKEN_KEY);
        setToken('');
        setAdminSession(false);
        setAuthError('令牌无效或已过期，请重新输入。');
        throw new Error(AUTH_FAILED);
      }

      if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
      return payload;
    },
    [token],
  );

  function saveToken(event: React.FormEvent) {
    event.preventDefault();
    const value = tokenDraft.trim();
    if (!value) return;
    window.sessionStorage.setItem(TOKEN_KEY, value);
    setToken(value);
    setTokenDraft('');
    setAuthError('');
  }

  function clearToken() {
    window.sessionStorage.removeItem(TOKEN_KEY);
    setToken('');
  }

  async function logout() {
    if (adminSession) {
      await fetch('/api/admin/session', { method: 'DELETE' });
      setAdminSession(false);
      return;
    }
    clearToken();
  }

  if (checkingSession) {
    return <main className="mx-auto max-w-md px-4 py-16 text-sm text-slate-500">正在检查权限…</main>;
  }

  if (!token && !adminSession) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-lg font-semibold text-slate-900">教练控制台</h1>
        {authError ? (
          <p className="mt-2 rounded-md border border-[#e8c9c9] bg-[#fdecec] px-3 py-2 text-sm text-[#a33]">
            {authError}
          </p>
        ) : null}
        <p className="mt-2 text-sm text-slate-600">
          输入教练令牌（Vercel 上的 <code>GOODMINTON_COACH_ACTION_TOKEN</code>）。只存在本标签页，关闭即失效。
        </p>
        <p className="mt-2 text-sm text-slate-500">
          系统管理员请从 <a href="/admin" className="underline">/admin</a> 登录。
        </p>
        <form onSubmit={saveToken} className="mt-4 space-y-3">
          <input
            type="password"
            value={tokenDraft}
            onChange={(event) => setTokenDraft(event.target.value)}
            className={input()}
            placeholder="coach token"
            autoComplete="off"
          />
          <button type="submit" className={button()}>
            进入
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">教练控制台</h1>
        <button type="button" onClick={logout} className={button()}>
          退出
        </button>
      </header>

      <CommentQueue call={call} />
      <MessageDesk call={call} />
      <FeatureDesk call={call} />
    </main>
  );
}

type CallResult = {
  error?: string;
  pending?: PendingComment[];
  threads?: Thread[];
  submissions?: Submission[];
};

type CallFn = (url: string, init?: { method?: string; body?: unknown }) => Promise<CallResult>;

// call() 在 401 时抛这个。它不该被当成错误文案显示出来——那一刻页面已经切回登录口了。
const AUTH_FAILED = '__auth_failed__';

function errorText(e: unknown, fallback: string) {
  if (e instanceof Error) return e.message === AUTH_FAILED ? '' : e.message || fallback;
  return fallback;
}

function ErrorLine({ message, onRetry }: { message: string; onRetry?: () => void }) {
  if (!message) return null;
  return (
    <p className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-[#e8c9c9] bg-[#fdecec] px-2.5 py-1.5 text-xs text-[#a33]">
      <span>{message}</span>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="font-semibold underline">
          重试
        </button>
      ) : null}
    </p>
  );
}

// 「没加载出来」和「真的没有」必须分开。
//
// 之前三个区各自 useEffect + useState 抄一遍，且都只在 .finally 里置 loaded，
// 于是加载失败时列表是空数组，页面就写「队列是空的。」「全部处理完了。」——
// 教练台唯一的作用是告诉你有没有新东西，这条空文案在失败时是句谎话。
// 这里把状态收成三态，失败时由调用方渲染重试而不是空文案。
type LoadState = 'loading' | 'ready' | 'error';

function useResource(call: CallFn, url: string, fallbackMessage: string) {
  const [data, setData] = useState<CallResult | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState('');

  // 手动重试 / 动作之后刷新。effect 里不能直接调它——react-hooks/set-state-in-effect
  // 不许在 effect 体里同步 setState，所以下面那个 effect 仍然内联一份。
  const load = useCallback(async () => {
    setError('');
    // 只有手上没东西可显示时才亮「加载中…」。动作后的刷新让列表原地留着，
    // 成功再整体替换——否则点一次「标记已处理」整个列表要闪一下。
    setState((current) => (current === 'ready' ? 'ready' : 'loading'));
    try {
      setData(await call(url));
      setState('ready');
    } catch (e) {
      setError(errorText(e, fallbackMessage));
      setState('error');
    }
  }, [call, url, fallbackMessage]);

  useEffect(() => {
    let active = true;
    void call(url)
      .then((payload) => {
        if (!active) return;
        setData(payload);
        setState('ready');
      })
      .catch((e: unknown) => {
        if (!active) return;
        setError(errorText(e, fallbackMessage));
        setState('error');
      });
    return () => {
      active = false;
    };
  }, [call, url, fallbackMessage]);

  return { data, state, error, setError, load };
}

function CommentQueue({ call }: { call: CallFn }) {
  const { data, state, error, setError, load } = useResource(
    call,
    '/api/forum-comment/moderate',
    '加载评论队列失败',
  );
  const [busy, setBusy] = useState(false);
  const pending = data?.pending || [];

  async function moderate(id: string, action: 'approve' | 'reject') {
    setBusy(true);
    setError('');
    try {
      await call('/api/forum-comment/moderate', { method: 'POST', body: { id, action } });
      await load();
    } catch (e) {
      setError(errorText(e, '操作失败'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={card()}>
      <h2 className="text-sm font-semibold text-slate-900">
        待审核评论{state === 'ready' ? `（${pending.length}）` : ''}
      </h2>
      <p className="mt-1 text-xs text-slate-500">通过之前，没有任何学员看得到这些评论。</p>
      <ErrorLine message={error} onRetry={state === 'error' ? () => void load() : undefined} />
      {state !== 'ready' ? (
        state === 'loading' ? <p className="mt-3 text-sm text-slate-500">加载中…</p> : null
      ) : pending.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">队列是空的。</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {pending.map((comment) => (
            <li key={comment.id} className="rounded-lg border border-[#e2ded2] bg-white p-3">
              <div className="flex flex-wrap items-baseline gap-2 text-xs text-slate-500">
                <span className="font-semibold text-slate-700">{comment.display_name}</span>
                {comment.student_id ? <span>（{comment.student_id}）</span> : <span>（未登录）</span>}
                <span>· {new Date(comment.created_at).toLocaleString()}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-800">{comment.body}</p>
              <div className="mt-2 flex gap-2">
                <button type="button" disabled={busy} onClick={() => moderate(comment.id, 'approve')} className={button()}>
                  通过
                </button>
                <button type="button" disabled={busy} onClick={() => moderate(comment.id, 'reject')} className={button()}>
                  打回
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MessageDesk({ call }: { call: CallFn }) {
  const { data, state, error, setError, load } = useResource(
    call,
    '/api/student-messages/send',
    '加载私信失败',
  );
  const [studentId, setStudentId] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const threads = data?.threads || [];

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!studentId.trim() || !body.trim() || sending) return;
    setSending(true);
    setSent(false);
    setError('');
    try {
      await call('/api/student-messages/send', {
        method: 'POST',
        body: { studentId: studentId.trim(), body: body.trim() },
      });
      // 发出去了才清空输入框。失败时原文留着，不然一条写了五分钟的私信就没了。
      setBody('');
      setSent(true);
      await load();
    } catch (e) {
      setError(errorText(e, '发送失败'));
    } finally {
      setSending(false);
    }
  }

  const target = studentId.trim();
  const selected = threads.find((thread) => thread.studentId === target);
  const waiting = threads.filter((thread) => thread.awaitingCoachReply).length;

  const composer = (
    <form onSubmit={send} className="mt-3 space-y-2">
      {selected?.accountHolder === 'parent' ? (
        <p className="rounded-md bg-[#f4f8f1] px-2.5 py-1.5 text-xs text-[#0e6f4d]">
          这是家长账号——读的人是家长，学员是被谈论的对象，措辞按写给家长来。
        </p>
      ) : null}
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        rows={selected ? 3 : 5}
        className={input('resize-y')}
        placeholder={selected ? `回复 ${selected.name}…` : '私信内容…'}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={sending || !target || !body.trim()} className={button()}>
          {sending ? '发送中…' : '发送'}
        </button>
        {sent ? <span className="text-xs text-[#16845f]">已发送</span> : null}
        {!target ? <span className="text-xs text-slate-400">先选一个会话，或在下面填 studentId</span> : null}
      </div>
      <ErrorLine message={error && state === 'ready' ? error : ''} />
    </form>
  );

  return (
    <section className={card()}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">
          私信（专属）
          {state === 'ready' && waiting ? (
            <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-700">
              {waiting} 条待回复
            </span>
          ) : null}
        </h2>
        {selected ? (
          <button type="button" onClick={() => setStudentId('')} className={button('text-xs')}>
            返回列表
          </button>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-slate-500">
        只有这个学员看得到。个人的事——伤病、状态、犹豫——写在这里，不要写进点评。
      </p>

      <ErrorLine
        message={state === 'error' ? error : ''}
        onRetry={state === 'error' ? () => void load() : undefined}
      />

      {state === 'loading' ? (
        <p className="mt-3 text-sm text-slate-500">加载中…</p>
      ) : state === 'error' ? null : selected ? (
        // 会话视图。回信之前先把学员写的话原样摆在眼前——列表里那条预览是截断的，
        // 照着一行截断的字回信，等于没看见人家问了什么。
        <>
          <div className="mt-3 flex flex-wrap items-baseline gap-2 text-xs">
            <span className="text-sm font-semibold text-slate-800">{selected.name}</span>
            <span className="text-slate-400">{selected.studentId}</span>
            {selected.accountHolder === 'parent' ? (
              <span className="rounded bg-[#f4f8f1] px-1.5 py-0.5 text-[#0e6f4d]">家长账号</span>
            ) : null}
          </div>
          <div className="mt-2 max-h-80 space-y-2 overflow-y-auto rounded-md border border-[#e2ded2] bg-[#faf9f4] p-2.5">
            {selected.messages?.length ? (
              selected.messages.map((message) => (
                <div
                  key={message.id}
                  className={message.from === 'coach' ? 'flex justify-end' : 'flex justify-start'}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-2.5 py-1.5 ${
                      message.from === 'coach'
                        ? 'bg-[#eaf5ee] text-slate-800'
                        : 'border border-[#e2ded2] bg-white text-slate-800'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {message.from === 'coach' ? '我' : selected.name} ·{' '}
                      {new Date(message.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-500">这个会话没有可显示的消息。</p>
            )}
          </div>
          {composer}
        </>
      ) : (
        <>
          {threads.length ? (
            <ul className="mt-3 space-y-2">
              {threads.map((thread) => (
                <li key={thread.studentId}>
                  <button
                    type="button"
                    onClick={() => setStudentId(thread.studentId)}
                    className="w-full rounded-lg border border-[#e2ded2] bg-white p-3 text-left hover:border-[#9fb7a7]"
                  >
                    <div className="flex flex-wrap items-baseline gap-2 text-xs">
                      <span className="font-semibold text-slate-800">{thread.name}</span>
                      {thread.accountHolder === 'parent' ? (
                        <span className="rounded bg-[#f4f8f1] px-1.5 py-0.5 text-[#0e6f4d]">家长账号</span>
                      ) : null}
                      {thread.awaitingCoachReply ? (
                        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-700">待回复</span>
                      ) : null}
                      <span className="text-slate-400">{new Date(thread.lastAt).toLocaleDateString()}</span>
                    </div>
                    <p className="mt-1 truncate text-sm text-slate-600">
                      {thread.lastFrom === 'coach' ? '我：' : ''}
                      {thread.lastMessage}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-500">还没有任何私信。</p>
          )}

          {/* 手填 studentId 这条路要留着：给从没写过信的学员开第一条私信，
              列表里根本没有他。 */}
          <div className="mt-4 border-t border-[#e2ded2] pt-3">
            <p className="text-xs text-slate-500">给列表里没有的学员发第一条：</p>
            <input
              value={studentId}
              onChange={(event) => setStudentId(event.target.value)}
              className={input('mt-2')}
              placeholder="studentId，例如 xue-meijiao"
            />
            {composer}
          </div>
        </>
      )}
    </section>
  );
}

// 公开点评。写在这里的字对全体学员可见，但“保存点评”本身不上墙；
// 只有卡片里的“确认上墙”才会 featured=true。只给一个人看的话走上面的私信。
function CoachFeedbackEditor({
  submission,
  call,
  onSaved,
  onError,
}: {
  submission: Submission;
  call: CallFn;
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(submission.coach_feedback || '');
  const [busy, setBusy] = useState(false);

  async function save() {
    const text = draft.trim();
    if (!text) return;
    setBusy(true);
    try {
      await call('/api/student-history/coach-feedback', {
        method: 'POST',
        body: { recordId: submission.external_id, coachFeedback: text, coachLiked: true },
      });
      setOpen(false);
      onSaved();
    } catch (e) {
      onError(e instanceof Error ? e.message : '保存点评失败');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 rounded-lg border border-[#cfe3d6] px-3 py-1.5 text-xs font-semibold text-[#0e6f4d]"
      >
        {submission.coach_feedback ? '改点评' : '写点评（公开）'}
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-md border border-[#cfe3d6] bg-white p-2.5">
      <textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        rows={4}
        className={input('resize-y')}
        placeholder="教练点评——公开文字。保存点评不上墙；确认上墙后才会出现在论坛。"
        maxLength={1200}
      />
      <div className="flex items-center gap-2">
        <button type="button" disabled={busy || !draft.trim()} onClick={save} className={button()}>
          {busy ? '保存中…' : '保存点评（不上墙）'}
        </button>
        <button type="button" onClick={() => { setOpen(false); setDraft(submission.coach_feedback || ''); }} className="text-xs text-slate-500">
          取消
        </button>
        <span className="text-xs text-slate-400">{draft.length}/1200</span>
      </div>
    </div>
  );
}

// 一条提交的全部操作都在这张卡片里：看原文、写点评、上墙、标记已处理。
//
// 2026-08-16 之前这些动作散在三个区：待处理区只能「标记已处理」，想回话得滚到
// 页面最下面的精选区，在一百条里把同一条记录再找一遍。现在合成一张卡。
//
// 导读 / 分类 / 等级档 的 state 也一并挪进卡片。此前它们挂在 FeatureDesk 上，
// 全部卡片共用一份——打开 A 打了导读、改去开 B，B 的输入框里是 A 的字。
function SubmissionCard({
  submission,
  call,
  defaultExcerptOpen,
  onChanged,
}: {
  submission: Submission;
  call: CallFn;
  defaultExcerptOpen: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  // 错误留在出事的这张卡里。挂到页顶的话，翻到第 7 条时上面写着「操作失败」，
  // 既不知道是哪条、也不知道是刚才那次还是十分钟前那次。
  const [error, setError] = useState('');
  const [excerptOpen, setExcerptOpen] = useState(defaultExcerptOpen);
  const [featureOpen, setFeatureOpen] = useState(false);
  // 已经上过墙的记录，重新精选时沿用原来的导读 / 分类 / 等级，不用从头打一遍。
  const [angle, setAngle] = useState(submission.featured_angle || '');
  const [category, setCategory] = useState(submission.featured_category || 'correction');
  const [tier, setTier] = useState(submission.featured_tier || '');
  const [pinned, setPinned] = useState(Boolean(submission.featured_pinned));

  const excerpt = resolveExcerpt(submission.record_type, submission.featured_excerpt, submission.payload);
  const entries = Object.entries(excerpt).filter(([key, value]) => key !== 'title' && value);
  const blob = entries.map(([, v]) => v).join(' ');
  // 只做提示，不做判定——命中了也要人看过再决定。
  const healthHit = /疼|痛|受伤|拉伤|扭伤|药膏|贴布/.test(blob);
  const thin = blob.replace(/\s/g, '').length < 25;
  const pending = isPending(submission);
  const fromVault = submission.source !== 'website';

  async function run(fn: () => Promise<unknown>, fallback: string) {
    setBusy(true);
    setError('');
    try {
      await fn();
      onChanged();
    } catch (e) {
      setError(errorText(e, fallback));
    } finally {
      setBusy(false);
    }
  }

  // 标记已处理 / 撤回。不碰 coach_feedback——撤回的是我的处理状态，
  // 不是学员已经看到的那段话。
  const setHandled = (handled: boolean) =>
    run(
      () =>
        call('/api/student-history/coach-handled', {
          method: 'POST',
          body: { recordId: submission.external_id, handled },
        }),
      handled ? '标记失败' : '撤回失败',
    );

  const unfeature = () =>
    run(
      () =>
        call('/api/student-submission/feature', {
          method: 'DELETE',
          body: { recordId: submission.external_id },
        }),
      '取消精选失败',
    );

  function feature() {
    if (!angle.trim()) {
      setError('教练导读是必填的——它是学员看到的第一行。');
      return;
    }
    void run(async () => {
      await call('/api/student-submission/feature', {
        method: 'POST',
        body: {
          recordId: submission.external_id,
          angle: angle.trim(),
          category,
          tier: tier.trim(),
          pinned,
        },
      });
      setFeatureOpen(false);
      setPinned(false);
    }, '精选失败');
  }

  return (
    <li className="rounded-lg border border-[#e2ded2] bg-white p-3">
      <div className="flex flex-wrap items-baseline gap-2 text-xs text-slate-500">
        <span className="font-semibold text-slate-800">{submission.student_id}</span>
        <span>{submission.record_type === 'match_review' ? '比赛复盘' : '课后总结'}</span>
        <span>{submission.happened_at || '—'}</span>
        {submission.created_at ? (
          <span className="text-slate-400">
            提交于 {String(submission.created_at).slice(0, 16).replace('T', ' ')}
          </span>
        ) : null}
        {fromVault ? (
          <span className="rounded bg-[#f1f1f1] px-1.5 py-0.5 text-slate-600">库内回填</span>
        ) : null}
        {healthHit ? (
          <span className="rounded bg-[#fdecec] px-1.5 py-0.5 font-semibold text-[#a33]">
            含健康/伤病字样 · 别上墙
          </span>
        ) : null}
        {thin ? (
          <span className="rounded bg-[#f1f1f1] px-1.5 py-0.5 text-slate-600">正文很短 · 可能是占位</span>
        ) : null}
        {submission.featured ? (
          <span className="rounded bg-[#fff4e0] px-1.5 py-0.5 font-semibold text-[#8a6314]">已在墙上</span>
        ) : null}
        {submission.featured && submission.featured_pinned ? (
          <span className="rounded bg-[#fde9c8] px-1.5 py-0.5 font-semibold text-[#8a6314]">★ 置顶</span>
        ) : null}
        {!pending && submission.coach_handled_at ? (
          <span className="text-slate-400">
            处理于 {String(submission.coach_handled_at).slice(0, 16).replace('T', ' ')}
          </span>
        ) : null}
      </div>

      {submission.title ? (
        <p className="mt-1 text-sm font-semibold text-slate-900">{submission.title}</p>
      ) : null}

      {entries.length === 0 ? (
        <p className="mt-2 text-sm text-slate-400">（无正文）</p>
      ) : excerptOpen ? (
        <div className="mt-2 space-y-2">
          {entries.map(([key, value]) => (
            <div key={key}>
              <p className="text-[11px] font-semibold text-slate-500">{EXCERPT_LABELS[key] || key}</p>
              <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{value}</p>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setExcerptOpen(false)}
            className="text-xs text-slate-500 underline"
          >
            收起原文
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setExcerptOpen(true)}
          className="mt-2 block w-full truncate text-left text-xs text-slate-500 underline"
        >
          展开原文 · {blob.slice(0, 40)}…
        </button>
      )}

      {submission.coach_feedback ? (
        <div className="mt-2 rounded-md border border-[#cfe3d6] bg-[#f4f8f1] p-2.5">
          <p className="text-[11px] font-semibold text-[#0e6f4d]">已有点评（公开）</p>
          <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{submission.coach_feedback}</p>
        </div>
      ) : null}

      <CoachFeedbackEditor submission={submission} call={call} onSaved={onChanged} onError={setError} />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {submission.featured ? (
          <button type="button" disabled={busy} onClick={() => void unfeature()} className={button('text-xs')}>
            从墙上撤下
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setFeatureOpen((value) => !value)}
            className={button('text-xs')}
          >
            {featureOpen ? '收起' : '精选上墙…'}
          </button>
        )}

        {/* 处理状态只对网站提交有意义。isPending 里 source!=='website' 直接 false，
            所以给库内回填的记录画「撤回到待处理」是个死按钮——清了
            coach_handled_at 它也进不了队列。那类记录这里就不给按钮。 */}
        {pending ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void setHandled(true)}
            className={button('text-xs')}
          >
            标记已处理（不上墙）
          </button>
        ) : fromVault ? null : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void setHandled(false)}
            className={button('text-xs')}
          >
            撤回到待处理
          </button>
        )}

        {pending ? (
          <span className="text-xs text-slate-400">
            不用回话的（占位 / 重复 / 含伤病）点「标记已处理」；写点评或上墙都会自动出队。
          </span>
        ) : null}
      </div>

      <ErrorLine message={error} />

      {featureOpen ? (
        <div className="mt-3 space-y-2 border-t border-[#e2ded2] pt-3">
          <input
            value={angle}
            onChange={(event) => setAngle(event.target.value)}
            className={input()}
            placeholder="教练导读（必填）——为什么这条值得别人看"
            maxLength={280}
          />
          <div className="flex flex-wrap gap-2">
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className={input('max-w-[12rem]')}
            >
              {CATEGORIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              value={tier}
              onChange={(event) => setTier(event.target.value)}
              className={input('max-w-[8rem]')}
              placeholder="等级档 C2"
              maxLength={8}
            />
          </div>
          <p className="text-xs text-[#0e6f4d]">
            点下面这个按钮就会上墙：写入 featured=true，并在论坛公开显示。
          </p>
          {submission.coach_feedback ? (
            <p className="text-xs text-slate-500">这条已有教练点评，确认上墙后会一起公开显示。</p>
          ) : (
            <p className="text-xs text-amber-700">
              这条还没有教练点评，确认上墙后只会显示学员原文。可以先在上面保存点评。
            </p>
          )}
          {healthHit ? (
            <p className="text-xs font-semibold text-[#a33]">
              正文里有健康/伤病字样——上墙就是对全体学员公开，先确认这句能公开。
            </p>
          ) : null}
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} />
            加精置顶（少用——全置顶等于没置顶）
          </label>
          <button type="button" disabled={busy} onClick={feature} className={button()}>
            确认上墙
          </button>
        </div>
      ) : null}
    </li>
  );
}

type Tab = 'pending' | 'handled' | 'wall' | 'all';

const TAB_HINTS: Record<Tab, string> = {
  pending:
    '教练审核队列，不是公开墙。网站新提交默认落这里。只有「确认上墙」才会公开；写点评和标记已处理都不上墙，但都会让这条出队。',
  handled: '已经过手的网站提交。撤回只是把它放回队列，coach_feedback 原样保留，学员那边看到的点评不受影响。',
  wall: '正在对全体学员公开显示的（匿名，只带等级档）。撤下后论坛立刻不再显示，点评仍保留在记录里。',
  all: '最近 100 条，含从 Obsidian 库回填的课次记录（无学员正文）。主要用来找旧记录补精选。',
};

function FeatureDesk({ call }: { call: CallFn }) {
  const { data, state, error, load } = useResource(
    call,
    '/api/student-submission/feature',
    '加载提交失败',
  );
  const [tab, setTab] = useState<Tab>('pending');
  const submissions = data?.submissions || [];

  // 待处理 = coach_handled_at 为空的学员提交（判定见文件顶部的 isPending）。
  //
  // 为什么需要这个队列：新提交**不会自动上墙**——peer-feed 里没有教练导读的记录
  // 直接 return null。所以一条学员总结进了库之后，除非教练主动来看，否则不会
  // 在任何地方冒头，只能依赖 ntfy 通知，而那条链路不总是可靠。
  //
  // 也不打算改成自动发布：四条排除线（教练笔记误入 / 建档占位 / 伤病信息 /
  // 重复）没有一条机器能可靠判断。2026-08-11 就有现成例子——一条总结里写了
  // 「训练后小臂疼痛加重」，自动上墙会直接公开。人工闸门要留着，这里只是让
  // 「有没有新东西」一眼可见。
  // 只看 source='website'——那才是学员自己写的。'data/students' 是从 Obsidian
  // 库回填的课次记录，没有学员正文，混进待处理会把真正要处理的 7 条淹在 50 条里；
  // 它们仍在「全部」标签下，需要时能找到。
  //
  // 2026-08-13：出队条件从「写了点评」改成显式的 coach_handled_at。此前
  // 「看过了但不需要回话」无法表达，撤回也只能靠清空点评（会连学员看到的回复
  // 一起删掉）。现在这两件事分开了。
  const pending = submissions.filter(isPending);
  const handled = submissions.filter((s) => s.source === 'website' && !isPending(s));
  const wall = submissions.filter((s) => s.featured);

  const lists: Record<Tab, Submission[]> = {
    pending,
    handled,
    wall,
    all: submissions,
  };
  const tabs: { value: Tab; label: string }[] = [
    { value: 'pending', label: '待处理' },
    { value: 'handled', label: '已处理' },
    { value: 'wall', label: '墙上' },
    { value: 'all', label: '全部' },
  ];
  const list = lists[tab];

  return (
    <section className={card(tab === 'pending' && pending.length ? 'border-[#d8c9a8] bg-[#fffdf5]' : '')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">学员提交</h2>
        <button type="button" onClick={() => void load()} className={button('text-xs')}>
          刷新
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {tabs.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setTab(option.value)}
            className={`press rounded-[8px] border px-2.5 py-1 text-xs font-semibold transition-colors ${
              tab === option.value
                ? 'border-[#9fb7a7] bg-[#f4f8f1] text-[#0e6f4d]'
                : 'border-[#d8d0bf] bg-white text-[#40525b] hover:border-[#9fb7a7]'
            }`}
          >
            {/* 没加载成功就不写数字。「待处理（0）」和加载失败长得一样，
                而这个 0 恰恰是教练最愿意相信的那个数。 */}
            {option.label}
            {state === 'ready' ? `（${lists[option.value].length}）` : ''}
          </button>
        ))}
      </div>

      <p className="mt-2 text-xs leading-5 text-slate-500">{TAB_HINTS[tab]}</p>

      <ErrorLine
        message={error}
        onRetry={state === 'error' ? () => void load() : undefined}
      />

      {state === 'loading' ? (
        <p className="mt-3 text-sm text-slate-500">加载中…</p>
      ) : state === 'error' ? null : list.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          {tab === 'pending'
            ? '全部处理完了。'
            : tab === 'all'
              ? '没有提交，或 migration 尚未执行。'
              : '这里还是空的。'}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {list.map((submission) => (
            <SubmissionCard
              // tab 进 key：切标签时卡片重新挂载，原文的展开状态按新标签的默认值来。
              key={`${tab}-${submission.external_id}`}
              submission={submission}
              call={call}
              defaultExcerptOpen={tab === 'pending'}
              onChanged={load}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
