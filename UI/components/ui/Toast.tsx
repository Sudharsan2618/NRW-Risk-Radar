'use client';

/**
 * The app's transient notification — a pill at the bottom of the screen.
 *
 * This markup existed inline in several screens. Sharing it keeps every
 * notification looking and behaving the same, and gives messages one obvious home
 * instead of being wedged into whatever layout happens to be nearby (a message
 * rendered next to a section heading pushes that heading around and reads as part
 * of the page rather than as feedback).
 *
 * Auto-dismisses; a longer message gets proportionally longer on screen, since a
 * two-line explanation takes longer to read than "Saved".
 */

import React from 'react';

export interface ToastProps {
  message: string | null;
  /** `warning` for something the user must act on, e.g. a limit they just hit. */
  tone?: 'default' | 'warning';
  /** Milliseconds. Omit to size it from the message length. */
  duration?: number;
  onDismiss: () => void;
}

function autoDuration(message: string): number {
  // ~50ms per character, clamped — long enough to read, short enough not to linger.
  return Math.min(9000, Math.max(3500, message.length * 50));
}

export function Toast({ message, tone = 'default', duration, onDismiss }: ToastProps) {
  React.useEffect(() => {
    if (!message) return;
    const ms = duration ?? autoDuration(message);
    const t = setTimeout(onDismiss, ms);
    return () => clearTimeout(t);
  }, [message, duration, onDismiss]);

  if (!message) return null;

  const warning = tone === 'warning';
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', alignItems: 'center', gap: '10px',
        maxWidth: 'min(560px, calc(100vw - 40px))',
        background: warning ? 'var(--color-warning-text, #b45309)' : 'var(--color-text-1)',
        color: '#fff', padding: '10px 14px', borderRadius: 'var(--radius-md)',
        fontSize: '13px', fontWeight: 600, lineHeight: 1.45, zIndex: 1200,
        boxShadow: '0 6px 20px rgba(0,0,0,.18)',
      }}>
      {warning && (
        <svg width="15" height="15" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
          <circle cx="7" cy="7" r="6.2" stroke="currentColor" strokeWidth="1.4" />
          <line x1="7" y1="3.6" x2="7" y2="7.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="7" cy="10.1" r="0.85" fill="currentColor" />
        </svg>
      )}
      <span style={{ minWidth: 0 }}>{message}</span>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        style={{
          border: 'none', background: 'none', cursor: 'pointer', color: 'inherit',
          padding: '0 0 0 4px', display: 'flex', flexShrink: 0, opacity: 0.8,
        }}>
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="1.5" y1="1.5" x2="10.5" y2="10.5" /><line x1="10.5" y1="1.5" x2="1.5" y2="10.5" />
        </svg>
      </button>
    </div>
  );
}

export default Toast;
