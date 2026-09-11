'use client';
import React from 'react';
import { getEnrichmentStatus, type LinkedinPost } from '@/lib/leadFunnelApi';

// Shared slide-over for company/person LinkedIn-post enrichment.
// Left = post list, right = post detail (+ optional signal slot for companies).
export function EnrichmentPostsPanel({
  open, onClose, title, subtitle, linkedinUrl, posts, enriched, signalSlot,
  onEnrich, onEnriched,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  linkedinUrl?: string;
  posts: LinkedinPost[];
  enriched: boolean;
  signalSlot?: React.ReactNode;
  onEnrich: (numPosts: number) => Promise<string>;   // returns enrichmentId
  onEnriched: () => void;                              // reload details after completion
}) {
  const [active, setActive] = React.useState(0);
  const [showEnrich, setShowEnrich] = React.useState(false);
  const [numPosts, setNumPosts] = React.useState(5);
  const [enriching, setEnriching] = React.useState(false);
  const [phase, setPhase] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => { if (open) { setActive(0); setShowEnrich(false); setError(null); } }, [open, posts]);

  const poll = (id: string) => {
    let tries = 0;
    const tick = async () => {
      try {
        const { enrichment } = await getEnrichmentStatus(id);
        setPhase(enrichment.status);
        if (enrichment.status === 'completed') { setEnriching(false); setShowEnrich(false); onEnriched(); }
        else if (enrichment.status === 'failed') { setEnriching(false); setError(enrichment.errorMessage || 'Enrichment failed'); }
        else if (tries++ < 60) setTimeout(tick, 5000);
        else { setEnriching(false); setError('Enrichment is taking longer than expected.'); }
      } catch (e) { setEnriching(false); setError(e instanceof Error ? e.message : 'Status check failed'); }
    };
    tick();
  };

  const runEnrich = async () => {
    setEnriching(true); setError(null); setPhase('pending');
    try { poll(await onEnrich(Math.min(10, Math.max(1, numPosts)))); }
    catch (e) { setEnriching(false); setError(e instanceof Error ? e.message : 'Failed to start enrichment'); }
  };

  const post = posts[active] ?? null;
  const fmtDate = (s: string) => { try { return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return s; } };
  const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n));

  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1100 }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(95vw, 920px)', background: 'var(--color-bg)', zIndex: 1101, boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-1)' }}>{title}</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {linkedinUrl && <a href={linkedinUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', fontWeight: 600, color: '#0077B5', textDecoration: 'none' }}>LinkedIn ↗</a>}
            <button onClick={onClose} style={iconBtn}><X /></button>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
          {/* Left: post list + enrich */}
          <div style={{ width: '40%', borderRight: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '.5px', flexShrink: 0 }}>
              LinkedIn Posts · {posts.length}
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {!enriched ? (
                <Empty text="Not enriched yet" sub="Use Enrich below to scrape LinkedIn posts." />
              ) : posts.length === 0 ? (
                <Empty text="No posts found." />
              ) : posts.map((p, i) => (
                <div key={p.urnId || i} onClick={() => setActive(i)} style={{
                  display: 'flex', gap: '10px', padding: '12px 14px', cursor: 'pointer',
                  borderBottom: '1px solid var(--color-border)', borderLeft: `3px solid ${active === i ? 'var(--color-brand)' : 'transparent'}`,
                  background: active === i ? 'var(--color-brand-subtle)' : 'transparent',
                }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', background: active === i ? 'var(--color-brand)' : 'var(--color-hover)', color: active === i ? '#fff' : 'var(--color-text-2)' }}>{i + 1}</div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-3)', marginBottom: '3px' }}>{fmtDate(p.postedAt)}{p.mediaType && p.mediaType !== 'text' ? ` · ${p.mediaType}` : ''}</div>
                    <div style={{ fontSize: '12.5px', color: 'var(--color-text-1)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.text || 'No text'}</div>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '5px', fontSize: '11px', color: 'var(--color-text-3)' }}>
                      <span>♡ {p.reactions?.total ?? 0}</span><span>💬 {p.comments}</span><span>↗ {p.shares}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: '12px 14px', borderTop: '1px solid var(--color-border)', flexShrink: 0 }}>
              {error && <div style={{ fontSize: '11.5px', color: 'var(--color-danger-text)', marginBottom: '8px' }}>{error}</div>}
              {showEnrich ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input type="number" min={1} max={10} value={numPosts} onChange={e => setNumPosts(Number(e.target.value))}
                    style={{ width: '64px', padding: '7px 9px', border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-sm)', fontSize: '13px', fontFamily: 'var(--font-sans)', outline: 'none' }} />
                  <button onClick={runEnrich} disabled={enriching || !linkedinUrl} style={{ ...primaryBtn, opacity: enriching || !linkedinUrl ? 0.6 : 1 }}>
                    {enriching ? (phase === 'processing' ? 'Scraping…' : 'Queued…') : 'Enrich'}
                  </button>
                  <button onClick={() => setShowEnrich(false)} style={iconBtn}><X /></button>
                </div>
              ) : (
                <button onClick={() => setShowEnrich(true)} style={{ width: '100%', padding: '8px', border: '1px solid var(--color-border-2)', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)', fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text-2)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {enriched ? 'Re-enrich' : 'Enrich'} (max 10 posts)
                </button>
              )}
            </div>
          </div>

          {/* Right: post detail */}
          <div style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
            <div style={{ padding: '20px 24px' }}>
              {signalSlot}
              {post ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-3)' }}>{fmtDate(post.postedAt)}{post.language ? ` · ${post.language.toUpperCase()}` : ''}</span>
                    {post.postUrl && <a href={post.postUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: '#0077B5', textDecoration: 'none' }}>View Post ↗</a>}
                  </div>
                  <p style={{ fontSize: '14px', color: 'var(--color-text-1)', lineHeight: 1.65, whiteSpace: 'pre-wrap', margin: '0 0 16px' }}>{post.text || 'No text content'}</p>
                  {post.hashtags?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
                      {post.hashtags.map((t, i) => <span key={i} style={{ fontSize: '12px', color: '#0077B5', background: 'rgba(0,119,181,0.06)', padding: '3px 8px', borderRadius: 'var(--radius-sm)' }}>#{t.replace(/^#/, '')}</span>)}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '24px', padding: '14px 0', borderTop: '1px solid var(--color-border)', borderBottom: '1px solid var(--color-border)', fontSize: '13px', color: 'var(--color-text-2)' }}>
                    <span><strong>{fmt(post.reactions?.total ?? 0)}</strong> reactions</span>
                    <span><strong>{fmt(post.comments)}</strong> comments</span>
                    <span><strong>{fmt(post.shares)}</strong> shares</span>
                  </div>
                </>
              ) : !signalSlot ? (
                <Empty text={enriched ? 'No posts found.' : 'Not enriched yet'} sub={enriched ? undefined : 'Click Enrich to scrape LinkedIn posts.'} />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function Empty({ text, sub }: { text: string; sub?: string }) {
  return (
    <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--color-text-3)' }}>
      <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-text-2)', marginBottom: '4px' }}>{text}</div>
      {sub && <div style={{ fontSize: '12.5px' }}>{sub}</div>}
    </div>
  );
}

const X = () => <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="11" y2="11" /><line x1="11" y1="1" x2="1" y2="11" /></svg>;
const iconBtn: React.CSSProperties = { width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, color: 'var(--color-text-3)' };
const primaryBtn: React.CSSProperties = { padding: '7px 14px', background: 'var(--color-brand)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' };
