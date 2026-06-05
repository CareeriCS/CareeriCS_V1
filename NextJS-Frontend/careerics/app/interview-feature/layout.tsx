"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { isActiveSessionStatus, runCloseStatusUpdate } from "@/lib/session-close";
import { interviewService } from "@/services";

export default function JourneyLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [isClosing, setIsClosing] = useState(false);

    const handleClose = async () => {
        if (isClosing) {
            return;
        }

        setIsClosing(true);

        const sessionId = searchParams.get("sessionId") || "";
        const isCompletionScreen = pathname.includes("/last-analysis");

        if (sessionId && !isCompletionScreen) {
            await runCloseStatusUpdate("interview", async () => {
                const sessionResponse = await interviewService.getSession(sessionId);
                if (!sessionResponse.success) {
                    throw new Error(sessionResponse.message || "Unable to load interview session.");
                }

                if (!isActiveSessionStatus(sessionResponse.data?.status)) {
                    return;
                }

                const updateResponse = await interviewService.updateSession(sessionId, {
                    status: "cancelled",
                });
                if (!updateResponse.success) {
                    throw new Error(updateResponse.message || "Unable to cancel interview session.");
                }
            });
        }

        router.replace("/features/interview");
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
                    aria-label="Close interview"
                    style={{
                        width: "5vh",
                        height: "5vh",
                        cursor: isClosing ? "not-allowed" : "pointer",
                        margin: "20px",
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
            </div>
        </div>
    );
}
