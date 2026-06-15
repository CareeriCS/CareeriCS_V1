"use client";
import { useState } from "react";
import Link from "next/link";
import { authService } from "@/services/auth.service";
import AuthLayout from "@/app/auth/layout";
import InputField from "@/components/ui/input-field";
import { Button } from "@/components/ui/button"
import AlertMessage from "@/components/ui/alert-message";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Failed to send reset email.";
}


/**
 * Reset password page — sends a password-reset email via Supabase.
 *
 * Supabase emails the user a magic link. When clicked, the user lands
 * on /auth/update-password where they can set a new password.
 */
export default function ResetPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      await authService.resetPassword(email);
      setSuccess("Check your email for a password reset link.");
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    
      <form
        onSubmit={handleReset}
      >

        <AlertMessage message={error} type="error" />
        <AlertMessage message={success} type="success" />

        {!success &&
        <p
        style={{
          whiteSpace: "pre-line",
            color: "#c5c5c5",
            fontSize: "var(--text-base)",
            marginBottom:"var(--space-md)",
          }}
          >
          Enter your email and we’ll send you <br/> link to reset your password
        </p>
        }

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
       
        <Button
        size="lg"
        >
          {loading ? "Sending..." : "Send Reset Link"}
        </Button>
      </form>
  );
}
