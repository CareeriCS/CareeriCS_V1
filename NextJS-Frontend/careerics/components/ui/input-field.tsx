"use client";

import { InputHTMLAttributes } from "react";

interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  id: string;
  isMargin?: boolean;
  layout?: "column" | "row"; // optional variant
}

export default function InputField({
  label,
  id,
  isMargin = true,
  layout = "column",
  style,
  ...inputProps
}: InputFieldProps) {
  const isRow = layout === "row";

  return (
    <div
      style={{
        width: "100%",
        textAlign: "left",
        display: "flex",
        flexDirection: isRow ? "row" : "column",
        alignItems: isRow ? "center" : "flex-start",
        gap: isRow ? "var(--space-md)" : "var(--space-xxs)",
        ...(isMargin && {
          marginBottom: "var(--space-md)",
        }),
      }}
    >
      {label && (
        <label
          htmlFor={id}
          style={{
            fontFamily: "var(--font-nova-square)",
            fontSize: "var(--text-base)",
            color: "white",
            minWidth: isRow ? "10ch" : "auto",
          }}
        >
          {label}
        </label>
      )}

      <input
        id={id}
        {...inputProps}
        style={{
          width: isRow ? "100%" : "100%",
          flex: isRow ? 1 : undefined,
          fontFamily: "var(--font-nova-square)",
          padding: "var(--space-xs)",
          borderRadius: "var(--radius-md)",
          border: "none",
          backgroundColor: "white",
          fontSize: "var(--text-sm)",
          boxSizing: "border-box",
          outline: "none",
          minWidth: 0,
          ...style,
        }}
      />
    </div>
  );
}