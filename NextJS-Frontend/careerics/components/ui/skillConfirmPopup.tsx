"use client";
import React, { useState } from "react";
import { Button } from "./button";
import { isHiddenComputerScienceOption } from "@/lib/hidden-ui-items";

type SkillConfirmOption = {
  id: string;
  label: string;
};

interface SkillConfirmPopupProps {
  skillName: string;
  isLoading?: boolean;
  onConfirm: (questions: number) => void;
  onCancel: () => void;
  testCode: string;
  skillOptions?: SkillConfirmOption[];
  selectedSkillId?: string;
  onSkillChange?: (id: string) => void;
}

export default function SkillConfirmPopup({
  skillName,
  isLoading = false,
  onConfirm,
  onCancel,
  testCode,
  skillOptions,
  selectedSkillId,
  onSkillChange,
}: SkillConfirmPopupProps) {
  const visibleSkillOptions = skillOptions?.filter((opt) => !isHiddenComputerScienceOption(opt));
  const hasSkillSelector = Boolean(visibleSkillOptions?.length && onSkillChange);
  const [questions, setQuestions] = useState("");

  const numericValue = Number(questions);
  const isValid =
    questions !== "" && numericValue >= 5 && numericValue <= 20;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Start skill assessment confirmation"
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
        zIndex: 1000,
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          backgroundColor: "var(--light-green)",
          width: "26rem",
          padding: "4vh",
          borderRadius: "40px",
          position: "relative",
          display: "flex",
          flexDirection: "column",
          gap: "2vh",
          fontFamily: "var(--font-nova-square)",
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
            }}
          >
            Customize Your Assessment
          </h2>
          <img
            onClick={onCancel}
            src="/global/close.svg"
            alt="Close popup"
            style={{
              width: "2rem",
              height: "2rem",
              filter: "invert(1)",
              cursor: "pointer",
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

        <div
          style={{
            display: "flex",
            width: "100%",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <p style={{ marginRight: "1rem", whiteSpace: "nowrap" }}>
            Assessment Code:
          </p>
          <div
            style={{
              paddingInline: "1rem",
              paddingBlock: "0.5rem",
              backgroundColor: "var(--medium-grey)",
              borderRadius: "2vh",
              color: "white",
              width: "12rem",
            }}
          >
            <p>{testCode}</p>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            width: "100%",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <p style={{ marginRight: "1rem", whiteSpace: "nowrap" }}>
            Skill Chosen:
          </p>
          {hasSkillSelector ? (
            <select
              value={selectedSkillId || visibleSkillOptions?.[0]?.id || ""}
              onChange={(event) => onSkillChange?.(event.target.value)}
              style={{
                paddingInline: "1rem",
                paddingBlock: "0.5rem",
                backgroundColor: "var(--medium-grey)",
                borderRadius: "2vh",
                color: "white",
                width: "12rem",
                border: "none",
                outline: "none",
                fontFamily: "inherit",
                cursor: "pointer",
              }}
            >
              {visibleSkillOptions?.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <div
              style={{
                paddingInline: "1rem",
                paddingBlock: "0.5rem",
                backgroundColor: "var(--medium-grey)",
                borderRadius: "2vh",
                color: "white",
                width: "12rem",
              }}
            >
              <p style={{ margin: 0 }}>{skillName}</p>
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            width: "100%",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <p style={{ marginRight: "1rem", whiteSpace: "nowrap" }}>
            No. of Questions:
          </p>

          <input
            type="text"
            inputMode="numeric"
            placeholder="Enter number (5-20)"
            value={questions}
            onChange={(e) => {
              const value = e.target.value;

              if (!/^\d*$/.test(value)) return;

              if (value === "") {
                setQuestions("");
                return;
              }

              const num = Number(value);

              if (num <= 20) {
                setQuestions(value);
              }
            }}
            onBlur={() => {
              if (questions === "") return;

              let num = Number(questions);

              if (num < 5) num = 5;
              if (num > 20) num = 20;

              setQuestions(String(num));
            }}
            style={{
              paddingInline: "1rem",
              paddingBlock: "0.5rem",
              backgroundColor: "white",
              borderRadius: "2vh",
              color: "black",
              width: "12rem",
              border: "none",
              outline: "none",
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            width: "100%",
            alignItems: "center",
            gap: "0.9rem",
          }}
        >
          <Button
            onClick={onCancel}
            variant="popup-inverted"
            style={{
              flex: "1 1 0",
              minWidth: 0,
              height: "auto",
              paddingBlock: "0.95rem",
              paddingInline: "0.9rem",
              fontSize: "0.95rem",
              lineHeight: 1.2,
              textAlign: "center",
              whiteSpace: "nowrap",
            }}
          >
            Cancel
          </Button>

          <Button
            onClick={() => onConfirm(numericValue)}
            disabled={!isValid || isLoading}
            variant="popup"
            style={{
              flex: "1 1 0",
              minWidth: 0,
              height: "auto",
              paddingBlock: "0.95rem",
              paddingInline: "0.9rem",
              fontSize: "0.95rem",
              lineHeight: 1.2,
              textAlign: "center",
              whiteSpace: "nowrap",
            }}
          >
            {isLoading ? "Starting..." : "Start Assessment"}
          </Button>
        </div>
      </div>
    </div>
  );
}
