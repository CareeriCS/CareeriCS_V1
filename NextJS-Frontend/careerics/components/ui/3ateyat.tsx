"use client";

import { useResponsive } from "@/hooks/useResponsive";
import { Columns } from "lucide-react";
import React, { CSSProperties } from "react";
import { normalizeBackendAssetUrl } from "@/lib/asset-url";

interface TipCardProps {
    icon: string;
    title: string;
    description: string;
    style?: CSSProperties;
    variant?: "tip" | "feature";
    onclick?: () => void;
}

export default function TipCard({ icon, title, description, style, variant = "tip", onclick }: TipCardProps) {

    const { isLarge, isMedium, isSmall, width } = useResponsive();
    const displayIcon = normalizeBackendAssetUrl(icon);
    return (
        <div
            onClick={variant === "feature" ? onclick : undefined}
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                backgroundColor: "var(--medium-blue)",
                borderRadius: "var(--radius-xl)",
                display: "flex",
                padding: "var(--space-xl)",
                overflow: "hidden",
                justifyContent: "flex-start",
                alignItems: "center",
                cursor: variant === "feature" ? "pointer" : "normal",
                ...style
            }}
        >
            <div
                style={{
                    display: "flex",
                    height: "100%",
                    width: "fit-content",
                    marginRight: "auto",
                    alignItems: "center",
                    justifyContent: "flex-start",
                    gap: "var(--space-md)",
                }}
            >
                <img src={displayIcon} alt={title} style={{ width: "var(--icon-xl)" }} />

                <div
                    style={{
                        color: "white",
                        fontFamily: "var(--font-nova-square)",
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    <p
                        style={{
                            fontSize: "var(--text-md)",
                            marginRight: "auto"
                        }}
                    >
                        {title}
                    </p>

                    <p
                        style={{
                            fontSize: "var(--text-base)",
                            width: "100%",
                            whiteSpace: "pre-line",
                            fontFamily: "var(--font-jura)"
                        }}
                    >
                        {description}
                    </p>
                </div>
            </div>
            {variant === "feature" &&
                <div
                    style={{
                        color: "white",
                        width: "fit-content",
                        height: "fit-content",
                        fontSize: "var(--text-lg)",
                        fontFamily: "var(--font-jura)",
                        cursor: "pointer",
                        marginLeft: "auto"
                    }}
                >
                    {"❯"}
                </div>
            }
        </div>
    );
}