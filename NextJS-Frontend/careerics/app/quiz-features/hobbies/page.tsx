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
  const origin = searchParams.get("origin") || "";
  const returnTo = searchParams.get("returnTo") || "";

  const [step, setStep] = useState<0 | 1>(0);
  const [hobbyCards, setHobbyCards] = useState<APICareerCardRead[]>([]);
  const [technicalCards, setTechnicalCards] = useState<APICareerCardRead[]>([]);
  const [selectedHobbyIds, setSelectedHobbyIds] = useState<string[]>([]);
  const [selectedTechnicalIds, setSelectedTechnicalIds] = useState<string[]>([]);
  const [isLoadingCards, setIsLoadingCards] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedReturnHref = useMemo(() => {
    if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
      return returnTo;
    }
    return origin.toLowerCase() === "home" ? "/features/home" : "/features/career";
  }, [origin, returnTo]);

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

    router.push(resolvedReturnHref);
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

    const params = new URLSearchParams({
      sessionId,
    });
    if (origin) {
      params.set("origin", origin);
    }
    if (returnTo) {
      params.set("returnTo", returnTo);
    }
    router.push(`/quiz-features/questions?${params.toString()}`);
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


  const disabled =
    isLoadingCards ||
    !isCurrentStepValid ||
    isSubmitting ||
    step !== 0;

  return (
    <div
      style={{
        width: isLarge ? "65vw" : "85vw",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "space-evenly",
        justifyContent: "space-evenly",
        overflow: "hidden",
        gap: isSmall ? "var(--space-sm)" : "var(--space-sm)",
        paddingInline: isSmall
          ? "var(--space-sm)"
          : isMedium
            ? "var(--space-sm)"
            : "var(--space-xl)",
        boxSizing: "border-box",
        alignSelf: "center",
        justifySelf: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: isSmall ? "center" : "space-between",
          alignItems: "center",
          gap: isSmall ? "var(--space-md)" : "var(--space-xl)",
          flexWrap: "wrap",
          position: "relative",
          width: "100%",
          textAlign: isSmall ? "center" : "center",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: isSmall ? "center" : "flex-start",
            justifyContent: "center",
            gap: "var(--space-xxs)",
          }}
        >
          <h1
            style={{
              margin: 0,
              color: "white",
              fontSize: isSmall ? "var(--text-lg)" : "var(--text-xl)",
              fontFamily: "var(--font-nova-square)",
              lineHeight: "var(--line-tight)",
            }}
          >
            {currentTitle}
          </h1>

          <p
            style={{
              margin: 0,
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
            flexShrink: 0,
          }}
        >
          {error}
        </p>
      ) : null}

      <div
        style={{
          background: "var(--bg-grey)",
          borderRadius: "var(--radius-xl)",
          width: "100%",
          height: "fit-content",
          maxHeight: isSmall ? "100%" : "60%",
          padding: "var(--space-lg)",
          boxSizing: "border-box",
          overflowY: "auto",
          scrollbarWidth: "none",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "flex-start",
          alignSelf: "center",
          flexShrink: 1,
        }}
      >
        {isLoadingCards ? (
          <div
            style={{
              color: "var(--dark-grey)",
              textAlign: "center",
              paddingTop: isSmall ? "var(--space-xl)" : "var(--space-2xl)",
              paddingBottom: isSmall ? "var(--space-xl)" : "var(--space-2xl)",
              fontSize: isSmall ? "var(--text-sm)" : "var(--text-base)",
              fontFamily: "var(--font-jura)",
              lineHeight: "var(--line-normal)",
              width: "100%",
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
              paddingBottom: isSmall ? "var(--space-xl)" : "var(--space-2xl)",
              fontSize: isSmall ? "var(--text-sm)" : "var(--text-base)",
              fontFamily: "var(--font-jura)",
              lineHeight: "var(--line-normal)",
              width: "100%",
            }}
          >
            No cards available for this step yet.
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              flexWrap: "wrap",
              gap: isSmall
                ? "var(--space-sm)"
                : isMedium
                  ? "var(--space-md)"
                  : "var(--space-sm)",
              justifyContent: "center",
              alignItems: "flex-start",
              alignContent: "flex-start",
              width: "100%",
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
                    minWidth: "fit-content",
                    flex: 1,

                    backgroundColor: isSelected
                      ? "var(--light-green)"
                      : "var(--medium-blue)",

                    color: isSelected
                      ? "var(--bg-color)"
                      : "var(--light-blue)",

                    borderRadius: "var(--radius-lg)",

                    padding: "",

                    textAlign: "center",
                    cursor: "pointer",

                    height: "fit-content",

                    fontSize: "var(--text-base)",
                    fontFamily: "var(--font-jura)",
                    fontWeight: "800",
                    paddingInline: "var(--space-sm)",
                    paddingBlock: "var(--space-xs)",



                  }}>
                  {card.name}


                </button>
              );
            })}
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-start",
          alignItems: "center",
          width: "100%",
          gap: isSmall ? "var(--space-md)" : "var(--space-lg)",
          flexDirection: "column",
          flexShrink: 0,
          alignSelf: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            width: "100%",
            gap: isSmall ? "var(--space-md)" : "var(--space-lg)",
            flexDirection: "row",
            flexShrink: 0,
            alignSelf: "center",
          }}
        >
            <Button
              variant="secondary-inverted"
              type="button"
              onClick={handleBack}
              disabled={step == 0}
              style={{
                paddingInline: "var(--space-2xl)",
                paddingBlock: "0",
                paddingLeft: "0",
                gap: "var(--space-xl)",
                height: "fit-content",
                width: "fit-content",
                maxWidth: isSmall ? "100%" : "fit-content",
                flex: isSmall ? 1 : "none",
                justifyContent: "space-between",
                borderRadius: "999px",
              }}
            >
              <img
                src={"/global/next.svg"}
                style={{
                  height: "var(--icon-md)",
                  transform: "rotate(180deg)",
                  backgroundColor: "white",
                  padding: "var(--space-xxs)",
                  boxSizing: "content-box",
                  borderRadius: "999px",
                }}
              />
              Previous
            </Button>

          <Button
            variant={"primary-inverted"}
            type="button"
            onClick={handleNext}
            disabled={disabled}
            style={{
              paddingInline: "var(--space-2xl)",
              paddingBlock: "0",
              paddingRight: "0",
              gap: "var(--space-xl)",
              height: "fit-content",
              width: "fit-content",
              maxWidth: isSmall ? "100%" : "fit-content",
              flex: isSmall ? 1 : "none",
              justifyContent: "space-between",
              borderRadius: "999px",
              opacity: disabled ? 0.55 : 1,
            }}
          >
            Next
            <img
              src={"/global/next.svg"}
              style={{
                height: "var(--icon-md)",
                backgroundColor: "white",
                padding: "var(--space-xxs)",
                boxSizing: "content-box",
                borderRadius: "999px",
              }}
            />
          </Button>
        </div>
        {step !== 0 &&
          <Button
            variant="primary"
            type="button"
            onClick={handleNext}
            disabled={isLoadingCards || !isCurrentStepValid || isSubmitting}
            style={{
              paddingInline: "var(--space-2xl)",
              paddingBlock: "var(--space-xxs)",
              height: "fit-content",
              width: isSmall ? "100%" : "fit-content",
              marginLeft: isSmall ? 0 : "auto",
              flex: "none",
              opacity: isLoadingCards || !isCurrentStepValid || isSubmitting ? 0.55 : 1,
            }}
          >
            Start Questions
          </Button>
        }
      </div>
    </div>
  );
}