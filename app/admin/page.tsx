'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

type AdminState = {
  authenticated: boolean;
  needsMfa?: boolean;
  needsEnrollment?: boolean;
  factorId?: string | null;
  email?: string;
  role?: string;
  error?: string;
};

type Enrollment = { factorId: string; qrCode: string; secret: string };

const panel = 'rounded-xl border border-[#dfe7dc] bg-[#fffdf8] p-5 shadow-sm';
const field = 'w-full rounded-lg border border-[#dfe7dc] bg-white px-3 py-2 text-sm outline-none focus:border-[#7ea48a]';
const button = 'rounded-lg bg-[#176a4b] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50';

export default function AdminPage() {
  const [status, setStatus] = useState<AdminState | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadStatus = useCallback(async () => {
    const response = await fetch('/api/admin/session', { cache: 'no-store' });
    const data = (await response.json().catch(() => ({}))) as AdminState;
    setStatus(response.ok ? data : { authenticated: false });
  }, []);

  useEffect(() => {
    let active = true;
    void fetch('/api/admin/session', { cache: 'no-store' })
      .then((response) => response.json().then((data) => ({ response, data })))
      .then(({ response, data }) => {
        if (active) setStatus(response.ok ? data : { authenticated: false });
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

  async function enroll() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/mfa/enroll', { method: 'POST' });
      const data = (await response.json().catch(() => ({}))) as Enrollment & { error?: string };
      if (!response.ok) throw new Error(data.error || '验证器设置失败。');
      setEnrollment(data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '验证器设置失败。');
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    const factorId = enrollment?.factorId || status?.factorId;
    if (!factorId) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/mfa/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ factorId, code }),
      });
      const data = (await response.json().catch(() => ({}))) as AdminState;
      if (!response.ok) throw new Error(data.error || '验证失败。');
      setCode('');
      setEnrollment(null);
      await loadStatus();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '验证失败。');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch('/api/admin/session', { method: 'DELETE' });
    setStatus({ authenticated: false });
    setEnrollment(null);
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
          <p className="mt-2 text-sm text-slate-600">{status.email} · 双重验证已通过</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/coach" className={button}>进入教练控制台</Link>
            <button type="button" onClick={logout} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">退出</button>
          </div>
        </section>
      </main>
    );
  }

  if (status.needsMfa) {
    return (
      <main className="mx-auto max-w-md px-4 py-12">
        <section className={panel}>
          <h1 className="text-lg font-semibold text-slate-900">二次验证</h1>
          {status.needsEnrollment && !enrollment ? (
            <>
              <p className="mt-2 text-sm text-slate-600">首次登录需要绑定验证器应用。</p>
              <button type="button" onClick={enroll} disabled={busy} className={`${button} mt-4`}>
                {busy ? '正在创建…' : '绑定验证器'}
              </button>
            </>
          ) : null}
          {enrollment ? (
            <div className="mt-4">
              <p className="text-sm text-slate-600">用 Microsoft Authenticator、1Password 或其他 TOTP 应用扫描：</p>
              {/* Supabase returns SVG markup, never an external image URL. */}
              {/* eslint-disable-next-line @next/next/no-img-element -- private, inline SVG from Supabase */}
              <img
                src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(enrollment.qrCode)}`}
                alt="管理员验证器二维码"
                className="mt-3 h-52 w-52 rounded-lg bg-white p-2"
              />
              <details className="mt-3 text-xs text-slate-500">
                <summary>无法扫码时显示密钥</summary>
                <code className="mt-2 block break-all rounded bg-slate-100 p-2">{enrollment.secret}</code>
              </details>
            </div>
          ) : null}
          {!status.needsEnrollment || enrollment ? (
            <form onSubmit={verify} className="mt-5 space-y-3">
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                className={field}
                placeholder="6 位验证码"
                inputMode="numeric"
                autoComplete="one-time-code"
              />
              <button type="submit" disabled={busy || code.length !== 6} className={button}>
                {busy ? '验证中…' : '验证并进入'}
              </button>
            </form>
          ) : null}
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
