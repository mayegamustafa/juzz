'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { PageHeader, Spinner, Empty } from '@/components/ui';
import { Plus } from '@/components/icons';

interface School {
  id: string;
  code: string;
  name: string;
  location: string | null;
  isActive: boolean;
  _count: { students: number; teachers: number; classes: number };
}

export default function SchoolsPage() {
  const { user } = useAuth();
  const canAdd = user?.role === 'SUPER_ADMIN';
  const [schools, setSchools] = useState<School[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', location: '' });
  const [error, setError] = useState('');

  const load = () => {
    api.get<School[]>('/schools').then(setSchools);
  };
  useEffect(load, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/schools', form);
      setForm({ code: '', name: '', location: '' });
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (!schools) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Schools"
        subtitle={`${schools.length} schools`}
        action={
          canAdd && (
            <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
              <Plus size={16} /> Add school
            </button>
          )
        }
      />

      {showForm && canAdd && (
        <form onSubmit={create} className="card mb-4 grid gap-3 p-4 sm:grid-cols-4">
          <input className="input" placeholder="Code (e.g. CPS)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          <input className="input sm:col-span-2" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="input" placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          {error && <p className="text-sm text-red-600 sm:col-span-4">{error}</p>}
          <button className="btn-primary sm:col-span-1">Save</button>
        </form>
      )}

      {schools.length === 0 ? (
        <Empty>No schools yet.</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {schools.map((s) => (
            <div key={s.id} className="card p-5">
              <div className="flex items-center justify-between">
                <span className="badge bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">{s.code}</span>
                {!s.isActive && <span className="badge bg-slate-200 text-slate-600">inactive</span>}
              </div>
              <h3 className="mt-2 font-semibold">{s.name}</h3>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>{s.location ?? '—'}</p>
              <div className="mt-3 flex gap-4 text-sm">
                <span><b>{s._count.students}</b> students</span>
                <span><b>{s._count.teachers}</b> teachers</span>
                <span><b>{s._count.classes}</b> classes</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
