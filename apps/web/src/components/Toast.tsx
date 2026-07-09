'use client';

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { Close } from '@/components/icons';

type Kind = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  kind: Kind;
  message: string;
}

const Ctx = createContext<{
  toast: (message: string, kind?: Kind) => void;
  success: (m: string) => void;
  error: (m: string) => void;
}>({ toast: () => {}, success: () => {}, error: () => {} });

export const useToast = () => useContext(Ctx);

let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const toast = useCallback((message: string, kind: Kind = 'info') => {
    const id = ++seq;
    setItems((prev) => [...prev, { id, kind, message }]);
  }, []);

  const success = useCallback((m: string) => toast(m, 'success'), [toast]);
  const error = useCallback((m: string) => toast(m, 'error'), [toast]);

  return (
    <Ctx.Provider value={{ toast, success, error }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2">
        {items.map((t) => (
          <ToastItem key={t.id} toast={t} onDone={() => setItems((p) => p.filter((x) => x.id !== t.id))} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

const STYLES: Record<Kind, string> = {
  success: 'border-emerald-500/40 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100',
  error: 'border-red-500/40 bg-red-50 text-red-900 dark:bg-red-950 dark:text-red-100',
  info: 'border-slate-400/40 bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100',
};

function ToastItem({ toast, onDone }: { toast: Toast; onDone: () => void }) {
  // Errors linger — they usually carry a message the user must act on.
  const ttl = toast.kind === 'error' ? 6000 : 3000;

  useEffect(() => {
    const t = setTimeout(onDone, ttl);
    return () => clearTimeout(t);
  }, [onDone, ttl]);

  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-start gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg ${STYLES[toast.kind]}`}
    >
      <span className="flex-1">{toast.message}</span>
      <button onClick={onDone} className="mt-0.5 opacity-50 hover:opacity-100" aria-label="Dismiss">
        <Close size={14} />
      </button>
    </div>
  );
}
