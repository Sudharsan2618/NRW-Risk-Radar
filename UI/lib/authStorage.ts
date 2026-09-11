'use client';

// ──────────────────────────────────────────────────────────────────────────
// Single source of truth for where auth tokens & the cached user live.
// Everything in the app reads/writes tokens through here so the underlying
// storage mechanism is swappable in one place.
//
//   access_token / id_token  → sessionStorage (cleared when the tab closes)
//   refresh_token            → localStorage   (survives reload so silent
//                              refresh can run; see the XSS tradeoff note in
//                              the plan — httpOnly cookies are the hardening
//                              follow-up)
//   azureUser / dbUser       → sessionStorage (cached profile; key names kept
//                              identical to the legacy Agent-Hub app so the
//                              Azure AD callback interoperates)
// ──────────────────────────────────────────────────────────────────────────

import type { DbUser, User } from './authTypes';

const ACCESS_TOKEN = 'auth_token';
const ID_TOKEN = 'id_token';
const REFRESH_TOKEN = 'refresh_token';

/** localStorage key of the refresh token — exported so the AuthContext can
 *  watch cross-tab `storage` events for login/logout in other tabs. */
export const REFRESH_TOKEN_STORAGE_KEY = REFRESH_TOKEN;
const USER = 'azureUser';
const DB_USER = 'dbUser';

const hasWindow = () => typeof window !== 'undefined';

function readSession(key: string): string | null {
  if (!hasWindow()) return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function readLocal(key: string): string | null {
  if (!hasWindow()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export const authStorage = {
  getAccessToken: () => readSession(ACCESS_TOKEN),
  getIdToken: () => readSession(ID_TOKEN),
  getRefreshToken: () => readLocal(REFRESH_TOKEN),

  /** The token used for Authorization headers — prefer the id_token (carries
   *  user claims), fall back to the access_token. */
  getActiveToken(): string | null {
    return this.getIdToken() || this.getAccessToken();
  },

  setTokens(tokens: { access_token?: string | null; id_token?: string | null; refresh_token?: string | null }) {
    if (!hasWindow()) return;
    try {
      if (tokens.access_token) window.sessionStorage.setItem(ACCESS_TOKEN, tokens.access_token);
      if (tokens.id_token) window.sessionStorage.setItem(ID_TOKEN, tokens.id_token);
      if (tokens.refresh_token) window.localStorage.setItem(REFRESH_TOKEN, tokens.refresh_token);
    } catch {
      /* storage may be unavailable (private mode / quota) — fail soft */
    }
  },

  getUser(): User | null {
    const raw = readSession(USER);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  },

  setUser(user: User) {
    if (!hasWindow()) return;
    try {
      window.sessionStorage.setItem(USER, JSON.stringify(user));
    } catch {
      /* fail soft */
    }
  },

  getDbUser(): DbUser | null {
    const raw = readSession(DB_USER);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as DbUser;
    } catch {
      return null;
    }
  },

  setDbUser(dbUser: DbUser) {
    if (!hasWindow()) return;
    try {
      window.sessionStorage.setItem(DB_USER, JSON.stringify(dbUser));
    } catch {
      /* fail soft */
    }
  },

  /** Wipe every auth artifact. Called on logout and on unrecoverable refresh failure. */
  clear() {
    if (!hasWindow()) return;
    try {
      window.sessionStorage.removeItem(ACCESS_TOKEN);
      window.sessionStorage.removeItem(ID_TOKEN);
      window.sessionStorage.removeItem(USER);
      window.sessionStorage.removeItem(DB_USER);
      window.localStorage.removeItem(REFRESH_TOKEN);
    } catch {
      /* fail soft */
    }
  },
};
