'use client';
import React from 'react';
import { ProfileMenu } from './ProfileMenu';
import { useTour } from '@/contexts/TourContext';

interface AppBarProps {
  sidebarCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function AppBar({ sidebarCollapsed }: AppBarProps) {
  const brandW = sidebarCollapsed ? 50 : 242;
  const tour = useTour();

  return (
    <header style={{
      height: 'var(--size-appbar)',
      display: 'flex', alignItems: 'center',
      borderBottom: '1px solid var(--color-border)',
      background: 'var(--color-bg)',
      zIndex: 50, flexShrink: 0,
    }}>
      <div style={{
        width: `${brandW}px`, minWidth: `${brandW}px`,
        display: 'flex', alignItems: 'center',
        gap: sidebarCollapsed ? '0' : '8px',
        padding: sidebarCollapsed ? '0' : '0 12px',
        justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
        borderRight: '1px solid var(--color-border)',
        height: '100%', overflow: 'hidden',
        transition: 'width 0.2s ease, min-width 0.2s ease, padding 0.2s ease',
        flexShrink: 0,
      }}>
        <img src="/logo.png" alt="Swarion"
          style={{ height: '36px', width: 'auto', maxWidth: '100%', flexShrink: 0, objectFit: 'contain' }} />
        {/* {!sidebarCollapsed && (
          <span style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--color-text-1)', whiteSpace: 'nowrap' }}>
            Swarion
          </span>
        )} */}
      </div>

      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', padding: '0 20px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: '8px', padding: '6px 14px',
          width: '100%', maxWidth: '500px',
        }}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ color: 'var(--color-text-3)', flexShrink: 0 }}>
            <circle cx="5.5" cy="5.5" r="4" /><line x1="8.5" y1="8.5" x2="12" y2="12" />
          </svg>
          <input type="text" placeholder="Search"
            style={{
              border: 'none', background: 'transparent', outline: 'none',
              fontFamily: 'var(--font-sans)', fontSize: '13px',
              color: 'var(--color-text-1)', width: '100%',
            }} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 16px' }}>
        <button
          onClick={() => tour?.start()}
          title="Take a product tour"
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '5px 11px', background: 'none', color: 'var(--color-text-2)',
            border: '1px solid var(--color-border-2)', borderRadius: '6px',
            fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
            transition: 'background .12s, color .12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-surface)'; e.currentTarget.style.color = 'var(--color-text-1)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--color-text-2)'; }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="8" cy="8" r="6.5" /><path d="M8 5.2v.01M7.1 7.2c0-.6.5-1.1 1.1-1.1s1 .4 1 1c0 .9-1.1.9-1.1 2M8 11v.01" />
          </svg>
          Take a tour
        </button>
        {/* Trial status + Upgrade hidden for now — a better subscription solution is coming later.
        <span style={{ fontSize: '12px', color: 'var(--color-text-2)', whiteSpace: 'nowrap' }}>
          7 days left in trial
        </span>
        <button style={{
          padding: '5px 12px', background: 'var(--color-billing)', color: 'var(--color-text-1)',
          border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
          cursor: 'pointer', fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
        }}>
          Upgrade
        </button>
        */}
        <ProfileMenu />
      </div>
    </header>
  );
}
