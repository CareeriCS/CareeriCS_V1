"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { runCloseStatusUpdate } from "@/lib/session-close";
import { skillAssessmentService } from "@/services";

const ASSESSMENT_STATUS_STORAGE_PREFIX = "skill-assessment:status:";

export default function JourneyLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isClosing, setIsClosing] = useState(false);

    const handleClose = async () => {
        if (isClosing) {
            return;
        }

        setIsClosing(true);

        const sessionId = searchParams.get("sessionId") || "";
        const localStatus = sessionId
            ? sessionStorage.getItem(`${ASSESSMENT_STATUS_STORAGE_PREFIX}${sessionId}`)
            : null;
        const shouldCancel = sessionId && localStatus !== "submitted" && localStatus !== "completed";

        if (shouldCancel) {
            await runCloseStatusUpdate("skill assessment", async () => {
                const response = await skillAssessmentService.updateSessionStatus(sessionId, {
                    status: "cancelled",
                });
                if (!response.success) {
                    throw new Error(response.message || "Unable to cancel skill assessment session.");
                }

                sessionStorage.setItem(`${ASSESSMENT_STATUS_STORAGE_PREFIX}${sessionId}`, "cancelled");
            });
        }

        router.replace("/features/skill");
    };

    return (
        <div
            style={{
                width: "100%",
                height: "100vh",
                padding: "10px",
                boxSizing: "border-box",
                overflow: "hidden",
            }}
        >
            <div
                style={{
                    background: "linear-gradient(180deg, var(--dark-blue) 0%, #000000 100%)",
                    borderRadius: "5vh",
                    width: "100%",
                    height: "100%",
                    margin: "0 auto",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "row",
                }}
            >
                {/* Main content */}
                <div
                    style={{
                        position: "relative",
                        display: "flex",
                        flex: 1,
                        overflowX:"hidden",
                        overflowY:"auto",
                        scrollbarWidth: "none",
                    }}
                >
                    {children}
                </div>


                {/* Exit Button*/}
<button
        type="button"
        onClick={() => void handleClose()}
        disabled={isClosing}
        aria-label="Close skill assessment"
        style={{
            position: "absolute", // 1. Khallih tayir fo2 el elements
            top: "30px",          // 2. Eb3ed 3an el sa2f sanna
            right: "30px",        // 3. Elza2 f el ymeen bel-zabt
            width: "35px",        // 4. Esta5dem px a7san men vh le-de2et el icon
            height: "35px",
            cursor: isClosing ? "not-allowed" : "pointer",
            background: "none",
            border: "none",
            zIndex: 100,         
            padding: 0,
            opacity: isClosing ? 0.6 : 1,
        }}
    >
        <img
            src="/global/close.svg"
            alt="Close"
            style={{
                width: "100%",
                height: "100%",
            }}
        />
    </button>
            </div>
        </div>
    );
}
