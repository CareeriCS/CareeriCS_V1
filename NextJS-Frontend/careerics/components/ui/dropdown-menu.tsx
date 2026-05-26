"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

interface DropdownOption {
  id: string;
  title: string;
}

interface DropdownProps {
  value: string;
  options: DropdownOption[];
  placeholder?: string;
  onChange: (id: string) => void;
  background?: string;
  maxwidth?: string;
}

export default function CustomDropdown({
  value,
  options,
  placeholder = "Select option",
  onChange,
  background = "transparent",
  maxwidth = "none",
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const selectedOption = options.find((opt) => opt.id === value);

  const toggleDropdown = () => setIsOpen((p) => !p);

  const handleSelect = (id: string) => {
    onChange(id);
    setIsOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div
      ref={dropdownRef}
      style={{
        position: "relative",
        width: "100%",
        maxWidth: maxwidth,
        fontFamily: "var(--font-nova-square)",
      }}
    >
      {/* Trigger */}
      <button
        type="button"
        onClick={toggleDropdown}
        style={{
          width: "100%",
          height: "fit-content",
          borderRadius: "var(--radius-xl)",
          border: "0.5vh solid var(--medium-blue)",
          backgroundColor: background,

          padding: "var(--space-xs) var(--space-lg)",

          fontSize: "var(--text-sm)",
          color: "#000",

          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",

          cursor: "pointer",
          position: "relative",

          boxSizing: "border-box",
        }}
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {selectedOption ? selectedOption.title : placeholder}
        </span>

        <ChevronDown
          size={18}
          style={{
            position: "absolute",
            right: "var(--space-sm)",
            transition: "transform 0.2s ease",
            color: "var(--medium-blue)",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",

            left: 0,
            right: 0,

            width: "100%",
            maxWidth: maxwidth,

            borderRadius: "12px",
            border: "1px solid rgba(0,0,0,0.08)",
            backgroundColor: "#fff",
            boxShadow: "0px 8px 18px rgba(0,0,0,0.08)",
            overflow: "hidden",
            zIndex: 999,

            maxHeight: "min(320px, 40vh)",
            overflowY: "auto",

            scrollbarWidth: "thin",
            scrollbarColor: "rgba(0,0,0,0.2) transparent",
          }}
        >
          {options.length > 0 ? (
            options.map((option) => {
              const isActive = option.id === value;

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => handleSelect(option.id)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    padding: "0.75rem 1rem",

                    backgroundColor: isActive
                      ? "#e8f2ff"
                      : "transparent",

                    border: "none",
                    cursor: "pointer",

                    fontSize: "clamp(0.85rem, 0.6vw, 0.95rem)",
                    color: "#000",

                    transition: "background-color 0.15s ease",
                  }}
                >
                  {option.title}
                </button>
              );
            })
          ) : (
            <div
              style={{
                padding: "0.75rem 1rem",
                color: "#6b7280",
                fontSize: "0.9rem",
              }}
            >
              No options available
            </div>
          )}
        </div>
      )}
    </div>
  );
}