'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth, canEdit } from '@/lib/auth';
import { PageHeader, Spinner, Empty } from '@/components/ui';
import { Check, Lock } from '@/components/icons';
import { FractionPicker } from '@/components/FractionPicker';

interface School { id: string; code: string; name: string }
interface SchoolClass { id: string; level: string; name: string }
interface Surah { id: string; number: number; nameTransliteration: string; juz: number }
interface Row {
  id: string;
  fullName: string;
  teacher: string | null;
  cells: Record<string, number>;
  progress: { memorized: number; target: number; percent: number };
}

export default function TrackingPage() {
  const { user } = useAuth();
  const editable = canEdit(user?.role);

  const [schools, setSchools] = useState<School[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classId, setClassId] = useState('');
  const [surahs, setSurahs] = useState<Surah[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [picker, setPicker] = useState<{ row: Row; surah: Surah; x: number; y: number } | null>(null);

  // load schools
  useEffect(() => {
    api.get<School[]>('/schools').then((s) => {
      setSchools(s);
      if (s.length) setSchoolId(s[0].id);
    });
  }, []);

  // load classes when school changes
  useEffect(() => {
    if (!schoolId) return;
    api.get<SchoolClass[]>(`/schools/${schoolId}/classes`).then((c) => {
      setClasses(c);
      setClassId(c.length ? c[0].id : '');
    });
  }, [schoolId]);

  // load grid when class changes
  const loadGrid = useCallback(() => {
    if (!classId) return;
    setLoading(true);
    api
      .get<{ surahs: Surah[]; students: Row[] }>(`/quran/grid?classId=${classId}`)
      .then((g) => {
        setSurahs(g.surahs);
        setRows(g.students);
      })
      .finally(() => setLoading(false));
  }, [classId]);

  useEffect(() => {
    loadGrid();
  }, [loadGrid]);

  const setFraction = async (row: Row, surah: Surah, next: number) => {
    if (!editable) return;
    const key = `${row.id}:${surah.id}`;
    setSaving(key);

    // optimistic update — a fractional memorization percent counts proportionally
    // toward the pupil's overall progress, matching how the server totals it.
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== row.id) return r;
        const cells = { ...r.cells };
        if (next <= 0) delete cells[surah.id];
        else cells[surah.id] = next;
        const memorizedFraction = Object.values(cells).reduce((a, b) => a + b, 0);
        const memorized = Object.keys(cells).length;
        return {
          ...r,
          cells,
          progress: { ...r.progress, memorized, percent: Math.round((memorizedFraction / r.progress.target) * 1000) / 10 },
        };
      }),
    );

    try {
      await api.put('/quran/memorization', { studentId: row.id, surahId: surah.id, fraction: next });
    } catch {
      loadGrid(); // revert on error
    } finally {
      setSaving(null);
    }
  };

  const openPicker = (e: React.MouseEvent, row: Row, surah: Surah) => {
    if (!editable) return;
    setPicker({ row, surah, x: e.clientX, y: e.clientY });
  };

  return (
    <div>
      <PageHeader
        title="Quran Tracking"
        subtitle="Tap a cell to mark a surah memorized (Juzu Amma + Tabaraka)"
      />

      <div className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        {schools.length > 1 && (
          <div>
            <label className="label">School</label>
            <select className="input" value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="label">Class</label>
          <select className="input" value={classId} onChange={(e) => setClassId(e.target.value)}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="ml-auto flex items-center gap-3 text-xs" style={{ color: 'var(--muted)' }}>
          {editable ? (
            <>
              <span className="flex items-center gap-1">
                <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded bg-emerald-500 text-white">
                  <Check size={10} />
                </span>
                memorized
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded bg-orange-500 text-[7px] font-bold text-white">
                  ½
                </span>
                in progress
              </span>
              <span>tap for options</span>
            </>
          ) : (
            <>
              <Lock size={13} /> read-only
            </>
          )}
          <span>· {rows.length} students</span>
        </div>
      </div>

      {loading ? (
        <Spinner label="Loading grid…" />
      ) : rows.length === 0 ? (
        <Empty>No students in this class yet.</Empty>
      ) : (
        <div className="card overflow-auto">
          <table className="border-collapse text-sm">
            <thead>
              <tr>
                <th
                  className="sticky left-0 z-10 border-b border-r px-3 py-2 text-left"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                >
                  Student
                </th>
                <th className="border-b border-r px-2 py-2 text-center" style={{ borderColor: 'var(--border)' }}>
                  %
                </th>
                {surahs.map((s) => (
                  <th
                    key={s.id}
                    className="border-b border-r px-1 py-2 text-center text-[10px] font-medium"
                    style={{ borderColor: 'var(--border)', minWidth: 34 }}
                    title={`${s.number}. ${s.nameTransliteration} (Juz ${s.juz})`}
                  >
                    {s.number}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td
                    className="sticky left-0 z-10 whitespace-nowrap border-b border-r px-3 py-1.5 font-medium"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
                  >
                    {r.fullName}
                    {r.teacher && (
                      <span className="ml-1 text-[10px]" style={{ color: 'var(--muted)' }}>
                        · {r.teacher}
                      </span>
                    )}
                  </td>
                  <td
                    className="border-b border-r px-2 py-1.5 text-center text-xs font-semibold text-emerald-700 dark:text-emerald-400"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    {r.progress.percent}
                  </td>
                  {surahs.map((s) => {
                    const v = r.cells[s.id] ?? 0;
                    const key = `${r.id}:${s.id}`;
                    const title = `${s.number}. ${s.nameTransliteration}${
                      v > 0 ? ` — ${Math.round(v * 100)}%` : ''
                    }`;
                    return (
                      <td
                        key={s.id}
                        onClick={(e) => openPicker(e, r, s)}
                        title={title}
                        className={`border-b border-r text-center align-middle ${
                          editable ? 'cursor-pointer' : ''
                        } ${
                          v >= 1
                            ? 'bg-emerald-500 text-white'
                            : v > 0
                              ? 'bg-orange-500 text-white'
                              : 'hover:bg-emerald-50 dark:hover:bg-emerald-900/30'
                        } ${saving === key ? 'opacity-50' : ''}`}
                        style={{ borderColor: 'var(--border)', height: 30 }}
                      >
                        <span className="flex items-center justify-center">
                          {v >= 1 ? (
                            <Check size={14} />
                          ) : v > 0 ? (
                            <span className="text-[9px] font-bold leading-none">{Math.round(v * 100)}</span>
                          ) : null}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {picker && (
        <FractionPicker
          x={picker.x}
          y={picker.y}
          current={picker.row.cells[picker.surah.id] ?? 0}
          onPick={(value) => setFraction(picker.row, picker.surah, value)}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  );
}
