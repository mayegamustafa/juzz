'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { PageHeader, Spinner, ProgressBar, Empty } from '@/components/ui';
import { Search, ChevronLeft, ChevronRight } from '@/components/icons';

interface Student {
  id: string;
  fullName: string;
  admissionNo: string;
  schoolClass: { level: string };
  school: { code: string };
  primaryTeacher: { fullName: string } | null;
  progress: { memorized: number; target: number; percent: number };
}
interface Paged {
  data: Student[];
  meta: { page: number; pageSize: number; total: number };
}

export default function StudentsPage() {
  const [data, setData] = useState<Paged | null>(null);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      api
        .get<Paged>(`/students?page=${page}&pageSize=25&q=${encodeURIComponent(q)}`)
        .then(setData)
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q, page]);

  const totalPages = data ? Math.max(1, Math.ceil(data.meta.total / data.meta.pageSize)) : 1;

  return (
    <div>
      <PageHeader title="Students" subtitle={data ? `${data.meta.total} students` : undefined} />

      <div className="card mb-4 p-3">
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }}>
            <Search size={16} />
          </span>
          <input
            className="input pl-9"
            placeholder="Search students by name…"
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
          />
        </div>
      </div>

      {loading && !data ? (
        <Spinner />
      ) : !data || data.data.length === 0 ? (
        <Empty>No students found.</Empty>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left" style={{ borderColor: 'var(--border)' }}>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3">School</th>
                <th className="px-4 py-3">Sheikh</th>
                <th className="px-4 py-3 w-48">Progress</th>
              </tr>
            </thead>
            <tbody>
              {data.data.map((s) => (
                <tr
                  key={s.id}
                  className="border-b last:border-0 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <td className="px-4 py-2.5">
                    <Link href={`/students/${s.id}`} className="font-medium text-emerald-700 hover:underline dark:text-emerald-400">
                      {s.fullName}
                    </Link>
                    <div className="text-[11px]" style={{ color: 'var(--muted)' }}>
                      {s.admissionNo}
                    </div>
                  </td>
                  <td className="px-4 py-2.5">{s.schoolClass.level}</td>
                  <td className="px-4 py-2.5">{s.school.code}</td>
                  <td className="px-4 py-2.5">{s.primaryTeacher?.fullName ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <ProgressBar percent={s.progress.percent} />
                      <span className="w-10 text-right text-xs" style={{ color: 'var(--muted)' }}>
                        {s.progress.percent}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button className="btn-outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft size={16} /> Prev
          </button>
          <span className="text-sm" style={{ color: 'var(--muted)' }}>
            Page {page} / {totalPages}
          </span>
          <button className="btn-outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
