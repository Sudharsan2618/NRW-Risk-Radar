'use client';
import React, { CSSProperties, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  children?: ReactNode;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit' | 'reset';
  style?: CSSProperties;
}

const sizes: Record<Size, CSSProperties> = {
  sm: { padding: '5px 12px', fontSize: '12.5px', height: '28px', gap: '4px' },
  md: { padding: '7px 16px', fontSize: '13px',   height: '34px', gap: '5px' },
  lg: { padding: '9px 20px', fontSize: '14px',   height: '40px', gap: '6px' },
};

const variantStyle = (v: Variant, hov: boolean): CSSProperties => ({
  primary:   { background: hov ? 'var(--color-brand-hover)' : 'var(--color-brand)', color: '#fff', border: 'none' },
  secondary: { background: hov ? 'var(--color-hover)' : 'transparent', color: 'var(--color-text-1)', border: '1px solid var(--color-border-2)' },
  danger:    { background: hov ? '#FFF5F5' : 'transparent', color: 'var(--color-danger-text)', border: '1px solid var(--color-danger-border)' },
  ghost:     { background: hov ? 'var(--color-hover)' : 'transparent', color: 'var(--color-text-2)', border: 'none' },
}[v]);

export function Button({ children, variant = 'primary', size = 'md', disabled = false, icon = null, iconPosition = 'left', onClick, type = 'button', style: extra }: ButtonProps) {
  const [hov, setHov] = React.useState(false);
  const s: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-sans)', fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
    whiteSpace: 'nowrap', transition: 'background 0.15s', outline: 'none', lineHeight: 1,
    ...sizes[size], ...variantStyle(variant, hov && !disabled), ...extra,
  };
  return (
    <button type={type} disabled={disabled} onClick={onClick} style={s}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      {icon && iconPosition === 'left' && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
      {children}
      {icon && iconPosition === 'right' && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
    </button>
  );
}
