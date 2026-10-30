'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';

export type LightSelectOption = {
  value: string;
  label: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: LightSelectOption[];
  'aria-label'?: string;
  className?: string;
  style?: CSSProperties;
};

export default function LightSelect({
  value,
  onChange,
  options,
  'aria-label': ariaLabel,
  className,
  style,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`light-select${open ? ' is-open' : ''}${className ? ` ${className}` : ''}`} style={style}>
      <button
        type="button"
        className={`light-select-trigger${open ? ' is-open' : ''}`}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="light-select-value">{selected?.label ?? value}</span>
        <span className="light-select-chevron" aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <ul className="light-select-menu" role="listbox">
          {options.map((o) => (
            <li
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              className={`light-select-option${o.value === value ? ' is-selected' : ''}`}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}