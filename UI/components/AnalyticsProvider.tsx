'use client';

/**
 * Boots PostHog and keeps it in step with the app.
 *
 * Two jobs the SDK can't do by itself in the App Router:
 *
 *  1. **Pageviews.** Next's client-side navigation never triggers a document
 *     load, so PostHog's automatic pageview capture only ever sees the first
 *     page. We watch the router's pathname + search params and capture each
 *     change ourselves.
 *  2. **Identity.** The person has to be identified by the same email the
 *     backend sends to OpenRouter, otherwise LLM cost events and UI events end
 *     up on two different people. We mirror AuthContext into PostHog: identify
 *     on sign-in, reset on sign-out.
 *
 * Rendered inside AuthProvider (it consumes useAuth) but around everything else.
 */

import { Suspense, useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

import { useAuth } from '@/contexts/AuthContext';
import { capturePageview, identifyUser, initAnalytics, resetAnalytics } from '@/lib/analytics';

function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    const qs = searchParams?.toString();
    capturePageview(window.origin + pathname + (qs ? `?${qs}` : ''));
  }, [pathname, searchParams]);

  return null;
}

function IdentityBridge() {
  const { user, isAuthenticated } = useAuth();
  // Tracks who we last told PostHog about, so a re-render doesn't re-identify
  // the same person on every state change.
  const identified = useRef<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && user?.email) {
      if (identified.current !== user.email) {
        identifyUser(user.email, { name: user.name, username: user.username });
        identified.current = user.email;
      }
      return;
    }
    // Signed out (or never signed in): drop the identity so the next person to
    // use this browser isn't merged into the previous one's profile.
    if (identified.current !== null) {
      resetAnalytics();
      identified.current = null;
    }
  }, [isAuthenticated, user?.email, user?.name, user?.username]);

  return null;
}

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initAnalytics();
  }, []);

  return (
    <>
      {/* useSearchParams needs a Suspense boundary or it opts the whole route
          out of static rendering. */}
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      <IdentityBridge />
      {children}
    </>
  );
}

export default AnalyticsProvider;
