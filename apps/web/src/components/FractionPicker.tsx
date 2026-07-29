'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Check } from '@/components/icons';

const PRESETS = [
  { value: 0, label: 'Not started' },
  { value: 0.25, label: '¼ — just begun' },
  { value: 0.5, label: '½ — halfway' },
  { value: 0.75, label: '¾ — nearly done' },
  { value: 1, label: 'Memorized' },
] as const;

/**
 * A small popover of quick progress presets, anchored to wherever the user
 * clicked. Used on the tracking grid so a Sheikh can record partial progress
 * (not just done/not-done) in one tap.
 */
export function FractionPicker({
  x,
  y,
  current,
  onPick,
  onClose,
}: {
  x: number;
  y: number;
  current: number;
  onPick: (value: number) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    // Defer so the triggering click doesn't immediately close the popover.
    const t = setTimeout(() => {
      document.addEventListener('mousedown', onDocClick);
      document.addEventListener('keydown', onKey);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  // Keep it on-screen near the click point.
  const left = Math.min(x, window.innerWidth - 200);
  const top = Math.min(y + 8, window.innerHeight - 220);

  return createPortal(
    <div
      ref={ref}
      role="menu"
      className="fixed z-50 w-48 overflow-hidden rounded-lg border shadow-xl"
      style={{ left, top, background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {PRESETS.map((p) => {
        const active = Math.abs(current - p.value) < 0.01;
        return (
          <button
            key={p.value}
            role="menuitem"
            onClick={() => {
              onPick(p.value);
              onClose();
            }}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
          >
            <span className="flex items-center gap-2">
              <span
                className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded"
                style={{
                  background: p.value === 0 ? 'transparent' : p.value >= 1 ? '#059669' : '#f97316',
                  border: p.value === 0 ? '1px solid var(--border)' : 'none',
                }}
              >
                {p.value >= 1 && <Check size={11} className="text-white" />}
                {p.value > 0 && p.value < 1 && <span className="text-[8px] font-bold text-white">{p.value * 100}</span>}
              </span>
              {p.label}
            </span>
            {active && <Check size={13} className="text-emerald-600" />}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}
