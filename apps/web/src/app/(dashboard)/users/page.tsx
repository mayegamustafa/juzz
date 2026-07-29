'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth, isOwner, ROLE_LABELS } from '@/lib/auth';
import { PageHeader, Spinner, Empty } from '@/components/ui';
import { Modal, ConfirmDialog } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { Plus, Pencil, Key, Archive, Restore } from '@/components/icons';

type StaffRole = 'SUPER_ADMIN' | 'SUPERVISOR';

interface StaffUser {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: StaffRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  school: { id: string; code: string; name: string } | null;
}

const EMPTY = { fullName: '', email: '', phone: '', role: 'SUPERVISOR' as StaffRole, password: '' };

export default function UsersPage() {
  const { user } = useAuth();
  const owner = isOwner(user?.role);
  const toast = useToast();

  const [users, setUsers] = useState<StaffUser[] | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StaffUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [resetting, setResetting] = useState<StaffUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [suspending, setSuspending] = useState<StaffUser | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get<StaffUser[]>('/users').then(setUsers).catch((e) => toast.error(e.message));
  }, [toast]);

  useEffect(load, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setError('');
    setOpen(true);
  };

  const openEdit = (u: StaffUser) => {
    setEditing(u);
    setForm({ fullName: u.fullName, email: u.email, phone: u.phone ?? '', role: u.role, password: '' });
    setError('');
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await api.patch(`/users/${editing.id}`, {
          fullName: form.fullName,
          email: form.email,
          phone: form.phone || undefined,
          role: form.role,
        });
        toast.success('Account updated');
      } else {
        await api.post('/users', {
          fullName: form.fullName,
          email: form.email,
          phone: form.phone || undefined,
          role: form.role,
          password: form.password,
        });
        toast.success('Account created');
      }
      setOpen(false);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const doReset = async () => {
    if (!resetting) return;
    setBusy(true);
    try {
      await api.post(`/users/${resetting.id}/reset-password`, { password: newPassword });
      toast.success(`Password reset. ${resetting.fullName} must sign in again.`);
      setResetting(null);
      setNewPassword('');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const doToggleActive = async () => {
    if (!suspending) return;
    setBusy(true);
    try {
      await api.post(`/users/${suspending.id}/status`, { isActive: !suspending.isActive });
      toast.success(suspending.isActive ? 'Account suspended' : 'Account restored');
      setSuspending(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
      setSuspending(null);
    } finally {
      setBusy(false);
    }
  };

  if (!users) return <Spinner />;

  const canSubmit =
    form.fullName.trim().length > 1 &&
    form.email.includes('@') &&
    (editing || form.password.length >= 8);

  return (
    <div>
      <PageHeader
        title="Staff accounts"
        subtitle="Managers and system owners. Sheikh logins are created on the Sheikhs page."
        action={
          <button className="btn-primary" onClick={openCreate}>
            <Plus size={16} /> Add account
          </button>
        }
      />

      {users.length === 0 ? (
        <Empty>No staff accounts yet.</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left" style={{ borderColor: 'var(--border)' }}>
                <th className="px-4 py-2.5 font-medium">Name</th>
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="px-4 py-2.5 font-medium">Role</th>
                <th className="px-4 py-2.5 font-medium">Last sign-in</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const self = u.id === user?.id;
                // A manager may not touch an owner account at all.
                const locked = u.role === 'SUPER_ADMIN' && !owner;
                return (
                  <tr key={u.id} className="border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                    <td className="px-4 py-2.5">
                      {u.fullName}
                      {self && (
                        <span className="ml-2 text-[11px]" style={{ color: 'var(--muted)' }}>
                          (you)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">{u.email}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`badge ${
                          u.role === 'SUPER_ADMIN'
                            ? 'bg-gold-200 text-gold-800'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                        }`}
                      >
                        {ROLE_LABELS[u.role]}
                      </span>
                    </td>
                    <td className="px-4 py-2.5" style={{ color: 'var(--muted)' }}>
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-4 py-2.5">
                      {u.isActive ? (
                        <span className="text-emerald-700 dark:text-emerald-400">Active</span>
                      ) : (
                        <span className="text-red-600">Suspended</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button
                          className="btn-icon"
                          title={locked ? 'Only a super admin can edit an owner account' : 'Edit'}
                          disabled={locked}
                          onClick={() => openEdit(u)}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className="btn-icon"
                          title={locked ? 'Only a super admin can reset an owner password' : 'Reset password'}
                          disabled={locked}
                          onClick={() => {
                            setResetting(u);
                            setNewPassword('');
                          }}
                        >
                          <Key size={14} />
                        </button>
                        <button
                          className={u.isActive ? 'btn-icon btn-icon-danger' : 'btn-icon'}
                          title={
                            self
                              ? 'You cannot suspend your own account'
                              : locked
                                ? 'Only a super admin can suspend an owner account'
                                : u.isActive
                                  ? 'Suspend'
                                  : 'Restore'
                          }
                          disabled={self || locked}
                          onClick={() => setSuspending(u)}
                        >
                          {u.isActive ? <Archive size={14} /> : <Restore size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs" style={{ color: 'var(--muted)' }}>
        Managers can do everything in the system except publish a mobile app release or grant super
        admin, which stay with the super admin. Sheikh accounts are created on the{' '}
        <Link href="/teachers" className="text-emerald-600 hover:underline">
          Sheikhs
        </Link>{' '}
        page so their teaching record is created alongside the login.
      </p>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Edit ${editing.fullName}` : 'New staff account'}
        description="Managers administer the organisation. Super admin additionally controls deployment settings."
        footer={
          <>
            <button className="btn-outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </button>
            <button className="btn-primary" onClick={save} disabled={saving || !canSubmit}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label">Full name</label>
            <input
              className="input"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Email</label>
              <input
                className="input"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Phone</label>
              <input
                className="input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="label">Role</label>
            <select
              className="input"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as StaffRole })}
              disabled={editing?.id === user?.id}
            >
              <option value="SUPERVISOR">{ROLE_LABELS.SUPERVISOR}</option>
              <option value="SUPER_ADMIN" disabled={!owner}>
                {ROLE_LABELS.SUPER_ADMIN}
                {!owner ? ' (super admin only)' : ''}
              </option>
            </select>
            {editing?.id === user?.id && (
              <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
                You cannot change your own role.
              </p>
            )}
          </div>
          {!editing && (
            <div>
              <label className="label">Temporary password</label>
              <input
                className="input"
                type="text"
                placeholder="At least 8 characters"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
                Share this with them directly. They can change it after signing in.
              </p>
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </Modal>

      <Modal
        open={!!resetting}
        onClose={() => setResetting(null)}
        title={`Reset password for ${resetting?.fullName}`}
        width="max-w-md"
        footer={
          <>
            <button className="btn-outline" onClick={() => setResetting(null)} disabled={busy}>
              Cancel
            </button>
            <button className="btn-primary" onClick={doReset} disabled={busy || newPassword.length < 8}>
              {busy ? 'Resetting...' : 'Reset password'}
            </button>
          </>
        }
      >
        <label className="label">New password</label>
        <input
          className="input"
          type="text"
          placeholder="At least 8 characters"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>
          This signs them out everywhere immediately.
        </p>
      </Modal>

      <ConfirmDialog
        open={!!suspending}
        onClose={() => setSuspending(null)}
        onConfirm={doToggleActive}
        busy={busy}
        title={suspending?.isActive ? `Suspend ${suspending?.fullName}?` : `Restore ${suspending?.fullName}?`}
        message={
          suspending?.isActive
            ? 'They will be unable to sign in. Their records and remarks are kept.'
            : 'They will be able to sign in again.'
        }
      />
    </div>
  );
}
