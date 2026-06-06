"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { careerService } from "@/services";
import type { APICareerCardRead, APICareerCardSelectionItem } from "@/types";
import { cn } from "@/lib/utils";

const MIN_CARDS_PER_STEP = 3;
const MAX_CARDS_PER_STEP = 5;

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

  const isCurrentStepValid = currentSelectionIds.length >= MIN_CARDS_PER_STEP;

  return (
    <section className="flex h-full min-h-0 w-full flex-col overflow-hidden px-[var(--space-lg)] pb-[var(--space-xl)] pt-[calc(var(--icon-lg)+var(--space-2xl))] sm:px-[var(--space-2xl)]">
      <header className="mx-auto flex w-full max-w-[64rem] shrink-0 flex-col items-center text-center">
        <div className="flex flex-col items-center justify-center gap-[var(--space-sm)] sm:flex-row sm:gap-[var(--space-lg)]">
          <h1
            className="m-0 text-[length:var(--text-xl)] font-semibold leading-[var(--line-tight)] text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-nova-square), sans-serif" }}
          >
            {currentTitle}
          </h1>
  
          <span
            className="inline-flex items-center rounded-full border border-[var(--primary-green)] bg-[rgba(40,41,43,0.85)] px-[var(--space-md)] py-[var(--space-xs)] text-[length:var(--text-sm)] font-bold leading-[var(--line-normal)] text-[var(--light-green)]"
            style={{ fontFamily: "var(--font-nova-square), sans-serif" }}
          >
            {selectedSummary}
          </span>
        </div>
  
        {error ? (
          <p className="m-0 mt-[var(--space-sm)] text-center text-[length:var(--text-sm)] leading-[var(--line-normal)] text-[var(--text-danger)]">
            {error}
          </p>
        ) : null}
      </header>
  
      <main className="flex min-h-0 flex-1 items-center justify-center py-[var(--space-xl)]">
        <div className="flex min-h-[clamp(18rem,40vh,27rem)] w-full max-w-[76rem] items-center justify-center overflow-y-auto rounded-[var(--radius-2xl)] bg-[var(--bg-grey)] px-[var(--space-xl)] py-[var(--space-2xl)] sm:px-[var(--space-2xl)]">
          {isLoadingCards ? (
            <div className="flex min-h-[12rem] items-center justify-center text-center text-[length:var(--text-base)] text-[var(--dark-blue)]">
              Loading available cards...
            </div>
          ) : currentCards.length === 0 ? (
            <div className="flex min-h-[12rem] items-center justify-center text-center text-[length:var(--text-base)] text-[var(--dark-blue)]">
              No cards available for this step yet.
            </div>
          ) : (
            <div className="flex w-full max-w-[68rem] flex-wrap items-center justify-center gap-x-[var(--space-xl)] gap-y-[var(--space-lg)]">
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
                      "min-h-[2.65rem] rounded-[var(--radius-md)] px-[var(--space-xl)] py-[var(--space-sm)] text-center text-[length:var(--text-sm)] font-semibold leading-[var(--line-normal)] transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-grey)]",
                      "w-full sm:w-auto sm:min-w-[10.5rem]",
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
      </main>
  
      <footer className="flex w-full shrink-0 items-center justify-end">
        <Button
          variant="primary"
          type="button"
          onClick={handleNext}
          disabled={isLoadingCards || !isCurrentStepValid || isSubmitting}
          isLoading={isSubmitting}
          className="w-full rounded-[var(--radius-lg)] font-extrabold sm:w-auto sm:min-w-[9rem]"
        >
          {step === 0 ? "Continue" : isSubmitting ? "Saving..." : "Start Questions"}
        </Button>
      </footer>
    </section>
  );
};