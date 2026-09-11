'use client';
import React from 'react';
import { TestTemplateDialog } from '@/components/milo/TestTemplateDialog';
import { authStorage } from '@/lib/authStorage';
import { ConfirmDialog } from './ConfirmDialog';
import {
  fetchOutreachTemplates,
  createOutreachTemplate,
  updateOutreachTemplate,
  deleteOutreachTemplate,
  fetchTemplateTestInfo,
  sendTemplateTest,
  fetchDefaultTemplate,
  setDefaultTemplate,
  type OutreachTemplate,
  type OutreachTemplateInput,
} from '@/lib/leadFunnelApi';
import { PH } from '@/lib/placeholders';

// Placeholder chips offered in the email editor (three name tokens + company,
// courtesy title and job title). Insert at the caret in the HTML tab.
const EMAIL_INSERT_CHIPS: { token: string; label: string }[] = [
  { token: PH.FIRST, label: 'First name' },
  { token: PH.LAST, label: 'Last name' },
  { token: PH.FULL, label: 'Full name' },
  { token: PH.COMPANY, label: 'Company' },
  { token: PH.TITLE, label: 'Title (Mr/Ms)' },
  { token: PH.JOB_TITLE, label: 'Job title' },
];

/* ─────────────────────────────  Shared styles  ───────────────────────────── */

const primaryBtn: React.CSSProperties = { padding: '7px 16px', background: 'var(--color-brand)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' };
const ghostBtn: React.CSSProperties = { padding: '7px 16px', background: 'var(--color-bg)', color: 'var(--color-text-1)', border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' };
const dangerBtn: React.CSSProperties = { padding: '7px 16px', background: 'var(--color-bg)', color: 'var(--color-danger-text)', border: '1px solid var(--color-danger-border)', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' };
const caps: React.CSSProperties = { fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.6px', color: 'var(--color-text-3)' };
const inputStyle: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '8px 11px', fontSize: '13px', fontFamily: 'var(--font-sans)', color: 'var(--color-text-1)', border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg)' };
function toolBtn(primary: boolean): React.CSSProperties {
  return {
    padding: '5px 12px', fontSize: '12px', fontWeight: 700,
    borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-sans)', cursor: 'pointer',
    border: primary ? 'none' : '1px solid var(--color-border-2)',
    background: primary ? 'var(--color-brand)' : 'var(--color-bg)',
    color: primary ? '#fff' : 'var(--color-text-2)',
  };
}

const NEW_ID = '__new__';

const DEFAULT_HTML = `<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif; color: #1E1F21; line-height: 1.6;">
    <p>Hi {{Prospect_FirstName}},</p>
    <p>Write your outreach copy here. You can use placeholders such as
      {{Prospect_Company}}, {{Prospect_Name}} (full name) and {{Prospect_FirstName}}.</p>
    <p>Best regards,<br/>Your name</p>
  </body>
</html>`;

/** A blank draft for the "New template" flow. */
function emptyDraft(): OutreachTemplate {
  return { _id: NEW_ID, name: '', industry: 'general', persona: 'general', outreachType: 'email', subject: '', language: 'English', tags: [], template: DEFAULT_HTML };
}

/* ─────────────────────────────  List row  ───────────────────────────── */

function TemplateRow({ t, active, isDefault, onSelect }: { t: OutreachTemplate; active: boolean; isDefault?: boolean; onSelect: () => void }) {
  const [hov, setHov] = React.useState(false);
  return (
    <div onClick={onSelect} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--color-border)',
        borderLeft: `3px solid ${active ? 'var(--color-brand)' : 'transparent'}`,
        background: active ? 'var(--color-brand-subtle)' : hov ? 'var(--color-row-hover)' : 'var(--color-bg)',
        transition: 'background .12s',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
          <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
            {t.name || `${t.industry} · ${t.persona}`}
          </span>
          {isDefault && (
            <span title="Your default email template" style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.4px', color: 'var(--color-brand-text, var(--color-brand))', background: 'var(--color-brand-subtle)', borderRadius: 'var(--radius-sm)', padding: '1px 6px' }}>
              <svg width="9" height="9" viewBox="0 0 12 12" fill="currentColor"><path d="M6 .8l1.6 3.2 3.5.5-2.5 2.5.6 3.5L6 8.9 2.8 11l.6-3.5L.9 4.5l3.5-.5z" /></svg>
              Default
            </span>
          )}
        </div>
        {t.language && <span style={{ flexShrink: 0, fontSize: '10.5px', fontWeight: 600, color: 'var(--color-text-2)', background: 'var(--color-surface)', border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-sm)', padding: '1px 7px' }}>{t.language}</span>}
      </div>
      {t.subject && <div style={{ fontSize: '12px', color: 'var(--color-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>{t.subject}</div>}
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

function TemplateEditor({ draft, dirty, saving, deleting, isDefault, settingDefault, onChange, onSave, onDelete, onDuplicate, onTest, onToggleDefault }: {
  draft: OutreachTemplate; dirty: boolean; saving: boolean; deleting: boolean;
  isDefault?: boolean; settingDefault?: boolean;
  onChange: (patch: Partial<OutreachTemplate>) => void; onSave: () => void; onDelete: () => void; onDuplicate: () => void;
  onTest: () => void; onToggleDefault: () => void;
}) {
  const [tab, setTab] = React.useState<'preview' | 'html'>('preview');
  const isNew = draft._id === NEW_ID;
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  // ── Content-only editing of the Preview (WYSIWYG) ─────────────────────────
  // Lets a non-technical user tweak wording directly in the rendered preview
  // without touching the underlying HTML/layout. Bold/italic/underline and rich
  // paste are blocked so the template's format can't drift from this mode; the
  // HTML tab remains the place for real structural edits.
  const [previewEditing, setPreviewEditing] = React.useState(false);
  const [previewNonce, setPreviewNonce] = React.useState(0); // bump to remount iframe (discard in-place edits)
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const htmlRef = React.useRef<HTMLTextAreaElement>(null);

  // Insert a placeholder token into the template HTML. When the HTML tab's
  // textarea is focused we drop it at the caret; otherwise (Preview tab) we
  // switch to HTML and append it, so the click is never a no-op.
  const insertToken = (token: string) => {
    const html = draft.template ?? '';
    const el = htmlRef.current;
    if (tab === 'html' && el) {
      const start = el.selectionStart ?? html.length;
      const end = el.selectionEnd ?? html.length;
      const next = html.slice(0, start) + token + html.slice(end);
      onChange({ template: next });
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + token.length;
        el.setSelectionRange(pos, pos);
      });
      return;
    }
    setTab('html');
    onChange({ template: html + token });
  };

  // Leaving this template (or the Preview tab) exits any in-progress content edit.
  React.useEffect(() => { setPreviewEditing(false); }, [draft._id]);
  React.useEffect(() => { if (tab !== 'preview') setPreviewEditing(false); }, [tab]);

  const blockFormatting = React.useCallback((e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && (k === 'b' || k === 'i' || k === 'u')) e.preventDefault();
  }, []);
  const forcePlainPaste = React.useCallback((e: ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain') ?? '';
    iframeRef.current?.contentDocument?.execCommand('insertText', false, text);
  }, []);
  const stopPreviewEditListeners = () => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    doc.designMode = 'off';
    doc.removeEventListener('keydown', blockFormatting, true);
    doc.removeEventListener('paste', forcePlainPaste, true);
  };
  const startPreviewEdit = () => {
    setPreviewEditing(true);
    const doc = iframeRef.current?.contentDocument;
    if (doc) {
      doc.designMode = 'on';
      doc.addEventListener('keydown', blockFormatting, true);
      doc.addEventListener('paste', forcePlainPaste, true);
      doc.body?.focus();
    }
  };
  const savePreviewEdit = () => {
    const doc = iframeRef.current?.contentDocument;
    const html = doc?.documentElement?.outerHTML ?? draft.template ?? '';
    stopPreviewEditListeners();
    onChange({ template: html }); // marks the draft dirty; top "Save changes" persists it
    setPreviewEditing(false);
  };
  const cancelPreviewEdit = () => {
    stopPreviewEditListeners();
    setPreviewEditing(false);
    setPreviewNonce(n => n + 1); // remount iframe from draft.template → discards in-place edits
  };

  const processHtmlFile = (file: File) => {
    if (!file.name.match(/\.(html|htm)$/i) && file.type !== 'text/html') {
      alert('Please select an .html or .htm file');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        const patch: Partial<OutreachTemplate> = { template: content };
        const titleMatch = content.match(/<title>(.*?)<\/title>/i);
        if (titleMatch && titleMatch[1] && (!draft.name || draft.name.trim() === '')) {
          patch.name = titleMatch[1].trim();
        }
        if (previewEditing) {
          stopPreviewEditListeners();
          setPreviewEditing(false);
        }
        onChange(patch);
        setPreviewNonce(n => n + 1);
      }
    };
    reader.readAsText(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processHtmlFile(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processHtmlFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
      <input
        type="file"
        ref={fileInputRef}
        accept=".html,.htm,text/html"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* editor header / actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 20px', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {isNew ? 'New template' : (draft.name || `${draft.industry} · ${draft.persona}`)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--color-text-3)' }}>
            {isNew ? 'Fill in the details and save to create' : draft.updatedAt ? `Updated ${new Date(draft.updatedAt).toLocaleDateString()}` : 'Outreach email template'}
          </div>
        </div>
        {dirty && <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--color-warning-text)' }}>Unsaved changes</span>}
        {!isNew && (draft.outreachType || 'email') === 'email' && (
          <button
            onClick={onToggleDefault}
            disabled={!!settingDefault}
            title={isDefault
              ? 'This is your default email template — used whenever a campaign has none configured. Click to remove.'
              : 'Use this as your default email template whenever a campaign has none configured'}
            style={{
              ...(isDefault ? { ...ghostBtn, borderColor: 'var(--color-brand)', color: 'var(--color-brand-text, var(--color-brand))' } : ghostBtn),
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              opacity: settingDefault ? 0.55 : 1, cursor: settingDefault ? 'not-allowed' : 'pointer',
            }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill={isDefault ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
              <path d="M6 .8l1.6 3.2 3.5.5-2.5 2.5.6 3.5L6 8.9 2.8 11l.6-3.5L.9 4.5l3.5-.5z" />
            </svg>
            {settingDefault ? 'Saving…' : isDefault ? 'Default' : 'Set as default'}
          </button>
        )}
        {!isNew && (
          <button onClick={onDuplicate} disabled={previewEditing} title="Create a new template pre-filled with this one's content" style={{ ...ghostBtn, opacity: previewEditing ? 0.5 : 1, cursor: previewEditing ? 'not-allowed' : 'pointer' }}>
            Duplicate
          </button>
        )}
        <button onClick={onSave} disabled={saving || previewEditing || (!dirty && !isNew)} style={{ ...primaryBtn, opacity: (saving || previewEditing || (!dirty && !isNew)) ? 0.55 : 1, cursor: (saving || previewEditing || (!dirty && !isNew)) ? 'not-allowed' : 'pointer' }}>
          {saving ? 'Saving…' : isNew ? 'Create template' : 'Save changes'}
        </button>
      </div>

      {/* scrollable form */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', minHeight: 0 }}>
        {/* meta grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 18px', marginBottom: '16px' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="Title (name)">
              <input value={draft.name ?? ''} onChange={e => onChange({ name: e.target.value })} placeholder="e.g. Sales Outreach – Recruitment (DE)" style={inputStyle} />
            </Field>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="Subject">
              <input value={draft.subject ?? ''} onChange={e => onChange({ subject: e.target.value })} placeholder="Email subject line — placeholders allowed" style={inputStyle} />
            </Field>
          </div>
          <Field label="Industry">
            <input value={draft.industry ?? ''} onChange={e => onChange({ industry: e.target.value })} style={inputStyle} />
          </Field>
          <Field label="Persona">
            <input value={draft.persona ?? ''} onChange={e => onChange({ persona: e.target.value })} style={inputStyle} />
          </Field>
          <Field label="Language">
            <input value={draft.language ?? ''} onChange={e => onChange({ language: e.target.value })} placeholder="English" style={inputStyle} />
          </Field>
          <Field label="Outreach type">
            <input value={draft.outreachType ?? ''} onChange={e => onChange({ outreachType: e.target.value })} placeholder="email" style={inputStyle} />
          </Field>
          <div style={{ gridColumn: '1 / -1' }}>
            <Field label="Tags (who can see this template)">
              <TagEditor tags={draft.tags ?? []} onChange={tags => onChange({ tags })} />
            </Field>
          </div>
        </div>

        {/* placeholder inserters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
          <span style={caps}>Insert placeholder</span>
          {EMAIL_INSERT_CHIPS.map(c => (
            <button
              key={c.token}
              type="button"
              title={`Insert ${c.token}`}
              onClick={() => insertToken(c.token)}
              disabled={previewEditing}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '5px',
                padding: '4px 10px', fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-sans)',
                color: 'var(--color-brand-text)', background: 'var(--color-brand-subtle)',
                border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-full)',
                cursor: previewEditing ? 'not-allowed' : 'pointer', opacity: previewEditing ? 0.5 : 1,
              }}>+ {c.label}</button>
          ))}
        </div>

        {/* template body — preview / html */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={caps}>Email template</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={previewEditing}
              style={{ ...toolBtn(false), display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              title="Browse and import an HTML file from your local machine"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              Import HTML file
            </button>
            {tab === 'preview' && (
              previewEditing ? (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={cancelPreviewEdit} style={toolBtn(false)}>Cancel</button>
                  <button onClick={savePreviewEdit} style={toolBtn(true)}>Save</button>
                </div>
              ) : (
                <button onClick={startPreviewEdit} style={toolBtn(false)} title="Edit the wording directly in the preview — formatting stays locked">
                  Edit content
                </button>
              )
            )}
            <div style={{ display: 'inline-flex', border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
              {(['preview', 'html'] as const).map((m, i) => {
                const on = tab === m;
                return (
                  <button key={m} onClick={() => setTab(m)} disabled={previewEditing} style={{
                    padding: '5px 13px', fontSize: '12px', fontWeight: on ? 700 : 500, fontFamily: 'var(--font-sans)', cursor: previewEditing ? 'not-allowed' : 'pointer',
                    border: 'none', borderLeft: i === 0 ? 'none' : '1px solid var(--color-border-2)', opacity: previewEditing ? 0.5 : 1,
                    background: on ? 'var(--color-brand-subtle)' : 'var(--color-bg)', color: on ? 'var(--color-brand-text)' : 'var(--color-text-2)',
                  }}>{m === 'preview' ? 'Preview' : 'HTML'}</button>
                );
              })}
            </div>
          </div>
        </div>
        {previewEditing && (
          <div style={{ fontSize: '11px', color: 'var(--color-text-3)', marginBottom: '6px' }}>
            Editing wording only — layout and styling are locked. Click Save to apply, or Cancel to discard.
          </div>
        )}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            position: 'relative',
            border: `2px ${isDragging ? 'dashed var(--color-brand)' : previewEditing ? '1px solid var(--color-brand)' : '1px solid var(--color-border)'}`,
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            transition: 'border .15s ease',
          }}
        >
          {isDragging && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 10, background: 'rgba(255, 255, 255, 0.92)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px',
              color: 'var(--color-brand)', fontWeight: 600, fontSize: '14px'
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              Drop HTML file here to import
            </div>
          )}
          {tab === 'preview' ? (
            <iframe
              ref={iframeRef}
              key={`${draft._id}-${previewNonce}`}
              srcDoc={draft.template ?? ''}
              title="Template preview"
              style={{ width: '100%', height: '460px', border: 0, background: '#fff' }}
            />
          ) : (
            <textarea
              ref={htmlRef}
              value={draft.template ?? ''}
              onChange={e => onChange({ template: e.target.value })}
              spellCheck={false}
              style={{ width: '100%', boxSizing: 'border-box', height: '460px', border: 'none', outline: 'none', resize: 'vertical', padding: '14px', fontSize: '12.5px', lineHeight: 1.6, fontFamily: 'var(--font-mono)', color: 'var(--color-text-1)', background: 'var(--color-bg)' }}
            />
          )}
        </div>
        <div style={{ fontSize: '11.5px', color: 'var(--color-text-3)', marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Placeholders like <code style={{ fontFamily: 'var(--font-mono)' }}>{'{{Prospect_FirstName}}'}</code>, <code style={{ fontFamily: 'var(--font-mono)' }}>{'{{Prospect_Name}}'}</code> (full name), <code style={{ fontFamily: 'var(--font-mono)' }}>{'{{Prospect_Company}}'}</code> and <code style={{ fontFamily: 'var(--font-mono)' }}>{'{{Title}}'}</code> (Mr/Ms) are substituted at send time.</span>
          <span>Or drag & drop an HTML file into the box above</span>
        </div>

        {/* A preview shows what the app thinks the template says. Only a delivered
            email proves the placeholders resolved and the HTML survived. */}
        {!isNew && (
          <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: '4px' }}>Test this template</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-3)', marginBottom: '12px', maxWidth: 520, lineHeight: 1.5 }}>
              Fill this template&rsquo;s placeholders and send it to yourself. It goes out
              through the same mailbox your outreach uses, so what arrives is what a
              prospect would get. No prospect is contacted.
            </div>
            <button onClick={() => onTest()} style={ghostBtn}>Send a test email</button>
          </div>
        )}

        {/* danger zone — delete lives at the bottom, separated from the primary actions */}
        {!isNew && (
          <div style={{ marginTop: '32px', paddingTop: '20px', borderTop: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-danger-text)', marginBottom: '4px' }}>Danger zone</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-3)', marginBottom: '12px' }}>
              Deleting a template cannot be undone. Emails already sent using it are unaffected.
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

export function OutreachTemplatesView() {
  const [templates, setTemplates] = React.useState<OutreachTemplate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [testing, setTesting] = React.useState(false);
  const [draft, setDraft] = React.useState<OutreachTemplate | null>(null);
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [toast, setToast] = React.useState<string | null>(null);
  // The user's default email template — used across features whenever a campaign
  // has no template configured. Loaded once; toggled from the editor header.
  const [defaultTemplateId, setDefaultTemplateId] = React.useState<string | null>(null);
  const [settingDefault, setSettingDefault] = React.useState(false);

  // Native (in-app) confirmations — replace window.confirm(). A pending
  // "discard unsaved changes?" action is stored and run only if the user
  // confirms; the delete confirmation has its own dialog + error state so a
  // failed delete keeps the modal open with the reason shown inline.
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
      const d = await fetchOutreachTemplates();
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

  // Load the user's current default email template id (independent of the list).
  React.useEffect(() => {
    fetchDefaultTemplate().then(r => setDefaultTemplateId(r.defaultTemplateId)).catch(() => {});
  }, []);

  const toggleDefault = async () => {
    if (!draft || draft._id === NEW_ID) return;
    const makeDefault = defaultTemplateId !== draft._id;
    setSettingDefault(true);
    try {
      const r = await setDefaultTemplate(makeDefault ? draft._id : null);
      setDefaultTemplateId(r.defaultTemplateId);
      showToast(makeDefault ? 'Set as your default template' : 'Removed as default template');
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Could not update default');
    } finally {
      setSettingDefault(false);
    }
  };

  const selectTemplate = (t: OutreachTemplate) => {
    guardDiscard(() => { setSelectedId(t._id); setDraft({ ...t }); setDirty(false); });
  };

  const startNew = () => {
    guardDiscard(() => {
      const d = emptyDraft();
      if (userEmail) d.tags = [userEmail];
      setSelectedId(NEW_ID); setDraft(d); setDirty(false);
    });
  };

  /** Prefill a new draft from the currently open template — "Duplicate". */
  const duplicate = () => {
    if (!draft || draft._id === NEW_ID) return;
    guardDiscard(() => doDuplicate(draft));
  };

  const doDuplicate = (draft: OutreachTemplate) => {
    const label = (draft.name || `${draft.industry} · ${draft.persona}`).trim();
    const tags = new Set(draft.tags ?? []);
    if (userEmail) tags.add(userEmail);
    const dup: OutreachTemplate = {
      ...draft,
      _id: NEW_ID,
      name: `${label} (Copy)`,
      tags: Array.from(tags),
      createdAt: undefined,
      updatedAt: undefined,
    };
    setSelectedId(NEW_ID); setDraft(dup); setDirty(false);
  };

  const patchDraft = (patch: Partial<OutreachTemplate>) => {
    setDraft(d => d ? { ...d, ...patch } : d);
    setDirty(true);
  };

  const save = async () => {
    if (!draft) return;
    const body: OutreachTemplateInput = {
      name: draft.name, industry: draft.industry, persona: draft.persona,
      outreachType: draft.outreachType, subject: draft.subject, language: draft.language,
      tags: draft.tags, template: draft.template,
    };
    setSaving(true);
    try {
      if (draft._id === NEW_ID) {
        const r = await createOutreachTemplate(body);
        // Adopt the confirmed id + timestamps immediately — the button state
        // (disabled "Save changes", no "Unsaved changes" badge) must reflect
        // the just-saved content right away, without waiting on a list refetch
        // that could lag a beat behind the write and leave the UI looking like
        // nothing was saved.
        const now = new Date().toISOString();
        const saved: OutreachTemplate = { ...draft, _id: r.id, createdAt: now, updatedAt: now };
        setTemplates(prev => [saved, ...prev]);
        setSelectedId(saved._id);
        setDraft(saved);
        setDirty(false);
        showToast('Template created');
        load(saved._id); // background refresh only (e.g. server-normalized tags) — never blocks the state reset above
      } else {
        await updateOutreachTemplate(draft._id, body);
        const saved: OutreachTemplate = { ...draft, updatedAt: new Date().toISOString() };
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
      await deleteOutreachTemplate(draft._id);
      showToast('Template deleted');
      setDirty(false);
      setConfirmDeleteOpen(false);
      await load();
    } catch (e) {
      // Keep the dialog open and show the reason inline instead of closing
      // silently — mirrors the Sidebar campaign-delete confirmation.
      setDeleteError(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const filtered = templates.filter(t => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (t.name || '').toLowerCase().includes(q)
      || (t.subject || '').toLowerCase().includes(q)
      || (t.industry || '').toLowerCase().includes(q)
      || (t.persona || '').toLowerCase().includes(q);
  });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0, position: 'relative' }}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid var(--color-border)', gap: '10px', flexShrink: 0 }}>
        <div>
          <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-1)' }}>Templates Library</div>
          <div style={{ fontSize: '12.5px', color: 'var(--color-text-2)' }}>
            Email templates associated with {userEmail ? <strong style={{ color: 'var(--color-text-1)' }}>{userEmail}</strong> : 'your account'}
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
                {templates.length === 0 ? 'No templates associated with your email yet. Create one to get started.' : 'No templates match your search.'}
              </div>
            ) : filtered.map(t => (
              <TemplateRow key={t._id} t={t} active={t._id === selectedId} isDefault={t._id === defaultTemplateId} onSelect={() => selectTemplate(t)} />
            ))}
            {/* show the unsaved new draft as a row at the top context */}
          </div>
          <div style={{ padding: '8px 12px', borderTop: '1px solid var(--color-border)', fontSize: '11.5px', color: 'var(--color-text-3)', flexShrink: 0 }}>
            {templates.length} template{templates.length === 1 ? '' : 's'}
          </div>
        </div>

        {/* editor */}
        {draft ? (
          <TemplateEditor draft={draft} dirty={dirty} saving={saving} deleting={deleting}
            isDefault={draft._id === defaultTemplateId} settingDefault={settingDefault}
            onChange={patchDraft} onSave={save} onDelete={requestDelete} onDuplicate={duplicate}
            onTest={() => setTesting(true)} onToggleDefault={toggleDefault} />
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
          title={`Test “${draft?.name || 'template'}”`}
          loadInfo={() => fetchTemplateTestInfo(selectedId)}
          onSend={(values, recipient, sender) => sendTemplateTest(selectedId, { recipient, values, senderEmail: sender })}
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
