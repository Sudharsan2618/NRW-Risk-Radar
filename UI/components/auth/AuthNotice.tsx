'use client';
import React from 'react';

type Tone = 'error' | 'success' | 'info';

const TONES: Record<Tone, { bg: string; border: string; color: string }> = {
  error: { bg: 'rgba(240, 106, 106, 0.08)', border: 'var(--color-danger)', color: 'var(--color-danger)' },
  success: { bg: 'rgba(90, 200, 124, 0.10)', border: 'var(--color-success)', color: 'var(--color-success)' },
  info: { bg: 'var(--color-brand-tint)', border: 'var(--color-brand)', color: 'var(--color-brand)' },
};

/** Inline banner for auth feedback (errors, network failures, confirmations). */
export function AuthNotice({ tone = 'error', children }: { tone?: Tone; children: React.ReactNode }) {
  const t = TONES[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
        padding: '10px 12px',
        borderRadius: 'var(--radius-md)',
        background: t.bg,
        border: `1px solid ${t.border}`,
        color: t.color,
        fontSize: '13px',
        lineHeight: 1.4,
        fontFamily: 'var(--font-sans)',
      }}
    >
      {children}
    </div>
  );
}
