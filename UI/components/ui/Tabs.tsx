'use client';
import React, { CSSProperties } from 'react';

interface TabItem { id: string; label: React.ReactNode }
interface TabsProps {
  items: TabItem[];
  activeId?: string;
  defaultActiveId?: string;
  onChange?: (id: string) => void;
  style?: CSSProperties;
}

export function Tabs({ items = [], activeId, defaultActiveId, onChange, style: extra }: TabsProps) {
  const [internal, setInternal] = React.useState(defaultActiveId || items[0]?.id);
  const active = activeId !== undefined ? activeId : internal;
  const click = (id: string) => { if (activeId === undefined) setInternal(id); onChange?.(id); };
  return (
    <div style={{
      display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--color-border)',
      overflowX: 'auto', ...extra,
    }}>
      {items.map(item => {
        const on = item.id === active;
        return (
          <button key={item.id} onClick={() => click(item.id)} style={{
            padding: '11px 14px', fontSize: '13.5px', fontWeight: on ? 600 : 500,
            color: on ? 'var(--color-text-1)' : 'var(--color-text-2)',
            background: 'none', border: 'none',
            borderBottom: `2px solid ${on ? 'var(--color-brand)' : 'transparent'}`,
            marginBottom: '-1px', cursor: 'pointer', whiteSpace: 'nowrap',
            fontFamily: 'var(--font-sans)', transition: 'color 0.12s', outline: 'none',
          }}>{item.label}</button>
        );
      })}
    </div>
  );
}
