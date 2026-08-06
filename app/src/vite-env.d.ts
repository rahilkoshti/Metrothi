/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/**
 * The two Supabase values are optional on purpose — an unconfigured build runs
 * local-only (§5.7), so the types must not claim they're always present.
 *
 * Only ever the **anon / publishable** key here. `VITE_`-prefixed values are
 * inlined into the client bundle, so a `service_role` key in this list would be
 * published to every visitor.
 *
 * `VITE_APP_VERSION` is **not** optional, and is the one value here that never
 * comes from a `.env`: `vite.config.ts` reads `package.json` and injects it via
 * `define`, so every build through this config has it. Declared because three
 * modules read it — `analytics.ts`, `catalog.ts` and the version line on `/you`
 * — and without a declaration each was leaning on the index signature
 * `vite/client` merges in, which types it `any` and pushed every caller into
 * its own cast or fallback.
 */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_APP_VERSION: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
