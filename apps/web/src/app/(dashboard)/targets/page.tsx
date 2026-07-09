'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PageHeader, Spinner, Empty } from '@/components/ui';

interface Term {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}
interface Target {
  id: string;
  scope: string;
  unit: string;
  amount: string;
  description: string | null;
  term: { name: string };
}

export default function TargetsPage() {
  const [terms, setTerms] = useState<Term[] | null>(null);
  const [targets, setTargets] = useState<Target[] | null>(null);

  useEffect(() => {
    api.get<Term[]>('/terms').then(setTerms);
    api.get<Target[]>('/targets').then(setTargets);
  }, []);

  if (!terms || !targets) return <Spinner />;

  return (
    <div>
      <PageHeader title="Terms & Targets" subtitle="Academic terms and memorization goals" />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-3 font-semibold">Academic terms</h2>
          {terms.length === 0 ? (
            <Empty>No terms.</Empty>
          ) : (
            <div className="space-y-2">
              {terms.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
                  <div>
                    <p className="font-medium">{t.name}</p>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>
                      {new Date(t.startDate).toLocaleDateString()} – {new Date(t.endDate).toLocaleDateString()}
                    </p>
                  </div>
                  {t.isActive && (
                    <span className="badge bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">active</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-5">
          <h2 className="mb-3 font-semibold">Targets</h2>
          {targets.length === 0 ? (
            <Empty>No targets.</Empty>
          ) : (
            <div className="space-y-2">
              {targets.map((t) => (
                <div key={t.id} className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-center gap-2">
                    <span className="badge bg-gold-200 text-gold-800">{t.scope}</span>
                    <span className="font-medium">
                      {Number(t.amount)} {t.unit}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>
                      · {t.term.name}
                    </span>
                  </div>
                  {t.description && (
                    <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
                      {t.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
