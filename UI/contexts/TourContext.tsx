'use client';

// Global product-tour controller. Lives in the root layout (above AppShell, which
// remounts per route) so tour state survives navigation between screens. Exposes
// a small imperative API via useTour(); the visual overlay is rendered here so it
// floats above the entire app.

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { TOUR_STEPS, type TourStep } from '@/components/tour/steps';
import { TourOverlay } from '@/components/tour/TourOverlay';

// Bump the suffix to re-show the tour to everyone after a major change.
const SEEN_KEY = 'swarion_tour_seen_v1';

interface TourContextValue {
  isActive: boolean;
  index: number;
  total: number;
  step: TourStep | null;
  start: () => void;
  stop: () => void;
  next: () => void;
  prev: () => void;
  goTo: (i: number) => void;
}

const TourContext = createContext<TourContextValue | null>(null);

export function useTour(): TourContextValue | null {
  return useContext(TourContext);
}

function markSeen() {
  try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* storage unavailable */ }
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [isActive, setIsActive] = useState(false);
  const [index, setIndex] = useState(0);

  const total = TOUR_STEPS.length;
  const step = isActive ? TOUR_STEPS[index] ?? null : null;

  const start = useCallback(() => { setIndex(0); setIsActive(true); }, []);
  const stop = useCallback(() => { setIsActive(false); markSeen(); }, []);
  const goTo = useCallback((i: number) => {
    if (i < 0 || i >= total) return;
    setIndex(i);
  }, [total]);
  const next = useCallback(() => {
    setIndex(i => {
      if (i >= total - 1) { setIsActive(false); markSeen(); return i; }
      return i + 1;
    });
  }, [total]);
  const prev = useCallback(() => setIndex(i => Math.max(0, i - 1)), []);

  // Drive navigation from the active step's route.
  useEffect(() => {
    if (isActive && step?.route) router.push(step.route);
  }, [isActive, step?.route, router]);

  // Auto-start once for users who have never seen the tour (i.e. new sign-ups).
  useEffect(() => {
    if (isLoading || !isAuthenticated) return;
    let seen: string | null = '1';
    try { seen = localStorage.getItem(SEEN_KEY); } catch { seen = '1'; }
    if (!seen) {
      // Defer so the first authenticated screen has mounted before we spotlight.
      const t = setTimeout(() => setIsActive(true), 600);
      return () => clearTimeout(t);
    }
  }, [isLoading, isAuthenticated]);

  // Let Escape end the tour.
  useEffect(() => {
    if (!isActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') stop();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isActive, stop, next, prev]);

  return (
    <TourContext.Provider value={{ isActive, index, total, step, start, stop, next, prev, goTo }}>
      {children}
      {isActive && step && <TourOverlay />}
    </TourContext.Provider>
  );
}
