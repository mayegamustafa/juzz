'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Bell } from '@/components/icons';

const canBroadcast = (role?: string) => role === 'SUPER_ADMIN' || role === 'SUPERVISOR';

interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  readAt: string | null;
  createdAt: string;
}

const TYPE_STYLE: Record<string, string> = {
  ANNOUNCEMENT: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  ACHIEVEMENT: 'bg-gold-100 text-gold-800',
  REMINDER: 'bg-sky-100 text-sky-700',
  ALERT: 'bg-red-100 text-red-700',
  INFO: 'bg-slate-100 text-slate-600',
};

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 7 ? `${d}d ago` : new Date(iso).toLocaleDateString();
}

export function NotificationsBell() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<Notification[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(() => {
    api.get<{ count: number }>('/notifications/unread-count').then((d) => setCount(d.count)).catch(() => undefined);
  }, []);

  // poll unread count every 30s so updates elsewhere show up
  useEffect(() => {
    refreshCount();
    const t = setInterval(refreshCount, 30_000);
    return () => clearInterval(t);
  }, [refreshCount]);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const openPanel = async () => {
    setOpen((v) => !v);
    if (!open) {
      const list = await api.get<Notification[]>('/notifications?limit=20');
      setItems(list);
    }
  };

  const markAll = async () => {
    await api.post('/notifications/read-all', {});
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    setCount(0);
  };

  const markOne = async (n: Notification) => {
    if (n.readAt) return;
    await api.post(`/notifications/${n.id}/read`, {});
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
    setCount((c) => Math.max(0, c - 1));
  };


  return (
    <div className="relative" ref={ref}>
      <button className="btn-ghost relative px-2" onClick={openPanel} aria-label="Notifications">
        <Bell size={18} />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 z-40 mt-2 w-96 max-w-[90vw] overflow-hidden rounded-xl border shadow-lg"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderColor: 'var(--border)' }}>
            <span className="text-sm font-semibold">Notifications</span>
            <div className="flex gap-2">
              {/* Composing lives on its own page rather than in here: buried in a
                  dropdown behind an unlabelled bell, nobody found it. */}
              {canBroadcast(user?.role) && (
                <Link
                  href="/announcements"
                  className="text-xs font-medium text-emerald-600 hover:underline"
                  onClick={() => setOpen(false)}
                >
                  Send announcement
                </Link>
              )}
              {count > 0 && (
                <button className="text-xs hover:underline" style={{ color: 'var(--muted)' }} onClick={markAll}>
                  Mark all read
                </button>
              )}
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="p-6 text-center text-sm" style={{ color: 'var(--muted)' }}>
                No notifications yet.
              </p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => markOne(n)}
                  className={`block w-full border-b px-4 py-3 text-left transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-900/20 ${
                    n.readAt ? 'opacity-60' : ''
                  }`}
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="mb-0.5 flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{n.title}</span>
                    {!n.readAt && <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />}
                  </div>
                  <p className="line-clamp-2 text-xs" style={{ color: 'var(--muted)' }}>
                    {n.body}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${TYPE_STYLE[n.type] ?? TYPE_STYLE.INFO}`}>
                      {n.type}
                    </span>
                    <span className="text-[10px]" style={{ color: 'var(--muted)' }}>
                      {timeAgo(n.createdAt)}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
