'use client';

/**
 * Prove a template before a prospect sees it.
 *
 * The composer's preview shows what the app thinks the template says. It does not
 * prove the placeholders resolve, that the greeting reads correctly for a given
 * honorific, or that the HTML survives a mail client. Only a delivered message does.
 *
 * So this asks only for the values the template actually uses — pulled from the
 * template itself, not a fixed list — renders them, and sends through the same
 * mailbox and API call outreach uses.
 *
 * Used for email templates, LinkedIn templates and a whole campaign; the caller
 * supplies how to load the fields and how to send.
 */

import React from 'react';
import type { TemplateTestField, TemplateTestInfo, TemplateTestResult } from '@/lib/leadFunnelApi';

export interface TestTemplateDialogProps {
  open: boolean;
  title: string;
  /** LinkedIn has no send-to-self, so it renders and optionally emails the text. */
  mode?: 'email' | 'linkedin';
  /** Shown so the author can confirm which mailbox the test will come from. Used only
   *  when the loaded info carries no selectable senders of its own. */
  senderEmail?: string | null;
  loadInfo: () => Promise<TemplateTestInfo>;
  /** ``sender`` is the mailbox the author picked (when the template offers a choice). */
  onSend: (values: Record<string, string>, recipient: string, sender?: string) => Promise<TemplateTestResult>;
  onClose: () => void;
}

/** Sensible starting values, so a test is one click for the common case. */
const SEEDS: Record<string, string> = {
  first_name: 'Sarah',
  last_name: 'Wett',
  full_name: 'Sarah Wett',
  company_name: 'GreenPocket GmbH',
  job_title: 'Head of Sales',
  honorific: 'Frau',
  location: 'Bonn, Germany',
};

const input: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border-2)', background: 'var(--color-bg)',
  color: 'var(--color-text-1)', fontSize: '13px', fontFamily: 'var(--font-sans)',
};

export function TestTemplateDialog({
  open, title, mode = 'email', senderEmail, loadInfo, onSend, onClose,
}: TestTemplateDialogProps) {
  const [info, setInfo] = React.useState<TemplateTestInfo | null>(null);
  const [values, setValues] = React.useState<Record<string, string>>({});
  const [recipient, setRecipient] = React.useState('');
  const [sender, setSender] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<TemplateTestResult | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setInfo(null); setErr(null); setResult(null); setLoading(true); setSender('');
    loadInfo()
      .then(i => {
        setInfo(i);
        const seeded: Record<string, string> = {};
        (i.fields || []).forEach((f: TemplateTestField) => { seeded[f.field] = SEEDS[f.field] ?? ''; });
        setValues(seeded);
        // Preselect the default sender (falls back to the first offered mailbox).
        const preset = i.senderEmail
          || (i.senders || []).find(s => s.default)?.email
          || (i.senders || [])[0]?.email
          || '';
        setSender(preset);
      })
      .catch(e => setErr(e instanceof Error ? e.message : 'Could not load the template'))
      .finally(() => setLoading(false));
  }, [open, loadInfo]);

  if (!open) return null;

  const senderOptions = info?.senders || [];
  const activeSender = sender || senderEmail || undefined;
  const needsRecipient = mode === 'email';
  const canSend = !sending && (!needsRecipient || recipient.trim().length > 3);

  const submit = async () => {
    if (!canSend) return;
    setSending(true); setErr(null); setResult(null);
    try {
      setResult(await onSend(values, recipient.trim(), activeSender));
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'The test could not be sent');
    } finally { setSending(false); }
  };

  return (
    <div onClick={() => { if (!sending) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 1300,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: 'min(560px, 100%)', maxHeight: '86vh', overflowY: 'auto',
          background: 'var(--color-bg)', borderRadius: 'var(--radius-lg, 12px)',
          boxShadow: '0 20px 60px rgba(0,0,0,.28)', padding: '22px 24px' }}>

        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-1)' }}>{title}</div>
        <div style={{ fontSize: '12.5px', color: 'var(--color-text-3)', marginTop: '4px', lineHeight: 1.5 }}>
          {mode === 'email'
            ? <>Fills the placeholders below and sends a real email{activeSender ? <> from <strong>{activeSender}</strong></> : null}, through the same mailbox your outreach uses. No prospect is contacted and your daily send budget is untouched.</>
            : <>Renders the note exactly as an invite or follow-up would carry it, and checks it against LinkedIn&rsquo;s length limit. Nothing is sent to LinkedIn.</>}
        </div>

        {loading && <div style={{ padding: '20px 0', fontSize: '13px', color: 'var(--color-text-3)' }}>Loading template…</div>}

        {info && !loading && (
          <>
            {info.unknownTokens?.length > 0 && (
              <div style={{ marginTop: '14px', padding: '9px 11px', borderRadius: 'var(--radius-md)',
                background: 'var(--color-warning-subtle, #fffbeb)', border: '1px solid var(--color-warning-border, #fcd34d)',
                color: 'var(--color-warning-text, #b45309)', fontSize: '12px', lineHeight: 1.5 }}>
                <strong>Unknown placeholder{info.unknownTokens.length > 1 ? 's' : ''}:</strong>{' '}
                {info.unknownTokens.join(', ')} — these are not substituted and get removed
                before delivery. Likely a typo.
              </div>
            )}

            {info.fields?.length === 0 && (
              <div style={{ marginTop: '14px', fontSize: '12.5px', color: 'var(--color-text-3)' }}>
                This template uses no placeholders — send it to check formatting.
              </div>
            )}

            <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '11px' }}>
              {mode === 'email' && senderOptions.length > 0 && (
                <label style={{ display: 'block' }}>
                  <span style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text-1)', marginBottom: '4px' }}>
                    Send from
                  </span>
                  {senderOptions.length === 1 ? (
                    <div style={{ ...input, display: 'flex', alignItems: 'center', color: 'var(--color-text-2)' }}>
                      {senderOptions[0].email}
                      {senderOptions[0].campaignName
                        ? <span style={{ marginLeft: '6px', color: 'var(--color-text-3)', fontSize: '11.5px' }}>· {senderOptions[0].campaignName}</span>
                        : null}
                    </div>
                  ) : (
                    <select value={sender} style={input}
                      onChange={e => setSender(e.target.value)}>
                      {senderOptions.map(s => {
                        const camps = (s.campaignNames && s.campaignNames.length ? s.campaignNames : (s.campaignName ? [s.campaignName] : [])).join(', ');
                        return (
                          <option key={s.email} value={s.email}>
                            {s.email}{camps ? ` — ${camps}` : ''}
                          </option>
                        );
                      })}
                    </select>
                  )}
                  <span style={{ display: 'block', fontSize: '11px', color: 'var(--color-text-3)', marginTop: '4px' }}>
                    {senderOptions[0]?.campaignName
                      ? 'The mailbox configured on the campaign(s) this template belongs to.'
                      : 'This template isn’t pinned to a campaign yet — pick any configured mailbox.'}
                  </span>
                </label>
              )}
              {(info.fields || []).map(f => (
                <label key={f.field} style={{ display: 'block' }}>
                  <span style={{ display: 'flex', alignItems: 'baseline', gap: '7px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text-1)' }}>{f.label}</span>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-3)', fontFamily: 'var(--font-mono, monospace)' }}>
                      {f.tokens.join(' ')}
                    </span>
                  </span>
                  <input value={values[f.field] ?? ''} style={input}
                    onChange={e => setValues(v => ({ ...v, [f.field]: e.target.value }))} />
                </label>
              ))}

              <label style={{ display: 'block', marginTop: '2px' }}>
                <span style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, color: 'var(--color-text-1)', marginBottom: '4px' }}>
                  {needsRecipient ? 'Send the test to' : 'Also email the rendered text to (optional)'}
                </span>
                <input value={recipient} type="email" placeholder="you@company.com" style={input}
                  onChange={e => setRecipient(e.target.value)} />
              </label>
            </div>
          </>
        )}

        {err && (
          <div style={{ marginTop: '14px', fontSize: '12.5px', color: 'var(--color-danger-text)' }}>{err}</div>
        )}

        {result && (
          <div style={{ marginTop: '16px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
            <div style={{ padding: '8px 11px', background: 'var(--color-success-bg, #f0fdf4)',
              color: 'var(--color-success-text, #15803d)', fontSize: '12.5px', fontWeight: 700 }}>
              {result.sent ? `Sent to ${result.recipient}` : 'Rendered'}
              {result.emailedTo ? ` · emailed to ${result.emailedTo}` : ''}
            </div>
            {result.subject && (
              <div style={{ padding: '9px 11px', borderBottom: '1px solid var(--color-border)', fontSize: '12.5px' }}>
                <span style={{ color: 'var(--color-text-3)' }}>Subject: </span>
                <strong style={{ color: 'var(--color-text-1)' }}>{result.subject}</strong>
              </div>
            )}
            {typeof result.length === 'number' && (
              <div style={{ padding: '9px 11px', borderBottom: '1px solid var(--color-border)', fontSize: '12px',
                color: result.withinInviteLimit === false ? 'var(--color-danger-text)' : 'var(--color-text-2)' }}>
                {result.length} characters{result.inviteLimit ? ` · invite limit ${result.inviteLimit}` : ''}
                {result.warning ? <div style={{ marginTop: '4px' }}>{result.warning}</div> : null}
              </div>
            )}
            <div style={{ padding: '11px', fontSize: '12.5px', lineHeight: 1.6, color: 'var(--color-text-1)',
              whiteSpace: result.message ? 'pre-wrap' : 'normal', maxHeight: '220px', overflowY: 'auto' }}>
              {result.message
                ? result.message
                : <span dangerouslySetInnerHTML={{ __html: result.body || '' }} />}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '9px', marginTop: '20px' }}>
          <button onClick={onClose} disabled={sending}
            style={{ padding: '8px 16px', background: 'var(--color-bg)', color: 'var(--color-text-1)',
              border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-md)',
              fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
            {result ? 'Done' : 'Cancel'}
          </button>
          <button onClick={submit} disabled={!canSend || loading}
            style={{ padding: '8px 16px', background: 'var(--color-brand)', color: '#fff',
              border: 'none', borderRadius: 'var(--radius-md)', fontSize: '13px', fontWeight: 600,
              cursor: (!canSend || loading) ? 'not-allowed' : 'pointer', opacity: (!canSend || loading) ? 0.6 : 1,
              fontFamily: 'var(--font-sans)' }}>
            {sending ? 'Sending…' : mode === 'email' ? 'Send test email' : 'Render'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default TestTemplateDialog;
