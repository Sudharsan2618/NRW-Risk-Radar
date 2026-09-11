'use client';
import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Client-side route guard for the authenticated app. While auth state is
 * resolving it shows a spinner; if there is no session it redirects to
 * /login (preserving where the user was headed). Wraps AppShell, so every
 * page rendered through the shell is protected, while /login, /signup and
 * /auth/callback (which don't use the shell) stay public.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const target = pathname && pathname !== '/' ? `?redirect=${encodeURIComponent(pathname)}` : '';
      router.replace(`/login${target}`);
    }
  }, [isLoading, isAuthenticated, pathname, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)' }}>
        <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
        <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '3px solid var(--color-border)', borderBottomColor: 'var(--color-brand)', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  return <>{children}</>;
}
