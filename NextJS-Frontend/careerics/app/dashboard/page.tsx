"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/providers/auth-provider";
import { authService } from "@/services/auth.service";

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "Unknown error";
}

/**
 * Protected dashboard page — only renders if the user has a valid
 * Supabase session (JWT). Demonstrates:
 *
 * 1. Reading user info from the auth context (extracted from JWT claims)
 * 2. Reading the current authenticated user through the shared auth service
 * 3. Logging out via Supabase
 */
function DashboardContent() {
  const { user, accessToken } = useAuth();
  const router = useRouter();
  const [logoutHover, setLogoutHover] = useState(false);
  const [apiResponse, setApiResponse] = useState<string | null>(null);
  const [apiLoading, setApiLoading] = useState(false);

  async function handleLogout() {
    try {
      await authService.signOut();
      router.push("/auth/login");
    } catch (err: unknown) {
      console.error("Logout failed:", getErrorMessage(err));
    }
  }

  /**
   * Example: read the current authenticated user through authService.me().
   */
  async function handleCallApi() {
    setApiLoading(true);
    setApiResponse(null);
    try {
      const res = await authService.me();
      setApiResponse(JSON.stringify(res, null, 2));
    } catch (err: unknown) {
      setApiResponse(`Error: ${getErrorMessage(err)}`);
    } finally {
      setApiLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--bg-color)",
        color: "white",
        fontFamily: "var(--font-nova-square)",
        padding: "2rem",
      }}
    >
      <h1 style={{ marginBottom: "1.5rem" }}>JWT Info</h1>

      {/* User info from Supabase JWT claims */}
      <div
        style={{
          backgroundColor: "var(--form-grey)",
          borderRadius: "12px",
          padding: "1.5rem",
          marginBottom: "1.5rem",
          maxWidth: "600px",
        }}
      >
        <h3 style={{ marginBottom: "1rem", color: "var(--primary-green)" }}>
          Your Profile (from JWT)
        </h3>
        <p><strong>User ID (sub):</strong> {user?.id}</p>
        <p><strong>Email:</strong> {user?.email}</p>
        <p><strong>Display Name:</strong> {user?.displayName}</p>
        <p><strong>Role:</strong> {user?.role}</p>
      </div>

      {/* Raw JWT for debugging / Postman testing */}
      <div
        style={{
          backgroundColor: "var(--form-grey)",
          borderRadius: "12px",
          padding: "1.5rem",
          marginBottom: "1.5rem",
          maxWidth: "600px",
        }}
      >
        <h3 style={{ marginBottom: "1rem", color: "var(--primary-green)" }}>
          Access Token (JWT)
        </h3>
        <p style={{ fontSize: "0.75rem", color: "var(--text-grey)", marginBottom: "0.5rem" }}>
          Copy this token for authenticated API requests if needed:
          <br />
          <code>Authorization: Bearer &lt;token&gt;</code>
        </p>
        <textarea
          readOnly
          value={accessToken ?? ""}
          style={{
            width: "100%",
            height: "80px",
            backgroundColor: "#1a1a2e",
            color: "#6cf",
            border: "1px solid #333",
            borderRadius: "6px",
            padding: "0.5rem",
            fontFamily: "monospace",
            fontSize: "0.7rem",
            resize: "vertical",
          }}
        />
      </div>

      {/* Test auth service call */}
      <div
        style={{
          backgroundColor: "var(--form-grey)",
          borderRadius: "12px",
          padding: "1.5rem",
          marginBottom: "1.5rem",
          maxWidth: "600px",
        }}
      >
        <h3 style={{ marginBottom: "1rem", color: "var(--primary-green)" }}>
          Test Current User Call
        </h3>
        <button
          onClick={handleCallApi}
          disabled={apiLoading}
          style={{
            padding: "0.6rem 1.5rem",
            borderRadius: "10px",
            border: "none",
            backgroundColor: "var(--primary-green)",
            fontWeight: "bold",
            cursor: apiLoading ? "not-allowed" : "pointer",
            marginBottom: "1rem",
          }}
        >
          {apiLoading ? "Calling..." : "Read current user"}
        </button>
        {apiResponse && (
          <pre
            style={{
              backgroundColor: "#1a1a2e",
              color: "#6cf",
              padding: "1rem",
              borderRadius: "6px",
              fontSize: "0.8rem",
              overflow: "auto",
              maxHeight: "200px",
            }}
          >
            {apiResponse}
          </pre>
        )}
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        style={{
          padding: "0.7rem 2rem",
          borderRadius: "15px",
          border: "none",
          fontFamily: "var(--font-nova-square)",
          backgroundColor: logoutHover ? "#ff4d4f" : "#cc3333",
          color: "white",
          fontWeight: "bold",
          cursor: "pointer",
          transition: "background-color 0.3s, transform 0.2s",
          transform: logoutHover ? "scale(1.05)" : "scale(1)",
        }}
        onMouseEnter={() => setLogoutHover(true)}
        onMouseLeave={() => setLogoutHover(false)}
      >
        Sign Out
      </button>
    </div>
  );
}

/**
 * The page is wrapped in <ProtectedRoute> which redirects to
 * /auth/login if no valid Supabase session exists.
 */
export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
