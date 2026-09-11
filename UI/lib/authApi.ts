'use client';

// ──────────────────────────────────────────────────────────────────────────
// Auth API client. Talks to the Agent-Hub FastAPI backend.
//
// NOTE: auth endpoints live directly under /api/auth and /api/me — they are
// NOT under the /api/v1 prefix that lib/hrApi.ts uses for HR data routes.
// ──────────────────────────────────────────────────────────────────────────

import type { DbUser, TokenResponse } from './authTypes';

export const API_BASE = process.env.NEXT_PUBLIC_AGENT_API || 'http://localhost:8000';

/**
 * Normalized auth error. `isNetwork` distinguishes a failed-to-reach-server
 * situation (fetch threw) from a server-returned error (4xx/5xx with a body),
 * so the UI can show "Unable to connect" vs the backend's own message.
 */
export class AuthApiError extends Error {
  status: number;
  isNetwork: boolean;
  constructor(message: string, status = 0, isNetwork = false) {
    super(message);
    this.name = 'AuthApiError';
    this.status = status;
    this.isNetwork = isNetwork;
  }
}

async function authRequest<T>(path: string, body: unknown): Promise<T> {
  let resp: Response;
  try {
    resp = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AuthApiError('Unable to connect to the server. Please check your connection and try again.', 0, true);
  }

  let data: any = null;
  try {
    data = await resp.json();
  } catch {
    /* some responses (or proxies) may not return JSON */
  }

  if (!resp.ok) {
    const detail =
      (data && (typeof data.detail === 'string' ? data.detail : data.detail && JSON.stringify(data.detail))) ||
      (data && data.message) ||
      `Request failed (${resp.status})`;
    throw new AuthApiError(detail, resp.status, false);
  }

  return data as T;
}

// ── Passwordless email OTP ─────────────────────────────────────────────────

export function sendOtp(email: string) {
  return authRequest<{ success: boolean; message: string }>('/api/auth/send-otp', { email });
}

export function verifyOtp(email: string, otp: string) {
  return authRequest<TokenResponse>('/api/auth/verify-otp', { email, otp });
}

// ── Invite-based registration ──────────────────────────────────────────────

export function verifyToken(email: string, token: string) {
  return authRequest<{ valid: boolean }>('/api/auth/verify-token', { email, token });
}

export interface RegisterPayload {
  email: string;
  token: string;
  firstName: string;
  lastName: string;
  company: string;
  designation: string;
  location: string;
}

export function register(payload: RegisterPayload) {
  return authRequest<{ success: boolean; user: unknown }>('/api/auth/register', payload);
}

// ── Microsoft login handoff ────────────────────────────────────────────────
// The OAuth callback redirects with a single-use short-lived code instead of
// tokens (tokens never appear in URLs). This swaps it for the session tokens.

export function exchangeMicrosoftCode(code: string) {
  return authRequest<TokenResponse>('/api/auth/microsoft/exchange', { code });
}

// ── Token refresh ──────────────────────────────────────────────────────────
// Rotates the refresh token server-side; reuse of a rotated token revokes
// the whole session (theft detection).

export function refreshToken(refresh_token: string) {
  return authRequest<TokenResponse>('/api/auth/refresh', { refresh_token });
}

// ── Server-side logout ─────────────────────────────────────────────────────
// Revokes the session so the tokens are dead even if a copy was exfiltrated.
// Best-effort: local sign-out proceeds regardless.

export async function revokeSessionOnServer(refresh_token: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token }),
      keepalive: true, // survives page navigation right after logout
    });
  } catch {
    /* best-effort */
  }
}

// ── Active sessions (devices) ──────────────────────────────────────────────

export interface DeviceSession {
  id: string;
  userAgent: string;
  ipAddress: string;
  createdAt: string | null;
  lastSeenAt: string | null;
  expiresAt: string | null;
  isCurrent: boolean;
}

export async function fetchSessions(token: string): Promise<DeviceSession[]> {
  const resp = await fetch(`${API_BASE}/api/auth/sessions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new AuthApiError(`Failed to load sessions (${resp.status})`, resp.status);
  const data = await resp.json();
  return (data.sessions || []) as DeviceSession[];
}

export async function revokeSession(token: string, sessionId: string): Promise<void> {
  const resp = await fetch(`${API_BASE}/api/auth/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new AuthApiError(`Failed to sign out device (${resp.status})`, resp.status);
}

export async function revokeAllOtherSessions(token: string): Promise<void> {
  const resp = await fetch(`${API_BASE}/api/auth/sessions/revoke-all`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new AuthApiError(`Failed to sign out other devices (${resp.status})`, resp.status);
}

// ── Profile ────────────────────────────────────────────────────────────────

export async function getMe(token: string, email?: string): Promise<DbUser | null> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  // Email fallback header: the backend's get_current_user() uses X-User-Email
  // when the access_token has no email claim (common with Auth0 passwordless).
  if (email) headers['X-User-Email'] = email;

  let resp: Response;
  try {
    resp = await fetch(`${API_BASE}/api/me`, { method: 'GET', headers });
  } catch {
    return null; // network error — caller keeps whatever it already has
  }
  if (!resp.ok) return null;
  try {
    return (await resp.json()) as DbUser;
  } catch {
    return null;
  }
}

/** Create-or-get the backend user for an Azure AD / Entra principal. */
export async function createInternalUser(email: string, name?: string): Promise<DbUser | null> {
  let resp: Response;
  try {
    resp = await fetch(`${API_BASE}/api/auth/internal-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name: name || email }),
      credentials: 'include',
    });
  } catch {
    return null;
  }
  if (!resp.ok) return null;
  try {
    return (await resp.json()) as DbUser;
  } catch {
    return null;
  }
}
