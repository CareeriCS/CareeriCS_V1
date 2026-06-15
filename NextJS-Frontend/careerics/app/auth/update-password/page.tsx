"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { authService } from "@/services/auth.service";
import InputField from "@/components/ui/input-field";
import { Button } from "@/components/ui/button";
import AlertMessage from "@/components/ui/alert-message";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Failed to update password.";
}

/**
 * Update password page — the user lands here after clicking the
 * password-reset link in their email. Supabase automatically
 * exchanges the URL token for a session, so we can call
 * updateUser({ password }) directly.
 */
export default function UpdatePassword() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);

  function validatePassword(value: string) {
    if (value.length === 0) {
      setPasswordError(null);
      return;
    }

    if (value.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      return;
    }

    if (value.length > 72) {
      setPasswordError("Password must not exceed 72 characters.");
      return;
    }

    if (/\s/.test(value)) {
      setPasswordError("Password cannot contain spaces.");
      return;
    }

    if (!/[a-z]/.test(value)) {
      setPasswordError("Add at least one lowercase letter.");
      return;
    }

    if (!/[A-Z]/.test(value)) {
      setPasswordError("Add at least one uppercase letter.");
      return;
    }

    if (!/\d/.test(value)) {
      setPasswordError("Add at least one number.");
      return;
    }

    if (!/[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(value)) {
      return "Add at least one special character.";
    }

    setPasswordError(null);
  }

  function validateConfirmPassword(
    passwordValue: string,
    confirmValue: string
  ) {
    if (confirmValue.length === 0) {
      return;
    }

    if (passwordValue !== confirmValue) {
      setConfirmPasswordError("Passwords do not match.");
    } else {
      setConfirmPasswordError(null);
    }
  }



  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    setLoading(true);
    try {
      await authService.updatePassword(password);
      router.push("/features/home");
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleUpdate}
    >

      <AlertMessage message={error} type="error" />

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
        }}
        required
        style={{
          width: "100%"
        }}
        isMargin={passwordError ? false : true}
      />

      {passwordError && (<p
        style={{
          marginTop: "0px",
          marginRight: "auto",
          position: "relative",
          maxWidth: "35ch",
          fontSize: "2vh",
          fontFamily: "var(--font-nova-square)",
          textAlign: "left",
          color: passwordError ? "#ff7979" : "white",
          marginBlock: "1vh",
        }}
      >
        {passwordError ? passwordError : ""}
      </p>)}

      <InputField
        label="Confirm Password"
        id="reg-confirm-password"
        name="confirmPassword"
        type="password"
        placeholder="Confirm your password"
        value={confirmPassword}
        isMargin={confirmPasswordError ? false : true}
        onChange={(e) => {
          const value = e.target.value;
          setConfirmPassword(value);
          validateConfirmPassword(password, value);
        }}

        required
        style={{
          width: "100%",
        }}
      />

      {confirmPasswordError && (<p
        style={{
          marginTop: "0px",
          marginRight: "auto",
          position: "relative",
          maxWidth: "35ch",
          fontSize: "2vh",
          fontFamily: "var(--font-nova-square)",
          textAlign: "left",
          color: confirmPasswordError ? "#ff7979" : "white",
          marginBlock: "1vh",
        }}
      >
        {confirmPasswordError ? confirmPasswordError : ""}
      </p>)}


      <Button style={{ paddingInline: "14vh", marginTop: "3vh" }}>
        {loading ? "Updating..." : "Update Password"}
      </Button>
    </form>
  );
}
