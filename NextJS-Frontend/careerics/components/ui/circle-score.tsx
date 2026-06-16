"use client";
import React, { ReactNode } from "react";
import { useEffect, useState } from "react";


type CircleScoreProps = {
    score: number;
    onClick?: () => void;
};

export const CircleScore = ({ score, onClick }: CircleScoreProps) => {

    const LARGE = 1024;
    const MEDIUM = 640;

    const [width, setWidth] = useState(0);

    useEffect(() => {
        const handleResize = () => setWidth(window.innerWidth);

        handleResize();

        window.addEventListener("resize", handleResize);

        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const isLarge = width >= LARGE;
    const isMedium = width >= MEDIUM && width < LARGE;
    const isSmall = width < MEDIUM;

    const radius = isLarge ? 18 : 15;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;

    const getColor = (score: number) => {
        if (score >= 80) return "#d4ff47";
        if (score >= 50) return "#f59e0b";
        return "#ef4444";
    };

    const color = getColor(score);

    return (
        <div
            onClick={onClick}
            style={{
                position: "relative",
                width: "var(--icon-2xl)",
                height: "var(--icon-2xl)",
                backgroundColor: "#1A2E5A",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                cursor: onClick ? "pointer" : "default",
            }}
        >
            <svg width="45" height="45" style={{ transform: "rotate(-90deg)" }}>
                {/* Track */}
                <circle
                    cx="22.5"
                    cy="22.5"
                    r={radius}
                    fill="none"
                    stroke="rgba(212, 255, 71, 0.1)"
                    strokeWidth="3.5"
                />

                {/* Progress */}
                <circle
                    cx="22.5"
                    cy="22.5"
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth="3.5"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    style={{ transition: "stroke-dashoffset 0.5s ease" }}
                />
            </svg>

            <span
                style={{
                    position: "absolute",
                    color: "white",
                    fontSize: isLarge ? "var(--text-xs)" : "var(--text-xxs)",
                    fontFamily: "var(--font-nova-square)",
                }}
            >
                {score}%
            </span>
        </div>
    );
};