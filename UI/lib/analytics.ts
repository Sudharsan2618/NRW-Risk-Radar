'use client';

/**
 * PostHog product analytics.
 *
 * Why the identity matters
 * ------------------------
 * The backend stamps every OpenRouter call with `user = <the caller's email>`,
 * and OpenRouter's Broadcast integration maps that field onto PostHog's
 * `distinct_id`. So as long as we identify people here by the SAME email, the
 * `$ai_generation` events produced by backend LLM calls land on the same person
 * as the UI events captured here — one funnel from "clicked the button" through
 * "cost $0.04 in model spend".
 *
 * Identifying by anything else (the JWT `sub`, a random uuid) silently breaks
 * that join, which is why `identifyUser` takes the email specifically.
 *
 * Everything here no-ops when NEXT_PUBLIC_POSTHOG_KEY is unset, so local dev and
 * preview builds don't emit analytics unless deliberately configured.
 */

import posthog from 'posthog-js';

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
// Requests go to our own origin by default and are rewritten to PostHog in
// next.config.mjs — a same-origin path survives the ad/tracker blockers that
// would otherwise silently drop a direct i.posthog.com request.
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || '/ingest';
const UI_HOST = process.env.NEXT_PUBLIC_POSTHOG_UI_HOST || 'https://us.posthog.com';

let started = false;

export function isAnalyticsEnabled(): boolean {
  return Boolean(KEY);
}

export function initAnalytics(): void {
  if (started || !KEY || typeof window === 'undefined') return;
  started = true;

  posthog.init(KEY, {
    api_host: HOST,
    ui_host: UI_HOST,
    // The App Router does client-side navigation, so PostHog's automatic
    // pageview detection misses route changes. We capture them ourselves in
    // PostHogProvider instead — see capturePageview below.
    capture_pageview: false,
    capture_pageleave: true,
    persistence: 'localStorage+cookie',
    // Session replay is opt-in: it records real customer data, so it should be
    // a deliberate decision rather than something that arrives with the SDK.
    disable_session_recording: true,
  });
}

export function capturePageview(url: string): void {
  if (!started) return;
  posthog.capture('$pageview', { $current_url: url });
}

/**
 * Bind the current person to their email — the same value the backend sends to
 * OpenRouter as `user`, which is what joins LLM cost to UI behaviour.
 */
export function identifyUser(
  email: string | undefined | null,
  properties?: Record<string, unknown>,
): void {
  if (!started || !email) return;
  posthog.identify(email, { email, ...(properties || {}) });
}

/** Clear the identity on sign-out so the next user isn't merged into this one. */
export function resetAnalytics(): void {
  if (!started) return;
  posthog.reset();
}

/** Capture a product event. Safe to call when analytics is disabled. */
export function track(event: string, properties?: Record<string, unknown>): void {
  if (!started) return;
  posthog.capture(event, properties);
}

export { posthog };
