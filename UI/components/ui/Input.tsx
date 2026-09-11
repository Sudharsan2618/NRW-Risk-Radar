'use client';
import React, { CSSProperties, InputHTMLAttributes, ReactNode } from 'react';

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix' | 'style'> {
  size?: 'sm' | 'md' | 'full';
  width?: string;
  error?: boolean;
  prefix?: ReactNode;
  suffix?: ReactNode;
  style?: CSSProperties;
}

export function Input({
  type = 'text', size = 'md', width, disabled = false, error = false,
  prefix, suffix, style: extra, ...props
}: InputProps) {
  const [focused, setFocused] = React.useState(false);
  const borderColor = error ? 'var(--color-danger)' : focused ? 'var(--color-brand)' : 'var(--color-border-2)';
  const boxShadow = focused ? (error ? 'var(--shadow-focus-danger)' : 'var(--shadow-focus)') : 'none';
  const widthMap: Record<string, string> = { sm: '120px', md: '280px', full: '100%' };
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '8px',
      border: `1px solid ${borderColor}`, borderRadius: 'var(--radius-md)',
      background: disabled ? 'var(--color-surface)' : '#fff',
      padding: size === 'sm' ? '5px 10px' : '7px 12px',
      width: width || widthMap[size] || widthMap.md,
      boxShadow, transition: 'border-color 0.15s, box-shadow 0.15s',
      opacity: disabled ? 0.6 : 1, ...extra,
    }}>
      {prefix && <span style={{ color: 'var(--color-text-3)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>{prefix}</span>}
      <input
        type={type} disabled={disabled}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          border: 'none', background: 'transparent', outline: 'none',
          fontFamily: 'var(--font-sans)', fontSize: size === 'sm' ? '12.5px' : '13.5px',
          color: 'var(--color-text-1)', width: '100%',
        }}
        {...props}
      />
      {suffix && <span style={{ color: 'var(--color-text-3)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>{suffix}</span>}
    </div>
  );
}
