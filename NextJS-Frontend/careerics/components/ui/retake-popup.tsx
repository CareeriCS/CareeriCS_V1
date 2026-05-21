"use client";

import React from "react";
import { Button } from "./button";


interface RetakePopupProps {
    onConfirm: () => void;
    onCancel: () => void;
}

export default function RetakePopup({
    onConfirm,
    onCancel,
}: RetakePopupProps) {

    return (
        <div
            role="dialog"
            aria-modal="true"

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
                        }}
                    >

                        Retake Course
                    </h2>
                    <img
                        onClick={onCancel}
                        src="/global/close.svg"
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

                <p>
                    Retake this course? Your progress will be reset.
                </p>

                <div
                    style={{
                        display: "flex",
                        width: "100%",
                        gap:"var(--space-md)",
                    }}
                >
                    <Button
                        onClick={onCancel}
                        variant="popup-inverted"
                        style={{
                            whiteSpace: "nowrap",
                            minWidth:0,
                            flex:1,
                        }}
                    >
                        Cancel
                    </Button>

                    <Button
                        onClick={onConfirm}
                        variant="popup-inverted"
                        style={{
                            whiteSpace: "nowrap",
                            minWidth:0,
                            flex:1,
                        }}
                    >
                        Retake
                    </Button>

                </div>

            </div>
        </div>
    );
}