"use client";

import React, { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { useResponsive } from "@/hooks/useResponsive";

interface CustomizeInterviewPopupProps {
  onClose: () => void;
  onStart: (selectedType: string, numberOfQuestions: number) => void;
  options: string[];
  title?: string;
  isSubmitting?: boolean;
  isLoadingOptions?: boolean;
  errorMessage?: string | null;
  initialValue?: string;
}

export default function CustomizeInterviewPopup({
  onClose,
  onStart,
  options,
  title = "Technical Interview Details",
  isSubmitting = false,
  isLoadingOptions = false,
  errorMessage = null,
  initialValue = "",
}: CustomizeInterviewPopupProps) {
  const [selectedRole, setSelectedRole] = useState(initialValue);
  const [numberOfQuestions, setNumberOfQuestions] = useState(3);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const { isLarge, isSmall } = useResponsive();

  useEffect(() => {
    setSelectedRole(initialValue);
  }, [initialValue]);

  const sortedOptions = useMemo(
    () => [...options].sort((left, right) => left.localeCompare(right)),
    [options]
  );

  const handleStart = () => {
    if (!selectedRole || isSubmitting) {
      return;
    }

    onStart(selectedRole, numberOfQuestions);
  };

  return (
    <div
       role="dialog"
      aria-modal="true"
      aria-label="Replace bookmark"
      onClick={onClose}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: isLarge ? "110vw" : isSmall ? "100vw" : "100vw",       
        height: "100vh",
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1100,
        padding: "16px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "min(92vw, 560px)",
          borderRadius: "24px",
          backgroundColor: "var(--light-green)",
          padding: "24px 20px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          color: "#111827",
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.35)",
          fontFamily: "var(--font-nova-square)",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
          }}
        >
          <h2
            style={{
              fontSize: "32px",
              margin: 0,
              color: "#000",
              flex: 1,
            }}
          >
            {title}
          </h2>

          <img
            src="/global/close.svg"
            alt="Close popup"
            onClick={onClose}
            style={{
              width: "2rem",
              height: "2rem",
              filter: "invert(1)",
              cursor: "pointer",
              flexShrink: 0,
            }}
          />
        </div>

        <hr
          style={{
            border: "none",
            borderTop: "2px solid rgb(0, 0, 0)",
            margin: 0,
          }}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "18px",
          }}
        >
          <span
            style={{
              fontSize: "20px",
              fontWeight: 500,
              paddingTop: "10px",
            }}
          >
            Career / Role:
          </span>

          <div style={{ position: "relative", width: "260px" }}>
            <div
              onClick={() => setIsDropdownOpen((open) => !open)}
              style={{
                backgroundColor: "white",
                padding: "12px 20px",
                borderRadius: "14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                cursor: "pointer",
                fontSize: "16px",
                width: "100%",
                boxSizing: "border-box",
                minHeight: "52px",
              }}
            >
              <span
                style={{
                  color: selectedRole ? "#000" : "#8E8E8E",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {selectedRole || "Click to choose"}
              </span>

              <span
                style={{
                  transition: "0.2s",
                  transform: isDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                }}
              >
                v
              </span>
            </div>

            {isDropdownOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "110%",
                  left: 0,
                  width: "100%",
                  backgroundColor: "white",
                  borderRadius: "14px",
                  boxShadow: "0 10px 20px rgba(0,0,0,0.1)",
                  overflow: "hidden",
                  zIndex: 10,
                  maxHeight: "230px",
                  overflowY: "auto",
                }}
              >
                {sortedOptions.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => {
                      setSelectedRole(role);
                      setIsDropdownOpen(false);
                    }}
                    style={{
                      width: "100%",
                      padding: "12px 20px",
                      cursor: "pointer",
                      border: "none",
                      borderBottom: "1px solid #f0f0f0",
                      color: "#333",
                      fontSize: "14px",
                      textAlign: "left",
                      backgroundColor:
                        selectedRole === role ? "#eef6d0" : "white",
                      fontFamily: "inherit",
                    }}
                  >
                    {role}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "18px",
          }}
        >
          <span
            style={{
              fontSize: "20px",
              fontWeight: 500,
              whiteSpace: "nowrap",
            }}
          >
            Number of Questions:
          </span>

          <input
            type="number"
            min={3}
            max={10}
            value={numberOfQuestions}
            onChange={(event) => {
              const value = Number(event.target.value);

              if (value < 3) {
                setNumberOfQuestions(3);
                return;
              }

              if (value > 10) {
                setNumberOfQuestions(10);
                return;
              }

              setNumberOfQuestions(value);
            }}
            style={{
              width: "260px",
              minHeight: "52px",
              backgroundColor: "white",
              border: "none",
              borderRadius: "14px",
              padding: "12px 20px",
              boxSizing: "border-box",
              fontSize: "16px",
              fontFamily: "inherit",
              color: "#000",
              outline: "none",
            }}
          />
        </div>

        <p
          style={{
            margin: 0,
            color: "#111827",
            fontSize: "15px",
            lineHeight: 1.5,
          }}
        >
          {isLoadingOptions
            ? "Loading the available technical interview careers..."
            : "We'll load the technical question bank for the exact career you choose here."}
        </p>

        {errorMessage ? (
          <p
            style={{
              margin: 0,
              color: "#7f1d1d",
              fontSize: "14px",
            }}
          >
            {errorMessage}
          </p>
        ) : null}

        <div
          style={{
            display: "flex",
            width: "100%",
            alignItems: "center",
            gap: "0.9rem",
          }}
        >
          <Button
            onClick={onClose}
            variant="popup-inverted"
            style={{
              minWidth: 0,
              flex: 1,
              whiteSpace: "nowrap",
            }}
          >
            Cancel
          </Button>

          <Button
            type="button"
            variant="popup"
            onClick={handleStart}
            disabled={!selectedRole || isSubmitting || isLoadingOptions}
            style={{
              minWidth: 0,
              flex: 1,
              whiteSpace: "nowrap",
            }}
          >
            {isSubmitting
              ? "Starting..."
              : isLoadingOptions
              ? "Loading..."
              : "Start Interview"}
          </Button>
        </div>
      </div>
    </div>
  );
}