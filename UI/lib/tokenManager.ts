'use client';

// ──────────────────────────────────────────────────────────────────────────
// Token lifecycle: decode expiry, schedule silent refresh, and provide a
// "make sure my token is fresh before I use it" gate for the API client.
//
// Refresh calls /api/auth/refresh, which rotates the refresh token and is
// bound to a revocable server-side session. On unrecoverable failure we
// degrade gracefully to logout — never an infinite loop.
// ──────────────────────────────────────────────────────────────────────────

import { authStorage } from './authStorage';
import { refreshToken as refreshTokenApi } from './authApi';

/** Decode a JWT payload. Returns null for opaque (non-JWT) tokens. */
export function decodeJwt(token: string | null | undefined): Record<string, any> | null {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    // Auth0 tokens are base64url-encoded — convert to standard base64.
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

/** Expiry (ms epoch) of a JWT, or null if not a JWT / no exp. */
function expiryMs(token: string | null): number | null {
  const payload = decodeJwt(token);
  if (payload && typeof payload.exp === 'number') return payload.exp * 1000;
  return null;
}

/** Refresh this many ms before the token actually expires. */
const REFRESH_LEAD_MS = 60_000;

let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let inFlight: Promise<boolean> | null = null;
let onLogout: (() => void) | null = null;

// ── Activity gate ──────────────────────────────────────────────────────────
// The background timer only auto-refreshes while the user is actually using
// the tab. An abandoned tab stops renewing (without logging out); the next
// interaction triggers ensureValidToken → refresh, and the server-side idle
// timeout decides whether the session is still alive.

/** Stop background auto-refresh after this long without user interaction. */
const CLIENT_IDLE_LIMIT_MS = 60 * 60 * 1000; // 1 hour

let lastActivityMs = Date.now();
let activityInstalled = false;

function noteActivity() {
  lastActivityMs = Date.now();
}

/** Install lightweight user-activity listeners (idempotent). */
export function installActivityTracking() {
  if (activityInstalled || typeof window === 'undefined') return;
  activityInstalled = true;
  window.addEventListener('pointerdown', noteActivity, { passive: true });
  window.addEventListener('keydown', noteActivity, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      noteActivity();
      // Coming back to a dormant tab: make sure the token is fresh again.
      void ensureValidToken().then((token) => { if (token) scheduleRefresh(); });
    }
  });
}

function isClientIdle(): boolean {
  return Date.now() - lastActivityMs > CLIENT_IDLE_LIMIT_MS;
}

/** The AuthContext registers its logout here so a failed refresh tears down
 *  React state too (and not just storage). */
export function setOnLogout(fn: (() => void) | null) {
  onLogout = fn;
}

function fail() {
  authStorage.clear();
  if (onLogout) {
    onLogout();
  } else if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
}

/**
 * Exchange the stored refresh token for a fresh access token. De-duplicated:
 * concurrent callers share one in-flight request. Returns true on success.
 */
export async function doRefresh(): Promise<boolean> {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const rt = authStorage.getRefreshToken();
    if (!rt) return false;
    try {
      const tokens = await refreshTokenApi(rt);
      authStorage.setTokens({
        access_token: tokens.access_token,
        id_token: tokens.id_token,
        refresh_token: tokens.refresh_token, // Auth0 may rotate it
      });
      scheduleRefresh();
      return true;
    } catch {
      // Endpoint missing (404) or refresh rejected — unrecoverable.
      return false;
    }
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

/** (Re)arm the background timer that refreshes shortly before expiry. */
export function scheduleRefresh() {
  if (typeof window === 'undefined') return;
  if (refreshTimer) clearTimeout(refreshTimer);

  const exp = expiryMs(authStorage.getActiveToken());
  if (exp === null) return; // opaque token — can't schedule; rely on 401 path

  const delay = exp - Date.now() - REFRESH_LEAD_MS;
  if (delay <= 0) {
    // Already past the lead window — try immediately.
    void doRefresh().then((ok) => { if (!ok) fail(); });
    return;
  }
  refreshTimer = setTimeout(() => {
    if (isClientIdle()) {
      // User walked away — stop renewing but don't log out. The next
      // interaction (visibilitychange/API call) refreshes if the session
      // is still alive server-side.
      return;
    }
    void doRefresh().then((ok) => { if (!ok) fail(); });
  }, delay);
}

export function stopScheduledRefresh() {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

/**
 * Ensure a usable access token, refreshing if it is expired/near-expiry.
 * Returns the token (possibly refreshed) or null if unauthenticated.
 * Used by the data API client before each request.
 */
export async function ensureValidToken(): Promise<string | null> {
  const token = authStorage.getActiveToken();
  if (!token) return null;

  const exp = expiryMs(token);
  if (exp === null) return token; // opaque token — assume valid until a 401

  if (Date.now() >= exp - REFRESH_LEAD_MS) {
    const ok = await doRefresh();
    if (ok) return authStorage.getActiveToken();
    // The refresh attempt is a real async gap — another flow (e.g. the OAuth
    // callback page) may have stored fresh tokens meanwhile. Prefer them over
    // declaring the session dead.
    const latest = authStorage.getActiveToken();
    if (latest && latest !== token) {
      const latestExp = expiryMs(latest);
      if (latestExp === null || Date.now() < latestExp - REFRESH_LEAD_MS) return latest;
    }
    return null;
  }
  return token;
}

/** True when the current token is a JWT that has already expired. */
export function isExpired(): boolean {
  const exp = expiryMs(authStorage.getActiveToken());
  return exp !== null && Date.now() >= exp;
}
