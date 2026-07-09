'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth, isAdmin } from '@/lib/auth';
import { PageHeader, Spinner, Empty } from '@/components/ui';
import { Modal, ConfirmDialog } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { Plus, Pencil, Trash, Check } from '@/components/icons';

interface Term {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  _count: { targets: number };
}
interface Target {
  id: string;
  scope: 'ORGANIZATION' | 'SCHOOL' | 'CLASS';
  unit: 'JUZ' | 'SURAH' | 'AYAH';
  amount: string;
  description: string | null;
  term: { id: string; name: string; isActive: boolean };
  school: { id: string; code: string; name: string } | null;
  schoolClass: { id: string; name: string; level: string } | null;
}
interface School {
  id: string;
  code: string;
  name: string;
}
interface SchoolClass {
  id: string;
  name: string;
}

const iso = (d: string) => d.slice(0, 10);
const EMPTY_TERM = { name: '', startDate: '', endDate: '' };
const EMPTY_TARGET = {
  termId: '',
  scope: 'ORGANIZATION' as Target['scope'],
  unit: 'JUZ' as Target['unit'],
  amount: '2',
  description: '',
  schoolId: '',
  classId: '',
};

export default function TargetsPage() {
  const { user } = useAuth();
  const canManage = isAdmin(user?.role);
  const toast = useToast();

  const [terms, setTerms] = useState<Term[] | null>(null);
  const [targets, setTargets] = useState<Target[] | null>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);

  const [termForm, setTermForm] = useState(EMPTY_TERM);
  const [termOpen, setTermOpen] = useState(false);
  const [editingTerm, setEditingTerm] = useState<Term | null>(null);
  const [deletingTerm, setDeletingTerm] = useState<Term | null>(null);

  const [targetForm, setTargetForm] = useState(EMPTY_TARGET);
  const [targetOpen, setTargetOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<Target | null>(null);
  const [deletingTarget, setDeletingTarget] = useState<Target | null>(null);

  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api.get<Term[]>('/terms').then(setTerms).catch((e) => toast.error(e.message));
    api.get<Target[]>('/targets').then(setTargets).catch((e) => toast.error(e.message));
  }, [toast]);

  useEffect(() => {
    load();
    if (canManage) api.get<School[]>('/schools').then(setSchools).catch(() => undefined);
  }, [load, canManage]);

  // Class list only matters for class-scoped targets.
  useEffect(() => {
    if (targetForm.scope !== 'CLASS' || !targetForm.schoolId) {
      setClasses([]);
      return;
    }
    api
      .get<SchoolClass[]>(`/schools/${targetForm.schoolId}/classes`)
      .then((cs) => {
        setClasses(cs);
        setTargetForm((f) => (cs.some((c) => c.id === f.classId) ? f : { ...f, classId: cs[0]?.id ?? '' }));
      })
      .catch(() => setClasses([]));
  }, [targetForm.scope, targetForm.schoolId]);

  // ---- terms ----
  const saveTerm = async () => {
    setSaving(true);
    setError('');
    try {
      if (editingTerm) {
        await api.patch(`/terms/${editingTerm.id}`, termForm);
        toast.success('Term updated');
      } else {
        await api.post('/terms', termForm);
        toast.success('Term created');
      }
      setTermOpen(false);
      setEditingTerm(null);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const activateTerm = async (t: Term) => {
    try {
      await api.post(`/terms/${t.id}/activate`, {});
      toast.success(`${t.name} is now the active term`);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const removeTerm = async () => {
    if (!deletingTerm) return;
    setBusy(true);
    try {
      await api.del(`/terms/${deletingTerm.id}`);
      toast.success('Term deleted');
      setDeletingTerm(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
      setDeletingTerm(null);
    } finally {
      setBusy(false);
    }
  };

  // ---- targets ----
  const openTargetCreate = () => {
    setEditingTarget(null);
    setTargetForm({
      ...EMPTY_TARGET,
      termId: terms?.find((t) => t.isActive)?.id ?? terms?.[0]?.id ?? '',
      schoolId: schools[0]?.id ?? '',
    });
    setError('');
    setTargetOpen(true);
  };

  const openTargetEdit = (t: Target) => {
    setEditingTarget(t);
    setTargetForm({
      termId: t.term.id,
      scope: t.scope,
      unit: t.unit,
      amount: String(Number(t.amount)),
      description: t.description ?? '',
      schoolId: t.school?.id ?? schools[0]?.id ?? '',
      classId: t.schoolClass?.id ?? '',
    });
    setError('');
    setTargetOpen(true);
  };

  const saveTarget = async () => {
    setSaving(true);
    setError('');
    const payload = {
      termId: targetForm.termId,
      scope: targetForm.scope,
      unit: targetForm.unit,
      amount: Number(targetForm.amount),
      description: targetForm.description || undefined,
      schoolId: targetForm.scope === 'SCHOOL' ? targetForm.schoolId : undefined,
      classId: targetForm.scope === 'CLASS' ? targetForm.classId : undefined,
    };
    try {
      if (editingTarget) {
        await api.patch(`/targets/${editingTarget.id}`, payload);
        toast.success('Target updated');
      } else {
        await api.post('/targets', payload);
        toast.success('Target created');
      }
      setTargetOpen(false);
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const removeTarget = async () => {
    if (!deletingTarget) return;
    setBusy(true);
    try {
      await api.del(`/targets/${deletingTarget.id}`);
      toast.success('Target deleted');
      setDeletingTarget(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
      setDeletingTarget(null);
    } finally {
      setBusy(false);
    }
  };

  if (!terms || !targets) return <Spinner />;

  const scopeLabel = (t: Target) =>
    t.scope === 'ORGANIZATION'
      ? 'Whole organisation'
      : t.scope === 'SCHOOL'
        ? (t.school?.code ?? 'School')
        : (t.schoolClass?.name ?? 'Class');

  return (
    <div>
      <PageHeader title="Terms & Targets" subtitle="Academic terms and Juzu memorization goals" />

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Terms */}
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Academic terms</h2>
            {canManage && (
              <button
                className="btn-outline h-8 px-2 text-xs"
                onClick={() => {
                  setEditingTerm(null);
                  setTermForm(EMPTY_TERM);
                  setError('');
                  setTermOpen(true);
                }}
              >
                <Plus size={14} /> Term
              </button>
            )}
          </div>

          {terms.length === 0 ? (
            <Empty>No terms yet.</Empty>
          ) : (
            <div className="space-y-2">
              {terms.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between gap-2 rounded-lg border p-3"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-medium">
                      {t.name}
                      {t.isActive && (
                        <span className="badge bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                          active
                        </span>
                      )}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>
                      {new Date(t.startDate).toLocaleDateString()} – {new Date(t.endDate).toLocaleDateString()} ·{' '}
                      {t._count.targets} target{t._count.targets === 1 ? '' : 's'}
                    </p>
                  </div>
                  {canManage && (
                    <div className="flex shrink-0 gap-1">
                      {!t.isActive && (
                        <button className="btn-icon" title="Make active term" onClick={() => activateTerm(t)}>
                          <Check size={14} />
                        </button>
                      )}
                      <button
                        className="btn-icon"
                        title="Edit"
                        onClick={() => {
                          setEditingTerm(t);
                          setTermForm({ name: t.name, startDate: iso(t.startDate), endDate: iso(t.endDate) });
                          setError('');
                          setTermOpen(true);
                        }}
                      >
                        <Pencil size={14} />
                      </button>
                      <button className="btn-icon btn-icon-danger" title="Delete" onClick={() => setDeletingTerm(t)}>
                        <Trash size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Targets */}
        <div className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Targets</h2>
            {canManage && (
              <button className="btn-outline h-8 px-2 text-xs" onClick={openTargetCreate} disabled={terms.length === 0}>
                <Plus size={14} /> Target
              </button>
            )}
          </div>

          {targets.length === 0 ? (
            <Empty>{terms.length === 0 ? 'Create a term first.' : 'No targets yet.'}</Empty>
          ) : (
            <div className="space-y-2">
              {targets.map((t) => (
                <div key={t.id} className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="badge bg-gold-200 text-gold-800">{scopeLabel(t)}</span>
                        <span className="font-medium">
                          {Number(t.amount)} {t.unit}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--muted)' }}>
                          · {t.term.name}
                          {t.term.isActive && ' (active)'}
                        </span>
                      </div>
                      {t.description && (
                        <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
                          {t.description}
                        </p>
                      )}
                    </div>
                    {canManage && (
                      <div className="flex shrink-0 gap-1">
                        <button className="btn-icon" title="Edit" onClick={() => openTargetEdit(t)}>
                          <Pencil size={14} />
                        </button>
                        <button className="btn-icon btn-icon-danger" title="Delete" onClick={() => setDeletingTarget(t)}>
                          <Trash size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Term modal */}
      <Modal
        open={termOpen}
        onClose={() => setTermOpen(false)}
        title={editingTerm ? `Edit ${editingTerm.name}` : 'New term'}
        width="max-w-md"
        footer={
          <>
            <button className="btn-outline" onClick={() => setTermOpen(false)} disabled={saving}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={saveTerm}
              disabled={saving || !termForm.name.trim() || !termForm.startDate || !termForm.endDate}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label">Name</label>
            <input
              className="input"
              placeholder="e.g. Term 3 2025"
              value={termForm.name}
              onChange={(e) => setTermForm({ ...termForm, name: e.target.value })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Start date</label>
              <input
                className="input"
                type="date"
                value={termForm.startDate}
                onChange={(e) => setTermForm({ ...termForm, startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="label">End date</label>
              <input
                className="input"
                type="date"
                value={termForm.endDate}
                onChange={(e) => setTermForm({ ...termForm, endDate: e.target.value })}
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </Modal>

      {/* Target modal */}
      <Modal
        open={targetOpen}
        onClose={() => setTargetOpen(false)}
        title={editingTarget ? 'Edit target' : 'New target'}
        description="Example: Term 1 — memorize 2 Juzu."
        footer={
          <>
            <button className="btn-outline" onClick={() => setTargetOpen(false)} disabled={saving}>
              Cancel
            </button>
            <button className="btn-primary" onClick={saveTarget} disabled={saving || !targetForm.termId || !targetForm.amount}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label">Term</label>
            <select className="input" value={targetForm.termId} onChange={(e) => setTargetForm({ ...targetForm, termId: e.target.value })}>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.isActive ? ' (active)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label">Applies to</label>
              <select
                className="input"
                value={targetForm.scope}
                onChange={(e) => setTargetForm({ ...targetForm, scope: e.target.value as Target['scope'] })}
              >
                <option value="ORGANIZATION">Whole organisation</option>
                <option value="SCHOOL">One school</option>
                <option value="CLASS">One class</option>
              </select>
            </div>
            <div>
              <label className="label">Amount</label>
              <input
                className="input"
                type="number"
                min={0}
                step="0.5"
                value={targetForm.amount}
                onChange={(e) => setTargetForm({ ...targetForm, amount: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Unit</label>
              <select
                className="input"
                value={targetForm.unit}
                onChange={(e) => setTargetForm({ ...targetForm, unit: e.target.value as Target['unit'] })}
              >
                <option value="JUZ">Juzu</option>
                <option value="SURAH">Surahs</option>
                <option value="AYAH">Ayahs</option>
              </select>
            </div>
          </div>

          {targetForm.scope !== 'ORGANIZATION' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">School</label>
                <select
                  className="input"
                  value={targetForm.schoolId}
                  onChange={(e) => setTargetForm({ ...targetForm, schoolId: e.target.value })}
                >
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                </select>
              </div>
              {targetForm.scope === 'CLASS' && (
                <div>
                  <label className="label">Class</label>
                  <select
                    className="input"
                    value={targetForm.classId}
                    onChange={(e) => setTargetForm({ ...targetForm, classId: e.target.value })}
                  >
                    {classes.length === 0 && <option value="">No classes</option>}
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="label">Description</label>
            <input
              className="input"
              placeholder="Optional note"
              value={targetForm.description}
              onChange={(e) => setTargetForm({ ...targetForm, description: e.target.value })}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deletingTerm}
        onClose={() => setDeletingTerm(null)}
        onConfirm={removeTerm}
        busy={busy}
        title={`Delete ${deletingTerm?.name}?`}
        message="A term that still has targets cannot be deleted."
      />
      <ConfirmDialog
        open={!!deletingTarget}
        onClose={() => setDeletingTarget(null)}
        onConfirm={removeTarget}
        busy={busy}
        title="Delete this target?"
        message="This cannot be undone."
      />
    </div>
  );
}
