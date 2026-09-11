'use client';
import React from 'react';
import { ConfirmDialog } from '@/components/milo/ConfirmDialog';
import { Toast } from '@/components/ui/Toast';
import { EmptyState, EmptyIcons } from '@/components/ui/EmptyState';
import { COMPOSE_BODY_HEIGHT, COMPOSE_DOCK_PADDING } from './composeLayout';
import { SelectionReason } from '@/components/milo/SelectionReason';
import {
  fetchMyTasksToday, completeMyTask, skipMyTask, refillMyTasks,
  listImportCampaigns,
  fetchOutreachTemplates, fetchEmailPreview, sendOutreach, enrichProspectEmails,
  fetchOutreachReplyDetail, sendOutreachReply, resolveOutreachResponse,
  sendLinkedInInvite,
  fetchHrEmailPreview, sendHrOutreach, setProspectSelection,
  type MyTasksToday, type DailyTask, type DailyTaskProspect, type DailyResponse,
  fetchCompanyIntel,
  type OutreachTemplate, type OutreachReplyDetail, type CompanyIntel,
} from '@/lib/leadFunnelApi';
import { formatDateTime } from '@/lib/datetime';

/* ── shared bits ── */

/** A company may have at most this many prospects selected for contact in a day.
 *  Mirrors the server's own cap (icp_selection_service.MAX_SELECTED_PER_COMPANY);
 *  the server is authoritative — this only lets the UI explain the limit up front
 *  instead of letting the user discover it by being refused. */
const MAX_SELECTED_PER_COMPANY = 2;

const primaryBtn: React.CSSProperties = { padding: '7px 16px', background: 'var(--color-brand)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' };
const ghostBtn: React.CSSProperties = { padding: '7px 16px', background: 'var(--color-bg)', color: 'var(--color-text-1)', border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' };
const cap: React.CSSProperties = { fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--color-text-3)' };

function SectionIcon({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: 'var(--radius-sm)', flexShrink: 0, background: 'var(--color-brand-subtle)', color: 'var(--color-brand-text)' }}>{children}</span>
  );
}
const RepliesIcon = (
  <svg width="13" height="13" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polyline points="7,4 3,8 7,12" /><path d="M3 8h7a5 5 0 0 1 5 5v1" /></svg>
);
const MailIcon = (
  <svg width="13" height="13" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><rect x="2" y="4" width="14" height="10" rx="1.5" /><polyline points="2.5,5 9,10 15.5,5" /></svg>
);

// Flatten an email snippet (often raw/truncated HTML with <style>/comment blocks)
// into a single line of readable text for the response cards.
function htmlToSnippet(html: string): string {
  if (!html) return '';
  if (typeof window !== 'undefined' && window.DOMParser) {
    try {
      let s = html;
      // Snippets can be double-encoded (escaped HTML of HTML), so decode+strip
      // repeatedly until no more markup surfaces.
      for (let i = 0; i < 4 && /[<&]/.test(s); i++) {
        const doc = new DOMParser().parseFromString(s, 'text/html');
        doc.querySelectorAll('style, script, head, meta, title').forEach(el => el.remove());
        const text = doc.body?.textContent ?? '';
        if (text === s) break;
        s = text;
      }
      return s.replace(/[​-‍﻿]/g, '').replace(/\s+/g, ' ').trim();
    } catch { /* fall through to regex */ }
  }
  return htmlToText(html)
    .replace(/<!--[\s\S]*?(-->|$)/g, ' ')
    .replace(/<style[\s\S]*?(<\/style>|$)/gi, ' ')
    .replace(/&#65279;|[​-‍﻿]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Rough HTML→text for seeding the editable body from a rendered preview.
function htmlToText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\/\s*p\s*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/\n{3,}/g, '\n\n').trim();
}

/* ── skeleton ──
   A shimmering placeholder that mirrors the board's two-pane shape (company
   list + compose panel) so the layout doesn't jump when real data arrives. */
function SkeletonBar({ w = '100%', h = 12, r = 6, style }: { w?: number | string; h?: number; r?: number; style?: React.CSSProperties }) {
  return <div className="sk-shimmer" style={{ width: w, height: h, borderRadius: r, flexShrink: 0, ...style }} />;
}

function Skeleton() {
  const listRow = (key: number) => (
    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 20px', borderBottom: '1px solid var(--color-border)' }}>
      <SkeletonBar w={12} h={12} r={3} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '7px' }}>
        <SkeletonBar w="55%" h={12} />
        <SkeletonBar w="35%" h={10} />
      </div>
    </div>
  );
  return (
    <>
      <style>{`
        .sk-shimmer{background:linear-gradient(90deg,var(--color-surface) 25%,var(--color-border) 37%,var(--color-surface) 63%);background-size:400% 100%;animation:sk-shimmer 1.4s ease infinite;}
        @keyframes sk-shimmer{0%{background-position:100% 0}100%{background-position:-100% 0}}
      `}</style>

      {/* left: company list */}
      <div style={{ flex: '40 1 0', overflowY: 'hidden', minWidth: 0 }} aria-busy="true" aria-label="Loading tasks">
        <div style={{ background: 'var(--color-surface)', borderLeft: '4px solid var(--color-border-2)', padding: '14px 24px 14px 20px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--color-border)' }}>
          <SkeletonBar w={26} h={26} r={6} />
          <SkeletonBar w={140} h={12} />
          <SkeletonBar w={30} h={18} r={9} style={{ marginLeft: 'auto' }} />
        </div>
        {[0, 1, 2, 3, 4].map(listRow)}
      </div>

      {/* right: compose panel */}
      <aside style={{ flex: '60 1 0', minWidth: '380px', borderLeft: '1px solid var(--color-border)', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} aria-busy="true">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '9px' }}>
            <SkeletonBar w={170} h={16} />
            <SkeletonBar w={230} h={11} />
          </div>
          <SkeletonBar w={26} h={26} r={6} />
        </div>
        <div style={{ flex: 1, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <SkeletonBar w={120} h={10} />
          <SkeletonBar w="100%" h={12} />
          <SkeletonBar w="96%" h={12} />
          <SkeletonBar w="82%" h={12} />
          <div style={{ height: '6px' }} />
          <SkeletonBar w={120} h={10} />
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{ display: 'flex', gap: '12px' }}>
              <SkeletonBar w={100} h={11} />
              <SkeletonBar w={150} h={11} />
            </div>
          ))}
        </div>
        <div style={{ flexShrink: 0, borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)', padding: '14px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <SkeletonBar w={90} h={10} />
          <SkeletonBar w="70%" h={12} />
          <SkeletonBar w="100%" h={140} r={8} />
          <div style={{ display: 'flex', gap: '10px', paddingTop: '4px' }}>
            <SkeletonBar w={100} h={34} r={8} />
            <SkeletonBar w={90} h={34} r={8} />
            <SkeletonBar w={150} h={34} r={8} style={{ marginLeft: 'auto' }} />
          </div>
        </div>
      </aside>
    </>
  );
}

/* ── Outlook-style conversation bits ── */

function initials(name: string): string {
  const parts = (name || '').replace(/<[^>]*>/g, '').replace(/["']/g, '').trim().split(/[\s@._-]+/).filter(Boolean);
  const two = parts.slice(0, 2).map(p => p[0]).join('');
  return (two || (name || '?')[0] || '?').toUpperCase();
}

// Deterministic avatar colour so each sender keeps a stable hue across the thread.
const AVATAR_COLORS = ['#2563eb', '#7c3aed', '#db2777', '#0891b2', '#ea580c', '#059669', '#4f46e5', '#b45309'];
function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

// Wrap a message body (HTML or plain text) in a self-contained document so it
// renders isolated (no style bleed either way) with consistent, mail-client
// typography — the way Outlook frames each message.
function toMessageDoc(body: string): string {
  const b = body || '';
  const looksHtml = /<[a-z!/][\s\S]*>/i.test(b);
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inner = looksHtml ? b : `<p>${esc(b).replace(/\n/g, '<br>')}</p>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  html,body{margin:0;padding:0;}
  body{padding:14px 16px;font-family:'Segoe UI',system-ui,-apple-system,'Helvetica Neue',Arial,sans-serif;font-size:13.5px;line-height:1.55;color:#1b1b1b;word-wrap:break-word;overflow-wrap:break-word;}
  p{margin:0 0 10px;} img{max-width:100%;height:auto;} a{color:#2563eb;}
  table{max-width:100%;} *{max-width:100%;box-sizing:border-box;}
</style></head><body>${inner}</body></html>`;
}

// Isolated, auto-height message body (each message gets its own frame).
function MessageBody({ body }: { body: string }) {
  const ref = React.useRef<HTMLIFrameElement>(null);
  const [h, setH] = React.useState(80);
  const resize = React.useCallback(() => {
    const doc = ref.current?.contentDocument;
    if (!doc) return;
    const sh = Math.max(doc.body?.scrollHeight || 0, doc.documentElement?.scrollHeight || 0);
    if (sh) setH(Math.min(sh + 2, 640));
  }, []);
  return (
    <iframe ref={ref} srcDoc={toMessageDoc(body)} title="Message" onLoad={resize}
      style={{ width: '100%', height: `${h}px`, border: 0, background: '#fff', display: 'block' }} />
  );
}

interface ThreadMsg { name: string; email: string; at: string | null; body: string; outbound: boolean }

// One collapsible message card in the conversation.
function ThreadMessage({ msg, defaultOpen }: { msg: ThreadMsg; defaultOpen: boolean }) {
  const [open, setOpen] = React.useState(defaultOpen);
  React.useEffect(() => { setOpen(defaultOpen); }, [defaultOpen]);
  const color = avatarColor(msg.email || msg.name || 'x');
  return (
    <div style={{ flexShrink: 0, border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg)', overflow: 'hidden' }}>
      <div onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '10px 14px', cursor: 'pointer', background: open ? 'var(--color-surface)' : 'var(--color-bg)' }}>
        <span style={{ width: '34px', height: '34px', borderRadius: '50%', background: color, color: '#fff', fontSize: '12.5px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{initials(msg.name || msg.email)}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{msg.name || msg.email || 'Unknown'}</span>
            {msg.outbound && <span style={{ fontSize: '9.5px', fontWeight: 700, color: 'var(--color-brand-text)', background: 'var(--color-brand-subtle)', padding: '1px 6px', borderRadius: 'var(--radius-full)', flexShrink: 0 }}>YOU</span>}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--color-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {open ? (msg.email || '') : htmlToSnippet(msg.body)}
          </div>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--color-text-3)', flexShrink: 0, whiteSpace: 'nowrap' }}>{formatDateTime(msg.at)}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0, color: 'var(--color-text-3)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
          <polyline points="2,4 6,8 10,4" />
        </svg>
      </div>
      {open && <div style={{ borderTop: '1px solid var(--color-border)' }}><MessageBody body={msg.body} /></div>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   Reply thread — opens an existing outreach conversation with a composer.
   ══════════════════════════════════════════════════════════════════════════════ */

function ThreadPanel({ outreachId, onClose, onReplied, onResolved }: { outreachId: string; onClose: () => void; onReplied: () => void; onResolved: () => void }) {
  const [detail, setDetail] = React.useState<OutreachReplyDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [confirmSend, setConfirmSend] = React.useState(false);
  const [sendErr, setSendErr] = React.useState<string | null>(null);
  const [resolving, setResolving] = React.useState(false);
  const [resolveErr, setResolveErr] = React.useState<string | null>(null);

  // "Mark as replied": reconcile just this thread from Graph. If we've since replied
  // (in-app or in Outlook) it resolves as replied; otherwise it's hidden from the rail.
  // Either way it leaves the Responses list, so we reload + close on success.
  const resolve = async () => {
    if (resolving) return;
    setResolving(true); setResolveErr(null);
    try {
      await resolveOutreachResponse(outreachId);
      onResolved();
    } catch (e) {
      setResolveErr(e instanceof Error ? e.message : 'Could not resolve this thread');
      setResolving(false);
    }
  };

  const load = React.useCallback(async () => {
    setLoading(true); setErr(null);
    try { setDetail(await fetchOutreachReplyDetail(outreachId)); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Failed to load conversation'); }
    finally { setLoading(false); }
  }, [outreachId]);
  React.useEffect(() => { load(); }, [load]);

  const send = async () => {
    if (!draft.trim() || sending) return;
    setSending(true); setSendErr(null);
    try {
      const r = await sendOutreachReply(outreachId, { body: draft });
      setDraft('');
      setDetail(d => d ? { ...d, replies: r.replies, canReply: r.canReply } : d);
      setConfirmSend(false);
      onReplied();
    } catch (e) { setSendErr(e instanceof Error ? e.message : 'Could not send the reply'); }
    finally { setSending(false); }
  };

  // Flatten the conversation into an ordered list of messages (oldest first),
  // the way a mail client renders a thread.
  const messages: ThreadMsg[] = React.useMemo(() => {
    if (!detail) return [];
    const list: ThreadMsg[] = [];
    if (detail.body) {
      list.push({ name: 'You', email: detail.mailbox || '', at: detail.sentAt, body: detail.body, outbound: true });
    }
    for (const r of detail.replies || []) {
      const outbound = (r.direction || 'inbound') === 'outbound';
      const from = (r.from || '').trim();
      list.push({
        name: outbound ? 'You' : (from || detail.recipient || 'Reply'),
        email: outbound ? (detail.mailbox || '') : (from.includes('@') ? from : detail.prospectEmail || ''),
        at: r.receivedAt || r.sentAt || null,
        body: r.body || '',
        outbound,
      });
    }
    return list;
  }, [detail]);
  const lastIdx = messages.length - 1;

  return (
    <aside style={{ flex: '60 1 0', minWidth: '380px', borderLeft: '1px solid var(--color-border)', background: 'var(--color-surface)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', background: 'var(--color-bg)' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-1)', lineHeight: 1.35 }}>{detail?.subject || 'Conversation'}</div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-3)', marginTop: '4px' }}>
            {messages.length > 0 ? `${messages.length} message${messages.length === 1 ? '' : 's'}` : ''}
            {detail?.recipient || detail?.prospectEmail ? `${messages.length ? ' · ' : ''}${detail.recipient || detail.prospectEmail}` : ''}
          </div>
        </div>
        <button onClick={onClose} title="Close" style={{ width: '26px', height: '26px', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-3)', flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="11" y2="11" /><line x1="11" y1="1" x2="1" y2="11" /></svg>
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {loading ? (
          <div style={{ fontSize: '13px', color: 'var(--color-text-3)' }}>Loading…</div>
        ) : err ? (
          <div style={{ fontSize: '13px', color: 'var(--color-danger-text)' }}>{err}</div>
        ) : messages.length ? (
          messages.map((m, i) => <ThreadMessage key={i} msg={m} defaultOpen={i === lastIdx} />)
        ) : (
          <EmptyState icon={EmptyIcons.mail}
            title="No messages yet"
            body="This thread has no messages on it — the reply may still be syncing." />
        )}
      </div>

      <div style={{ flexShrink: 0, borderTop: '1px solid var(--color-border)', background: 'var(--color-bg)', padding: '14px 20px' }}>
        {detail && detail.canReply && (
          <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={3} placeholder="Write your reply…"
            style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: '12.5px', fontFamily: 'var(--font-sans)', color: 'var(--color-text-1)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg)', resize: 'vertical' }} />
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: detail?.canReply ? '10px' : 0 }}>
          <button style={{ ...ghostBtn, opacity: resolving ? 0.6 : 1, cursor: resolving ? 'default' : 'pointer' }}
            disabled={resolving}
            title="Check this thread for your reply — resolves it, or hides it from Responses if you haven't replied"
            onClick={resolve}>{resolving ? 'Checking…' : 'Mark as replied'}</button>
          {detail && !detail.canReply && (
            <span style={{ fontSize: '12px', color: 'var(--color-text-3)' }}>Can’t reply from here.</span>
          )}
          {detail?.canReply && (
            <button style={{ ...primaryBtn, marginLeft: 'auto', opacity: sending || !draft.trim() ? 0.6 : 1 }} disabled={sending || !draft.trim()} onClick={() => { setSendErr(null); setConfirmSend(true); }}>Send reply</button>
          )}
        </div>
        {resolveErr && <div style={{ fontSize: '11.5px', color: 'var(--color-danger-text)', marginTop: '8px' }}>{resolveErr}</div>}
      </div>

      <ConfirmDialog
        open={confirmSend}
        title="Send reply?"
        message={<>This will email your reply to <strong>{detail?.recipient || detail?.prospectEmail || 'the recipient'}</strong>.</>}
        confirmLabel="Send"
        cancelLabel="Dismiss"
        loading={sending}
        loadingLabel="Sending…"
        error={sendErr}
        onConfirm={send}
        onCancel={() => { if (!sending) { setConfirmSend(false); setSendErr(null); } }}
      />
    </aside>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   Company intel — Overview + Facts & Figures, pulled from the account-intel
   report (falls back to the legacy cache). Renders nothing but the fallback
   facts when a company has never been researched.
   ══════════════════════════════════════════════════════════════════════════════ */

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '12px', fontSize: '12.5px', padding: '5px 0' }}>
      <span style={{ color: 'var(--color-text-3)', width: '120px', flexShrink: 0 }}>{label}</span>
      <span style={{ color: 'var(--color-text-1)', fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function CompanyIntelSection({ task }: { task: DailyTask }) {
  const [intel, setIntel] = React.useState<CompanyIntel | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!task.companyLinkedin && !task.companyName) { setIntel(null); return; }
    let alive = true;
    setLoading(true);
    fetchCompanyIntel(task.companyLinkedin || '', task.companyName || '')
      .then(r => { if (alive) setIntel(r); })
      .catch(() => { if (alive) setIntel(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [task.companyLinkedin, task.companyName]);

  const c = intel?.company;
  const overviewText = (c?.description || intel?.overview?.summary || '').trim();
  const bullets = (intel?.overview?.talking_points?.length
    ? intel.overview.talking_points
    : (intel?.buyingSignals?.items || []).map(i => i.title)
  ).filter(Boolean).slice(0, 3);

  const industry = (c?.industry || task.industry || '').replace(/_/g, ' ');
  const employees = c?.staff_count ? c.staff_count.toLocaleString() : (task.companySize || '');
  const hq = c?.headquarters || task.location || '';
  const facts: Array<[string, React.ReactNode]> = [
    ['Founded', c?.founded_year || ''],
    ['Headquarters', hq],
    ['Employees', employees],
    ['Industry', industry],
  ];
  const shownFacts = facts.filter(([, v]) => v !== '' && v != null);

  return (
    <div style={{ marginBottom: '18px' }}>
      {overviewText ? (
        <>
          <div style={{ ...cap, marginBottom: '8px' }}>Company overview</div>
          <div style={{ fontSize: '13px', lineHeight: 1.65, color: 'var(--color-text-1)', marginBottom: bullets.length ? '10px' : '16px' }}>{overviewText}</div>
        </>
      ) : loading ? (
        <>
          <div style={{ ...cap, marginBottom: '8px' }}>Company overview</div>
          <div style={{ fontSize: '12.5px', color: 'var(--color-text-3)', marginBottom: '16px' }}>Fetching company overview…</div>
        </>
      ) : null}
      {bullets.length > 0 && (
        <ul style={{ margin: '0 0 16px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '7px' }}>
          {bullets.map((b, i) => (
            <li key={i} style={{ display: 'flex', gap: '8px', fontSize: '12.5px', lineHeight: 1.55, color: 'var(--color-text-2)' }}>
              <span style={{ color: 'var(--color-brand)', flexShrink: 0 }}>•</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
      {shownFacts.length > 0 && (
        <>
          <div style={{ ...cap, marginBottom: '4px' }}>Facts &amp; figures</div>
          <div style={{ borderTop: '1px solid var(--color-border)' }}>
            {shownFacts.map(([label, value]) => <Fact key={label} label={label} value={value} />)}
          </div>
        </>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   HR draft — the pinned send area for a search-campaign prospect. The HR email is
   template-rendered server-side (no customize/template picker), sent via the HR
   Kirah mailer, and the send marks the company done. Mirrors the lead-funnel send.
   ══════════════════════════════════════════════════════════════════════════════ */

function HrDraft({ prospect, companyName, onSent }: {
  prospect: DailyTaskProspect | undefined; companyName: string; onSent: (updated: MyTasksToday) => void;
}) {
  const [preview, setPreview] = React.useState<{ subject: string; html: string } | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const [confirmSend, setConfirmSend] = React.useState(false);
  const [sendErr, setSendErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!prospect) { setPreview(null); return; }
    let alive = true;
    setLoading(true); setErr(null);
    fetchHrEmailPreview(prospect.id)
      .then(r => {
        if (!alive) return;
        if (r.success && (r.html || r.subject)) setPreview({ subject: r.subject || '', html: r.html || '' });
        else { setPreview(null); setErr(r.error || 'No draft available'); }
      })
      .catch(e => { if (alive) { setPreview(null); setErr(e instanceof Error ? e.message : 'Preview failed'); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [prospect?.id]);

  const send = async () => {
    if (!prospect?.hasEmail || sending) return;
    setSending(true); setSendErr(null);
    try {
      const updated = await sendHrOutreach(prospect.id);
      setConfirmSend(false);
      onSent(updated);
    } catch (e) {
      setSendErr(e instanceof Error ? e.message : 'Could not send the email');
      setSending(false);
    }
  };

  return (
    <div style={{ flexShrink: 0, borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)', padding: COMPOSE_DOCK_PADDING }}>
      <div style={{ ...cap, marginBottom: '8px' }}>Draft email <span style={{ fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'none', letterSpacing: 0 }}>· search campaign</span></div>
      {prospect && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 14px', marginBottom: '12px', fontSize: '12.5px', lineHeight: 1.6 }}>
          <div style={{ minWidth: 0 }}>
            <span style={{ color: 'var(--color-text-3)' }}>To </span>
            <span style={{ color: 'var(--color-text-1)', fontWeight: 600 }}>{prospect.name}</span>
            {prospect.title ? <span style={{ color: 'var(--color-text-2)' }}> · {prospect.title}</span> : null}
          </div>
          {preview && (
            <>
              <span style={{ width: '1px', height: '13px', background: 'var(--color-border-2)', flexShrink: 0 }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '1 1 220px', minWidth: 0 }}>
                <span style={{ color: 'var(--color-text-3)', flexShrink: 0 }}>Subject </span>
                <span style={{ color: 'var(--color-text-1)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview.subject || '—'}</span>
              </div>
            </>
          )}
        </div>
      )}

      {!prospect?.hasEmail ? (
        <div style={{ border: '1px dashed var(--color-border-2)', borderRadius: 'var(--radius-md)', padding: '16px', textAlign: 'center', fontSize: '12.5px', color: 'var(--color-text-3)' }}>
          This prospect has no email address.
        </div>
      ) : loading ? (
        <div style={{ fontSize: '12.5px', color: 'var(--color-text-3)', padding: '10px 0' }}>Rendering draft…</div>
      ) : preview ? (
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <iframe srcDoc={preview.html} title="Email preview" style={{ width: '100%', height: `${COMPOSE_BODY_HEIGHT}px`, border: 0, background: '#fff', display: 'block' }} />
        </div>
      ) : (
        <div style={{ fontSize: '12.5px', color: 'var(--color-text-3)', padding: '10px 0' }}>{err || 'No draft available.'}</div>
      )}

      <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <button style={{ ...primaryBtn, opacity: (sending || !prospect?.hasEmail || !preview) ? 0.6 : 1 }} disabled={sending || !prospect?.hasEmail || !preview} onClick={() => { setSendErr(null); setConfirmSend(true); }}>
          Send email
        </button>
        {sendErr && !confirmSend && <span style={{ fontSize: '11.5px', color: 'var(--color-danger-text)' }}>{sendErr}</span>}
      </div>

      <ConfirmDialog
        open={confirmSend}
        title="Send email?"
        message={<>This will email <strong>{prospect?.name || 'this prospect'}</strong>{prospect?.email ? <> (<span style={{ color: 'var(--color-text-1)' }}>{prospect.email}</span>)</> : null} and mark <strong>{companyName}</strong> as emailed.</>}
        confirmLabel="Send"
        cancelLabel="Dismiss"
        loading={sending}
        loadingLabel="Sending…"
        error={sendErr}
        onConfirm={send}
        onCancel={() => { if (!sending) { setConfirmSend(false); setSendErr(null); } }}
      />
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   Compose panel — company detail + the draft email for the selected prospect.
   The recipient is chosen in the left tree; sending completes the task.
   ══════════════════════════════════════════════════════════════════════════════ */

function ComposePanel({ task, prospectId, templates, defaultTemplateIds = [], onClose, onSent, onReload }: {
  task: DailyTask; prospectId: string; templates: OutreachTemplate[];
  /** Templates pinned as this prospect's campaign default. The first is pre-selected
   *  and the picker is scoped to these; empty = fall back to Auto + all templates. */
  defaultTemplateIds?: string[];
  onClose: () => void; onSent: (updated: MyTasksToday) => void; onReload: () => void;
}) {
  const runId = task.runId || task.prospects[0]?.runId || '';
  const prospect = task.prospects.find(p => p.id === prospectId) ?? task.prospects[0];
  // Pre-select the campaign's default template (first pinned) so the daily worklist
  // drafts from the template the user configured, not a generic persona fallback.
  const campaignDefaultId = defaultTemplateIds[0] ?? null;
  const [templateId, setTemplateId] = React.useState<string | null>(campaignDefaultId);
  // The campaign defaults can resolve after this panel mounts (campaigns load in the
  // background). Adopt the default once, unless the user has already picked a template.
  const templateTouched = React.useRef(false);
  React.useEffect(() => {
    if (!templateTouched.current) setTemplateId(campaignDefaultId);
  }, [campaignDefaultId]);
  // Templates offered in the picker: the campaign's pinned defaults when any resolve,
  // otherwise the full list. "Auto" stays available as an explicit override.
  const pinnedTemplates = defaultTemplateIds.length
    ? templates.filter(t => defaultTemplateIds.includes(t._id))
    : [];
  const pickerTemplates = pinnedTemplates.length ? pinnedTemplates : templates;

  const [preview, setPreview] = React.useState<{ subject: string; html: string } | null>(null);
  const [pvLoading, setPvLoading] = React.useState(false);
  const [pvError, setPvError] = React.useState<string | null>(null);

  // Customize edits the rendered HTML in place (WYSIWYG), mirroring the Email
  // Template screen — never a text-stripped body. The edited HTML is read back
  // from the iframe on send and passed through verbatim as the outreach body.
  const [customize, setCustomize] = React.useState(false);
  const [editSubject, setEditSubject] = React.useState('');
  const [editNonce, setEditNonce] = React.useState(0); // bump to remount iframe (discard edits)
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  const [sending, setSending] = React.useState(false);
  const [enriching, setEnriching] = React.useState(false);
  const [sendErr, setSendErr] = React.useState<string | null>(null);
  const [confirmSend, setConfirmSend] = React.useState(false);

  // Pacing is now server-side (the durable send queue): the user can click freely and
  // the backend spaces sends per-user. No frontend cooldown.

  // LinkedIn invite (queued to the connected account via the send queue).
  const [liBusy, setLiBusy] = React.useState(false);
  const [liNote, setLiNote] = React.useState<string | null>(null);
  const [liSent, setLiSent] = React.useState(false);

  // Reset the LinkedIn-invite state when the selected prospect changes.
  React.useEffect(() => { setLiBusy(false); setLiNote(null); setLiSent(false); }, [prospectId]);

  const sendLinkedIn = async () => {
    if (!prospect || liBusy) return;
    setLiBusy(true); setLiNote(null);
    try {
      const r = await sendLinkedInInvite(prospect.id, prospect.runId || runId);
      setLiSent(true);
      // The invite is now queued and paced server-side; it sends in the background.
      setLiNote(r.status === 'queued' ? 'LinkedIn invite queued'
        : r.status === 'invite_sent' ? 'LinkedIn invite sent' : `Status: ${r.status}`);
    } catch (e) {
      setLiNote(e instanceof Error ? e.message : 'Could not queue the LinkedIn invite');
    } finally { setLiBusy(false); }
  };

  // Leaving this prospect/template exits any in-progress edit.
  React.useEffect(() => { setCustomize(false); }, [prospectId, templateId]);

  // Keep formatting locked so the template layout can't drift — wording only.
  const blockFormatting = React.useCallback((e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && (k === 'b' || k === 'i' || k === 'u')) e.preventDefault();
  }, []);
  const forcePlainPaste = React.useCallback((e: ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain') ?? '';
    iframeRef.current?.contentDocument?.execCommand('insertText', false, text);
  }, []);
  const stopEditListeners = React.useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    doc.designMode = 'off';
    doc.removeEventListener('keydown', blockFormatting, true);
    doc.removeEventListener('paste', forcePlainPaste, true);
  }, [blockFormatting, forcePlainPaste]);

  // Load the server-rendered preview when prospect/template changes.
  React.useEffect(() => {
    if (!prospect?.hasEmail || !runId) { setPreview(null); return; }
    let alive = true;
    setPvLoading(true); setPvError(null);
    fetchEmailPreview(runId, prospect.id, templateId)
      .then(r => {
        if (!alive) return;
        if (r.success && (r.html || r.subject)) setPreview({ subject: r.subject || '', html: r.html || '' });
        else { setPreview(null); setPvError(r.error || 'No preview available'); }
      })
      .catch(e => { if (alive) { setPreview(null); setPvError(e instanceof Error ? e.message : 'Preview failed'); } })
      .finally(() => { if (alive) setPvLoading(false); });
    return () => { alive = false; };
  }, [prospect?.id, prospect?.hasEmail, templateId, runId]);

  const startCustomize = () => {
    setEditSubject(preview?.subject || '');
    setCustomize(true);
    // The preview iframe is already mounted — turn it into a live editor.
    const doc = iframeRef.current?.contentDocument;
    if (doc) {
      doc.designMode = 'on';
      doc.addEventListener('keydown', blockFormatting, true);
      doc.addEventListener('paste', forcePlainPaste, true);
      doc.body?.focus();
    }
  };
  const discardCustomize = () => {
    stopEditListeners();
    setCustomize(false);
    setEditNonce(n => n + 1); // remount iframe from preview.html → drops edits
  };

  const enrich = async () => {
    if (!runId || !prospect) return;
    setEnriching(true); setSendErr(null);
    try { await enrichProspectEmails(runId, [prospect.id]); onReload(); }
    catch (e) { setSendErr(e instanceof Error ? e.message : 'Could not reveal email'); }
    finally { setEnriching(false); }
  };

  const send = async () => {
    if (!prospect?.hasEmail || !runId || sending) return;
    setSending(true); setSendErr(null);
    try {
      let overrides;
      if (customize) {
        const doc = iframeRef.current?.contentDocument;
        const html = doc?.documentElement?.outerHTML || preview?.html || '';
        overrides = { [prospect.id]: { subject: editSubject, body: html } };
      }
      // Enqueue; the backend paces the actual send. Refresh so the prospect shows
      // "Queued" immediately (it flips to "Sent" when the worker sends it).
      await sendOutreach(runId, [prospect.id], templateId, overrides);
      const updated = await completeMyTask(task.companyName);
      setConfirmSend(false);
      onSent(updated);
    } catch (e) {
      setSendErr(e instanceof Error ? e.message : 'Could not queue the email');
    } finally {
      setSending(false);
    }
  };

  const industry = (task.industry || '').replace(/_/g, ' ');
  // Search (HR) campaigns feed the worklist but sending from here isn't wired yet
  // (Phase 2). Show the company + people, but not the lead-funnel compose/send.
  const isHr = task.source === 'hr';
  // Company LinkedIn link for the header title (companyLinkedin is a full URL on most
  // rows; fall back to building one from a bare slug).
  const companyHref = task.companyLinkedin
    ? (/^https?:\/\//i.test(task.companyLinkedin) ? task.companyLinkedin : `https://www.linkedin.com/company/${task.companyLinkedin}`)
    : null;

  return (
    <aside style={{ flex: '60 1 0', minWidth: '380px', borderLeft: '1px solid var(--color-border)', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {companyHref ? (
              <a href={companyHref} target="_blank" rel="noreferrer"
                title="Open company on LinkedIn"
                style={{ fontSize: '17px', fontWeight: 700, color: 'var(--color-avatar-blue, #2563eb)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>
                {task.companyName} ↗
              </a>
            ) : (
              <span style={{ fontSize: '17px', fontWeight: 700, color: 'var(--color-text-1)' }}>{task.companyName}</span>
            )}
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--color-text-2)', marginTop: '3px' }}>
            {[industry, task.location].filter(Boolean).join(' · ') || `${task.prospects.length} prospect${task.prospects.length === 1 ? '' : 's'}`}
          </div>
        </div>
        <button onClick={onClose} title="Close" style={{ width: '26px', height: '26px', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-3)', flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="11" y2="11" /><line x1="11" y1="1" x2="1" y2="11" /></svg>
        </button>
      </div>

      {/* body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>
        <CompanyIntelSection task={task} />
      </div>


      {/* Search-campaign (HR) companies send via the HR mailer (template-rendered,
          no customize); lead-funnel companies use the full compose/customize path. */}
      {isHr ? (
        <HrDraft prospect={prospect} companyName={task.companyName} onSent={onSent} />
      ) : (
      /* pinned draft area — a fixed place at the bottom (mirrors the mock);
          only the company intel above scrolls, the draft/preview stays put */
      <div style={{ flexShrink: 0, borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)', padding: COMPOSE_DOCK_PADDING }}>
        {/* draft header: heading + template picker inline */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0, flexWrap: 'wrap' }}>
            <span style={cap}>Draft email</span>
            {prospect && (
              prospect.linkedinUrl ? (
                <a href={prospect.linkedinUrl} target="_blank" rel="noreferrer"
                  title="Open LinkedIn profile"
                  style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-avatar-blue, #2563eb)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                  onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                  onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}>
                  {prospect.name} ↗
                </a>
              ) : (
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-2)' }}>{prospect.name}</span>
              )
            )}
          </div>
          {!isHr && (
            <select value={templateId ?? ''} onChange={e => { templateTouched.current = true; setTemplateId(e.target.value || null); }}
              style={{ flex: '0 1 260px', minWidth: '160px', boxSizing: 'border-box', padding: '6px 10px', fontSize: '12px', fontFamily: 'var(--font-sans)', color: 'var(--color-text-1)', border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg)' }}>
              <option value="">Auto (best match for persona)</option>
              {pickerTemplates.map(t => <option key={t._id} value={t._id}>{t.name || t.subject || `${t.persona} · ${t.outreachType}`}</option>)}
            </select>
          )}
        </div>
        {prospect && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px 14px', marginBottom: '12px', fontSize: '12.5px', lineHeight: 1.6 }}>
            <div style={{ minWidth: 0 }}>
              <span style={{ color: 'var(--color-text-3)' }}>To </span>
              {prospect.email
                ? <span style={{ color: 'var(--color-text-1)', fontWeight: 600 }}>{prospect.email}</span>
                : <span style={{ color: 'var(--color-text-3)', fontStyle: 'italic' }}>No email address</span>}
            </div>
            {preview && (
              <>
                <span style={{ width: '1px', height: '13px', background: 'var(--color-border-2)', flexShrink: 0 }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '1 1 220px', minWidth: 0 }}>
                  <span style={{ color: 'var(--color-text-3)', flexShrink: 0 }}>Subject </span>
                  {customize ? (
                    <input value={editSubject} onChange={e => setEditSubject(e.target.value)} placeholder="Subject"
                      style={{ flex: 1, minWidth: 0, boxSizing: 'border-box', padding: '5px 8px', fontSize: '12.5px', fontWeight: 600, fontFamily: 'var(--font-sans)', color: 'var(--color-text-1)', border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg)' }} />
                  ) : (
                    <span style={{ color: 'var(--color-text-1)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview.subject || '—'}</span>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {!prospect?.hasEmail ? (
          <div style={{ border: '1px dashed var(--color-border-2)', borderRadius: 'var(--radius-md)', padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '12.5px', color: 'var(--color-text-3)', lineHeight: 1.6, marginBottom: '10px' }}>This prospect has no email address yet.</div>
            <button style={{ ...primaryBtn, opacity: enriching ? 0.6 : 1 }} disabled={enriching} onClick={enrich}>{enriching ? 'Revealing…' : 'Reveal email (Apollo)'}</button>
          </div>
        ) : pvLoading ? (
          <div style={{ fontSize: '12.5px', color: 'var(--color-text-3)', padding: '10px 0' }}>Rendering preview…</div>
        ) : preview ? (
          <>
            {customize && (
              <div style={{ fontSize: '11px', color: 'var(--color-text-3)', marginBottom: '6px' }}>
                Editing wording directly in the email — bold/italic and rich paste are locked so the layout can’t drift.
              </div>
            )}
            <div style={{ border: `1px solid ${customize ? 'var(--color-brand)' : 'var(--color-border)'}`, borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              {/* body — rendered HTML; becomes a live editor in customize mode */}
              <iframe
                ref={iframeRef}
                key={`${prospect.id}-${templateId ?? 'auto'}-${editNonce}`}
                srcDoc={preview.html}
                title="Email preview"
                style={{ width: '100%', height: `${COMPOSE_BODY_HEIGHT}px`, border: 0, background: '#fff', display: 'block' }}
              />
            </div>
          </>
        ) : (
          <div style={{ fontSize: '12.5px', color: 'var(--color-text-3)', padding: '10px 0' }}>{pvError || 'No preview available.'}</div>
        )}

        {/* action bar */}
        <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <button style={{ ...primaryBtn, opacity: (sending || !prospect?.hasEmail) ? 0.6 : 1, cursor: (sending || !prospect?.hasEmail) ? 'not-allowed' : 'pointer' }}
          disabled={sending || !prospect?.hasEmail}
          title="Send email"
          onClick={() => { setSendErr(null); setConfirmSend(true); }}>
          {sending ? 'Queuing…' : 'Send email'}
        </button>
        {prospect?.hasEmail && preview && (
          <button style={ghostBtn} onClick={customize ? discardCustomize : startCustomize}>
            {customize ? 'Discard edits' : 'Edit draft'}
          </button>
        )}
        {sendErr && !confirmSend && <span style={{ fontSize: '11.5px', color: 'var(--color-danger-text)' }}>{sendErr}</span>}
        {liNote && <span style={{ fontSize: '11.5px', color: liSent ? 'var(--color-success-text)' : 'var(--color-danger-text)' }}>{liNote}</span>}
        {(() => {
          const liDisabled = !prospect?.linkedinUrl || liBusy || liSent;
          return (
        <button
          onClick={sendLinkedIn}
          disabled={liDisabled}
          title={!prospect?.linkedinUrl ? 'No LinkedIn profile sourced for this prospect yet' : 'Send a LinkedIn connection invite'}
          style={{ ...ghostBtn, marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '7px', cursor: liDisabled ? 'not-allowed' : 'pointer', opacity: liDisabled ? 0.55 : 1 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" style={{ flexShrink: 0 }} aria-hidden>
            <rect width="24" height="24" rx="4" fill="var(--color-avatar-blue, #2563eb)" />
            <path d="M7 9.5h2.1V17H7zM8.05 6.2a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5zM10.8 9.5h2v1.02c.28-.53 1.05-1.18 2.27-1.18 2 0 2.6 1.18 2.6 3.18V17h-2.1v-3.1c0-.84-.3-1.42-1.06-1.42-.66 0-1.02.45-1.2.88-.06.16-.07.38-.07.6V17h-2.1z" fill="#fff" />
          </svg>
          {liBusy ? 'Queuing…' : liSent ? 'Invite queued' : 'Send LinkedIn Invite'}
        </button>
          );
        })()}
        </div>
      </div>
      )}

      <ConfirmDialog
        open={confirmSend}
        title="Send email?"
        message={<>This will send the {customize ? 'customized ' : ''}email to <strong>{prospect?.name || 'this prospect'}</strong>{prospect?.email ? <> (<span style={{ color: 'var(--color-text-1)' }}>{prospect.email}</span>)</> : null}. <strong>{task.companyName}</strong> stays on your list until every prospect has been emailed.</>}
        confirmLabel="Send"
        cancelLabel="Dismiss"
        loading={sending}
        loadingLabel="Sending…"
        error={sendErr}
        onConfirm={send}
        onCancel={() => { if (!sending) { setConfirmSend(false); setSendErr(null); } }}
      />
    </aside>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   Company row — an expandable tree node. Collapsed it's a company; expanded it
   reveals its prospects as selectable cards. Selecting one drives the panel.
   ══════════════════════════════════════════════════════════════════════════════ */

function CompanyRow({ task, expanded, selectedProspectId, onToggle, onSelectProspect, onRemove, removing,
                     onToggleSelection, selectionBusy }: {
  task: DailyTask; expanded: boolean; selectedProspectId: string | null;
  onToggle: () => void; onSelectProspect: (id: string) => void;
  onRemove: () => void; removing: boolean;
  /** Select/deselect a prospect for sending. Rejects a 3rd with a message. */
  onToggleSelection: (p: DailyTaskProspect, nextSelected: boolean) => void;
  /** Prospect id currently being saved, so its chip can show progress. */
  selectionBusy: string | null;
}) {
  const [hov, setHov] = React.useState(false);
  // Which chip the pointer is over. An unselected prospect shows no tick at rest, so
  // the affordance to select one has to appear on hover — without this there would be
  // nothing to click.
  const [hovProspect, setHovProspect] = React.useState<string | null>(null);
  // How many of this company's two contact slots are taken. Derived from the same
  // field automation reads, so what the board shows is what will actually be sent.
  const selectedCount = task.prospects.filter(p => p.selectionStatus === 'selected').length;
  const atCap = selectedCount >= MAX_SELECTED_PER_COMPANY;
  // Progress across the company's emailable prospects — the company closes only when
  // every one has been emailed, so surface "X/Y emailed" once at least one is sent.
  const emailable = task.prospects.filter(p => p.hasEmail);
  const sentCount = emailable.filter(p => p.sent).length;
  const progress = emailable.length > 1 && sentCount > 0 ? `${sentCount}/${emailable.length} emailed` : '';
  const meta = [(task.industry || '').replace(/_/g, ' '), task.location, progress].filter(Boolean).join(' · ');
  return (
    <div style={{ borderBottom: '1px solid var(--color-border)' }}>
      <div onClick={onToggle} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 20px', cursor: 'pointer', background: hov || expanded ? 'var(--color-row-hover)' : 'var(--color-bg)', minHeight: '52px', borderLeft: `3px solid ${expanded ? 'var(--color-brand)' : 'transparent'}` }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0, color: 'var(--color-text-3)', transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>
          <polyline points="4,2 9,6 4,10" />
        </svg>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.companyName}</div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {meta || `${task.prospects.length} prospect${task.prospects.length === 1 ? '' : 's'}`}
          </div>
        </div>
        {(() => {
          // Prefer the campaign name; fall back to the run name when the company
          // came from an orphan/legacy run (no campaign) or a deleted campaign.
          const label = task.campaignName || task.runName;
          if (!label) return null;
          const isRun = !task.campaignName;
          return (
            <span title={`${isRun ? 'Run' : 'Campaign'}: ${label}`}
              style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-brand-text)', background: 'var(--color-brand-subtle)', padding: '3px 9px', borderRadius: 'var(--radius-full)', flexShrink: 0, maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {label}
            </span>
          );
        })()}
        <button onClick={e => { e.stopPropagation(); onRemove(); }} disabled={removing} title="Skip this account"
          style={{ width: '24px', height: '24px', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-3)', flexShrink: 0, opacity: removing ? 0.4 : (hov ? 1 : 0.5) }}>
          <svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1.5" y1="1.5" x2="10.5" y2="10.5" /><line x1="10.5" y1="1.5" x2="1.5" y2="10.5" /></svg>
        </button>
      </div>

      {expanded && (
        <div style={{ padding: '4px 20px 14px 42px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {task.prospects.length === 0 ? (
            <EmptyState align="left" icon={EmptyIcons.users}
              title="No prospects on this company"
              body="Nobody has been discovered here yet — run prospect discovery on the campaign to fill it." />
          ) : task.prospects.map(p => {
            const on = p.id === selectedProspectId;
            const selected = p.selectionStatus === 'selected';
            const busy = selectionBusy === p.id;
            // At the cap and not one of the two holding a slot, or already emailed —
            // either way this person cannot be selected right now. Nothing is dimmed
            // for it: the tick's absence already says they are not being contacted.
            const locked = (!selected && atCap) || !!p.sent;
            const hovering = hovProspect === p.id;
            return (
              // A div, not a button: it contains the tick toggle, and a button inside
              // a button is invalid. Keyboard behaviour is restored explicitly below.
              <div key={p.id} role="button" tabIndex={0}
                onClick={() => onSelectProspect(p.id)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectProspect(p.id); } }}
                onMouseEnter={() => setHovProspect(p.id)}
                onMouseLeave={() => setHovProspect(null)}
                title={p.sent ? `${p.name} · already emailed` : p.name}
                style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '9px 12px', minWidth: '150px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'var(--font-sans)', textAlign: 'left',
                  // NOT overflow:hidden — the reason tooltip renders above the chip
                  // and would otherwise be clipped.
                  position: 'relative',
                  border: `1.5px solid ${on ? 'var(--color-brand)' : (p.sent ? 'var(--color-success, #16a34a)' : 'var(--color-border)')}`,
                  background: on ? 'var(--color-brand-subtle)' : 'var(--color-bg)' }}>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                    {/* The tick is the whole selection signal: present means this
                        person will be contacted, absent means they will not. It is
                        also the toggle, so an unselected prospect still needs a hit
                        target — hence the faint outline that appears on hover. */}
                    {(selected || busy || (hovering && !locked)) && (
                      <button
                        onClick={e => { e.stopPropagation(); if (!p.sent) onToggleSelection(p, !selected); }}
                        disabled={busy || !!p.sent}
                        aria-pressed={selected}
                        aria-label={selected ? `Deselect ${p.name}` : `Select ${p.name}`}
                        title={p.sent ? `${p.name} · already emailed`
                          : selected ? `${p.name} is selected — click to deselect`
                          : `Select ${p.name} to be contacted`}
                        style={{ display: 'inline-flex', alignItems: 'center', padding: 0, border: 'none', background: 'none', flexShrink: 0,
                          cursor: p.sent ? 'default' : (busy ? 'wait' : 'pointer') }}>
                        {busy ? (
                          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ animation: 'spin 0.7s linear infinite' }}>
                            <circle cx="7" cy="7" r="5.5" stroke="var(--color-text-3)" strokeWidth="1.6" strokeDasharray="20 10" />
                          </svg>
                        ) : selected ? (
                          <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="7" fill="var(--color-brand)" /><polyline points="4,7.2 6.2,9.2 10,4.8" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        ) : (
                          <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6.2" stroke="var(--color-text-3)" strokeWidth="1.3" /></svg>
                        )}
                      </button>
                    )}
                    {/* The model's justification, on hover. Stop the click from
                        opening the draft when someone is only reading the reason. */}
                    <span onClick={e => { e.stopPropagation(); }}>
                      <SelectionReason
                        reason={p.selectionReason}
                        tier={p.selectionTier}
                        rank={p.selectionRank}
                        manual={p.selectionManual}
                        selected={selected}
                      />
                    </span>
                  </span>
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                     {p.title || '—'}{!p.hasEmail ? ' · no email' : ''}
                  </span>
                </span>
                {p.queueStatus ? (
                  <span title={p.queueStatus === 'sending' ? 'Sending…' : 'Queued to send'} style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10.5px', fontWeight: 700, color: 'var(--color-warning-text, #b45309)' }}>
                    <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="var(--color-warning-text, #b45309)" strokeWidth="1.4" /><path d="M7 4v3l2 1.2" stroke="var(--color-warning-text, #b45309)" strokeWidth="1.4" strokeLinecap="round" fill="none" /></svg>
                    {p.queueStatus === 'sending' ? 'Sending' : 'Queued'}
                  </span>
                ) : p.sent ? (
                  <span title="Email sent" style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10.5px', fontWeight: 700, color: 'var(--color-success, #16a34a)' }}>
                    <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="7" fill="var(--color-success, #16a34a)" /><polyline points="4,7.2 6.2,9.2 10,4.8" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    Sent
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   Main board
   ══════════════════════════════════════════════════════════════════════════════ */

/** `goal` counts EMAILS; `done` counts COMPANIES. They are different units — compare
 *  progress with `doneEmails`, never `done` (a 20-email goal seeds only ~10 companies,
 *  so `done` can never reach it). `doneEmails` is optional for older API payloads. */
export interface EmailStats { done: number; doneEmails?: number; goal: number; streak: number; channelGoals?: { email: number; linkedin: number; calls: number } }

type Selection =
  | { kind: 'task'; id: string; prospectId: string }
  | { kind: 'response'; id: string }
  | null;

/** The prospect a company opens with — the first with an email, else the first. */
function defaultProspectId(task: DailyTask): string {
  return (task.prospects.find(p => p.hasEmail) ?? task.prospects[0])?.id ?? '';
}

/* ── persistence: last-known board state, kept in-memory + sessionStorage so the
   skeleton only shows on a true cold start. On tab switches (remount) or a page
   reload we render the cached data instantly, then refetch to revalidate. ── */
const DATA_CACHE_KEY = 'agamx.myTasks.today.v1';
const TPL_CACHE_KEY = 'agamx.myTasks.templates.v1';
let memData: MyTasksToday | null = null;
let memTemplates: OutreachTemplate[] | null = null;

function readCache<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try { const raw = sessionStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : null; }
  catch { return null; }
}
function writeCache(key: string, value: unknown) {
  if (typeof window === 'undefined') return;
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* quota / private mode */ }
}

/* ── daily-reset boundary (mirror of the backend) ──────────────────────────────
   The worklist rolls to a fresh day at 08:00 Europe/Berlin (CET/CEST) — the same
   instant for every user. The board must revalidate when that boundary flips, so a
   tab left open overnight doesn't keep showing yesterday's accounts. `berlinWorkDay`
   returns the current work-day key (YYYY-MM-DD) under that cutoff; must match
   daily_task_service.work_day_str on the backend. ── */
const RESET_HOUR = 8;
function berlinWorkDay(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit',
  }).formatToParts(now);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
  const y = +get('year'), mo = +get('month'), d = +get('day'), hour = +get('hour');
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (hour < RESET_HOUR) dt.setUTCDate(dt.getUTCDate() - 1); // before 08:00 → prior work day
  return dt.toISOString().slice(0, 10);
}

export function EmailBoardLive({ onStats }: { onStats?: (s: EmailStats) => void }) {
  // Seed from the cache (memory first, then sessionStorage) so a remount/reload
  // paints immediately instead of flashing the skeleton.
  const seedData = React.useRef(memData ?? (memData = readCache<MyTasksToday>(DATA_CACHE_KEY))).current;
  const seedTemplates = React.useRef(memTemplates ?? (memTemplates = readCache<OutreachTemplate[]>(TPL_CACHE_KEY))).current;

  const [data, setData] = React.useState<MyTasksToday | null>(seedData);
  const [templates, setTemplates] = React.useState<OutreachTemplate[]>(seedTemplates ?? []);
  // campaignId → the templates pinned as that campaign's defaults, so a prospect's
  // compose panel can pre-select the right one instead of a generic fallback.
  const [campaignDefaults, setCampaignDefaults] = React.useState<Record<string, string[]>>({});
  const [loading, setLoading] = React.useState(seedData == null);
  const [error, setError] = React.useState<string | null>(null);
  const [sel, setSel] = React.useState<Selection>(null);
  const [removing, setRemoving] = React.useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = React.useState<string | null>(null);
  const [removeErr, setRemoveErr] = React.useState<string | null>(null);
  const [refilling, setRefilling] = React.useState(false);
  // Prospect selection: which chip is saving, and the transient message shown when
  // a change is refused (trying to select a third person for one company).
  const [selectionBusy, setSelectionBusy] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  // Re-showing the same text must re-trigger the toast, so clear first.
  const flashNotice = React.useCallback((msg: string) => {
    setNotice(null);
    requestAnimationFrame(() => setNotice(msg));
  }, []);

  const apply = React.useCallback((d: MyTasksToday) => {
    setData(d);
    memData = d;
    writeCache(DATA_CACHE_KEY, d);
    onStats?.({ done: d.done, doneEmails: d.doneEmails, goal: d.goal, streak: d.streak, channelGoals: d.channelGoals });
  }, [onStats]);

  const load = React.useCallback(async () => {
    try {
      const [d, t, camps] = await Promise.all([
        fetchMyTasksToday(),
        fetchOutreachTemplates().then(r => r.templates).catch(() => [] as OutreachTemplate[]),
        listImportCampaigns().then(r => r.campaigns).catch(() => []),
      ]);
      apply(d);
      setTemplates(t);
      memTemplates = t;
      writeCache(TPL_CACHE_KEY, t);
      // Map each campaign to its pinned default templates for compose pre-selection.
      setCampaignDefaults(Object.fromEntries(
        camps.map(c => [c._id, c.defaultTemplateIds ?? []]),
      ));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load your tasks');
    } finally { setLoading(false); }
  }, [apply]);

  // Report cached counters to the rings on mount so they aren't blank while the
  // background revalidation is in flight.
  React.useEffect(() => {
    if (seedData) onStats?.({ done: seedData.done, doneEmails: seedData.doneEmails, goal: seedData.goal, streak: seedData.streak, channelGoals: seedData.channelGoals });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => { load(); }, [load]);

  // Revalidate when the 08:00 CET reset boundary flips — so a tab left open overnight
  // pulls the fresh accounts on its own — and when the user returns to the tab. We only
  // refetch on an actual work-day change, not on every focus, to stay light.
  React.useEffect(() => {
    let day = berlinWorkDay();
    const check = () => {
      const d = berlinWorkDay();
      if (d !== day) { day = d; load(); }
    };
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    const id = window.setInterval(check, 60_000);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', check);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', check);
    };
  }, [load]);

  const pending = data?.tasks.filter(t => t.status === 'pending') ?? [];
  const done = data?.tasks.filter(t => t.status === 'done') ?? [];
  const responses = data?.responses ?? [];

  // Keep a valid selection as the list changes.
  React.useEffect(() => {
    if (!data) return;
    const stillValid =
      (sel?.kind === 'task' && pending.some(t => t.companyName === sel.id)) ||
      (sel?.kind === 'response' && responses.some(r => r.outreachId === sel.id));
    if (!stillValid) {
      if (pending.length) setSel({ kind: 'task', id: pending[0].companyName, prospectId: defaultProspectId(pending[0]) });
      else if (responses.length) setSel({ kind: 'response', id: responses[0].outreachId });
      else setSel(null);
    }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Toggle a company row: collapse if it's the open one, else open it on its
  // default prospect.
  const toggleCompany = (task: DailyTask) => {
    setSel(prev =>
      prev?.kind === 'task' && prev.id === task.companyName
        ? null
        : { kind: 'task', id: task.companyName, prospectId: defaultProspectId(task) });
  };

  const doSkip = async () => {
    if (!confirmRemove) return;
    const name = confirmRemove;
    setRemoving(name); setRemoveErr(null);
    try { apply(await skipMyTask(name)); setConfirmRemove(null); }
    catch (e) { setRemoveErr(e instanceof Error ? e.message : 'Could not skip the account'); }
    finally { setRemoving(null); }
  };

  /** Select or deselect a prospect for contact.
   *
   *  The server owns the 2-per-company rule; the UI blocks the obvious case up front
   *  so the common path never involves a rejection, and explains it when the server
   *  refuses anyway (another tab, or an AI run that filled both slots meanwhile). */
  const toggleProspectSelection = async (task: DailyTask, p: DailyTaskProspect, next: boolean) => {
    if (selectionBusy) return;
    const already = task.prospects.filter(x => x.selectionStatus === 'selected');
    if (next && already.length >= MAX_SELECTED_PER_COMPANY) {
      flashNotice(
        `${task.companyName} already has ${MAX_SELECTED_PER_COMPANY} people selected ` +
        `(${already.map(x => x.name).join(' and ')}). Deselect one, then select ${p.name}.`,
      );
      return;
    }
    setSelectionBusy(p.id);
    setNotice(null);
    try {
      apply(await setProspectSelection(p.id, next, task.source === 'hr' ? 'hr' : 'lead_funnel'));
    } catch (e) {
      flashNotice(e instanceof Error ? e.message : 'Could not change the selection');
    } finally {
      setSelectionBusy(null);
    }
  };

  const addAccount = async () => {
    setRefilling(true);
    try { apply(await refillMyTasks()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Nothing left to add'); }
    finally { setRefilling(false); }
  };

  if (loading) return <Skeleton />;
  if (error && !data) return <div style={{ flex: 1, padding: '40px', color: 'var(--color-danger-text)' }}>{error}</div>;

  const selectedTask = sel?.kind === 'task' ? (data?.tasks.find(t => t.companyName === sel.id) ?? null) : null;
  const selectedProspectId = sel?.kind === 'task' ? sel.prospectId : null;
  const selectedResponse = sel?.kind === 'response' ? sel.id : null;

  const empty = pending.length === 0 && done.length === 0 && responses.length === 0;

  return (
    <>
      {/* Feedback belongs in the app's notification, not inside a section
          heading — see components/ui/Toast. */}
      <Toast message={notice} tone="warning" onDismiss={() => setNotice(null)} />
      <div style={{ flex: '40 1 0', overflowY: 'auto', minWidth: 0 }}>
        {empty && (
          <EmptyState variant="panel" tone="brand" icon={EmptyIcons.inbox}
            title="No companies to email today"
            body="Import companies or prospects into a campaign — the highest-signal, un-emailed ones appear here as your daily worklist." />
        )}

        {/* Recent responses (replied prospects) */}
        <div>
          <div style={{ background: 'var(--color-surface)', borderLeft: '4px solid var(--color-brand)', padding: '14px 24px 14px 20px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--color-border)' }}>
            <SectionIcon>{RepliesIcon}</SectionIcon>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-1)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Recent responses</span>
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--color-brand-text)', background: 'var(--color-brand-subtle)', padding: '3px 9px', borderRadius: 'var(--radius-full)', marginLeft: 'auto' }}>{responses.length}</span>
          </div>
          {responses.length > 0 ? (
            <div style={{ padding: '14px 24px 14px', display: 'flex', gap: '12px', overflowX: 'auto' }}>
              {responses.map(r => {
                const on = selectedResponse === r.outreachId;
                return (
                  <div key={r.outreachId} onClick={() => setSel({ kind: 'response', id: r.outreachId })}
                    style={{ width: '260px', flexShrink: 0, cursor: 'pointer', border: `1.5px solid ${on ? 'var(--color-brand)' : 'var(--color-border)'}`, background: on ? 'var(--color-brand-subtle)' : 'var(--color-bg)', borderRadius: 'var(--radius-md)', padding: '13px 15px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.prospectName}</span>
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--color-text-3)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[r.title, r.companyName].filter(Boolean).join(' · ')}</div>
                    {r.campaignName && (
                      <div title={`Campaign: ${r.campaignName}`} style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-brand-text)', background: 'var(--color-brand-subtle)', display: 'inline-block', maxWidth: '100%', padding: '3px 8px', borderRadius: 'var(--radius-full)', marginTop: '7px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.campaignName}
                      </div>
                    )}
                    <div style={{ fontSize: '12px', color: 'var(--color-text-2)', marginTop: '8px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.5 }}>{htmlToSnippet(r.snippet || r.subject || '')}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-3)', marginTop: '6px' }}>{formatDateTime(r.repliedAt)}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={EmptyIcons.reply}
              title="No recent responses"
              body="Replies to your outreach land here, so you can pick the thread up without leaving My Tasks." />
          )}
        </div>

        {/* Today's queue */}
        {(pending.length > 0 || done.length > 0) && (
          <div style={{ borderTop: '3px solid var(--color-border)' }}>
            <div style={{ background: 'var(--color-surface)', borderLeft: '4px solid var(--color-brand)', padding: '14px 24px 14px 20px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--color-border)' }}>
              <SectionIcon>{MailIcon}</SectionIcon>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-1)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Initiate new contact</span>
              <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-text-2)', background: 'var(--color-bg)', border: '1.5px solid var(--color-border-2)', padding: '3px 9px', borderRadius: 'var(--radius-full)' }}>{data?.done ?? 0}/{data?.goal ?? 0} sent</span>
            </div>
            <div>
              {pending.map(t => (
                <CompanyRow key={t.companyName} task={t}
                  expanded={selectedTask?.companyName === t.companyName}
                  selectedProspectId={selectedTask?.companyName === t.companyName ? selectedProspectId : null}
                  onToggle={() => toggleCompany(t)}
                  onSelectProspect={id => setSel({ kind: 'task', id: t.companyName, prospectId: id })}
                  onToggleSelection={(p, next) => toggleProspectSelection(t, p, next)}
                  selectionBusy={selectionBusy}
                  onRemove={() => { setRemoveErr(null); setConfirmRemove(t.companyName); }} removing={removing === t.companyName} />
              ))}
            </div>

            {/* completed today */}
            {done.map(t => (
              <div key={t.companyName} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 20px', borderBottom: '1px solid var(--color-border)', opacity: 0.7 }}>
                <svg width="15" height="15" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}><circle cx="7" cy="7" r="7" fill="var(--color-success, var(--color-brand))" /><polyline points="4,7.2 6.2,9.2 10,4.8" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <span style={{ fontSize: '13px', color: 'var(--color-text-2)', textDecoration: 'line-through' }}>{t.companyName}</span>
                <span style={{ fontSize: '11.5px', color: 'var(--color-text-3)', marginLeft: 'auto' }}>Emailed</span>
              </div>
            ))}

            <div onClick={refilling ? undefined : addAccount}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '12px 24px', fontSize: '13px', color: 'var(--color-text-3)', cursor: refilling ? 'default' : 'pointer' }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="6" y1="1" x2="6" y2="11" /><line x1="1" y1="6" x2="11" y2="6" /></svg>
              {refilling ? 'Adding…' : 'Add account…'}
            </div>
          </div>
        )}
      </div>

      {selectedResponse
        ? <ThreadPanel outreachId={selectedResponse} onClose={() => setSel(null)} onReplied={load} onResolved={() => { setSel(null); load(); }} />
        : selectedTask
          ? <ComposePanel key={selectedTask.companyName} task={selectedTask} prospectId={selectedProspectId ?? ''} templates={templates}
              defaultTemplateIds={selectedTask.campaignId ? (campaignDefaults[selectedTask.campaignId] ?? []) : []}
              onClose={() => setSel(null)} onSent={apply} onReload={load} />
          : (
            /* Holds the column open when nothing is selected, so the board keeps
               its two-column shape instead of reflowing to full width. */
            <aside style={{ flex: '60 1 0', minWidth: '360px', borderLeft: '1px solid var(--color-border)', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' }}>
              <EmptyState variant="panel" icon={EmptyIcons.mail}
                title="No company selected"
                body="Open a company from today's queue to read its intel and draft the email, or pick a reply to continue the thread." />
            </aside>
          )}

      <ConfirmDialog
        open={!!confirmRemove}
        title="Skip this account?"
        message={<><strong>{confirmRemove}</strong> will be marked <strong>Skipped</strong> and won’t appear in My Tasks again. You can un-skip it from the campaign screen.</>}
        confirmLabel="Skip"
        cancelLabel="Dismiss"
        danger
        loading={removing === confirmRemove}
        loadingLabel="Skipping…"
        error={removeErr}
        onConfirm={doSkip}
        onCancel={() => { if (!removing) { setConfirmRemove(null); setRemoveErr(null); } }}
      />
    </>
  );
}
