'use client';
import React from 'react';
import { TestTemplateDialog } from '@/components/milo/TestTemplateDialog';
import { authStorage } from '@/lib/authStorage';
import { ConfirmDialog } from './ConfirmDialog';
import {
  fetchLinkedInTemplates,
  createLinkedInTemplate,
  updateLinkedInTemplate,
  deleteLinkedInTemplate,
  fetchLinkedInTemplateTestInfo,
  sendLinkedInTemplateTest,
  type LinkedInTemplate,
  type LinkedInTemplateInput,
} from '@/lib/leadFunnelApi';
import { PH, substitutePlaceholders } from '@/lib/placeholders';

/* ─────────────────────────────  Shared styles  ───────────────────────────── */

const primaryBtn: React.CSSProperties = { padding: '7px 16px', background: 'var(--color-brand)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' };
const ghostBtn: React.CSSProperties = { padding: '7px 16px', background: 'var(--color-bg)', color: 'var(--color-text-1)', border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' };
const dangerBtn: React.CSSProperties = { padding: '7px 16px', background: 'var(--color-bg)', color: 'var(--color-danger-text)', border: '1px solid var(--color-danger-border)', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' };
const caps: React.CSSProperties = { fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--color-text-3)' };
const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '8px 11px', fontSize: '13px', fontFamily: 'var(--font-sans)', color: 'var(--color-text-1)', border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg)' };

const NEW_ID = '__new__';

// Template categories. `invite` fills the connection-invite note; `follow-up` fills the
// message sent after a prospect accepts (and is the template pinned in a campaign's
// default settings). Every template belongs to exactly one.
const CATEGORIES: { value: NonNullable<LinkedInTemplate['category']>; label: string; hint: string }[] = [
  { value: 'invite', label: 'Invite', hint: 'Default note attached to connection invites' },
  { value: 'follow-up', label: 'Follow-up', hint: 'Message sent after a prospect accepts · pinned in Campaign Settings' },
];
function categoryLabel(c?: LinkedInTemplate['category']): string {
  return CATEGORIES.find(x => x.value === c)?.label ?? 'Invite';
}

// Placeholders users can drop into a LinkedIn message; the campaign screen
// substitutes them at view/send time via the shared canonical map. Three name
// tokens (first / last / full) plus company and the courtesy title.
const INSERT_CHIPS: { token: string; label: string }[] = [
  { token: PH.FIRST, label: 'First name' },
  { token: PH.LAST, label: 'Last name' },
  { token: PH.FULL, label: 'Full name' },
  { token: PH.COMPANY, label: 'Company' },
  { token: PH.TITLE, label: 'Title (Mr/Ms)' },
];

const DEFAULT_MESSAGE = `Hi ${PH.FIRST},

I came across ${PH.COMPANY} and wanted to reach out. Would love to connect and share how we might be able to help.

Best regards`;

// Sample values used purely for the live preview so a user can see what the
// message reads like once substituted.
function renderPreview(message: string): string {
  return substitutePlaceholders(message, {
    first: 'Alex', last: 'Johnson', company: 'Acme Corp', honorific: 'Mr',
  });
}

/** A blank draft for the "New template" flow. */
function emptyDraft(): LinkedInTemplate {
  return { _id: NEW_ID, name: '', message: DEFAULT_MESSAGE, tags: [], category: 'invite' };
}

/* ─────────────────────────────  List row  ───────────────────────────── */

function TemplateRow({ t, active, onSelect }: { t: LinkedInTemplate; active: boolean; onSelect: () => void }) {
  const [hov, setHov] = React.useState(false);
  const snippet = (t.message || '').replace(/\s+/g, ' ').trim();
  return (
    <div onClick={onSelect} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--color-border)',
        borderLeft: `3px solid ${active ? 'var(--color-brand)' : 'transparent'}`,
        background: active ? 'var(--color-brand-subtle)' : hov ? 'var(--color-row-hover)' : 'var(--color-bg)',
        transition: 'background .12s',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
          {t.name || 'Untitled template'}
        </div>
        <span style={{ flexShrink: 0, fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', color: 'var(--color-brand-text)', background: 'var(--color-brand-subtle)', borderRadius: 'var(--radius-full)', padding: '2px 8px' }}>
          {categoryLabel(t.category)}
        </span>
      </div>
      {snippet && <div style={{ fontSize: '12px', color: 'var(--color-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>{snippet}</div>}
    </div>
  );
}

/* ─────────────────────────────  Field helpers  ───────────────────────────── */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <span style={caps}>{label}</span>
      {children}
    </label>
  );
}

function TagEditor({ tags, onChange }: { tags: string[]; onChange: (next: string[]) => void }) {
  const [input, setInput] = React.useState('');
  const add = () => {
    const v = input.trim();
    if (v && !tags.some(t => t.toLowerCase() === v.toLowerCase())) onChange([...tags, v]);
    setInput('');
  };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', padding: '6px 8px', border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg)' }}>
      {tags.map(tag => (
        <span key={tag} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600, color: 'var(--color-brand-text)', background: 'var(--color-brand-subtle)', borderRadius: 'var(--radius-full)', padding: '3px 4px 3px 9px' }}>
          {tag}
          <button onClick={() => onChange(tags.filter(t => t !== tag))} title="Remove tag" style={{ width: '15px', height: '15px', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-brand-text)', padding: 0 }}>
            <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="11" y2="11" /><line x1="11" y1="1" x2="1" y2="11" /></svg>
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }}
        onBlur={add}
        placeholder={tags.length === 0 ? 'Add an email / tag…' : 'Add…'}
        style={{ flex: 1, minWidth: '120px', border: 'none', outline: 'none', background: 'none', fontSize: '12.5px', fontFamily: 'var(--font-sans)', color: 'var(--color-text-1)', padding: '3px 2px' }}
      />
    </div>
  );
}

/* ─────────────────────────────  Editor  ───────────────────────────── */

function TemplateEditor({ draft, dirty, saving, deleting, onChange, onSave, onDelete, onDuplicate, onTest }: {
  draft: LinkedInTemplate; dirty: boolean; saving: boolean; deleting: boolean;
  onChange: (patch: Partial<LinkedInTemplate>) => void; onSave: () => void; onDelete: () => void; onDuplicate: () => void;
  onTest: () => void;
}) {
  const isNew = draft._id === NEW_ID;
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const message = draft.message ?? '';

  // Insert a placeholder token at the caret (or replacing the current selection),
  // then restore focus so the user can keep typing right after it.
  const insertPlaceholder = (token: string) => {
    const el = textareaRef.current;
    if (!el) { onChange({ message: message + token }); return; }
    const start = el.selectionStart ?? message.length;
    const end = el.selectionEnd ?? message.length;
    const next = message.slice(0, start) + token + message.slice(end);
    onChange({ message: next });
    // Restore caret just after the inserted token on the next frame.
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const chipBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: '5px',
    padding: '4px 10px', fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-mono)',
    color: 'var(--color-brand-text)', background: 'var(--color-brand-subtle)',
    border: '1px solid var(--color-brand-border, var(--color-border-2))', borderRadius: 'var(--radius-full)',
    cursor: 'pointer',
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
      {/* editor header / actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 20px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {isNew ? 'New template' : (draft.name || 'Untitled template')}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-3)' }}>
            {isNew ? 'Write your message and save to create' : draft.updatedAt ? `Updated ${new Date(draft.updatedAt).toLocaleDateString()}` : 'LinkedIn message template'}
          </div>
        </div>
        {dirty && <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-warning-text)' }}>Unsaved changes</span>}
        {!isNew && (
          <button onClick={onDuplicate} title="Create a new template pre-filled with this one's content" style={ghostBtn}>
            Duplicate
          </button>
        )}
        <button onClick={onSave} disabled={saving || (!dirty && !isNew)} style={{ ...primaryBtn, opacity: (saving || (!dirty && !isNew)) ? 0.55 : 1, cursor: (saving || (!dirty && !isNew)) ? 'not-allowed' : 'pointer' }}>
          {saving ? 'Saving…' : isNew ? 'Create template' : 'Save changes'}
        </button>
      </div>

      {/* scrollable form */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', minHeight: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '14px', marginBottom: '16px' }}>
          <Field label="Title (name)">
            <input value={draft.name ?? ''} onChange={e => onChange({ name: e.target.value })} placeholder="e.g. Connection request – Founders" style={inputStyle} />
          </Field>
          <Field label="Category">
            <div style={{ display: 'flex', gap: '8px' }}>
              {CATEGORIES.map(c => {
                const selected = (draft.category ?? 'invite') === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => onChange({ category: c.value })}
                    title={c.hint}
                    style={{
                      flex: 1, textAlign: 'left', padding: '10px 12px', cursor: 'pointer',
                      borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-sans)',
                      border: `1.5px solid ${selected ? 'var(--color-brand)' : 'var(--color-border-2)'}`,
                      background: selected ? 'var(--color-brand-subtle)' : 'var(--color-bg)',
                    }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: selected ? 'var(--color-brand-text)' : 'var(--color-text-1)' }}>{c.label}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-3)', marginTop: '2px', lineHeight: 1.4 }}>{c.hint}</div>
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="Tags (who can see this template)">
            <TagEditor tags={draft.tags ?? []} onChange={tags => onChange({ tags })} />
          </Field>
        </div>

        {/* placeholder inserters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
          <span style={caps}>Insert placeholder</span>
          {INSERT_CHIPS.map(c => (
            <button key={c.token} type="button" title={c.token} onClick={() => insertPlaceholder(c.token)} style={chipBtn}>+ {c.label}</button>
          ))}
        </div>

        {/* message body */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={caps}>Message</span>
          <span style={{ fontSize: '11.5px', color: 'var(--color-text-3)' }}>{message.length} characters</span>
        </div>
        <textarea
          ref={textareaRef}
          value={message}
          onChange={e => onChange({ message: e.target.value })}
          placeholder={`Write your LinkedIn message. Insert ${PH.FIRST}, ${PH.FULL} or ${PH.COMPANY} anywhere.`}
          spellCheck
          style={{ width: '100%', boxSizing: 'border-box', height: '220px', resize: 'vertical', padding: '14px', fontSize: '13.5px', lineHeight: 1.6, fontFamily: 'var(--font-sans)', color: 'var(--color-text-1)', background: 'var(--color-bg)', border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)', outline: 'none' }}
        />
        <div style={{ fontSize: '11.5px', color: 'var(--color-text-3)', marginTop: '8px' }}>
          Placeholders like <code style={{ fontFamily: 'var(--font-mono)' }}>{PH.FIRST}</code>, <code style={{ fontFamily: 'var(--font-mono)' }}>{PH.FULL}</code> (full name) and <code style={{ fontFamily: 'var(--font-mono)' }}>{PH.COMPANY}</code> are substituted at send time.
        </div>

        {/* live preview */}
        <div style={{ marginTop: '18px' }}>
          <div style={{ ...caps, marginBottom: '8px' }}>Preview</div>
          <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', background: 'var(--color-surface)', padding: '14px', fontSize: '13.5px', lineHeight: 1.6, color: 'var(--color-text-1)', whiteSpace: 'pre-wrap', minHeight: '60px' }}>
            {renderPreview(message) || <span style={{ color: 'var(--color-text-3)' }}>Your message preview appears here.</span>}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--color-text-3)', marginTop: '6px' }}>
            Showing sample values <strong style={{ color: 'var(--color-text-2)' }}>Alex Johnson</strong> and <strong style={{ color: 'var(--color-text-2)' }}>Acme Corp</strong>.
          </div>
        </div>

        {/* The sample preview above uses fixed names. Testing renders YOUR values
            and checks the note against LinkedIn's invite-note limit, which is where
            a template silently breaks — LinkedIn truncates, it does not warn. */}
        {!isNew && (
          <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: '4px' }}>Test this template</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-3)', marginBottom: '12px', maxWidth: 520, lineHeight: 1.5 }}>
              Render the note with your own values and check its length against
              LinkedIn&rsquo;s 300-character invite limit. Optionally have the result
              emailed to you. Nothing is sent to LinkedIn.
            </div>
            <button onClick={() => onTest()} style={ghostBtn}>Render a test</button>
          </div>
        )}

        {/* danger zone */}
        {!isNew && (
          <div style={{ marginTop: '32px', paddingTop: '20px', borderTop: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-danger-text)', marginBottom: '4px' }}>Danger zone</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-3)', marginBottom: '12px' }}>
              Deleting a template cannot be undone. Messages already sent using it are unaffected.
            </div>
            <button onClick={onDelete} disabled={deleting} style={{ ...dangerBtn, opacity: deleting ? 0.6 : 1, cursor: deleting ? 'not-allowed' : 'pointer' }}>
              {deleting ? 'Deleting…' : 'Delete this template'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────  Main view  ───────────────────────────── */

export function LinkedInTemplatesView() {
  const [templates, setTemplates] = React.useState<LinkedInTemplate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [testing, setTesting] = React.useState(false);
  const [draft, setDraft] = React.useState<LinkedInTemplate | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [toast, setToast] = React.useState<string | null>(null);

  const [pendingAction, setPendingAction] = React.useState<(() => void) | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const guardDiscard = (action: () => void) => {
    if (dirty) setPendingAction(() => action);
    else action();
  };

  const userEmail = authStorage.getUser()?.email ?? '';

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2400); };

  const load = React.useCallback(async (selectId?: string) => {
    setLoading(true); setError(null);
    try {
      const d = await fetchLinkedInTemplates();
      setTemplates(d.templates);
      const pick = selectId ? d.templates.find(t => t._id === selectId) : (d.templates[0] ?? null);
      if (pick) { setSelectedId(pick._id); setDraft({ ...pick }); setDirty(false); }
      else if (!selectId) { setSelectedId(null); setDraft(null); }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const selectTemplate = (t: LinkedInTemplate) => {
    guardDiscard(() => { setSelectedId(t._id); setDraft({ ...t }); setDirty(false); });
  };

  const startNew = () => {
    guardDiscard(() => {
      const d = emptyDraft();
      if (userEmail) d.tags = [userEmail];
      setSelectedId(NEW_ID); setDraft(d); setDirty(false);
    });
  };

  const duplicate = () => {
    if (!draft || draft._id === NEW_ID) return;
    guardDiscard(() => doDuplicate(draft));
  };

  const doDuplicate = (src: LinkedInTemplate) => {
    const label = (src.name || 'Untitled template').trim();
    const tags = new Set(src.tags ?? []);
    if (userEmail) tags.add(userEmail);
    const dup: LinkedInTemplate = {
      ...src,
      _id: NEW_ID,
      name: `${label} (Copy)`,
      tags: Array.from(tags),
      createdAt: undefined,
      updatedAt: undefined,
    };
    setSelectedId(NEW_ID); setDraft(dup); setDirty(false);
  };

  const patchDraft = (patch: Partial<LinkedInTemplate>) => {
    setDraft(d => d ? { ...d, ...patch } : d);
    setDirty(true);
  };

  const save = async () => {
    if (!draft) return;
    const body: LinkedInTemplateInput = {
      name: draft.name, message: draft.message, tags: draft.tags,
      category: draft.category ?? 'invite',
    };
    setSaving(true);
    try {
      if (draft._id === NEW_ID) {
        const r = await createLinkedInTemplate(body);
        const now = new Date().toISOString();
        const saved: LinkedInTemplate = { ...draft, _id: r.id, createdAt: now, updatedAt: now };
        setTemplates(prev => [saved, ...prev]);
        setSelectedId(saved._id);
        setDraft(saved);
        setDirty(false);
        showToast('Template created');
        load(saved._id); // background refresh only
      } else {
        await updateLinkedInTemplate(draft._id, body);
        const saved: LinkedInTemplate = { ...draft, updatedAt: new Date().toISOString() };
        setTemplates(prev => prev.map(t => (t._id === saved._id ? saved : t)));
        setDraft(saved);
        setDirty(false);
        showToast('Template saved');
        load(draft._id); // background refresh only
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const requestDelete = () => {
    if (!draft || draft._id === NEW_ID) return;
    setDeleteError(null);
    setConfirmDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!draft || draft._id === NEW_ID) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteLinkedInTemplate(draft._id);
      showToast('Template deleted');
      setDirty(false);
      setConfirmDeleteOpen(false);
      await load();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const filtered = templates.filter(t => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (t.name || '').toLowerCase().includes(q)
      || (t.message || '').toLowerCase().includes(q);
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, position: 'relative' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid var(--color-border)', gap: '10px', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-1)' }}>LinkedIn Composer</div>
          <div style={{ fontSize: '12.5px', color: 'var(--color-text-2)' }}>
            LinkedIn message templates associated with {userEmail ? <strong style={{ color: 'var(--color-text-1)' }}>{userEmail}</strong> : 'your account'}
          </div>
        </div>
        <button onClick={startNew} style={{ ...primaryBtn, marginLeft: 'auto' }}>+ New template</button>
      </div>

      {/* body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* list */}
        <div style={{ width: '320px', flexShrink: 0, borderRight: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search templates…" style={{ ...inputStyle, padding: '7px 10px' }} />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {loading ? (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--color-text-3)', fontSize: '13px' }}>Loading…</div>
            ) : error ? (
              <div style={{ padding: 20, color: 'var(--color-danger-text)', fontSize: '12.5px' }}>{error}</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-3)', fontSize: '12.5px', lineHeight: 1.6 }}>
                {templates.length === 0 ? 'No LinkedIn templates yet. Create one to get started.' : 'No templates match your search.'}
              </div>
            ) : filtered.map(t => (
              <TemplateRow key={t._id} t={t} active={t._id === selectedId} onSelect={() => selectTemplate(t)} />
            ))}
          </div>
          <div style={{ padding: '8px 12px', borderTop: '1px solid var(--color-border)', fontSize: '11.5px', color: 'var(--color-text-3)', flexShrink: 0 }}>
            {templates.length} template{templates.length === 1 ? '' : 's'}
          </div>
        </div>

        {/* editor */}
        {draft ? (
          <TemplateEditor draft={draft} dirty={dirty} saving={saving} deleting={deleting}
            onChange={patchDraft} onSave={save} onDelete={requestDelete} onDuplicate={duplicate}
            onTest={() => setTesting(true)} />
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', color: 'var(--color-text-3)' }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-2)' }}>Select a template to edit</div>
            <button onClick={startNew} style={ghostBtn}>+ Create a new template</button>
          </div>
        )}
      </div>

      {selectedId && testing && (
        <TestTemplateDialog
          open
          mode="linkedin"
          title={`Test “${draft?.name || 'template'}”`}
          loadInfo={() => fetchLinkedInTemplateTestInfo(selectedId)}
          onSend={(values, emailTo) => sendLinkedInTemplateTest(selectedId, { values, emailTo: emailTo || undefined })}
          onClose={() => setTesting(false)}
        />
      )}

      {toast && (
        <div style={{ position: 'absolute', bottom: 18, left: '50%', transform: 'translateX(-50%)', background: 'var(--color-text-1)', color: '#fff', padding: '9px 18px', borderRadius: 'var(--radius-md)', fontSize: '12.5px', fontWeight: 600, boxShadow: 'var(--shadow-lg)' }}>{toast}</div>
      )}

      <ConfirmDialog
        open={confirmDeleteOpen}
        title="Delete template"
        message={<>Permanently delete <strong style={{ color: 'var(--color-text-1)' }}>{draft?.name || 'this template'}</strong>. This cannot be undone.</>}
        confirmLabel="Delete"
        loadingLabel="Deleting…"
        danger
        loading={deleting}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
      />

      <ConfirmDialog
        open={!!pendingAction}
        title="Discard unsaved changes?"
        message="You have unsaved edits on this template. Continuing now will discard them."
        confirmLabel="Discard changes"
        danger
        onConfirm={() => { const action = pendingAction; setPendingAction(null); action?.(); }}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
}
