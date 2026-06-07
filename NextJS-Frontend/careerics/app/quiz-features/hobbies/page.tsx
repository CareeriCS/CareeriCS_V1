"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { careerService } from "@/services";
import type { APICareerCardRead, APICareerCardSelectionItem } from "@/types";
import { cn } from "@/lib/utils";

const MIN_CARDS_PER_STEP = 3;
const MAX_CARDS_PER_STEP = 5;

type SelectionNavButtonProps = {
  direction: "previous" | "next";
  disabled?: boolean;
  isLoading?: boolean;
  inactive?: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

function SelectionNavButton({
  direction,
  disabled,
  isLoading,
  inactive = false,
  onClick,
  children,
}: SelectionNavButtonProps) {
  const isPrevious = direction === "previous";

  const icon = (
    <span
      aria-hidden="true"
      className="flex h-[2rem] w-[2rem] shrink-0 items-center justify-center rounded-full bg-[var(--white)] text-[length:var(--text-sm)] leading-none text-[var(--dark-blue)]"
    >
      {isPrevious ? "↩" : "↪"}
    </span>
  );

  return (
    <Button
      variant={isPrevious ? "secondary-inverted" : "primary"}
      type="button"
      onClick={inactive ? undefined : onClick}
      disabled={disabled || inactive}
      isLoading={isLoading}
      aria-hidden={inactive}
      tabIndex={inactive ? -1 : undefined}
      className={cn(
        "w-full rounded-full px-[var(--space-md)] font-semibold sm:w-auto sm:min-w-[7.5rem]",
        inactive ? "pointer-events-none opacity-0" : ""
      )}
    >
      {isPrevious ? (
        <>
          {icon}
          {children}
        </>
      ) : (
        <>
          {children}
          {!isLoading ? icon : null}
        </>
      )}
    </Button>
  );
}

export default function HobbiesGrid() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId") || "";

  const [step, setStep] = useState<0 | 1>(0);
  const [hobbyCards, setHobbyCards] = useState<APICareerCardRead[]>([]);
  const [technicalCards, setTechnicalCards] = useState<APICareerCardRead[]>([]);
  const [selectedHobbyIds, setSelectedHobbyIds] = useState<string[]>([]);
  const [selectedTechnicalIds, setSelectedTechnicalIds] = useState<string[]>([]);
  const [isLoadingCards, setIsLoadingCards] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadCards = async () => {
      if (!sessionId) {
        setIsLoadingCards(false);
        setError("Missing career session. Please restart the quiz from career discovery.");
        return;
      }

      setIsLoadingCards(true);
      setError(null);

      const [hobbyResponse, technicalResponse] = await Promise.all([
        careerService.getCardsByType("hobby"),
        careerService.getCardsByType("technical"),
      ]);

      if (cancelled) {
        return;
      }

      if (!hobbyResponse.success || !technicalResponse.success) {
        setError(
          hobbyResponse.message ||
            technicalResponse.message ||
            "Unable to load card choices right now. Please try again.",
        );
        setIsLoadingCards(false);
        return;
      }

      setHobbyCards(hobbyResponse.data || []);
      setTechnicalCards(technicalResponse.data || []);
      setIsLoadingCards(false);
    };

    void loadCards();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const currentCards = step === 0 ? hobbyCards : technicalCards;
  const currentSelectionIds = step === 0 ? selectedHobbyIds : selectedTechnicalIds;

  const currentTitle = step === 0 ? "Choose Your Interests" : "Choose Your Strengths";

  const selectedSummary =
    step === 0
      ? `${selectedHobbyIds.length} interests selected`
      : `${selectedTechnicalIds.length} strengths selected`;

  const currentInstruction =
    step === 0 ? "Choose between 3 to 5 interests to continue" : "Choose between 3 to 5 strengths to continue";

  const toggleCard = (cardId: string) => {
    if (step === 0) {
      setSelectedHobbyIds((prev) => {
        if (prev.includes(cardId)) {
          setError(null);
          return prev.filter((id) => id !== cardId);
        }

        if (prev.length >= MAX_CARDS_PER_STEP) {
          setError(`You can select up to ${MAX_CARDS_PER_STEP} interests.`);
          return prev;
        }

        setError(null);
        return [...prev, cardId];
      });

      return;
    }

    setSelectedTechnicalIds((prev) => {
      if (prev.includes(cardId)) {
        setError(null);
        return prev.filter((id) => id !== cardId);
      }

      if (prev.length >= MAX_CARDS_PER_STEP) {
        setError(`You can select up to ${MAX_CARDS_PER_STEP} strengths.`);
        return prev;
      }

      setError(null);
      return [...prev, cardId];
    });
  };

  const handleBack = () => {
    if (step === 1) {
      setStep(0);
      setError(null);
      return;
    }

    router.push("/features/career");
  };

  const submitSelections = async () => {
    if (!sessionId) {
      setError("Missing career session. Please restart the quiz.");
      return;
    }

    if (selectedHobbyIds.length < MIN_CARDS_PER_STEP) {
      setError("Choose at least 3 interests to continue.");
      return;
    }

    if (selectedTechnicalIds.length < MIN_CARDS_PER_STEP) {
      setError("Choose at least 3 strengths to continue.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const selectedCards: APICareerCardSelectionItem[] = [
      ...selectedHobbyIds.map((id) => ({ id, type: "hobby" as const })),
      ...selectedTechnicalIds.map((id) => ({ id, type: "technical" as const })),
    ];

    const response = await careerService.selectCards(sessionId, selectedCards);

    if (!response.success) {
      setIsSubmitting(false);
      setError(response.message || "Unable to save selected cards. Please try again.");
      return;
    }

    router.push(`/quiz-features/questions?sessionId=${encodeURIComponent(sessionId)}`);
  };

  const handleNext = () => {
    if (step === 0) {
      if (selectedHobbyIds.length < MIN_CARDS_PER_STEP) {
        setError("Choose at least 3 interests to continue.");
        return;
      }

      setError(null);
      setStep(1);
      return;
    }

    void submitSelections();
  };

  return (
    <section className="flex h-full min-h-0 w-full flex-col overflow-hidden px-[var(--space-lg)] pb-[var(--space-xl)] pt-[var(--space-xl)] sm:px-[var(--space-2xl)]">
      <main className="mx-auto grid min-h-0 w-full max-w-[66rem] flex-1 grid-rows-[minmax(5.5rem,8rem)_auto_auto] gap-[var(--space-md)]">
        <header className="grid w-full self-center grid-cols-1 items-start gap-[var(--space-sm)] text-center md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:text-left">
          <div className="min-w-0">
            <h1
              className="m-0 text-[length:var(--text-xl)] font-semibold leading-[var(--line-tight)] text-[var(--text-primary)]"
              style={{ fontFamily: "var(--font-nova-square), sans-serif" }}
            >
              {currentTitle}
            </h1>

            <p className="m-0 mt-[var(--space-xs)] text-[length:var(--text-sm)] leading-[var(--line-normal)] text-[var(--text-secondary)]">
              {currentInstruction}
            </p>
          </div>

          <div className="flex min-h-[2rem] items-center justify-center px-[var(--space-md)]">
            {error ? (
              <p className="m-0 text-center text-[length:var(--text-sm)] leading-[var(--line-normal)] text-[var(--text-danger)]">
                {error}
              </p>
            ) : null}
          </div>

          <div className="flex justify-center md:justify-end">
            <span
              className="inline-flex items-center rounded-full border border-[var(--primary-green)] bg-[rgba(40,41,43,0.85)] px-[var(--space-md)] py-[var(--space-xs)] text-[length:var(--text-sm)] font-medium leading-[var(--line-normal)] text-[var(--light-green)]"
              style={{ fontFamily: "var(--font-nova-square), sans-serif" }}
            >
              {selectedSummary}
            </span>
          </div>
        </header>

        <div className="flex min-h-[clamp(18rem,38vh,27rem)] w-full items-center justify-center overflow-y-auto rounded-[var(--radius-2xl)] bg-[var(--bg-grey)] px-[var(--space-xl)] py-[var(--space-2xl)] sm:px-[var(--space-2xl)]">
          {isLoadingCards ? (
            <div className="flex min-h-[12rem] items-center justify-center text-center text-[length:var(--text-base)] text-[var(--dark-blue)]">
              Loading available cards...
            </div>
          ) : currentCards.length === 0 ? (
            <div className="flex min-h-[12rem] items-center justify-center text-center text-[length:var(--text-base)] text-[var(--dark-blue)]">
              No cards available for this step yet.
            </div>
          ) : (
            <div className="flex w-full max-w-[58rem] flex-wrap items-center justify-center gap-x-[var(--space-lg)] gap-y-[var(--space-lg)]">
              {currentCards.map((card) => {
                const isSelected = currentSelectionIds.includes(card.id);

                return (
                  <button
                    key={card.id}
                    type="button"
                    aria-pressed={isSelected}
                    title={card.description || card.name}
                    onClick={() => toggleCard(card.id)}
                    className={cn(
                      "min-h-[2.35rem] rounded-[var(--radius-md)] px-[var(--space-lg)] py-[var(--space-xs)] text-center text-[length:var(--text-sm)] font-medium leading-[var(--line-normal)] transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-grey)]",
                      "w-full sm:w-auto sm:min-w-[8.75rem]",
                      isSelected
                        ? "bg-[var(--light-green)] text-[var(--bg-color)]"
                        : "bg-[var(--medium-blue)] text-[var(--text-primary)] hover:bg-[var(--dark-blue)]"
                    )}
                    style={{ fontFamily: "var(--font-jura), sans-serif" }}
                  >
                    {card.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <footer className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-[var(--space-md)]">
          <div />

          <div className="flex items-center justify-center gap-[var(--space-md)]">
            <SelectionNavButton
              direction="previous"
              onClick={handleBack}
              disabled={isLoadingCards || isSubmitting}
              inactive={step === 0}
            >
              Previous
            </SelectionNavButton>

            <SelectionNavButton
              direction="next"
              onClick={handleNext}
              disabled={isLoadingCards || isSubmitting}
              inactive={step === 1}
            >
              Next
            </SelectionNavButton>
          </div>

          <div className="flex justify-end">
            {step === 1 ? (
              <SelectionNavButton
                direction="next"
                onClick={handleNext}
                disabled={isLoadingCards || isSubmitting}
                isLoading={isSubmitting}
              >
                {isSubmitting ? "Saving..." : "Start Questions"}
              </SelectionNavButton>
            ) : null}
          </div>
        </footer>
      </main>
    </section>
  );
}