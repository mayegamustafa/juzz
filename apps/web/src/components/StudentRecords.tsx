'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Surah { id: string; number: number; nameTransliteration: string }

const GRADES = ['EXCELLENT', 'VERY_GOOD', 'GOOD', 'FAIR', 'POOR'];
const MISTAKE_TYPES = ['TAJWEED', 'MEMORIZATION', 'PRONUNCIATION'];
const ATT_STATUS = ['PRESENT', 'ABSENT', 'SICK', 'PERMISSION'];

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

// --- Revision ---
function Revision({ studentId, editable }: { studentId: string; editable: boolean }) {
  const surahs = useSurahs();
  const [items, setItems] = useState<any[]>([]);
  const [surahId, setSurahId] = useState('');
  const [score, setScore] = useState('');

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
            <li key={r.id} className="flex justify-between rounded-lg border p-3 text-sm" style={{ borderColor: 'var(--border)' }}>
              <span>{r.surah ? `${r.surah.number}. ${r.surah.nameTransliteration}` : r.juz ? `Juz ${r.juz}` : 'General revision'}</span>
              <span style={{ color: 'var(--muted)' }}>
                {r.performanceScore != null ? `${r.performanceScore}/100 · ` : ''}
                {new Date(r.revisedAt).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// --- Assessment ---
function Assessment({ studentId, editable }: { studentId: string; editable: boolean }) {
  const [items, setItems] = useState<any[]>([]);
  const [grade, setGrade] = useState('EXCELLENT');
  const [score, setScore] = useState('');

  const load = () => api.get<any[]>(`/students/${studentId}/assessments`).then(setItems);
  useEffect(() => {
    load();
  }, [studentId]);

  const add = async () => {
    await api.post('/quran/assessment', { studentId, grade, score: score ? Number(score) : undefined });
    setScore('');
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
            <li key={a.id} className="flex justify-between rounded-lg border p-3 text-sm" style={{ borderColor: 'var(--border)' }}>
              <span className="font-medium">{a.grade ? a.grade.replace('_', ' ') : '—'}</span>
              <span style={{ color: 'var(--muted)' }}>
                {a.score != null ? `${a.score}/100 · ` : ''}
                {new Date(a.assessedAt).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// --- Mistakes ---
function Mistakes({ studentId, editable }: { studentId: string; editable: boolean }) {
  const surahs = useSurahs();
  const [items, setItems] = useState<any[]>([]);
  const [type, setType] = useState('TAJWEED');
  const [count, setCount] = useState('1');
  const [surahId, setSurahId] = useState('');

  const load = () => api.get<any[]>(`/students/${studentId}/mistakes`).then(setItems);
  useEffect(() => {
    load();
  }, [studentId]);

  const add = async () => {
    await api.post('/quran/mistakes', { studentId, type, count: Number(count) || 1, surahId: surahId || undefined });
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
            <li key={m.id} className="flex justify-between rounded-lg border p-3 text-sm" style={{ borderColor: 'var(--border)' }}>
              <span>
                <span className="badge bg-red-100 text-red-700">{m.type}</span>{' '}
                ×{m.count}
                {m.surah ? ` · ${m.surah.number}. ${m.surah.nameTransliteration}` : ''}
              </span>
              <span style={{ color: 'var(--muted)' }}>{new Date(m.occurredAt).toLocaleDateString()}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// --- Attendance (read-only history here; bulk entry on the Attendance screen) ---
function Attendance({ studentId }: { studentId: string; editable: boolean }) {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    api.get<any[]>(`/attendance/student/${studentId}`).then(setItems);
  }, [studentId]);

  const color: Record<string, string> = {
    PRESENT: 'bg-emerald-100 text-emerald-700',
    ABSENT: 'bg-red-100 text-red-700',
    SICK: 'bg-gold-200 text-gold-800',
    PERMISSION: 'bg-slate-200 text-slate-700',
  };

  return items.length === 0 ? (
    <Empty text="No attendance records yet. Use the Attendance screen to record a class day." />
  ) : (
    <ul className="space-y-2">
      {items.map((a) => (
        <li key={a.id} className="flex justify-between rounded-lg border p-3 text-sm" style={{ borderColor: 'var(--border)' }}>
          <span>{new Date(a.date).toLocaleDateString()}</span>
          <span className={`badge ${color[a.status] ?? ''}`}>{a.status}</span>
        </li>
      ))}
    </ul>
  );
}
