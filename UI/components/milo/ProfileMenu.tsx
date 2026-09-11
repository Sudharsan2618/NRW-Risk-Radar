'use client';
import React from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Top-right profile avatar with a dropdown menu (name + email + Sign out).
 * Closes on outside-click and Escape.
 */
export function ProfileMenu() {
  const { user, dbUser, logout } = useAuth();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  const name = dbUser?.full_name || user?.name || user?.email || 'Account';
  const email = dbUser?.email || user?.email || '';

  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', borderRadius: '50%', outline: 'none' }}
      >
        <Avatar name={name} size="sm" color="var(--color-avatar-blue)" />
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0,
            minWidth: '220px', background: 'var(--color-bg)',
            border: '1px solid var(--color-border)', borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '6px', zIndex: 100,
            fontFamily: 'var(--font-sans)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px' }}>
            <Avatar name={name} size="md" color="var(--color-avatar-blue)" />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
              {email && (
                <div style={{ fontSize: '12px', color: 'var(--color-text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{email}</div>
              )}
            </div>
          </div>

          <div style={{ height: '1px', background: 'var(--color-border)', margin: '6px 0' }} />

          <MenuItem onClick={() => { setOpen(false); logout(); }} danger>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign out
          </MenuItem>
        </div>
      )}
    </div>
  );
}

function MenuItem({ children, onClick, danger = false }: { children: React.ReactNode; onClick: () => void; danger?: boolean }) {
  const [hov, setHov] = React.useState(false);
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '9px',
        padding: '9px 10px', borderRadius: '7px', border: 'none', cursor: 'pointer',
        background: hov ? (danger ? 'rgba(240,106,106,0.08)' : 'var(--color-hover)') : 'transparent',
        color: danger ? 'var(--color-danger)' : 'var(--color-text-1)',
        fontSize: '13px', fontWeight: 500, fontFamily: 'inherit', textAlign: 'left',
        transition: 'background .12s',
      }}
    >
      {children}
    </button>
  );
}
