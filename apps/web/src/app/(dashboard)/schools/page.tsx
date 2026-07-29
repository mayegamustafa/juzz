'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { isAdmin, useAuth } from '@/lib/auth';
import { PageHeader, Spinner, Empty } from '@/components/ui';
import { Modal, ConfirmDialog } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { Plus, Pencil, Trash, Archive, Restore, Search, SchoolIcon } from '@/components/icons';
import { SchoolClasses } from '@/components/SchoolClasses';

interface School {
  id: string;
  code: string;
  name: string;
  location: string | null;
  isActive: boolean;
  _count: { students: number; teachers: number; classes: number };
}

const EMPTY = { code: '', name: '', location: '' };

export default function SchoolsPage() {
  const { user } = useAuth();
  const canManage = isAdmin(user?.role);
  const toast = useToast();

  const [schools, setSchools] = useState<School[] | null>(null);
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);

  const [editing, setEditing] = useState<School | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [deleting, setDeleting] = useState<School | null>(null);
  const [busy, setBusy] = useState(false);
  const [managingClasses, setManagingClasses] = useState<School | null>(null);

  const load = useCallback(() => {
    api
      .get<School[]>('/schools')
      .then(setSchools)
      .catch((e) => toast.error(e.message));
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = useMemo(() => {
    if (!schools) return [];
    const q = query.trim().toLowerCase();
    return schools
      .filter((s) => (showArchived ? true : s.isActive))
      .filter((s) => !q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q));
  }, [schools, query, showArchived]);

  const openCreate = () => {
    setForm(EMPTY);
    setFormError('');
    setCreating(true);
  };

  const openEdit = (s: School) => {
    setForm({ code: s.code, name: s.name, location: s.location ?? '' });
    setFormError('');
    setEditing(s);
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
        // `code` is the school's stable identity across the workbook; it is not editable.
        await api.patch(`/schools/${editing.id}`, { name: form.name, location: form.location || undefined });
        toast.success(`${form.name} updated`);
      } else {
        await api.post('/schools', { ...form, location: form.location || undefined });
        toast.success(`${form.name} added`);
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
      await api.del(`/schools/${deleting.id}`);
      toast.success(`${deleting.name} deleted`);
      setDeleting(null);
      load();
    } catch (e: any) {
      // The API refuses to orphan pupils/sheikhs — surface exactly why.
      toast.error(e.message);
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  };

  const toggleArchive = async (s: School) => {
    try {
      await api.post(`/schools/${s.id}/${s.isActive ? 'archive' : 'restore'}`, {});
      toast.success(`${s.name} ${s.isActive ? 'archived' : 'restored'}`);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (!schools) return <Spinner />;

  const archivedCount = schools.filter((s) => !s.isActive).length;

  return (
    <div>
      <PageHeader
        title="Schools"
        subtitle={`${schools.filter((s) => s.isActive).length} active${archivedCount ? ` · ${archivedCount} archived` : ''}`}
        action={
          canManage && (
            <button className="btn-primary" onClick={openCreate}>
              <Plus size={16} /> Add school
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
            placeholder="Search by name or code…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {archivedCount > 0 && (
          <label className="flex cursor-pointer items-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            Show archived
          </label>
        )}
      </div>

      {visible.length === 0 ? (
        <Empty>{query ? `No schools match “${query}”.` : 'No schools yet.'}</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((s) => (
            <div key={s.id} className={`card p-5 ${s.isActive ? '' : 'opacity-60'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="badge bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                    {s.code}
                  </span>
                  {!s.isActive && <span className="badge bg-slate-200 text-slate-600">archived</span>}
                </div>
                {canManage && (
                  <div className="flex gap-1">
                    <button className="btn-icon" title="Edit" onClick={() => openEdit(s)}>
                      <Pencil size={14} />
                    </button>
                    <button
                      className="btn-icon"
                      title={s.isActive ? 'Archive' : 'Restore'}
                      onClick={() => toggleArchive(s)}
                    >
                      {s.isActive ? <Archive size={14} /> : <Restore size={14} />}
                    </button>
                    <button className="btn-icon btn-icon-danger" title="Delete" onClick={() => setDeleting(s)}>
                      <Trash size={14} />
                    </button>
                  </div>
                )}
              </div>

              <h3 className="mt-2 font-semibold">{s.name}</h3>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                {s.location ?? 'N/A'}
              </p>

              <div className="mt-3 flex gap-4 text-sm">
                <span>
                  <b>{s._count.students}</b> pupils
                </span>
                <span>
                  <b>{s._count.teachers}</b> sheikhs
                </span>
                <span>
                  <b>{s._count.classes}</b> classes
                </span>
              </div>

              <button
                className="btn-outline mt-4 w-full"
                onClick={() => setManagingClasses(s)}
              >
                <SchoolIcon size={15} /> Manage classes
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create / edit */}
      <Modal
        open={creating || !!editing}
        onClose={closeForm}
        title={editing ? `Edit ${editing.code}` : 'Add school'}
        description={editing ? 'The school code cannot be changed.' : 'Codes are stored uppercase and must be unique.'}
        footer={
          <>
            <button className="btn-outline" onClick={closeForm} disabled={saving}>
              Cancel
            </button>
            <button className="btn-primary" onClick={save} disabled={saving || !form.name.trim() || (!editing && !form.code.trim())}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add school'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label">School code</label>
            <input
              className="input"
              placeholder="e.g. CPS"
              value={form.code}
              disabled={!!editing}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            />
          </div>
          <div>
            <label className="label">Name</label>
            <input
              className="input"
              placeholder="e.g. City Parents School"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Location</label>
            <input
              className="input"
              placeholder="Optional"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={doDelete}
        busy={busy}
        title={`Delete ${deleting?.name}?`}
        message={
          <>
            This permanently removes the school. Schools that still hold pupils or sheikhs cannot be
            deleted; archive them instead.
          </>
        }
      />

      {managingClasses && (
        <SchoolClasses
          school={managingClasses}
          canManage={canManage}
          onClose={() => {
            setManagingClasses(null);
            load();
          }}
        />
      )}
    </div>
  );
}
