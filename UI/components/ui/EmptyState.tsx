'use client';
import React from 'react';

/**
 * One empty state for the whole app.
 *
 * Every "nothing here yet" spot used to be an ad-hoc grey sentence, so the same
 * situation looked different in each tab. This gives them a single shape: icon,
 * what is missing, why, and (optionally) the action that fills it.
 *
 * Variants differ only in scale, so a section empty and a whole-tab empty read
 * as the same idea at two sizes:
 *   inline — inside a section band, where the section header already gives context
 *   panel  — fills a flex region such as an unoccupied side panel
 *   page   — a whole tab with nothing in it; the only variant with a card frame
 */

export type EmptyStateVariant = 'inline' | 'panel' | 'page';
export type EmptyStateTone = 'neutral' | 'brand' | 'success' | 'warning';

const TONES: Record<EmptyStateTone, { bg: string; fg: string }> = {
  neutral: { bg: 'var(--color-surface)', fg: 'var(--color-text-3)' },
  brand:   { bg: 'var(--color-brand-subtle)', fg: 'var(--color-brand-text)' },
  success: { bg: 'var(--color-success-subtle, #dcfce7)', fg: 'var(--color-success-text, #15803d)' },
  warning: { bg: 'var(--color-warning-subtle, #fef3c7)', fg: 'var(--color-warning, #d97706)' },
};

const SIZES: Record<EmptyStateVariant, {
  pad: string; ring: number; icon: number; title: number; body: number; gap: number; maxWidth: number;
}> = {
  inline: { pad: '22px 24px', ring: 36, icon: 17, title: 13,   body: 12.5, gap: 5,  maxWidth: 420 },
  // Vertical padding stays modest: `panel` also fills the fixed-height compose
  // box (COMPOSE_BODY_HEIGHT), where a taller block would clip. At 16px there is
  // room for a fourth line of body copy before it needs to scroll.
  panel:  { pad: '16px 26px', ring: 46, icon: 21, title: 14.5, body: 13,   gap: 7,  maxWidth: 340 },
  page:   { pad: '48px 24px', ring: 52, icon: 24, title: 16,   body: 13,   gap: 8,  maxWidth: 420 },
};

export function EmptyState({
  icon,
  title,
  body,
  action,
  variant = 'inline',
  tone = 'neutral',
  align = 'center',
}: {
  icon?: React.ReactNode;
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
  variant?: EmptyStateVariant;
  tone?: EmptyStateTone;
  /** Inline empties inside a dense list read better left-aligned. */
  align?: 'center' | 'left';
}) {
  const s = SIZES[variant];
  const t = TONES[tone];
  const centered = align === 'center';

  const content = (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: centered ? 'center' : 'flex-start',
      textAlign: centered ? 'center' : 'left',
      gap: `${s.gap}px`, maxWidth: `${s.maxWidth}px`,
      ...(centered ? { marginLeft: 'auto', marginRight: 'auto' } : null),
    }}>
      <span style={{
        width: `${s.ring}px`, height: `${s.ring}px`, borderRadius: '50%',
        background: t.bg, color: t.fg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, marginBottom: '4px',
      }}>
        <span style={{ display: 'flex', width: `${s.icon}px`, height: `${s.icon}px` }}>
          {icon ?? EmptyIcons.spark}
        </span>
      </span>
      <div style={{ fontSize: `${s.title}px`, fontWeight: 700, color: 'var(--color-text-1)' }}>{title}</div>
      {body && (
        <div style={{ fontSize: `${s.body}px`, color: 'var(--color-text-2)', lineHeight: 1.6 }}>{body}</div>
      )}
      {action && <div style={{ marginTop: '10px' }}>{action}</div>}
    </div>
  );

  if (variant === 'page') {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: s.pad, background: 'var(--color-bg)' }}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          background: 'var(--color-surface)', padding: '36px 32px',
          borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        }}>
          {content}
        </div>
      </div>
    );
  }

  if (variant === 'panel') {
    // overflow:auto is a backstop, not the plan: this variant is used inside
    // fixed-height boxes, and unusually long copy should scroll rather than be
    // silently cut off by the parent's overflow:hidden.
    return (
      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: s.pad, overflow: 'auto' }}>
        {content}
      </div>
    );
  }

  return <div style={{ padding: s.pad }}>{content}</div>;
}

/* ── icon set ──────────────────────────────────────────────────────────────
   Drawn on a 24×24 grid at the same 1.7 stroke weight as the rest of the app,
   and sized by the caller, so any icon works at any variant. */

const svg = (children: React.ReactNode) => (
  <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);

export const EmptyIcons = {
  inbox: svg(<><path d="M3 13h4l1.5 3h7L17 13h4" /><path d="M4.5 13 6 5h12l1.5 8v5a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18z" /></>),
  mail: svg(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 6.5 8.5 6 8.5-6" /></>),
  reply: svg(<><polyline points="9,6 4,11 9,16" /><path d="M4 11h9a6 6 0 0 1 6 6v1" /></>),
  linkedin: svg(<><rect x="3" y="3" width="18" height="18" rx="4" /><line x1="8" y1="11" x2="8" y2="16" /><circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" /><path d="M12 16v-5m0 0a2.5 2.5 0 0 1 5 0v5" /></>),
  users: svg(<><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c0-3 2.5-5.2 5.5-5.2s5.5 2.2 5.5 5.2" /><path d="M16.5 8.2a3 3 0 0 1 0 5.6" /><path d="M18 19c0-2-.7-3.6-1.9-4.7" /></>),
  userPlus: svg(<><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19c0-3 2.5-5.2 5.5-5.2 1.2 0 2.3.3 3.2.9" /><line x1="18" y1="12" x2="18" y2="18" /><line x1="15" y1="15" x2="21" y2="15" /></>),
  phone: svg(<path d="M5 6c0-1.4 1.1-2.5 2.4-2.5h1.6c.6 0 1.1.4 1.2 1l.8 3.1c.1.5-.1 1-.5 1.3L9.2 10a11 11 0 0 0 4.8 4.8l1.1-1.3c.3-.4.9-.5 1.4-.4l3.1.8c.6.2 1 .7 1 1.2V17c0 1.4-1.1 2.5-2.5 2.4C11 19 5 13 5 6z" />),
  document: svg(<><path d="M14 3.5H7.5A1.5 1.5 0 0 0 6 5v14a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 18 19V7.5z" /><polyline points="14,3.5 14,7.5 18,7.5" /><line x1="9" y1="12" x2="15" y2="12" /><line x1="9" y1="15.5" x2="13" y2="15.5" /></>),
  pulse: svg(<><path d="M3 12h3.5L9 6.5l3.5 11L15 12h6" /></>),
  search: svg(<><circle cx="10.5" cy="10.5" r="6" /><line x1="15" y1="15" x2="20.5" y2="20.5" /></>),
  check: svg(<><circle cx="12" cy="12" r="8.5" /><polyline points="8.2,12.3 11,15 16,9.5" /></>),
  spark: svg(<><path d="M12 4.5 13.6 9l4.4 1.6-4.4 1.6L12 16.5l-1.6-4.3L6 10.6 10.4 9z" /><line x1="18" y1="16" x2="18" y2="19.5" /><line x1="16.2" y1="17.7" x2="19.8" y2="17.7" /></>),
  target: svg(<><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /></>),
} satisfies Record<string, React.ReactNode>;
