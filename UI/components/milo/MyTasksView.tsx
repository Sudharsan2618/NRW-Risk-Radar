'use client';
import React from 'react';
import { Tabs } from '@/components/ui/Tabs';
import { ProspectCard } from '@/components/ui/ProspectCard';
import { LinkedInBoardLive, type LinkedInStats } from './LinkedInBoardLive';
import { EmailBoardLive, type EmailStats } from './EmailBoardLive';
import { EmptyState, EmptyIcons } from '@/components/ui/EmptyState';

import Link from 'next/link';
import { fetchMyTasksToday } from '@/lib/leadFunnelApi';

/* ─────────────────────────────  Channel scaffold  ───────────────────────────── */

type Channel = 'accounts' | 'linkedin' | 'calls';

interface ChannelData {
  id: Channel;
  label: string;
  done: number;
  goal: number;
}

// Static scaffold for the ring rail + tab labels. The Emails tab is fully live
// (EmailBoardLive) and overwrites its counters at runtime; LinkedIn/Calls keep
// these placeholder goals until they are wired to real data.
const CHANNELS: ChannelData[] = [
  { id: 'accounts', label: 'Emails',      done: 0, goal: 0 },
  { id: 'linkedin', label: 'LinkedIn',    done: 0, goal: 0 },
  { id: 'calls',    label: 'Phone Calls', done: 0, goal: 0 },
];

/* ─────────────────────────────  Small UI helpers  ───────────────────────────── */

const RING_COLOR: Record<Channel, string> = {
  accounts: 'var(--color-brand)',
  linkedin: 'var(--color-brand)',
  calls: 'var(--color-brand)',
};

const CHANNEL_ICON: Record<Channel, React.ReactNode> = {
  accounts: <><rect x="4.5" y="3.5" width="9" height="11" rx="1" /><path d="M7 6.5h1M10 6.5h1M7 9h1M10 9h1M8 14.5v-2.5h2v2.5" /></>,
  linkedin: <><rect x="3" y="3" width="12" height="12" rx="2" /><line x1="6" y1="8" x2="6" y2="12.5" /><circle cx="6" cy="5.6" r="0.9" fill="currentColor" stroke="none" /><path d="M9 12.5V8.5M9 10c0-1 .9-1.8 2-1.8s2 .8 2 2.2V12.5" /></>,
  calls: <path d="M4 4.5c0-1 .8-2 1.8-2h1.2c.4 0 .8.3.9.7L8.7 6c.1.4 0 .8-.3 1L7.3 8a8 8 0 0 0 3.5 3.5l1-1.1c.3-.3.7-.4 1.1-.3l2.6.7c.4.1.7.5.7.9v1.2c0 1-1 1.9-2 1.8C8 14.4 4 10.4 4 4.5z" strokeLinejoin="round" />,
};

function Ring({ done, goal, color, icon, label, size = 52 }: { done: number; goal: number; color: string; icon: React.ReactNode; label: string; size?: number }) {
  const sw = 5;
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const pct = goal === 0 ? 0 : Math.min(done / goal, 1);
  const cx = size / 2;
  return (
    <div title={`${label} · ${done} of ${goal}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <div style={{ position: 'relative', width: `${size}px`, height: `${size}px` }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--color-border)" strokeWidth={sw} />
          <circle cx={cx} cy={cx} r={r} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: 'stroke-dashoffset .4s ease' }} />
        </svg>
        <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color }}>
          <svg width={Math.round(size * 0.32)} height={Math.round(size * 0.32)} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
        </span>
      </div>
      <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--color-text-1)' }}>{done}/{goal}</span>
    </div>
  );
}

const primaryBtn: React.CSSProperties = { padding: '7px 16px', background: 'var(--color-brand)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' };
const ghostBtn: React.CSSProperties = { padding: '7px 16px', background: 'var(--color-bg)', color: 'var(--color-text-1)', border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' };

function LinkedInBadge({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0 }} aria-hidden>
      <rect width="24" height="24" rx="4" fill="var(--color-avatar-blue)" />
      <path d="M7 9.5h2.1V17H7zM8.05 6.2a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5zM10.8 9.5h2v1.02c.28-.53 1.05-1.18 2.27-1.18 2 0 2.6 1.18 2.6 3.18V17h-2.1v-3.1c0-.84-.3-1.42-1.06-1.42-.66 0-1.02.45-1.2.88-.06.16-.07.38-.07.6V17h-2.1z" fill="#fff" />
    </svg>
  );
}

const callCaps: React.CSSProperties = { fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--color-text-3)' };

/* ═══════════════════════════════════════════════════════════════════════════
   Phone Calls board — replied prospects (cards), a prioritised call queue, and a
   call-brief detail panel with a pinned action bar. Amber accent = the calls
   channel color (RING_COLOR.calls); all tokens come from the design system.
   ═══════════════════════════════════════════════════════════════════════════ */

interface CallBrief {
  execCompany: string;
  execProspect: string;
  readBefore: string;
  talkingPoints: string[];
  openSignals: string;
  bestTime: string;
  likelyObjection: string;
  recentActivity: string;
}
interface CallProspect {
  id: string; name: string; title: string; company: string;
  roleDesc: string; signal: string; replied: boolean; icpFit: number;
  topic: string; touches: string; streak: string; tenure: string; brief: CallBrief;
}
interface CallQueueAccount {
  id: string; score: number; company: string; hint: string; meta: string;
  prospects: CallProspect[];
}

const CALL_PROSPECTS: Record<string, CallProspect> = {
  pepper: {
    id: 'cp-pepper', name: 'Pepper Potts', title: 'COO · Stark Industries', company: 'Stark Industries',
    roleDesc: 'Owns global operations and the ops-platform budget; in seat 4 years and consolidating plant tooling under a single command.',
    signal: 'Email reply · 2 days ago', replied: true, icpFit: 4,
    topic: 'She replied to the demo thread — open on the inbound interest, then steer toward plant-floor visibility before scope creep.',
    touches: '3 touches sent · Replied',
    streak: 'medium', tenure: 'At company since 2021 · 4 yrs',
    brief: {
      execCompany: 'Stark Industries spans aerospace and advanced manufacturing with a centralized operations command. A recent inbound demo request is the highest-intent signal in the queue and warrants a call within 24 hours.',
      execProspect: 'Pepper Potts requested the demo and is the economic buyer for ops platforms. In role 4 years, she is driving plant-floor consolidation this quarter.',
      readBefore: 'She came inbound, so lead with gratitude, not a pitch. The agent recommends anchoring on plant-floor operational visibility — the angle her last reply engaged with — and deferring pricing until scope is agreed. Keep the call to confirming demo scope and a date.',
      talkingPoints: [
        'Thank her for the inbound demo request and confirm timing.',
        'Plant-floor visibility: single view across the consolidated ops command.',
        'Fast supplier onboarding as the wedge into the wider rollout.',
      ],
      openSignals: 'Inbound demo', bestTime: '5–7 pm', likelyObjection: 'Procurement cycle', recentActivity: 'Opened deck 2×',
    },
  },
  lucius: {
    id: 'cp-lucius', name: 'Lucius Fox', title: 'CTO · Wayne Enterprises', company: 'Wayne Enterprises',
    roleDesc: 'Champions the existing deployment and sponsors expansion; technical decision-maker across the conglomerate ops portfolio.',
    signal: 'Email reply · 4 days ago', replied: true, icpFit: 5,
    topic: 'Existing champion — frame the renewal as expansion: usage growth, new ops modules, and a multi-plant rollout.',
    touches: '2 touches sent · Replied',
    streak: 'high', tenure: 'At company since 2018 · 7 yrs',
    brief: {
      execCompany: 'Wayne Enterprises is a diversified conglomerate with a maturing operations-technology portfolio. The renewal window opens in 60 days — a proactive call to expand the account ahead of procurement.',
      execProspect: 'Lucius Fox champions the current deployment and is the expansion sponsor. Strong fit; he already advocates internally for the platform.',
      readBefore: 'This is a warm, account-growth call, not net-new. Open the renewal and expansion conversation together, lead with usage growth he already sees, and propose the multi-plant rollout as the natural next step. He will want a clear rollout plan, not just a renewal quote.',
      talkingPoints: [
        'Recap usage growth since go-live and the value realised.',
        'Introduce the new ops modules relevant to his roadmap.',
        'Propose a phased multi-plant rollout tied to the renewal.',
      ],
      openSignals: 'Renewal soon', bestTime: '9–11 am', likelyObjection: 'Budget timing', recentActivity: 'Replied 4d ago',
    },
  },
  sofia: {
    id: 'cp-sofia', name: 'Sofia Marchetti', title: 'Head of Operations · Chanut', company: 'Chanut Corporation',
    roleDesc: 'Owns the freight-optimization initiative funded by the recent Series D; evaluating ops tooling for cross-border visibility.',
    signal: 'Email reply · 6 days ago', replied: true, icpFit: 3,
    topic: 'Series D just closed — connect fresh budget to a single operational view and faster freight exception handling.',
    touches: '4 touches sent · Replied',
    streak: 'medium', tenure: 'At company since 2022 · 3 yrs',
    brief: {
      execCompany: 'Chanut Corporation operates a cross-border logistics network with a growing software arm for freight optimization. Fresh Series D capital is earmarked for operations software — timing aligns with outreach.',
      execProspect: 'Sofia Marchetti owns the freight-optimization initiative funded by the raise. Moderate fit; engagement was lower on prior touches, so a value-led approach works best.',
      readBefore: 'Lead with a relevant benchmark rather than a direct ask — prior touches saw low engagement. Connect the Series D mandate to a single operational view and quantifiable freight-exception reduction. Aim only to earn a working session, not a full demo.',
      talkingPoints: [
        'Congratulate on the raise; tie it to the ops-software mandate.',
        'Single operational view across the cross-border network.',
        'Benchmark: peers cut freight exceptions with real-time visibility.',
      ],
      openSignals: 'Series D', bestTime: '1–3 pm', likelyObjection: 'Too early', recentActivity: 'Reply 6d ago',
    },
  },
  marcus: {
    id: 'cp-marcus', name: 'Marcus Hale', title: 'Director, R&D · Globex', company: 'Globex Corporation',
    roleDesc: 'Drives platform tooling evaluations across engineering teams; influences the software-stack modernization budget.',
    signal: '3 touches sent · No reply', replied: false, icpFit: 3,
    topic: 'No reply yet — use the call to reference the modernization push and offer a peer teardown rather than a pitch.',
    touches: '3 touches sent · No reply',
    streak: 'low', tenure: 'At company since 2023 · 2 yrs',
    brief: {
      execCompany: 'Globex Corporation is a diversified automotive supplier focused on electrified drivetrains and software-defined vehicle platforms. A recent VP of Engineering appointment signals modernization.',
      execProspect: 'Marcus Hale runs platform tooling evaluations across teams. No reply to three touches yet — the call is a pattern-break to reach him directly.',
      readBefore: 'He has gone quiet across three touches, so the call must add value in the first sentence. Reference the modernization push under the new VP, offer a short peer teardown, and avoid re-pitching what the emails already said. Goal is a yes to a 15-minute working session.',
      talkingPoints: [
        'Reference the new VP of Engineering and modernization mandate.',
        'Offer a peer teardown rather than a product walkthrough.',
        'Position tooling consolidation as an R&D-efficiency win.',
      ],
      openSignals: 'New VP Eng', bestTime: '4–6 pm', likelyObjection: 'No bandwidth', recentActivity: 'No reply · 3 touches',
    },
  },
};

const REPLIED_PROSPECTS: CallProspect[] = [
  CALL_PROSPECTS.pepper, CALL_PROSPECTS.lucius, CALL_PROSPECTS.sofia, CALL_PROSPECTS.marcus,
];

const CALL_QUEUE: CallQueueAccount[] = [
  {
    id: 'q1', score: 44, company: 'Stark Industries', hint: 'Aerospace · Inbound demo request',
    meta: '3 emails sent · No reply · Strong ICP match',
    prospects: [CALL_PROSPECTS.pepper, CALL_PROSPECTS.marcus],
  },
  {
    id: 'q2', score: 36, company: 'Wayne Enterprises', hint: 'Conglomerate · Renewal window open',
    meta: '2 emails sent · Replied · Expansion candidate',
    prospects: [CALL_PROSPECTS.lucius],
  },
  {
    id: 'q3', score: 28, company: 'Chanut Corporation', hint: 'Logistics · Series D closed',
    meta: '4 emails sent · No reply · Medium ICP match',
    prospects: [CALL_PROSPECTS.sofia, CALL_PROSPECTS.marcus],
  },
];

function PhoneGlyph({ size = 14, color = 'var(--color-text-3)' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M4 4.5c0-1 .8-2 1.8-2h1.2c.4 0 .8.3.9.7L8.7 6c.1.4 0 .8-.3 1L7.3 8a8 8 0 0 0 3.5 3.5l1-1.1c.3-.3.7-.4 1.1-.3l2.6.7c.4.1.7.5.7.9v1.2c0 1-1 1.9-2 1.8C8 14.4 4 10.4 4 4.5z" />
    </svg>
  );
}

function CallCard({ p, selected, onSelect }: { p: CallProspect; selected: boolean; onSelect: () => void }) {
  return (
    <ProspectCard
      name={p.name}
      role={p.title.split(' · ')[0]}
      company={p.company}
      selected={selected}
      onClick={onSelect}
      icon={<PhoneGlyph color={selected ? 'var(--color-brand)' : 'var(--color-text-3)'} />}
      badge={
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600, color: selected ? 'var(--color-brand-text)' : 'var(--color-text-3)' }}>
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="10" height="9.5" rx="1.5" /><line x1="2" y1="6" x2="12" y2="6" /><line x1="5" y1="1.5" x2="5" y2="4" /><line x1="9" y1="1.5" x2="9" y2="4" />
          </svg>
          {p.tenure}
        </div>
      }
      width={240}
    />
  );
}

function CallQueueRow({ acc, expanded, onToggle, selectedId, onSelectProspect }: {
  acc: CallQueueAccount; expanded: boolean; onToggle: () => void;
  selectedId: string; onSelectProspect: (p: CallProspect) => void;
}) {
  const [hov, setHov] = React.useState(false);
  return (
    <div style={{ borderBottom: '1px solid var(--color-border)' }}>
      <div onClick={onToggle} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 24px', cursor: 'pointer', background: hov || expanded ? 'var(--color-row-hover)' : 'var(--color-bg)', minHeight: '52px', borderLeft: `3px solid ${expanded ? 'var(--color-brand)' : 'transparent'}` }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acc.company}</div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acc.hint}</div>
        </div>
        <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: 'var(--color-text-3)', transform: expanded ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform .2s' }}>
          <path d="M2 4L6 8L10 4" />
        </svg>
      </div>
      {expanded && (
        <div style={{ padding: '6px 24px 18px 27px', background: 'var(--color-row-hover)' }}>
          <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', padding: '8px 0 4px' }}>
            {acc.prospects.map(p => (
              <CallCard key={p.id} p={p} selected={p.id === selectedId} onSelect={() => onSelectProspect(p)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const OUTCOMES = ['Answered', 'Voicemail', 'No Answer', 'Rescheduled'] as const;

function CallBriefPanel({ p, onClose }: { p: CallProspect; onClose: () => void }) {
  const [outcome, setOutcome] = React.useState<string>('Rescheduled');
  const b = p.brief;
  const linkRow: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--color-brand)', textDecoration: 'none', cursor: 'pointer' };
  const duringCol = (label: string, value: string) => (
    <div style={{ minWidth: 0 }}>
      <div style={{ ...callCaps, marginBottom: '4px' }}>{label}</div>
      <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text-1)' }}>{value}</div>
    </div>
  );

  return (
    <aside style={{ flex: '60 1 0', minWidth: '420px', borderLeft: '1px solid var(--color-border)', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)', flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '17px', fontWeight: 700, color: 'var(--color-text-1)' }}>{p.name}</span>
            <PhoneGlyph size={15} />
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--color-text-2)', marginTop: '3px' }}>{p.title}</div>
          <div style={{ fontSize: '12px', fontStyle: 'italic', color: 'var(--color-text-3)', marginTop: '2px' }}>{p.touches}</div>
        </div>
        <button onClick={onClose} title="Close" style={{ width: '26px', height: '26px', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', color: 'var(--color-text-3)', flexShrink: 0 }}>
          <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="11" y2="11" /><line x1="11" y1="1" x2="1" y2="11" /></svg>
        </button>
      </div>

      {/* scrolling brief */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>
        {/* Exec summary */}
        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: '12px' }}>Exec summary</div>
        <div style={{ ...callCaps, marginBottom: '5px' }}>Company</div>
        <p style={{ margin: '0 0 14px', fontSize: '13px', lineHeight: 1.6, color: 'var(--color-text-1)' }}>{b.execCompany}</p>
        <div style={{ ...callCaps, marginBottom: '5px' }}>Prospect</div>
        <p style={{ margin: '0 0 16px', fontSize: '13px', lineHeight: 1.6, color: 'var(--color-text-1)' }}>{b.execProspect}</p>

        {/* Quick links */}
        <div style={{ height: '1px', background: 'var(--color-border)', margin: '0 0 14px' }} />
        <div style={{ ...callCaps, marginBottom: '10px' }}>Quick links</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px 20px', marginBottom: '18px' }}>
          <a style={linkRow}><LinkedInBadge size={15} /> Company LinkedIn</a>
          <a style={linkRow}>
            <svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="9" cy="9" r="6.5" /><path d="M2.5 9h13M9 2.5c2 2.2 2 11.3 0 13M9 2.5c-2 2.2-2 11.3 0 13" /></svg>
            Company website
          </a>
          <a style={linkRow}><LinkedInBadge size={15} /> Prospect LinkedIn</a>
          <a style={linkRow}>
            <svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"><rect x="2" y="4" width="14" height="10" rx="1.5" /><polyline points="2.5,5 9,10 15.5,5" /></svg>
            Last email
          </a>
        </div>

        {/* Read before calling */}
        <div style={{ height: '1px', background: 'var(--color-border)', margin: '0 0 14px' }} />
        <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--color-brand-text)', marginBottom: '8px' }}>Read before calling</div>
        <p style={{ margin: '0 0 16px', fontSize: '13px', lineHeight: 1.7, color: 'var(--color-text-2)' }}>{b.readBefore}</p>

        {/* Talking points */}
        <div style={{ ...callCaps, marginBottom: '10px' }}>Talking points</div>
        <ul style={{ margin: '0 0 18px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '9px' }}>
          {b.talkingPoints.map((t, i) => (
            <li key={i} style={{ display: 'flex', gap: '8px', fontSize: '13px', lineHeight: 1.5, color: 'var(--color-text-1)' }}>
              <span style={{ color: 'var(--color-brand)', flexShrink: 0, marginTop: '1px' }}>•</span>{t}
            </li>
          ))}
        </ul>

        {/* During call */}
        <div style={{ height: '1px', background: 'var(--color-border)', margin: '0 0 14px' }} />
        <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--color-brand-text)', marginBottom: '12px' }}>During call</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 16px' }}>
          {duringCol('Open signals', b.openSignals)}
          {duringCol('Best time', b.bestTime)}
          {duringCol('Likely objection', b.likelyObjection)}
          {duringCol('Recent activity', b.recentActivity)}
        </div>
      </div>

      {/* pinned action bar */}
      <div style={{ flexShrink: 0, borderTop: '1px solid var(--color-border)', background: 'var(--color-surface)', padding: '14px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', alignItems: 'center', gap: '10px 14px' }}>
          <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text-2)' }}>Outcome</span>
          <div style={{ display: 'inline-flex', border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)', overflow: 'hidden', width: 'fit-content' }}>
            {OUTCOMES.map((o, i) => {
              const on = o === outcome;
              return (
                <button key={o} onClick={() => setOutcome(o)} style={{
                  padding: '6px 11px', fontSize: '12px', fontWeight: on ? 700 : 500, fontFamily: 'var(--font-sans)', cursor: 'pointer',
                  border: 'none', borderLeft: i === 0 ? 'none' : '1px solid var(--color-border-2)',
                  background: on ? 'var(--color-brand-subtle)' : 'var(--color-bg)',
                  color: on ? 'var(--color-brand-text)' : 'var(--color-text-2)',
                }}>{o}</button>
              );
            })}
          </div>

          <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text-2)' }}>Next step</span>
          <input placeholder="e.g. Send proposal by Friday" style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', fontSize: '12.5px', fontFamily: 'var(--font-sans)', color: 'var(--color-text-1)', border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg)' }} />

          <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text-2)', alignSelf: 'start', paddingTop: '6px' }}>Notes</span>
          <textarea placeholder="Add call notes…" rows={2} style={{ width: '100%', boxSizing: 'border-box', padding: '7px 10px', fontSize: '12.5px', fontFamily: 'var(--font-sans)', color: 'var(--color-text-1)', border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg)', resize: 'vertical' }} />
        </div>
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'flex-end' }}>
          <button style={ghostBtn}>Log call notes</button>
          <button style={{ ...primaryBtn, background: 'var(--color-brand)' }}>Mark as done</button>
        </div>
      </div>
    </aside>
  );
}

function PhoneCallsBoard({ goal }: { goal?: number }) {
  const [selected, setSelected] = React.useState<CallProspect | null>(REPLIED_PROSPECTS[0]);
  const [expanded, setExpanded] = React.useState<string | null>('q1');
  const selId = selected?.id ?? '';

  if (goal === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center', background: 'var(--color-bg)' }}>
        <div style={{ maxWidth: '420px', display: 'flex', flexDirection: 'column', alignItems: 'center', background: 'var(--color-surface)', padding: '36px 32px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'var(--color-warning-subtle, #fef3c7)', color: 'var(--color-warning, #d97706)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '18px' }}>
            <svg width="24" height="24" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4.5c0-1 .8-2 1.8-2h1.2c.4 0 .8.3.9.7L8.7 6c.1.4 0 .8-.3 1L7.3 8a8 8 0 0 0 3.5 3.5l1-1.1c.3-.3.7-.4 1.1-.3l2.6.7c.4.1.7.5.7.9v1.2c0 1-1 1.9-2 1.8C8 14.4 4 10.4 4 4.5z" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: '8px' }}>No Phone Call Goals Set</div>
          <div style={{ fontSize: '13px', color: 'var(--color-text-2)', lineHeight: 1.6, marginBottom: '22px' }}>
            You haven't set up any daily phone call commitments for your campaigns yet. Please set up your per-day phone call goals to activate your call queue.
          </div>
          <Link href="/weekly-goals" style={{ textDecoration: 'none' }}>
            <button style={{ ...primaryBtn, padding: '9px 22px', fontSize: '13.5px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              Set Up Weekly Goals →
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{ flex: '40 1 0', overflowY: 'auto', minWidth: 0 }}>
        <style>{`
          .thin-hscroll{scrollbar-width:thin;scrollbar-color:var(--color-border-2) transparent;}
          .thin-hscroll::-webkit-scrollbar{height:6px;}
          .thin-hscroll::-webkit-scrollbar-track{background:transparent;}
          .thin-hscroll::-webkit-scrollbar-thumb{background:var(--color-border-2);border-radius:3px;}
          .thin-hscroll::-webkit-scrollbar-thumb:hover{background:var(--color-text-3);}
        `}</style>
        {/* Replied prospects */}
        <div>
          <div style={{ background: 'var(--color-surface)', borderLeft: '4px solid var(--color-brand)', padding: '14px 24px 14px 20px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: 'var(--radius-sm)', flexShrink: 0, background: 'var(--color-brand-subtle)', color: 'var(--color-brand-text)' }}>
              <svg width="13" height="13" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polyline points="7,4 3,8 7,12" /><path d="M3 8h7a5 5 0 0 1 5 5v1" /></svg>
            </span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-1)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Replied prospects</span>
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--color-brand-text)', background: 'var(--color-brand-subtle)', padding: '3px 9px', borderRadius: 'var(--radius-full)', marginLeft: 'auto' }}>{REPLIED_PROSPECTS.filter(p => p.replied).length}</span>
          </div>
          {REPLIED_PROSPECTS.length > 0 ? (
            <div style={{ padding: '14px 24px 14px' }}>
              <div className="thin-hscroll" style={{ display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '6px' }}>
                {REPLIED_PROSPECTS.map(p => (
                  <CallCard key={p.id} p={p} selected={p.id === selId} onSelect={() => setSelected(p)} />
                ))}
              </div>
            </div>
          ) : (
            <EmptyState icon={EmptyIcons.reply}
              title="No replies to call yet"
              body="Prospects who answer your outreach show up here first — they are the warmest calls of the day." />
          )}
        </div>

        {/* Prioritised call queue */}
        <div style={{ borderTop: '3px solid var(--color-border)' }}>
          <div style={{ background: 'var(--color-surface)', borderLeft: '4px solid var(--color-brand)', padding: '14px 24px 14px 20px', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid var(--color-border)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: 'var(--radius-sm)', flexShrink: 0, background: 'var(--color-brand-subtle)', color: 'var(--color-brand-text)' }}>
              <svg width="13" height="13" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="5" x2="15" y2="5" /><line x1="7" y1="9" x2="15" y2="9" /><line x1="7" y1="13" x2="15" y2="13" /><circle cx="3.5" cy="5" r="1" fill="currentColor" stroke="none" /><circle cx="3.5" cy="9" r="1" fill="currentColor" stroke="none" /><circle cx="3.5" cy="13" r="1" fill="currentColor" stroke="none" /></svg>
            </span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-1)', textTransform: 'uppercase', letterSpacing: '.5px' }}>Prioritised call queue</span>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-text-2)', background: 'var(--color-bg)', border: '1.5px solid var(--color-border-2)', padding: '3px 9px', borderRadius: 'var(--radius-full)', marginLeft: 'auto' }}>{CALL_QUEUE.length}</span>
          </div>
          <div>
            {CALL_QUEUE.length > 0 ? CALL_QUEUE.map(acc => (
              <CallQueueRow key={acc.id} acc={acc}
                expanded={expanded === acc.id}
                onToggle={() => setExpanded(e => e === acc.id ? null : acc.id)}
                selectedId={selId}
                onSelectProspect={p => setSelected(p)} />
            )) : (
              <EmptyState icon={EmptyIcons.phone}
                title="Your call queue is clear"
                body="Accounts are prioritised into this queue once they have been emailed without a reply." />
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '12px 24px', fontSize: '13px', color: 'var(--color-text-3)', cursor: 'pointer' }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="6" y1="1" x2="6" y2="11" /><line x1="1" y1="6" x2="11" y2="6" /></svg>
            Add call…
          </div>
        </div>
      </div>

      {selected ? <CallBriefPanel p={selected} onClose={() => setSelected(null)} /> : (
        <aside style={{ flex: '60 1 0', minWidth: '360px', borderLeft: '1px solid var(--color-border)', background: 'var(--color-bg)', display: 'flex', flexDirection: 'column' }}>
          <EmptyState variant="panel" icon={EmptyIcons.phone}
            title="No call selected"
            body="Choose a prospect from the replies rail or the call queue to open their brief, talk track and dialer." />
        </aside>
      )}
    </>
  );
}

/* ─────────────────────────────  Main view  ───────────────────────────── */

export function MyTasksView() {
  const [active, setActive] = React.useState<Channel>('accounts');
  // Static channel scaffold drives the LinkedIn/Calls rings + tab labels. The
  // Emails tab is fully live (EmailBoardLive) and overwrites its counters at runtime; LinkedIn/Calls keep
  // these placeholder goals until they are wired to real data.
  const [data] = React.useState<ChannelData[]>(() => CHANNELS.map(c => ({ ...c })));
  const [emailStats, setEmailStats] = React.useState<EmailStats | null>(null);
  // Live counters from the bounded LinkedIn invite worklist (done / today's goal).
  const [linkedinStats, setLinkedinStats] = React.useState<LinkedInStats | null>(null);

  React.useEffect(() => {
    fetchMyTasksToday()
      .then(res => {
        if (res?.channelGoals) {
          setEmailStats(prev => ({
            done: prev?.done ?? res.done,
            goal: prev?.goal ?? res.goal,
            streak: prev?.streak ?? res.streak,
            channelGoals: res.channelGoals,
          }));
        }
      })
      .catch(() => {});
  }, []);

  // Overlay live goals from the weekly plan: Emails counters come straight from the
  // live board; LinkedIn/Calls take their per-day target from the plan's channelGoals
  // (execution for those tabs is still being wired, but the target is now real).
  const cg = emailStats?.channelGoals;
  const displayData = data.map(c => {
    // `goal` counts EMAILS, so the progress figure must too. Using `done` (companies)
    // made the tab unreachable: a 20-email goal seeds ~10 companies, so it capped at
    // 10/20 even when every card was finished. Falls back to `done` for older payloads.
    if (c.id === 'accounts' && emailStats) {
      return { ...c, done: emailStats.doneEmails ?? emailStats.done, goal: emailStats.goal };
    }
    if (c.id === 'linkedin') {
      // Prefer the live worklist counters; fall back to the plan's per-day target.
      if (linkedinStats) return { ...c, done: linkedinStats.done, goal: linkedinStats.goal };
      const g = cg ? cg.linkedin : c.goal;
      return { ...c, done: g === 0 ? 0 : Math.min(c.done, g), goal: g };
    }
    if (c.id === 'calls') {
      const g = cg ? cg.calls : c.goal;
      return { ...c, done: g === 0 ? 0 : Math.min(c.done, g), goal: g };
    }
    return c;
  });

  const totalDone = displayData.reduce((s, c) => s + c.done, 0);
  const totalGoal = displayData.reduce((s, c) => s + c.goal, 0);

  // Each active channel goal (where goal > 0 and done >= goal) adds 1 to today's completed goals.
  const completedGoalsToday = displayData.reduce((acc, c) => {
    if (c.goal > 0 && c.done >= c.goal) {
      return acc + 1;
    }
    return acc;
  }, 0);

  // Derive historical baseline streak from previous days:
  // emailStats.streak from backend includes +1 if today's email goal was met.
  const isEmailGoalMet = emailStats
    ? (emailStats.goal > 0 && (emailStats.doneEmails ?? emailStats.done) >= emailStats.goal)
    : false;
  const rawStreak = emailStats?.streak ?? 0;
  const pastStreak = isEmailGoalMet ? Math.max(0, rawStreak - 1) : rawStreak;

  // Streak for today = baseline past streak + completed goals count today (Email = 1, LinkedIn = 2, Calls = 3).
  const streak = pastStreak + completedGoalsToday;

  const linkedinGoal = displayData.find(c => c.id === 'linkedin')?.goal ?? 0;
  const callsGoal = displayData.find(c => c.id === 'calls')?.goal ?? 0;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 20px', borderBottom: '1px solid var(--color-border)', gap: '10px', flexShrink: 0 }}>
        <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-1)' }}>My Tasks</span>
        <span style={{ fontSize: '12.5px', color: 'var(--color-text-2)' }}>
          {emailStats
            ? `Today · ${emailStats.doneEmails ?? emailStats.done} of ${emailStats.goal} emails sent`
              + (emailStats.done ? ` · ${emailStats.done} account${emailStats.done === 1 ? '' : 's'}` : '')
            : 'Your daily worklist'}
        </span>
      </div>

      {/* channel tabs */}
      <Tabs
        items={displayData.map(c => ({
          id: c.id,
          label: (
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              {c.label}
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                color: c.id === active ? 'var(--color-brand-text)' : 'var(--color-text-3)',
                background: c.id === active ? 'var(--color-brand-subtle)' : 'var(--color-surface)',
                padding: '2px 6px',
                borderRadius: 'var(--radius-full)',
                transition: 'color 0.12s, background 0.12s'
              }}>
                {c.done}/{c.goal}
              </span>
            </div>
          )
        }))}
        activeId={active}
        onChange={(id) => setActive(id as Channel)}
        style={{ padding: '0 20px', flexShrink: 0 }}
      />

      {/* body: list + right rail */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {active === 'linkedin' ? (
          <LinkedInBoardLive goal={linkedinGoal} onStats={setLinkedinStats} />
        ) : active === 'calls' ? (
          <PhoneCallsBoard goal={callsGoal} />
        ) : (
          <EmailBoardLive onStats={setEmailStats} />
        )}

        {/* right rail */}
        <aside style={{ width: '90px', flexShrink: 0, borderLeft: '1px solid var(--color-border)', background: 'var(--color-surface)', padding: '20px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', overflowY: 'auto' }}>
          {displayData.map(c => (
            <Ring key={c.id} done={c.done} goal={c.goal} color={RING_COLOR[c.id]} icon={CHANNEL_ICON[c.id]} label={c.label} size={52} />
          ))}
          <div style={{ width: '32px', height: '1px', background: 'var(--color-border)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <span style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-1)', lineHeight: 1 }}>{streak}</span>
            <span style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--color-text-3)', marginTop: '4px' }}>streak</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
