'use client';
import React, { CSSProperties, ReactNode } from 'react';

type Variant =
  | 'low' | 'medium' | 'high'
  | 'success' | 'danger' | 'warning' | 'info' | 'neutral'
  | 'trial' | 'pro' | 'active' | 'paused';

const variants: Record<Variant, CSSProperties> = {
  low:     { background: 'var(--color-priority-low-bg)',    color: 'var(--color-priority-low-text)' },
  medium:  { background: 'var(--color-priority-medium-bg)', color: 'var(--color-priority-medium-text)' },
  high:    { background: 'var(--color-priority-high-bg)',   color: 'var(--color-priority-high-text)' },
  success: { background: 'var(--color-success-bg)',         color: 'var(--color-success-text)' },
  danger:  { background: 'var(--color-danger-bg)',          color: 'var(--color-danger-text)' },
  warning: { background: 'var(--color-warning-bg)',         color: 'var(--color-warning-text)' },
  info:    { background: 'var(--color-brand-subtle)',       color: 'var(--color-brand-text)' },
  neutral: { background: 'var(--color-surface)',            color: 'var(--color-text-2)' },
  trial:   { background: 'var(--color-warning-bg)',         color: 'var(--color-warning-text)' },
  pro:     { background: 'var(--color-brand-subtle)',       color: 'var(--color-brand)' },
  active:  { background: 'var(--color-success-bg)',         color: 'var(--color-success-text)' },
  paused:  { background: 'var(--color-warning-bg)',         color: 'var(--color-warning-text)' },
};

interface BadgeProps {
  children?: ReactNode;
  variant?: Variant;
  size?: 'sm' | 'md';
  style?: CSSProperties;
}

export function Badge({ children, variant = 'neutral', size = 'sm', style: extra }: BadgeProps) {
  const s: CSSProperties = {
    display: 'inline-flex', alignItems: 'center',
    padding: size === 'sm' ? '3px 10px' : '4px 12px',
    borderRadius: 'var(--radius-full)',
    fontSize: size === 'sm' ? '11.5px' : '13px',
    fontWeight: 600, fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
    ...variants[variant], ...extra,
  };
  return <span style={s}>{children}</span>;
}
