'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth, isAdmin } from '@/lib/auth';
import { PageHeader, Spinner, Empty } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { Send } from '@/components/icons';

interface School {
  id: string;
  code: string;
  name: string;
}

interface Sent {
  id: string;
  title: string;
  body: string;
  type: string;
  createdAt: string;
}

const TYPES = [
  { value: 'ANNOUNCEMENT', label: 'Announcement' },
  { value: 'REMINDER', label: 'Reminder' },
  { value: 'INFO', label: 'Information' },
  { value: 'ACHIEVEMENT', label: 'Achievement' },
  { value: 'ALERT', label: 'Alert' },
];

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [schools, setSchools] = useState<School[]>([]);
  const [recent, setRecent] = useState<Sent[] | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState('ANNOUNCEMENT');
  const [schoolId, setSchoolId] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.get<School[]>('/schools').then(setSchools).catch(() => undefined);
    api.get<Sent[]>('/notifications?limit=20').then(setRecent).catch(() => setRecent([]));
  }, []);

  if (!isAdmin(user?.role)) {
    return <Empty>Only the secretariat can send announcements.</Empty>;
  }

  const send = async () => {
    setSending(true);
    try {
      const res = await api.post<{ created: number }>('/notifications/broadcast', {
        title: title.trim(),
        body: body.trim(),
        type,
        schoolId: schoolId || undefined,
      });
      toast.success(
        res.created === 0
          ? 'Nobody matched that audience, so nothing was sent.'
          : `Sent to ${res.created} ${res.created === 1 ? 'person' : 'people'}.`,
      );
      setTitle('');
      setBody('');
      api.get<Sent[]>('/notifications?limit=20').then(setRecent).catch(() => undefined);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSending(false);
    }
  };

  const audience = schoolId
    ? `everyone at ${schools.find((s) => s.id === schoolId)?.code ?? 'the selected school'}`
    : 'everyone in the organisation';

  const canSend = title.trim().length > 1 && body.trim().length > 1;

  return (
    <div>
      <PageHeader
        title="Announcements"
        subtitle="Send a message to Shks and Shkts. It appears in their bell on the web and pops up on their phone."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-4 font-semibold">Compose</h2>
          <div className="space-y-3">
            <div>
              <label className="label">Title</label>
              <input
                className="input"
                placeholder="e.g. Staff meeting on Friday"
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Message</label>
              <textarea
                className="input min-h-28"
                placeholder="What do they need to know?"
                maxLength={2000}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Type</label>
                <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
                  {TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Send to</label>
                <select className="input" value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
                  <option value="">All schools</option>
                  {schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} · {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              This goes to {audience}. It cannot be recalled once sent.
            </p>

            <button className="btn-primary w-full" onClick={send} disabled={sending || !canSend}>
              <Send size={16} /> {sending ? 'Sending...' : 'Send announcement'}
            </button>
          </div>
        </div>

        <div className="card p-5">
          <h2 className="mb-4 font-semibold">Recent</h2>
          {recent === null ? (
            <Spinner />
          ) : recent.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Nothing sent yet.
            </p>
          ) : (
            <div className="space-y-2">
              {recent.map((n) => (
                <div key={n.id} className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{n.title}</p>
                    <span className="whitespace-nowrap text-[11px]" style={{ color: 'var(--muted)' }}>
                      {new Date(n.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-1 text-sm" style={{ color: 'var(--muted)' }}>
                    {n.body}
                  </p>
                </div>
              ))}
            </div>
          )}
          <p className="mt-3 text-xs" style={{ color: 'var(--muted)' }}>
            This is your own notification list, so it shows announcements you sent to an audience that
            included you, alongside anything sent to you.
          </p>
        </div>
      </div>
    </div>
  );
}
