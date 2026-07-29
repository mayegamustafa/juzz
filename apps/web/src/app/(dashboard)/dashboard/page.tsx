'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { StatCard, Spinner, PageHeader, ProgressBar } from '@/components/ui';
import { Trophy } from '@/components/icons';

interface Dashboard {
  kpis: {
    studentCount: number;
    memorizationCount: number;
    schoolCount: number;
    teacherCount: number;
    avgPercent: number;
    target: number;
  };
  bySchool: { code: string; name: string; percent: number; students: number }[];
}
interface LeaderRow {
  id: string;
  fullName: string;
  school: string;
  level: string;
  memorized: number;
  percent: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<Dashboard | null>(null);
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<Dashboard>('/analytics/dashboard')
      .then(setData)
      .catch((e) => setError(e.message));
    api
      .get<LeaderRow[]>('/leaderboards?type=students')
      .then((rows) => setLeaders(rows.slice(0, 8)))
      .catch(() => undefined);
  }, []);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!data) return <Spinner />;

  const { kpis, bySchool } = data;

  return (
    <div>
      <PageHeader title={`Welcome, ${user?.fullName?.split(' ')[0] ?? ''}`} subtitle="Quran memorization overview" />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active pupils" value={kpis.studentCount} />
        <StatCard label="Surahs Memorized" value={kpis.memorizationCount} hint="total records" />
        <StatCard label="Avg. Progress" value={`${kpis.avgPercent}%`} hint={`of ${kpis.target} surahs (2 Juzu)`} />
        <StatCard label="Shks & Shkts" value={kpis.teacherCount} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {bySchool.length > 0 && (
          <div className="card p-5 lg:col-span-2">
            <h2 className="mb-4 font-semibold">Progress by school</h2>
            <div className="space-y-3">
              {bySchool.map((s) => (
                <div key={s.code} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-sm font-medium">{s.name}</span>
                  <div className="flex-1">
                    <ProgressBar percent={s.percent} />
                  </div>
                  <span className="w-24 shrink-0 text-right text-xs" style={{ color: 'var(--muted)' }}>
                    {s.percent}% · {s.students}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={`card p-5 ${bySchool.length === 0 ? 'lg:col-span-3' : ''}`}>
          <h2 className="mb-4 flex items-center gap-2 font-semibold">
            <span className="text-gold-500">
              <Trophy size={18} />
            </span>
            Top students
          </h2>
          {leaders.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              No data yet.
            </p>
          ) : (
            <ol className="space-y-2">
              {leaders.map((l, i) => (
                <li key={l.id} className="flex items-center gap-3">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      i === 0
                        ? 'bg-gold-400 text-white'
                        : i < 3
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : ''
                    }`}
                    style={i >= 3 ? { color: 'var(--muted)' } : {}}
                  >
                    {i + 1}
                  </span>
                  <Link
                    href={`/students/${l.id}`}
                    className="min-w-0 flex-1 truncate text-sm font-medium hover:text-emerald-600 hover:underline"
                  >
                    {l.fullName}
                  </Link>
                  <span className="shrink-0 text-xs" style={{ color: 'var(--muted)' }}>
                    {l.school} · {l.percent}%
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
