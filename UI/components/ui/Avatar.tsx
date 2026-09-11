'use client';
import React, { CSSProperties } from 'react';

const COLORS = ['#4C9BE8', '#5AC87C', '#F59E0B', '#F06A6A', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

function colorFor(name?: string) {
  if (!name) return COLORS[0];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return COLORS[Math.abs(h) % COLORS.length];
}

function initials(name?: string) {
  if (!name) return '?';
  const p = name.trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
}

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
const sizes: Record<Size, CSSProperties> = {
  xs: { width: '20px', height: '20px', fontSize: '8px' },
  sm: { width: '26px', height: '26px', fontSize: '10px' },
  md: { width: '32px', height: '32px', fontSize: '12px' },
  lg: { width: '40px', height: '40px', fontSize: '15px' },
  xl: { width: '56px', height: '56px', fontSize: '20px' },
};

interface AvatarProps {
  name?: string;
  size?: Size;
  color?: string;
  style?: CSSProperties;
}

export function Avatar({ name, size = 'md', color, style: extra }: AvatarProps) {
  return (
    <div style={{
      ...(sizes[size] || sizes.md),
      borderRadius: '50%', background: color || colorFor(name), color: '#fff',
      fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-sans)', flexShrink: 0, ...extra,
    }}>
      {initials(name)}
    </div>
  );
}
