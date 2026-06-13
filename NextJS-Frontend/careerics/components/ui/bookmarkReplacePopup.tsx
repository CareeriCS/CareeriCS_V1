"use client";

import React from "react";
import type { UnifiedBookmarkEntry } from "@/types";
import { Button } from "./button";
interface BookmarkReplacePopupProps {
  incomingTitle: string;
  bookmarks: UnifiedBookmarkEntry[];
  isLoading?: boolean;
  onReplace: (bookmark: UnifiedBookmarkEntry) => void;
  onCancel: () => void;
}

import { useResponsive } from "@/hooks/useResponsive";

export default function BookmarkReplacePopup({
  incomingTitle,
  bookmarks,
  isLoading = false,
  onReplace,
  onCancel,
  
}: BookmarkReplacePopupProps)
 {
    const { isLarge, isSmall } = useResponsive();

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Replace bookmark"
      onClick={onCancel}
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
        onClick={(event) => event.stopPropagation()}
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
              margin: 0,
              fontSize: "22px",
              fontWeight: 400,
              flex: 1,
            }}
          >
            You can save up to 3 bookmarks.
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
              flexShrink: 0,
            }}
          />
        </div>

        <p
          style={{
            margin: 0,
            fontSize: "15px",
            opacity: 0.85,
            lineHeight: 1.5,
          }}
        >
          <span style={{ fontWeight: 700 }}>&quot;{incomingTitle}&quot;</span>{" "}
          will replace one of your current bookmarks. Choose which bookmark to
          replace.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {bookmarks.map((bookmark) => (
            <button
              key={`${bookmark.kind}:${bookmark.entity_id}`}
              type="button"
              onClick={() => onReplace(bookmark)}
              disabled={isLoading}
              style={{
                borderRadius: "12px",
                border: "1px solid #1e2b58",
                backgroundColor: "#f4ffd8",
                padding: "12px 14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                cursor: isLoading ? "not-allowed" : "pointer",
                opacity: isLoading ? 0.7 : 1,
                textAlign: "left",
                gap: "12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    fontSize: "10px",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "#334155",
                  }}
                >
                  {bookmark.kind === "roadmap" ? "Roadmap" : "Career"}
                </span>

                <span
                  style={{
                    fontSize: "15px",
                    fontWeight: 700,
                    color: "#0f172a",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {bookmark.title}
                </span>
              </div>

              <span
                style={{
                  fontSize: "13px",
                  color: "#1e2b58",
                  fontWeight: 700,
                }}
              >
                Replace
              </span>
            </button>
          ))}
        </div>

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
    </div>
  );
}