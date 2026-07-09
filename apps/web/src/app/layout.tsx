import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import { ThemeProvider } from '@/lib/theme';
import { ToastProvider } from '@/components/Toast';

export const metadata: Metadata = {
  title: 'SAK/CPS Juzz Tracking System',
  description:
    "Quran memorization and Juzu progress tracking across Sir Apollo Kaggwa Schools and City Parents' School",
  icons: { icon: '/brand/sak.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>{children}</AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
