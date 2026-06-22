export const DEFAULT_POST_AUTH_PATH = "/features/home";

const PENDING_POST_AUTH_REDIRECT_STORAGE_KEY = "careerics:pending-post-auth-redirect";

export function getSafePostAuthPath(candidate?: string | null): string | null {
  if (!candidate) {
    return null;
  }

  const trimmedCandidate = candidate.trim();
  if (!trimmedCandidate.startsWith("/") || trimmedCandidate.startsWith("//")) {
    return null;
  }

  if (trimmedCandidate.startsWith("/auth/")) {
    return null;
  }

  return trimmedCandidate;
}

export function resolvePostAuthPath(options?: {
  redirect?: string | null;
  callbackUrl?: string | null;
}): string {
  return (
    getSafePostAuthPath(options?.redirect) ??
    getSafePostAuthPath(options?.callbackUrl) ??
    DEFAULT_POST_AUTH_PATH
  );
}

export function buildAuthRedirectHref(
  authPath: string,
  redirect?: string | null,
): string {
  const safePath = getSafePostAuthPath(redirect);
  if (!safePath) {
    return authPath;
  }

  const params = new URLSearchParams({ redirect: safePath });
  return `${authPath}?${params.toString()}`;
}

export function rememberPendingPostAuthPath(candidate?: string | null): void {
  if (typeof window === "undefined") {
    return;
  }

  const safePath = getSafePostAuthPath(candidate);
  if (!safePath) {
    window.sessionStorage.removeItem(PENDING_POST_AUTH_REDIRECT_STORAGE_KEY);
    return;
  }

  window.sessionStorage.setItem(PENDING_POST_AUTH_REDIRECT_STORAGE_KEY, safePath);
}

export function consumePendingPostAuthPath(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  const storedValue = getSafePostAuthPath(
    window.sessionStorage.getItem(PENDING_POST_AUTH_REDIRECT_STORAGE_KEY),
  );

  window.sessionStorage.removeItem(PENDING_POST_AUTH_REDIRECT_STORAGE_KEY);
  return storedValue;
}
