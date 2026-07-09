'use client';

import { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * A focus-trapping-lite dialog. Closes on Escape and on backdrop click, and
 * locks body scroll while open.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative w-full ${width} max-h-[90vh] overflow-hidden rounded-xl border shadow-2xl`}
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <div className="border-b px-5 py-4" style={{ borderColor: 'var(--border)' }}>
          <h2 className="text-base font-semibold">{title}</h2>
          {description && (
            <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
              {description}
            </p>
          )}
        </div>

        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <div
            className="flex justify-end gap-2 border-t px-5 py-3"
            style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Destructive-action confirmation. `busy` disables while the request is in flight. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Delete',
  busy = false,
  danger = true,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  busy?: boolean;
  danger?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      width="max-w-md"
      footer={
        <>
          <button className="btn-outline" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className={danger ? 'btn-danger' : 'btn-primary'}
            onClick={onConfirm}
            disabled={busy}
            autoFocus
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-sm" style={{ color: 'var(--muted)' }}>
        {message}
      </div>
    </Modal>
  );
}
