'use client';
import React from 'react';
import { Mail, TEAM_MAIL, colorFor, initials } from '@/lib/inbox-data';
import { fetchAgentLogs, type AgentLogEntry } from '@/lib/hrApi';
import { fetchNotifications, markNotificationRead, markAllNotificationsRead, type AppNotification } from '@/lib/leadFunnelApi';
import { CampaignOutreachTree } from './CampaignOutreachTree';

/* ──────────────────────────────────────────────────────────────────────────
   Types
   ──────────────────────────────────────────────────────────────────────── */
interface LogLine {
  id: string;
  text: string;
  timeLabel: string; // display label
  ts: number;        // sort key (newest = largest)
}

const TABS = ['Campaigns', 'Notifications', 'Agent Log'] as const;
type Tab = typeof TABS[number];

/** Time-range choices for the Agent Log feed. `hours: null` = all time. */
const RANGE_OPTIONS: { label: string; hours: number | null }[] = [
  { label: 'Last 24 hours', hours: 24 },
  { label: 'Last 3 days', hours: 72 },
  { label: 'Last 5 days', hours: 120 },
  { label: 'Last 7 days', hours: 168 },
  { label: 'All time', hours: null },
];

/* ──────────────────────────────────────────────────────────────────────────
   Static placeholder data (mail lives in lib/inbox-data; logs are local)
   ──────────────────────────────────────────────────────────────────────── */
const AGENT_LOG: LogLine[] = [
  { id: 'a1', text: '12 positive replies synced to Pipeline', timeLabel: 'Today · 11:46', ts: 21_1146 },
  { id: 'a2', text: '42 replies received · 12 marked positive', timeLabel: 'Today · 10:20', ts: 21_1020 },
  { id: 'a3', text: 'Sent 130 outreach emails · 0 bounces', timeLabel: 'Today · 09:05', ts: 21_0905 },
  { id: 'a4', text: 'Generated 130 personalized outreach emails', timeLabel: 'Today · 08:40', ts: 21_0840 },
  { id: 'a5', text: '130 leads qualified for outreach', timeLabel: 'Yesterday · 18:30', ts: 20_1830 },
  { id: 'a6', text: 'Enriched 250 leads with email & phone', timeLabel: 'Yesterday · 17:10', ts: 20_1710 },
  { id: 'a7', text: 'Started orchestration for campaign “D1C Outreach”', timeLabel: 'Yesterday · 16:55', ts: 20_1655 },
  { id: 'a8', text: 'Imported 250 new leads from LinkedIn Sales Navigator', timeLabel: 'Yesterday · 16:40', ts: 20_1640 },
];

const NOTIFICATIONS: LogLine[] = [
  { id: 'n1', text: 'New reply from Acme Corp', timeLabel: 'Today · 11:48', ts: 21_1148 },
  { id: 'n2', text: 'Campaign “D1C Outreach” completed', timeLabel: 'Today · 11:46', ts: 21_1146 },
  { id: 'n3', text: 'Saurabh S. assigned you a task', timeLabel: 'Today · 09:15', ts: 21_0915 },
  { id: 'n4', text: 'Weekly goal is 80% complete', timeLabel: 'Yesterday · 18:00', ts: 20_1800 },
  { id: 'n5', text: '3 new leads added to “Test” campaign', timeLabel: 'Yesterday · 14:25', ts: 20_1425 },
];

const Avatar =({ name, size = 26 }: { name: string; size?: number }) => (
  <div style={{ width: size, height: size, borderRadius: '50%', background: colorFor(name), color: '#fff', fontSize: size < 28 ? '9px' : '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{initials(name)}</div>
);

/** Small inline pill used for campaign name / channel context on a log line. */
const LogBadge = ({ children, tone }: { children: React.ReactNode; tone: 'brand' | 'muted' }) => (
  <span style={{
    fontSize: '10.5px', fontWeight: 600, lineHeight: 1.5, padding: '1px 7px', borderRadius: '4px',
    whiteSpace: 'nowrap', flexShrink: 0,
    color: tone === 'brand' ? 'var(--color-brand)' : 'var(--color-text-3)',
    background: tone === 'brand' ? 'var(--color-brand-subtle)' : 'var(--color-surface-2, var(--color-surface))',
    border: `1px solid ${tone === 'brand' ? 'transparent' : 'var(--color-border-2)'}`,
  }}>{children}</span>
);

const LogIcon = ({ type }: { type: string }) => {
  if (type === 'Outreach & Emails') {
    return (
      <svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="var(--color-brand)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <rect x="2" y="4" width="14" height="10" rx="1.5" /><polyline points="2.5,5 9,10 15.5,5" />
      </svg>
    );
  }
  if (type === 'LinkedIn Outreach') {
    return (
      <svg width="15" height="15" viewBox="0 0 18 18" fill="var(--color-brand)" style={{ flexShrink: 0 }}>
        <rect x="2" y="2" width="14" height="14" rx="2.5" fill="var(--color-brand)" />
        <rect x="4.6" y="7.2" width="1.9" height="6.2" fill="#fff" />
        <circle cx="5.55" cy="5.1" r="1.15" fill="#fff" />
        <path d="M8.2 7.2h1.8v.9c.25-.5.9-1 1.9-1 1.5 0 2.1.9 2.1 2.6v3.7h-1.9v-3.3c0-.8-.3-1.3-1-1.3-.6 0-1 .4-1 1.3v3.3H8.2z" fill="#fff" />
      </svg>
    );
  }
  if (type === 'Lead & Prospect Discovery') {
    return (
      <svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="var(--color-warning)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <circle cx="8" cy="8" r="4" /><line x1="16" y1="16" x2="11" y2="11" />
      </svg>
    );
  }
  if (type === 'Data Imports') {
    return (
      <svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="var(--color-success)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <path d="M9 2v10M6 9l3 3 3-3M3 15h12" />
      </svg>
    );
  }
  if (type === 'Campaign Lifecycle') {
    return (
      <svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="var(--color-text-2)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <rect x="2.5" y="2.5" width="13" height="13" rx="1.8" /><line x1="2.5" y1="7.5" x2="15.5" y2="7.5" /><line x1="7.5" y1="2.5" x2="7.5" y2="15.5" />
      </svg>
    );
  }
  return (
    <svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="var(--color-text-3)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <line x1="2" y1="9" x2="16" y2="9" /><line x1="5" y1="5" x2="16" y2="5" /><line x1="5" y1="13" x2="16" y2="13" /><circle cx="2" cy="5" r="1" /><circle cx="2" cy="13" r="1" />
    </svg>
  );
};

function getLogCategory(l: AgentLogEntry): string {
  const t = (l.eventType || '').toLowerCase();
  const m = (l.message || '').toLowerCase();
  const channel = (l.metadata?.channel || '').toLowerCase();

  // eventType / channel are authoritative; message keywords are the fallback.
  if (t.includes('linkedin') || channel === 'linkedin') {
    return 'LinkedIn Outreach';
  }
  if (t.includes('email') || t.includes('outreach') || t.includes('contact') || channel === 'email' || channel === 'auto' || m.includes('email') || m.includes('outreach') || m.includes('sent')) {
    return 'Outreach & Emails';
  }
  if (t.includes('discover') || t.includes('prospect') || m.includes('prospect') || m.includes('discover') || m.includes('qualif')) {
    return 'Lead & Prospect Discovery';
  }
  if (t.includes('import') || m.includes('import')) {
    return 'Data Imports';
  }
  if (t.includes('campaign') || m.includes('campaign') || t.includes('create') || m.includes('create')) {
    return 'Campaign Lifecycle';
  }
  return 'General Logs';
}

/* ──────────────────────────────────────────────────────────────────────────
   Component
   ──────────────────────────────────────────────────────────────────────── */
export function InboxView() {
  const [activeTab, setActiveTab] = React.useState<Tab>('Campaigns');
  // Notifications — real, per-user data.
  const [notifs, setNotifs] = React.useState<AppNotification[]>([]);
  const [notifLoading, setNotifLoading] = React.useState(false);
  const [notifError, setNotifError] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');
  const [openId, setOpenId] = React.useState<string | null>(null);

  // Agent Log — real, cursor-paginated data (Notifications stays mock for now).
  const [agentLogs, setAgentLogs] = React.useState<AgentLogEntry[]>([]);
  const [expandedCats, setExpandedCats] = React.useState<Set<string>>(
    new Set(['Outreach & Emails', 'LinkedIn Outreach', 'Lead & Prospect Discovery', 'Data Imports', 'Campaign Lifecycle', 'General Logs'])
  );

  const toggleCat = (cat: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };
  const [agentCursor, setAgentCursor] = React.useState<string | null>(null);
  const [agentHasMore, setAgentHasMore] = React.useState(false);
  const [agentLoading, setAgentLoading] = React.useState(false);
  const [agentLoadingMore, setAgentLoadingMore] = React.useState(false);
  const [agentError, setAgentError] = React.useState<string | null>(null);
  // Time-range selector for the Agent Log. Default: last 24 hours.
  const [rangeHours, setRangeHours] = React.useState<number | null>(24);
  const [expandedLogs, setExpandedLogs] = React.useState<Set<string>>(new Set());

  const toggleLog = (id: string) =>
    setExpandedLogs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  // Campaigns → real outreach tree; Agent Log → activity feed.
  const isMailTab = false;
  const mails = TEAM_MAIL;
  const logs = activeTab === 'Agent Log' ? AGENT_LOG : NOTIFICATIONS;

  const switchTab = (t: Tab) => { setActiveTab(t); setOpenId(null); setQuery(''); };

  // Open the standalone full-screen mail page in a NEW TAB (no app chrome).
  const openFullScreen = (id: string) => window.open(`/inbox/mail/${id}`, '_blank', 'noopener');

  // Reply → just redirect to Outlook.
  const replyInOutlook = () => window.open('https://outlook.office.com/mail/', '_blank', 'noopener');

  // List → click row → 40/60 split → click the SAME row again → full screen (new tab).
  const onRowClick = (id: string) => {
    if (openId !== id) setOpenId(id);   // open / switch the split reading pane
    else openFullScreen(id);            // same row again → full screen in new tab
  };

  const q = query.trim().toLowerCase();
  const visibleMails = React.useMemo(
    () => [...mails].sort((a, b) => b.ts - a.ts).filter(m => !q || m.sender.toLowerCase().includes(q) || m.subject.toLowerCase().includes(q)),
    [mails, q]
  );
  const visibleLogs = React.useMemo(
    () => [...logs].sort((a, b) => b.ts - a.ts).filter(l => !q || l.text.toLowerCase().includes(q)),
    [logs, q]
  );
  const openMail: Mail | null = openId ? mails.find(m => m.id === openId) ?? null : null;

  // Load the first page whenever the tab is opened OR the time range changes.
  // Each range change is a fresh query (reset cursor + list), so switching from
  // "24 hours" to "7 days" reloads from scratch rather than appending.
  React.useEffect(() => {
    if (activeTab !== 'Agent Log') return;
    let cancelled = false;
    setAgentLoading(true); setAgentError(null);
    fetchAgentLogs(null, 50, rangeHours)
      .then(p => { if (cancelled) return; setAgentLogs(p.logs); setAgentCursor(p.nextCursor); setAgentHasMore(p.hasMore); })
      .catch(e => { if (!cancelled) setAgentError(e instanceof Error ? e.message : 'Failed to load agent log'); })
      .finally(() => { if (!cancelled) setAgentLoading(false); });
    return () => { cancelled = true; };
  }, [activeTab, rangeHours]);

  // Notifications feed — load when the tab opens.
  React.useEffect(() => {
    if (activeTab !== 'Notifications') return;
    let cancelled = false;
    setNotifLoading(true); setNotifError(null);
    fetchNotifications({ limit: 50 })
      .then(p => { if (!cancelled) setNotifs(p.notifications); })
      .catch(e => { if (!cancelled) setNotifError(e instanceof Error ? e.message : 'Failed to load notifications'); })
      .finally(() => { if (!cancelled) setNotifLoading(false); });
    return () => { cancelled = true; };
  }, [activeTab]);

  const onNotifClick = async (n: AppNotification) => {
    if (!n.read) {
      setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
      try { await markNotificationRead(n.id); } catch { /* optimistic; ignore */ }
      window.dispatchEvent(new Event('notifications:changed'));
    }
  };

  const onMarkAllRead = async () => {
    setNotifs(prev => prev.map(x => ({ ...x, read: true })));
    try { await markAllNotificationsRead(); } catch { /* ignore */ }
    window.dispatchEvent(new Event('notifications:changed'));
  };

  const loadMoreAgentLogs = React.useCallback(async () => {
    if (agentLoadingMore || !agentHasMore || !agentCursor) return;
    setAgentLoadingMore(true);
    try {
      const p = await fetchAgentLogs(agentCursor, 50, rangeHours);
      setAgentLogs(prev => [...prev, ...p.logs]);
      setAgentCursor(p.nextCursor);
      setAgentHasMore(p.hasMore);
    } catch (e) {
      setAgentError(e instanceof Error ? e.message : 'Failed to load more');
    } finally {
      setAgentLoadingMore(false);
    }
  }, [agentCursor, agentHasMore, agentLoadingMore, rangeHours]);

  const visibleAgentLogs = React.useMemo(
    () => agentLogs.filter(l => !q || l.message.toLowerCase().includes(q) || (l.summary ?? '').toLowerCase().includes(q)),
    [agentLogs, q]
  );

  const groupedLogs = React.useMemo(() => {
    const groups: Record<string, AgentLogEntry[]> = {
      'Outreach & Emails': [],
      'LinkedIn Outreach': [],
      'Lead & Prospect Discovery': [],
      'Data Imports': [],
      'Campaign Lifecycle': [],
      'General Logs': [],
    };
    visibleAgentLogs.forEach(l => {
      const cat = getLogCategory(l);
      groups[cat].push(l);
    });
    return groups;
  }, [visibleAgentLogs]);

  /* ── shared styles ── */
  const thcell: React.CSSProperties = { fontSize: '11px', fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '.5px', padding: '4px 8px', display: 'flex', alignItems: 'center' };
  const mailGrid: React.CSSProperties = { display: 'grid', gridTemplateColumns: '230px 1fr 110px' };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

      {/* ── Tabs (no page header) ── */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 20px', borderBottom: '1px solid var(--color-border)', flexShrink: 0, overflowX: 'auto', overflowY: 'hidden' }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => switchTab(tab)} style={{
            padding: '11px 14px', fontSize: '13.5px', fontWeight: tab === activeTab ? 600 : 500,
            color: tab === activeTab ? 'var(--color-text-1)' : 'var(--color-text-2)',
            background: 'none', border: 'none',
            borderBottom: `2px solid ${tab === activeTab ? 'var(--color-text-1)' : 'transparent'}`,
            marginBottom: '-1px', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'var(--font-sans)',
          }}>{tab}</button>
        ))}
      </div>

      {/* ── Toolbar: Search · Filter · Sort by ── */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 20px', borderBottom: '1px solid var(--color-border)', gap: '8px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '6px 10px', border: '1px solid var(--color-border-2)', borderRadius: '7px', width: '260px', maxWidth: '40%' }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--color-text-3)" strokeWidth="1.8" strokeLinecap="round"><circle cx="7" cy="7" r="5" /><line x1="11" y1="11" x2="14.5" y2="14.5" /></svg>
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder={activeTab === 'Campaigns' ? 'Search prospect, company, email, campaign' : 'Search'}
            style={{ border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--color-text-1)', width: '100%' }} />
        </div>
        {['Filter', 'Sort by'].map(t => (
          <button key={t} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 11px', border: 'none', background: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--color-text-2)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>{t}</button>
        ))}

        {/* Time-range selector (Agent Log only) */}
        {activeTab === 'Agent Log' && (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '7px' }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="var(--color-text-3)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="6" /><path d="M8 4.5V8l2.5 1.5" /></svg>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <select
                value={rangeHours === null ? 'all' : String(rangeHours)}
                onChange={e => setRangeHours(e.target.value === 'all' ? null : Number(e.target.value))}
                style={{
                  appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
                  padding: '6px 28px 6px 11px', border: '1px solid var(--color-border-2)', borderRadius: '7px',
                  background: 'var(--color-bg)', color: 'var(--color-text-1)', fontSize: '13px', fontWeight: 500,
                  fontFamily: 'var(--font-sans)', cursor: 'pointer', outline: 'none',
                }}
              >
                {RANGE_OPTIONS.map(o => (
                  <option key={o.label} value={o.hours === null ? 'all' : String(o.hours)}>{o.label}</option>
                ))}
              </select>
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="var(--color-text-3)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', right: '9px', pointerEvents: 'none' }}><polyline points="2,4 6,8 10,4" /></svg>
            </div>
          </div>
        )}
      </div>

      {/* ── Content ── */}
      {activeTab === 'Campaigns' ? (
        <CampaignOutreachTree query={query} />
      ) : isMailTab ? (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

          {/* List */}
          <div style={{
            flex: openMail ? '0 0 40%' : '1 1 100%',
            borderRight: openMail ? '1px solid var(--color-border)' : 'none',
            overflowY: 'auto', minWidth: 0,
          }}>
            {/* Column header only in plain list view */}
            {!openMail && (
              <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)', padding: '0 20px' }}>
                <div style={mailGrid}>
                  {['Sender', 'Subject', 'Date'].map(h => <div key={h} style={thcell}>{h}</div>)}
                </div>
              </div>
            )}

            {visibleMails.length === 0 && (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--color-text-3)', fontSize: '13px' }}>No messages</div>
            )}

            {visibleMails.map(m => {
              const selected = openId === m.id;
              return openMail ? (
                /* Compact list item (split mode) */
                <div key={m.id} onClick={() => onRowClick(m.id)} style={{
                  display: 'flex', gap: '10px', padding: '11px 16px', cursor: 'pointer',
                  borderBottom: '1px solid var(--color-border)', borderLeft: `3px solid ${selected ? 'var(--color-brand)' : 'transparent'}`,
                  background: selected ? 'var(--color-brand-subtle)' : 'var(--color-bg)',
                }}>
                  <Avatar name={m.sender} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: m.unread ? 700 : 600, color: 'var(--color-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.sender}</span>
                      <span style={{ fontSize: '11.5px', color: 'var(--color-text-3)', flexShrink: 0 }}>{m.date}</span>
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--color-text-1)', fontWeight: m.unread ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>{m.subject}</div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>{m.preview}</div>
                  </div>
                </div>
              ) : (
                /* Full table row (list view) */
                <div key={m.id} onClick={() => onRowClick(m.id)} style={{
                  ...mailGrid, alignItems: 'center', padding: '0 20px', minHeight: '46px',
                  borderBottom: '1px solid var(--color-border)', cursor: 'pointer', background: 'var(--color-bg)',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-row-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-bg)')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '8px', minWidth: 0 }}>
                    <Avatar name={m.sender} />
                    <span style={{ fontSize: '13px', fontWeight: m.unread ? 700 : 500, color: 'var(--color-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.sender}</span>
                  </div>
                  <div style={{ padding: '8px', minWidth: 0, display: 'flex', gap: '7px', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '13px', fontWeight: m.unread ? 600 : 400, color: 'var(--color-text-1)', flexShrink: 0, maxWidth: '45%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.subject}</span>
                    <span style={{ fontSize: '12.5px', color: 'var(--color-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>— {m.preview}</span>
                  </div>
                  <div style={{ padding: '8px', fontSize: '12.5px', color: 'var(--color-text-2)' }}>{m.date}</div>
                </div>
              );
            })}
          </div>

          {/* Reading pane (split 60%) — expand button / second click opens full screen in a new tab */}
          {openMail && (
            <div style={{ flex: 1, overflowY: 'auto', minWidth: 0, background: 'var(--color-bg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderBottom: '1px solid var(--color-border)', position: 'sticky', top: 0, background: 'var(--color-bg)', zIndex: 5 }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Message</span>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button onClick={replyInOutlook} title="Reply in Outlook" style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px',
                    background: 'var(--color-brand)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)',
                    fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  }}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 4L3 8l4 4" /><path d="M3 8h7a4 4 0 0 1 4 4v1" /></svg>
                    Reply
                  </button>
                  <button onClick={() => openFullScreen(openMail.id)} title="Open full screen (new tab)" style={iconBtn}>
                    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 2h5v5M14 2L8.5 7.5M7 14H2V9M2 14l5.5-5.5" /></svg>
                  </button>
                  <button onClick={() => setOpenId(null)} title="Close" style={iconBtn}>
                    <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="11" y2="11" /><line x1="11" y1="1" x2="1" y2="11" /></svg>
                  </button>
                </div>
              </div>

              <div style={{ padding: '20px 22px' }}>
                <h1 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-1)', margin: '0 0 14px' }}>{openMail.subject}</h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: '11px', paddingBottom: '16px', marginBottom: '18px', borderBottom: '1px solid var(--color-border)' }}>
                  <Avatar name={openMail.sender} size={36} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-text-1)' }}>{openMail.sender}</div>
                    <div style={{ fontSize: '12.5px', color: 'var(--color-text-3)' }}>{openMail.email}</div>
                  </div>
                  <span style={{ marginLeft: 'auto', fontSize: '12.5px', color: 'var(--color-text-3)', flexShrink: 0 }}>{openMail.date}</span>
                </div>
                <div style={{ fontSize: '14px', lineHeight: 1.65, color: 'var(--color-text-1)', whiteSpace: 'pre-line' }}>{openMail.body}</div>
              </div>
            </div>
          )}
        </div>
      ) : activeTab === 'Agent Log' ? (
        /* ── Agent Log: real, cursor-paginated activity feed with tree grouping ── */
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {agentLoading ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--color-text-3)', fontSize: '13px' }}>Loading activity…</div>
          ) : agentError ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--color-danger-text)', fontSize: '13px' }}>{agentError}</div>
          ) : visibleAgentLogs.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--color-text-3)', fontSize: '13px' }}>Nothing here yet</div>
          ) : (
            <>
              {Object.entries(groupedLogs).map(([cat, items]) => {
                if (items.length === 0) return null;
                const open = expandedCats.has(cat);
                return (
                  <div key={cat} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    {/* Category node */}
                    <div onClick={() => toggleCat(cat)} style={{
                      display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 24px', cursor: 'pointer',
                      background: 'var(--color-bg)',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-row-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-bg)')}>
                      <span style={{ display: 'flex', color: 'var(--color-text-3)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4,2 8,6 4,10" /></svg>
                      </span>
                      <LogIcon type={cat} />
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-1)', flex: 1 }}>{cat}</span>
                      <span style={{ fontSize: '12px', color: 'var(--color-text-3)' }}>{items.length} {items.length === 1 ? 'log' : 'logs'}</span>
                    </div>

                    {/* Children logs */}
                    {open && (
                      <div style={{ paddingLeft: '20px', background: 'var(--color-surface)' }}>
                        {items.map(l => {
                          const recipients = l.metadata?.recipients ?? [];
                          const hasDetail = recipients.length > 0;
                          const isOpen = expandedLogs.has(l.id);
                          return (
                          <div key={l.id} style={{ borderBottom: '1px solid var(--color-border)', borderLeft: '1.5px solid var(--color-border-2)' }}>
                            <div
                              onClick={hasDetail ? () => toggleLog(l.id) : undefined}
                              style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '10px 24px', cursor: hasDetail ? 'pointer' : 'default' }}>
                              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--color-brand)', flexShrink: 0, marginTop: '7px' }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                {/* Headline + context badges (campaign · channel) */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: '13px', color: 'var(--color-text-1)', lineHeight: 1.4 }}>{l.message}</span>
                                  {l.campaignName && <LogBadge tone="brand">{l.campaignName}</LogBadge>}
                                  {l.metadata?.channel && l.metadata.channel !== 'auto' && (
                                    <LogBadge tone="muted">{l.metadata.channel === 'email' ? 'Email' : l.metadata.channel === 'linkedin' ? 'LinkedIn' : l.metadata.channel}</LogBadge>
                                  )}
                                </div>
                                {l.summary && <div style={{ fontSize: '11.5px', color: 'var(--color-text-3)', marginTop: '3px' }}>{l.summary}</div>}
                                {hasDetail && (
                                  <div style={{ fontSize: '11.5px', color: 'var(--color-brand)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <span style={{ display: 'flex', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>
                                      <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4,2 8,6 4,10" /></svg>
                                    </span>
                                    {isOpen ? 'Hide recipients' : `Show ${recipients.length} recipient${recipients.length === 1 ? '' : 's'}`}
                                  </div>
                                )}
                              </div>
                              <span style={{ fontSize: '11.5px', color: 'var(--color-text-3)', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>{fmtLogTime(l.createdAt)}</span>
                            </div>

                            {/* Expanded per-recipient detail (who was contacted, at which company) */}
                            {hasDetail && isOpen && (
                              <div style={{ padding: '4px 24px 12px 41px' }}>
                                {recipients.map((r, i) => (
                                  <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: '8px', padding: '4px 0', fontSize: '12px', borderTop: i === 0 ? 'none' : '1px dashed var(--color-border)' }}>
                                    <span style={{ color: 'var(--color-text-1)', fontWeight: 500 }}>{r.name || r.email || 'Unknown'}</span>
                                    {r.company && <span style={{ color: 'var(--color-text-3)' }}>· {r.company}</span>}
                                    {r.email && <span style={{ color: 'var(--color-text-3)', fontFamily: 'var(--font-mono)', fontSize: '11px', marginLeft: 'auto' }}>{r.email}</span>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
              {agentHasMore && (
                <div style={{ padding: '14px', textAlign: 'center' }}>
                  <button onClick={loadMoreAgentLogs} disabled={agentLoadingMore} style={loadMoreBtn}>
                    {agentLoadingMore ? 'Loading…' : 'Load more'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        /* ── Notifications: real, per-user; click to mark read ── */
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {notifs.some(n => !n.read) && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 24px', borderBottom: '1px solid var(--color-border)' }}>
              <button onClick={onMarkAllRead} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-brand)', fontSize: '12.5px', fontWeight: 600, fontFamily: 'var(--font-sans)' }}>
                Mark all as read
              </button>
            </div>
          )}
          {notifLoading && <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--color-text-3)', fontSize: '13px' }}>Loading…</div>}
          {!notifLoading && notifError && <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--color-danger-text)', fontSize: '13px' }}>{notifError}</div>}
          {!notifLoading && !notifError && notifs.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--color-text-3)', fontSize: '13px' }}>Nothing here yet</div>
          )}
          {!notifLoading && notifs.map(n => {
            const dot = n.severity === 'error' ? 'var(--color-danger-text, #C0392B)'
              : n.severity === 'warning' ? 'var(--color-warning-text, #B7791F)'
              : 'var(--color-brand)';
            return (
              <div key={n.id} onClick={() => onNotifClick(n)}
                style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 24px', borderBottom: '1px solid var(--color-border)', cursor: 'pointer', background: n.read ? 'transparent' : 'var(--color-brand-subtle, rgba(0,0,0,0.02))' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: n.read ? 'var(--color-border-2)' : dot, flexShrink: 0, marginTop: '5px' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13.5px', fontWeight: n.read ? 500 : 700, color: 'var(--color-text-1)' }}>
                    {n.title}{n.campaignName ? <span style={{ fontWeight: 500, color: 'var(--color-text-3)' }}> · {n.campaignName}</span> : null}
                  </div>
                  {n.message && <div style={{ fontSize: '12.5px', color: 'var(--color-text-2)', marginTop: '2px', lineHeight: 1.45 }}>{n.message}</div>}
                </div>
                <span style={{ fontSize: '12px', color: 'var(--color-text-3)', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>{n.createdAt ? fmtLogTime(n.createdAt) : ''}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  width: '28px', height: '28px', border: 'none', background: 'none', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px', color: 'var(--color-text-2)',
};

const loadMoreBtn: React.CSSProperties = {
  padding: '7px 16px', border: '1px solid var(--color-border-2)', background: 'var(--color-bg)',
  borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, color: 'var(--color-text-1)',
  cursor: 'pointer', fontFamily: 'var(--font-sans)',
};

/** Format an ISO timestamp as "Today · 11:46" / "Yesterday · 10:20" / "23 Jun · 09:05". */
function fmtLogTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return `Today · ${time}`;
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (d.toDateString() === yest.toDateString()) return `Yesterday · ${time}`;
  return `${d.toLocaleDateString([], { day: '2-digit', month: 'short' })} · ${time}`;
}
