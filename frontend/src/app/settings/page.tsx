'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { useAuth } from '@/context/AuthContext';
import { authApi } from '@/lib/api';
import { Button, Card } from '@/components/ui';
import { apiFetch } from '@/lib/api';

const MODALITIES = ['Auto', 'CBT', 'DBT', 'ACT', 'Person-centred', 'Motivational Interviewing'];

export default function SettingsPage() {
  const { user, setUser, logout } = useAuth();
  const router = useRouter();

  const [modality, setModality] = useState(user?.preferredModality || 'Auto');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function saveSettings() {
    setSaving(true);
    setError('');
    try {
      const { user: updated } = await authApi.updateSettings({ preferredModality: modality });
      setUser(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount() {
    setDeleting(true);
    try {
      await apiFetch('/api/custom-auth/me', { method: 'DELETE' });
      await logout();
      router.replace('/login');
    } catch {
      setDeleting(false);
    }
  }

  return (
    <AppShell>
      <div style={styles.page}>
        <h1 style={styles.title}>Settings</h1>

        <Card style={styles.section}>
          <div style={styles.sectionTitle}>Account</div>
          <div style={styles.field}>
            <div style={styles.fieldLabel}>Name</div>
            <div style={styles.fieldValue}>{user?.name}</div>
          </div>
          <div style={styles.field}>
            <div style={styles.fieldLabel}>Email</div>
            <div style={styles.fieldValue}>{user?.email}</div>
          </div>
          <div style={styles.field}>
            <div style={styles.fieldLabel}>Member since</div>
            <div style={styles.fieldValue}>
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en', { month: 'long', year: 'numeric' }) : '—'}
            </div>
          </div>
        </Card>

        <Card style={styles.section}>
          <div style={styles.sectionTitle}>Therapy approach</div>
          <p style={styles.sectionDesc}>
            Choose how Aria works with you. Auto lets Aria adapt to each conversation.
          </p>
          <div style={styles.modalityGrid}>
            {MODALITIES.map((m) => (
              <button
                key={m}
                onClick={() => setModality(m)}
                style={{
                  ...styles.modalityBtn,
                  ...(modality === m ? styles.modalityBtnActive : {}),
                }}
              >
                {m}
              </button>
            ))}
          </div>
          {error && <p style={styles.error}>{error}</p>}
          <Button loading={saving} onClick={saveSettings} style={{ marginTop: 16 }}>
            {saved ? '✓ Saved' : 'Save changes'}
          </Button>
        </Card>

        <Card style={styles.section}>
          <div style={styles.sectionTitle}>Privacy & data</div>
          <p style={styles.sectionDesc}>
            All your conversations are encrypted at rest. You can delete your account and all associated data at any time.
          </p>
          {!showDelete ? (
            <Button variant="danger" onClick={() => setShowDelete(true)}>
              Delete account
            </Button>
          ) : (
            <div style={styles.deleteConfirm}>
              <p style={{ fontSize: 14, color: 'var(--red)', marginBottom: 12 }}>
                This will permanently delete your account, all sessions, memories, and wellness data. This cannot be undone.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <Button variant="soft" onClick={() => setShowDelete(false)}>Cancel</Button>
                <Button variant="danger" loading={deleting} onClick={deleteAccount}>
                  Yes, delete everything
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '32px 28px', maxWidth: 640, margin: '0 auto' },
  title: { fontSize: 24, fontWeight: 700, marginBottom: 24 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 16 },
  sectionDesc: { fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 16 },
  field: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' },
  fieldLabel: { fontSize: 13, color: 'var(--text-muted)' },
  fieldValue: { fontSize: 14, fontWeight: 500 },
  modalityGrid: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  modalityBtn: {
    padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)',
    background: 'var(--bg-elevated)', color: 'var(--text-muted)',
    fontSize: 13, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s',
  },
  modalityBtnActive: {
    border: '1px solid var(--accent)', background: 'var(--accent-glow)',
    color: 'var(--accent)', fontWeight: 600,
  },
  error: { fontSize: 13, color: 'var(--red)', marginTop: 8 },
  deleteConfirm: { padding: 16, background: 'rgba(248,113,113,0.06)', borderRadius: 10, border: '1px solid rgba(248,113,113,0.2)' },
};
