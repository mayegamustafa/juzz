'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth, canEdit, isAdmin } from '@/lib/auth';
import { PageHeader, Spinner, ProgressBar } from '@/components/ui';
import { StudentRecords, RecordActions } from '@/components/StudentRecords';
import { ConfirmDialog } from '@/components/Modal';
import { useToast } from '@/components/Toast';
import { ChevronLeft, Download } from '@/components/icons';

interface StudentDetail {
  id: string;
  fullName: string;
  admissionNo: string;
  gender: string | null;
  guardianName: string | null;
  guardianPhone: string | null;
  schoolClass: { level: string };
  school: { name: string };
  primaryTeacher: { fullName: string } | null;
  progress: {
    memorized: number;
    target: number;
    percent: number;
    surahs: { surahId: string; number: number; name: string; juz: number; fraction: number }[];
  };
}
interface Remark {
  id: string;
  body: string;
  createdAt: string;
  author: { fullName: string } | null;
  canEdit: boolean;
}
interface StudentTarget {
  id: string;
  scope: 'ORGANIZATION' | 'SCHOOL' | 'CLASS' | 'STUDENT';
  unit: 'JUZ' | 'SURAH' | 'AYAH';
  amount: string;
  description: string | null;
  term: { name: string; isActive: boolean };
}

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const editable = canEdit(user?.role);
  const canManage = isAdmin(user?.role);
  const toast = useToast();
  const [s, setS] = useState<StudentDetail | null>(null);
  const [targets, setTargets] = useState<StudentTarget[]>([]);
  const [remarks, setRemarks] = useState<Remark[]>([]);
  const [newRemark, setNewRemark] = useState('');
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState('');
  const [editingRemark, setEditingRemark] = useState<Remark | null>(null);
  const [editRemarkBody, setEditRemarkBody] = useState('');
  const [deletingRemark, setDeletingRemark] = useState<Remark | null>(null);

  const exportAs = async (format: 'pdf' | 'xlsx') => {
    setExporting(format);
    try {
      await api.download(`/reports/student/${id}/export?format=${format}`);
    } finally {
      setExporting('');
    }
  };

  const load = () => {
    api.get<StudentDetail>(`/students/${id}`).then(setS);
    api.get<Remark[]>(`/students/${id}/remarks`).then(setRemarks);
    api.get<StudentTarget[]>(`/students/${id}/targets`).then(setTargets).catch(() => setTargets([]));
  };
  useEffect(load, [id]);

  const addRemark = async () => {
    if (!newRemark.trim()) return;
    setBusy(true);
    try {
      await api.post(`/students/${id}/remarks`, { body: newRemark.trim() });
      setNewRemark('');
      api.get<Remark[]>(`/students/${id}/remarks`).then(setRemarks);
    } finally {
      setBusy(false);
    }
  };

  const saveRemarkEdit = async () => {
    if (!editingRemark || !editRemarkBody.trim()) return;
    try {
      await api.patch(`/remarks/${editingRemark.id}`, { body: editRemarkBody.trim() });
      setEditingRemark(null);
      api.get<Remark[]>(`/students/${id}/remarks`).then(setRemarks);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const doDeleteRemark = async () => {
    if (!deletingRemark) return;
    try {
      await api.del(`/remarks/${deletingRemark.id}`);
      toast.success('Remark deleted');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeletingRemark(null);
      api.get<Remark[]>(`/students/${id}/remarks`).then(setRemarks);
    }
  };

  const unlockRemark = async (remarkId: string) => {
    await api.post(`/remarks/${remarkId}/unlock`, {});
    toast.success('Unlocked for the Sheikh for 24 hours');
    api.get<Remark[]>(`/students/${id}/remarks`).then(setRemarks);
  };

  if (!s) return <Spinner />;

  return (
    <div>
      <Link href="/students" className="mb-3 inline-flex items-center gap-1 text-sm text-emerald-600 hover:underline">
        <ChevronLeft size={16} /> Back to students
      </Link>
      <PageHeader
        title={s.fullName}
        subtitle={`${s.schoolClass.level} · ${s.school.name} · Sheikh: ${s.primaryTeacher?.fullName ?? '—'}`}
        action={
          <div className="flex gap-2">
            <button className="btn-outline" onClick={() => exportAs('pdf')} disabled={!!exporting}>
              <Download size={16} /> {exporting === 'pdf' ? 'Exporting…' : 'PDF'}
            </button>
            <button className="btn-outline" onClick={() => exportAs('xlsx')} disabled={!!exporting}>
              <Download size={16} /> {exporting === 'xlsx' ? 'Exporting…' : 'Excel'}
            </button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Profile */}
        <div className="card p-5">
          <h2 className="mb-3 font-semibold">Profile</h2>
          <dl className="space-y-2 text-sm">
            <Field label="Admission No." value={s.admissionNo} />
            <Field label="Gender" value={s.gender ?? '—'} />
            <Field label="Guardian" value={s.guardianName ?? '—'} />
            <Field label="Guardian Phone" value={s.guardianPhone ?? '—'} />
          </dl>
        </div>

        {/* Progress */}
        <div className="card p-5 lg:col-span-2">
          <h2 className="mb-3 font-semibold">Memorization progress (2 Juzu target)</h2>
          <div className="mb-2 flex items-center gap-3">
            <ProgressBar percent={s.progress.percent} />
            <span className="whitespace-nowrap text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              {s.progress.memorized}/{s.progress.target} ({s.progress.percent}%)
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {s.progress.surahs.length === 0 && (
              <span className="text-sm" style={{ color: 'var(--muted)' }}>
                No surahs recorded yet.
              </span>
            )}
            {s.progress.surahs.map((su) => (
              <span
                key={su.surahId}
                className="badge bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                title={`Surah ${su.number} · Juz ${su.juz}`}
              >
                {su.number}. {su.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Targets for the active term */}
      <div className="card mt-4 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">This term&apos;s targets</h2>
          {canManage && (
            <Link href="/targets" className="text-xs text-emerald-600 hover:underline">
              Manage targets
            </Link>
          )}
        </div>
        {targets.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            No target set for the active term yet.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {targets.map((t) => (
              <span
                key={t.id}
                className="badge bg-gold-200 text-gold-800"
                title={t.description ?? undefined}
              >
                {t.scope === 'STUDENT' ? 'Personal goal' : scopeWord(t.scope)}: {Number(t.amount)} {unitWord(t.unit)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Revision / Assessment / Mistakes / Attendance */}
      <StudentRecords studentId={s.id} editable={editable} />

      {/* Remarks */}
      <div className="card mt-4 p-5">
        <h2 className="mb-3 font-semibold">Teacher remarks</h2>
        {editable && (
          <div className="mb-4 flex gap-2">
            <input
              className="input"
              placeholder="Add a remark, e.g. 'Needs more revision on Juzu Tabaraka'"
              value={newRemark}
              onChange={(e) => setNewRemark(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addRemark()}
            />
            <button className="btn-primary" onClick={addRemark} disabled={busy}>
              Add
            </button>
          </div>
        )}
        <div className="space-y-2">
          {remarks.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              No remarks yet.
            </p>
          )}
          {remarks.map((r) => (
            <div key={r.id} className="rounded-lg border p-3 text-sm" style={{ borderColor: 'var(--border)' }}>
              {editingRemark?.id === r.id ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    className="input flex-1"
                    value={editRemarkBody}
                    onChange={(e) => setEditRemarkBody(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && saveRemarkEdit()}
                  />
                  <button className="btn-primary h-8 px-3 text-xs" onClick={saveRemarkEdit}>
                    Save
                  </button>
                  <button className="btn-outline h-8 px-3 text-xs" onClick={() => setEditingRemark(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p>{r.body}</p>
                    <p className="mt-1 text-[11px]" style={{ color: 'var(--muted)' }}>
                      {r.author?.fullName ?? 'Unknown'} · {new Date(r.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <RecordActions
                    canEdit={r.canEdit}
                    canManage={canManage}
                    onEdit={() => {
                      setEditingRemark(r);
                      setEditRemarkBody(r.body);
                    }}
                    onDelete={() => setDeletingRemark(r)}
                    onUnlock={() => unlockRemark(r.id)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <ConfirmDialog
        open={!!deletingRemark}
        onClose={() => setDeletingRemark(null)}
        onConfirm={doDeleteRemark}
        title="Delete this remark?"
        message="This cannot be undone."
      />
    </div>
  );
}

function unitWord(u: StudentTarget['unit']) {
  return u === 'JUZ' ? 'Juzu' : u === 'SURAH' ? 'Surah(s)' : 'Ayah(s)';
}
function scopeWord(s: StudentTarget['scope']) {
  return s === 'ORGANIZATION' ? 'Organisation goal' : s === 'SCHOOL' ? 'School goal' : 'Class goal';
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt style={{ color: 'var(--muted)' }}>{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
