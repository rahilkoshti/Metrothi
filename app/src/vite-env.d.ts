/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/**
 * Both are optional on purpose — an unconfigured build runs local-only (§5.7),
 * so the types must not claim they're always present.
 *
 * Only ever the **anon / publishable** key here. `VITE_`-prefixed values are
 * inlined into the client bundle, so a `service_role` key in this list would be
 * published to every visitor.
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
