'use client';
import React from 'react';

interface Task { id: string; name: string; assignee: string | null; init?: string; due: string | null; priority: 'Low' | 'Medium' | 'High' | null; done: boolean }
interface Section { id: string; name: string; collapsed: boolean; tasks: Task[] }

const INIT_SECTIONS: Section[] = [
  { id: 'todo', name: 'To do', collapsed: false, tasks: [
    { id: 't1', name: 'Design Landing Page for Integration', assignee: 'Saurabh S.', init: 'SS', due: 'Today – 21 Mar', priority: 'Low', done: false },
    { id: 't2', name: 'Design Creatives', assignee: 'Saurabh S.', init: 'SS', due: '20 – 22 Mar', priority: 'Medium', done: false },
    { id: 't3', name: 'Review Meeting', assignee: null, due: '21 – 23 Mar', priority: null, done: false },
  ]},
  { id: 'doing', name: 'Doing', collapsed: false, tasks: [] },
  { id: 'done', name: 'Done', collapsed: false, tasks: [] },
];

const BADGE: Record<string, [string, string]> = {
  Low: ['#FFF0D8', '#C46704'],
  Medium: ['#D3F2E4', '#0D7358'],
  High: ['#FFE0E0', '#D32F2F'],
};
const TABS = ['Overview', 'Pipeline', 'Activities', 'Goals', 'Reports'];

export function DashboardView() {
  const tidRef = React.useRef(10);
  const [sections, setSections] = React.useState<Section[]>(() =>
    INIT_SECTIONS.map(s => ({ ...s, tasks: s.tasks.map(t => ({ ...t })) }))
  );
  const [addingTo, setAddingTo] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState('Overview');
  const [newTaskName, setNewTaskName] = React.useState('');

  const toggleSection = (id: string) => setSections(ss => ss.map(s => s.id === id ? { ...s, collapsed: !s.collapsed } : s));
  const toggleTask = (sid: string, tid2: string) => setSections(ss => ss.map(s => s.id === sid ? { ...s, tasks: s.tasks.map(t => t.id === tid2 ? { ...t, done: !t.done } : t) } : s));
  const removeTask = (sid: string, tid2: string) => setSections(ss => ss.map(s => s.id === sid ? { ...s, tasks: s.tasks.filter(t => t.id !== tid2) } : s));
  const saveTask = (sid: string) => {
    if (!newTaskName.trim()) { setAddingTo(null); return; }
    tidRef.current += 1;
    setSections(ss => ss.map(s => s.id === sid ? {
      ...s, tasks: [...s.tasks, { id: 't' + tidRef.current, name: newTaskName.trim(), assignee: null, due: null, priority: null, done: false }],
    } : s));
    setNewTaskName(''); setAddingTo(null);
  };

  const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 190px 160px 140px 36px' };
  const tcell: React.CSSProperties = { fontSize: '13px', color: 'var(--color-text-2)', padding: '8px' };
  const thcell: React.CSSProperties = { fontSize: '11px', fontWeight: 600, color: 'var(--color-text-3)', textTransform: 'uppercase', letterSpacing: '.5px', padding: '4px 8px', display: 'flex', alignItems: 'center' };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 20px', borderBottom: '1px solid var(--color-border)', gap: '8px', flexShrink: 0 }}>
        <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-1)' }}>Dashboard</span>
        <button style={{ padding: '4px 10px', border: '1px solid var(--color-border-2)', borderRadius: '6px', background: 'none', fontSize: '12px', fontWeight: 500, color: 'var(--color-text-2)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Set status</button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <button style={{ padding: '5px 13px', background: 'var(--color-brand)', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Share</button>
          <button style={{ padding: '5px 13px', border: '1px solid var(--color-border-2)', background: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', color: 'var(--color-text-1)', fontFamily: 'var(--font-sans)' }}>Customize</button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', padding: '0 20px', borderBottom: '1px solid var(--color-border)', flexShrink: 0, overflowX: 'auto' }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '11px 14px', fontSize: '13.5px', fontWeight: tab === activeTab ? 600 : 500,
            color: tab === activeTab ? 'var(--color-text-1)' : 'var(--color-text-2)',
            background: 'none', border: 'none',
            borderBottom: `2px solid ${tab === activeTab ? 'var(--color-text-1)' : 'transparent'}`,
            marginBottom: '-1px', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'var(--font-sans)',
          }}>{tab}</button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 20px', borderBottom: '1px solid var(--color-border)', gap: '4px', flexShrink: 0 }}>
        <button onClick={() => setAddingTo('todo')} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 13px', background: 'var(--color-brand)', color: '#fff', border: 'none', borderRadius: '7px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="6" y1="1" x2="6" y2="11" /><line x1="1" y1="6" x2="11" y2="6" /></svg>Add task
        </button>
        <div style={{ width: '1px', height: '20px', background: 'var(--color-border)', margin: '0 4px' }} />
        {['Filter', 'Sort', 'Show fields'].map(t => (
          <button key={t} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 9px', border: 'none', background: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--color-text-2)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>{t}</button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--color-bg)', borderBottom: '1px solid var(--color-border)', padding: '0 20px 0 64px' }}>
          <div style={grid}>
            {['Task name', 'Assignee', 'Due date', 'Priority'].map(h => <div key={h} style={thcell}>{h}</div>)}
            <div />
          </div>
        </div>
        {sections.map(sec => (
          <div key={sec.id}>
            <div onClick={() => toggleSection(sec.id)} style={{ display: 'flex', alignItems: 'center', padding: '6px 20px', cursor: 'pointer', gap: '6px', borderBottom: '1px solid var(--color-border)', userSelect: 'none', background: 'var(--color-bg)' }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: sec.collapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform .2s', color: 'var(--color-text-2)', flexShrink: 0 }}>
                <path d="M2 4L6 8L10 4" />
              </svg>
              <span style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--color-text-1)' }}>{sec.name}</span>
              {sec.tasks.length > 0 && <span style={{ fontSize: '12px', color: 'var(--color-text-3)' }}>{sec.tasks.length}</span>}
            </div>
            {!sec.collapsed && sec.tasks.map(task => (
              <div key={task.id} style={{ ...grid, padding: '0 20px', alignItems: 'center', borderBottom: '1px solid var(--color-border)', minHeight: '44px', background: 'var(--color-bg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 8px 8px 34px' }}>
                  <div onClick={() => toggleTask(sec.id, task.id)} style={{ width: '16px', height: '16px', border: task.done ? 'none' : '1.5px solid #C0C0C0', borderRadius: '50%', flexShrink: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: task.done ? 'var(--color-success)' : '#fff' }}>
                    {task.done && <svg width="8" height="6" viewBox="0 0 9 7" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1,3.5 3.5,6 8,1" /></svg>}
                  </div>
                  <span style={{ fontSize: '13.5px', color: 'var(--color-text-1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: task.done ? 'line-through' : 'none', opacity: task.done ? .6 : 1 }}>{task.name}</span>
                </div>
                <div style={tcell}>
                  {task.assignee && <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'var(--color-avatar-blue)', color: '#fff', fontSize: '9px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{task.init}</div>
                    <span>{task.assignee}</span>
                  </div>}
                </div>
                <div style={tcell}>{task.due || ''}</div>
                <div style={tcell}>
                  {task.priority && <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 10px', borderRadius: '12px', fontSize: '11.5px', fontWeight: 600, background: BADGE[task.priority]?.[0], color: BADGE[task.priority]?.[1] }}>{task.priority}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <button onClick={() => removeTask(sec.id, task.id)} style={{ width: '26px', height: '26px', border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '5px', color: 'var(--color-text-3)' }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="11" y2="11" /><line x1="11" y1="1" x2="1" y2="11" /></svg>
                  </button>
                </div>
              </div>
            ))}
            {!sec.collapsed && addingTo === sec.id && (
              <div style={{ ...grid, padding: '0 20px', alignItems: 'center', borderBottom: '1px solid var(--color-border)', minHeight: '44px', background: '#F0F6FF' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 8px 8px 58px' }}>
                  <input autoFocus value={newTaskName} onChange={e => setNewTaskName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveTask(sec.id); if (e.key === 'Escape') { setAddingTo(null); setNewTaskName(''); } }}
                    placeholder="Write a task name…"
                    style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: 'var(--font-sans)', fontSize: '13.5px', color: 'var(--color-text-1)', flex: 1, borderBottom: '1.5px solid var(--color-brand)', paddingBottom: '2px' }} />
                  <button onClick={() => saveTask(sec.id)} style={{ padding: '4px 10px', background: 'var(--color-brand)', color: '#fff', border: 'none', borderRadius: '5px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Save</button>
                  <button onClick={() => { setAddingTo(null); setNewTaskName(''); }} style={{ padding: '4px 8px', background: 'none', border: 'none', borderRadius: '5px', fontSize: '12px', cursor: 'pointer', color: 'var(--color-text-2)', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                </div>
              </div>
            )}
            {!sec.collapsed && addingTo !== sec.id && (
              <div onClick={() => setAddingTo(sec.id)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 20px 9px 66px', fontSize: '13px', color: 'var(--color-text-3)', cursor: 'pointer', borderBottom: '1px solid var(--color-border)' }}>
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="6" y1="1" x2="6" y2="11" /><line x1="1" y1="6" x2="11" y2="6" /></svg>
                Add task...
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
