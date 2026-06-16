"use client";

interface StepCheckboxProps {
  text?: string | null;
  isChecked?: boolean;
  disabled?: boolean;
  isOpen?: boolean;
  onOpen?: () => void;
  onToggle?: () => void;
  children?: React.ReactNode;
}

export default function StepCheckbox({
  text,
  isChecked = false,
  disabled = false,
  isOpen = false,
  onOpen,
  onToggle,
  children,
}: StepCheckboxProps) {
  return (
    <div
      style={{
        border: "1px solid rgba(255, 255, 255, 0.4)",
        marginBottom: "var(--space-xs)",
        overflow: "auto",
        borderRadius: "var(--radius-lg)",
      }}
    >
      <div
        onClick={onOpen}
        style={{
          padding: "var(--space-md)",
          display: "flex",
          justifyContent: "flex-start",
          alignItems: "center",
          gap: "var(--space-md)",
          cursor: "pointer",
          transition: "0.3s",
        }}
      >
        <div
          onClick={(e) => {
            e.stopPropagation();

            if (disabled) return;

            onToggle?.();
          }}
          style={{
            width: "16px",
            height: "16px",
            border: "2px solid white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxSizing: "border-box",
            flexShrink: 0,
          }}
        >
          {isChecked && (
            <div
              style={{
                width: "8px",
                height: "8px",
                backgroundColor: "white",
              }}
            />
          )}
        </div>

        <h3
          style={{
            fontSize: "var(--text-base)",
            color: "white",
            margin: 0,
            lineHeight: 1,
          }}
        >
          {text}
        </h3>

        <span
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: isOpen ? "rotate(180deg)" : "rotate(270deg)",
            width: "var(--icon-sm)",
            height: "var(--icon-sm)",
            marginLeft: "auto",
            transition: "transform 0.2s ease",
            flexShrink: 0,
            flexGrow: 0,
          }}
        >
          <img
            src="/auth/Back Arrow.svg"
            alt="arrow"
            style={{
              width: "100%",
              height: "100%",
              opacity: 0.8,
              pointerEvents: "none",
            }}
          />
        </span>
      </div>

      {isOpen && (
        <div
          style={{
            padding: "var(--space-md)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: "var(--space-md)",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}