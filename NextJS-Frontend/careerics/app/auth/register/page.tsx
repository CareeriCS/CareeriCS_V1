"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authService } from "@/services/auth.service";
import {
  buildAuthRedirectHref,
  resolvePostAuthPath,
} from "@/lib/auth/post-auth-redirect";
import InputField from "@/components/ui/input-field";
import { Button } from "@/components/ui/button"
import AlertMessage from "@/components/ui/alert-message";


/**
 * Registration page  uses Supabase signUp under the hood.
 *
 * Supabase creates the user in its auth.users table and (if enabled
 * in the dashboard) sends a confirmation email. The JWT is issued
 * on sign-up but the user might need to verify their email first
 * depending on your Supabase project settings.
 */
export default function Register() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = resolvePostAuthPath({
    redirect: searchParams.get("redirect"),
    callbackUrl: searchParams.get("callbackUrl"),
  });

  // -- Form state --
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);

  function getPasswordError(value: string): string | null {
    if (value.length === 0) {
      return null;
    }

    if (value.length < 8) {
      return "Password must be at least 8 characters.";
    }

    if (value.length > 72) {
      return "Password must not exceed 72 characters.";
    }

    if (/\s/.test(value)) {
      return "Password cannot contain spaces.";
    }

    if (!/[a-z]/.test(value)) {
      return "Add at least one lowercase letter.";
    }

    if (!/[A-Z]/.test(value)) {
      return "Add at least one uppercase letter.";
    }

    if (!/\d/.test(value)) {
      return "Add at least one number.";
    }

    if (!/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(value)) {
      return "Add at least one special character.";
    }

    return null;
  }

  function validatePassword(value: string): string | null {
    const nextError = getPasswordError(value);
    setPasswordError(nextError);
    return nextError;
  }

  function validateConfirmPassword(
    passwordValue: string,
    confirmValue: string,
    requireValue = false,
  ): string | null {
    if (confirmValue.length === 0) {
      const message = requireValue ? "Please confirm your password." : null;
      setConfirmPasswordError(message);
      return message;
    }

    if (passwordValue !== confirmValue) {
      const message = "Passwords do not match.";
      setConfirmPasswordError(message);
      return message;
    } else {
      setConfirmPasswordError(null);
      return null;
    }
  }
  // -- Handlers --
  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const normalizedDisplayName = displayName.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedDisplayName) {
      setError("Full name is required.");
      return;
    }

    if (!normalizedEmail) {
      setError("Email is required.");
      return;
    }

    // Required check
    if (!password) {
      setPasswordError("Password is required.");
      return;
    }

    const nextPasswordError = validatePassword(password);
    const nextConfirmPasswordError = validateConfirmPassword(
      password,
      confirmPassword,
      true,
    );

    if (nextPasswordError || nextConfirmPasswordError) {
      return;
    }


    setLoading(true);
    try {
      const data = await authService.signUp({
        email: normalizedEmail,
        password,
        displayName: normalizedDisplayName,
      });

      if (data.session) {
        window.location.href = redirectTo;
        return;
      }

      // If Supabase has "Confirm email" enabled, user.identities will be
      // empty until they click the link. Show a success message instead.
      if (data.user) {
        setSuccess("Check your email for a confirmation link, then sign in.");
        setTimeout(() => {
          router.push(buildAuthRedirectHref("/auth/login", redirectTo));
        }, 2500);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Registration failed.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleRegister() {
    try {
      await authService.signInWithGoogle(redirectTo);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Google sign-up failed.";
      setError(message);
    }
  }

  return (
    <form
      onSubmit={handleRegister}
      style={{
        width: "100%",
      }}
    >
      <AlertMessage message={error} type="error" />
      <AlertMessage message={success} type="success" />

      <InputField
        label="Full Name"
        id="reg-displayname"
        name="displayName"
        placeholder="Enter your full name"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        required
      />

      <InputField
        label="Email"
        id="reg-email"
        name="email"
        type="email"
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <InputField
        label="Password"
        id="reg-password"
        name="password"
        type="password"
        placeholder="Enter your password"
        value={password}
        onChange={(e) => {
          const value = e.target.value;
          setPassword(value);
          validatePassword(value);
          validateConfirmPassword(value, confirmPassword);
        }}
        required
        isMargin={!passwordError}
      />

      {passwordError && (
        <p
          style={{
             maxWidth: "35ch",
            fontSize: "var(--text-sm)",
            fontFamily: "var(--font-nova-square)",
            textAlign: "left",
            color: "#ff7979",
            marginTop: "var(--space-xxs)",
          }}
        >
          {passwordError}
        </p>
      )}

      <InputField
        label="Confirm Password"
        id="reg-confirm-password"
        name="confirmPassword"
        type="password"
        placeholder="Confirm your password"
        value={confirmPassword}
        isMargin={!confirmPasswordError}
        onChange={(e) => {
          const value = e.target.value;
          setConfirmPassword(value);
          validateConfirmPassword(password, value);
        }}
        required
      />

      {confirmPasswordError && (
        <p
          style={{
            maxWidth: "35ch",
            fontSize: "var(--text-sm)",
            fontFamily: "var(--font-nova-square)",
            textAlign: "left",
            color: "#ff7979",
            marginBlock: "var(--space-xxs)",
          }}
        >
          {confirmPasswordError}
        </p>
      )}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-xs)",
          marginBottom: "1.5rem",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Button
          type="submit"
          variant="primary"
          style={{
            whiteSpace: "nowrap",
          }}
        >
          {loading ? "Registering..." : "Register"}
        </Button>

        <div
          style={{
            textAlign: "center",
            color: "var(--text-grey)",
            fontFamily: "var(--font-nova-square)",
            fontSize: "clamp(0.8rem, 1.8vw, 1rem)",
          }}
        >
          or
        </div>

        <Button
          type="button"
          variant="secondary"
          onClick={handleGoogleRegister}
          style={{
            whiteSpace: "nowrap",
          }}
        >
          <img
            src="/auth/google.svg"
            alt="Google"
            style={{
              height: "1rem",
              width: "1rem",
            }}
          />
          Continue with Google
        </Button>
      </div>
    </form>
  );
}
