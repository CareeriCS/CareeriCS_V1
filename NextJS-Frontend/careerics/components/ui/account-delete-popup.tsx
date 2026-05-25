"use client";

import { Button } from "./button";

interface AccountDeletePopupProps {
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function AccountDeletePopup({
  isLoading = false,
  onConfirm,
  onCancel,
}: AccountDeletePopupProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Delete account confirmation"
      onClick={onCancel}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1400,
        padding: "16px",
        boxSizing: "border-box",
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "26rem",
          height: "fit-content",
          borderRadius: "4vh",
          backgroundColor: "var(--light-green)",
          padding: "1rem",
          display: "flex",
          flexDirection: "column",
          color: "#111827",
          boxShadow: "0 16px 48px rgba(0, 0, 0, 0.35)",
          fontFamily: "var(--font-nova-square)",
          gap: "1rem",
        }}
      >
        <div
          style={{
            display: "flex",
            width: "100%",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2
            style={{
              fontSize: "22px",
              fontWeight: 400,
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            Delete Account
          </h2>

          <img
            onClick={onCancel}
            src="/global/close.svg"
            alt="Close popup"
            style={{
              width: "2rem",
              height: "2rem",
              filter: "invert(1)",
              cursor: isLoading ? "not-allowed" : "pointer",
              opacity: isLoading ? 0.6 : 1,
            }}
          />
        </div>

        <div
          style={{
            width: "100%",
            height: "0.1rem",
            backgroundColor: "black",
            borderRadius: "999px",
          }}
        />

        <p style={{ margin: 0 }}>
          This will permanently delete your account and profile data. This action
          cannot be undone.
        </p>

        <div
          style={{
            display: "flex",
            width: "100%",
            justifyContent: "flex-start",
            alignItems: "center",
            gap: "var(--space-md)",
          }}
        >
          <Button
            onClick={onCancel}
            variant="popup-inverted"
            disabled={isLoading}
            style={{
              minWidth: 0,
              flex: 1,
              whiteSpace: "nowrap",
            }}
          >
            Cancel
          </Button>

          <Button
            onClick={onConfirm}
            variant="popup"
            isLoading={isLoading}
            disabled={isLoading}
            style={{
              minWidth: 0,
              flex: 1,
              whiteSpace: "nowrap",
            }}
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
