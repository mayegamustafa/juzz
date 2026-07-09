'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth, isAdmin } from '@/lib/auth';
import { PageHeader, Spinner, Empty } from '@/components/ui';
import { Plus } from '@/components/icons';

interface Teacher {
  id: string;
  fullName: string;
  phone: string | null;
  isActive: boolean;
  school: { code: string; name: string };
  _count: { primaryStudents: number };
}

export default function TeachersPage() {
  const { user } = useAuth();
  const canAdd = isAdmin(user?.role);
  const [teachers, setTeachers] = useState<Teacher[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fullName: '', phone: '' });
  const [error, setError] = useState('');

  const load = () => {
    api.get<Teacher[]>('/teachers').then(setTeachers);
  };
  useEffect(load, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/teachers', form);
      setForm({ fullName: '', phone: '' });
      setShowForm(false);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (!teachers) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Teachers (Shuyukh)"
        subtitle={`${teachers.length} teachers`}
        action={
          canAdd && (
            <button className="btn-primary" onClick={() => setShowForm((v) => !v)}>
              <Plus size={16} /> Add teacher
            </button>
          )
        }
      />

      {showForm && canAdd && (
        <form onSubmit={create} className="card mb-4 grid gap-3 p-4 sm:grid-cols-3">
          <input className="input sm:col-span-2" placeholder="Full name" value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required />
          <input className="input" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          {error && <p className="text-sm text-red-600 sm:col-span-3">{error}</p>}
          <button className="btn-primary">Save</button>
        </form>
      )}

      {teachers.length === 0 ? (
        <Empty>No teachers yet.</Empty>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left" style={{ borderColor: 'var(--border)' }}>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">School</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Students</th>
              </tr>
            </thead>
            <tbody>
              {teachers.map((t) => (
                <tr key={t.id} className="border-b last:border-0" style={{ borderColor: 'var(--border)' }}>
                  <td className="px-4 py-2.5 font-medium">{t.fullName}</td>
                  <td className="px-4 py-2.5">{t.school.code}</td>
                  <td className="px-4 py-2.5">{t.phone ?? '—'}</td>
                  <td className="px-4 py-2.5">{t._count.primaryStudents}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
