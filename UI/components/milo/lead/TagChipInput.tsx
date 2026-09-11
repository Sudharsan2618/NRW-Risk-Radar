'use client';
import React from 'react';

/**
 * Reusable chip/tag input — type a value and press Enter or comma to add it,
 * click × to remove. Extracted so the campaign-create ICP form and the
 * Settings "Edit ICP" form share the exact same control.
 */
export function TagChipInput({
  tags, onAdd, onRemove, placeholder,
}: {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
  placeholder?: string;
}) {
  const [val, setVal] = React.useState('');

  const commit = () => {
    const clean = val.trim().replace(/,$/, '');
    if (clean && !tags.some(t => t.toLowerCase() === clean.toLowerCase())) onAdd(clean);
    setVal('');
  };

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '6px 10px',
      background: 'var(--color-bg)', border: '1px solid var(--color-border-2)',
      borderRadius: 'var(--radius-md)', minHeight: '38px', alignItems: 'center',
    }}>
      {tags.map(t => (
        <span key={t} style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          padding: '2px 8px', borderRadius: '4px', background: 'var(--color-surface)',
          border: '1px solid var(--color-border)', fontSize: '12.5px', fontWeight: 600,
          color: 'var(--color-text-1)', userSelect: 'none',
        }}>
          {t}
          <button type="button" onClick={() => onRemove(t)} style={{
            border: 'none', background: 'none', padding: 0, cursor: 'pointer',
            fontSize: '14px', fontWeight: 700, color: 'var(--color-text-3)',
            display: 'flex', alignItems: 'center', lineHeight: 1,
          }}>×</button>
        </span>
      ))}
      <input
        type="text"
        value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(); } }}
        onBlur={commit}
        placeholder={tags.length === 0 ? placeholder : ''}
        style={{
          flex: 1, minWidth: '100px', border: 'none', outline: 'none',
          fontSize: '13.5px', color: 'var(--color-text-1)', fontFamily: 'var(--font-sans)',
          background: 'transparent', padding: '2px 0',
        }}
      />
    </div>
  );
}
