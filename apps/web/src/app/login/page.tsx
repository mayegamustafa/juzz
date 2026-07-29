'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { BrandLogos, LETTERHEAD_TITLE, LETTERHEAD_MOTTO, LETTERHEAD_DEPARTMENT } from '@/components/Brand';

const DEMO = [
  ['Super Admin', 'superadmin@qpms.test'],
  ['Manager / EMT', 'manager@qpms.test'],
  ['Sheikh (Teacher)', 'nyombi@qpms.test'],
];

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('superadmin@qpms.test');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message ?? 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-md">
        {/* Letterhead */}
        <div className="mb-5 text-center">
          <div className="mb-3 flex justify-center">
            <BrandLogos size={60} />
          </div>
          <h1 className="font-heading text-lg font-bold leading-tight text-emerald-800 dark:text-emerald-400">
            {LETTERHEAD_TITLE}
          </h1>
          <p className="font-heading mt-0.5 text-xs italic" style={{ color: 'var(--muted)' }}>
            {LETTERHEAD_MOTTO}
          </p>
          <p className="mt-1.5 text-[11px] font-semibold uppercase tracking-wide text-gold-700 dark:text-gold-500">
            {LETTERHEAD_DEPARTMENT}
          </p>
        </div>

        <div className="card p-8" style={{ borderTop: '3px solid #047857' }}>
          <p className="mb-5 text-center text-sm font-medium" style={{ color: 'var(--muted)' }}>
            Juzz Tracking System — sign in
          </p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
            </div>
            <div>
              <label className="label">Password</label>
              <input
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
              />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button className="btn-primary w-full" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 border-t pt-4" style={{ borderColor: 'var(--border)' }}>
            <p className="mb-2 text-xs font-medium" style={{ color: 'var(--muted)' }}>
              Demo accounts (password: Password123!)
            </p>
            <div className="grid grid-cols-3 gap-2">
              {DEMO.map(([label, mail]) => (
                <button
                  key={mail}
                  type="button"
                  onClick={() => setEmail(mail)}
                  className="rounded-md border px-2 py-1.5 text-left text-xs hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                  style={{ borderColor: 'var(--border)' }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-4 text-center text-[11px]" style={{ color: 'var(--muted)' }}>
          SAK/CPS Juzz Tracking System
        </p>
      </div>
    </div>
  );
}
