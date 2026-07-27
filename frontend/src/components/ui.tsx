'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useTheme } from '@/context/ThemeContext';

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
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    cursor: props.disabled || loading ? 'not-allowed' : 'pointer',
    border: '1px solid transparent',
    transition: 'transform 0.12s ease, box-shadow 0.15s ease, background 0.15s ease, opacity 0.15s ease',
    opacity: props.disabled || loading ? 0.6 : 1,
  };
  const variants: Record<string, React.CSSProperties> = {
    primary: { background: 'var(--accent)', color: '#fff', boxShadow: '0 4px 14px var(--accent-glow)' },
    soft: { background: 'var(--bg-elevated)', color: 'var(--text)', border: '1px solid var(--border)' },
    ghost: { background: 'transparent', color: 'var(--text-muted)' },
    danger: { background: 'transparent', color: 'var(--red)', border: '1px solid var(--red)' },
  };
  // Spinner tint: white on the filled primary button, accent-colored otherwise.
  const spinnerColor = variant === 'primary' ? '#fff' : 'var(--accent)';
  return (
    <button
      {...props}
      style={{ ...base, ...variants[variant], ...props.style }}
      disabled={props.disabled || loading}
      onMouseDown={(e) => {
        if (!props.disabled && !loading) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)';
        props.onMouseDown?.(e);
      }}
      onMouseUp={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
        props.onMouseUp?.(e);
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
        props.onMouseLeave?.(e);
      }}
    >
      {loading ? <Spinner color={spinnerColor} /> : children}
    </button>
  );
}

export function Spinner({ size = 16, color }: { size?: number; color?: string }) {
  const stroke = color || 'var(--accent)';
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        border: '2px solid color-mix(in srgb, currentColor 25%, transparent)',
        borderTopColor: stroke,
        borderRadius: '50%',
        color: stroke,
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
      <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.7 }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{title}</div>
      {hint && <div style={{ fontSize: 13, marginTop: 6 }}>{hint}</div>}
    </div>
  );
}

export function Skeleton({ height = 20, width = '100%' }: { height?: number; width?: number | string }) {
  return <div className="skeleton" style={{ height, width }} />;
}

/** Sun/moon theme toggle. Flips data-theme + persists; nothing else. */
export function ThemeToggle({ style }: { style?: React.CSSProperties }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 36,
        height: 36,
        borderRadius: 10,
        border: '1px solid var(--border)',
        background: 'var(--bg-elevated)',
        color: 'var(--text-muted)',
        cursor: 'pointer',
        fontSize: 16,
        transition: 'all 0.15s',
        ...style,
      }}
    >
      {isDark ? '☀️' : '🌙'}
    </button>
  );
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
