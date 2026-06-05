"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { isActiveSessionStatus, runCloseStatusUpdate } from "@/lib/session-close";
import { careerService } from "@/services";

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

        if (sessionId) {
            await runCloseStatusUpdate("career quiz", async () => {
                const sessionResponse = await careerService.getSession(sessionId);
                if (!sessionResponse.success) {
                    throw new Error(sessionResponse.message || "Unable to load career quiz session.");
                }

                if (!isActiveSessionStatus(sessionResponse.data?.status)) {
                    return;
                }

                const updateResponse = await careerService.updateSessionStatus(sessionId, {
                    status: "cancelled",
                });
                if (!updateResponse.success) {
                    throw new Error(updateResponse.message || "Unable to cancel career quiz session.");
                }
            });
        }

        router.replace("/features/career");
    };

    return (
        <div
            style={{
                width: "100%",
                height: "100dvh",
                maxHeight: "100dvh",
                padding: "var(--space-md)",
                overflow: "hidden",
                display: "grid",
                gridTemplateColumns: "1fr",
                gridTemplateRows: "1fr",
            }}
        >
            {/* Main Content */}
            <div
                style={{
                    background: "linear-gradient(180deg, var(--dark-blue) 0%, #000000 100%)",
                    width: "100%",
                    display: "flex",
                    overflow: "hidden",
                    borderRadius: "var(--radius-xl)",
                    flexDirection: "column",
                }}
            >

            <button
                type="button"
                onClick={() => void handleClose()}
                disabled={isClosing}
                aria-label="Close career quiz"
                style={{
                    width: "var(--icon-lg)",
                    height: "var(--icon-lg)",
                    cursor: isClosing ? "not-allowed" : "pointer",
                    marginLeft: "auto",
                    marginBottom: "auto",
                    marginTop: "var(--space-md)",
                    marginRight: "var(--space-md)",
                    gridArea: "1 / 1 / 2 / 2",
                    opacity: isClosing ? 0.6 : 1,
                }}
            >
                <img
                    src="/global/close.svg"
                    alt="Close"
                    style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                    }}
                />
            </button>

                {children}
            </div>

           
        </div>
    );
}
