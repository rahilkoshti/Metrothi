import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase client (PRD §5.7).
 *
 * **Loaded on demand, never on the boot path.** `@supabase/supabase-js` is 104 KB
 * raw / 26 KB gzipped, and nothing in the first frame of a map-first app needs
 * it: the map, the nearest station and the departure board are all local. Sync is
 * a background concern and the account UI lives behind the `/you` route, so the
 * SDK is dynamically imported the first time something actually asks for it —
 * the same argument that keeps 12 KB of reference prose out of the boot path
 * (§5.6), for twice the weight. The `import type` above is erased at build time
 * and costs nothing.
 *
 * Also deliberately nullable. Metrothi must work with no account, no network and
 * **no Supabase project configured at all** — otherwise a fresh clone needs
 * credentials just to look at a timetable. Unconfigured means `null`, every sync
 * path no-ops, and the only visible difference is the account row saying so.
 *
 * The key here is the **anon / publishable** key, which is public by design and
 * ships in the bundle. It is not a secret and is not what protects user data —
 * row-level security is (`supabase/schema.sql`). A `service_role` key must never
 * appear in this file or in any `VITE_`-prefixed variable: Vite inlines those
 * into client JS, so putting it there publishes it to every visitor.
 */

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Whether this build can talk to a backend at all.
 *
 * A plain synchronous boolean on purpose: the UI needs it to decide whether to
 * offer sign-in, and that decision must not drag in the SDK to answer.
 */
export const isSupabaseConfigured = Boolean(url && anonKey);

/** Memoised so concurrent callers share one client and one network fetch. */
let clientPromise: Promise<SupabaseClient | null> | null = null;

export function getSupabase(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured) return Promise.resolve(null);
  clientPromise ??= import('./createSupabaseClient')
    .then(({ createSupabaseClient }) => createSupabaseClient(url as string, anonKey as string))
    .catch(() => {
      // A chunk that won't load (offline first visit, cache miss) must degrade to
      // local-only rather than taking the app down. Cleared so a later call can
      // retry once the network is back.
      clientPromise = null;
      return null;
    });
  return clientPromise;
}

if (!isSupabaseConfigured && import.meta.env.DEV) {
  // Dev only: in production this is a supported configuration, not a problem,
  // and warning about it would be noise in a rider's console.
  console.info(
    '[metrothi] Supabase is not configured — running local-only. ' +
      'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in app/.env.local to enable sync.',
  );
}
