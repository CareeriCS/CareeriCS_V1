"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { isActiveSessionStatus, runCloseStatusUpdate } from "@/lib/session-close";
import { careerService } from "@/services";

function resolveQuizReturnHref(returnTo: string | null, origin: string | null): string {
  const normalizedReturnTo = (returnTo || "").trim();
  if (
    normalizedReturnTo &&
    normalizedReturnTo.startsWith("/") &&
    !normalizedReturnTo.startsWith("//")
  ) {
    return normalizedReturnTo;
  }

  if ((origin || "").trim().toLowerCase() === "home") {
    return "/features/home";
  }

  return "/features/career";
}

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
    const origin = searchParams.get("origin");
    const returnTo = searchParams.get("returnTo");

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

    router.replace(resolveQuizReturnHref(returnTo, origin));
  };

  return (
    <div className="relative h-[100dvh] max-h-[100dvh] w-full overflow-hidden p-[var(--space-md)]">
      <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[var(--radius-xl)] bg-[linear-gradient(180deg,var(--dark-blue)_0%,#000000_100%)]">
        <button
          type="button"
          onClick={() => void handleClose()}
          disabled={isClosing}
          aria-label="Close career quiz"
          className="absolute right-[var(--space-md)] top-[calc(var(--space-md)+0.25rem)] z-20 flex h-[var(--icon-lg)] w-[var(--icon-lg)] items-center justify-center rounded-full transition  cursor-pointer"
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