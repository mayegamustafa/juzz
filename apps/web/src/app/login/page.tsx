'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { LogoMark } from '@/components/icons';

const DEMO = [
  ['Super Admin', 'superadmin@qpms.test'],
  ['Supervisor', 'supervisor@qpms.test'],
  ['School Admin', 'admin.cps@qpms.test'],
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 to-gold-50 p-4 dark:from-emerald-950 dark:to-slate-900">
      <div className="card w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white">
            <LogoMark size={32} />
          </div>
          <h1 className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">QPMS</h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Quran Progress &amp; Memorization
          </p>
        </div>

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
          <div className="grid grid-cols-2 gap-2">
            {DEMO.map(([label, mail]) => (
              <button
                key={mail}
                type="button"
                onClick={() => setEmail(mail)}
                className="rounded-md border px-2 py-1 text-left text-xs hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                style={{ borderColor: 'var(--border)' }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
