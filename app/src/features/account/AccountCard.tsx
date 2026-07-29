import { useState } from 'react';
import { User, Zap, LogOut, RefreshCw, CloudOff, Trash2, CircleAlert } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Row, RowDivider, SectionCard, SectionHeader } from '../journey/components/settingsRows';
import type { SyncStatus } from '../../services/syncEngine';

/**
 * Account + sync UI for the YOU screen (PRD §4.5, §5.7).
 *
 * Email/password only — Google and Apple are in scope (§3) but each needs OAuth
 * credentials configured in a console this repo can't reach, and a button that
 * always errors is worse than one that isn't there yet.
 *
 * The whole card is optional furniture: with no Supabase project configured it
 * says so once and offers nothing, because the app is fully usable without an
 * account and pretending otherwise would be a dead press (the same rule that
 * removed the old `tappable` flag from `Row`).
 */

function relativeTime(ms: number): string {
  const secs = Math.round((Date.now() - ms) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(ms).toLocaleDateString();
}

/** One honest sentence per sync state — never a stale success. */
export function describeSync(sync: SyncStatus): string {
  const waiting = sync.pending === 1 ? '1 change waiting' : `${sync.pending} changes waiting`;
  switch (sync.state) {
    case 'disabled':
      return 'Sync is not configured for this build';
    case 'signed-out':
      return 'Not signed in — your data stays on this device';
    case 'offline':
      return sync.pending > 0 ? `Offline — ${waiting}` : 'Offline';
    case 'syncing':
      return 'Syncing…';
    case 'error':
      // Says "not synced", not "sync failed": the outbox still holds every
      // unpushed write, so this is a delay, not a loss.
      return `Not synced — ${sync.error ?? 'will retry'}`;
    case 'idle':
      if (sync.pending > 0) return waiting;
      return sync.lastSyncedAt ? `Synced ${relativeTime(sync.lastSyncedAt)}` : 'Up to date';
  }
}

// ─── Sign-in form ────────────────────────────────────────────────────────────

function AuthForm() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    if (mode === 'in') {
      const { error } = await signIn(email, password);
      if (error) setError(error);
    } else {
      const { error, needsConfirmation } = await signUp(email, password);
      if (error) setError(error);
      // Sign-up with email confirmation on returns a user but no session. Saying
      // nothing here leaves the rider on a form that looks like it failed.
      else if (needsConfirmation) setNotice('Check your inbox to confirm your email, then sign in.');
    }
    setBusy(false);
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--c-card-alt)',
    border: '1px solid var(--c-border-2)',
    color: 'var(--c-text)',
  };

  return (
    <form onSubmit={submit} className="px-5 pb-5 pt-1 flex flex-col gap-2">
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="you@example.com"
        autoComplete="email"
        required
        className="w-full rounded-xl px-3 py-2.5 text-[14px] outline-none focus-visible:border-[var(--c-accent)]"
        style={inputStyle}
      />
      <input
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        placeholder="Password"
        // Tells the password manager which field it's looking at; a sign-up
        // form marked `current-password` gets offered the old one.
        autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
        required
        minLength={6}
        className="w-full rounded-xl px-3 py-2.5 text-[14px] outline-none focus-visible:border-[var(--c-accent)]"
        style={inputStyle}
      />

      {error && (
        <div className="flex items-start gap-2 text-[12px] font-medium" style={{ color: 'var(--c-danger)' }}>
          <CircleAlert size={14} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="text-[12px] font-medium" style={{ color: 'var(--c-text-2)' }}>{notice}</div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl py-2.5 text-[14px] font-bold transition-opacity active:scale-[0.99]"
        style={{
          background: 'var(--c-accent)',
          color: 'var(--c-accent-fg)',
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? 'Working…' : mode === 'in' ? 'Sign in' : 'Create account'}
      </button>

      <button
        type="button"
        onClick={() => { setMode(m => (m === 'in' ? 'up' : 'in')); setError(null); setNotice(null); }}
        className="text-[12px] font-semibold pt-1"
        style={{ color: 'var(--c-text-3)' }}
      >
        {mode === 'in' ? 'No account? Create one' : 'Already have an account? Sign in'}
      </button>
    </form>
  );
}

// ─── Account card ────────────────────────────────────────────────────────────

export function AccountCard() {
  const { user, loading, configured, sync, signOut } = useAuth();
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="mx-5 mb-2 rounded-2xl overflow-hidden"
      style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}
    >
      <div className="flex items-center gap-4 p-5">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center shrink-0"
          style={{ background: 'var(--c-card-alt)' }}
        >
          <User size={26} style={{ color: 'var(--c-text-3)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[16px] font-bold truncate" style={{ color: 'var(--c-text)' }}>
            {user?.email ?? 'Traveller'}
          </div>
          <div className="text-[12px] font-medium mt-0.5" style={{ color: 'var(--c-text-3)' }}>
            {loading ? 'Checking your session…' : describeSync(sync)}
          </div>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--c-border)' }}>
        {!configured ? (
          <Row
            icon={CloudOff}
            label="Sync unavailable"
            value="This build has no backend configured — everything stays on this device"
          />
        ) : user ? (
          <Row icon={LogOut} label="Sign out" value="Your data stays on this device" onClick={() => void signOut()} />
        ) : (
          <>
            <Row
              icon={Zap}
              label="Sign in to sync your data"
              value="Saved places, journeys & preferences"
              onClick={() => setExpanded(v => !v)}
            />
            {expanded && <AuthForm />}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Data management ─────────────────────────────────────────────────────────

/**
 * "Data & sync" section (§4.5 — Data Management).
 *
 * Clearing local data is guarded by a two-tap confirm rather than a `confirm()`
 * dialog, and it deliberately does **not** push deletes: it's "forget this
 * device", not "delete my account", so it must not wipe the rider's other phone.
 */
export function DataSection() {
  const { configured, user, sync, syncNow, clearLocalData } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <SectionHeader label="Data & sync" />
      <SectionCard>
        <Row
          icon={sync.state === 'error' ? CircleAlert : RefreshCw}
          label="Sync status"
          value={describeSync(sync)}
          {...(configured && user ? { onClick: () => void syncNow() } : {})}
        />
        <RowDivider />
        <Row
          icon={Trash2}
          danger
          label={confirming ? 'Tap again to clear local data' : 'Clear local data'}
          value={
            confirming
              ? 'Removes saved stations, journeys and history from this device only'
              : user
                ? 'This device only — your synced data is kept'
                : 'Removes saved stations, journeys and history'
          }
          disabled={busy}
          onClick={() => {
            if (!confirming) { setConfirming(true); return; }
            setBusy(true);
            void clearLocalData().finally(() => { setBusy(false); setConfirming(false); });
          }}
        />
      </SectionCard>
    </>
  );
}
