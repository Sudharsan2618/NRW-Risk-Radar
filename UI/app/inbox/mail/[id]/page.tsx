'use client';
import React from 'react';
import { useParams } from 'next/navigation';
import { getMailById, colorFor, initials } from '@/lib/inbox-data';

// Standalone full-screen mail view — intentionally rendered OUTSIDE AppShell,
// so there is no sidebar / app bar / tabs. Opened in a new browser tab.
export default function MailFullPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const mail = id ? getMailById(id) : null;

  if (!mail) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-3)', fontFamily: 'var(--font-sans)', fontSize: '14px' }}>
        Message not found.
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: '820px', padding: '40px 32px 64px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--color-text-1)', margin: '0 0 20px', fontFamily: 'var(--font-sans)' }}>{mail.subject}</h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '18px', marginBottom: '22px', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: colorFor(mail.sender), color: '#fff', fontSize: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{initials(mail.sender)}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-1)' }}>{mail.sender}</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-3)' }}>{mail.email}</div>
          </div>
          <span style={{ marginLeft: 'auto', fontSize: '13px', color: 'var(--color-text-3)', flexShrink: 0 }}>{mail.date}</span>
        </div>

        <div style={{ fontSize: '15px', lineHeight: 1.7, color: 'var(--color-text-1)', whiteSpace: 'pre-line', fontFamily: 'var(--font-sans)' }}>{mail.body}</div>
      </div>
    </div>
  );
}
