"use client";

import React, { useRef, Children, useEffect, useState } from "react";
import { SearchBar } from "../searchbar";

type Props = {
    children: React.ReactNode;
    style?: React.CSSProperties;
    Title?: string;
    centerTitle?: boolean;

    searchBar?: boolean;
    searchValue?: string;
    onSearchChange?: (value: string) => void;

    loadingText?: string;
};

export const FlexContainer = ({
    children,
    style,
    Title = "Title",
    centerTitle = false,

    searchBar = false,
    searchValue = "",
    onSearchChange,

    loadingText = "Loading...",
}: Props) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    const [canScrollPrev, setCanScrollPrev] = useState(false);
    const [canScrollNext, setCanScrollNext] = useState(true);

    const childCount = Children.count(children);
    const isEmpty = childCount === 0;

    const updateScrollState = () => {
        if (!scrollRef.current) return;

        const el = scrollRef.current;

        setCanScrollPrev(el.scrollTop > 0);
        setCanScrollNext(el.scrollTop + el.clientHeight < el.scrollHeight - 1);
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

        const amount = scrollRef.current.clientHeight;

        scrollRef.current.scrollBy({
            top: direction === "prev" ? -amount : amount,
            behavior: "smooth",
        });

        setTimeout(updateScrollState, 300);
    };

    return (
        <div
            style={{
                backgroundColor: "var(--medium-blue)",
                borderRadius: "var(--radius-xl)",
                paddingInline: "var(--space-xl)",
                paddingTop: "var(--space-xl)",
                paddingBottom: 0,
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
            {/* Header */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: centerTitle ? "center" : "space-between",
                    gap: "var(--space-xl)",
                    width: "100%",
                    
                }}
            >
                <h2
                    style={{
                        fontSize: "var(--text-md)",
                        textAlign: centerTitle ? "center" : "left",
                        fontFamily: "var(--font-nova-square)",
                        whiteSpace: "nowrap",
                    }}
                >
                    {Title}
                </h2>

                {searchBar && (
                    <SearchBar
                        value={searchValue}
                        onChange={(value) => {
                            onSearchChange?.(value);
                        }}
                    />
                )}
            </div>

            {/* Content */}
            <div
                style={{
                    display: "flex",
                    width: "100%",
                    minHeight: 0,
                    flex: 1,
                    flexDirection: "column",
                }}
            >
                <div
                    ref={scrollRef}
                    style={{
                        display: "flex",
                        gap: "var(--space-md)",
                        overflowY: "auto",
                        overflowX: "hidden",
                        scrollbarWidth: "none",
                        flex: 1,
                        alignContent: "start",
                        flexWrap: "wrap",
                        flexDirection: "row",
                        minHeight: 0,
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
                            {loadingText}
                        </div>
                    ) : (
                        children
                    )}
                </div>

                {/* Scroll Controls */}
                <div
                    style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: "var(--space-md)",
                        marginTop: "auto",
                        userSelect: "none",
                        height: "var(--space-xl)",
                        alignItems: "center",
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
    const rotation =
        direction === "prev" ? "rotate(-90deg)" : "rotate(90deg)";

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