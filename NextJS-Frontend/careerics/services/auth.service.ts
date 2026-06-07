/**
 * Auth service — wraps Supabase Auth SDK calls.
 *
 * Supabase handles sign-up, login, logout, password reset, and
 * email verification entirely client-side. The `me()` call returns
 * the current authenticated Supabase user mapped to the app's User shape.
 */

import { supabase } from "@/lib/supabase";
import {
  DEFAULT_POST_AUTH_PATH,
  getSafePostAuthPath,
  rememberPendingPostAuthPath,
} from "@/lib/auth/post-auth-redirect";
import {
  GOOGLE_DRIVE_AUTH_CALLBACK_QUERY_PARAM,
  GOOGLE_DRIVE_AUTH_POPUP_QUERY_PARAM,
} from "@/lib/auth/google-drive-signin";
import type { ApiResponse, User } from "@/types";
import type { User as SupabaseAuthUser } from "@supabase/supabase-js";

// ── Payload types ───────────────────────────────────────────────
export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  displayName: string;
}

type GoogleSignInOptions = {
  popup?: boolean;
  googleDriveAuth?: boolean;
};

export interface AuthService {
  signUp: (payload: RegisterPayload) => Promise<{
    user: import("@supabase/supabase-js").User | null;
    session: import("@supabase/supabase-js").Session | null;
  }>;
  signIn: (payload: LoginPayload) => Promise<{
    user: import("@supabase/supabase-js").User | null;
    session: import("@supabase/supabase-js").Session | null;
  }>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  signInWithGoogle: (callbackUrl?: string, options?: GoogleSignInOptions) => Promise<void>;
  createGoogleOAuthUrl: (callbackUrl?: string, options?: GoogleSignInOptions) => Promise<string>;
  me: () => Promise<ApiResponse<User>>;
}

function buildSafeUsername(email: string): string {
  const localPart = (email.split("@")[0] || "").trim().toLowerCase();
  const sanitizedBase = localPart
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  const base = sanitizedBase.slice(0, 20) || "user";
  const suffix = Math.random().toString(36).slice(2, 8);

  return `${base}_${suffix}`;
}

function mapSupabaseUserToAppUser(user: SupabaseAuthUser): User {
  return {
    id: user.id,
    email: user.email ?? "",
    displayName:
      user.user_metadata?.display_name ??
      user.user_metadata?.full_name ??
      user.email ??
      "",
    role: (user.app_metadata?.role as User["role"]) ?? "user",
    avatarUrl: user.user_metadata?.avatar_url ?? undefined,
    createdAt: user.created_at ?? new Date().toISOString(),
    updatedAt: user.updated_at ?? new Date().toISOString(),
  };
}


// ── Service ─────────────────────────────────────────────────────
const GOOGLE_OAUTH_SCOPES = "openid email profile";

const GOOGLE_OAUTH_QUERY_PARAMS = {
  access_type: "offline",
  include_granted_scopes: "true",
  prompt: "consent",
} as const;

function buildGoogleOAuthRedirectUrl(
  callbackPath: string,
  options?: GoogleSignInOptions,
): string {
  const redirectUrl = new URL(`${window.location.origin}/auth/callback`);

  if (!options?.popup && callbackPath !== DEFAULT_POST_AUTH_PATH) {
    redirectUrl.searchParams.set("callbackUrl", callbackPath);
  }

  if (options?.popup) {
    redirectUrl.searchParams.set(GOOGLE_DRIVE_AUTH_POPUP_QUERY_PARAM, "1");
  }

  if (options?.googleDriveAuth) {
    redirectUrl.searchParams.set(GOOGLE_DRIVE_AUTH_CALLBACK_QUERY_PARAM, "1");
  }

  return redirectUrl.toString();
}

export const authService: AuthService = {
  /**
   * Sign up a new user with Supabase.
   * Supabase will send a confirmation email automatically if
   * "Confirm email" is enabled in your Supabase dashboard.
   */
  async signUp({ email, password, displayName }: RegisterPayload) {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedDisplayName = displayName.trim();
    const fallbackName = normalizedEmail.split("@")[0] || "User";
    const username = buildSafeUsername(normalizedEmail);

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        // Store extra profile info in Supabase user_metadata
        data: {
          display_name: normalizedDisplayName || fallbackName,
          full_name: normalizedDisplayName || fallbackName,
          username,
        },
      },
    });

    if (error) {
      if (error.message === "Database error saving new user") {
        throw new Error(
          "We could not create your profile details yet. Please retry, and if it still fails try a different email."
        );
      }

      throw error;
    }

    return data;
  },

  /**
   * Sign in an existing user with email + password.
   * On success Supabase stores the session (access_token + refresh_token)
   * in localStorage automatically.
   */
  async signIn({ email, password }: LoginPayload) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;                     // { user, session }
  },

  /**
   * Sign out the current user — clears the Supabase session
   * from localStorage and invalidates the refresh token.
   */
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async deleteAccount() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const headers: HeadersInit = {};
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }

    const response = await fetch("/api/auth/delete-account", {
      method: "POST",
      headers,
    });

    const payload = await response.json().catch(() => ({} as { detail?: string; success?: boolean }));

    if (response.ok && payload?.success === true) {
      return;
    }

    if (response.ok) {
      throw new Error("Account deletion could not be confirmed.");
    }

    throw new Error(payload?.detail || "Unable to delete account.");
  },

  /**
   * Send a password-reset email. The user clicks the link
   * which redirects to a page where they set a new password.
   */
  async resetPassword(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      // Where Supabase redirects after the user clicks the email link
      redirectTo: `${window.location.origin}/auth/update-password`,
    });
    if (error) throw error;
  },

  /**
   * After the user lands on the reset-password callback page,
   * call this to actually update the password.
   */
  async updatePassword(newPassword: string) {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) throw error;
  },

  /**
   * Sign in with Google OAuth via Supabase.
   * Redirects the browser to Google's consent screen.
   */
  async signInWithGoogle(callbackUrl?: string, options?: GoogleSignInOptions) {
    const callbackPath =
      getSafePostAuthPath(callbackUrl) ?? DEFAULT_POST_AUTH_PATH;
    if (!options?.popup) {
      rememberPendingPostAuthPath(callbackPath);
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: buildGoogleOAuthRedirectUrl(callbackPath, options),
        scopes: GOOGLE_OAUTH_SCOPES,
        queryParams: GOOGLE_OAUTH_QUERY_PARAMS,
      },
    });
    if (error) throw error;
  },

  async createGoogleOAuthUrl(callbackUrl?: string, options?: GoogleSignInOptions) {
    const callbackPath =
      getSafePostAuthPath(callbackUrl) ?? DEFAULT_POST_AUTH_PATH;

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: buildGoogleOAuthRedirectUrl(callbackPath, options),
        scopes: GOOGLE_OAUTH_SCOPES,
        queryParams: GOOGLE_OAUTH_QUERY_PARAMS,
        skipBrowserRedirect: true,
      },
    });

    if (error) throw error;
    if (!data.url) {
      throw new Error("Google sign-in could not be started. Please try again.");
    }

    return data.url;
  },

  /**
   * Read the current authenticated user directly from Supabase.
   */
  async me(): Promise<ApiResponse<User>> {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      return {
        data: null as unknown as User,
        success: false,
        message: error.message,
        errors: [{ code: "AUTH_SESSION_ERROR", message: error.message }],
      };
    }

    if (!session?.user) {
      return {
        data: null as unknown as User,
        success: false,
        message: "No authenticated user found.",
        errors: [{ code: "AUTH_USER_MISSING", message: "No authenticated user found." }],
      };
    }

    return {
      data: mapSupabaseUserToAppUser(session.user),
      success: true,
    };
  },
};
