'use client';

import { Check, ChevronDown, MapPin } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface Option {
  key: string;
  label: string;
}

/** A styled dropdown for choosing a district (the browser's own select list cannot be styled to match the site). */
export function DistrictSelect({ value, options, onChange }: { value: string; options: Option[]; onChange: (key: string) => void }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const selected = options.find((o) => o.key === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);

  useEffect(() => {
    if (open) list.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  function toggle() {
    if (!open) setActive(Math.max(0, options.findIndex((o) => o.key === value)));
    setOpen((v) => !v);
  }

  function pick(i: number) {
    onChange(options[i].key);
    setOpen(false);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') setOpen(false);
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) toggle();
      else setActive((a) => Math.min(options.length - 1, Math.max(0, a + (e.key === 'ArrowDown' ? 1 : -1))));
    } else if ((e.key === 'Enter' || e.key === ' ') && open) {
      e.preventDefault();
      pick(active);
    }
  }

  return (
    <div ref={root} className="relative" onKeyDown={onKey}>
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`District: ${selected.label}`}
        className={`flex h-10 items-center gap-2 rounded-full border bg-card pl-3.5 pr-3 text-sm font-medium transition-colors hover:border-primary/50 ${open ? 'border-primary' : 'border-border'}`}
      >
        <MapPin size={16} className="text-primary" />
        <span className="max-w-[10rem] truncate">{selected.label}</span>
        <ChevronDown size={16} className={`text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul
          ref={list}
          role="listbox"
          aria-label="District"
          className="absolute left-0 z-30 mt-2 max-h-72 w-60 overflow-y-auto rounded-2xl border border-border bg-card p-1.5 shadow-xl"
        >
          {options.map((o, i) => (
            <li
              key={o.key}
              role="option"
              aria-selected={o.key === value}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(i)}
              className={`flex cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm ${i === active ? 'bg-secondary' : ''} ${o.key === value ? 'font-bold text-primary' : ''}`}
            >
              {o.label}
              {o.key === value && <Check size={16} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
