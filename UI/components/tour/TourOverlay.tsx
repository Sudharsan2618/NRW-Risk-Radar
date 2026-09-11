'use client';

// The tour's visual layer: a dimmed backdrop with a spotlight cut-out around the
// current target, plus a tooltip card with Back / Next / Skip. Finds the target
// by CSS selector and polls briefly after a route change (the destination screen
// and any sidebar section may still be mounting). Falls back to a centered card
// if the target never appears, so a step is never a dead end.

import React from 'react';
import { useTour } from '@/contexts/TourContext';

const TT_WIDTH = 320;
const TT_EST_HEIGHT = 210; // used only for viewport clamping
const PAD = 6;             // spotlight padding around the target
const GAP = 16;            // distance from target to tooltip
const MARGIN = 12;         // min distance from viewport edges

interface Box { top: number; left: number; width: number; height: number }

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(v, max));
}

export function TourOverlay() {
  const tour = useTour();
  const step = tour?.step ?? null;
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const [ready, setReady] = React.useState(false);

  // Locate + track the target element for the active step.
  React.useEffect(() => {
    setReady(false);
    setRect(null);
    if (!step) return;
    if (!step.target) { setReady(true); return; }

    let cancelled = false;
    let timer = 0;
    let tries = 0;

    const measure = () => {
      const el = document.querySelector<HTMLElement>(step.target!);
      if (el) {
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        if (!cancelled) { setRect(el.getBoundingClientRect()); setReady(true); }
        return true;
      }
      return false;
    };

    const poll = () => {
      if (cancelled) return;
      if (measure()) return;
      if (tries++ < 40) { timer = window.setTimeout(poll, 100); }  // up to ~4s
      else if (!cancelled) { setRect(null); setReady(true); }       // give up → centered
    };
    poll();

    const onReflow = () => {
      const el = document.querySelector<HTMLElement>(step.target!);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
  }, [step]);

  if (!tour || !step) return null;

  const spot: Box | null = rect
    ? { top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }
    : null;

  // Tooltip position: beside the target per placement, clamped to the viewport.
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  let ttTop: number, ttLeft: number, centered = false;
  if (spot) {
    const place = step.placement ?? 'right';
    if (place === 'right')      { ttLeft = spot.left + spot.width + GAP; ttTop = spot.top; }
    else if (place === 'left')  { ttLeft = spot.left - GAP - TT_WIDTH;   ttTop = spot.top; }
    else if (place === 'bottom'){ ttLeft = spot.left;                    ttTop = spot.top + spot.height + GAP; }
    else                        { ttLeft = spot.left;                    ttTop = spot.top - GAP - TT_EST_HEIGHT; }
    ttLeft = clamp(ttLeft, MARGIN, vw - TT_WIDTH - MARGIN);
    ttTop = clamp(ttTop, MARGIN, vh - TT_EST_HEIGHT - MARGIN);
  } else {
    centered = true;
    ttLeft = vw / 2 - TT_WIDTH / 2;
    ttTop = vh / 2 - TT_EST_HEIGHT / 2;
  }

  const isFirst = tour.index === 0;
  const isLast = tour.index === tour.total - 1;

  const btnBase: React.CSSProperties = {
    fontFamily: 'var(--font-sans)', fontSize: '13px', fontWeight: 600,
    borderRadius: 'var(--radius-md)', cursor: 'pointer', padding: '7px 14px',
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 3000 }} aria-live="polite">
      <style>{`
        @keyframes tourFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes tourPulse {
          0% { box-shadow: 0 0 0 9999px rgba(17,18,20,0.55), 0 0 0 0 var(--color-brand-tint); }
          70% { box-shadow: 0 0 0 9999px rgba(17,18,20,0.55), 0 0 0 8px rgba(69,115,210,0); }
          100% { box-shadow: 0 0 0 9999px rgba(17,18,20,0.55), 0 0 0 0 rgba(69,115,210,0); }
        }
      `}</style>

      {/* Click-blocker: swallows clicks on the app behind the tour. */}
      <div
        onClick={() => { /* keep focus on the tour; use the buttons */ }}
        style={{
          position: 'absolute', inset: 0,
          background: spot ? 'transparent' : 'rgba(17,18,20,0.55)',
          animation: 'tourFade .2s ease',
        }}
      />

      {/* Spotlight cut-out (the big box-shadow dims everything else). */}
      {spot && ready && (
        <div style={{
          position: 'absolute',
          top: spot.top, left: spot.left, width: spot.width, height: spot.height,
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 0 0 9999px rgba(17,18,20,0.55)',
          border: '2px solid var(--color-brand)',
          pointerEvents: 'none',
          transition: 'top .25s ease, left .25s ease, width .25s ease, height .25s ease',
          animation: 'tourPulse 2s ease-out infinite',
        }} />
      )}

      {/* Tooltip card */}
      <div style={{
        position: 'absolute', top: ttTop, left: ttLeft, width: TT_WIDTH,
        background: 'var(--color-bg)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
        padding: '16px 18px', animation: 'tourFade .2s ease',
        transition: centered ? 'none' : 'top .25s ease, left .25s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{
            fontSize: '11px', fontWeight: 700, letterSpacing: 'var(--tracking-caps)',
            textTransform: 'uppercase', color: 'var(--color-brand)',
          }}>Product tour</span>
          <button onClick={tour.stop} title="Close tour" style={{
            width: '24px', height: '24px', border: 'none', background: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 'var(--radius-sm)', color: 'var(--color-text-3)',
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="11" y2="11" /><line x1="11" y1="1" x2="1" y2="11" /></svg>
          </button>
        </div>

        <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: '6px' }}>
          {step.title}
        </div>
        <div style={{ fontSize: '13px', color: 'var(--color-text-2)', lineHeight: 'var(--leading-normal)', marginBottom: '16px' }}>
          {step.body}
        </div>

        {/* Progress dots */}
        <div style={{ display: 'flex', gap: '5px', marginBottom: '14px' }}>
          {tour ? Array.from({ length: tour.total }).map((_, i) => (
            <button key={i} onClick={() => tour.goTo(i)} title={`Step ${i + 1}`} style={{
              width: i === tour.index ? '18px' : '6px', height: '6px', padding: 0, border: 'none',
              borderRadius: 'var(--radius-full)', cursor: 'pointer',
              background: i === tour.index ? 'var(--color-brand)' : 'var(--color-border-2)',
              transition: 'width .2s ease, background .2s ease',
            }} />
          )) : null}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={tour.stop} style={{ ...btnBase, background: 'none', border: 'none', color: 'var(--color-text-3)', padding: '7px 4px' }}>
            Skip tour
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            {!isFirst && (
              <button onClick={tour.prev} style={{ ...btnBase, background: 'var(--color-bg)', color: 'var(--color-text-1)', border: '1px solid var(--color-border-2)' }}>
                Back
              </button>
            )}
            <button onClick={tour.next} style={{ ...btnBase, background: 'var(--color-brand)', color: '#fff', border: 'none' }}>
              {isLast ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
