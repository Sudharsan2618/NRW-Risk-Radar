'use client';
import React, { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { verifyToken, register, AuthApiError } from '@/lib/authApi';
import { AuthNotice } from '@/components/auth/AuthNotice';

const inputStyle = (focused: boolean): React.CSSProperties => ({
  width: '100%', height: '48px', padding: '0 14px',
  fontSize: '15px', color: 'var(--color-text-1)', fontFamily: 'inherit',
  borderRadius: 'var(--radius-md)', outline: 'none', background: 'var(--color-bg)',
  border: `1.5px solid ${focused ? 'var(--color-brand)' : 'var(--color-border-2)'}`,
  boxShadow: focused ? 'var(--shadow-focus)' : 'none',
  transition: 'border-color .12s, box-shadow .12s', boxSizing: 'border-box',
});

function Field({
  id, label, value, onChange, type = 'text', placeholder, focusedId, setFocusedId, required = true, disabled = false,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void; type?: string;
  placeholder?: string; focusedId: string | null; setFocusedId: (v: string | null) => void; required?: boolean; disabled?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-2)', marginBottom: '6px' }}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        required={required}
        disabled={disabled}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocusedId(id)}
        onBlur={() => setFocusedId(null)}
        style={{ ...inputStyle(focusedId === id), ...(disabled ? { background: 'var(--color-surface)', color: 'var(--color-text-2)' } : null) }}
      />
    </div>
  );
}

const submitBtn = (busy: boolean): React.CSSProperties => ({
  width: '100%', height: '50px', marginTop: '8px',
  borderRadius: 'var(--radius-md)', border: 'none',
  cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.7 : 1,
  background: 'var(--color-brand)', color: '#fff', fontSize: '15px', fontWeight: 600,
  fontFamily: 'inherit', transition: 'background .12s',
});

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = React.useState<1 | 2>(1);
  const [email, setEmail] = React.useState(searchParams.get('email') || '');
  const [token, setToken] = React.useState(searchParams.get('token') || '');
  const [form, setForm] = React.useState({ firstName: '', lastName: '', company: '', designation: '', location: '' });

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);
  const [focusedId, setFocusedId] = React.useState<string | null>(null);

  const setField = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await verifyToken(email.trim(), token.trim());
      if (res.valid) setStep(2);
      else setError('The invitation token is invalid or expired. Please check your email.');
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : 'Unable to verify the token. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await register({ email: email.trim(), token: token.trim(), ...form });
      setDone(true);
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : 'Unable to complete registration. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 24px' }}>
      <div style={{ width: '100%', maxWidth: '1100px', display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
        <img src="/logo.png" alt="Swarion" style={{ height: '44px', width: 'auto', objectFit: 'contain' }} />
      </div>

      <div style={{ flex: 1, width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingBottom: '6vh' }}>
        {done ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ margin: '0 auto 16px', height: '56px', width: '56px', borderRadius: '50%', background: 'rgba(90, 200, 124, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <h1 style={{ fontSize: '26px', fontWeight: 700, color: 'var(--color-text-1)', margin: 0 }}>You&apos;re all set</h1>
            <p style={{ fontSize: '15px', color: 'var(--color-text-2)', margin: '12px 0 24px', lineHeight: 1.5 }}>
              Your account has been created. Sign in with your email to get started.
            </p>
            <button style={submitBtn(false)} onClick={() => router.push('/login')}>Go to sign in</button>
          </div>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <h1 style={{ fontSize: '30px', fontWeight: 700, color: 'var(--color-text-1)', margin: 0, letterSpacing: '-0.5px' }}>
                {step === 1 ? 'Verify your invitation' : 'Complete your profile'}
              </h1>
              <p style={{ fontSize: '15px', color: 'var(--color-text-2)', margin: '10px 0 0' }}>
                {step === 1
                  ? 'Enter your email and the invitation token you received.'
                  : <>Setting up the account for <strong style={{ color: 'var(--color-text-1)' }}>{email}</strong></>}
              </p>
            </div>

            {error && <div style={{ marginBottom: '16px' }}><AuthNotice tone="error">{error}</AuthNotice></div>}

            {step === 1 ? (
              <form onSubmit={handleVerify} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <Field id="su-email" label="Email address" type="email" value={email} onChange={setEmail} placeholder="you@company.com" focusedId={focusedId} setFocusedId={setFocusedId} />
                <Field id="su-token" label="Invitation token" value={token} onChange={setToken} placeholder="Paste your token" focusedId={focusedId} setFocusedId={setFocusedId} />
                <button type="submit" disabled={busy} style={submitBtn(busy)}>{busy ? 'Verifying…' : 'Verify token'}</button>
              </form>
            ) : (
              <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <Field id="su-first" label="First name" value={form.firstName} onChange={setField('firstName')} placeholder="John" focusedId={focusedId} setFocusedId={setFocusedId} />
                  <Field id="su-last" label="Last name" value={form.lastName} onChange={setField('lastName')} placeholder="Doe" focusedId={focusedId} setFocusedId={setFocusedId} />
                </div>
                <Field id="su-company" label="Company" value={form.company} onChange={setField('company')} placeholder="Acme Corp" focusedId={focusedId} setFocusedId={setFocusedId} />
                <Field id="su-designation" label="Designation" value={form.designation} onChange={setField('designation')} placeholder="Product Manager" focusedId={focusedId} setFocusedId={setFocusedId} />
                <Field id="su-location" label="Location" value={form.location} onChange={setField('location')} placeholder="New York, USA" focusedId={focusedId} setFocusedId={setFocusedId} />
                <button type="submit" disabled={busy} style={submitBtn(busy)}>{busy ? 'Creating account…' : 'Complete registration'}</button>
              </form>
            )}

            <p style={{ fontSize: '13.5px', color: 'var(--color-text-2)', textAlign: 'center', marginTop: '24px' }}>
              Already have an account?{' '}
              <Link href="/login" style={{ color: 'var(--color-brand)', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupContent />
    </Suspense>
  );
}
