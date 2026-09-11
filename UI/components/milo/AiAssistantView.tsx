'use client';
import React, { ReactNode } from 'react';

// ───────────────────────── types ─────────────────────────
type Role = 'user' | 'assistant';
interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  ts: number;
}

// ───────────────────────── icons ─────────────────────────
const Ico = ({ d, size = 18, vb = '0 0 20 20' }: { d: ReactNode; size?: number; vb?: string }) => (
  <svg width={size} height={size} viewBox={vb} fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    {d}
  </svg>
);

const SendIcon = <Ico d={<><line x1="10" y1="16.5" x2="10" y2="4" /><polyline points="5,8.5 10,3.5 15,8.5" /></>} />;
const SparkIcon = (
  <Ico d={<path d="M10 2L11.6 7.4 17 9 11.6 10.6 10 16 8.4 10.6 3 9 8.4 7.4Z" />} />
);

// ───────────────────────── starter prompts ─────────────────────────
const SUGGESTIONS: { title: string; subtitle: string; prompt: string }[] = [
  {
    title: 'Find candidates',
    subtitle: 'Source prospects for an open role',
    prompt: 'Find me 10 senior backend engineers in Bangalore open to new roles.',
  },
  {
    title: 'Draft outreach',
    subtitle: 'Write a personalized first email',
    prompt: 'Draft a warm outreach email to a Head of Talent at a Series B fintech.',
  },
  {
    title: 'Summarize a profile',
    subtitle: 'Quick brief on a prospect',
    prompt: 'Summarize the key strengths of a candidate with 8 years in DevOps.',
  },
  {
    title: 'Plan a campaign',
    subtitle: 'Build a multi-step sequence',
    prompt: 'Help me plan a 3-touch hiring outreach sequence over 7 days.',
  },
];

// canned demo replies until the backend is wired up
const DEMO_REPLIES = [
  "Here's a quick draft to get us started. I've pulled together an approach based on what you described — let me know if you'd like me to adjust the tone, length, or focus.\n\nThis is a placeholder response while the assistant is being connected to the HR backend. Soon I'll be able to search prospects, draft real outreach, and summarize live profiles for you.",
  "Got it. I'd normally route this through the HR Assistant service to pull live data, but I'm currently running in preview mode.\n\nOnce connected, I'll return real candidate matches, enrichment, and outreach drafts right here in the chat.",
  "Sure — I can help with that. In the full version I'll tap into your prospect database and campaigns to give you a tailored answer.\n\nFor now, this is a demo reply so you can see how our conversation will look.",
];

let replyIdx = 0;

// ───────────────────────── message bubble ─────────────────────────
function Avatar({ role }: { role: Role }) {
  if (role === 'assistant') {
    return (
      <div style={{
        width: 30, height: 30, borderRadius: '8px', flexShrink: 0,
        background: 'var(--color-brand)', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {SparkIcon}
      </div>
    );
  }
  return (
    <div style={{
      width: 30, height: 30, borderRadius: '8px', flexShrink: 0,
      background: 'var(--color-avatar-purple)', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, fontWeight: 700,
    }}>
      You
    </div>
  );
}

function MessageRow({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
      <Avatar role={msg.role} />
      <div style={{ flex: 1, minWidth: 0, paddingTop: '4px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-1)', marginBottom: '4px' }}>
          {isUser ? 'You' : 'Milo'}
        </div>
        <div style={{
          fontSize: '14px', lineHeight: 1.6, color: 'var(--color-text-1)',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {msg.content}
        </div>
      </div>
    </div>
  );
}

function TypingRow() {
  return (
    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
      <Avatar role="assistant" />
      <div style={{ paddingTop: '10px', display: 'flex', gap: '5px' }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            width: 7, height: 7, borderRadius: '50%', background: 'var(--color-text-3)',
            display: 'inline-block', animation: 'miloBlink 1.2s ease-in-out infinite',
            animationDelay: `${i * 0.18}s`,
          }} />
        ))}
      </div>
    </div>
  );
}

// ───────────────────────── empty / welcome state ─────────────────────────
function Welcome({ onPick }: { onPick: (p: string) => void }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '24px', textAlign: 'center',
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: '14px',
        background: 'var(--color-brand)', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '18px',
      }}>
        <span style={{ display: 'flex', transform: 'scale(1.4)' }}>{SparkIcon}</span>
      </div>
      <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-1)', margin: 0 }}>
        How can I help you today?
      </h1>
      <p style={{ fontSize: '14px', color: 'var(--color-text-2)', margin: '8px 0 28px', maxWidth: '440px' }}>
        Ask Milo to source candidates, draft outreach, summarize profiles, or plan a campaign.
      </p>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: '12px', width: '100%', maxWidth: '600px',
      }}>
        {SUGGESTIONS.map(s => (
          <button key={s.title} onClick={() => onPick(s.prompt)}
            style={{
              textAlign: 'left', padding: '14px 16px', borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border)', background: 'var(--color-bg)',
              cursor: 'pointer', transition: 'border-color .12s, background .12s, box-shadow .12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--color-brand)'; e.currentTarget.style.background = 'var(--color-brand-subtle)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--color-border)'; e.currentTarget.style.background = 'var(--color-bg)'; }}
          >
            <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-text-1)' }}>{s.title}</div>
            <div style={{ fontSize: '12.5px', color: 'var(--color-text-2)', marginTop: '3px' }}>{s.subtitle}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────── main view ─────────────────────────
export function AiAssistantView() {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState('');
  const [thinking, setThinking] = React.useState(false);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const taRef = React.useRef<HTMLTextAreaElement>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasChat = messages.length > 0;

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, thinking]);

  React.useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const autoGrow = () => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 180) + 'px';
  };

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;
    const userMsg: ChatMessage = { id: 'u' + Date.now(), role: 'user', content: trimmed, ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setThinking(true);
    if (taRef.current) taRef.current.style.height = 'auto';

    // simulate an assistant reply (placeholder until backend wiring)
    timerRef.current = setTimeout(() => {
      const reply = DEMO_REPLIES[replyIdx % DEMO_REPLIES.length];
      replyIdx += 1;
      setMessages(prev => [...prev, { id: 'a' + Date.now(), role: 'assistant', content: reply, ts: Date.now() }]);
      setThinking(false);
    }, 900);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: 'var(--color-bg)' }}>
      {/* header */}
      <div style={{
        flexShrink: 0, padding: '14px 24px', borderBottom: '1px solid var(--color-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: 30, height: 30, borderRadius: '8px', background: 'var(--color-brand)',
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{SparkIcon}</div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-1)' }}>AI Assistant</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-3)' }}>Milo · Hiring copilot</div>
          </div>
        </div>
        {hasChat && (
          <button
            onClick={() => { setMessages([]); setThinking(false); if (timerRef.current) clearTimeout(timerRef.current); }}
            style={{
              fontSize: '13px', fontWeight: 600, color: 'var(--color-text-2)',
              padding: '7px 14px', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)', background: 'var(--color-bg)', cursor: 'pointer',
              transition: 'background .12s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--color-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-bg)'; }}
          >
            New chat
          </button>
        )}
      </div>

      {/* messages / welcome */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {hasChat ? (
          <div style={{
            width: '100%', maxWidth: '760px', margin: '0 auto', padding: '28px 24px',
            display: 'flex', flexDirection: 'column', gap: '26px',
          }}>
            {messages.map(m => <MessageRow key={m.id} msg={m} />)}
            {thinking && <TypingRow />}
          </div>
        ) : (
          <Welcome onPick={send} />
        )}
      </div>

      {/* composer */}
      <div style={{ flexShrink: 0, padding: '0 24px 18px' }}>
        <div style={{ width: '100%', maxWidth: '760px', margin: '0 auto' }}>
          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: '10px',
            border: '1px solid var(--color-border-2)', borderRadius: 'var(--radius-lg)',
            background: 'var(--color-bg)', padding: '10px 10px 10px 16px',
            boxShadow: 'var(--shadow-sm)',
          }}>
            <textarea
              ref={taRef}
              value={input}
              rows={1}
              placeholder="Message Milo…"
              onChange={e => { setInput(e.target.value); autoGrow(); }}
              onKeyDown={onKeyDown}
              style={{
                flex: 1, resize: 'none', border: 'none', outline: 'none', background: 'transparent',
                fontSize: '14px', lineHeight: 1.5, color: 'var(--color-text-1)',
                fontFamily: 'inherit', maxHeight: '180px', padding: '6px 0',
              }}
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || thinking}
              title="Send"
              style={{
                width: 36, height: 36, flexShrink: 0, borderRadius: 'var(--radius-md)', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: input.trim() && !thinking ? 'var(--color-brand)' : 'var(--color-hover)',
                color: input.trim() && !thinking ? '#fff' : 'var(--color-text-3)',
                cursor: input.trim() && !thinking ? 'pointer' : 'default',
                transition: 'background .12s, color .12s',
              }}
            >
              {SendIcon}
            </button>
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--color-text-3)', textAlign: 'center', marginTop: '8px' }}>
            Milo can make mistakes. Responses are demo placeholders until the assistant is connected.
          </div>
        </div>
      </div>

      <style>{`
        @keyframes miloBlink {
          0%, 60%, 100% { opacity: 0.25; transform: translateY(0); }
          30% { opacity: 1; transform: translateY(-3px); }
        }
      `}</style>
    </div>
  );
}
