"use client";
import React from 'react';
import { isHiddenComputerScienceOption } from "@/lib/hidden-ui-items";

export type FormField = {
  id: string;
  type: 'text' | 'email' | 'textarea' | 'select' | 'row';
  placeholder?: string;
  width?: string;
  fields?: FormField[]; 
  options?: string[]; 
};

interface DynamicCVFormProps {
  fields: FormField[];
  // Added these to connect to your main page state
  values: Record<string, string>;
  onChange: (id: string, value: string) => void;
}

const inputBaseStyle: React.CSSProperties = {
  width: "100%",
  height: "fit-content", 
  paddingBlock: "var(--space-xs)",
  paddingInline: "var(--space-md)",
  borderRadius: "8px",
  border: "none",
  backgroundColor: "white",
  color: "#333",
  fontFamily: "var(--font-nova-square), sans-serif",
  fontSize: "var(--text-sm)",
  outline: "none",
};

export default function DynamicCVForm({ fields, values, onChange }: DynamicCVFormProps) {
  const renderField = (field: FormField) => {
    // Current value from state or empty string
    const currentValue = values[field.id] || "";

    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            key={field.id}
            placeholder={field.placeholder || ""}
            value={currentValue}
            onChange={(e) => onChange(field.id, e.target.value)}
            style={{ 
              ...inputBaseStyle, 
              paddingTop: "10px", 
              resize: "none" 
            }}
          />
        );
      case 'select':
        return (
          <div key={field.id} style={{ position: 'relative', width: '100%' }}>
            <select 
              style={{ ...inputBaseStyle, appearance: "none" }}
              value={currentValue}
              onChange={(e) => onChange(field.id, e.target.value)}
            >
              <option value="" disabled>{field.placeholder}</option>
              {field.options?.filter(opt => !isHiddenComputerScienceOption(opt)).map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#070707', fontSize: '10px' }}>
              ▼
            </div>
          </div>
        );
      case 'row':
        return (
          <div key={field.id} style={{ display: "flex", gap: "var(--space-sm)", width: "100%" }}>
            {field.fields?.map((subField) => (
              <div key={subField.id} style={{ flex: subField.width === "/3" ? 2 : 1 }}>
                {renderField(subField)}
              </div>
            ))}
          </div>
        );
      default:
        return (
          <input
            key={field.id}
            type={field.type}
            placeholder={field.placeholder || ""}
            value={currentValue}
            onChange={(e) => onChange(field.id, e.target.value)}
            style={{ ...inputBaseStyle }}
          />
        );
    }
  };

  return (
    <div style={{
      backgroundColor: "#4c4f6d", 
      padding: "var(--space-lg)",       
      borderRadius: "var(--radius-lg)",
      width: "70%",
      display: "flex",
      flexDirection: "column",
      gap: "10px",               
      boxShadow: "0 10px 40px rgba(0,0,0,0.3)"
    }}>
      {fields.map((field) => renderField(field))}
    </div>
  );
}
