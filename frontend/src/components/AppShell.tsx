'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Spinner, ThemeToggle } from './ui';

const NAV = [
  { href: '/dashboard', label: 'Home', icon: '◈' },
  { href: '/chat', label: 'Talk to Aria', icon: '✦' },
  { href: '/history', label: 'Sessions', icon: '❋' },
  { href: '/wellness', label: 'Wellness', icon: '♥' },
  { href: '/memory', label: 'Memory', icon: '◉' },
  { href: '/settings', label: 'Settings', icon: '⚙' },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
        <Spinner size={24} />
      </div>
    );
  }

  return (
    <>
      <style>{`
        .app-wrap { display: flex; min-height: 100dvh; }
        .sidebar {
          width: 240px; flex-shrink: 0;
          border-right: 1px solid var(--border);
          background: var(--bg-card);
          display: flex; flex-direction: column;
          padding: 24px 16px;
          position: sticky; top: 0; height: 100dvh;
        }
        .app-main { flex: 1; min-width: 0; }
        .mobile-nav { display: none; }
        .mobile-topbar { display: none; }
        @media (max-width: 768px) {
          .sidebar { display: none; }
          .mobile-topbar {
            display: flex; align-items: center; justify-content: space-between;
            position: sticky; top: 0; z-index: 40;
            padding: 12px 16px;
            background: var(--bg-card);
            border-bottom: 1px solid var(--border);
          }
          .mobile-nav {
            display: flex;
            position: fixed; bottom: 0; left: 0; right: 0;
            background: var(--bg-card);
            border-top: 1px solid var(--border);
            z-index: 50;
            padding: 8px 0 max(8px, env(safe-area-inset-bottom));
          }
          .app-main { padding-bottom: 72px; }
        }
        .nav-item {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 12px; border-radius: 12px;
          color: var(--text-muted); text-decoration: none;
          font-size: 14px; font-weight: 500;
          transition: all 0.15s;
        }
        .nav-item:hover { background: var(--bg-elevated); color: var(--text); }
        .nav-item.active { background: var(--accent-glow); color: var(--accent); font-weight: 600; }
        .mobile-nav-item {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 3px;
          text-decoration: none; color: var(--text-muted);
          font-size: 10px; padding: 4px 0;
          transition: color 0.15s;
        }
        .mobile-nav-item.active { color: var(--accent); }
      `}</style>
      <div className="app-wrap">
        <aside className="sidebar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px 24px' }}>
            <span style={{ fontSize: 22, color: 'var(--accent)' }}>✦</span>
            <span style={{ fontSize: 19, fontWeight: 700 }}>Aria</span>
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
            {NAV.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link key={item.href} href={item.href} className={`nav-item${active ? ' active' : ''}`}>
                  <span style={{ fontSize: 15, width: 18, textAlign: 'center' }}>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{
                width: 34, height: 34, borderRadius: '50%',
                background: 'var(--accent)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700, flexShrink: 0,
              }}>
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={logout} style={{
                flex: 1, padding: '8px', borderRadius: 10,
                background: 'transparent', border: '1px solid var(--border)',
                color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer',
              }}>
                Sign out
              </button>
              <ThemeToggle />
            </div>
          </div>
        </aside>

        <main className="app-main">
          <div className="mobile-topbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18, color: 'var(--accent)' }}>✦</span>
              <span style={{ fontSize: 16, fontWeight: 700 }}>Aria</span>
            </div>
            <ThemeToggle />
          </div>
          {children}
        </main>

        <nav className="mobile-nav">
          {NAV.slice(0, 5).map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link key={item.href} href={item.href} className={`mobile-nav-item${active ? ' active' : ''}`}>
                <span style={{ fontSize: 18 }}>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
