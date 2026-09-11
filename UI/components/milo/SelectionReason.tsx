'use client';

/**
 * Why the model picked — or passed over — one prospect.
 *
 * The selector already writes a sentence of justification for every prospect it
 * evaluates, plus the seniority tier and rank it assigned. That was being stored and
 * never shown, which left the board asserting "selected" and "not selected" with no
 * way to judge whether the call was right. Surfacing it turns the selection from
 * something to trust into something to check.
 *
 * Hover/focus only — the reason is supporting detail, so it must not take space from
 * the name and title that people actually scan.
 */

import React from 'react';

export interface SelectionReasonProps {
  reason?: string | null;
  tier?: string | null;
  rank?: number | null;
  /** A hand-made choice is labelled as such — it is not the model's opinion. */
  manual?: boolean;
  selected?: boolean;
}

export function SelectionReason({ reason, tier, rank, manual, selected }: SelectionReasonProps) {
  const [open, setOpen] = React.useState(false);
  if (!reason) return null;

  const meta = [tier, typeof rank === 'number' ? `Rank ${rank}` : null]
    .filter(Boolean).join(' · ');

  return (
    <span
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      tabIndex={0}
      role="button"
      aria-label={`Why this prospect was ${selected ? 'selected' : 'not selected'}`}
      style={{ position: 'relative', display: 'inline-flex', flexShrink: 0, cursor: 'help', outline: 'none' }}>
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden
        style={{ opacity: open ? 1 : 0.55, transition: 'opacity .12s' }}>
        <circle cx="7" cy="7" r="6.1" stroke="var(--color-text-3)" strokeWidth="1.3" />
        <circle cx="7" cy="4.4" r="0.85" fill="var(--color-text-3)" />
        <line x1="7" y1="6.4" x2="7" y2="10.2" stroke="var(--color-text-3)"
              strokeWidth="1.5" strokeLinecap="round" />
      </svg>

      {open && (
        <span
          role="tooltip"
          style={{
            position: 'absolute', bottom: 'calc(100% + 7px)', left: '50%',
            transform: 'translateX(-50%)', width: 'max-content', maxWidth: '280px',
            // Fully opaque, with a literal fallback. It floats over other chips, so
            // anything showing through makes both it and them unreadable. Note this
            // only holds while no ANCESTOR sets opacity — a faded parent fades its
            // whole subtree, which is why the chip dims with colour instead.
            background: 'var(--color-text-1, #1E1F21)', opacity: 1, color: '#fff',
            padding: '8px 10px', borderRadius: 'var(--radius-md)',
            fontSize: '11.5px', fontWeight: 500, lineHeight: 1.5,
            textAlign: 'left', whiteSpace: 'normal', zIndex: 30,
            boxShadow: '0 6px 18px rgba(0,0,0,.22)', pointerEvents: 'none',
          }}>
          <span style={{
            display: 'block', fontWeight: 700, marginBottom: '3px',
            color: selected ? 'var(--color-success, #4ade80)' : '#fca5a5',
          }}>
            {manual ? (selected ? 'Selected by you' : 'Deselected by you')
                    : (selected ? 'Selected by AI' : 'Not selected by AI')}
            {meta ? <span style={{ fontWeight: 500, color: '#d4d4d8' }}> · {meta}</span> : null}
          </span>
          {reason}
          {/* Arrow */}
          <span style={{
            position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
            borderLeft: '5px solid transparent', borderRight: '5px solid transparent',
            borderTop: '5px solid var(--color-text-1, #1E1F21)',
          }} />
        </span>
      )}
    </span>
  );
}

export default SelectionReason;
