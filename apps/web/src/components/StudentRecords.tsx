'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth, isAdmin } from '@/lib/auth';
import { useToast } from '@/components/Toast';
import { ConfirmDialog } from '@/components/Modal';
import { Pencil, Trash, Key, Lock } from '@/components/icons';

interface Surah { id: string; number: number; nameTransliteration: string }

const GRADES = ['EXCELLENT', 'VERY_GOOD', 'GOOD', 'FAIR', 'POOR'];
const MISTAKE_TYPES = ['TAJWEED', 'MEMORIZATION', 'PRONUNCIATION'];

type Tab = 'revision' | 'assessment' | 'mistakes' | 'attendance';
const TABS: { key: Tab; label: string }[] = [
  { key: 'revision', label: 'Revision' },
  { key: 'assessment', label: 'Assessment' },
  { key: 'mistakes', label: 'Mistakes' },
  { key: 'attendance', label: 'Attendance' },
];

export function StudentRecords({ studentId, editable }: { studentId: string; editable: boolean }) {
  const [tab, setTab] = useState<Tab>('revision');

  return (
    <div className="card mt-4 p-5">
      <div className="mb-4 flex flex-wrap gap-1 border-b" style={{ borderColor: 'var(--border)' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                : 'border-transparent'
            }`}
            style={tab === t.key ? {} : { color: 'var(--muted)' }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'revision' && <Revision studentId={studentId} editable={editable} />}
      {tab === 'assessment' && <Assessment studentId={studentId} editable={editable} />}
      {tab === 'mistakes' && <Mistakes studentId={studentId} editable={editable} />}
      {tab === 'attendance' && <Attendance studentId={studentId} editable={editable} />}
    </div>
  );
}

function useSurahs() {
  const [surahs, setSurahs] = useState<Surah[]>([]);
  useEffect(() => {
    api.get<Surah[]>('/surahs?juz=29,30').then(setSurahs);
  }, []);
  return surahs;
}

function Empty({ text }: { text: string }) {
  return (
    <p className="py-4 text-sm" style={{ color: 'var(--muted)' }}>
      {text}
    </p>
  );
}

/**
 * The action cluster shown on every recorded entry: a Sheikh may edit/delete
 * their own entry for 24h; after that the row shows a lock. The secretariat
 * can always edit/delete, and can extend the Sheikh's window with "Unlock".
 */
export function RecordActions({
  canEdit,
  canManage,
  onEdit,
  onDelete,
  onUnlock,
}: {
  canEdit: boolean;
  canManage: boolean;
  onEdit?: () => void;
  onDelete: () => void;
  onUnlock: () => void;
}) {
  if (!canEdit && !canManage) {
    return (
      <span className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--muted)' }} title="Locked after 24h. Ask the manager to unlock it.">
        <Lock size={11} /> locked
      </span>
    );
  }
  return (
    <div className="flex shrink-0 gap-1">
      {canEdit && onEdit && (
        <button className="btn-icon h-6 w-6" title="Edit" onClick={onEdit}>
          <Pencil size={11} />
        </button>
      )}
      {canEdit && (
        <button className="btn-icon btn-icon-danger h-6 w-6" title="Delete" onClick={onDelete}>
          <Trash size={11} />
        </button>
      )}
      {canManage && !canEdit && (
        <button className="btn-icon h-6 w-6" title="Unlock for the Sheikh (24h)" onClick={onUnlock}>
          <Key size={11} />
        </button>
      )}
    </div>
  );
}

// --- Revision ---
function Revision({ studentId, editable }: { studentId: string; editable: boolean }) {
  const surahs = useSurahs();
  const { user } = useAuth();
  const canManage = isAdmin(user?.role);
  const toast = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [surahId, setSurahId] = useState('');
  const [score, setScore] = useState('');
  const [editing, setEditing] = useState<any | null>(null);
  const [editScore, setEditScore] = useState('');
  const [deleting, setDeleting] = useState<any | null>(null);

  const load = () => api.get<any[]>(`/students/${studentId}/revisions`).then(setItems);
  useEffect(() => {
    load();
  }, [studentId]);

  const add = async () => {
    await api.post('/quran/revision', {
      studentId,
      surahId: surahId || undefined,
      performanceScore: score ? Number(score) : undefined,
    });
    setScore('');
    load();
  };

  const saveEdit = async () => {
    await api.patch(`/quran/revision/${editing.id}`, { performanceScore: editScore ? Number(editScore) : undefined });
    setEditing(null);
    load();
  };

  const doDelete = async () => {
    try {
      await api.del(`/quran/revision/${deleting.id}`);
      toast.success('Revision entry deleted');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeleting(null);
      load();
    }
  };

  const unlock = async (id: string) => {
    await api.post(`/quran/revision/${id}/unlock`, {});
    toast.success('Unlocked for the Sheikh for 24 hours');
    load();
  };

  return (
    <div>
      {editable && (
        <div className="mb-4 flex flex-wrap gap-2">
          <select className="input max-w-xs" value={surahId} onChange={(e) => setSurahId(e.target.value)}>
            <option value="">Surah (optional)</option>
            {surahs.map((s) => (
              <option key={s.id} value={s.id}>
                {s.number}. {s.nameTransliteration}
              </option>
            ))}
          </select>
          <input className="input w-32" type="number" min={0} max={100} placeholder="Score /100" value={score} onChange={(e) => setScore(e.target.value)} />
          <button className="btn-primary" onClick={add}>
            Record revision
          </button>
        </div>
      )}
      {items.length === 0 ? (
        <Empty text="No revision records yet." />
      ) : (
        <ul className="space-y-2">
          {items.map((r) => (
            <li key={r.id} className="rounded-lg border p-3 text-sm" style={{ borderColor: 'var(--border)' }}>
              {editing?.id === r.id ? (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    className="input w-28"
                    type="number"
                    min={0}
                    max={100}
                    value={editScore}
                    onChange={(e) => setEditScore(e.target.value)}
                  />
                  <button className="btn-primary h-8 px-3 text-xs" onClick={saveEdit}>
                    Save
                  </button>
                  <button className="btn-outline h-8 px-3 text-xs" onClick={() => setEditing(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span>{r.surah ? `${r.surah.number}. ${r.surah.nameTransliteration}` : r.juz ? `Juz ${r.juz}` : 'General revision'}</span>
                  <div className="flex items-center gap-3">
                    <span style={{ color: 'var(--muted)' }}>
                      {r.performanceScore != null ? `${r.performanceScore}/100 · ` : ''}
                      {new Date(r.revisedAt).toLocaleDateString()}
                    </span>
                    <RecordActions
                      canEdit={r.canEdit}
                      canManage={canManage}
                      onEdit={() => {
                        setEditing(r);
                        setEditScore(r.performanceScore != null ? String(r.performanceScore) : '');
                      }}
                      onDelete={() => setDeleting(r)}
                      onUnlock={() => unlock(r.id)}
                    />
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={doDelete}
        title="Delete this revision entry?"
        message="This cannot be undone."
      />
    </div>
  );
}

// --- Assessment ---
function Assessment({ studentId, editable }: { studentId: string; editable: boolean }) {
  const { user } = useAuth();
  const canManage = isAdmin(user?.role);
  const toast = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [grade, setGrade] = useState('EXCELLENT');
  const [score, setScore] = useState('');
  const [editing, setEditing] = useState<any | null>(null);
  const [editGrade, setEditGrade] = useState('EXCELLENT');
  const [editScore, setEditScore] = useState('');
  const [deleting, setDeleting] = useState<any | null>(null);

  const load = () => api.get<any[]>(`/students/${studentId}/assessments`).then(setItems);
  useEffect(() => {
    load();
  }, [studentId]);

  const add = async () => {
    await api.post('/quran/assessment', { studentId, grade, score: score ? Number(score) : undefined });
    setScore('');
    load();
  };

  const saveEdit = async () => {
    await api.patch(`/quran/assessment/${editing.id}`, {
      grade: editGrade,
      score: editScore ? Number(editScore) : undefined,
    });
    setEditing(null);
    load();
  };

  const doDelete = async () => {
    try {
      await api.del(`/quran/assessment/${deleting.id}`);
      toast.success('Assessment deleted');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeleting(null);
      load();
    }
  };

  const unlock = async (id: string) => {
    await api.post(`/quran/assessment/${id}/unlock`, {});
    toast.success('Unlocked for the Sheikh for 24 hours');
    load();
  };

  return (
    <div>
      {editable && (
        <div className="mb-4 flex flex-wrap gap-2">
          <select className="input w-44" value={grade} onChange={(e) => setGrade(e.target.value)}>
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {g.replace('_', ' ')}
              </option>
            ))}
          </select>
          <input className="input w-32" type="number" min={0} max={100} placeholder="Score /100" value={score} onChange={(e) => setScore(e.target.value)} />
          <button className="btn-primary" onClick={add}>
            Record assessment
          </button>
        </div>
      )}
      {items.length === 0 ? (
        <Empty text="No assessments yet." />
      ) : (
        <ul className="space-y-2">
          {items.map((a) => (
            <li key={a.id} className="rounded-lg border p-3 text-sm" style={{ borderColor: 'var(--border)' }}>
              {editing?.id === a.id ? (
                <div className="flex flex-wrap items-center gap-2">
                  <select className="input w-40" value={editGrade} onChange={(e) => setEditGrade(e.target.value)}>
                    {GRADES.map((g) => (
                      <option key={g} value={g}>
                        {g.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                  <input
                    className="input w-24"
                    type="number"
                    min={0}
                    max={100}
                    value={editScore}
                    onChange={(e) => setEditScore(e.target.value)}
                  />
                  <button className="btn-primary h-8 px-3 text-xs" onClick={saveEdit}>
                    Save
                  </button>
                  <button className="btn-outline h-8 px-3 text-xs" onClick={() => setEditing(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{a.grade ? a.grade.replace('_', ' ') : 'N/A'}</span>
                  <div className="flex items-center gap-3">
                    <span style={{ color: 'var(--muted)' }}>
                      {a.score != null ? `${a.score}/100 · ` : ''}
                      {new Date(a.assessedAt).toLocaleDateString()}
                    </span>
                    <RecordActions
                      canEdit={a.canEdit}
                      canManage={canManage}
                      onEdit={() => {
                        setEditing(a);
                        setEditGrade(a.grade ?? 'EXCELLENT');
                        setEditScore(a.score != null ? String(a.score) : '');
                      }}
                      onDelete={() => setDeleting(a)}
                      onUnlock={() => unlock(a.id)}
                    />
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={doDelete}
        title="Delete this assessment?"
        message="This cannot be undone."
      />
    </div>
  );
}

// --- Mistakes ---
function Mistakes({ studentId, editable }: { studentId: string; editable: boolean }) {
  const surahs = useSurahs();
  const { user } = useAuth();
  const canManage = isAdmin(user?.role);
  const toast = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [type, setType] = useState('TAJWEED');
  const [count, setCount] = useState('1');
  const [surahId, setSurahId] = useState('');
  const [editing, setEditing] = useState<any | null>(null);
  const [editType, setEditType] = useState('TAJWEED');
  const [editCount, setEditCount] = useState('1');
  const [deleting, setDeleting] = useState<any | null>(null);

  const load = () => api.get<any[]>(`/students/${studentId}/mistakes`).then(setItems);
  useEffect(() => {
    load();
  }, [studentId]);

  const add = async () => {
    await api.post('/quran/mistakes', { studentId, type, count: Number(count) || 1, surahId: surahId || undefined });
    load();
  };

  const saveEdit = async () => {
    await api.patch(`/quran/mistakes/${editing.id}`, { type: editType, count: Number(editCount) || 1 });
    setEditing(null);
    load();
  };

  const doDelete = async () => {
    try {
      await api.del(`/quran/mistakes/${deleting.id}`);
      toast.success('Mistake entry deleted');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeleting(null);
      load();
    }
  };

  const unlock = async (id: string) => {
    await api.post(`/quran/mistakes/${id}/unlock`, {});
    toast.success('Unlocked for the Sheikh for 24 hours');
    load();
  };

  return (
    <div>
      {editable && (
        <div className="mb-4 flex flex-wrap gap-2">
          <select className="input w-44" value={type} onChange={(e) => setType(e.target.value)}>
            {MISTAKE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input className="input w-24" type="number" min={1} placeholder="Count" value={count} onChange={(e) => setCount(e.target.value)} />
          <select className="input max-w-xs" value={surahId} onChange={(e) => setSurahId(e.target.value)}>
            <option value="">Surah (optional)</option>
            {surahs.map((s) => (
              <option key={s.id} value={s.id}>
                {s.number}. {s.nameTransliteration}
              </option>
            ))}
          </select>
          <button className="btn-primary" onClick={add}>
            Record mistake
          </button>
        </div>
      )}
      {items.length === 0 ? (
        <Empty text="No mistakes recorded." />
      ) : (
        <ul className="space-y-2">
          {items.map((m) => (
            <li key={m.id} className="rounded-lg border p-3 text-sm" style={{ borderColor: 'var(--border)' }}>
              {editing?.id === m.id ? (
                <div className="flex flex-wrap items-center gap-2">
                  <select className="input w-40" value={editType} onChange={(e) => setEditType(e.target.value)}>
                    {MISTAKE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <input
                    className="input w-20"
                    type="number"
                    min={1}
                    value={editCount}
                    onChange={(e) => setEditCount(e.target.value)}
                  />
                  <button className="btn-primary h-8 px-3 text-xs" onClick={saveEdit}>
                    Save
                  </button>
                  <button className="btn-outline h-8 px-3 text-xs" onClick={() => setEditing(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span>
                    <span className="badge bg-red-100 text-red-700">{m.type}</span> ×{m.count}
                    {m.surah ? ` · ${m.surah.number}. ${m.surah.nameTransliteration}` : ''}
                  </span>
                  <div className="flex items-center gap-3">
                    <span style={{ color: 'var(--muted)' }}>{new Date(m.occurredAt).toLocaleDateString()}</span>
                    <RecordActions
                      canEdit={m.canEdit}
                      canManage={canManage}
                      onEdit={() => {
                        setEditing(m);
                        setEditType(m.type);
                        setEditCount(String(m.count));
                      }}
                      onDelete={() => setDeleting(m)}
                      onUnlock={() => unlock(m.id)}
                    />
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={doDelete}
        title="Delete this mistake entry?"
        message="This cannot be undone."
      />
    </div>
  );
}

// --- Attendance history (bulk day-entry lives on the Attendance screen) ---
function Attendance({ studentId }: { studentId: string; editable: boolean }) {
  const { user } = useAuth();
  const canManage = isAdmin(user?.role);
  const toast = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [deleting, setDeleting] = useState<any | null>(null);

  const load = () => api.get<any[]>(`/attendance/student/${studentId}`).then(setItems);
  useEffect(() => {
    load();
  }, [studentId]);

  const doDelete = async () => {
    try {
      await api.del(`/attendance/${deleting.id}`);
      toast.success('Attendance entry deleted');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeleting(null);
      load();
    }
  };

  const unlock = async (id: string) => {
    await api.post(`/attendance/${id}/unlock`, {});
    toast.success('Unlocked for the Sheikh for 24 hours');
    load();
  };

  const color: Record<string, string> = {
    PRESENT: 'bg-emerald-100 text-emerald-700',
    ABSENT: 'bg-red-100 text-red-700',
    SICK: 'bg-gold-200 text-gold-800',
    PERMISSION: 'bg-slate-200 text-slate-700',
  };

  return items.length === 0 ? (
    <Empty text="No attendance records yet. Use the Attendance screen to record a class day." />
  ) : (
    <div>
      <ul className="space-y-2">
        {items.map((a) => (
          <li key={a.id} className="flex items-center justify-between rounded-lg border p-3 text-sm" style={{ borderColor: 'var(--border)' }}>
            <span>{new Date(a.date).toLocaleDateString()}</span>
            <div className="flex items-center gap-3">
              <span className={`badge ${color[a.status] ?? ''}`}>{a.status}</span>
              <RecordActions
                canEdit={a.canEdit}
                canManage={canManage}
                onDelete={() => setDeleting(a)}
                onUnlock={() => unlock(a.id)}
              />
            </div>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={doDelete}
        title="Delete this attendance entry?"
        message="This cannot be undone."
      />
    </div>
  );
}
