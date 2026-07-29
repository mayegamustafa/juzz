'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { BrandLogos, LETTERHEAD_TITLE, LETTERHEAD_MOTTO, LETTERHEAD_DEPARTMENT } from '@/components/Brand';
import { Sun, Moon } from '@/components/icons';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const { dark, toggle } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    <div className="relative flex min-h-screen items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <button
        className="btn-ghost absolute right-4 top-4 px-2"
        onClick={toggle}
        title="Toggle theme"
        aria-label="Toggle theme"
      >
        {dark ? <Sun size={18} /> : <Moon size={18} />}
      </button>
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
            Sign in to the Juzz Tracking System
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
        </div>

        <p className="mt-4 text-center text-[11px]" style={{ color: 'var(--muted)' }}>
          SAK/CPS Juzz Tracking System
        </p>
      </div>
    </div>
  );
}
