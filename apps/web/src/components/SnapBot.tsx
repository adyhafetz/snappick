'use client';

import { Loader2, Send, Sparkles, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { DateRange, Period } from '@/lib/snapshot';

// Same look as the SnapBot chat in the mobile app: icon header, card-style bubbles with a time, a small FAQ box,
// and a "SnapBot is thinking…" row with a spinner.
const SUGGESTIONS = ['Which district recycles the most?', 'What materials are recycled most?', 'Where are requests left uncollected?', 'What does "n/a" mean?'];

interface Msg {
  id: number;
  role: 'user' | 'bot';
  text: string;
  time: string;
}

let seq = 0;
function msg(role: Msg['role'], text: string): Msg {
  seq += 1;
  const d = new Date();
  return { id: seq, role, text, time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` };
}

function Icon({ size }: { size: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/brand/snapbot-icon.svg" alt="SnapBot" width={size} height={size} />;
}

export function SnapBot({ period, district, range = null, hidden = false }: { period: Period; district: string; range?: DateRange | null; hidden?: boolean }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>(() => [msg('bot', "Hi! I'm SnapBot. Ask me anything about the numbers on this dashboard.")]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' });
  }, [messages, open]);

  async function ask(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    setMessages((m) => [...m, msg('user', question)]);
    setInput('');
    setBusy(true);
    try {
      const res = await fetch('/api/snapbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, period, district, ...(range ? { from: range.from, to: range.to } : {}) }),
      });
      const body = (await res.json()) as { answer?: string; error?: string };
      setMessages((m) => [...m, msg('bot', body.answer ?? body.error ?? 'Sorry, I could not answer that.')]);
    } catch {
      setMessages((m) => [...m, msg('bot', 'I could not reach the server. Please try again.')]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3 ${hidden ? 'invisible' : ''}`}>
      {open && (
        <section className="flex h-[30rem] w-[min(23rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-border bg-background shadow-2xl" aria-label="SnapBot chat">
          <header className="flex items-center justify-between border-b border-border bg-card px-5 py-3.5">
            <div className="flex items-center gap-3">
              <Icon size={36} />
              <span className="text-base font-bold">SnapBot</span>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close chat" className="flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary/70 text-muted-foreground hover:bg-secondary">
              <X size={20} />
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
            {messages.length <= 1 && (
              <div className="rounded-2xl border border-border/60 bg-secondary/40 p-3">
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  <Sparkles size={13} className="text-primary" /> Frequently asked questions
                </p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((c) => (
                    <button key={c} type="button" onClick={() => ask(c)} disabled={busy} className="rounded-xl border border-primary/30 bg-card px-3 py-1.5 text-left text-xs font-medium hover:bg-primary/10">
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'bot' && (
                  <span className="mr-2 mt-0.5 shrink-0">
                    <Icon size={26} />
                  </span>
                )}
                <div className={`max-w-[82%] rounded-2xl p-3.5 shadow-sm ${m.role === 'user' ? 'rounded-tr-sm bg-primary text-white' : 'rounded-tl-sm border border-border bg-card'}`}>
                  <p className={`whitespace-pre-line leading-relaxed ${m.role === 'user' ? 'font-medium' : ''}`}>{m.text}</p>
                  <p className={`mt-1 text-right text-[11px] ${m.role === 'user' ? 'text-white/70' : 'text-muted-foreground'}`}>{m.time}</p>
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex w-fit items-center gap-2 rounded-2xl border border-border bg-card px-3.5 py-2.5">
                <Loader2 size={16} className="animate-spin text-primary" />
                <span className="text-xs font-medium text-muted-foreground">SnapBot is thinking…</span>
              </div>
            )}
            <div ref={end} />
          </div>

          <form
            className="flex items-center gap-2 border-t border-border bg-card p-3.5"
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={300}
              placeholder="Ask about these numbers…"
              aria-label="Your question"
              disabled={busy}
              className="h-11 flex-1 rounded-2xl border border-border bg-background px-4 text-sm"
            />
            <button type="submit" disabled={busy || !input.trim()} aria-label="Send" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white shadow-sm disabled:opacity-40">
              <Send size={18} />
            </button>
          </form>
        </section>
      )}

      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ask SnapBot for help with these numbers"
          title="Ask SnapBot"
          className="animate-bounce-calm rounded-full motion-reduce:animate-none"
        >
          <Icon size={60} />
        </button>
      )}
    </div>
  );
}
