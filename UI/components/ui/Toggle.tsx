'use client';
import React, { CSSProperties } from 'react';

interface ToggleProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean, e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  label?: string;
  hint?: string;
  style?: CSSProperties;
}

export function Toggle({ checked: controlled, defaultChecked = false, onChange, disabled = false, label, hint, style: extra }: ToggleProps) {
  const [internal, setInternal] = React.useState(defaultChecked);
  const checked = controlled !== undefined ? controlled : internal;
  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (controlled === undefined) setInternal(e.target.checked);
    onChange?.(e.target.checked, e);
  };
  return (
    <label style={{
      display: 'inline-flex', alignItems: label ? 'flex-start' : 'center', gap: '10px',
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, ...extra,
    }}>
      <div style={{ position: 'relative', width: '38px', height: '22px', flexShrink: 0 }}>
        <input type="checkbox" checked={checked} onChange={handle} disabled={disabled}
          style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }} />
        <div style={{
          display: 'block', width: '38px', height: '22px', borderRadius: '11px',
          background: checked ? 'var(--color-brand)' : '#D1D5DB',
          cursor: disabled ? 'not-allowed' : 'pointer', transition: 'background 0.2s',
        }} />
        <div style={{
          position: 'absolute', top: '3px', left: checked ? '19px' : '3px',
          width: '16px', height: '16px', background: '#fff', borderRadius: '50%',
          transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', pointerEvents: 'none',
        }} />
      </div>
      {label && (
        <div>
          <div style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--color-text-1)' }}>{label}</div>
          {hint && <div style={{ fontSize: '12.5px', color: 'var(--color-text-3)', marginTop: '2px' }}>{hint}</div>}
        </div>
      )}
    </label>
  );
}
