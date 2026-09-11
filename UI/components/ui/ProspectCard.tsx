'use client';
import React, { CSSProperties } from 'react';

interface ProspectCardProps {
  name: string;
  role: string;
  company?: string;
  description?: string; // reason, description, or topic
  selected?: boolean;
  onClick?: () => void;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  width?: string | number;
  style?: CSSProperties;
  /** Completed-task styling: dims the card and strikes the name through. */
  done?: boolean;
  children?: React.ReactNode; // for custom details like suggested message/topic
}

export function ProspectCard({
  name,
  role,
  company,
  description,
  selected = false,
  onClick,
  icon,
  badge,
  width,
  style: extraStyle,
  done = false,
  children
}: ProspectCardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        flex: width ? '0 0 auto' : undefined,
        width: width ? (typeof width === 'number' ? `${width}px` : width) : '100%',
        padding: '14px 16px',
        borderRadius: 'var(--radius-md)',
        cursor: onClick ? 'pointer' : 'default',
        border: `1.5px solid ${selected ? 'var(--color-brand)' : 'var(--color-border)'}`,
        background: selected ? 'var(--color-brand-subtle)' : 'var(--color-bg)',
        transition: 'border-color .12s, background .12s, transform 0.1s ease',
        userSelect: 'none',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: selected ? 'var(--shadow-sm)' : 'none',
        opacity: done ? 0.6 : 1,
        ...extraStyle,
      }}
      onMouseEnter={e => {
        if (!selected && onClick) {
          e.currentTarget.style.borderColor = 'var(--color-border-2)';
        }
      }}
      onMouseLeave={e => {
        if (!selected && onClick) {
          e.currentTarget.style.borderColor = 'var(--color-border)';
        }
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: done ? 'line-through' : 'none' }}>
              {name}
            </span>
            {done && (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="7" cy="7" r="7" fill="var(--color-success, var(--color-brand))" />
                <polyline points="4,7.2 6.2,9.2 10,4.8" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {!done && selected && !icon && (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                <circle cx="7" cy="7" r="7" fill="var(--color-brand)" />
                <polyline points="4,7.2 6.2,9.2 10,4.8" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-2)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={role}>
            {role}
          </div>
          {company && (
            <div style={{ fontSize: '11.5px', color: 'var(--color-text-3)', marginTop: '1px' }}>
              {company}
            </div>
          )}
        </div>
        {icon && <div style={{ flexShrink: 0, marginTop: '2px' }}>{icon}</div>}
      </div>

      {description && (
        <div style={{ fontSize: '12px', lineHeight: 1.5, color: 'var(--color-text-2)', marginTop: '10px', fontStyle: 'italic' }}>
          {description}
        </div>
      )}

      {badge && <div style={{ marginTop: '10px' }}>{badge}</div>}

      {children && (
        <div style={{ marginTop: '12px', flex: 1, display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
      )}
    </div>
  );
}
