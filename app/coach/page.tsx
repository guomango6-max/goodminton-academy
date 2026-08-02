'use client';

// Coach console. Three jobs that previously had no UI at all and could only be
// done by hand-rolling curl calls:
//
//   1. 精选 — put a student submission on the peer wall (公开)
//   2. 审核评论 — approve or reject comments before anyone sees them
//   3. 私信 — the private coach ↔ student thread (专属)
//
// The coach token is typed in here and kept in sessionStorage only: never in
// a file, never in the repo, gone when the tab closes. Every request below is
// rejected server-side without it.
//
// /coach is disallowed in robots.ts.

import React, { useCallback, useEffect, useState } from 'react';

const TOKEN_KEY = 'goodminton-coach-token';

type Submission = {
  external_id: string;
  student_id: string;
  record_type: string;
  title: string | null;
  happened_at: string | null;
  featured: boolean | null;
  featured_angle: string | null;
  featured_category: string | null;
  featured_tier: string | null;
  coach_feedback: string | null;
};

type PendingComment = {
  id: string;
  post_id: string;
  display_name: string;
  body: string;
  student_id: string | null;
  created_at: string;
};

type Thread = {
  studentId: string;
  name: string;
  accountHolder: 'parent' | 'student';
  lastMessage: string;
  lastFrom: 'coach' | 'student';
  lastAt: string;
  awaitingCoachReply: boolean;
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
  const [error, setError] = useState('');

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
    setError('');
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

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <CommentQueue call={call} onError={setError} />
      <MessageDesk call={call} onError={setError} />
      <FeatureDesk call={call} onError={setError} />
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

function CommentQueue({ call, onError }: { call: CallFn; onError: (message: string) => void }) {
  const [pending, setPending] = useState<PendingComment[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void call('/api/forum-comment/moderate')
      .then((data) => {
        if (active) setPending(data.pending || []);
      })
      .catch((e: unknown) => {
        if (active) onError(e instanceof Error ? e.message : '加载评论队列失败');
      });
    return () => {
      active = false;
    };
  }, [call, onError]);

  async function moderate(id: string, action: 'approve' | 'reject') {
    setBusy(true);
    try {
      await call('/api/forum-comment/moderate', { method: 'POST', body: { id, action } });
      setPending((current) => current.filter((comment) => comment.id !== id));
    } catch (e) {
      onError(e instanceof Error ? e.message : '操作失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={card()}>
      <h2 className="text-sm font-semibold text-slate-900">待审核评论（{pending.length}）</h2>
      <p className="mt-1 text-xs text-slate-500">通过之前，没有任何学员看得到这些评论。</p>
      {pending.length === 0 ? (
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

function MessageDesk({ call, onError }: { call: CallFn; onError: (message: string) => void }) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [studentId, setStudentId] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await call('/api/student-messages/send');
      setThreads(data.threads || []);
    } catch (e) {
      onError(e instanceof Error ? e.message : '加载私信失败');
    }
  }, [call, onError]);

  useEffect(() => {
    let active = true;
    void call('/api/student-messages/send')
      .then((data) => {
        if (active) setThreads(data.threads || []);
      })
      .catch((e: unknown) => {
        if (active) onError(e instanceof Error ? e.message : '加载私信失败');
      });
    return () => {
      active = false;
    };
  }, [call, onError]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!studentId.trim() || !body.trim() || sending) return;
    setSending(true);
    setSent(false);
    try {
      await call('/api/student-messages/send', {
        method: 'POST',
        body: { studentId: studentId.trim(), body: body.trim() },
      });
      setBody('');
      setSent(true);
      load();
    } catch (e) {
      onError(e instanceof Error ? e.message : '发送失败');
    } finally {
      setSending(false);
    }
  }

  const selected = threads.find((thread) => thread.studentId === studentId.trim());

  return (
    <section className={card()}>
      <h2 className="text-sm font-semibold text-slate-900">私信（专属）</h2>
      <p className="mt-1 text-xs text-slate-500">
        只有这个学员看得到。个人的事——伤病、状态、犹豫——写在这里，不要写进点评。
      </p>

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
                <p className="mt-1 truncate text-sm text-slate-600">{thread.lastMessage}</p>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-500">还没有任何私信。</p>
      )}

      <form onSubmit={send} className="mt-4 space-y-2">
        <input
          value={studentId}
          onChange={(event) => setStudentId(event.target.value)}
          className={input()}
          placeholder="studentId，例如 xue-meijiao"
        />
        {selected?.accountHolder === 'parent' ? (
          <p className="text-xs text-[#0e6f4d]">
            这是家长账号——读的人是家长，学员是被谈论的对象，措辞按写给家长来。
          </p>
        ) : null}
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={5}
          className={input()}
          placeholder="私信内容…"
        />
        <div className="flex items-center gap-3">
          <button type="submit" disabled={sending || !studentId.trim() || !body.trim()} className={button()}>
            {sending ? '发送中…' : '发送'}
          </button>
          {sent ? <span className="text-xs text-[#16845f]">已发送</span> : null}
        </div>
      </form>
    </section>
  );
}

function FeatureDesk({ call, onError }: { call: CallFn; onError: (message: string) => void }) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [openId, setOpenId] = useState('');
  const [angle, setAngle] = useState('');
  const [category, setCategory] = useState('correction');
  const [tier, setTier] = useState('');
  const [pinned, setPinned] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await call('/api/student-submission/feature');
      setSubmissions(data.submissions || []);
    } catch (e) {
      onError(e instanceof Error ? e.message : '加载提交失败');
    }
  }, [call, onError]);

  useEffect(() => {
    let active = true;
    void call('/api/student-submission/feature')
      .then((data) => {
        if (active) setSubmissions(data.submissions || []);
      })
      .catch((e: unknown) => {
        if (active) onError(e instanceof Error ? e.message : '加载提交失败');
      });
    return () => {
      active = false;
    };
  }, [call, onError]);

  async function feature(recordId: string) {
    if (!angle.trim()) {
      onError('教练导读是必填的——它是学员看到的第一行。');
      return;
    }
    setBusy(true);
    try {
      await call('/api/student-submission/feature', {
        method: 'POST',
        body: { recordId, angle: angle.trim(), category, tier: tier.trim(), pinned },
      });
      setOpenId('');
      setAngle('');
      setTier('');
      setPinned(false);
      load();
    } catch (e) {
      onError(e instanceof Error ? e.message : '精选失败');
    } finally {
      setBusy(false);
    }
  }

  async function unfeature(recordId: string) {
    setBusy(true);
    try {
      await call('/api/student-submission/feature', { method: 'DELETE', body: { recordId } });
      load();
    } catch (e) {
      onError(e instanceof Error ? e.message : '取消精选失败');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={card()}>
      <h2 className="text-sm font-semibold text-slate-900">精选到学员墙（公开）</h2>
      <p className="mt-1 text-xs text-slate-500">
        精选后，这条提交和你写的教练点评会一起对全体学员显示（匿名，只带等级档）。点评是公开渠道——
        个人的事走私信。
      </p>

      {submissions.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">没有提交，或 migration 尚未执行。</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {submissions.map((submission) => (
            <li key={submission.external_id} className="rounded-lg border border-[#e2ded2] bg-white p-3">
              <div className="flex flex-wrap items-baseline gap-2 text-xs text-slate-500">
                <span className="font-semibold text-slate-700">{submission.student_id}</span>
                <span>{submission.record_type === 'match_review' ? '比赛复盘' : '课后总结'}</span>
                <span>{submission.happened_at || ''}</span>
                {submission.featured ? (
                  <span className="rounded bg-[#f4f8f1] px-1.5 py-0.5 text-[#0e6f4d]">已在墙上</span>
                ) : null}
                {submission.coach_feedback ? null : (
                  <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-700">尚无点评</span>
                )}
              </div>
              {submission.title ? <p className="mt-1 text-sm text-slate-800">{submission.title}</p> : null}

              <div className="mt-2 flex gap-2">
                {submission.featured ? (
                  <button type="button" disabled={busy} onClick={() => unfeature(submission.external_id)} className={button()}>
                    从墙上撤下
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setOpenId(openId === submission.external_id ? '' : submission.external_id)}
                    className={button()}
                  >
                    {openId === submission.external_id ? '收起' : '精选…'}
                  </button>
                )}
              </div>

              {openId === submission.external_id ? (
                <div className="mt-3 space-y-2 border-t border-[#e2ded2] pt-3">
                  <input
                    value={angle}
                    onChange={(event) => setAngle(event.target.value)}
                    className={input()}
                    placeholder="教练导读（必填）——为什么这条值得别人看"
                    maxLength={280}
                  />
                  <div className="flex flex-wrap gap-2">
                    <select value={category} onChange={(event) => setCategory(event.target.value)} className={input('max-w-[12rem]')}>
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
                  {submission.coach_feedback ? (
                    <p className="text-xs text-slate-500">
                      这条已有教练点评，会一起公开显示。
                    </p>
                  ) : (
                    <p className="text-xs text-amber-700">
                      这条还没有教练点评，墙上只会显示学员原文。
                    </p>
                  )}
                  <label className="flex items-center gap-2 text-xs text-slate-600">
                    <input type="checkbox" checked={pinned} onChange={(event) => setPinned(event.target.checked)} />
                    加精置顶（少用——全置顶等于没置顶）
                  </label>
                  <button type="button" disabled={busy} onClick={() => feature(submission.external_id)} className={button()}>
                    确认精选
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
