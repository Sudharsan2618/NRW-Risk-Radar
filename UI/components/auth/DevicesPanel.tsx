'use client';
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { fetchSessions, revokeSession, revokeAllOtherSessions, type DeviceSession } from '@/lib/authApi';

/** Friendly "Chrome on Windows" style label from a raw user-agent string. */
function describeDevice(ua: string): string {
  const browser =
    /Edg\//.test(ua) ? 'Edge' :
    /OPR\//.test(ua) ? 'Opera' :
    /Chrome\//.test(ua) ? 'Chrome' :
    /Firefox\//.test(ua) ? 'Firefox' :
    /Safari\//.test(ua) ? 'Safari' :
    'Browser';
  const os =
    /Windows NT/.test(ua) ? 'Windows' :
    /iPhone|iPad/.test(ua) ? 'iOS' :
    /Mac OS X/.test(ua) ? 'macOS' :
    /Android/.test(ua) ? 'Android' :
    /Linux/.test(ua) ? 'Linux' :
    'Unknown OS';
  return `${browser} on ${os}`;
}

function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function DeviceIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
      <rect x="2" y="3" width="14" height="10" rx="1.5" />
      <line x1="6" y1="16" x2="12" y2="16" />
      <line x1="9" y1="13" x2="9" y2="16" />
    </svg>
  );
}

export function DevicesPanel({ onToast }: { onToast: (m: string) => void }) {
  const { getAccessToken, logout } = useAuth();
  const [sessions, setSessions] = React.useState<DeviceSession[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    const token = getAccessToken();
    if (!token) { setError('Sign in again to manage devices.'); return; }
    try {
      setError(null);
      setSessions(await fetchSessions(token));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sessions');
    }
  }, [getAccessToken]);

  React.useEffect(() => { void load(); }, [load]);

  const signOutDevice = async (s: DeviceSession) => {
    const token = getAccessToken();
    if (!token) return;
    setBusyId(s.id);
    try {
      await revokeSession(token, s.id);
      if (s.isCurrent) { logout(); return; }
      onToast('Device signed out');
      await load();
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Failed to sign out device');
    } finally {
      setBusyId(null);
    }
  };

  const signOutOthers = async () => {
    const token = getAccessToken();
    if (!token) return;
    setBusyId('all');
    try {
      await revokeAllOtherSessions(token);
      onToast('Signed out everywhere else');
      await load();
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Failed to sign out other devices');
    } finally {
      setBusyId(null);
    }
  };

  const others = (sessions || []).filter((s) => !s.isCurrent);

  return (
    <div>
      <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: '6px' }}>Devices</div>
      <div style={{ fontSize: '13.5px', color: 'var(--color-text-2)', marginBottom: '28px', lineHeight: 1.5 }}>
        These are the devices currently signed in to your account. Sign out any session you don&apos;t recognize.
      </div>

      <div style={{ background: '#fff', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', marginBottom: '16px' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-1)' }}>Active Sessions</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-2)', marginTop: '2px' }}>Signing out a device takes effect within a minute.</div>
          </div>
          {others.length > 0 && (
            <button
              onClick={signOutOthers}
              disabled={busyId === 'all'}
              style={{ padding: '5px 12px', background: 'none', border: '1px solid var(--color-danger-border, var(--color-border-2))', color: 'var(--color-danger)', borderRadius: 'var(--radius-md)', fontSize: '12.5px', fontWeight: 600, cursor: busyId === 'all' ? 'wait' : 'pointer', fontFamily: 'var(--font-sans)' }}
            >
              {busyId === 'all' ? 'Signing out…' : 'Sign out all other devices'}
            </button>
          )}
        </div>

        <div style={{ padding: '8px 20px 12px' }}>
          {error && <div style={{ padding: '14px 0', fontSize: '13px', color: 'var(--color-danger)' }}>{error}</div>}
          {!error && sessions === null && <div style={{ padding: '14px 0', fontSize: '13px', color: 'var(--color-text-3)' }}>Loading sessions…</div>}
          {!error && sessions !== null && sessions.length === 0 && (
            <div style={{ padding: '14px 0', fontSize: '13px', color: 'var(--color-text-3)' }}>
              No active sessions found. (Sessions started before this feature shipped are not listed.)
            </div>
          )}
          {(sessions || []).map((s) => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 0', borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'var(--color-surface)', color: 'var(--color-text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <DeviceIcon />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-text-1)' }}>{describeDevice(s.userAgent)}</span>
                  {s.isCurrent && (
                    <span style={{ background: 'var(--color-success-bg, #E8F7EE)', color: 'var(--color-success-text, #157347)', padding: '2px 8px', borderRadius: '20px', fontSize: '11px', fontWeight: 700 }}>
                      This device
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '12.5px', color: 'var(--color-text-3)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.ipAddress ? `${s.ipAddress} · ` : ''}last active {timeAgo(s.lastSeenAt)}
                </div>
              </div>
              <button
                onClick={() => signOutDevice(s)}
                disabled={busyId === s.id}
                style={{ padding: '4px 12px', background: 'none', border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-sm)', fontSize: '12px', color: s.isCurrent ? 'var(--color-text-2)' : 'var(--color-danger)', cursor: busyId === s.id ? 'wait' : 'pointer', fontFamily: 'var(--font-sans)', flexShrink: 0 }}
              >
                {busyId === s.id ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
