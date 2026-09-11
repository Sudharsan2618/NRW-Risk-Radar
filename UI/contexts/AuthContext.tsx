'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { authStorage, REFRESH_TOKEN_STORAGE_KEY } from '@/lib/authStorage';
import { createInternalUser, getMe, revokeSessionOnServer } from '@/lib/authApi';
import {
  decodeJwt,
  doRefresh,
  ensureValidToken,
  installActivityTracking,
  scheduleRefresh,
  setOnLogout,
  stopScheduledRefresh,
} from '@/lib/tokenManager';
import type { DbUser, TokenResponse, User } from '@/lib/authTypes';

interface AuthContextType {
  user: User | null;
  dbUser: DbUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** Complete an OTP login: persist tokens, hydrate the profile, redirect. */
  login: (tokens: TokenResponse, emailHint?: string) => Promise<void>;
  logout: () => void;
  getAccessToken: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Build a frontend User from a decoded JWT payload (Auth0 / Entra claims). */
function userFromJwt(payload: Record<string, any>, emailHint?: string): User {
  const email =
    payload.email ||
    payload['https://agamx-api/email'] ||
    payload['https://agamxts-api/email'] ||
    payload.preferred_username ||
    payload.upn ||
    payload.unique_name ||
    emailHint ||
    '';
  return {
    id: payload.sub || payload.user_id || '',
    email,
    name: payload.name || payload['https://agamx-api/name'] || (email ? email.split('@')[0] : ''),
    username: (email || '').split('@')[0],
    companyName: payload['https://agamx-api/company'] || payload.company,
    location: payload['https://agamx-api/location'] || payload.location,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [dbUser, setDbUser] = useState<DbUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const initialized = useRef(false);

  const getAccessToken = useCallback(() => authStorage.getActiveToken(), []);

  const logout = useCallback(() => {
    stopScheduledRefresh();
    const isAzure = !authStorage.getActiveToken() && !!authStorage.getUser()?.identityProvider;
    // Revoke the session server-side (best-effort, fire-and-forget) so the
    // tokens are dead everywhere, then clear local state.
    const rt = authStorage.getRefreshToken();
    if (rt) void revokeSessionOnServer(rt);
    authStorage.clear();
    setUser(null);
    setDbUser(null);
    if (typeof window === 'undefined') return;

    if (isAzure) {
      // Azure Static Web Apps logout (handled by the dev mock locally).
      const redirect = `${window.location.origin}/login`;
      window.location.href = `/.auth/logout?post_logout_redirect_uri=${encodeURIComponent(redirect)}`;
    } else {
      window.location.href = '/login';
    }
  }, []);

  // Let a failed silent refresh tear down React state via this same logout.
  useEffect(() => {
    setOnLogout(logout);
    return () => setOnLogout(null);
  }, [logout]);

  // Cross-tab sync: the shared refresh token (localStorage) is the signal.
  // Removed in another tab → sign this tab out too. Appearing while this tab
  // is signed out → reload so hydration adopts the new session.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== REFRESH_TOKEN_STORAGE_KEY) return;
      if (e.newValue === null) {
        // Another tab logged out. Tear down locally without re-revoking.
        stopScheduledRefresh();
        authStorage.clear();
        setUser(null);
        setDbUser(null);
        const p = window.location.pathname;
        const isPublic = p.startsWith('/login') || p.startsWith('/signup') || p.startsWith('/auth');
        if (!isPublic) window.location.href = '/login';
      } else if (!e.oldValue && !authStorage.getActiveToken()) {
        // Another tab just logged in and this tab has no session — adopt it.
        window.location.reload();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Hydrate session on first mount.
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // The OAuth callback page owns session setup and always hard-navigates
    // away once tokens are stored. Hydrating here races its token writes: a
    // stale expired token can send hydrate down the async refresh path, and
    // its failure cleanup (authStorage.clear) then wipes the fresh Microsoft
    // tokens the callback just wrote — bouncing the user back to /login.
    // Stay inert on that route; the destination page hydrates from storage.
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/auth/callback')) {
      setIsLoading(false);
      return;
    }

    installActivityTracking();

    const hydrate = async () => {
      try {
        // 1) Token-based session — the only path that carries a JWT.
        let token = await ensureValidToken();

        // New-tab adoption: access tokens are per-tab (sessionStorage), but
        // the refresh token is shared (localStorage). A fresh tab with no
        // access token can silently join the existing session.
        if (!token && authStorage.getRefreshToken()) {
          const ok = await doRefresh();
          if (ok) token = authStorage.getActiveToken();
        }
        if (token) {
          const payload = decodeJwt(token);
          let current: User;
          if (payload) {
            current = userFromJwt(payload);
          } else {
            // Opaque token — restore cached user if present.
            current = authStorage.getUser() || { id: '', email: '' };
          }
          setUser(current);
          authStorage.setUser(current);
          scheduleRefresh();

          // Enrich with the DB profile (also auto-creates internal users).
          const profile = await getMe(token, current.email);
          if (profile) {
            setDbUser(profile);
            authStorage.setDbUser(profile);
            const enriched: User = { ...current, id: profile.id, role: profile.role, auth_provider: profile.auth_provider };
            setUser(enriched);
            authStorage.setUser(enriched);
          }
          return;
        }

        // 2) Azure AD session — no JWT; the callback page cached azureUser/dbUser.
        const cached = authStorage.getUser();
        if (cached && cached.id && cached.email) {
          setUser(cached);
          const cachedDb = authStorage.getDbUser();
          if (cachedDb) setDbUser(cachedDb);
          return;
        }

        // 3) Nothing valid.
        authStorage.clear();
        setUser(null);
        setDbUser(null);
      } catch {
        authStorage.clear();
        setUser(null);
        setDbUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    void hydrate();
  }, []);

  const login = useCallback(async (tokens: TokenResponse, emailHint?: string) => {
    authStorage.setTokens(tokens);
    const active = authStorage.getActiveToken();
    const payload = decodeJwt(active);
    const newUser = payload ? userFromJwt(payload, emailHint) : { id: '', email: emailHint || '', name: emailHint?.split('@')[0], username: emailHint?.split('@')[0] };

    setUser(newUser);
    authStorage.setUser(newUser);
    scheduleRefresh();

    // Best-effort profile hydration before navigating.
    const profile = active ? await getMe(active, newUser.email) : null;
    if (profile) {
      setDbUser(profile);
      authStorage.setDbUser(profile);
      const enriched: User = { ...newUser, id: profile.id, role: profile.role, auth_provider: profile.auth_provider };
      authStorage.setUser(enriched);
    }

    // Hard redirect avoids SPA races with the just-written session storage.
    if (typeof window !== 'undefined') window.location.href = '/dashboard';
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, dbUser, isLoading, isAuthenticated: !!user, login, logout, getAccessToken }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

// Re-export the public Azure-user creation helper for the callback page.
export { createInternalUser };
