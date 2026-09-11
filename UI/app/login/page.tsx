'use client';
import React, { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { sendOtp, verifyOtp, AuthApiError, API_BASE } from '@/lib/authApi';
import { AuthNotice } from '@/components/auth/AuthNotice';

function MicrosoftMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <rect x="0" y="0" width="7.2" height="7.2" fill="#F25022" />
      <rect x="8.8" y="0" width="7.2" height="7.2" fill="#7FBA00" />
      <rect x="0" y="8.8" width="7.2" height="7.2" fill="#00A4EF" />
      <rect x="8.8" y="8.8" width="7.2" height="7.2" fill="#FFB900" />
    </svg>
  );
}

function MicrosoftButton() {
  const [hov, setHov] = React.useState(false);
  const searchParams = useSearchParams();
  const onClick = () => {
    const redirectParam = searchParams.get('redirect');
    const callbackUrl = window.location.origin + '/auth/callback' + (redirectParam ? `?redirect=${encodeURIComponent(redirectParam)}` : '');
    window.location.href = `${API_BASE}/api/auth/microsoft/login?post_login_redirect_uri=${encodeURIComponent(callbackUrl)}`;
  };
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
        height: '50px', borderRadius: 'var(--radius-md)',
        border: `1px solid ${hov ? 'var(--color-border-2)' : 'var(--color-border)'}`,
        background: hov ? 'var(--color-surface)' : 'var(--color-bg)',
        cursor: 'pointer', fontSize: '14px', fontWeight: 600, color: 'var(--color-text-1)',
        fontFamily: 'inherit', transition: 'background .12s, border-color .12s',
      }}
    >
      <MicrosoftMark />
      Microsoft (Internal)
    </button>
  );
}

const inputStyle = (focused: boolean, disabled = false): React.CSSProperties => ({
  width: '100%', height: '52px', padding: '0 16px',
  fontSize: '15px', color: 'var(--color-text-1)', fontFamily: 'inherit',
  borderRadius: 'var(--radius-md)', outline: 'none',
  background: disabled ? 'var(--color-surface)' : 'var(--color-bg)',
  border: `1.5px solid ${focused ? 'var(--color-brand)' : 'var(--color-border-2)'}`,
  boxShadow: focused ? 'var(--shadow-focus)' : 'none',
  transition: 'border-color .12s, box-shadow .12s', boxSizing: 'border-box',
});

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading, login } = useAuth();

  const [email, setEmail] = React.useState('');
  const [otp, setOtp] = React.useState('');
  const [showOtp, setShowOtp] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<React.ReactNode>(null);
  const [focused, setFocused] = React.useState<string | null>(null);

  // Send authenticated users straight to where they were headed.
  React.useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace(searchParams.get('redirect') || '/dashboard');
    }
  }, [isLoading, isAuthenticated, router, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (!showOtp) {
        await sendOtp(email.trim());
        setShowOtp(true);
      } else {
        const tokens = await verifyOtp(email.trim(), otp.trim());
        await login(tokens, email.trim()); // hard-redirects to /dashboard
      }
    } catch (err) {
      if (err instanceof AuthApiError && err.status === 404) {
        setError(
          <span>
            No account found for this email.{' '}
            <Link href="/signup" style={{ color: 'var(--color-danger)', textDecoration: 'underline' }}>
              Sign up
            </Link>{' '}
            with your invitation first.
          </span>,
        );
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  const label = busy
    ? showOtp ? 'Verifying…' : 'Sending code…'
    : showOtp ? 'Verify & Sign In' : 'Get Login Code';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 24px' }}>
      <div style={{ width: '100%', maxWidth: '1100px', display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
        <img src="/logo.png" alt="Swarion" style={{ height: '44px', width: 'auto', objectFit: 'contain' }} />
      </div>

      <div style={{ flex: 1, width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingBottom: '8vh' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '32px', fontWeight: 700, color: 'var(--color-text-1)', margin: 0, letterSpacing: '-0.5px' }}>
            Welcome back
          </h1>
          <p style={{ fontSize: '16px', color: 'var(--color-text-2)', margin: '10px 0 0' }}>
            Sign in with a one-time code sent to your email
          </p>
        </div>

        {error && <div style={{ marginBottom: '16px' }}><AuthNotice tone="error">{error}</AuthNotice></div>}

        <form onSubmit={handleSubmit}>
          <label htmlFor="login-email" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-2)', marginBottom: '8px' }}>
            Email address
          </label>
          <input
            id="login-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            disabled={showOtp}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={() => setFocused('email')}
            onBlur={() => setFocused(null)}
            placeholder="you@company.com"
            style={inputStyle(focused === 'email', showOtp)}
          />

          {showOtp && (
            <div style={{ marginTop: '18px' }}>
              <label htmlFor="login-otp" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-2)', marginBottom: '8px' }}>
                One-time passcode
              </label>
              <input
                id="login-otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                onFocus={() => setFocused('otp')}
                onBlur={() => setFocused(null)}
                placeholder="123456"
                style={{ ...inputStyle(focused === 'otp'), letterSpacing: '0.3em' }}
                autoFocus
              />
              <p style={{ fontSize: '12.5px', color: 'var(--color-text-3)', margin: '8px 0 0' }}>
                Code sent to {email}.{' '}
                <button
                  type="button"
                  onClick={() => { setShowOtp(false); setOtp(''); setError(null); }}
                  style={{ background: 'none', border: 'none', padding: 0, color: 'var(--color-brand)', cursor: 'pointer', fontWeight: 600, fontFamily: 'inherit', fontSize: '12.5px' }}
                >
                  Use a different email
                </button>
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            style={{
              width: '100%', height: '52px', marginTop: '20px',
              borderRadius: 'var(--radius-md)', border: 'none',
              cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1,
              background: 'var(--color-brand)', color: '#fff', fontSize: '16px', fontWeight: 600,
              fontFamily: 'inherit', transition: 'background .12s',
            }}
          >
            {label}
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', margin: '24px 0' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-3)', letterSpacing: '.5px' }}>OR</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--color-border)' }} />
        </div>

        <MicrosoftButton />

        <p style={{ fontSize: '13.5px', color: 'var(--color-text-2)', textAlign: 'center', marginTop: '28px' }}>
          Have an invitation?{' '}
          <Link href="/signup" style={{ color: 'var(--color-brand)', fontWeight: 600, textDecoration: 'none' }}>
            Create your account
          </Link>
        </p>
        <p style={{ fontSize: '13.5px', color: 'var(--color-text-2)', textAlign: 'center', marginTop: '8px' }}>
          Don&apos;t Have an invitation?{' '}
          <a
            href="https://agamxts.com/work-with-us/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--color-brand)', fontWeight: 600, textDecoration: 'none' }}
          >
            Contact Us
          </a>
        </p>

        <p style={{ fontSize: '12.5px', color: 'var(--color-text-3)', textAlign: 'center', marginTop: '20px', lineHeight: 1.5 }}>
          By continuing, you agree to AgamX&apos;s{' '}
          <a
            href="https://agamxts.com/wp-content/uploads/2025/10/Terms-of-Service.pdf"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--color-text-2)', textDecoration: 'underline' }}
          >
            Terms of Service
          </a>{' '}
          and{' '}
          <a
            href="https://agamxts.com/privacy-policy/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--color-text-2)', textDecoration: 'underline' }}
          >
            Privacy Policy
          </a>
          .
        </p>

        <div style={{ textAlign: 'center', marginTop: '28px', lineHeight: 1.6 }}>
          <p style={{ fontSize: '12px', color: 'var(--color-text-3)', margin: 0 }}>
            Copyright © 2025 Project Swarion — All Rights Reserved.
          </p>
          <p style={{ fontSize: '12px', color: 'var(--color-text-3)', margin: '4px 0 0' }}>
            Swarion AI is a product of Agamx Technology Solutions GmbH, Cologne, Germany.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
