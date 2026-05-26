
"use client";
import { useResponsive } from "@/hooks/useResponsive";
import React, { ReactNode } from "react";
import { useMemo, useEffect, useState } from "react";

export const CareerCardsContainer = ({
    children,
    style,
    isScrollable = false,
    Title = "Your Careers",
    columns = 3,
    type = "home",
}: {
    children: React.ReactNode;
    style?: React.CSSProperties;
    isScrollable?: boolean;
    Title?: string;
    columns?: number;
    type?: string;
}) => {

    const { isLarge, isMedium, isSmall, width } = useResponsive();

    const [startIndex, setStartIndex] = useState(0);

    const cards = React.Children.toArray(children);

    const shouldScroll =
        isScrollable || cards.length > columns;

    const maxStartIndex = Math.max(
        0,
        cards.length - columns,
    );

    const safeStartIndex = Math.min(
        startIndex,
        maxStartIndex,
    );

    const visibleCards = useMemo(() => {
        if (!shouldScroll) return cards;
        if (type != "home" && !isLarge) {
            return cards.slice(
                safeStartIndex,
                safeStartIndex + columns * 2,
            );
        }
        else {
            return cards.slice(
                safeStartIndex,
                safeStartIndex + columns,
            );
        }

    }, [
        cards,
        shouldScroll,
        safeStartIndex,
        columns,
    ]);

    const updateIndex = (step: number) => {
        setStartIndex((prev) =>
            Math.min(
                Math.max(prev + step, 0),
                maxStartIndex,
            ),
        );
    };

    const gridRows =
        type !== "home" && !isLarge
            ? "repeat(2, minmax(0, 1fr))"
            : "1fr";

    return (
        <div
            style={{
                backgroundColor: "var(--medium-blue)",
                color: "white",
                minWidth: 0,
                minHeight: 0,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                justifyContent: "flex-start",
                paddingBlock: "var(--space-lg)",
                paddingLeft:"var(--space-lg)",
                paddingRight: shouldScroll ? 0 : "var(--space-lg)",
                gap: isLarge ? "var(--space-md)" : "var(--space-lg)",
                borderRadius: "var(--radius-xl)",
                ...style,
            }}
        >
            {/* Title */}
            <h3
                style={{
                    fontSize: "var(--text-md)",
                }}
            >
                {Title}
            </h3>

            <div
                style={{
                    display: "flex",
                    width: "100%",
                    height: "100%",

                    // Fill available space without breaking layout
                    minHeight: 0,
                    minWidth: 0,

                    alignItems: "stretch",
                    justifyContent: "flex-start",
                    overflow: "hidden"
                }}
            >
                {/* Cards */}
                <div
                    style={{
                        width: "100%",
                        height: "100%",
                        minHeight: 0,
                        minWidth: 0,
                        display: "grid",
                        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                        gridTemplateRows: gridRows,
                        gap: "var(--space-md)",
                        alignItems:"center",
                    }}
                >
                    {visibleCards}
                </div>

                {/* Arrows */}
                {shouldScroll && (
                    <div
                        style={
                            {
                                display: "flex",
                                flexDirection: "column",
                                userSelect: "none",
                                width: "var(--space-xl)",
                                marginLeft: "auto",
                                height: "100%",
                                justifyContent: "center",
                                alignItems: "center",
                                gap: "var(--space-md)",
                            }
                        }
                    >
                        <Arrow
                            direction="prev"
                            onClick={() => updateIndex(-columns)}
                            disabled={safeStartIndex === 0}
                        />

                        <Arrow
                            direction="next"
                            onClick={() => updateIndex(columns)}
                            disabled={
                                safeStartIndex >= maxStartIndex
                            }
                        />
                    </div>
                )}

            </div>
        </div >
    );
};

const Arrow = ({
    direction,
    onClick,
    disabled,
}: {
    direction: "prev" | "next";
    onClick: () => void;
    disabled?: boolean;
}) => {
    const rotation =
        direction === "prev"
            ? "rotate(180deg)"
            : "rotate(0deg)";

    return (
        <div
            onClick={!disabled ? onClick : undefined}
            style={{
                fontSize: "var(--icon-xs)",
                fontFamily: "var(--font-jura)",
                transform: rotation,
                opacity: disabled ? 0.3 : 1,
                cursor: disabled
                    ? "not-allowed"
                    : "pointer",
                pointerEvents: disabled
                    ? "none"
                    : "auto",
                transition: "0.2s ease",
            }}
        >
            ❯
        </div>
    );
};