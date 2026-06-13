"use client";

import React from "react";
import Animation from "@/components/ui/animation";

export default function AssessmentInitPage() {
    return (
        <section
            style={{
                margin: "auto",
                display: "flex",
                width: "100%",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center"
            }}
        >
            <div style={{ maxWidth: "var(--container-sm)" }}>
                <Animation message="Preparing your assessment..." />
            </div>
        </section>
    );
}