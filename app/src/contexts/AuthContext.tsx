import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from '../services/supabase';
import {
  enqueueFullResync,
  getMeta,
  setMeta,
  META_SYNCED_USER,
  clearLocalUserData,
  migrateFromLocalStorage,
} from '../data/db';
import {
  syncNow,
  startSyncTriggers,
  hydrateSyncStatus,
  subscribeSyncStatus,
  getSyncStatus,
  type SyncStatus,
} from '../services/syncEngine';
import { track } from '../services/analytics';

/**
 * Auth + sync state (PRD §4.5, §5.7).
 *
 * Email/password only in this pass. Google and Apple are in scope (§3) but each
 * needs OAuth credentials configured in a console this codebase can't reach, so
 * they're left as a documented follow-up rather than a button that fails.
 *
 * `loading` is true only until the initial session is resolved. It gates the
 * *account UI*, never the app — a rider whose network is hanging still gets
 * their map, their favourites and their timetable.
 */

export interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** False when no Supabase project is configured; the UI says so instead of offering sign-in. */
  configured: boolean;
  sync: SyncStatus;
  signIn(email: string, password: string): Promise<{ error: string | null }>;
  signUp(email: string, password: string): Promise<{ error: string | null; needsConfirmation: boolean }>;
  signOut(): Promise<void>;
  syncNow(): Promise<void>;
  clearLocalData(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: false,
  configured: false,
  sync: { state: 'disabled', lastSyncedAt: null, pending: 0 },
  signIn: async () => ({ error: 'Sync is not configured.' }),
  signUp: async () => ({ error: 'Sync is not configured.', needsConfirmation: false }),
  signOut: async () => {},
  syncNow: async () => {},
  clearLocalData: async () => {},
});

/** Supabase's messages are aimed at developers; these are what a rider sees. */
function readableAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'That email and password don’t match an account.';
  if (m.includes('email not confirmed')) return 'Check your inbox and confirm your email first.';
  if (m.includes('user already registered')) return 'That email already has an account — sign in instead.';
  if (m.includes('password should be at least')) return 'Use a password of at least 6 characters.';
  if (m.includes('unable to validate email') || m.includes('invalid email')) return 'That doesn’t look like a valid email address.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts — wait a minute and try again.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'Couldn’t reach the server. Check your connection.';
  return message;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [sync, setSync] = useState<SyncStatus>(getSyncStatus);

  useEffect(() => {
    const unsubscribe = subscribeSyncStatus(setSync);
    void hydrateSyncStatus();
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    /**
     * A newly signed-in user's local rows have never been pushed, so queue all
     * of them once — that's what merges a month of anonymous use into the
     * account instead of discarding it (§5.7). Keyed on the user id so it
     * happens on a real account switch, not on every cold start.
     */
    const onSignedIn = async (userId: string) => {
      // Ordering matters: a resync that runs before the localStorage import
      // would queue only the rows that existed at that instant, leaving the
      // migrated ones stranded until some later unrelated mutation. Idempotent,
      // so calling it here as well as at boot is free.
      await migrateFromLocalStorage().catch(() => {});
      const last = await getMeta(META_SYNCED_USER);
      if (last !== userId) {
        await enqueueFullResync();
        await setMeta(META_SYNCED_USER, userId);
      }
      void syncNow();
    };

    // The SDK is a lazily-imported chunk, so everything below waits on it. The
    // app is already interactive by then — this only gates the account UI.
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    void getSupabase().then(client => {
      // Unmounted (or the chunk failed) — don't subscribe to something nothing
      // will tear down.
      if (cancelled || !client) {
        if (!cancelled) setLoading(false);
        return;
      }

      // Whether this tab already believes someone is signed in. It is the guard
      // that keeps `signed_in` (§5.8) a count of sign-*ins* rather than of
      // sessions noticed: supabase-js re-emits `SIGNED_IN` when a session is
      // recovered — another tab signing in, a token refresh on some versions, a
      // window regaining focus — and counting those would report a rider who
      // signed in once in January as signing in every morning since.
      let hadSession = false;

      // getSession resolves from local storage first, so this doesn't wait on
      // the network to decide whether the rider is signed in.
      void client.auth.getSession().then(({ data }) => {
        if (cancelled) return;
        setSession(data.session);
        setLoading(false);
        // A restored session is not a sign-in. Recording it here is how this
        // metric would have quietly become "app opens, by signed-in riders".
        if (data.session) hadSession = true;
        if (data.session?.user.id) void onSignedIn(data.session.user.id);
        else void syncNow();
      });

      const { data: authSub } = client.auth.onAuthStateChange((event, next) => {
        if (cancelled) return;
        setSession(next);
        setLoading(false);
        if (event === 'SIGNED_IN' && next?.user.id) {
          // The count, and nothing about who: no user id, no email, no
          // `auth.uid()`. The events table has no `user_id` column to put one
          // in, and that is the point rather than an omission (§5.8).
          if (!hadSession) track('signed_in');
          void onSignedIn(next.user.id);
        }
        if (event === 'SIGNED_OUT') void syncNow();
        hadSession = next != null;
      });
      unsubscribe = () => authSub.subscription.unsubscribe();
    });

    const stopTriggers = startSyncTriggers();
    return () => {
      cancelled = true;
      unsubscribe?.();
      stopTriggers();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user: session?.user ?? null,
    session,
    loading,
    configured: isSupabaseConfigured,
    sync,
    async signIn(email, password) {
      const client = await getSupabase();
      if (!client) return { error: 'Sync is not configured.' };
      const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
      return { error: error ? readableAuthError(error.message) : null };
    },
    async signUp(email, password) {
      const client = await getSupabase();
      if (!client) return { error: 'Sync is not configured.', needsConfirmation: false };
      const { data, error } = await client.auth.signUp({ email: email.trim(), password });
      if (error) return { error: readableAuthError(error.message), needsConfirmation: false };
      // With email confirmation on, signUp returns a user but no session — the
      // rider is not signed in yet and needs to be told, not left on a screen
      // that looks like it worked.
      return { error: null, needsConfirmation: data.session == null };
    },
    async signOut() {
      const client = await getSupabase();
      if (!client) return;
      // Local data deliberately survives: signing out of a transit app should
      // not wipe your favourite stations. "Clear local data" is the separate,
      // explicit action for that.
      await client.auth.signOut();
    },
    async syncNow() {
      await syncNow();
    },
    async clearLocalData() {
      await clearLocalUserData();
    },
  }), [session, loading, sync]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
