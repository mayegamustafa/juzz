'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { isAdmin, useAuth } from '@/lib/auth';
import { PageHeader, Spinner, Empty, StatCard, ProgressBar } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { Trophy } from '@/components/icons';

interface Group {
  id: string;
  code: string;
  name: string;
  students: number;
  avgPercent: number;
  completed: number;
  atRisk: number;
  avgScore: number | null;
  mistakes: number;
}
interface AtRisk {
  id: string;
  fullName: string;
  admissionNo: string;
  school: string;
  level: string;
  sheikh: string | null;
  memorized: number;
  percent: number;
  mistakes: number;
}
interface Overview {
  target: number;
  atRiskThreshold: number;
  kpis: {
    students: number;
    avgPercent: number;
    completed: number;
    atRisk: number;
    avgScore: number | null;
    totalRevisions: number;
    totalMistakes: number;
  };
  distribution: { band: string; count: number }[];
  bySchool: Group[];
  byLevel: Group[];
  bySheikh: Group[];
  atRisk: AtRisk[];
  surahCoverage: { number: number; name: string; count: number; percent: number }[];
}
interface School {
  id: string;
  code: string;
  name: string;
}

const LEVELS = ['P.1', 'P.2', 'P.3', 'P.4', 'P.5', 'P.6', 'P.7'];

export default function AnalyticsPage() {
  const { user } = useAuth();
  const canFilterSchool = isAdmin(user?.role);
  const toast = useToast();

  const [data, setData] = useState<Overview | null>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolId, setSchoolId] = useState('');
  const [level, setLevel] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams();
    if (schoolId) p.set('schoolId', schoolId);
    if (level) p.set('level', level);
    api
      .get<Overview>(`/analytics/overview${p.toString() ? `?${p}` : ''}`)
      .then(setData)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [schoolId, level, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (canFilterSchool) api.get<School[]>('/schools').then(setSchools).catch(() => undefined);
  }, [canFilterSchool]);

  if (!data && loading) return <Spinner />;
  if (!data) return <Empty>No analytics available.</Empty>;

  const { kpis } = data;

  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle={`Juzu memorization performance · target ${data.target} surahs (2 Juzu)`}
      />

      <div className="card mb-4 flex flex-wrap items-center gap-3 p-3">
        {canFilterSchool && schools.length > 0 && (
          <select className="input w-auto" value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
            <option value="">All schools</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} · {s.name}
              </option>
            ))}
          </select>
        )}
        <select className="input w-auto" value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="">All classes</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        {loading && <span className="text-xs" style={{ color: 'var(--muted)' }}>Updating…</span>}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Pupils" value={kpis.students} />
        <StatCard label="Avg. progress" value={`${kpis.avgPercent}%`} hint={`of ${data.target} surahs`} />
        <StatCard label="Completed" value={kpis.completed} hint="reached the full target" />
        <StatCard
          label="Needs attention"
          value={kpis.atRisk}
          hint={`below ${data.atRiskThreshold}%`}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Distribution */}
        <div className="card p-5">
          <h2 className="mb-4 font-semibold">Progress distribution</h2>
          {kpis.students === 0 ? (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>No pupils.</p>
          ) : (
            <div className="space-y-2.5">
              {data.distribution.map((b) => {
                const share = kpis.students ? (b.count / kpis.students) * 100 : 0;
                return (
                  <div key={b.band} className="flex items-center gap-3">
                    <span className="w-16 shrink-0 text-xs" style={{ color: 'var(--muted)' }}>
                      {b.band}
                    </span>
                    <div className="h-5 flex-1 overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded bg-emerald-500 transition-all"
                        style={{ width: `${share}%` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right text-xs font-medium">{b.count}</span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-4 flex justify-between border-t pt-3 text-xs" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
            <span>Avg. assessment: <b>{kpis.avgScore ?? 'N/A'}</b></span>
            <span>Revisions: <b>{kpis.totalRevisions}</b></span>
            <span>Mistakes: <b>{kpis.totalMistakes}</b></span>
          </div>
        </div>

        {/* Schools */}
        <GroupTable
          title="By school"
          rows={data.bySchool}
          emptyText="No schools."
          labelHeader="School"
          renderLabel={(g) => g.code}
        />

        {/* Sheikhs */}
        <GroupTable
          title="By Shk / Shkt"
          rows={data.bySheikh}
          emptyText="No Shks or Shkts assigned."
          labelHeader="Shk / Shkt"
          renderLabel={(g) => g.name}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Weakest surahs */}
        <div className="card p-5">
          <h2 className="mb-1 font-semibold">Surahs needing the most work</h2>
          <p className="mb-4 text-xs" style={{ color: 'var(--muted)' }}>
            Fewest pupils have memorized these.
          </p>
          {data.surahCoverage.length === 0 ? (
            <Empty>No data.</Empty>
          ) : (
            <div className="space-y-2">
              {data.surahCoverage.slice(0, 8).map((s) => (
                <div key={s.number} className="flex items-center gap-3">
                  <span className="w-40 shrink-0 truncate text-sm">
                    {s.number}. {s.name}
                  </span>
                  <div className="flex-1">
                    <ProgressBar percent={s.percent} />
                  </div>
                  <span className="w-16 shrink-0 text-right text-xs" style={{ color: 'var(--muted)' }}>
                    {s.count} / {kpis.students}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* By class level */}
        <GroupTable
          title="By class"
          rows={data.byLevel}
          emptyText="No classes."
          labelHeader="Class"
          renderLabel={(g) => g.code}
        />
      </div>

      {/* At-risk pupils */}
      <div className="card mt-4 overflow-hidden">
        <div className="flex items-center justify-between p-5 pb-3">
          <div>
            <h2 className="font-semibold">Pupils needing attention</h2>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              Below {data.atRiskThreshold}% of the term target
            </p>
          </div>
          <span className="badge bg-gold-200 text-gold-800">{data.atRisk.length}</span>
        </div>

        {data.atRisk.length === 0 ? (
          <div className="flex items-center gap-2 border-t p-5 text-sm" style={{ borderColor: 'var(--border)' }}>
            <span className="text-emerald-600">
              <Trophy size={18} />
            </span>
            Every pupil is on track.
          </div>
        ) : (
          <div className="overflow-x-auto border-t" style={{ borderColor: 'var(--border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left" style={{ borderColor: 'var(--border)' }}>
                  <th className="px-4 py-2.5">Pupil</th>
                  <th className="px-4 py-2.5">Class</th>
                  <th className="px-4 py-2.5">Shk / Shkt</th>
                  <th className="min-w-32 px-4 py-2.5">Progress</th>
                  <th className="px-4 py-2.5 text-center">Mistakes</th>
                </tr>
              </thead>
              <tbody>
                {data.atRisk.map((s) => (
                  <tr key={s.id} className="border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                    <td className="px-4 py-2">
                      <Link href={`/students/${s.id}`} className="font-medium hover:text-emerald-600 hover:underline">
                        {s.fullName}
                      </Link>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>
                        {s.school} · {s.admissionNo}
                      </p>
                    </td>
                    <td className="px-4 py-2">{s.level}</td>
                    <td className="px-4 py-2">{s.sheikh ?? 'N/A'}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="min-w-16 flex-1">
                          <ProgressBar percent={s.percent} />
                        </div>
                        <span className="w-10 shrink-0 text-right text-xs" style={{ color: 'var(--muted)' }}>
                          {s.percent}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-center">{s.mistakes || 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function GroupTable({
  title,
  rows,
  emptyText,
  labelHeader,
  renderLabel,
}: {
  title: string;
  rows: Group[];
  emptyText: string;
  labelHeader: string;
  renderLabel: (g: Group) => string;
}) {
  return (
    <div className="card p-5">
      <h2 className="mb-4 font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          {emptyText}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left" style={{ borderColor: 'var(--border)' }}>
                <th className="pb-2 pr-2 font-medium">{labelHeader}</th>
                <th className="pb-2 pr-2 text-center font-medium">Pupils</th>
                <th className="pb-2 font-medium">Avg.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((g) => (
                <tr key={g.id}>
                  <td className="py-2 pr-2">
                    <span className="font-medium">{renderLabel(g)}</span>
                    {g.atRisk > 0 && (
                      <span className="ml-2 text-[10px]" style={{ color: 'var(--muted)' }}>
                        {g.atRisk} at risk
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-2 text-center">{g.students}</td>
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <div className="min-w-12 flex-1">
                        <ProgressBar percent={g.avgPercent} />
                      </div>
                      <span className="w-10 shrink-0 text-right text-xs font-medium">{g.avgPercent}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
