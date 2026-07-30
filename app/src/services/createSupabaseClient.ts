import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * The only module that statically imports `@supabase/supabase-js`.
 *
 * It exists to be a dynamic-import boundary. `supabase.ts` imports *this* file
 * lazily, which keeps the 52 KB-gzipped SDK out of the boot bundle (§5.7) and —
 * the reason it's a separate file rather than an inline `import('@supabase/...')`
 * — gives the emitted chunk a name someone can recognise. Importing the package
 * directly names the chunk after its own path, so it lands in the build output
 * and the service-worker precache manifest as `dist-<hash>.js`.
 *
 * Nothing else should import `@supabase/supabase-js` at module scope; doing so
 * pulls it straight back onto the boot path.
 */
export function createSupabaseClient(url: string, anonKey: string): SupabaseClient {
  return createClient(url, anonKey, {
    auth: {
      // The session is restored from localStorage on boot, so a rider who
      // installed the PWA isn't asked to sign in on every cold start.
      persistSession: true,
      autoRefreshToken: true,
      // No OAuth redirect flow is wired yet (email/password only, §5.7), and
      // leaving this on makes the client parse every URL it's handed.
      detectSessionInUrl: false,
    },
  });
}
