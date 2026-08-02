'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type AdminState = {
  authenticated: boolean;
  email?: string;
  role?: string;
  error?: string;
};

const panel = 'rounded-xl border border-[#dfe7dc] bg-[#fffdf8] p-5 shadow-sm';
const field = 'w-full rounded-lg border border-[#dfe7dc] bg-white px-3 py-2 text-sm outline-none focus:border-[#7ea48a]';
const button = 'rounded-lg bg-[#176a4b] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50';

export default function AdminPage() {
  const [status, setStatus] = useState<AdminState | null>(null);
  const [email, setEmail] = useState('guomango6@gmail.com');
  const [password, setPassword] = useState('');
  const [setupAvailable, setSetupAvailable] = useState(false);
  const [setupToken, setSetupToken] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupPasswordAgain, setSetupPasswordAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void fetch('/api/admin/session', { cache: 'no-store' })
      .then((response) => response.json().then((data) => ({ response, data })))
      .then(({ response, data }) => {
        if (!active) return;
        setStatus(response.ok ? data : { authenticated: false });
        if (!response.ok) {
          void fetch('/api/admin/setup', { cache: 'no-store' })
            .then((setupResponse) => setupResponse.json())
            .then((setupData) => {
              if (active) setSetupAvailable(Boolean(setupData.setupAvailable));
            })
            .catch(() => undefined);
        }
      })
      .catch(() => {
        if (active) setStatus({ authenticated: false });
      });
    return () => {
      active = false;
    };
  }, []);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = (await response.json().catch(() => ({}))) as AdminState;
      if (!response.ok) throw new Error(data.error || '登录失败。');
      setPassword('');
      setStatus(data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '登录失败。');
    } finally {
      setBusy(false);
    }
  }

  async function setup(event: React.FormEvent) {
    event.preventDefault();
    if (setupPassword !== setupPasswordAgain) {
      setError('两次输入的密码不一致。');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/setup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: setupPassword, setupToken }),
      });
      const data = (await response.json().catch(() => ({}))) as AdminState;
      if (!response.ok) throw new Error(data.error || '管理员创建失败。');

      const loginResponse = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: setupPassword }),
      });
      const loginData = (await loginResponse.json().catch(() => ({}))) as AdminState;
      if (!loginResponse.ok) throw new Error(loginData.error || '账号已创建，请重新登录。');
      setSetupToken('');
      setSetupPassword('');
      setSetupPasswordAgain('');
      setSetupAvailable(false);
      setStatus(loginData);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '管理员创建失败。');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch('/api/admin/session', { method: 'DELETE' });
    setStatus({ authenticated: false });
  }

  if (!status) {
    return <main className="mx-auto max-w-md px-4 py-16 text-sm text-slate-500">正在检查管理员会话…</main>;
  }

  if (status.authenticated) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <section className={panel}>
          <p className="text-xs font-semibold tracking-wide text-[#176a4b]">SUPER ADMIN</p>
          <h1 className="mt-2 text-xl font-semibold text-slate-900">系统管理员</h1>
          <p className="mt-2 text-sm text-slate-600">{status.email} · 密码登录</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/coach" className={button}>进入教练控制台</Link>
            <button type="button" onClick={logout} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">退出</button>
          </div>
        </section>
      </main>
    );
  }

  if (setupAvailable) {
    return (
      <main className="mx-auto max-w-md px-4 py-12">
        <section className={panel}>
          <p className="text-xs font-semibold tracking-wide text-[#176a4b]">ONE-TIME SETUP</p>
          <h1 className="mt-2 text-xl font-semibold text-slate-900">创建网站管理员</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            这是唯一一次创建入口。密码由你在这里设置，不会显示给我，也不会写入项目文件。
          </p>
          <form onSubmit={setup} className="mt-5 space-y-3">
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={field} placeholder="管理员邮箱" autoComplete="username" />
            <input type="password" value={setupPassword} onChange={(event) => setSetupPassword(event.target.value)} className={field} placeholder="设置密码（至少 14 位）" autoComplete="new-password" />
            <input type="password" value={setupPasswordAgain} onChange={(event) => setSetupPasswordAgain(event.target.value)} className={field} placeholder="再次输入密码" autoComplete="new-password" />
            <input type="password" value={setupToken} onChange={(event) => setSetupToken(event.target.value)} className={field} placeholder="现有教练令牌（一次性验证）" autoComplete="off" />
            <button type="submit" disabled={busy || !email || setupPassword.length < 14 || !setupToken} className={button}>
              {busy ? '正在创建…' : '创建唯一管理员'}
            </button>
          </form>
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <section className={panel}>
        <h1 className="text-lg font-semibold text-slate-900">系统管理员登录</h1>
        <p className="mt-2 text-sm text-slate-600">仅限唯一的超级管理员账号。</p>
        <form onSubmit={login} className="mt-5 space-y-3">
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={field} placeholder="邮箱" autoComplete="username" />
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className={field} placeholder="密码" autoComplete="current-password" />
          <button type="submit" disabled={busy || !email || !password} className={button}>{busy ? '登录中…' : '登录'}</button>
        </form>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </section>
    </main>
  );
}
