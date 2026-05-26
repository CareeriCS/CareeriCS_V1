"use client";

import React, { useRef, Children, useEffect, useState } from "react";

type Props = {
    children: React.ReactNode;
    style?: React.CSSProperties;
    Title?: string;
    centerTitle?: boolean;
    searchBar?: boolean;
    searchValue?: string;
    onSearchChange?: (value: string) => void;
};

export const InlineContainer = ({
    children,
    style,
    Title = "Title",
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
        setCanScrollPrev(el.scrollLeft > 0);
        setCanScrollNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
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
    }, [children]);

    const scroll = (direction: "prev" | "next") => {
        if (!scrollRef.current) return;
        const amount = scrollRef.current.clientWidth;

        scrollRef.current.scrollBy({
            left: direction === "prev" ? -amount : amount,
            behavior: "smooth",
        });

        setTimeout(updateScrollState, 300);
    };

    return (
        <div
            style={{
                backgroundColor: "var(--medium-blue)",
                borderRadius: "var(--radius-xl)",
                paddingBlock: "var(--space-xl)",
                paddingLeft: "var(--space-xl)",
                paddingRight: 0,
                color: "white",
                height: "100%",
                width: "100%",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                gap: "var(--space-md)",
                ...style,
            }}
        >

            {/* Header Title & Search */}
            <div
                style={{
                    display: "flex",
                    justifyContent: centerTitle ? "center" : "space-between",
                }}
            >
                <h2
                    style={{
                        fontSize: "var(--text-md)",
                        textAlign: centerTitle ? "center" : "left",
                        fontFamily: "var(--font-nova-square)",
                    }}
                >
                    {Title}
                </h2>
            </div>

            {/* Scroll Area */}
            <div
                style={{
                    display: "flex",
                    minWidth: 0,
                    flex: 1,
                    maxHeight: "fit-content",
                    flexDirection: "row",
                    height: "fit-content",
                }}
            >
                <div
                    ref={scrollRef}
                    style={{
                        display: "flex",
                        gap: "var(--space-md)",
                        overflowX: "auto",
                        overflowY: "hidden",
                        scrollbarWidth: "none",
                        flex: 1,
                        alignItems: "center",
                    }}
                >
                    {isEmpty ? (
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                                height: "100%",
                                width: "100%",
                                fontFamily: "var(--font-jura)",
                                fontSize: "var(--text-base)",
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
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        userSelect: "none",
                        width: "var(--space-xl)",
                        marginLeft: "auto",
                        height: "100%",
                        justifyContent: "center",
                        alignItems: "center",
                        gap: 0,
                    }}
                >
                    <Arrow
                        direction="prev"
                        onClick={() => scroll("prev")}
                        disabled={!canScrollPrev}
                    />
                    <Arrow
                        direction="next"
                        onClick={() => scroll("next")}
                        disabled={!canScrollNext}
                    />
                </div>
            </div>
        </div>
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
    const rotation = direction === "prev" ? "rotate(180deg)" : "rotate(0deg)";

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