'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth, canEdit } from '@/lib/auth';
import { PageHeader, Spinner, Empty } from '@/components/ui';
import { Lock } from '@/components/icons';

interface School { id: string; code: string; name: string }
interface SchoolClass { id: string; name: string }
interface Row { id: string; fullName: string; status: string | null; recordId: string | null; canEdit: boolean }

const STATUSES = ['PRESENT', 'ABSENT', 'SICK', 'PERMISSION'] as const;
const STATUS_STYLE: Record<string, string> = {
  PRESENT: 'bg-emerald-500 text-white',
  ABSENT: 'bg-red-500 text-white',
  SICK: 'bg-gold-400 text-white',
  PERMISSION: 'bg-slate-500 text-white',
};

export default function AttendancePage() {
  const { user } = useAuth();
  const editable = canEdit(user?.role);

  const [schools, setSchools] = useState<School[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classId, setClassId] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    api.get<School[]>('/schools').then((s) => {
      setSchools(s);
      if (s.length) setSchoolId(s[0].id);
    });
  }, []);

  useEffect(() => {
    if (!schoolId) return;
    api.get<SchoolClass[]>(`/schools/${schoolId}/classes`).then((c) => {
      setClasses(c);
      setClassId(c.length ? c[0].id : '');
    });
  }, [schoolId]);

  const load = useCallback(() => {
    if (!classId || !date) return;
    setLoading(true);
    api
      .get<{ date: string; students: Row[] }>(`/attendance?classId=${classId}&date=${date}`)
      .then((d) => setRows(d.students))
      .finally(() => setLoading(false));
  }, [classId, date]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (row: Row, status: string) => {
    if (!editable || !row.canEdit) return;
    setSaving(row.id);
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status } : r)));
    try {
      await api.put('/attendance', { studentId: row.id, date, status });
    } catch {
      load();
    } finally {
      setSaving(null);
    }
  };

  const summary = STATUSES.map((s) => ({ s, n: rows.filter((r) => r.status === s).length }));

  return (
    <div>
      <PageHeader title="Attendance" subtitle="Mark daily attendance per class" />

      <div className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        {schools.length > 1 && (
          <div>
            <label className="label">School</label>
            <select className="input" value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="label">Class</label>
          <select className="input" value={classId} onChange={(e) => setClassId(e.target.value)}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Date</label>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="ml-auto flex gap-2 text-xs" style={{ color: 'var(--muted)' }}>
          {summary.map(({ s, n }) => (
            <span key={s}>{s[0]}{s.slice(1).toLowerCase()}: <b>{n}</b></span>
          ))}
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <Empty>No pupils in this class.</Empty>
      ) : (
        <div className="card divide-y" style={{ borderColor: 'var(--border)' }}>
          {rows.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3" style={{ borderColor: 'var(--border)' }}>
              <span className={`font-medium ${saving === r.id ? 'opacity-50' : ''}`}>{r.fullName}</span>
              {!r.canEdit ? (
                <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--muted)' }} title="Locked after 24h. Ask the manager to unlock it.">
                  <Lock size={12} /> {r.status ? r.status[0] + r.status.slice(1).toLowerCase() : 'N/A'} · locked
                </span>
              ) : (
                <div className="flex gap-1">
                  {STATUSES.map((s) => (
                    <button
                      key={s}
                      disabled={!editable}
                      onClick={() => setStatus(r, s)}
                      className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                        r.status === s ? STATUS_STYLE[s] : 'border'
                      }`}
                      style={r.status === s ? {} : { borderColor: 'var(--border)', color: 'var(--muted)' }}
                    >
                      {s[0]}{s.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
