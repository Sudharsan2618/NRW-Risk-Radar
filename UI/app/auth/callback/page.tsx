'use client';

import React, { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createInternalUser, exchangeMicrosoftCode } from '@/lib/authApi';
import { authStorage } from '@/lib/authStorage';
import type { User } from '@/lib/authTypes';

interface AzurePrincipal {
  clientPrincipal: {
    userId: string;
    userDetails: string;
    userRoles: string[];
    identityProvider: string;
    claims?: Array<{ typ: string; val: string }>;
  } | null;
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)' }}>
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>{children}</div>
    </div>
  );
}

function Spinner() {
  return (
    <div
      style={{ width: '32px', height: '32px', borderRadius: '50%', border: '3px solid var(--color-border)', borderBottomColor: 'var(--color-brand)', animation: 'spin 0.8s linear infinite' }}
    />
  );
}

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const run = async () => {
      try {
        const sanitizedDest = () => {
          const raw = searchParams.get('redirect') || '/dashboard';
          try {
            // Accept only same-origin relative destinations.
            const u = new URL(raw, window.location.origin);
            if (u.origin === window.location.origin && u.pathname !== '/auth/callback') {
              return u.pathname + u.search;
            }
          } catch {
            /* fall back */
          }
          return '/dashboard';
        };

        // 1) One-time login code (backend OAuth flow — tokens never in URLs).
        const code = searchParams.get('code');
        if (code) {
          const tokens = await exchangeMicrosoftCode(code);
          // Clean slate: stale tokens/users from a previous session must not
          // survive alongside the fresh ones.
          authStorage.clear();
          authStorage.setTokens(tokens);
          window.location.href = sanitizedDest();
          return;
        }

        // 2) Legacy: tokens in query parameters (older backend during rollout).
        const access_token = searchParams.get('access_token');
        const id_token = searchParams.get('id_token');
        const refresh_token = searchParams.get('refresh_token');

        if (access_token || id_token) {
          authStorage.clear();
          authStorage.setTokens({ access_token, id_token, refresh_token });
          window.location.href = sanitizedDest();
          return;
        }

        // 3) Fallback to SWA proprietary flow
        const resp = await fetch('/.auth/me');
        if (!resp.ok) throw new Error('Failed to fetch user information');
        const data: AzurePrincipal = await resp.json();

        if (!data.clientPrincipal) {
          router.replace('/login');
          return;
        }

        let email = data.clientPrincipal.userDetails;
        let name = data.clientPrincipal.userDetails;
        for (const claim of data.clientPrincipal.claims || []) {
          if (claim.typ === 'preferred_username' || claim.typ === 'email') email = claim.val;
          if (claim.typ === 'name') name = claim.val;
        }

        const dbUser = await createInternalUser(email, name);

        const user: User = {
          id: dbUser?.id || data.clientPrincipal.userId,
          email,
          name,
          username: email.split('@')[0],
          identityProvider: data.clientPrincipal.identityProvider,
          role: dbUser?.role || 'internal',
          auth_provider: dbUser?.auth_provider || 'entra',
        };
        authStorage.setUser(user);
        if (dbUser) authStorage.setDbUser(dbUser);

        // Hard navigation so the AuthProvider re-hydrates from storage on a
        // fresh mount (Azure sessions have no JWT for the context to pick up
        // via a client-side transition). A relative path avoids redirect loops.
        const raw = searchParams.get('redirect') || '/dashboard';
        let dest = '/dashboard';
        try {
          // Accept only same-origin relative destinations.
          const u = new URL(raw, window.location.origin);
          if (u.origin === window.location.origin && u.pathname !== '/auth/callback') {
            dest = u.pathname + u.search;
          }
        } catch {
          /* fall back to /dashboard */
        }
        window.location.href = dest;
      } catch {
        setError('Failed to authenticate. Redirecting to sign in…');
        setTimeout(() => router.replace('/login'), 2500);
      }
    };
    void run();
  }, [router, searchParams]);

  return (
    <Centered>
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      {error ? (
        <p style={{ color: 'var(--color-danger)', fontSize: '14px' }}>{error}</p>
      ) : (
        <>
          <Spinner />
          <p style={{ color: 'var(--color-text-2)', fontSize: '14px' }}>Completing sign in…</p>
        </>
      )}
    </Centered>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<Centered><Spinner /></Centered>}>
      <CallbackContent />
    </Suspense>
  );
}
