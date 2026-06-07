"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { isActiveSessionStatus, runCloseStatusUpdate } from "@/lib/session-close";
import { careerService } from "@/services";

export default function JourneyLayout({ children }: { children: ReactNode }) {
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
          throw new Error(
            sessionResponse.message || "Unable to load career quiz session.",
          );
        }

        if (!isActiveSessionStatus(sessionResponse.data?.status)) {
          return;
        }

        const updateResponse = await careerService.updateSessionStatus(sessionId, {
          status: "cancelled",
        });

        if (!updateResponse.success) {
          throw new Error(
            updateResponse.message || "Unable to cancel career quiz session.",
          );
        }
      });
    }

    router.replace("/features/career");
  };

  return (
    <div className="relative h-[100dvh] max-h-[100dvh] w-full overflow-hidden p-[var(--space-md)]">
      <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[var(--radius-xl)] bg-[linear-gradient(180deg,var(--dark-blue)_0%,#000000_100%)]">
        <button
          type="button"
          onClick={() => void handleClose()}
          disabled={isClosing}
          aria-label="Close career quiz"
          className="absolute right-[var(--space-md)] top-[var(--space-md)] z-20 flex h-[var(--icon-lg)] w-[var(--icon-lg)] items-center justify-center rounded-full transition hover:bg-[rgba(255,255,255,0.08)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <img
            src="/global/close.svg"
            alt=""
            aria-hidden="true"
            className="h-full w-full object-contain"
          />
        </button>

        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
  );
}