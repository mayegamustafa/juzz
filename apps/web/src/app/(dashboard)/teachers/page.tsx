'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth, isAdmin } from '@/lib/auth';
import { PageHeader, Spinner, Empty } from '@/components/ui';
import { Modal, ConfirmDialog } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { Plus, Pencil, Trash, Key, Search } from '@/components/icons';

interface School {
  id: string;
  code: string;
  name: string;
}
interface Teacher {
  id: string;
  fullName: string;
  phone: string | null;
  isActive: boolean;
  school: { id: string; code: string; name: string };
  user: { email: string; isActive: boolean } | null;
  _count: { primaryStudents: number };
}

const EMPTY = { fullName: '', phone: '', schoolId: '', email: '', password: '' };

export default function TeachersPage() {
  const { user } = useAuth();
  const canManage = isAdmin(user?.role);
  const toast = useToast();

  const [teachers, setTeachers] = useState<Teacher[] | null>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [query, setQuery] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('');

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [deleting, setDeleting] = useState<Teacher | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState<Teacher | null>(null);
  const [newPassword, setNewPassword] = useState('');

  const load = useCallback(() => {
    api.get<Teacher[]>('/teachers').then(setTeachers).catch((e) => toast.error(e.message));
  }, [toast]);

  useEffect(() => {
    load();
    api.get<School[]>('/schools').then(setSchools).catch(() => undefined);
  }, [load]);

  const visible = useMemo(() => {
    if (!teachers) return [];
    const q = query.trim().toLowerCase();
    return teachers
      .filter((t) => !schoolFilter || t.school.id === schoolFilter)
      .filter((t) => !q || t.fullName.toLowerCase().includes(q) || (t.user?.email ?? '').toLowerCase().includes(q));
  }, [teachers, query, schoolFilter]);

  const openCreate = () => {
    setForm({ ...EMPTY, schoolId: schools[0]?.id ?? '' });
    setFormError('');
    setCreating(true);
  };

  const openEdit = (t: Teacher) => {
    setForm({ fullName: t.fullName, phone: t.phone ?? '', schoolId: t.school.id, email: '', password: '' });
    setFormError('');
    setEditing(t);
  };

  const closeForm = () => {
    setCreating(false);
    setEditing(null);
    setFormError('');
  };

  const save = async () => {
    setSaving(true);
    setFormError('');
    try {
      if (editing) {
        await api.patch(`/teachers/${editing.id}`, {
          fullName: form.fullName,
          phone: form.phone || undefined,
          schoolId: form.schoolId,
        });
        toast.success(`${form.fullName} updated`);
      } else {
        await api.post('/teachers', {
          fullName: form.fullName,
          phone: form.phone || undefined,
          schoolId: form.schoolId,
          // A login is optional: create one only if both fields are filled.
          email: form.email || undefined,
          password: form.password || undefined,
        });
        toast.success(`${form.fullName} added`);
      }
      closeForm();
      load();
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.del(`/teachers/${deleting.id}`);
      toast.success(`${deleting.fullName} removed`);
      setDeleting(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (t: Teacher) => {
    try {
      await api.patch(`/teachers/${t.id}`, { isActive: !t.isActive });
      toast.success(`${t.fullName} ${t.isActive ? 'deactivated' : 'activated'}`);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const doReset = async () => {
    if (!resetting || newPassword.length < 8) return;
    setBusy(true);
    try {
      await api.post(`/teachers/${resetting.id}/reset-password`, { password: newPassword });
      toast.success(`Password reset for ${resetting.fullName}. They must sign in again.`);
      setResetting(null);
      setNewPassword('');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!teachers) return <Spinner />;

  const canSubmit =
    form.fullName.trim() &&
    form.schoolId &&
    // A login needs both halves, or neither.
    (!!editing || (!form.email && !form.password) || (form.email && form.password.length >= 8));

  return (
    <div>
      <PageHeader
        title="Sheikhs"
        subtitle={`${teachers.length} sheikh${teachers.length === 1 ? '' : 's'} across the organisation`}
        action={
          canManage && (
            <button className="btn-primary" onClick={openCreate} disabled={schools.length === 0}>
              <Plus size={16} /> Add sheikh
            </button>
          )
        }
      />

      <div className="card mb-4 flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-56 flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }}>
            <Search size={16} />
          </span>
          <input
            className="input pl-9"
            placeholder="Search by name or email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select className="input w-auto" value={schoolFilter} onChange={(e) => setSchoolFilter(e.target.value)}>
          <option value="">All schools</option>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code} · {s.name}
            </option>
          ))}
        </select>
      </div>

      {visible.length === 0 ? (
        <Empty>{query || schoolFilter ? 'No sheikhs match your filters.' : 'No sheikhs yet.'}</Empty>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left" style={{ borderColor: 'var(--border)' }}>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">School</th>
                <th className="px-4 py-3">Login</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3 text-center">Pupils</th>
                <th className="px-4 py-3">Status</th>
                {canManage && <th className="px-4 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {visible.map((t) => (
                <tr key={t.id} className="border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                  <td className="px-4 py-2.5 font-medium">{t.fullName}</td>
                  <td className="px-4 py-2.5">
                    <span className="badge bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                      {t.school.code}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--muted)' }}>
                    {t.user?.email ?? 'no login'}
                  </td>
                  <td className="px-4 py-2.5">{t.phone ?? 'N/A'}</td>
                  <td className="px-4 py-2.5 text-center font-medium">{t._count.primaryStudents}</td>
                  <td className="px-4 py-2.5">
                    <button
                      disabled={!canManage}
                      onClick={() => toggleActive(t)}
                      className={`badge ${
                        t.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                      } ${canManage ? 'cursor-pointer' : ''}`}
                      title={canManage ? 'Click to toggle' : undefined}
                    >
                      {t.isActive ? 'active' : 'inactive'}
                    </button>
                  </td>
                  {canManage && (
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        <button className="btn-icon" title="Edit / transfer" onClick={() => openEdit(t)}>
                          <Pencil size={14} />
                        </button>
                        <button
                          className="btn-icon"
                          title={t.user ? 'Reset password' : 'No login account'}
                          disabled={!t.user}
                          onClick={() => setResetting(t)}
                        >
                          <Key size={14} />
                        </button>
                        <button className="btn-icon btn-icon-danger" title="Delete" onClick={() => setDeleting(t)}>
                          <Trash size={14} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / edit */}
      <Modal
        open={creating || !!editing}
        onClose={closeForm}
        title={editing ? `Edit ${editing.fullName}` : 'Add sheikh'}
        description={editing ? 'Changing the school transfers this sheikh.' : undefined}
        footer={
          <>
            <button className="btn-outline" onClick={closeForm} disabled={saving}>
              Cancel
            </button>
            <button className="btn-primary" onClick={save} disabled={saving || !canSubmit}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add sheikh'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label">Full name</label>
            <input className="input" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </div>
          <div>
            <label className="label">School</label>
            <select className="input" value={form.schoolId} onChange={(e) => setForm({ ...form, schoolId: e.target.value })}>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} · {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>

          {!editing && (
            <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
              <p className="mb-2 text-xs" style={{ color: 'var(--muted)' }}>
                Optional: create a login so this sheikh can use the mobile app. Leave blank to add a
                record only.
              </p>
              <div className="space-y-2">
                <input
                  className="input"
                  type="email"
                  placeholder="Email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
                <input
                  className="input"
                  type="password"
                  placeholder="Password (min 8 characters)"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                />
              </div>
            </div>
          )}

          {formError && <p className="text-sm text-red-600">{formError}</p>}
        </div>
      </Modal>

      {/* Reset password */}
      <Modal
        open={!!resetting}
        onClose={() => {
          setResetting(null);
          setNewPassword('');
        }}
        title={`Reset password for ${resetting?.fullName}`}
        description="They will be signed out of every device."
        width="max-w-sm"
        footer={
          <>
            <button
              className="btn-outline"
              onClick={() => {
                setResetting(null);
                setNewPassword('');
              }}
            >
              Cancel
            </button>
            <button className="btn-primary" onClick={doReset} disabled={busy || newPassword.length < 8}>
              {busy ? 'Resetting…' : 'Reset password'}
            </button>
          </>
        }
      >
        <label className="label">New password</label>
        <input
          className="input"
          type="password"
          autoFocus
          placeholder="At least 8 characters"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={doDelete}
        busy={busy}
        title={`Delete ${deleting?.fullName}?`}
        message="This also removes their login. A sheikh who still has pupils cannot be deleted; reassign the pupils first, or deactivate instead."
      />
    </div>
  );
}
