import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
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

function relativeTime(t: TFunction, ms: number): string {
  const secs = Math.round((Date.now() - ms) / 1000);
  if (secs < 60) return t('account.justNow');
  const mins = Math.round(secs / 60);
  if (mins < 60) return t('account.minsAgo', { count: mins });
  const hours = Math.round(mins / 60);
  if (hours < 24) return t('account.hoursAgo', { count: hours });
  // Still the browser's locale rather than the app's — a date format, which is
  // §6.6 phase 4 along with every other one.
  return new Date(ms).toLocaleDateString();
}

/**
 * One honest sentence per sync state — never a stale success.
 *
 * Takes `t` rather than calling `useTranslation` itself: it's a plain function
 * with two call sites in this file, and `sync.error` is a Supabase message we
 * pass through untranslated because inventing a Hindi wording for someone
 * else's error text would be guessing at what went wrong.
 */
export function describeSync(t: TFunction, sync: SyncStatus): string {
  const waiting = t('account.changesWaiting', { count: sync.pending });
  switch (sync.state) {
    case 'disabled':
      return t('account.syncDisabled');
    case 'signed-out':
      return t('account.syncSignedOut');
    case 'offline':
      return sync.pending > 0 ? t('account.syncOfflinePending', { waiting }) : t('account.syncOffline');
    case 'syncing':
      return t('account.syncing');
    case 'error':
      // Says "not synced", not "sync failed": the outbox still holds every
      // unpushed write, so this is a delay, not a loss.
      return t('account.syncError', { reason: sync.error ?? t('account.syncWillRetry') });
    case 'idle':
      if (sync.pending > 0) return waiting;
      return sync.lastSyncedAt
        ? t('account.syncedAt', { when: relativeTime(t, sync.lastSyncedAt) })
        : t('account.syncUpToDate');
  }
}

// ─── Sign-in form ────────────────────────────────────────────────────────────

function AuthForm() {
  const { t } = useTranslation();
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
      else if (needsConfirmation) setNotice(t('account.confirmEmail'));
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
        className="w-full rounded-control px-3 py-2.5 text-callout focus-visible:border-[var(--c-border-focus)]"
        style={inputStyle}
      />
      <input
        type="password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        placeholder={t('account.passwordPlaceholder')}
        // Tells the password manager which field it's looking at; a sign-up
        // form marked `current-password` gets offered the old one.
        autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
        required
        minLength={6}
        className="w-full rounded-control px-3 py-2.5 text-callout focus-visible:border-[var(--c-border-focus)]"
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
        {busy ? t('account.working') : mode === 'in' ? t('account.signIn') : t('account.createAccount')}
      </button>

      <button
        type="button"
        onClick={() => { setMode(m => (m === 'in' ? 'up' : 'in')); setError(null); setNotice(null); }}
        className="text-[12px] font-semibold pt-1"
        style={{ color: 'var(--c-text-3)' }}
      >
        {mode === 'in' ? t('account.toggleToSignUp') : t('account.toggleToSignIn')}
      </button>
    </form>
  );
}

// ─── Account card ────────────────────────────────────────────────────────────

export function AccountCard() {
  const { t } = useTranslation();
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
            {user?.email ?? t('account.traveller')}
          </div>
          <div className="text-[12px] font-medium mt-0.5" style={{ color: 'var(--c-text-3)' }}>
            {loading ? t('account.checkingSession') : describeSync(t, sync)}
          </div>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--c-border)' }}>
        {!configured ? (
          <Row
            icon={CloudOff}
            label={t('account.syncUnavailable')}
            value={t('account.syncUnavailableDetail')}
          />
        ) : user ? (
          <Row icon={LogOut} label={t('account.signOut')} value={t('account.signOutDetail')} onClick={() => void signOut()} />
        ) : (
          <>
            <Row
              icon={Zap}
              label={t('account.signInToSync')}
              value={t('account.signInToSyncDetail')}
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
  const { t } = useTranslation();
  const { configured, user, sync, syncNow, clearLocalData } = useAuth();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <SectionHeader label={t('account.dataAndSync')} />
      <SectionCard>
        <Row
          icon={sync.state === 'error' ? CircleAlert : RefreshCw}
          label={t('account.syncStatus')}
          value={describeSync(t, sync)}
          {...(configured && user ? { onClick: () => void syncNow() } : {})}
        />
        <RowDivider />
        <Row
          icon={Trash2}
          danger
          label={confirming ? t('account.clearLocalDataConfirm') : t('account.clearLocalData')}
          value={
            confirming
              ? t('account.clearLocalDataConfirmDetail')
              : user
                ? t('account.clearLocalDataSignedIn')
                : t('account.clearLocalDataSignedOut')
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
