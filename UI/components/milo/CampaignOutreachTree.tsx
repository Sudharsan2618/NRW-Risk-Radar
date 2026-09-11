'use client';
import React from 'react';
import {
  listCampaigns,
  fetchCampaignOutreach,
  type OutreachEmail,
} from '@/lib/hrApi';
import {
  listImportCampaigns, fetchImportCampaignOutreach,
  fetchOutreachReplyDetail, sendOutreachReply, forwardOutreach, getReplySignature, saveReplySignature,
   fetchOutreachTemplates, fetchLinkedInActivity,
  type OutreachReplyDetail, type OutreachReplyItem, type OutreachTemplate,
} from '@/lib/leadFunnelApi';

type TreeCampaign = { campaignId: string; name: string; kind: 'hr' | 'import' };

interface Branch {
  items: OutreachEmail[];
  cursor: string | null;
  hasMore: boolean;
  loading: boolean;
  loaded: boolean;
}

const emptyBranch = (): Branch => ({ items: [], cursor: null, hasMore: false, loading: false, loaded: false });

function fmtTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function statusLabel(status: string): string {
  return status.toLowerCase() === 'replied' ? 'Response Received' : status;
}

/** Normalise a stored LinkedIn URL to something a browser can open — many are
 *  saved without a scheme (e.g. "linkedin.com/in/jane"). Returns null when blank. */
function linkedinHref(url?: string): string | null {
  const u = (url || '').trim();
  if (!u) return null;
  return /^https?:\/\//i.test(u) ? u : `https://${u.replace(/^\/+/, '')}`;
}

/** A prospect/company label that becomes a LinkedIn link when a URL is known.
 *  The link stops row-click propagation so opening LinkedIn never opens the
 *  reading pane, and opens in a new tab. */
function LinkedLabel({ text, url, bold }: { text: string; url?: string; bold?: boolean }) {
  const href = linkedinHref(url);
  if (!href) return <>{text}</>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={ev => ev.stopPropagation()}
      title={`Open LinkedIn — ${text}`}
      style={{ color: 'var(--color-brand)', textDecoration: 'none', fontWeight: bold ? 600 : 'inherit' }}
      onMouseEnter={ev => (ev.currentTarget.style.textDecoration = 'underline')}
      onMouseLeave={ev => (ev.currentTarget.style.textDecoration = 'none')}
    >{text}</a>
  );
}

/** Does an outreach row match the inbox search term? Covers prospect name,
 *  email address, company and subject. `q` is already lower-cased & trimmed. */
function emailMatches(e: OutreachEmail, q: string): boolean {
  if (!q) return true;
  return (
    e.prospectName.toLowerCase().includes(q) ||
    (e.email || '').toLowerCase().includes(q) ||
    (e.company || '').toLowerCase().includes(q) ||
    e.subject.toLowerCase().includes(q)
  );
}

export function CampaignOutreachTree({ query = '' }: { query?: string }) {
  const [campaigns, setCampaigns] = React.useState<TreeCampaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [branches, setBranches] = React.useState<Record<string, Branch>>({});

  const [selected, setSelected] = React.useState<OutreachEmail | null>(null);
  const [previewHtml, setPreviewHtml] = React.useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [replyOpen, setReplyOpen] = React.useState(false);
  const [forwardOpen, setForwardOpen] = React.useState(false);

  // Collapsible preview sections: the email thread, and a LinkedIn activity block.
  const [emailOpen, setEmailOpen] = React.useState(true);
  const [liOpen, setLiOpen] = React.useState(true);
  const [liData, setLiData] = React.useState<{
    accountUserId?: string | null; accountUsername?: string | null;
    invite?: string | null; inviteSentAt?: string | null; acceptedAt?: string | null;
    message?: string | null; messageSentAt?: string | null; loading?: boolean; error?: string;
  } | null>(null);

  // Load all campaigns (HR + import) once.
  React.useEffect(() => {
    let cancelled = false;
    setLoadingCampaigns(true);
    Promise.allSettled([listCampaigns(), listImportCampaigns()])
      .then(([hr, imp]) => {
        if (cancelled) return;
        const list: TreeCampaign[] = [];
        if (hr.status === 'fulfilled') {
          hr.value.filter(c => !c.isLegacy).forEach(c => list.push({ campaignId: c.id, name: c.name, kind: 'hr' }));
        }
        if (imp.status === 'fulfilled') {
          imp.value.campaigns.forEach(c => list.push({ campaignId: c._id, name: c.name, kind: 'import' }));
        }
        if (hr.status === 'rejected' && imp.status === 'rejected') setError('Failed to load campaigns');
        setCampaigns(list);
      })
      .finally(() => { if (!cancelled) setLoadingCampaigns(false); });
    return () => { cancelled = true; };
  }, []);

  const fetchPage = React.useCallback((c: TreeCampaign, cursor: string | null) =>
    c.kind === 'hr'
      ? fetchCampaignOutreach(c.campaignId, cursor)
      : fetchImportCampaignOutreach(c.campaignId, cursor),
  []);

  const loadEmails = React.useCallback(async (c: TreeCampaign, append: boolean) => {
    setBranches(prev => ({ ...prev, [c.campaignId]: { ...(prev[c.campaignId] ?? emptyBranch()), loading: true } }));
    try {
      const cur = append ? (branches[c.campaignId]?.cursor ?? null) : null;
      const page = await fetchPage(c, cur);
      setBranches(prev => {
        const existing = prev[c.campaignId] ?? emptyBranch();
        return {
          ...prev,
          [c.campaignId]: {
            items: append ? [...existing.items, ...page.emails] : page.emails,
            cursor: page.nextCursor,
            hasMore: page.hasMore,
            loading: false,
            loaded: true,
          },
        };
      });
    } catch {
      setBranches(prev => ({ ...prev, [c.campaignId]: { ...(prev[c.campaignId] ?? emptyBranch()), loading: false, loaded: true } }));
    }
  }, [branches, fetchPage]);

  const toggle = (c: TreeCampaign) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(c.campaignId)) { next.delete(c.campaignId); return next; }
      next.add(c.campaignId);
      if (!branches[c.campaignId]?.loaded) void loadEmails(c, false);
      return next;
    });
  };

  const selectEmail = async (e: OutreachEmail) => {
    setSelected(e);
    setReplyOpen(false);
    setForwardOpen(false);
    setPreviewHtml(null);
    setPreviewLoading(true);
    setLiData(null);
    try {
      // Show the actual sent email stored on the outreach record (DB), not a
      // regenerated template — this is the real send/received thread per campaign.
      const html = (e.body || '').trim();
      setPreviewHtml(html
        ? html
        : '<p style="font-family:sans-serif;color:#9B9B9B">No email body was captured for this outreach.</p>');
    } finally {
      setPreviewLoading(false);
    }
    // Pull the prospect's LinkedIn invite note / follow-up message. Only import
    // (lead-funnel) outreach carries a linked prospectId + runId; HR search
    // outreach has no linked prospect, so the LinkedIn block shows a note instead.
    if (e.prospectId && e.runId) {
      setLiData({ loading: true });
      try {
        const activity = await fetchLinkedInActivity(e.prospectId, e.runId);
        setLiData({
          accountUserId: activity.accountUserId,
          accountUsername: activity.accountUsername,
          invite: activity.inviteMessage,
          inviteSentAt: activity.inviteSentAt,
          acceptedAt: activity.acceptedAt,
          message: activity.message,
          messageSentAt: activity.messageSentAt,
          loading: false,
        });
      } catch {
        setLiData({ loading: false, error: 'Could not load LinkedIn activity.' });
      }
    }
  };

  const renderLinkedIn = () => {
    if (!selected) return null;
    if (!selected.prospectId || !selected.runId) {
      return (
        <div style={{ fontSize: '13px', color: 'var(--color-text-3)', lineHeight: 1.5 }}>
          LinkedIn activity is tracked per prospect for Import campaigns. This Search campaign email has no linked
          LinkedIn prospect record, so no LinkedIn activity can be shown.
        </div>
      );
    }
    if (liData?.loading) return <div style={{ fontSize: '13px', color: 'var(--color-text-3)' }}>Loading LinkedIn activity…</div>;
    if (liData?.error) return <div style={{ fontSize: '13px', color: 'var(--color-danger-text)' }}>{liData.error}</div>;
    const invite = (liData?.invite || '').trim();
    const message = (liData?.message || '').trim();
    const inviteSentAt = liData?.inviteSentAt ? fmtTime(liData.inviteSentAt) : '';
    const acceptedAt = liData?.acceptedAt ? fmtTime(liData.acceptedAt) : '';
    const messageSentAt = liData?.messageSentAt ? fmtTime(liData.messageSentAt) : '';
    if (!invite && !message && !inviteSentAt && !acceptedAt) {
      return (
        <div style={{ fontSize: '13px', color: 'var(--color-text-3)', lineHeight: 1.5 }}>
          No LinkedIn activity was recorded for this prospect.
        </div>
      );
    }
    return (
      <div>
        {(liData?.accountUsername || liData?.accountUserId) && (
          <div style={{ marginBottom: '12px', fontSize: '12px', color: 'var(--color-text-3)' }}>
            LinkedIn account: <strong style={{ color: 'var(--color-text-1)' }}>{liData?.accountUsername || liData?.accountUserId}</strong>
          </div>
        )}
        {(inviteSentAt || acceptedAt) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: invite || message ? '16px' : 0, fontSize: '12px', color: 'var(--color-text-3)' }}>
            {inviteSentAt && <div>Invite sent: <strong style={{ color: 'var(--color-text-1)' }}>{inviteSentAt}</strong></div>}
            {acceptedAt && <div>Invite accepted: <strong style={{ color: 'var(--color-text-1)' }}>{acceptedAt}</strong></div>}
          </div>
        )}
        {invite && (
          <div style={{ marginBottom: message ? '16px' : 0 }}>
            <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--color-text-3)', marginBottom: '8px' }}>
              Connection invite note{inviteSentAt ? ` · ${inviteSentAt}` : ''}
            </div>
            <div style={{ border: '1px solid var(--color-border-2)', borderRadius: '10px', padding: '12px 14px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '13px', color: 'var(--color-text-1)', background: 'var(--color-bg)' }}>
              {invite}
            </div>
          </div>
        )}
        {message && (
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--color-text-3)', marginBottom: '8px' }}>
              LinkedIn message{messageSentAt ? ` · ${messageSentAt}` : ''}
            </div>
            <div style={{ border: '1px solid var(--color-border-2)', borderRadius: '10px', padding: '12px 14px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '13px', color: 'var(--color-text-1)', background: 'var(--color-bg)' }}>
              {message}
            </div>
          </div>
        )}
      </div>
    );
  };

  const q = query.trim().toLowerCase();

  // While a search is active, auto-load the first page of every campaign that
  // hasn't been opened yet, so a prospect / email match surfaces even when its
  // campaign is collapsed. `autoLoadedRef` guards against re-fetching the same
  // branch on the re-renders this effect triggers, and resets each new query.
  const autoLoadedRef = React.useRef<Set<string>>(new Set());
  React.useEffect(() => { autoLoadedRef.current = new Set(); }, [q]);
  React.useEffect(() => {
    if (!q) return;
    campaigns.forEach(c => {
      if (autoLoadedRef.current.has(c.campaignId)) return;
      const b = branches[c.campaignId];
      if (b?.loaded || b?.loading) return;
      autoLoadedRef.current.add(c.campaignId);
      void loadEmails(c, false);
    });
  }, [q, campaigns, branches, loadEmails]);

  // With no query: show every campaign. With a query: keep a campaign while its
  // branch is still loading (we don't yet know if it matches), and once loaded
  // keep it only if its name matches or it holds a matching email.
  const visibleCampaigns = !q ? campaigns : campaigns.filter(c => {
    if (c.name.toLowerCase().includes(q)) return true;
    const b = branches[c.campaignId];
    if (!b || (b.loading && !b.loaded)) return true;
    return b.items.some(e => emailMatches(e, q));
  });

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
      {/* Tree */}
      <div style={{ width: selected ? '46%' : '100%', minWidth: 0, borderRight: selected ? '1px solid var(--color-border)' : 'none', overflowY: 'auto' }}>
        {loadingCampaigns ? (
          <div style={msg}>Loading campaigns…</div>
        ) : error ? (
          <div style={{ ...msg, color: 'var(--color-danger-text)' }}>{error}</div>
        ) : visibleCampaigns.length === 0 ? (
          <div style={msg}>No campaigns yet.</div>
        ) : visibleCampaigns.map(c => {
          const branch = branches[c.campaignId];
          // When the campaign name itself matches, show all of its emails; when
          // it's surfaced via a prospect/email match, show only the matching rows.
          const nameMatch = !!q && c.name.toLowerCase().includes(q);
          const emails = (branch?.items ?? []).filter(e => !q || nameMatch || emailMatches(e, q));
          // While searching, auto-expand any campaign that holds a match (or is
          // still loading) so the matching rows are visible without a manual click.
          const open = q
            ? (emails.length > 0 || (!!branch?.loading && !branch?.loaded) || expanded.has(c.campaignId))
            : expanded.has(c.campaignId);
          return (
            <div key={c.campaignId} style={{ borderBottom: '1px solid var(--color-border)' }}>
              {/* Campaign node */}
              <div onClick={() => toggle(c)} style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 20px', cursor: 'pointer',
                background: 'var(--color-bg)',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-row-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--color-bg)')}>
                <span style={{ display: 'flex', color: 'var(--color-text-3)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4,2 8,6 4,10" /></svg>
                </span>
                <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="var(--color-text-2)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <rect x="2.5" y="2.5" width="13" height="13" rx="1.8" /><line x1="2.5" y1="7.5" x2="15.5" y2="7.5" /><line x1="7.5" y1="2.5" x2="7.5" y2="15.5" />
                </svg>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{c.name}</span>
                <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '.4px' }}>{c.kind === 'import' ? 'Import' : 'Search'}</span>
              </div>

              {/* Email leaves */}
              {open && (
                <div style={{ paddingLeft: '20px', background: 'var(--color-surface)' }}>
                  {branch?.loading && !branch?.loaded ? (
                    <div style={{ ...msg, padding: '14px 24px', textAlign: 'left' }}>Loading emails…</div>
                  ) : emails.length === 0 ? (
                    <div style={{ ...msg, padding: '14px 24px', textAlign: 'left' }}>No outreach emails sent for this campaign.</div>
                  ) : (
                    <>
                      {emails.map(e => {
                        const active = selected?.id === e.id;
                        // A bounce is a delivery failure too: red icon + red status label.
                        const failed = /fail|bounce/i.test(e.status);
                        return (
                          <div key={e.id} onClick={() => selectEmail(e)} style={{
                            display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 20px',
                            cursor: 'pointer', borderLeft: `3px solid ${active ? 'var(--color-brand)' : 'transparent'}`,
                            background: active ? 'var(--color-brand-subtle)' : 'transparent',
                            borderTop: '1px solid var(--color-border)',
                          }}>
                            <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke={failed ? 'var(--color-danger)' : 'var(--color-brand)'} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                              <rect x="2" y="4" width="14" height="10" rx="1.5" /><polyline points="2.5,5 9,10 15.5,5" />
                            </svg>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                <LinkedLabel text={e.prospectName} url={e.prospectLinkedinUrl} />
                                {e.company ? <> · <LinkedLabel text={e.company} url={e.companyLinkedinUrl} /></> : ''}
                              </div>
                              <div style={{ fontSize: '11.5px', color: 'var(--color-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.subject}</div>
                            </div>
                            <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: failed ? 'var(--color-danger-text)' : 'var(--color-success-text)', flexShrink: 0 }}>{statusLabel(e.status)}</span>
                            <span style={{ fontSize: '11px', color: 'var(--color-text-3)', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>{fmtTime(e.sentAt)}</span>
                          </div>
                        );
                      })}
                      {branch?.hasMore && (
                        <div style={{ padding: '10px 20px' }}>
                          <button onClick={() => loadEmails(c, true)} disabled={branch.loading} style={loadMoreBtn}>
                            {branch.loading ? 'Loading…' : 'Load more'}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Preview pane */}
      {selected && (
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--color-bg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '14px 28px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected.subject}</div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-3)' }}>To: {selected.email || selected.prospectName} · {fmtTime(selected.sentAt)}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <button
                onClick={() => {
                  // Import (lead-funnel) threads reply in-app; HR threads still
                  // hand off to Outlook until the reply flow is wired for them.
                  if (selected.kind === 'import') { setReplyOpen(o => !o); setForwardOpen(false); }
                  else window.open('https://outlook.office.com/mail/', '_blank', 'noopener');
                }}
                title={selected.kind === 'import' ? 'Reply from here' : 'Reply in Outlook'}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px',
                  border: 'none', background: replyOpen ? 'var(--color-brand-hover, var(--color-brand))' : 'var(--color-brand)', color: '#fff', borderRadius: 'var(--radius-md)',
                  fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)',
                }}>
                <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="8,4 3,9 8,14" /><path d="M3 9h7a5 5 0 0 1 5 5v0" />
                </svg>
                Reply
              </button>
              {selected.kind === 'import' && (
                <button
                  onClick={() => { setForwardOpen(o => !o); setReplyOpen(false); }}
                  title="Forward this thread (hand over to a teammate — they reply to the prospect directly)"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px',
                    border: '1px solid var(--color-border-2)',
                    background: forwardOpen ? 'var(--color-surface-2, var(--color-surface))' : 'var(--color-bg)',
                    color: 'var(--color-text-1)', borderRadius: 'var(--radius-md)',
                    fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  }}>
                  <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="10,4 15,9 10,14" /><path d="M15 9H8a5 5 0 0 0-5 5v0" />
                  </svg>
                  Forward
                </button>
              )}
              <button onClick={() => { setSelected(null); setReplyOpen(false); setForwardOpen(false); }} title="Close" style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-text-3)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="11" y2="11" /><line x1="11" y1="1" x2="1" y2="11" /></svg>
              </button>
            </div>
          </div>
          {previewLoading
            ? <div style={msg}>Rendering email…</div>
            : (
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
                <Section title="Email thread" open={emailOpen} onToggle={() => setEmailOpen(o => !o)}>
                {/* Inbound replies (from the mail webhook) shown first — this is
                    the actual response, not just the "replied" status badge. */}
                {(selected.replies?.length ?? 0) > 0 && (
                  <div style={{ marginBottom: '22px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--color-success-text, #1B7F3B)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="8,4 3,9 8,14" /><path d="M3 9h7a5 5 0 0 1 5 5v0" />
                      </svg>
                      {selected.replies!.length} {selected.replies!.length === 1 ? 'message' : 'messages'} in this thread
                    </div>
                    {selected.replies!.map((r, i) => {
                      const outbound = r.direction === 'outbound';
                      const bd = outbound ? 'var(--color-brand-subtle)' : 'var(--color-success-border, #B7E3C6)';
                      const hb = outbound ? 'var(--color-brand-subtle)' : 'var(--color-success-bg, #E7F6EC)';
                      const when = outbound ? (r.sentAt || r.receivedAt) : r.receivedAt;
                      return (
                        <div key={i} style={{ border: `1px solid ${bd}`, borderRadius: '10px', overflow: 'hidden', marginBottom: '14px' }}>
                          <div style={{ padding: '10px 14px', background: hb, borderBottom: `1px solid ${bd}` }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {outbound ? '↩ You replied' : (r.subject || '(no subject)')}
                            </div>
                            <div style={{ fontSize: '11.5px', color: 'var(--color-text-2)' }}>
                              {outbound ? `To: ${r.to || 'prospect'}` : `From: ${r.from || 'unknown'}`}{when ? ` · ${fmtTime(when)}` : ''}
                            </div>
                          </div>
                          <iframe srcDoc={r.body || ''} title={`Message ${i + 1}`} style={{ width: '100%', height: outbound ? '160px' : '280px', border: 0, background: '#fff', display: 'block' }} />
                        </div>
                      );
                    })}
                  </div>
                )}
                {/* The original sent email */}
                {(selected.replies?.length ?? 0) > 0 && (
                  <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--color-text-3)', marginBottom: '10px' }}>
                    Your sent email
                  </div>
                )}
                <iframe srcDoc={previewHtml ?? ''} title="Email preview" style={{ width: '100%', height: '100%', minHeight: '480px', border: 0 }} />
                </Section>

                <Section title="LinkedIn" open={liOpen} onToggle={() => setLiOpen(o => !o)}>
                  {renderLinkedIn()}
                </Section>
              </div>
            )}
          {replyOpen && selected.kind === 'import' && (
            <ReplyComposer
              outreachId={selected.id}
              onClose={() => setReplyOpen(false)}
              onSent={(replies) => {
                setSelected(s => (s ? { ...s, replies: replies as OutreachEmail['replies'] } : s));
                setReplyOpen(false);
              }}
            />
          )}
          {forwardOpen && selected.kind === 'import' && (
            <ForwardComposer
              outreachId={selected.id}
              onClose={() => setForwardOpen(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   In-app reply composer (lead-funnel threads). Plain-text message → HTML, with
   the user's saved signature appended server-side. Supports prefilling from a
   template and warns on out-of-office / opt-out recipients.
   ──────────────────────────────────────────────────────────────────────── */
function stripHtml(h: string): string {
  return (h || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&middot;/g, '·')
    .replace(/\n{3,}/g, '\n\n').trim();
}

function ReplyComposer({ outreachId, onClose, onSent }: {
  outreachId: string;
  onClose: () => void;
  onSent: (replies: OutreachReplyItem[]) => void;
}) {
  const [detail, setDetail] = React.useState<OutreachReplyDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [body, setBody] = React.useState('');
  const [recipient, setRecipient] = React.useState('');
  const [includeSig, setIncludeSig] = React.useState(true);
  const [signature, setSignature] = React.useState('');
  const [editingSig, setEditingSig] = React.useState(false);
  const [sigDraft, setSigDraft] = React.useState('');
  const [templates, setTemplates] = React.useState<OutreachTemplate[]>([]);
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let stop = false;
    setLoading(true); setError(null);
    Promise.all([
      fetchOutreachReplyDetail(outreachId),
      getReplySignature().catch(() => ({ signature: '' })),
      fetchOutreachTemplates().catch(() => ({ templates: [] as OutreachTemplate[] })),
    ]).then(([d, s, t]) => {
      if (stop) return;
      setDetail(d);
      setRecipient(d.recipient || '');
      setSignature((s as { signature: string }).signature || '');
      setTemplates((t as { templates: OutreachTemplate[] }).templates || []);
    }).catch(e => { if (!stop) setError(e instanceof Error ? e.message : 'Failed to load reply details'); })
      .finally(() => { if (!stop) setLoading(false); });
    return () => { stop = true; };
  }, [outreachId]);

  const send = async () => {
    if (!body.trim()) { setError('Write a message before sending.'); return; }
    setSending(true); setError(null);
    try {
      const r = await sendOutreachReply(outreachId, {
        body, recipient: recipient.trim() || undefined, includeSignature: includeSig,
      });
      onSent(r.replies || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Send failed');
      setSending(false);
    }
  };

  const saveSig = async () => {
    try { await saveReplySignature(sigDraft); setSignature(sigDraft); setEditingSig(false); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save signature'); }
  };

  const canSend = !!detail?.canReply && !!body.trim() && !sending;
  const inputStyle: React.CSSProperties = {
    border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-sm)', padding: '7px 10px',
    fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--color-text-1)', background: 'var(--color-bg)', outline: 'none',
  };

  return (
    <div style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)', padding: '14px 28px', flexShrink: 0, maxHeight: '46%', overflowY: 'auto' }}>
      {loading ? (
        <div style={{ fontSize: '13px', color: 'var(--color-text-3)' }}>Loading…</div>
      ) : !detail ? (
        <div style={{ fontSize: '13px', color: 'var(--color-danger-text)' }}>{error || 'Could not load this thread.'}</div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-1)' }}>
              {detail.mode === 'followup' ? 'Follow up' : 'Reply'}
            </div>
            <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-text-3)', fontSize: '12px' }}>Cancel</button>
          </div>

          {/* Warnings — soft, do not block sending. */}
          {detail.latestReplyAutoReply && (
            <Warn text="The latest reply looks like an out-of-office auto-reply. Double-check before responding." />
          )}
          {detail.recipientOptedOut && (
            <Warn text="This reply mentions opting out. Make sure a manual reply is appropriate." danger />
          )}
          {!detail.canReply && (
            <Warn text="This thread can't be replied to from here (no sender mailbox or recipient on file)." danger />
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-3)', minWidth: '30px' }}>To</span>
            <input value={recipient} onChange={e => setRecipient(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: '200px' }} />
            {templates.length > 0 && (
              <select onChange={e => { const t = templates.find(x => x._id === e.target.value); if (t) setBody(stripHtml(t.template || '')); e.target.value = ''; }}
                defaultValue="" style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="" disabled>Insert template…</option>
                {templates.map(t => <option key={t._id} value={t._id}>{t.name || t.subject || 'Untitled'}</option>)}
              </select>
            )}
          </div>

          <textarea
            value={body} onChange={e => setBody(e.target.value)} rows={6}
            placeholder="Write your reply… (sent as the signed-in sender; your signature is added automatically)"
            style={{ ...inputStyle, width: '100%', resize: 'vertical', lineHeight: 1.5, marginBottom: '8px' }} />

          {/* Signature control */}
          <div style={{ fontSize: '12px', color: 'var(--color-text-3)', marginBottom: '10px' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input type="checkbox" checked={includeSig} onChange={e => setIncludeSig(e.target.checked)} />
              Append my signature
            </label>
            <button onClick={() => { setSigDraft(signature); setEditingSig(v => !v); }} style={{ marginLeft: '10px', border: 'none', background: 'none', color: 'var(--color-brand)', cursor: 'pointer', fontSize: '12px' }}>
              {signature ? 'Edit signature' : 'Add a signature'}
            </button>
            {editingSig && (
              <div style={{ marginTop: '8px' }}>
                <textarea value={sigDraft} onChange={e => setSigDraft(e.target.value)} rows={3}
                  placeholder="e.g. Best regards,&#10;Your Name — Agamx"
                  style={{ ...inputStyle, width: '100%', resize: 'vertical' }} />
                <div style={{ marginTop: '6px', display: 'flex', gap: '8px' }}>
                  <button onClick={saveSig} style={{ ...inputStyle, cursor: 'pointer', fontWeight: 600, color: 'var(--color-brand-text)' }}>Save signature</button>
                  <button onClick={() => setEditingSig(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-text-3)', fontSize: '12px' }}>Cancel</button>
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--color-text-3)', marginTop: '4px' }}>Saved once and reused on every reply — this is your Blank template.</div>
              </div>
            )}
          </div>

          {error && <div style={{ fontSize: '12.5px', color: 'var(--color-danger-text)', marginBottom: '8px' }}>{error}</div>}

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={send} disabled={!canSend}
              style={{ padding: '8px 18px', background: canSend ? 'var(--color-brand)' : 'var(--color-border-2)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 700, cursor: canSend ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)' }}>
              {sending ? 'Sending…' : 'Send reply'}
            </button>
            <span style={{ fontSize: '11.5px', color: 'var(--color-text-3)' }}>from {detail.mailbox || '—'}</span>
          </div>
        </>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   Forward / handover composer (lead-funnel threads). Forwards the FULL thread to a
   teammate with Reply-To set to the prospect, so they reply to the prospect directly.
   Leaving "To" empty uses the campaign's configured Forward-Replies-To address.
   ────────────────────────────────────────────────────────────────────────── */
function ForwardComposer({ outreachId, onClose }: {
  outreachId: string;
  onClose: () => void;
}) {
  const [detail, setDetail] = React.useState<OutreachReplyDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [recipient, setRecipient] = React.useState('');
  const [cc, setCc] = React.useState('');
  const [note, setNote] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [sentTo, setSentTo] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let stop = false;
    setLoading(true); setError(null);
    fetchOutreachReplyDetail(outreachId)
      .then(d => { if (!stop) setDetail(d); })
      .catch(e => { if (!stop) setError(e instanceof Error ? e.message : 'Failed to load this thread'); })
      .finally(() => { if (!stop) setLoading(false); });
    return () => { stop = true; };
  }, [outreachId]);

  const send = async () => {
    setSending(true); setError(null);
    try {
      const ccList = cc.split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
      const r = await forwardOutreach(outreachId, {
        recipient: recipient.trim() || undefined,
        note: note.trim() || undefined,
        cc: ccList.length ? ccList : undefined,
      });
      setSentTo(r.recipient);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Forward failed');
    } finally {
      setSending(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-sm)', padding: '7px 10px',
    fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--color-text-1)', background: 'var(--color-bg)', outline: 'none',
  };

  return (
    <div style={{ borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)', padding: '14px 28px', flexShrink: 0, maxHeight: '46%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-1)' }}>Forward thread (handover)</div>
        <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-text-3)', fontSize: '12px' }}>Close</button>
      </div>

      {loading ? (
        <div style={{ fontSize: '13px', color: 'var(--color-text-3)' }}>Loading…</div>
      ) : sentTo ? (
        <div style={{ fontSize: '13px', color: 'var(--color-success-text, #1B7F3B)' }}>
          ✓ Forwarded to <b>{sentTo}</b>. They can reply from that email to reach the prospect directly.
        </div>
      ) : (
        <>
          <div style={{ fontSize: '12px', color: 'var(--color-text-3)', marginBottom: '10px', lineHeight: 1.5 }}>
            Sends the full thread from <b>{detail?.mailbox || 'the campaign mailbox'}</b>, with Reply-To set to the
            prospect{detail?.recipient ? <> (<b>{detail.recipient}</b>)</> : null} — so whoever receives it can reply straight to the prospect.
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-3)', minWidth: '30px' }}>To</span>
            <input value={recipient} onChange={e => setRecipient(e.target.value)}
              placeholder="teammate@company.com — leave empty to use the campaign's Forward-Replies-To"
              style={{ ...inputStyle, flex: 1, minWidth: '260px' }} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: 'var(--color-text-3)', minWidth: '30px' }}>Cc</span>
            <input value={cc} onChange={e => setCc(e.target.value)}
              placeholder="Optional — comma-separated addresses to Cc"
              style={{ ...inputStyle, flex: 1, minWidth: '260px' }} />
          </div>

          <textarea
            value={note} onChange={e => setNote(e.target.value)} rows={3}
            placeholder="Optional note to the recipient (added above the forwarded thread)…"
            style={{ ...inputStyle, width: '100%', resize: 'vertical', lineHeight: 1.5, marginBottom: '8px' }} />

          {error && <div style={{ fontSize: '12.5px', color: 'var(--color-danger-text)', marginBottom: '8px' }}>{error}</div>}

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={send} disabled={sending}
              style={{ padding: '8px 18px', background: sending ? 'var(--color-border-2)' : 'var(--color-brand)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 700, cursor: sending ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}>
              {sending ? 'Forwarding…' : 'Forward'}
            </button>
            <span style={{ fontSize: '11.5px', color: 'var(--color-text-3)' }}>from {detail?.mailbox || '—'}</span>
          </div>
        </>
      )}
    </div>
  );
}

function Warn({ text, danger = false }: { text: string; danger?: boolean }) {
  return (
    <div style={{
      fontSize: '12px', padding: '8px 10px', borderRadius: 'var(--radius-sm)', marginBottom: '8px',
      background: danger ? 'var(--color-danger-bg)' : 'var(--color-warning-bg)',
      color: danger ? 'var(--color-danger-text)' : 'var(--color-warning-text)',
    }}>{text}</div>
  );
}

/** A titled, collapsible card used to stack the email thread and the LinkedIn
 *  activity block in the preview pane without making the pane overwhelming. */
function Section({ title, open, onToggle, children }: {
  title: string; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: '18px', border: '1px solid var(--color-border)', borderRadius: '12px', overflow: 'hidden', background: 'var(--color-surface)' }}>
      <div onClick={onToggle} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '13px 18px', cursor: 'pointer', userSelect: 'none' }}>
        <span style={{ display: 'flex', color: 'var(--color-text-3)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4,2 8,6 4,10" /></svg>
        </span>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-1)', flex: 1 }}>{title}</span>
      </div>
      {open && <div style={{ padding: '0 18px 18px' }}>{children}</div>}
    </div>
  );
}

const msg: React.CSSProperties = { padding: '40px 20px', textAlign: 'center', color: 'var(--color-text-3)', fontSize: '13px' };
const loadMoreBtn: React.CSSProperties = {
  padding: '6px 14px', border: '1px solid var(--color-border-2)', background: 'var(--color-bg)',
  borderRadius: 'var(--radius-md)', fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text-1)',
  cursor: 'pointer', fontFamily: 'var(--font-sans)',
};
