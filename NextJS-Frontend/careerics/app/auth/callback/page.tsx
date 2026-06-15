"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  consumePendingPostAuthPath,
  DEFAULT_POST_AUTH_PATH,
  getSafePostAuthPath,
} from "@/lib/auth/post-auth-redirect";
import {
  GOOGLE_DRIVE_AUTH_CALLBACK_QUERY_PARAM,
  GOOGLE_DRIVE_AUTH_COMPLETED_MESSAGE,
  GOOGLE_DRIVE_AUTH_PENDING_STORAGE_KEY,
  GOOGLE_DRIVE_AUTH_RESULT_STORAGE_KEY,
  type GoogleDriveAuthResultMessage,
  isGoogleDriveAuthCallback,
  isGoogleDrivePopupAuth,
} from "@/lib/auth/google-drive-signin";
import { formatGoogleOAuthErrorMessage } from "@/lib/auth/google-oauth-error";
import { persistGoogleProviderToken } from "@/lib/auth/google-provider-token";
import { setClientToken } from "@/lib/auth/token";

const TOKEN_COOKIE = "careerics_token";
const COOKIE_MAX_AGE_SECONDS = 3600;

function syncTokenCookie(token: string | null) {
  if (token) {
    document.cookie = `${TOKEN_COOKIE}=${token}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
    return;
  }

  document.cookie = `${TOKEN_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

type OAuthHashResult = {
  accessToken?: string;
  refreshToken?: string;
  providerToken?: string;
  providerRefreshToken?: string;
  error?: string;
  errorDescription?: string;
};

function readOAuthHashResult(): OAuthHashResult | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.startsWith("#")
    ? window.location.hash.slice(1)
    : window.location.hash;
  if (!hash) return null;

  const params = new URLSearchParams(hash);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  const providerToken = params.get("provider_token");
  const providerRefreshToken = params.get("provider_refresh_token");
  const error = params.get("error");
  const errorDescription = params.get("error_description");

  if (
    !accessToken &&
    !refreshToken &&
    !providerToken &&
    !providerRefreshToken &&
    !error &&
    !errorDescription
  ) {
    return null;
  }

  return {
    accessToken: accessToken ?? undefined,
    refreshToken: refreshToken ?? undefined,
    providerToken: providerToken ?? undefined,
    providerRefreshToken: providerRefreshToken ?? undefined,
    error: error ?? undefined,
    errorDescription: errorDescription ?? undefined,
  };
}

function closePopupWindow() {
  window.setTimeout(() => {
    window.close();
  }, 50);
}

/**
 * OAuth callback page â€” Supabase redirects here after Google sign-in.
 *
 * The regular sign-in flow stores the Supabase session and redirects back to the app.
 * The Drive popup flow only extracts the Google provider token, reports back to the opener,
 * and avoids touching the main app session.
 */
export default function AuthCallback() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    let redirected = false;
    let profileSynced = false;
    let isDisposed = false;
    let subscription: { unsubscribe: () => void } | null = null;

    const isDriveAuthCallback =
      isGoogleDrivePopupAuth(searchParams.get("popup")) ||
      isGoogleDriveAuthCallback(searchParams.get(GOOGLE_DRIVE_AUTH_CALLBACK_QUERY_PARAM));
    const pendingTargetPath = consumePendingPostAuthPath();
    const targetPath =
      getSafePostAuthPath(searchParams.get("callbackUrl")) ??
      getSafePostAuthPath(searchParams.get("redirect")) ??
      pendingTargetPath ??
      DEFAULT_POST_AUTH_PATH;

    const postDriveAuthResult = (payload: { success: boolean; error?: string; accessToken?: string }) => {
      if (!isDriveAuthCallback) {
        return false;
      }

      const message: GoogleDriveAuthResultMessage = {
        type: GOOGLE_DRIVE_AUTH_COMPLETED_MESSAGE,
        success: payload.success,
        error: payload.error,
        accessToken: payload.accessToken,
        timestamp: Date.now(),
      };

      redirected = true;

      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(message, window.location.origin);
      }

      try {
        window.localStorage.setItem(
          GOOGLE_DRIVE_AUTH_RESULT_STORAGE_KEY,
          JSON.stringify(message),
        );
        window.localStorage.removeItem(GOOGLE_DRIVE_AUTH_PENDING_STORAGE_KEY);
      } catch {
        // postMessage is the primary path; localStorage is only a popup fallback.
      }

      return true;
    };

    const redirectToLoginWithError = (message: string) => {
      if (postDriveAuthResult({ success: false, error: message })) {
        closePopupWindow();
        return;
      }

      const loginUrl = new URLSearchParams();
      loginUrl.set("error", message);
      if (targetPath !== DEFAULT_POST_AUTH_PATH) {
        loginUrl.set("callbackUrl", targetPath);
      }
      router.replace(`/auth/login?${loginUrl.toString()}`);
    };

    const hashResult = readOAuthHashResult();
    const oauthErrorCode = searchParams.get("error") || hashResult?.error || "";
    const oauthErrorDescription =
      searchParams.get("error_description") || hashResult?.errorDescription || "";
    if (oauthErrorCode || oauthErrorDescription) {
      redirectToLoginWithError(
        formatGoogleOAuthErrorMessage({
          error: oauthErrorCode,
          errorDescription: oauthErrorDescription,
        }),
      );
      return;
    }

    const redirectIfNeeded = () => {
      if (redirected) return;
      redirected = true;

      if (postDriveAuthResult({ success: true })) {
        return;
      }

      window.location.replace(targetPath);
    };

    if (isDriveAuthCallback) {
      if (hashResult?.providerToken) {
        postDriveAuthResult({
          success: true,
          accessToken: hashResult.providerToken,
        });
        return;
      }

      const timeoutId = window.setTimeout(() => {
        if (!redirected) {
          redirectToLoginWithError("Google Drive permission was not granted. Please try again.");
        }
      }, 10_000);

      return () => {
        window.clearTimeout(timeoutId);
      };
    }

    const syncProfileAndRedirect = (accessToken: string | null | undefined) => {
      if (profileSynced) return;
      profileSynced = true;

      if (accessToken) {
        setClientToken(accessToken);
        syncTokenCookie(accessToken);
      }

      redirectIfNeeded();
    };

    const loadSupabase = async () => {
      const supabaseModule = await import("@/lib/supabase");
      return supabaseModule.supabase;
    };

    if (hashResult?.accessToken && hashResult?.refreshToken) {
      void loadSupabase()
        .then((supabase) =>
          supabase.auth.setSession({
            access_token: hashResult.accessToken!,
            refresh_token: hashResult.refreshToken!,
          }),
        )
        .then(({ data: { session } }) => {
          if (session?.user?.id && hashResult.providerToken) {
            persistGoogleProviderToken({
              accessToken: hashResult.providerToken,
              refreshToken: hashResult.providerRefreshToken ?? null,
              userId: session.user.id,
            });
          } else if (session?.user?.id && session.provider_token) {
            persistGoogleProviderToken({
              accessToken: session.provider_token,
              refreshToken: session.provider_refresh_token ?? null,
              userId: session.user.id,
            });
          }

          syncProfileAndRedirect(session?.access_token ?? hashResult.accessToken);
        })
        .catch(() => {
          syncProfileAndRedirect(hashResult.accessToken);
        });
      return;
    }

    const timeoutId = window.setTimeout(() => {
      if (!redirected) {
        const timeoutMessage = "Google sign-in timed out. Please try again.";
        redirectToLoginWithError(timeoutMessage);
      }
    }, 10_000);

    void loadSupabase()
      .then((supabase) => {
        if (isDisposed) {
          return;
        }

        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session) {
            if (session.user?.id && session.provider_token) {
              persistGoogleProviderToken({
                accessToken: session.provider_token,
                refreshToken: session.provider_refresh_token ?? null,
                userId: session.user.id,
              });
            }
            window.clearTimeout(timeoutId);
            void syncProfileAndRedirect(session.access_token);
          }
        });

        const authSubscription = supabase.auth.onAuthStateChange(
          (_event, session) => {
            if (session) {
              if (session.user?.id && session.provider_token) {
                persistGoogleProviderToken({
                  accessToken: session.provider_token,
                  refreshToken: session.provider_refresh_token ?? null,
                  userId: session.user.id,
                });
              }
              window.clearTimeout(timeoutId);
              void syncProfileAndRedirect(session.access_token);
            }
          },
        );

        subscription = authSubscription.data.subscription;
      })
      .catch(() => {
        // The timeout fallback will surface the auth failure.
      });

    return () => {
      isDisposed = true;
      window.clearTimeout(timeoutId);
      subscription?.unsubscribe();
    };
  }, [router, searchParams]);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "1rem",
        maxWidth: "24rem",
        color: "#C1CBE6",
      }}
    >
      <svg
        width="56"
        height="56"
        viewBox="0 0 56 56"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <circle
          cx="28"
          cy="28"
          r="20"
          stroke="rgba(255, 255, 255, 0.18)"
          strokeWidth="6"
        />
        <path
          d="M28 8C39.0457 8 48 16.9543 48 28"
          stroke="var(--light-green)"
          strokeWidth="6"
          strokeLinecap="round"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="0 28 28"
            to="360 28 28"
            dur="0.9s"
            repeatCount="indefinite"
          />
        </path>
      </svg>

      <p
        style={{
          margin: 0,
          color: "white",
          fontSize: "1.05rem",
          lineHeight: 1.5,
        }}
      >
        Please wait while we finish your Google sign-in.
      </p>

      <p
        style={{
          margin: 0,
          fontSize: "0.95rem",
          lineHeight: 1.6,
        }}
      >
        We&apos;ll redirect you automatically in a moment.
      </p>
    </div>
  );
}
