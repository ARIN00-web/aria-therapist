'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

export function Button({
  children,
  variant = 'primary',
  loading,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger' | 'soft';
  loading?: boolean;
}) {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '10px 18px',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: props.disabled || loading ? 'not-allowed' : 'pointer',
    border: '1px solid transparent',
    transition: 'all 0.15s ease',
    opacity: props.disabled || loading ? 0.6 : 1,
  };
  const variants: Record<string, React.CSSProperties> = {
    primary: { background: 'var(--accent)', color: '#fff' },
    soft: { background: 'var(--bg-elevated)', color: 'var(--text)', border: '1px solid var(--border)' },
    ghost: { background: 'transparent', color: 'var(--text-muted)' },
    danger: { background: 'transparent', color: 'var(--red)', border: '1px solid rgba(248,113,113,0.3)' },
  };
  return (
    <button {...props} style={{ ...base, ...variants[variant], ...props.style }} disabled={props.disabled || loading}>
      {loading ? <Spinner /> : children}
    </button>
  );
}

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        border: '2px solid rgba(255,255,255,0.3)',
        borderTopColor: '#fff',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
      }}
    />
  );
}

export function Card({ children, style, className }: { children: ReactNode; style?: React.CSSProperties; className?: string }) {
  return (
    <div className={`glass ${className || ''}`} style={{ padding: 20, ...style }}>
      {children}
    </div>
  );
}

export function EmptyState({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.5 }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{title}</div>
      {hint && <div style={{ fontSize: 13, marginTop: 6 }}>{hint}</div>}
    </div>
  );
}

export function Skeleton({ height = 20, width = '100%' }: { height?: number; width?: number | string }) {
  return <div className="skeleton" style={{ height, width }} />;
}

const MOOD_EMOJI = ['😔', '😟', '😕', '😐', '🙂', '😌', '😊', '😄', '😁', '🤩'];
const MOOD_LABEL = ['Awful', 'Very low', 'Low', 'Meh', 'Okay', 'Fine', 'Good', 'Great', 'Wonderful', 'Amazing'];

export function MoodSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 48, lineHeight: 1 }}>{MOOD_EMOJI[value - 1]}</div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 8 }}>
          {MOOD_LABEL[value - 1]} · {value}/10
        </div>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Mood level from 1 to 10"
      />
    </div>
  );
}

export { MOOD_EMOJI, MOOD_LABEL };
