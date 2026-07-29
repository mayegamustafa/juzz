'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useTheme } from '@/lib/theme';
import {
  BrandLogos,
  LETTERHEAD_TITLE,
  LETTERHEAD_MOTTO,
  LETTERHEAD_DEPARTMENT,
  COPYRIGHT,
} from '@/components/Brand';
import { Sun, Moon, Check } from '@/components/icons';

/** `unreachable` is deliberately distinct from `unavailable`: a network or CORS
 *  failure must not be reported as "this server is already set up". */
type Status = 'checking' | 'available' | 'unavailable' | 'unreachable' | 'done';

const EMPTY = {
  setupKey: '',
  organizationName: '',
  organizationCode: '',
  fullName: '',
  email: '',
  password: '',
  confirm: '',
};

export default function SetupPage() {
  const { dark, toggle } = useTheme();
  const [status, setStatus] = useState<Status>('checking');
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get<{ available: boolean }>('/setup/status')
      .then((r) => setStatus(r.available ? 'available' : 'unavailable'))
      .catch(() => setStatus('unreachable'));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      setError('Passwords do not match');
      return;
    }
    setBusy(true);
    try {
      await api.post('/setup/bootstrap', {
        setupKey: form.setupKey,
        organizationName: form.organizationName,
        organizationCode: form.organizationCode,
        fullName: form.fullName,
        email: form.email,
        password: form.password,
      });
      setStatus('done');
    } catch (err: any) {
      setError(err.message ?? 'Setup failed');
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
        <div className="card p-8" style={{ borderTop: '3px solid #047857' }}>
          <div className="text-center">
            <div className="mb-3 flex justify-center">
              <BrandLogos size={52} />
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

          <div className="my-6 border-t" style={{ borderColor: 'var(--border)' }} />

          {status === 'checking' && (
            <p className="text-center text-sm" style={{ color: 'var(--muted)' }}>
              Checking setup status...
            </p>
          )}

          {status === 'unreachable' && (
            <div className="text-center">
              <h2 className="font-heading text-lg font-bold">Cannot reach the server</h2>
              <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
                The setup status could not be read. This usually means the web app is pointed at
                the wrong API address, or the API is not allowing requests from this site. Check
                the NEXT_PUBLIC_API_URL and CORS_ORIGIN server variables.
              </p>
              <button className="btn-outline mt-5" onClick={() => window.location.reload()}>
                Try again
              </button>
            </div>
          )}

          {status === 'unavailable' && (
            <div className="text-center">
              <h2 className="font-heading text-lg font-bold">Setup is not available</h2>
              <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
                This server either already has an administrator account, or first-run setup was
                not enabled for it. If you believe this is wrong, check the SETUP_KEY server
                variable.
              </p>
              <Link href="/login" className="mt-5 inline-block text-sm text-emerald-600 hover:underline">
                Go to sign in
              </Link>
            </div>
          )}

          {status === 'done' && (
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                <Check size={22} />
              </div>
              <h2 className="font-heading text-lg font-bold">Administrator account created</h2>
              <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
                Sign in with the email and password you just set.
              </p>
              <Link href="/login" className="btn-primary mt-5 inline-flex">
                Continue to sign in
              </Link>
            </div>
          )}

          {status === 'available' && (
            <>
              <h2 className="font-heading mb-1 text-center text-lg font-bold">First-run setup</h2>
              <p className="mb-5 text-center text-sm" style={{ color: 'var(--muted)' }}>
                Create the first administrator account for this deployment. This page disables
                itself permanently once an account exists.
              </p>

              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="label">Setup key</label>
                  <input
                    className="input"
                    type="password"
                    value={form.setupKey}
                    onChange={(e) => setForm({ ...form, setupKey: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label">School / organisation name</label>
                    <input
                      className="input"
                      value={form.organizationName}
                      onChange={(e) => setForm({ ...form, organizationName: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Organisation code</label>
                    <input
                      className="input"
                      placeholder="e.g. SAKCPS"
                      value={form.organizationCode}
                      onChange={(e) => setForm({ ...form, organizationCode: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Your full name</label>
                  <input
                    className="input"
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input
                    className="input"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label">Password</label>
                    <input
                      className="input"
                      type="password"
                      minLength={8}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="label">Confirm password</label>
                    <input
                      className="input"
                      type="password"
                      minLength={8}
                      value={form.confirm}
                      onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                      required
                    />
                  </div>
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button className="btn-primary w-full" disabled={busy}>
                  {busy ? 'Creating account...' : 'Create administrator account'}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="mt-4 text-center text-[11px]" style={{ color: 'var(--muted)' }}>
          {COPYRIGHT}
        </p>
      </div>
    </div>
  );
}
