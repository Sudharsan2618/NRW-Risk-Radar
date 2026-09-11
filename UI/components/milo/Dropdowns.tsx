'use client';
import React from 'react';

// Shared dropdown components used across campaign screens (search + import).
// Single source of truth for the "Geography-style" dropdown look & feel.

export interface Option { id: string; name: string; selected: boolean }

export function CheckBox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <span onClick={(e) => { e.preventDefault(); onChange(); }} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: '16px', height: '16px', borderRadius: '4px',
      border: `1.5px solid ${checked ? 'var(--color-brand)' : 'var(--color-border-2)'}`,
      background: checked ? 'var(--color-brand)' : '#fff',
      cursor: 'pointer', flexShrink: 0,
    }}>
      {checked && (
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="2,6.5 5,9.5 10,3.5" />
        </svg>
      )}
    </span>
  );
}

export function MultiSelectDropdown({ options, onToggle, placeholder = 'Select…', searchPlaceholder = 'Search' }: {
  options: Option[]; onToggle: (id: string) => void; placeholder?: string; searchPlaceholder?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSearch(''); }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const selected = options.filter(o => o.selected);
  const q = search.trim().toLowerCase();
  const filtered = q ? options.filter(o => o.name.toLowerCase().includes(q)) : options;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger — shows selected items as removable chips */}
      <div onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap',
        minHeight: '40px', padding: '6px 10px', cursor: 'pointer',
        border: `1px solid ${open ? 'var(--color-brand)' : 'var(--color-border-2)'}`,
        borderRadius: 'var(--radius-md)', background: 'var(--color-bg)',
        boxShadow: open ? 'var(--shadow-focus)' : 'none', transition: 'border .12s, box-shadow .12s',
      }}>
        {selected.length === 0 ? (
          <span style={{ fontSize: '13.5px', color: 'var(--color-text-3)', flex: 1 }}>{placeholder}</span>
        ) : (
          selected.map(c => (
            <span key={c.id} style={{
              display: 'inline-flex', alignItems: 'center', gap: '5px',
              padding: '3px 8px', borderRadius: 'var(--radius-full)',
              background: 'var(--color-brand-subtle)', color: 'var(--color-brand-text)',
              fontSize: '12px', fontWeight: 600,
            }}>
              {c.name}
              <span onClick={(e) => { e.stopPropagation(); onToggle(c.id); }} title="Remove" style={{ display: 'inline-flex', cursor: 'pointer', opacity: .7 }}>
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="11" y2="11" /><line x1="11" y1="1" x2="1" y2="11" /></svg>
              </span>
            </span>
          ))
        )}
        <span style={{ marginLeft: 'auto', display: 'flex', color: 'var(--color-text-3)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5l4 4 4-4" /></svg>
        </span>
      </div>

      {/* Panel — search + scrollable multi-select list */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 30,
          background: 'var(--color-bg)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
        }}>
          <div style={{ padding: '8px', borderBottom: '1px solid var(--color-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '6px 9px', border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-sm)' }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="var(--color-text-3)" strokeWidth="1.8" strokeLinecap="round"><circle cx="7" cy="7" r="5" /><line x1="11" y1="11" x2="14.5" y2="14.5" /></svg>
              <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder={searchPlaceholder}
                style={{ border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--color-text-1)', width: '100%' }} />
            </div>
          </div>
          <div style={{ maxHeight: '240px', overflowY: 'auto', padding: '4px' }}>
            {filtered.map(c => (
              <label key={c.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', transition: 'background .12s',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-row-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <span style={{ fontSize: '13.5px', fontWeight: 500, color: c.selected ? 'var(--color-text-1)' : 'var(--color-text-2)' }}>{c.name}</span>
                <CheckBox checked={c.selected} onChange={() => onToggle(c.id)} />
              </label>
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: '14px 10px', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-3)' }}>No matches</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function SingleSelectDropdown({ value, options, onChange, placeholder = 'Select…', searchable = false, searchPlaceholder = 'Search' }: {
  value: string;
  options: { value: string; label: string; subLabel?: string }[];
  onChange: (value: string) => void;
  placeholder?: string; searchable?: boolean; searchPlaceholder?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSearch(''); }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const selectedOption = options.find(o => o.value === value);
  const selectedLabel = selectedOption
    ? selectedOption.subLabel
      ? `${selectedOption.label} (${selectedOption.subLabel})`
      : selectedOption.label
    : undefined;

  const q = search.trim().toLowerCase();
  const filtered = q
    ? options.filter(o =>
        o.label.toLowerCase().includes(q) ||
        o.value.toLowerCase().includes(q) ||
        (o.subLabel && o.subLabel.toLowerCase().includes(q))
      )
    : options;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger */}
      <div onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        minHeight: '40px', padding: '6px 10px', cursor: 'pointer',
        border: `1px solid ${open ? 'var(--color-brand)' : 'var(--color-border-2)'}`,
        borderRadius: 'var(--radius-md)', background: 'var(--color-bg)',
        boxShadow: open ? 'var(--shadow-focus)' : 'none', transition: 'border .12s, box-shadow .12s',
      }}>
        <span style={{ fontSize: '13.5px', flex: 1, color: selectedLabel ? 'var(--color-text-1)' : 'var(--color-text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {selectedLabel ?? placeholder}
        </span>
        <span style={{ display: 'flex', color: 'var(--color-text-3)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5l4 4 4-4" /></svg>
        </span>
      </div>

      {/* Panel */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 30,
          background: 'var(--color-bg)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
        }}>
          {searchable && (
            <div style={{ padding: '8px', borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '6px 9px', border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-sm)' }}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="var(--color-text-3)" strokeWidth="1.8" strokeLinecap="round"><circle cx="7" cy="7" r="5" /><line x1="11" y1="11" x2="14.5" y2="14.5" /></svg>
                <input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder={searchPlaceholder}
                  style={{ border: 'none', outline: 'none', background: 'transparent', fontFamily: 'var(--font-sans)', fontSize: '13px', color: 'var(--color-text-1)', width: '100%' }} />
              </div>
            </div>
          )}
          <div style={{ maxHeight: '240px', overflowY: 'auto', padding: '4px' }}>
            {filtered.map(o => {
              const active = o.value === value;
              return (
                <div key={o.value} onClick={() => { onChange(o.value); setOpen(false); setSearch(''); }} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', transition: 'background .12s',
                  background: active ? 'var(--color-brand-subtle)' : 'transparent',
                }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--color-row-hover)'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '13.5px', fontWeight: active ? 600 : 500, color: active ? 'var(--color-brand-text)' : 'var(--color-text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {o.label}
                    </span>
                    {o.subLabel && (
                      <span style={{ fontSize: '11px', color: 'var(--color-text-3)', fontWeight: 400 }}>
                        {o.subLabel}
                      </span>
                    )}
                  </div>
                  {active && (
                    <svg width="13" height="13" viewBox="0 0 12 12" fill="none" stroke="var(--color-brand)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '8px', flexShrink: 0 }}><polyline points="2,6.5 5,9.5 10,3.5" /></svg>
                  )}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div style={{ padding: '14px 10px', textAlign: 'center', fontSize: '13px', color: 'var(--color-text-3)' }}>No matches</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
