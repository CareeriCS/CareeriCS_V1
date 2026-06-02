"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { careerService } from "@/services";
import type { APICareerCardRead, APICareerCardSelectionItem } from "@/types";
import { useResponsive } from "@/hooks/useResponsive";

const MIN_CARDS_PER_STEP = 3;
const MAX_CARDS_PER_STEP = 5;

export default function HobbiesGrid() {
  const router = useRouter();
  const { isLarge, isMedium, isSmall } = useResponsive();
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
  const currentTitle =
    step === 0
      ? "Choose Your Favorite interests"
      : "Choose Your Favorite strengths";

  const currentSubtitle =
    step === 0
      ? "Step 1 of 2: Select between 3 and 5 interests"
      : "Step 2 of 2: Select between 3 and 5 strengths";

  const currentSelectionIds = step === 0 ? selectedHobbyIds : selectedTechnicalIds;

  const selectedSummary = useMemo(() => {
    if (step === 0) {
      return `${selectedHobbyIds.length} interests selected`;
    }

    return `${selectedTechnicalIds.length} strengths selected`;
  }, [selectedHobbyIds.length, selectedTechnicalIds.length, step]);

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

  const isCurrentStepValid = currentSelectionIds.length >= 3;

  return (
    <div
      style={{
        width: "100%",
        maxHeight: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        overflowY: "auto",
        scrollbarWidth: "none",
        gap: isSmall ? "var(--space-sm)" : "var(--space-md)",
        paddingInline: isSmall ? "var(--space-sm)" : "0",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: isSmall ? "center" : "space-between",
          alignItems: isSmall ? "center" : "center",
          gap: isSmall ? "var(--space-md)" : "var(--space-lg)",
          flexWrap: "wrap",
          position: "relative",
          width: isSmall ? "100%" : "auto",
          textAlign: isSmall ? "center" : "left",
        }}
      >
        <div>
          <h1
            style={{
              color: "var(--light-blue)",
              fontSize: isSmall ? "var(--text-lg)" : "var(--text-xl)",
              fontFamily: "var(--font-nova-square)",
              lineHeight: "var(--line-tight)",
            }}
          >
            {currentTitle}
          </h1>

          <p
            style={{
              color: "var(--text-grey)",
              fontSize: isSmall ? "var(--text-sm)" : "var(--text-base)",
              fontFamily: "var(--font-jura)",
              lineHeight: "var(--line-normal)",
            }}
          >
            {currentSubtitle}
          </p>
        </div>

        <div
          style={{
            backgroundColor: "var(--dark-grey)",
            border: "1px solid var(--primary-green)",
            color: "var(--light-green)",
            borderRadius: "var(--radius-2xl)",
            padding: "var(--space-sm) var(--space-sm)",
            fontSize: "var(--text-sm)",
            fontWeight: 700,
            whiteSpace: "nowrap",
            position: "relative",
            fontFamily: "var(--font-jura)",
          }}
        >
          {selectedSummary}
        </div>
      </div>

      {error ? (
        <p
          style={{
            margin: 0,
            color: "var(--light-red)",
            fontSize: isSmall ? "var(--text-sm)" : "var(--text-base)",
            fontFamily: "var(--font-jura)",
            lineHeight: "var(--line-normal)",
            textAlign: isSmall ? "center" : "left",
          }}
        >
          {error}
        </p>
      ) : null}

      <div
        style={{
          background: "var(--bg-grey)",
          borderRadius: "var(--radius-2xl)",
          width: isSmall ? "100%" : isMedium ? "90%" : "80%",
          padding: isSmall ? "var(--space-md)" : "var(--space-xl)",
          boxSizing: "border-box",
        }}
      >
        {isLoadingCards ? (
          <div
            style={{
              color: "var(--dark-grey)",
              textAlign: "center",
              paddingTop: isSmall ? "var(--space-xl)" : "var(--space-2xl)",
              fontSize: isSmall ? "var(--text-sm)" : "var(--text-base)",
              fontFamily: "var(--font-jura)",
              lineHeight: "var(--line-normal)",
            }}
          >
            Loading available cards...
          </div>
        ) : currentCards.length === 0 ? (
          <div
            style={{
              color: "var(--dark-grey)",
              textAlign: "center",
              paddingTop: isSmall ? "var(--space-xl)" : "var(--space-2xl)",
              fontSize: isSmall ? "var(--text-sm)" : "var(--text-base)",
              fontFamily: "var(--font-jura)",
              lineHeight: "var(--line-normal)",
            }}
          >
            No cards available for this step yet.
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: isSmall ? "var(--space-md)" : "var(--space-xl)",
              justifyContent: isSmall ? "center" : "space-between",
            }}
          >
            {currentCards.map((card) => {
              const isSelected = currentSelectionIds.includes(card.id);

              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => toggleCard(card.id)}
                  style={{
                    width: isSmall ? "100%" : "0",
                    minWidth: isSmall ? "100%" : "fit-content",
                    backgroundColor: isSelected
                      ? "var(--light-green)"
                      : "var(--medium-blue)",
                    color: isSelected
                      ? "var(--bg-color)"
                      : "var(--light-blue)",
                    borderRadius: "var(--radius-lg)",
                    padding: isSmall
                      ? "var(--space-sm) var(--space-md)"
                      : "var(--space-sm) var(--space-xl)",
                    textAlign: "center",
                    cursor: "pointer",
                    minHeight: "var(--min-touch-target)",
                    fontSize: isSmall ? "var(--text-sm)" : "var(--text-base)",
                    fontFamily: "var(--font-jura)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-around",
                    alignItems: "center",
                    whiteSpace: "normal",
                    flex: isSmall ? "none" : 1,
                    lineHeight: "var(--line-normal)",
                  }}
                >
                  <div>{card.name}</div>

                  {card.description ? (
                    <div
                      style={{
                        fontSize: "var(--text-xs)",
                        fontWeight: 500,
                        lineHeight: "var(--line-normal)",
                      }}
                    >
                      {card.description}
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: isSmall ? "center" : "space-between",
          alignItems: "center",
          width: "100%",
          gap: isSmall ? "var(--space-md)" : "var(--space-lg)",
          flexDirection: isSmall ? "column" : "row",
        }}
      >
        {step !== 0 ? (
          <Button
            variant="primary-inverted"
            type="button"
            onClick={handleBack}
            style={{
              borderRadius: "var(--radius-lg)",
              padding: "var(--button-padding-y) var(--button-padding-x)",
              fontWeight: 700,
              minHeight: "var(--min-touch-target)",
              width: isSmall ? "100%" : "15%",
              flex: "none",
            }}
          >
            Previous
          </Button>
        ) : (
          <div style={{ width: isSmall ? "100%" : "20%" }} />
        )}

        <Button
          variant="primary"
          type="button"
          onClick={handleNext}
          disabled={isLoadingCards || !isCurrentStepValid || isSubmitting}
          style={{
            borderRadius: "var(--radius-lg)",
            padding: "var(--button-padding-y) var(--button-padding-x)",
            fontWeight: 800,
            minHeight: "var(--min-touch-target)",
            width: isSmall ? "100%" : "auto",
            flex: "none",
            opacity: isLoadingCards || !isCurrentStepValid || isSubmitting ? 0.55 : 1,
          }}
        >
          {step === 0 ? "Continue to Strengths" : isSubmitting ? "Saving..." : "Start Questions"}
        </Button>
      </div>
    </div>
  );
}