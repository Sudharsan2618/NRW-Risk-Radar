'use client';
import React from 'react';

/**
 * In-app confirmation modal — replaces window.confirm()/window.alert() so
 * confirmations look like part of the product instead of a browser chrome
 * dialog. Styling matches the delete-confirmation modal already used in
 * Sidebar.tsx; kept here as a shared component so every screen gets the same
 * look instead of re-implementing the markup per call site.
 */
export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button for destructive actions (delete, discard, etc). */
  danger?: boolean;
  /** Disables both buttons and swaps the confirm label to loadingLabel. */
  loading?: boolean;
  loadingLabel?: string;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  danger = false, loading = false, loadingLabel, error, onConfirm, onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div
      onClick={() => { if (!loading) onCancel(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1300, background: 'rgba(0,0,0,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: '420px', background: 'var(--color-bg)',
        borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-modal)', overflow: 'hidden',
      }}>
        <div style={{ padding: '18px 20px 8px' }}>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: '8px' }}>
            {title}
          </div>
          <div style={{ fontSize: '13.5px', color: 'var(--color-text-2)', lineHeight: 1.55 }}>
            {message}
          </div>
          {error && (
            <div style={{ marginTop: '12px', fontSize: '12.5px', fontWeight: 600, color: 'var(--color-danger-text)' }}>
              {error}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 20px 16px' }}>
          <button
            onClick={onCancel}
            disabled={loading}
            style={{
              padding: '8px 14px', border: '1px solid var(--color-border-2)', background: 'var(--color-bg)',
              borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-1)',
              cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)',
            }}>{cancelLabel}</button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              padding: '8px 14px', border: 'none', background: danger ? 'var(--color-danger)' : 'var(--color-brand)', color: '#fff',
              borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', opacity: loading ? 0.7 : 1,
            }}>{loading ? (loadingLabel ?? `${confirmLabel}…`) : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
