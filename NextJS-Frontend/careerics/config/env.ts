/**
 * Centralised, type-safe environment configuration.
 *
 * - Server-only vars (no NEXT_PUBLIC_ prefix) are only accessible in
 *   Server Components, Route Handlers, and middleware.
 * - Client vars are prefixed with NEXT_PUBLIC_.
 *
 * Fail-fast: missing required vars throw at import time in production.
 */

const isServer = typeof window === "undefined";

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value ?? "";
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function toFastApiGraphqlUrl(baseUrl: string): string {
  const normalizedBaseUrl = trimTrailingSlash(baseUrl);
  const rootBaseUrl = normalizedBaseUrl.endsWith("/api")
    ? normalizedBaseUrl.slice(0, -4)
    : normalizedBaseUrl;

  return `${rootBaseUrl}/graphql`;
}

// ──────────────────────────────────────────────
// Public (client-safe) config
// ──────────────────────────────────────────────
export const publicConfig = {
  fastapiUrl: process.env.NEXT_PUBLIC_FASTAPI_URL ?? "/api/fastapi",
  fastapiGraphqlUrl:
    process.env.NEXT_PUBLIC_FASTAPI_GRAPHQL_URL ?? "/api/fastapi/graphql",
  enableGraphql: process.env.NEXT_PUBLIC_ENABLE_GRAPHQL === "true",

  // ── Supabase (client-safe — protected by RLS on the server) ──
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
} as const;

// ──────────────────────────────────────────────
// Server-only config (never leaked to the bundle)
// ──────────────────────────────────────────────
export const serverConfig = isServer
  ? (() => {
      const fastapiUrl = requireEnv("FASTAPI_URL");

      return {
        fastapiUrl,
        fastapiGraphqlUrl: toFastApiGraphqlUrl(fastapiUrl),
        authSecret: requireEnv("NEXTAUTH_SECRET"),
        authUrl: requireEnv("NEXTAUTH_URL"),
      };
    })()
  : undefined;

export type ServerConfig = NonNullable<typeof serverConfig>;
