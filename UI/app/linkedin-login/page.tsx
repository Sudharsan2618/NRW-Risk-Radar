'use client';
import React from 'react';
import {
  startLinkedInLogin,
  completeLinkedInLogin,
  cancelLinkedInLogin,
  type LinkedInLoginSession,
} from '@/lib/leadFunnelApi';

// Standalone pop-out window for the LinkedIn passwordless login. Opened with
// window.open() from Settings → Integrations → LinkedIn. It starts its own
// Browser Use session (so the opener can call window.open synchronously on the
// click and dodge popup blockers), lets the user log in inside the live browser,
// then — once cookies are captured — shows a thank-you message and auto-closes.
//
// It talks to the opener over a BroadcastChannel so Settings can refresh the
// connection status the moment login succeeds, and can cancel the (billable)
// session if this window is closed before finishing.
const CHANNEL = 'linkedin-auth';
const AUTO_CLOSE_SECS = 10;

type Phase = 'starting' | 'login' | 'done' | 'error';

export default function LinkedInLoginPopup() {
  const [phase, setPhase] = React.useState<Phase>('starting');
  const [session, setSession] = React.useState<LinkedInLoginSession | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [countdown, setCountdown] = React.useState(AUTO_CLOSE_SECS);

  const sessionRef = React.useRef<LinkedInLoginSession | null>(null);
  sessionRef.current = session;
  const doneRef = React.useRef(false); // suppress the cost-guard cancel after success
  const channelRef = React.useRef<BroadcastChannel | null>(null);

  const post = (msg: Record<string, unknown>) => {
    try { channelRef.current?.postMessage(msg); } catch { /* channel unavailable */ }
  };

  // Open the broadcast channel once.
  React.useEffect(() => {
    try { channelRef.current = new BroadcastChannel(CHANNEL); } catch { channelRef.current = null; }
    return () => { try { channelRef.current?.close(); } catch { /* noop */ } };
  }, []);

  // Start the login session as soon as the window opens.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await startLinkedInLogin();
        if (cancelled) { cancelLinkedInLogin(s.sessionId).catch(() => {}); return; }
        setSession(s);
        setPhase('login');
        post({ type: 'linkedin-session', sessionId: s.sessionId });
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : 'Could not open the LinkedIn login window');
          setPhase('error');
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Cost guard: if the window is closed (or navigated away) before the login is
  // completed, stop the billable Browser Use session. Best-effort — mirrors the
  // previous in-page cleanup.
  React.useEffect(() => {
    const cleanup = () => {
      if (doneRef.current) return;
      const s = sessionRef.current;
      if (s) cancelLinkedInLogin(s.sessionId).catch(() => {});
    };
    window.addEventListener('beforeunload', cleanup);
    return () => { window.removeEventListener('beforeunload', cleanup); cleanup(); };
  }, []);

  // Auto-close countdown once login has succeeded.
  React.useEffect(() => {
    if (phase !== 'done') return;
    if (countdown <= 0) { window.close(); return; }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  const finishLogin = async () => {
    if (!session) return;
    setBusy(true); setErr(null);
    try {
      const s = await completeLinkedInLogin(session.sessionId);
      if (!s.connected) {
        // Not finished yet — keep the browser open so the user can complete 2FA etc.
        setErr(s.lastError || 'Login not confirmed yet — finish logging in, then try again.');
        setBusy(false);
        return;
      }
      doneRef.current = true;
      post({ type: 'linkedin-connected' });
      setPhase('done');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not confirm your login yet — finish logging in and try again.');
      setBusy(false);
    }
  };

  const cancel = async () => {
    const s = sessionRef.current;
    doneRef.current = true; // we're cancelling explicitly; skip the unmount re-cancel
    if (s) { try { await cancelLinkedInLogin(s.sessionId); } catch { /* best-effort */ } }
    post({ type: 'linkedin-cancelled' });
    window.close();
  };

  const btnPrimary: React.CSSProperties = { padding: '11px 30px', background: 'linear-gradient(135deg, #0A66C2 0%, #0E7AE5 100%)', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: busy ? 'default' : 'pointer', fontFamily: 'var(--font-sans)', boxShadow: '0 4px 14px rgba(10,102,194,.3)', opacity: busy ? 0.7 : 1 };
  const btnGhost: React.CSSProperties = { padding: '11px 22px', background: '#fff', color: 'var(--color-text-1)', border: '1px solid var(--color-border-2)', borderRadius: '10px', fontSize: '13.5px', fontWeight: 600, cursor: busy ? 'default' : 'pointer', fontFamily: 'var(--font-sans)', opacity: busy ? 0.6 : 1 };

  const liApp = (
    <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'linear-gradient(135deg, #0A66C2 0%, #0E7AE5 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(10,102,194,.25)' }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M6.94 5a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM3.24 8.5h3.5v12h-3.5v-12zm5.6 0h3.36v1.64h.05c.47-.89 1.62-1.83 3.33-1.83 3.56 0 4.22 2.34 4.22 5.39v6.8h-3.5v-6.03c0-1.44-.03-3.29-2-3.29-2 0-2.31 1.57-2.31 3.18v6.14h-3.5v-12h.35z" /></svg>
    </div>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--color-bg, #fff)', fontFamily: 'var(--font-sans)' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 20px', borderBottom: '1px solid var(--color-border, #E5E7EB)', flexShrink: 0 }}>
        {liApp}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-1, #1E1F21)' }}>Connect LinkedIn</div>
          <div style={{ fontSize: '12.5px', color: 'var(--color-text-3, #6B7280)' }}>Secure login — your username and password never reach our servers.</div>
        </div>
      </div>

      {/* body */}
      {phase === 'done' ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '24px', gap: '18px' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--color-success-bg, #E7F6EC)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="34" height="34" viewBox="0 0 20 20" fill="none" stroke="var(--color-success-text, #1B7F3B)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="10" r="8" /><polyline points="6.5,10.5 9,13 13.5,7.5" /></svg>
          </div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text-1, #1E1F21)' }}>Thanks for authenticating!</div>
          <div style={{ fontSize: '14px', color: 'var(--color-text-2, #4B5563)', maxWidth: '380px', lineHeight: 1.55 }}>
            Your LinkedIn account is connected. You can now go back to the site — this window will close automatically in <strong>{countdown}</strong> second{countdown === 1 ? '' : 's'}.
          </div>
          <button onClick={() => window.close()} style={btnGhost}>Close now</button>
        </div>
      ) : phase === 'error' ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '24px', gap: '16px' }}>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-danger-text, #D32F2F)' }}>Couldn’t start the login</div>
          <div style={{ fontSize: '13.5px', color: 'var(--color-text-2, #4B5563)', maxWidth: '360px', lineHeight: 1.5 }}>{err}</div>
          <button onClick={() => window.close()} style={btnGhost}>Close</button>
        </div>
      ) : (
        <>
          <div style={{ padding: '12px 20px', fontSize: '13px', color: 'var(--color-text-2, #4B5563)', lineHeight: 1.5, borderBottom: '1px solid var(--color-border, #E5E7EB)', flexShrink: 0 }}>
            {phase === 'starting'
              ? 'Opening a secure browser…'
              : <>Log into LinkedIn in the window below (complete any 2-factor step). When your feed loads, click <strong>I’ve logged in</strong>.</>}
          </div>
          <div style={{ flex: 1, minHeight: 0, background: '#000', position: 'relative' }}>
            {phase === 'login' && session ? (
              <iframe
                src={`${session.liveUrl}${session.liveUrl.includes('?') ? '&' : '?'}theme=light`}
                title="LinkedIn login"
                allow="autoplay; clipboard-read; clipboard-write"
                style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
              />
            ) : (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '13.5px' }}>
                Loading secure browser…
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 20px', borderTop: '1px solid var(--color-border, #E5E7EB)', flexShrink: 0 }}>
            <button onClick={finishLogin} disabled={busy || phase !== 'login'} style={{ ...btnPrimary, opacity: (busy || phase !== 'login') ? 0.6 : 1 }}>
              {busy ? 'Verifying…' : 'I’ve logged in'}
            </button>
            <button onClick={cancel} disabled={busy} style={btnGhost}>Cancel</button>
            {err && <span style={{ fontSize: '12.5px', color: 'var(--color-warning-text, #B7791F)', lineHeight: 1.4 }}>{err}</span>}
          </div>
        </>
      )}
    </div>
  );
}
