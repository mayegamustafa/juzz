'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PageHeader, Spinner, Empty } from '@/components/ui';
import { Download } from '@/components/icons';

interface General {
  schools: { id: string; code: string; name: string; enrolled: number }[];
  surahs: { id: string; number: number; nameTransliteration: string }[];
  rows: { surah: { number: number; name: string }; perSchool: Record<string, number>; total: number }[];
}

const LEVELS = ['P.1', 'P.2', 'P.3', 'P.4', 'P.5', 'P.6', 'P.7'];

export default function ReportsPage() {
  const [level, setLevel] = useState('P.1');
  const [data, setData] = useState<General | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get<General>(`/reports/general?level=${encodeURIComponent(level)}`)
      .then(setData)
      .finally(() => setLoading(false));
  }, [level]);

  const [exporting, setExporting] = useState('');
  const exportAs = async (format: 'xlsx' | 'pdf') => {
    setExporting(format);
    try {
      await api.download(`/reports/general/export?format=${format}&level=${encodeURIComponent(level)}`);
    } finally {
      setExporting('');
    }
  };

  return (
    <div>
      <PageHeader
        title="Reports: GENERAL roll-up"
        subtitle="Students per surah, per school (auto-generated, replaces the manual GENERAL tab)"
        action={
          <div className="flex gap-2">
            <button className="btn-outline" onClick={() => exportAs('xlsx')} disabled={!data || !!exporting}>
              <Download size={16} /> {exporting === 'xlsx' ? 'Exporting…' : 'Excel'}
            </button>
            <button className="btn-outline" onClick={() => exportAs('pdf')} disabled={!data || !!exporting}>
              <Download size={16} /> {exporting === 'pdf' ? 'Exporting…' : 'PDF'}
            </button>
          </div>
        }
      />

      <div className="card mb-4 flex items-end gap-3 p-4">
        <div>
          <label className="label">Class level</label>
          <select className="input" value={level} onChange={(e) => setLevel(e.target.value)}>
            {LEVELS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : !data || data.schools.length === 0 ? (
        <Empty>No data for {level}.</Empty>
      ) : (
        <div className="card overflow-auto">
          <table className="border-collapse text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 border-b border-r px-3 py-2 text-left" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                  Surah
                </th>
                {data.schools.map((s) => (
                  <th key={s.id} className="border-b border-r px-3 py-2 text-center" style={{ borderColor: 'var(--border)' }} title={s.name}>
                    {s.code}
                    <div className="text-[10px] font-normal" style={{ color: 'var(--muted)' }}>
                      enr {s.enrolled}
                    </div>
                  </th>
                ))}
                <th className="border-b px-3 py-2 text-center font-bold" style={{ borderColor: 'var(--border)' }}>
                  TOTAL
                </th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.surah.number}>
                  <td className="sticky left-0 z-10 whitespace-nowrap border-b border-r px-3 py-1.5 font-medium" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                    {r.surah.number}. {r.surah.name}
                  </td>
                  {data.schools.map((s) => (
                    <td key={s.id} className="border-b border-r px-3 py-1.5 text-center" style={{ borderColor: 'var(--border)' }}>
                      {r.perSchool[s.id] ?? 0}
                    </td>
                  ))}
                  <td className="border-b px-3 py-1.5 text-center font-bold text-emerald-700 dark:text-emerald-400" style={{ borderColor: 'var(--border)' }}>
                    {r.total}
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
