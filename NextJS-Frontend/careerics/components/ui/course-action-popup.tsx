"use client";

import { Button } from "./button";

type CourseActionMode = "enroll" | "complete" | "retake";

interface CourseActionPopupProps {
  courseTitle: string;
  courseOrg?: string;
  mode: CourseActionMode;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onContinue?: () => void;
}

export default function CourseActionPopup({
  courseTitle,
  courseOrg,
  mode,
  isLoading = false,
  onConfirm,
  onCancel,
  onContinue,
}: CourseActionPopupProps) {
  const isEnrollMode = mode === "enroll";
  const isCompleteMode = mode === "complete";
  const isRetakeMode = mode === "retake";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={
        isEnrollMode
          ? "Course enrollment confirmation"
          : isCompleteMode
            ? "Course completion confirmation"
            : "Course retake confirmation"
      }
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
        zIndex: 1200,
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
            Courses Details
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
            alignItems: "flex-start",
          }}
        >
          <p style={{ margin: 0, marginRight: "1rem", whiteSpace: "nowrap", paddingBlock: "0.5rem" }}>
            Course Name:
          </p>
          <div
            style={{
              paddingInline: "1rem",
              paddingBlock: "0.5rem",
              backgroundColor: "var(--medium-grey)",
              borderRadius: "2vh",
              color: "white",
            }}
          >
            <p style={{ margin: 0 }}>{courseTitle}</p>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            width: "100%",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <p style={{ margin: 0, paddingTop: "0.5rem" }}>Organization:</p>
          <div
            style={{
              paddingInline: "1rem",
              paddingBlock: "0.5rem",
              backgroundColor: "var(--medium-grey)",
              borderRadius: "2vh",
              color: "white",
            }}
          >
            <p style={{ margin: 0 }}>{courseOrg}</p>
          </div>
        </div>

        {isCompleteMode ? (
          <div
            style={{
              display: "flex",
              width: "100%",
              justifyContent: "flex-start",
              gap: "var(--space-md)",
              alignItems: "center",
            }}
          >
            <Button
              onClick={onConfirm}
              variant="popup-inverted"
              isLoading={isLoading}
              disabled={isLoading}
              style={{
                minWidth: 0,
                flex: 1,
                whiteSpace: "nowrap",
              }}
            >
              Mark as done
            </Button>

            <Button
              onClick={onContinue ?? onCancel}
              variant="popup"
              disabled={isLoading}
              style={{
                minWidth: 0,
                flex: 1,
                whiteSpace: "nowrap",
              }}
            >
              Continue
            </Button>
          </div>
        ) : null}

        {isEnrollMode ? (
          <div
            style={{
              display: "flex",
              width: "100%",
              justifyContent: "flex-start",
              alignItems: "center",
              gap: "var(--space-md)"
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
              Enroll
            </Button>

          </div>
        ) : null}

        {isRetakeMode ? (
          <div
            style={{
              display: "flex",
              width: "100%",
              justifyContent: "flex-start",
              gap: "var(--space-md)",
              alignItems: "center",
            }}
          >
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
              Retake
            </Button>

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
          </div>
        ) : null}
      </div>
    </div>
  );
}
