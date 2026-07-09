'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth, isAdmin, canEdit } from '@/lib/auth';
import { PageHeader, Spinner, ProgressBar, Empty } from '@/components/ui';
import { Pagination } from '@/components/Pagination';
import { ConfirmDialog } from '@/components/Modal';
import { StudentForm } from '@/components/StudentForm';
import { useToast } from '@/components/Toast';
import { Search, Plus, Pencil, Trash, Archive } from '@/components/icons';

interface Student {
  id: string;
  fullName: string;
  admissionNo: string;
  gender: string | null;
  status: string;
  classId: string;
  streamId: string | null;
  primaryTeacherId: string | null;
  schoolId: string;
  guardianName: string | null;
  guardianPhone: string | null;
  schoolClass: { level: string };
  stream: { name: string } | null;
  school: { code: string };
  primaryTeacher: { fullName: string } | null;
  progress: { memorized: number; target: number; percent: number };
}
interface Paged {
  data: Student[];
  meta: { page: number; pageSize: number; total: number };
}
interface School {
  id: string;
  code: string;
  name: string;
}

export default function StudentsPage() {
  const { user } = useAuth();
  const canManage = isAdmin(user?.role);
  const canEditPupil = canEdit(user?.role);
  const toast = useToast();

  const [data, setData] = useState<Paged | null>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [q, setQ] = useState('');
  const [schoolId, setSchoolId] = useState('');
  const [status, setStatus] = useState('ACTIVE');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState<Student | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (q) params.set('q', q);
    if (schoolId) params.set('schoolId', schoolId);
    if (status) params.set('status', status);
    api
      .get<Paged>(`/students?${params}`)
      .then(setData)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [page, pageSize, q, schoolId, status, toast]);

  // Debounce so typing in search doesn't fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    if (canManage) api.get<School[]>('/schools').then(setSchools).catch(() => undefined);
  }, [canManage]);

  // Any filter change invalidates the current page number.
  const resetTo = <T,>(setter: (v: T) => void) => (v: T) => {
    setPage(1);
    setter(v);
  };

  const doDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.del(`/students/${deleting.id}`);
      toast.success(`${deleting.fullName} deleted`);
      setDeleting(null);
      load();
    } catch (e: any) {
      toast.error(e.message);
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  };

  const archive = async (s: Student) => {
    try {
      await api.post(`/students/${s.id}/status`, { status: 'INACTIVE' });
      toast.success(`${s.fullName} archived`);
      load();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div>
      <PageHeader
        title="Pupils"
        subtitle={data ? `${data.meta.total} pupil${data.meta.total === 1 ? '' : 's'}` : undefined}
        action={
          canManage && (
            <button
              className="btn-primary"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus size={16} /> Add pupil
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
            placeholder="Search by name or admission no.…"
            value={q}
            onChange={(e) => resetTo(setQ)(e.target.value)}
          />
        </div>

        {canManage && schools.length > 0 && (
          <select className="input w-auto" value={schoolId} onChange={(e) => resetTo(setSchoolId)(e.target.value)}>
            <option value="">All schools</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code}
              </option>
            ))}
          </select>
        )}

        <select className="input w-auto" value={status} onChange={(e) => resetTo(setStatus)(e.target.value)}>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Archived</option>
          <option value="GRADUATED">Graduated</option>
          <option value="TRANSFERRED">Transferred</option>
          <option value="">Any status</option>
        </select>
      </div>

      {loading && !data ? (
        <Spinner />
      ) : !data || data.data.length === 0 ? (
        <Empty>{q ? `No pupils match “${q}”.` : 'No pupils found.'}</Empty>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left" style={{ borderColor: 'var(--border)' }}>
                  <th className="px-4 py-3">Pupil</th>
                  <th className="px-4 py-3">Class</th>
                  <th className="px-4 py-3">Sheikh</th>
                  <th className="min-w-40 px-4 py-3">Progress</th>
                  {canEditPupil && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className={loading ? 'opacity-50' : ''}>
                {data.data.map((s) => (
                  <tr key={s.id} className="border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                    <td className="px-4 py-2.5">
                      <Link href={`/students/${s.id}`} className="font-medium hover:text-emerald-600 hover:underline">
                        {s.fullName}
                      </Link>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>
                        {s.school.code} · {s.admissionNo}
                        {s.status !== 'ACTIVE' && (
                          <span className="ml-2 badge bg-slate-200 text-slate-600">{s.status.toLowerCase()}</span>
                        )}
                      </p>
                    </td>
                    <td className="px-4 py-2.5">
                      {s.schoolClass.level}
                      {s.stream && <span style={{ color: 'var(--muted)' }}> · {s.stream.name}</span>}
                    </td>
                    <td className="px-4 py-2.5">{s.primaryTeacher?.fullName ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="min-w-24 flex-1">
                          <ProgressBar percent={s.progress.percent} />
                        </div>
                        <span className="w-20 shrink-0 text-right text-xs" style={{ color: 'var(--muted)' }}>
                          {s.progress.memorized}/{s.progress.target}
                        </span>
                      </div>
                    </td>
                    {canEditPupil && (
                      <td className="px-4 py-2.5">
                        <div className="flex justify-end gap-1">
                          <button
                            className="btn-icon"
                            title="Edit"
                            onClick={() => {
                              setEditing(s);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil size={14} />
                          </button>
                          {canManage && s.status === 'ACTIVE' && (
                            <button className="btn-icon" title="Archive" onClick={() => archive(s)}>
                              <Archive size={14} />
                            </button>
                          )}
                          {canManage && (
                            <button className="btn-icon btn-icon-danger" title="Delete" onClick={() => setDeleting(s)}>
                              <Trash size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination meta={data.meta} onPage={setPage} onPageSize={resetTo(setPageSize)} />
        </div>
      )}

      {formOpen && (
        <StudentForm
          student={editing}
          canReassign={canManage}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            load();
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={doDelete}
        busy={busy}
        title={`Delete ${deleting?.fullName}?`}
        message="A pupil with any Quran history cannot be deleted — that would erase their record. Archive them instead."
      />
    </div>
  );
}
