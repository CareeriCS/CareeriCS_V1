"use client";

import React, { useRef, Children, useEffect, useState } from "react";

type Variant = "vertical" | "horizontal";

type Props = {
  children: React.ReactNode;
  style?: React.CSSProperties;
  Title?: string;
  Columns?: number;
  variant?: Variant;
  centerTitle?: boolean;
  searchBar?: boolean;

  searchValue?: string;
  onSearchChange?: (value: string) => void;
};

export const CardsContainer = ({
  children,
  style,
  Title = "Title",
  Columns = 4,
  variant = "vertical",
  centerTitle = false,
  searchBar = false,
  searchValue = "",
  onSearchChange,
}: Props) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(true);

  const childCount = Children.count(children);
  const isEmpty = childCount === 0;

  const updateScrollState = () => {
    if (!scrollRef.current) return;

    const el = scrollRef.current;

    if (variant === "vertical") {
      setCanScrollPrev(el.scrollTop > 0);
      setCanScrollNext(
        el.scrollTop + el.clientHeight < el.scrollHeight - 1
      );
    }

    if (variant === "horizontal") {
      setCanScrollPrev(el.scrollLeft > 0);
      setCanScrollNext(
        el.scrollLeft + el.clientWidth < el.scrollWidth - 1
      );
    }
  };

  useEffect(() => {
    updateScrollState();

    const el = scrollRef.current;
    if (!el) return;

    el.addEventListener("scroll", updateScrollState);
    window.addEventListener("resize", updateScrollState);

    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [children, variant]);

  const scroll = (direction: "prev" | "next") => {
    if (!scrollRef.current) return;

    if (variant === "vertical") {
      const amount = scrollRef.current.clientHeight;

      scrollRef.current.scrollBy({
        top: direction === "prev" ? -amount : amount,
        behavior: "smooth",
      });
    }

    if (variant === "horizontal") {
      const amount = scrollRef.current.clientWidth;

      scrollRef.current.scrollBy({
        left: direction === "prev" ? -amount : amount,
        behavior: "smooth",
      });
    }

    // ensure state updates after smooth scroll
    setTimeout(updateScrollState, 300);
  };

  return (
    <div
      style={{
        backgroundColor: "var(--medium-blue)",
        borderRadius: "4vh",
        paddingTop: "1rem",
        paddingLeft: "1rem",
        paddingRight: variant === "vertical" ? "1rem" : "0.5rem",
        paddingBottom: variant === "horizontal" ? "1rem" : "0.5rem",
        color: "white",
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: variant === "horizontal" ? "row" : "column",
        overflow: "hidden",
        ...style,
      }}
    >
      {/* Main Content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          overflow: "hidden",
          gap: "0.5rem",
        }}
      >
        {/* Title */}
        <div
          style={{
            display: "flex",
            justifyContent: centerTitle ? "center" : "space-between",
            marginBottom:"0.5rem",
          }}
          >
          <h2
            style={{
              fontSize: "1.2rem",
              textAlign: centerTitle ? "center" : "left",
              fontFamily: "var(--font-nova-square)",
            }}
          >
            {Title}
          </h2>
          {searchBar && (
            <form
              role="search"
              onSubmit={(e) => e.preventDefault()}
              style={{
                width:"fit-content",
                height: "100%",
                paddingInline: "1rem",
                border: "2px solid white",
                display: "flex",
                alignItems: "center",
                borderRadius: "999px",
              }}
            >
              <input
                type="search"
                placeholder="Search..."
                value={searchValue}
                onChange={(e) => onSearchChange?.(e.target.value)}
                style={{
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "white",
                }}
              />
            </form>
          )}
        </div>

        {/* Scroll Area */}
        <div
          style={{
            display: "flex",
            minWidth: 0,
            minHeight: 0,
            flex: 1,
            flexDirection: variant === "vertical" ? "column" : "row",
          }}
        >
          {/* Scroll Content */}
          <div
            ref={scrollRef}
            style={
              variant === "vertical"
                ? {
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "1rem",
                  overflowY: "auto",
                  scrollbarWidth: "none",
                  flex: 1,
                  alignContent: "start",
                }
                : {
                  display: "flex",
                  gap: "1.5rem",
                  overflowX: "auto",
                  scrollbarWidth: "none",
                  flex: 1,
                  alignItems: "center",
                }
            }
          >
            {isEmpty ? (
              <div
                style={{
                  gridColumn:
                    variant === "vertical"
                      ? `span ${Columns}`
                      : undefined,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  height: "100%",
                  width: "100%",
                  fontFamily: "var(--font-jura)",
                  fontSize: "0.95rem",
                  opacity: 0.8,
                }}
              >
                Loading...
              </div>
            ) : (
              children
            )}
          </div>

          {/* Scroll Buttons */}
          <div
            style={
              variant === "vertical"
                ? {
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "1rem",
                  marginTop: "auto",
                  userSelect: "none",
                  marginRight: "0.5rem",
                }
                : {
                  display: "flex",
                  flexDirection: "column",
                  paddingLeft: "0.5rem",
                  userSelect: "none",
                  width: "fit-content",
                  marginLeft: "auto",
                  height: "100%",
                  justifyContent: "center",
                  gap: "0.5rem",
                }
            }
          >
            <Arrow
              direction="prev"
              variant={variant}
              onClick={() => scroll("prev")}
              disabled={!canScrollPrev}
            />

            <Arrow
              direction="next"
              variant={variant}
              onClick={() => scroll("next")}
              disabled={!canScrollNext}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const Arrow = ({
  direction,
  variant,
  onClick,
  disabled,
}: {
  direction: "prev" | "next";
  variant: Variant;
  onClick: () => void;
  disabled?: boolean;
}) => {
  let rotation = "0deg";

  if (variant === "vertical") {
    rotation =
      direction === "prev"
        ? "rotate(-90deg)"
        : "rotate(90deg)";
  }

  if (variant === "horizontal") {
    rotation =
      direction === "prev"
        ? "rotate(180deg)"
        : "rotate(0deg)";
  }

  return (
    <div
      onClick={!disabled ? onClick : undefined}
      style={{
        fontSize: "1rem",
        fontFamily: "var(--font-jura)",
        transform: rotation,
        opacity: disabled ? 0.3 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        pointerEvents: disabled ? "none" : "auto",
        transition: "0.2s ease",
      }}
    >
      ❯
    </div>
  );
};