"use client";
import React from "react";
import { isHiddenComputerScienceOption } from "@/lib/hidden-ui-items";

export type FormField = {
  id: string;
  type: "text" | "email" | "textarea" | "select" | "row";
  placeholder?: string;
  width?: string;
  fields?: FormField[];
  options?: string[];
};

interface DynamicCVFormProps {
  fields: FormField[];
  values: Record<string, string>;
  onChange: (id: string, value: string) => void;
  errors?: Record<string, string>;
}

const inputBaseStyle: React.CSSProperties = {
  width: "100%",
  height: "fit-content",
  paddingBlock: "var(--space-xs)",
  paddingInline: "var(--space-md)",
  borderRadius: "8px",
  border: "1px solid transparent",
  backgroundColor: "white",
  color: "#333",
  fontFamily: "var(--font-nova-square), sans-serif",
  fontSize: "var(--text-sm)",
  outline: "none",
};

const errorTextStyle: React.CSSProperties = {
  color: "var(--light-red)",
  fontSize: "var(--text-xs)",
  fontFamily: "var(--font-jura)",
  marginTop: "6px",
  lineHeight: 1.4,
};

function getFieldStyle(hasError: boolean): React.CSSProperties {
  return hasError
    ? {
        ...inputBaseStyle,
        border: "1px solid var(--light-red)",
        boxShadow: "0 0 0 2px var(--light-red)",
      }
    : inputBaseStyle;
}

export default function DynamicCVForm({
  fields,
  values,
  onChange,
  errors = {},
}: DynamicCVFormProps) {
  const renderField = (field: FormField) => {
    if (field.type === "row") {
      return (
        <div key={field.id} style={{ display: "flex", gap: "var(--space-sm)", width: "100%" }}>
          {field.fields?.map((subField) => (
            <div key={subField.id} style={{ flex: subField.width === "/3" ? 2 : 1 }}>
              {renderField(subField)}
            </div>
          ))}
        </div>
      );
    }

    const currentValue = values[field.id] || "";
    const errorMessage = errors[field.id];
    const errorId = errorMessage ? `${field.id}-error` : undefined;
    const commonProps = {
      id: field.id,
      "data-cv-field-id": field.id,
      "aria-invalid": errorMessage ? true : undefined,
      "aria-describedby": errorId,
    };

    switch (field.type) {
      case "textarea":
        return (
          <div key={field.id}>
            <textarea
              {...commonProps}
              placeholder={field.placeholder || ""}
              value={currentValue}
              onChange={(e) => onChange(field.id, e.target.value)}
              style={{
                ...getFieldStyle(Boolean(errorMessage)),
                paddingTop: "10px",
                resize: "none",
              }}
            />
            {errorMessage ? (
              <p id={errorId} style={errorTextStyle}>
                {errorMessage}
              </p>
            ) : null}
          </div>
        );
      case "select":
        return (
          <div key={field.id}>
            <div style={{ position: "relative", width: "100%" }}>
              <select
                {...commonProps}
                style={{ ...getFieldStyle(Boolean(errorMessage)), appearance: "none" }}
                value={currentValue}
                onChange={(e) => onChange(field.id, e.target.value)}
              >
                <option value="" disabled>
                  {field.placeholder}
                </option>
                {field.options
                  ?.filter((option) => !isHiddenComputerScienceOption(option))
                  .map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
              </select>
              <div
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                  color: "#070707",
                  fontSize: "10px",
                }}
              >
                v
              </div>
            </div>
            {errorMessage ? (
              <p id={errorId} style={errorTextStyle}>
                {errorMessage}
              </p>
            ) : null}
          </div>
        );
      default:
        return (
          <div key={field.id}>
            <input
              {...commonProps}
              type={field.type}
              placeholder={field.placeholder || ""}
              value={currentValue}
              onChange={(e) => onChange(field.id, e.target.value)}
              style={getFieldStyle(Boolean(errorMessage))}
            />
            {errorMessage ? (
              <p id={errorId} style={errorTextStyle}>
                {errorMessage}
              </p>
            ) : null}
          </div>
        );
    }
  };

  return (
    <div
      style={{
        backgroundColor: "#4c4f6d",
        padding: "var(--space-lg)",
        borderRadius: "var(--radius-lg)",
        width: "70%",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
      }}
    >
      {fields.map((field) => renderField(field))}
    </div>
  );
}
