'use client';

import { ComponentType, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth, ROLE_LABELS } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { NotificationsBell } from '@/components/NotificationsBell';
import {
  Dashboard,
  Tracking,
  Calendar,
  Students,
  Teachers,
  SchoolIcon,
  Reports,
  Target,
  Menu,
  Sun,
  Moon,
  LogOut,
  LogoMark,
} from '@/components/icons';

type IconType = ComponentType<{ size?: number; className?: string }>;

interface NavItem {
  href: string;
  label: string;
  icon: IconType;
  roles?: string[];
}

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: Dashboard },
  { href: '/tracking', label: 'Tracking', icon: Tracking },
  { href: '/attendance', label: 'Attendance', icon: Calendar },
  { href: '/students', label: 'Students', icon: Students },
  { href: '/teachers', label: 'Teachers', icon: Teachers, roles: ['SUPER_ADMIN', 'SUPERVISOR'] },
  { href: '/schools', label: 'Schools', icon: SchoolIcon, roles: ['SUPER_ADMIN', 'SUPERVISOR'] },
  { href: '/reports', label: 'Reports', icon: Reports },
  { href: '/targets', label: 'Targets', icon: Target, roles: ['SUPER_ADMIN', 'SUPERVISOR'] },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-emerald-600">Loading…</div>;
  }

  const items = NAV.filter((n) => !n.roles || n.roles.includes(user.role));

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 transform border-r transition-transform md:static md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="flex h-16 items-center gap-2.5 border-b px-5" style={{ borderColor: 'var(--border)' }}>
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <LogoMark size={22} />
          </span>
          <div>
            <p className="font-bold leading-tight text-emerald-700 dark:text-emerald-400">QPMS</p>
            <p className="text-[10px]" style={{ color: 'var(--muted)' }}>
              Quran Tracking
            </p>
          </div>
        </div>
        <nav className="space-y-1 p-3">
          {items.map((n) => {
            const active = pathname === n.href || pathname.startsWith(n.href + '/');
            const Icon = n.icon;
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'hover:bg-emerald-50 dark:hover:bg-emerald-900/30'
                }`}
              >
                <Icon size={18} />
                {n.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {open && <div className="fixed inset-0 z-20 bg-black/40 md:hidden" onClick={() => setOpen(false)} />}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="sticky top-0 z-10 flex h-16 items-center justify-between gap-3 border-b px-4"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <button className="btn-ghost px-2 md:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu size={20} />
          </button>
          <div className="flex-1" />
          <NotificationsBell />
          <button className="btn-ghost px-2" onClick={toggle} title="Toggle theme" aria-label="Toggle theme">
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <div className="text-right">
            <p className="text-sm font-medium leading-tight">{user.fullName}</p>
            <p className="text-[11px]" style={{ color: 'var(--muted)' }}>
              {ROLE_LABELS[user.role]}
              {user.schoolName ? ` · ${user.schoolName}` : ''}
            </p>
          </div>
          <button className="btn-outline" onClick={logout}>
            <LogOut size={16} />
            Logout
          </button>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
