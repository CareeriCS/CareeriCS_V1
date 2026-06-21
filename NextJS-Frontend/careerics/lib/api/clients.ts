/**
 * Singleton API client instances.
 *
 * The frontend currently talks to FastAPI for backend data and Supabase for auth.
 * We expose both a REST HttpClient and a GraphQL client for FastAPI.
 * Token injection happens via the `onRequest` interceptor so every
 * outgoing call automatically includes the current auth token.
 */

import { publicConfig } from "@/config";
import { HttpClient } from "./http-client";
import { GraphQLClient } from "./graphql-client";
import { getAuthToken } from "@/lib/auth/token";

const DEFAULT_FASTAPI_TIMEOUT_MS = 300_000;

function getAppOrigin(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  const nextAuthUrl = process.env.NEXTAUTH_URL?.trim();
  if (nextAuthUrl) {
    return nextAuthUrl.replace(/\/+$/, "");
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    return vercelUrl.startsWith("http") ? vercelUrl.replace(/\/+$/, "") : `https://${vercelUrl}`;
  }

  return "http://localhost:3000";
}

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function parseFastApiTimeoutMs(): number {
  const value = Number.parseInt(process.env.NEXT_PUBLIC_FASTAPI_TIMEOUT_MS ?? "", 10);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_FASTAPI_TIMEOUT_MS;
}

function resolveFastApiBaseUrl(value: string): string {
  if (isAbsoluteUrl(value)) {
    return value.replace(/\/+$/, "");
  }

  return `${getAppOrigin()}${value}`;
}

function isUsingFastApiProxy(baseUrl: string): boolean {
  return !isAbsoluteUrl(baseUrl);
}

// Shared interceptor that injects the bearer token.
async function withAuth(init: RequestInit): Promise<RequestInit> {
  const token = await getAuthToken();
  if (token) {
    init.headers = {
      ...init.headers,
      Authorization: `Bearer ${token}`,
    };
  }
  return init;
}

function createFastApiAuthHandler(baseUrl: string) {
  return async (init: RequestInit): Promise<RequestInit> => {
    // In proxy mode the browser talks to same-origin Next.js, so cookies are
    // enough and the proxy adds Authorization upstream. Direct-to-FastAPI mode
    // needs an explicit bearer token because the browser is now cross-origin.
    if (typeof window !== "undefined" && isUsingFastApiProxy(baseUrl)) {
      return init;
    }

    return withAuth(init);
  };
}

export const fastapiApi = new HttpClient({
  baseUrl: resolveFastApiBaseUrl(publicConfig.fastapiUrl),
  onRequest: createFastApiAuthHandler(publicConfig.fastapiUrl),
  timeout: parseFastApiTimeoutMs(),
  next: { revalidate: 0 },
});

export const fastapiGraphql = new GraphQLClient({
  baseUrl: resolveFastApiBaseUrl(publicConfig.fastapiGraphqlUrl),
  onRequest: createFastApiAuthHandler(publicConfig.fastapiGraphqlUrl),
});
