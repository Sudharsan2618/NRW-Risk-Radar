'use client';
import React from 'react';
import { fetchProspects, fetchEmailPreview, fetchOutreachTemplates, enrichProspectEmails, previewCompanyProspects, saveCompanyProspects, fetchLinkedInTemplates, sendLinkedInInvite, isProspectContacted, type LeadFunnelProspect, type OutreachTemplate, type PreviewProspectCandidate, type LinkedInTemplate, type LinkedInStatus } from '@/lib/leadFunnelApi';
import { type Option, MultiSelectDropdown } from '../Dropdowns';
import { TagChipInput } from './TagChipInput';
import { substitutePlaceholders, honorificFor } from '@/lib/placeholders';

// ICP management levels → Apollo person_seniorities (same set as campaign create).
const ICP_LEVELS: { value: string; label: string }[] = [
  { value: 'owner', label: 'Owner' },
  { value: 'founder', label: 'Founder' },
  { value: 'c_suite', label: 'C suite' },
  { value: 'partner', label: 'Partner' },
  { value: 'vp', label: 'Vp' },
  { value: 'head', label: 'Head' },
  { value: 'director', label: 'Director' },
  { value: 'manager', label: 'Manager' },
];

/** ICP targeting filters for the campaign (used for the client-side "matches ICP" filter). */
export interface ProspectIcp {
  seniorities?: string[];
  titles?: string[];
  excludeTitles?: string[];
  departments?: string[];
}

export function ImportProspectsPanel({
  open, onClose, runId, companyName, industrySlug,
  icp, isCompanyImport, defaultTemplateIds,
  selectedIds, onToggle, onToggleMany, sending, onSend,
  onEnriched,
}: {
  open: boolean; onClose: () => void; runId: string; companyName: string; industrySlug: string;
  /** Campaign ICP — enables the "matches ICP" filter for company-import runs. */
  icp?: ProspectIcp;
  isCompanyImport?: boolean;
  /** Campaign's pinned default templates. When non-empty, the template picker
   *  only offers these; when empty/undefined, all of the user's templates show. */
  defaultTemplateIds?: string[];
  /** Shared with the parent table so a selection made here (or in another
   *  company's panel) survives switching companies and can be sent together. */
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleMany: (ids: string[], on: boolean) => void;
  sending: boolean;
  /** Sends the whole shared selection (across every company picked so far).
   *  Resolves true if the send actually went out. ``overrides`` carries any
   *  runtime-edited content, keyed by prospectId. */
  onSend: (
    templateId?: string | null,
    overrides?: Record<string, { subject?: string; body?: string }> | null,
  ) => Promise<boolean>;
  /** Notify the parent (results table) so it can refresh after enrichment. */
  onEnriched?: () => void;
}) {
  const [prospects, setProspects] = React.useState<LeadFunnelProspect[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = React.useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = React.useState<string | null>(null);
  // Gender the salutation was built from — 'unknown' surfaces a warning so the
  // user can fix the greeting before sending.
  const [previewGender, setPreviewGender] = React.useState<'male' | 'female' | 'unknown' | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);
  const [templates, setTemplates] = React.useState<OutreachTemplate[]>([]);
  const [templateId, setTemplateId] = React.useState<string | null>(null);
  const [templateMenuOpen, setTemplateMenuOpen] = React.useState(false);
  const [enrichingIds, setEnrichingIds] = React.useState<Set<string>>(new Set());
  const [enrichError, setEnrichError] = React.useState<string | null>(null);
  const [templatesLoaded, setTemplatesLoaded] = React.useState(false);
  // Runtime content edits, keyed by prospectId. Body is the final rendered HTML
  // (format preserved) the user approved; sent only for this run.
  const [overrides, setOverrides] = React.useState<Record<string, { subject: string; body: string }>>({});
  const [editing, setEditing] = React.useState(false);
  const [editSubject, setEditSubject] = React.useState('');
  const [previewNonce, setPreviewNonce] = React.useState(0); // bump to remount the iframe
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  // "Search again" — an ad-hoc ICP that re-runs Apollo discovery for THIS
  // company only (pre-filled from the campaign ICP; edits here are not saved to
  // the campaign settings).
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [seniorityOpts, setSeniorityOpts] = React.useState<Option[]>(
    () => ICP_LEVELS.map(l => ({ id: l.value, name: l.label, selected: false }))
  );
  const [inclTitles, setInclTitles] = React.useState<string[]>([]);
  const [exclTitles, setExclTitles] = React.useState<string[]>([]);
  const [depts, setDepts] = React.useState<string[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [searchMsg, setSearchMsg] = React.useState<string | null>(null);
  // Preview → review → save staging. A search now returns candidates (nothing is
  // written) that the user selects/removes before saving.
  const [candidates, setCandidates] = React.useState<PreviewProspectCandidate[]>([]);
  const [candSelected, setCandSelected] = React.useState<Set<string>>(new Set());
  const [saving, setSaving] = React.useState(false);

  // ── LinkedIn invite (send a connection request AS the signed-in user) ───────
  // Mirrors the My-Tasks LinkedIn board: a plain "Send invite" by default, with
  // an opt-in "Add message" note that can be pre-filled from the user's own
  // LinkedIn templates. The note is rendered client-side and passed verbatim.
  const [liTemplates, setLiTemplates] = React.useState<LinkedInTemplate[]>([]);
  const [liTemplateId, setLiTemplateId] = React.useState<string | null>(null);
  const [liTemplateMenuOpen, setLiTemplateMenuOpen] = React.useState(false);
  const [liNoteOpen, setLiNoteOpen] = React.useState(false); // "Add message" expanded
  const [liNote, setLiNote] = React.useState('');
  const [liSending, setLiSending] = React.useState(false);
  const [liError, setLiError] = React.useState<string | null>(null);
  // Invites are queued and paced server-side (durable send queue) — no frontend cooldown.
  // Session-local status override, layered over the persisted prospectDetails.linkedin.
  const [liStatusById, setLiStatusById] = React.useState<Record<string, LinkedInStatus>>({});

  React.useEffect(() => {
    if (!open || !companyName) return;
    // Note: intentionally does NOT clear the (shared) selection here — a
    // prospect checked while viewing a different company must stay selected
    // when you switch to this one, so selections can accumulate across
    // companies before a single combined send.
    setLoading(true);
    fetchProspects(runId, 1, 100, companyName)
      .then(d => { setProspects(d.prospects); setActiveId(d.prospects[0]?._id ?? null); })
      .finally(() => setLoading(false));
  }, [open, runId, companyName]);

  // Load the outreach templates once when the panel opens; default to the first.
  // If the campaign pins default templates, offer only those — otherwise all of
  // the user's templates. A pinned id that no longer exists is simply dropped.
  React.useEffect(() => {
    if (!open) return;
    setTemplatesLoaded(false);
    fetchOutreachTemplates()
      .then(d => {
        const pinned = defaultTemplateIds && defaultTemplateIds.length > 0
          ? d.templates.filter(t => defaultTemplateIds.includes(t._id))
          : d.templates;
        setTemplates(pinned);
        // Keep the current selection only if it's still offered; else pick the first.
        setTemplateId(prev => (prev && pinned.some(t => t._id === prev)) ? prev : pinned[0]?._id ?? null);
      })
      .catch(() => setTemplates([]))
      .finally(() => setTemplatesLoaded(true));
  }, [open, defaultTemplateIds]);

  React.useEffect(() => {
    if (!activeId || !open || !templatesLoaded) return;
    // If the user has edited this prospect, show their saved content instead of
    // re-fetching the template (so edits survive switching prospects and back).
    const ov = overrides[activeId];
    if (ov) {
      setPreviewHtml(ov.body);
      setPreviewSubject(ov.subject || null);
      setPreviewGender(null); // user-edited content — greeting is their own
      setPreviewLoading(false);
      return;
    }
    let active = true;
    setPreviewLoading(true);
    fetchEmailPreview(runId, activeId, templateId)
      .then(d => {
        if (!active) return;
        setPreviewHtml(d.html ?? '<p style="font-family:sans-serif;color:#9B9B9B">No email template found.</p>');
        setPreviewSubject(d.subject ?? null);
        setPreviewGender(d.gender ?? null);
      })
      .catch(() => {
        if (!active) return;
        setPreviewHtml('<p style="font-family:sans-serif;color:#D32F2F">Failed to load email preview.</p>');
        setPreviewSubject(null);
        setPreviewGender(null);
      })
      .finally(() => {
        if (active) setPreviewLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeId, open, runId, templateId, templatesLoaded, overrides]);

  // Leaving a prospect or switching template exits edit mode (unsaved in-place
  // edits are discarded; already-saved overrides persist).
  React.useEffect(() => { setEditing(false); }, [activeId, templateId]);

  const active = prospects.find(p => p._id === activeId);

  // Load the user's LinkedIn INVITE templates once when the panel opens — this picker
  // fills the connection-invite note, so follow-up templates are excluded.
  React.useEffect(() => {
    if (!open) return;
    fetchLinkedInTemplates('invite')
      .then(d => setLiTemplates(d.templates))
      .catch(() => setLiTemplates([]));
  }, [open]);

  // Collapse the invite note editor whenever the active prospect changes so a
  // note written for one person never leaks onto the next.
  React.useEffect(() => {
    setLiNoteOpen(false); setLiNote(''); setLiTemplateId(null);
    setLiTemplateMenuOpen(false); setLiError(null);
  }, [activeId]);

  // Substitute the LinkedIn template placeholders client-side using the shared
  // canonical map (first / last / full name, company, job title, honorific).
  // Every argument mirrors the backend's LinkedIn renderer — including the
  // stored-gender honorific — so this note is exactly what gets sent.
  const renderLiNote = React.useCallback((msg: string, p: LeadFunnelProspect): string =>
    substitutePlaceholders(msg, {
      first: p.firstName ?? '',
      last: p.lastName ?? '',
      company: p.companyName || companyName || '',
      jobTitle: p.title ?? '',
      honorific: honorificFor(p.gender, p.firstName ?? ''),
    }),
  [companyName]);

  // Current LinkedIn status for the active prospect (session override wins over
  // the persisted state so a just-sent invite reflects immediately).
  const liStatus: LinkedInStatus | null = active
    ? (liStatusById[active._id] ?? active.prospectDetails?.linkedin?.status ?? null)
    : null;
  const hasLiUrl = !!active?.prospectDetails?.linkedinUrl;
  const liInvited = liStatus === 'invite_sent' || liStatus === 'connected' || liStatus === 'messaged';
  const liSel = liTemplates.find(t => t._id === liTemplateId) || null;

  // Send a connection request as the signed-in user. The optional note is only
  // attached when "Add message" is open and non-empty.
  const sendInvite = async () => {
    if (!active || liSending) return;
    if (!active.prospectDetails?.linkedinUrl) {
      setLiError('No LinkedIn profile URL for this prospect.');
      return;
    }
    setLiSending(true); setLiError(null);
    try {
      const note = liNoteOpen ? liNote.trim() : '';
      const r = await sendLinkedInInvite(active._id, runId, note || undefined);
      // Queued on the durable, per-user-paced send queue; it sends in the background.
      const st = r.status;
      if (st && st !== 'queued') setLiStatusById(prev => ({ ...prev, [active._id]: st }));
      setToast(st === 'queued' ? 'LinkedIn invite queued' : 'LinkedIn invite sent');
      setLiNoteOpen(false); setLiNote(''); setLiTemplateId(null);
      setTimeout(() => setToast(null), 3500);
    } catch (e) {
      setLiError(e instanceof Error ? e.message : 'Failed to queue LinkedIn invite.');
    } finally {
      setLiSending(false);
    }
  };

  // Seed the "Search again" ICP form from the campaign ICP whenever the panel
  // opens or the company changes. Edits here are ad-hoc (not saved to settings).
  React.useEffect(() => {
    if (!open) return;
    const sel = new Set(icp?.seniorities || []);
    setSeniorityOpts(ICP_LEVELS.map(l => ({ id: l.value, name: l.label, selected: sel.has(l.value) })));
    setInclTitles(icp?.titles || []);
    setExclTitles(icp?.excludeTitles || []);
    setDepts(icp?.departments || []);
    // Drop any staged review from a previous company.
    setCandidates([]);
    setCandSelected(new Set());
    setSearchMsg(null);
  }, [open, companyName, icp]);

  const toggleSeniority = (id: string) =>
    setSeniorityOpts(prev => prev.map(o => (o.id === id ? { ...o, selected: !o.selected } : o)));

  // Run a PREVIEW search — returns candidates to review; writes nothing yet.
  const runSearch = async () => {
    if (searching || !companyName) return;
    setSearching(true); setSearchMsg(null);
    try {
      const r = await previewCompanyProspects(runId, companyName, {
        seniorities: seniorityOpts.filter(o => o.selected).map(o => o.id),
        titles: inclTitles,
        excludeTitles: exclTitles,
        departments: depts,
      });
      setCandidates(r.candidates);
      setCandSelected(new Set(r.candidates.map(c => c.apolloId)));
      if (r.candidates.length === 0) {
        setSearchMsg(r.found > 0 ? `All ${r.found} already in your list` : 'No prospects found');
        setTimeout(() => setSearchMsg(null), 5000);
      } else {
        setSearchMsg(`${r.candidates.length} new to review${r.alreadyInList ? ` · ${r.alreadyInList} already in list` : ''}`);
      }
    } catch (e) {
      setSearchMsg(e instanceof Error ? e.message : 'Search failed');
      setTimeout(() => setSearchMsg(null), 5000);
    } finally {
      setSearching(false);
    }
  };

  // ── Review staging (select / remove / save / cancel) ──────────────────────
  const toggleCand = (id: string) =>
    setCandSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const removeCand = (id: string) => {
    setCandidates(cs => cs.filter(c => c.apolloId !== id));
    setCandSelected(s => { const n = new Set(s); n.delete(id); return n; });
  };
  const allCandSelected = candidates.length > 0 && candidates.every(c => candSelected.has(c.apolloId));
  const toggleAllCand = () =>
    setCandSelected(allCandSelected ? new Set() : new Set(candidates.map(c => c.apolloId)));
  const cancelReview = () => { setCandidates([]); setCandSelected(new Set()); setSearchMsg(null); };
  const saveReview = async () => {
    const chosen = candidates.filter(c => candSelected.has(c.apolloId));
    if (chosen.length === 0 || saving) return;
    setSaving(true); setSearchMsg(null);
    try {
      const r = await saveCompanyProspects(runId, companyName, chosen);
      await refetch();
      onEnriched?.();
      setCandidates([]); setCandSelected(new Set());
      setSearchMsg(`Added ${r.new} new prospect${r.new === 1 ? '' : 's'}`);
    } catch (e) {
      setSearchMsg(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
      setTimeout(() => setSearchMsg(null), 5000);
    }
  };

  // The list now shows every loaded prospect; refining is done by re-searching.
  const visibleProspects = prospects;

  // "Select all" here only (de)selects the currently-VISIBLE (filtered) prospects
  // for this company — it doesn't touch selections made for other companies.
  const allInCompanySelected = visibleProspects.length > 0 && visibleProspects.every(p => selectedIds.has(p._id));
  const toggleAllInCompany = () => onToggleMany(visibleProspects.map(p => p._id), !allInCompanySelected);

  // Sends the full shared selection (which may include prospects picked from
  // other companies too), then closes this panel once it's confirmed sent.
  const send = async () => {
    if (selectedIds.size === 0 || sending) return;
    // Only forward overrides for prospects that are actually being sent.
    const relevant: Record<string, { subject: string; body: string }> = {};
    selectedIds.forEach(id => { if (overrides[id]) relevant[id] = overrides[id]; });
    const ok = await onSend(templateId, Object.keys(relevant).length ? relevant : undefined);
    if (ok) setTimeout(onClose, 900);
  };

  // ── Content editing (this-send-only) ──────────────────────────────────────
  const activeHasOverride = !!(activeId && overrides[activeId]);

  // Content-only editing: block rich-text formatting shortcuts and force plain
  // paste so the user changes wording without touching the template's format.
  const blockFormatting = React.useCallback((e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && (k === 'b' || k === 'i' || k === 'u')) e.preventDefault();
  }, []);
  const forcePlainPaste = React.useCallback((e: ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain') ?? '';
    iframeRef.current?.contentDocument?.execCommand('insertText', false, text);
  }, []);

  const stopEditListeners = () => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    doc.designMode = 'off';
    doc.removeEventListener('keydown', blockFormatting, true);
    doc.removeEventListener('paste', forcePlainPaste, true);
  };

  const startEdit = () => {
    if (!activeId || previewLoading) return;
    setEditSubject(previewSubject ?? '');
    setEditing(true);
    const doc = iframeRef.current?.contentDocument;
    if (doc) {
      doc.designMode = 'on';
      doc.addEventListener('keydown', blockFormatting, true);
      doc.addEventListener('paste', forcePlainPaste, true);
      doc.body?.focus();
    }
  };

  const saveEdit = () => {
    if (!activeId) return;
    const doc = iframeRef.current?.contentDocument;
    const html = doc?.documentElement?.outerHTML ?? previewHtml ?? '';
    stopEditListeners();
    setOverrides(prev => ({ ...prev, [activeId]: { subject: editSubject.trim(), body: html } }));
    setEditing(false);
  };

  const cancelEdit = () => {
    stopEditListeners();
    setEditing(false);
    setPreviewNonce(n => n + 1); // remount iframe → discard in-place edits
  };

  const resetEdit = () => {
    if (!activeId) return;
    stopEditListeners();
    setEditing(false);
    setOverrides(prev => { const next = { ...prev }; delete next[activeId]; return next; });
    setPreviewNonce(n => n + 1);
  };

  // Re-pull prospects in place (keeps selection/active) so revealed emails show.
  const refetch = React.useCallback(async () => {
    if (!companyName) return;
    const d = await fetchProspects(runId, 1, 100, companyName);
    setProspects(d.prospects);
  }, [runId, companyName]);

  // Reveal real emails via Apollo for the given prospect ids (single or bulk).
  const enrich = async (ids: string[]) => {
    if (ids.length === 0) return;
    setEnrichingIds(new Set(ids));
    setEnrichError(null);
    try {
      const r = await enrichProspectEmails(runId, ids);
      setToast(r.message || `Revealed ${r.enriched} of ${r.total} email${r.total === 1 ? '' : 's'}`);
      await refetch();
      onEnriched?.();
    } catch (e) {
      setEnrichError(e instanceof Error ? e.message : 'Enrichment failed');
    } finally {
      setEnrichingIds(new Set());
      setTimeout(() => setToast(null), 2500);
    }
  };
  const enriching = enrichingIds.size > 0;

  if (!open) return null;
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 1100 }} />
      <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(95vw, 980px)', background: 'var(--color-bg)', zIndex: 1101, boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-1)' }}>Prospects</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-3)' }}>{companyName}</div>
          </div>
          <button onClick={onClose} style={iconBtn}><X /></button>
        </div>

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
          {/* List */}
          <div style={{ width: '40%', borderRight: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer', flexShrink: 0 }}>
              <Check checked={allInCompanySelected} onChange={toggleAllInCompany} />
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                Select all · {visibleProspects.length}{visibleProspects.length !== prospects.length ? ` of ${prospects.length}` : ''}
              </span>
            </label>
            {/* Search again — re-run Apollo discovery for THIS company with an ad-hoc ICP */}
            <div style={{ borderBottom: '1px solid var(--color-border)', flexShrink: 0, background: 'var(--color-surface)' }}>
              <div onClick={() => setSearchOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', cursor: 'pointer' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '11.5px', fontWeight: 700, color: 'var(--color-text-2)', textTransform: 'uppercase', letterSpacing: '.5px' }}>
                  <svg width="13" height="13" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="5.5" /><line x1="12" y1="12" x2="16" y2="16" /></svg>
                  Search again
                </span>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-text-3)', transform: searchOpen ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform .2s' }}><path d="M2 4L6 8L10 4" /></svg>
              </div>
              {searchOpen && (candidates.length === 0 ? (
                <div style={{ padding: '2px 14px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-3)', lineHeight: 1.5 }}>
                    Re-run the search for <strong style={{ color: 'var(--color-text-2)' }}>{companyName}</strong> with these ICP criteria. You&apos;ll review the matches and pick which to add — the campaign settings and other companies are untouched.
                  </div>
                  <div>
                    <div style={icpLabelStyle}>Management level</div>
                    <MultiSelectDropdown options={seniorityOpts} onToggle={toggleSeniority} placeholder="Select management levels…" searchPlaceholder="Search levels" />
                  </div>
                  <div>
                    <div style={icpLabelStyle}>Include job titles</div>
                    <TagChipInput tags={inclTitles} onAdd={t => setInclTitles(p => [...p, t])} onRemove={t => setInclTitles(p => p.filter(x => x !== t))} placeholder="e.g. Head of Sales — Enter to add" />
                  </div>
                  <div>
                    <div style={icpLabelStyle}>Exclude job titles</div>
                    <TagChipInput tags={exclTitles} onAdd={t => setExclTitles(p => [...p, t])} onRemove={t => setExclTitles(p => p.filter(x => x !== t))} placeholder="e.g. Intern — Enter to add" />
                  </div>
                  <div>
                    <div style={icpLabelStyle}>Departments &amp; job function</div>
                    <TagChipInput tags={depts} onAdd={t => setDepts(p => [...p, t])} onRemove={t => setDepts(p => p.filter(x => x !== t))} placeholder="e.g. sales — Enter to add" />
                  </div>
                  <button onClick={runSearch} disabled={searching} style={{ padding: '9px', background: searching ? 'var(--color-border-2)' : 'var(--color-brand)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '12.5px', fontWeight: 700, cursor: searching ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}>
                    {searching ? 'Searching…' : 'Search'}
                  </button>
                  {searchMsg && <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-text-2)' }}>{searchMsg}</div>}
                </div>
              ) : (
                <div style={{ padding: '2px 14px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={icpLabelStyle}>Review found prospects</span>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-3)' }}>{candSelected.size} of {candidates.length} selected</span>
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <Check checked={allCandSelected} onChange={toggleAllCand} />
                    <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-text-2)' }}>Select all</span>
                  </label>
                  <div style={{ maxHeight: '260px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
                    {candidates.map(c => {
                      const on = candSelected.has(c.apolloId);
                      return (
                        <div key={c.apolloId} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderBottom: '1px solid var(--color-border)', background: on ? 'var(--color-brand-subtle)' : 'transparent' }}>
                          <Check checked={on} onChange={() => toggleCand(c.apolloId)} />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.firstName} {c.lastName}</div>
                            <div style={{ fontSize: '11px', color: 'var(--color-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title || '—'}</div>
                          </div>
                          <button onClick={() => removeCand(c.apolloId)} title="Remove from list" style={{ ...iconBtn, width: 24, height: 24 }}><X /></button>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={cancelReview} disabled={saving} style={{ flex: 1, padding: '9px', background: 'var(--color-bg)', color: 'var(--color-text-2)', border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)', fontSize: '12.5px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}>
                      Cancel
                    </button>
                    <button onClick={saveReview} disabled={saving || candSelected.size === 0} style={{ flex: 1.4, padding: '9px', background: (saving || candSelected.size === 0) ? 'var(--color-border-2)' : 'var(--color-brand)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '12.5px', fontWeight: 700, cursor: (saving || candSelected.size === 0) ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)' }}>
                      {saving ? 'Saving…' : `Save ${candSelected.size}`}
                    </button>
                  </div>
                  {searchMsg && <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-text-2)' }}>{searchMsg}</div>}
                </div>
              ))}
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-3)', fontSize: '13px' }}>Loading…</div>
                : prospects.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-3)', fontSize: '13px' }}>No prospects.</div>
                : visibleProspects.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-3)', fontSize: '13px' }}>No prospects match these filters.</div>
                : visibleProspects.map(p => (
                  <div key={p._id} onClick={() => setActiveId(p._id)} style={{
                    display: 'flex', gap: '10px', padding: '12px 14px', cursor: 'pointer', alignItems: 'center',
                    borderBottom: '1px solid var(--color-border)', borderLeft: `3px solid ${activeId === p._id ? 'var(--color-brand)' : 'transparent'}`,
                    background: activeId === p._id ? 'var(--color-brand-subtle)' : 'transparent',
                  }}>
                    <span onClick={e => e.stopPropagation()}><Check checked={selectedIds.has(p._id)} onChange={() => onToggle(p._id)} /></span>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--color-brand-subtle)', color: 'var(--color-brand)', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{(p.firstName?.[0] ?? '') + (p.lastName?.[0] ?? '')}</div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.firstName} {p.lastName}</div>
                      <div style={{ fontSize: '11.5px', color: 'var(--color-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                    </div>
                    {isProspectContacted(p) && <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--color-success-text)' }}>SENT</span>}
                  </div>
                ))}
            </div>
            <div style={{ padding: '12px 14px', borderTop: '1px solid var(--color-border)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {enrichError && <div style={{ fontSize: '11.5px', color: 'var(--color-danger-text)', fontWeight: 600 }}>{enrichError}</div>}
              {selectedIds.size > 0 && (
                <div style={{ fontSize: '11px', color: 'var(--color-text-3)' }}>
                  {selectedIds.size} selected across all companies
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => enrich(Array.from(selectedIds))} disabled={enriching || selectedIds.size === 0} title="Reveal verified emails for the selected prospects via Apollo (uses credits)" style={{ flex: 1, padding: '10px', background: 'var(--color-bg)', border: `1px solid ${selectedIds.size ? 'var(--color-brand)' : 'var(--color-border-2)'}`, color: selectedIds.size ? 'var(--color-brand-text)' : 'var(--color-text-3)', borderRadius: 'var(--radius-md)', fontSize: '12.5px', fontWeight: 700, cursor: selectedIds.size && !enriching ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)' }}>
                  {enriching ? 'Enriching…' : `Enrich (${selectedIds.size})`}
                </button>
                <button onClick={send} disabled={sending || selectedIds.size === 0} style={{ flex: 1.4, padding: '10px', background: selectedIds.size ? 'var(--color-brand)' : 'var(--color-border-2)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 700, cursor: selectedIds.size ? 'pointer' : 'not-allowed', fontFamily: 'var(--font-sans)' }}>
                  {sending ? 'Sending…' : `Send to ${selectedIds.size} selected`}
                </button>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
            {active ? (
              <div style={{ padding: '24px' }}>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text-1)' }}>{active.firstName} {active.lastName}</div>
                <div style={{ fontSize: '13.5px', color: 'var(--color-text-2)', marginBottom: '12px' }}>{active.title} at <span style={{ color: 'var(--color-brand)' }}>{companyName}</span></div>

                {/* Email status / single enrich */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  {active.email ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--color-success-text)', background: 'var(--color-success-bg)', padding: '4px 10px', borderRadius: 'var(--radius-full)' }}>
                      <svg width="13" height="13" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="14" height="10" rx="1.5" /><polyline points="2.5,5 9,10 15.5,5" /></svg>
                      {active.email}
                    </span>
                  ) : (
                    <>
                      <span style={{ fontSize: '12.5px', color: 'var(--color-text-3)', fontStyle: 'italic' }}>No email yet</span>
                      <button onClick={() => enrich([active._id])} disabled={enrichingIds.has(active._id) || enriching}
                        title="Reveal this prospect's verified email via Apollo (uses credits)"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '5px 12px', background: 'var(--color-brand)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '12px', fontWeight: 700, cursor: enriching ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)', opacity: enriching && !enrichingIds.has(active._id) ? 0.5 : 1 }}>
                        {enrichingIds.has(active._id) ? 'Enriching…' : 'Enrich email'}
                      </button>
                    </>
                  )}
                </div>

                {(() => {
                  const li = active.prospectDetails?.linkedinUrl;
                  const href = li ? (/^https?:\/\//i.test(li) ? li : `https://${li}`) : null;
                  const loc = active.prospectDetails?.location
                    || [active.prospectDetails?.city, active.prospectDetails?.state, active.prospectDetails?.country].filter(Boolean).join(', ');
                  const phone = active.prospectDetails?.phone;
                  if (!href && !loc && !phone) return null;
                  return (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '16px', alignItems: 'center' }}>
                      {href && (
                        <a href={href} target="_blank" rel="noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--color-brand)', textDecoration: 'none' }}>
                          <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2.5" y="2.5" width="13" height="13" rx="1.8" />
                            <line x1="5.5" y1="7.5" x2="5.5" y2="13" />
                            <circle cx="5.5" cy="5" r="0.8" fill="currentColor" stroke="none" />
                            <path d="M8.5 13V7.5M8.5 9.5c0-1.1 1-2 2.2-2s2.3.9 2.3 2.5V13" />
                          </svg>
                          {href.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '')}
                        </a>
                      )}
                      {loc && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--color-text-2)' }}>
                          <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="var(--color-text-3)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 1.5c-3 0-5.5 2.4-5.5 5.5 0 4 5.5 9.5 5.5 9.5s5.5-5.5 5.5-9.5c0-3.1-2.5-5.5-5.5-5.5z" /><circle cx="9" cy="7" r="2" />
                          </svg>
                          {loc}
                        </span>
                      )}
                      {phone && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--color-text-2)', fontFamily: 'var(--font-mono)' }}>
                          <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="var(--color-text-3)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 4.5c0-1 .8-2 1.8-2h1.6c.4 0 .8.3.9.7L8 6c.1.4 0 .8-.3 1L6.5 8a8 8 0 0 0 3.5 3.5l1-1.2c.3-.3.7-.4 1.1-.3l2.8.7c.4.1.7.5.7.9v1.6c0 1-1 1.8-2 1.8C7.4 15 3 10.6 3 4.5z" />
                          </svg>
                          {phone}
                        </span>
                      )}
                    </div>
                  );
                })()}

                {/* ── LinkedIn connection — send an invite as the signed-in user ── */}
                <div style={{ marginBottom: '24px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11px', fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '8px' }}>
                    <LinkedInMark />
                    LinkedIn connection
                  </div>
                  <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '12px 14px', background: 'var(--color-surface)', borderBottom: (liNoteOpen && !liInvited) ? '1px solid var(--color-border)' : 'none' }}>
                      <div style={{ minWidth: 0, fontSize: '12.5px', color: 'var(--color-text-2)' }}>
                        To: <span style={{ fontWeight: 700, color: 'var(--color-text-1)' }}>{active.firstName} {active.lastName}</span>
                      </div>
                      {!hasLiUrl ? (
                        <span style={{ fontSize: '11.5px', color: 'var(--color-text-3)', fontStyle: 'italic', flexShrink: 0 }}>No LinkedIn URL</span>
                      ) : liInvited ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: 'var(--color-success-text)', background: 'var(--color-success-bg)', borderRadius: 'var(--radius-full)', padding: '4px 10px', flexShrink: 0 }}>
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,6.5 5,9.5 10,3.5" /></svg>
                          {liStatus === 'invite_sent' ? 'Contacted' : 'Response received'}
                        </span>
                      ) : (
                        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                          <button onClick={sendInvite} disabled={liSending}
                            title="Send a LinkedIn connection invite"
                            style={{ ...liPrimaryBtn, opacity: liSending ? 0.6 : 1, cursor: liSending ? 'not-allowed' : 'pointer' }}>
                            {liSending ? 'Queuing…' : 'Send invite'}
                          </button>
                          {!liNoteOpen
                            ? <button onClick={() => setLiNoteOpen(true)} style={liGhostBtn}>Add message</button>
                            : <button onClick={() => { setLiNoteOpen(false); setLiNote(''); setLiTemplateId(null); }} style={liGhostBtn}>Remove message</button>}
                        </div>
                      )}
                    </div>

                    {liNoteOpen && !liInvited && (
                      <div style={{ padding: '12px 14px', background: 'var(--color-bg)' }}>
                        {/* LinkedIn template picker — the user's own saved templates */}
                        {liTemplates.length > 0 && (
                          <div style={{ position: 'relative', marginBottom: '10px' }}>
                            <button type="button" onClick={() => setLiTemplateMenuOpen(o => !o)}
                              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'var(--font-sans)', textAlign: 'left' }}>
                              <span style={{ minWidth: 0, flex: 1, fontSize: '12.5px', fontWeight: 600, color: liSel ? 'var(--color-text-1)' : 'var(--color-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {liSel ? (liSel.name || 'Untitled template') : 'Use one of your LinkedIn templates (optional)'}
                              </span>
                              <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="var(--color-text-3)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transform: liTemplateMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}><polyline points="5,7 9,11 13,7" /></svg>
                            </button>
                            {liTemplateMenuOpen && (
                              <>
                                <div onClick={() => setLiTemplateMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
                                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 11, background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden', maxHeight: '260px', overflowY: 'auto' }}>
                                  <div onClick={() => { setLiTemplateId(null); setLiNote(''); setLiTemplateMenuOpen(false); }}
                                    style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--color-border)', fontSize: '12.5px', color: 'var(--color-text-2)', background: liTemplateId === null ? 'var(--color-brand-subtle)' : 'transparent' }}>
                                    Write my own note
                                  </div>
                                  {liTemplates.map(t => {
                                    const on = t._id === liTemplateId;
                                    const snippet = (t.message || '').replace(/\s+/g, ' ').trim();
                                    return (
                                      <div key={t._id} onClick={() => { setLiTemplateId(t._id); setLiNote(renderLiNote(t.message || '', active)); setLiTemplateMenuOpen(false); }}
                                        style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--color-border)', background: on ? 'var(--color-brand-subtle)' : 'transparent' }}>
                                        <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name || 'Untitled template'}</div>
                                        {snippet && <div style={{ fontSize: '11px', color: 'var(--color-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>{snippet}</div>}
                                      </div>
                                    );
                                  })}
                                </div>
                              </>
                            )}
                          </div>
                        )}
                        <textarea value={liNote} onChange={e => setLiNote(e.target.value)} rows={3} maxLength={300}
                          placeholder="Write a short note to include with your invite (optional)…"
                          style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: '12.5px', fontFamily: 'var(--font-sans)', color: 'var(--color-text-1)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg)', resize: 'vertical' }} />
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginTop: '6px', fontSize: '11px', color: 'var(--color-text-3)' }}>
                          <span>Personalized-note invites are capped by LinkedIn (~5/month on free accounts). A plain invite has a higher limit.</span>
                          <span style={{ flexShrink: 0, fontWeight: 600 }}>{liNote.length}/300</span>
                        </div>
                      </div>
                    )}
                  </div>
                  {liError && (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: '8px', padding: '9px 12px', background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border)', borderRadius: 'var(--radius-md)', fontSize: '12px', color: 'var(--color-danger-text)', lineHeight: 1.45 }}>
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" style={{ flexShrink: 0, marginTop: '1px' }}><circle cx="8" cy="8" r="6.5" /><line x1="8" y1="5" x2="8" y2="8.5" /><circle cx="8" cy="11" r="0.6" fill="currentColor" /></svg>
                      {liError}
                    </div>
                  )}
                </div>

                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '8px' }}>Outreach email preview</div>
                {previewGender === 'unknown' && !activeHasOverride && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '9px 12px', marginBottom: '8px', background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning-border, var(--color-warning-text))', borderRadius: 'var(--radius-md)', fontSize: '12px', color: 'var(--color-warning-text)', lineHeight: 1.45 }}>
                    <svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><path d="M9 1.8 1.2 15.5h15.6z" /><line x1="9" y1="7" x2="9" y2="11" /><circle cx="9" cy="13.4" r="0.5" fill="currentColor" /></svg>
                    <span>Couldn&apos;t confirm this person&apos;s gender, so the greeting uses their name instead of Mr/Ms. Use <strong>Edit content</strong> to adjust the salutation before sending.</span>
                  </div>
                )}
                <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <div style={{ padding: '10px 14px', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', fontSize: '12.5px', color: 'var(--color-text-2)' }}>
                    {/* Template selector — pick which outreach template gets sent (dropdown) */}
                    {(() => {
                      const sel = templates.find(t => t._id === templateId);
                      return (
                        <div style={{ position: 'relative', marginBottom: '10px' }}>
                          <button
                            type="button"
                            onClick={() => setTemplateMenuOpen(o => !o)}
                            disabled={templates.length === 0}
                            style={{
                              width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                              padding: '8px 12px', background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                              borderRadius: 'var(--radius-md)', cursor: templates.length === 0 ? 'default' : 'pointer',
                              fontFamily: 'var(--font-sans)', textAlign: 'left',
                            }}>
                            <span style={{ minWidth: 0, flex: 1, fontSize: '13px', fontWeight: 600, color: 'var(--color-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {sel ? (sel.name || `${sel.industry} · ${sel.persona}`) : (templates.length === 0 ? 'No templates found' : 'Select a template')}
                            </span>
                            {sel?.language && <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-2)', background: 'var(--color-surface)', border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-sm)', padding: '2px 8px', whiteSpace: 'nowrap' }}>{sel.language}</span>}
                            <svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="var(--color-text-3)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transform: templateMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
                              <polyline points="5,7 9,11 13,7" />
                            </svg>
                          </button>
                          {templateMenuOpen && templates.length > 0 && (
                            <>
                              <div onClick={() => setTemplateMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
                              <div style={{
                                position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 11,
                                background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
                                boxShadow: 'var(--shadow-lg)', overflow: 'hidden', maxHeight: '320px', overflowY: 'auto',
                              }}>
                                {templates.map(t => {
                                  const on = t._id === templateId;
                                  return (
                                    <div key={t._id} onClick={() => { if (t._id !== templateId) setOverrides({}); setTemplateId(t._id); setTemplateMenuOpen(false); }} style={{
                                      display: 'grid', gridTemplateColumns: '22px 1fr auto auto', gap: '10px', alignItems: 'center',
                                      padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--color-border)',
                                      background: on ? 'var(--color-brand-subtle)' : 'transparent',
                                    }}>
                                      <Radio checked={on} />
                                      <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name || `${t.industry} · ${t.persona}`}</div>
                                        {t.subject && <div style={{ fontSize: '11px', color: 'var(--color-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</div>}
                                      </div>
                                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                        {(t.tags && t.tags.length > 0) ? t.tags.map(tag => (
                                          <span key={tag} style={{ fontSize: '10.5px', fontWeight: 600, color: 'var(--color-text-2)', background: 'var(--color-surface)', border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-full)', padding: '2px 8px', whiteSpace: 'nowrap' }}>{tag}</span>
                                        )) : <span style={{ fontSize: '11px', color: 'var(--color-text-3)' }}>—</span>}
                                      </div>
                                      <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-2)', background: 'var(--color-surface)', border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-sm)', padding: '2px 8px', whiteSpace: 'nowrap' }}>{t.language || '—'}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })()}
                    {/* To + Subject on the same line */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap', rowGap: '6px' }}>
                      <span>To: <span style={{ fontWeight: 700, color: 'var(--color-brand)' }}>{active.email || ''}</span></span>
                      {editing ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 200 }}>
                          Subject:
                          <input
                            value={editSubject}
                            onChange={e => setEditSubject(e.target.value)}
                            placeholder="Email subject"
                            style={{ flex: 1, minWidth: 120, padding: '4px 8px', fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text-1)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-sans)', background: 'var(--color-bg)' }}
                          />
                        </span>
                      ) : (previewSubject && <span>Subject: <span style={{ fontWeight: 700, color: 'var(--color-text-1)' }}>{previewSubject}</span></span>)}
                      {activeHasOverride && !editing && (
                        <span style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--color-brand-text)', background: 'var(--color-brand-subtle)', borderRadius: 'var(--radius-full)', padding: '2px 8px', letterSpacing: '.3px' }}>EDITED</span>
                      )}
                    </div>
                  </div>
                  {/* Edit toolbar — content-only editing for this send */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 14px', borderBottom: '1px solid var(--color-border)', background: 'var(--color-bg)' }}>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-3)' }}>
                      {editing ? 'Editing content — text only, formatting is locked' : 'Edit the wording for this send only. The layout stays fixed.'}
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {editing ? (
                        <>
                          <button onClick={cancelEdit} style={toolBtn(false)}>Cancel</button>
                          <button onClick={saveEdit} style={toolBtn(true)}>Save</button>
                        </>
                      ) : (
                        <>
                          {activeHasOverride && <button onClick={resetEdit} style={toolBtn(false)}>Reset</button>}
                          <button onClick={startEdit} disabled={previewLoading} style={{ ...toolBtn(true), opacity: previewLoading ? 0.5 : 1, cursor: previewLoading ? 'not-allowed' : 'pointer' }}>Edit content</button>
                        </>
                      )}
                    </div>
                  </div>
                  {previewLoading ? <div style={{ padding: 60, textAlign: 'center', color: 'var(--color-text-3)', fontSize: '13px' }}>Rendering template…</div>
                    : <iframe ref={iframeRef} key={`${activeId}-${templateId}-${previewNonce}`} srcDoc={previewHtml ?? ''} title="Email preview" style={{ width: '100%', height: '520px', border: 0, background: '#fff' }} />}
                </div>
              </div>
            ) : <div style={{ padding: 60, textAlign: 'center', color: 'var(--color-text-3)', fontSize: '13px' }}>Select a prospect.</div>}
          </div>
        </div>
        {toast && <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', background: 'var(--color-text-1)', color: '#fff', padding: '8px 16px', borderRadius: 'var(--radius-md)', fontSize: '12.5px', fontWeight: 600 }}>{toast}</div>}
      </div>
    </>
  );
}

const icpLabelStyle: React.CSSProperties = {
  fontSize: '11px', fontWeight: 700, color: 'var(--color-text-3)',
  textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: '5px',
};

function toolBtn(primary: boolean): React.CSSProperties {
  return {
    padding: '5px 12px', fontSize: '12px', fontWeight: 700,
    borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-sans)', cursor: 'pointer',
    border: primary ? 'none' : '1px solid var(--color-border-2)',
    background: primary ? 'var(--color-brand)' : 'var(--color-bg)',
    color: primary ? '#fff' : 'var(--color-text-2)',
  };
}
const X = () => <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="11" y2="11" /><line x1="11" y1="1" x2="1" y2="11" /></svg>;

const liPrimaryBtn: React.CSSProperties = { padding: '7px 16px', background: 'var(--color-brand)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' };
const liGhostBtn: React.CSSProperties = { padding: '7px 14px', background: 'var(--color-bg)', color: 'var(--color-text-2)', border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)' };
const LinkedInMark = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" style={{ flexShrink: 0 }} aria-hidden>
    <rect width="24" height="24" rx="4" fill="var(--color-avatar-blue)" />
    <path d="M7 9.5h2.1V17H7zM8.05 6.2a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5zM10.8 9.5h2v1.02c.28-.53 1.05-1.18 2.27-1.18 2 0 2.6 1.18 2.6 3.18V17h-2.1v-3.1c0-.84-.3-1.42-1.06-1.42-.66 0-1.02.45-1.2.88-.06.16-.07.38-.07.6V17h-2.1z" fill="#fff" />
  </svg>
);
const iconBtn: React.CSSProperties = { width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6, color: 'var(--color-text-3)' };
function Radio({ checked }: { checked: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: '50%', border: `1.5px solid ${checked ? 'var(--color-brand)' : 'var(--color-border-2)'}`, flexShrink: 0 }}>
      {checked && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-brand)' }} />}
    </span>
  );
}
function Check({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <span onClick={e => { e.preventDefault(); onChange(); }} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${checked ? 'var(--color-brand)' : 'var(--color-border-2)'}`, background: checked ? 'var(--color-brand)' : '#fff', cursor: 'pointer', flexShrink: 0 }}>
      {checked && <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="2,6.5 5,9.5 10,3.5" /></svg>}
    </span>
  );
}
