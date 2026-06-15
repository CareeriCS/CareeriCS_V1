"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import ChoiceCard from "@/components/ui/choice-card";
import TipCard from "@/components/ui/3ateyat";
import CustomizeInterviewPopup from "@/components/ui/popup";
import { ActivityCard } from "@/components/ui/activity-card";
import {
  buildInterviewRecordingRoute,
  buildInterviewSessionName,
  DEFAULT_INTERVIEW_QUESTION_COUNT,
  formatInterviewArchiveDate,
  getTechnicalInterviewTypes,
  MAX_INTERVIEW_QUESTION_COUNT,
  MIN_INTERVIEW_QUESTION_COUNT,
  normalizeInterviewType,
} from "@/lib/interview";
import { useAuth } from "@/providers/auth-provider";
import { interviewService } from "@/services/interview.service";
import { reportsService } from "@/services/reports.service";
import type { APIInterviewArchiveItem } from "@/types";
import { StackContainer } from "@/components/ui/containers/stack";
import { useResponsive } from "@/hooks/useResponsive";
import ChoiceCardHorizontal from "@/components/ui/choice-card-horizontal";

export default function Interview() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  const [startingInterviewType, setStartingInterviewType] = useState<string | null>(null);
  const [archiveItems, setArchiveItems] = useState<APIInterviewArchiveItem[]>([]);
  const [isArchiveLoading, setIsArchiveLoading] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [technicalTypes, setTechnicalTypes] = useState<string[]>([]);
  const [isLoadingTechnicalTypes, setIsLoadingTechnicalTypes] = useState(false);
  const [behavioralPopupError, setBehavioralPopupError] = useState<string | null>(null);
  const [technicalPopupError, setTechnicalPopupError] = useState<string | null>(null);
  const [isBehavioralPopupOpen, setIsBehavioralPopupOpen] = useState(false);
  const [isTechnicalPopupOpen, setIsTechnicalPopupOpen] = useState(false);
  const [selectedTechnicalType, setSelectedTechnicalType] = useState("");
  const [startError, setStartError] = useState<string | null>(null);

  const loadArchive = useCallback(async () => {
    if (!user?.id) {
      setArchiveItems([]);
      setArchiveError(null);
      setIsArchiveLoading(false);
      return;
    }

    setIsArchiveLoading(true);
    setArchiveError(null);

    const response = await interviewService.getUserArchive(user.id);
    if (!response.success) {
      setArchiveItems([]);
      setArchiveError(response.message || "Unable to load completed interview reports.");
      setIsArchiveLoading(false);
      return;
    }

    setArchiveItems(response.data ?? []);
    setArchiveError(null);
    setIsArchiveLoading(false);
  }, [user?.id]);

  useEffect(() => {
    void loadArchive();
  }, [loadArchive]);

  const loadTechnicalTypes = useCallback(async () => {
    if (technicalTypes.length || isLoadingTechnicalTypes) {
      return;
    }

    setIsLoadingTechnicalTypes(true);
    setTechnicalPopupError(null);

    const response = await interviewService.listQuestionTypes();
    if (!response.success) {
      setTechnicalPopupError(response.message || "Unable to load technical interview types.");
      setIsLoadingTechnicalTypes(false);
      return;
    }

    const availableTypes = getTechnicalInterviewTypes(response.data ?? []);
    setTechnicalTypes(availableTypes);
    if (!availableTypes.length) {
      setTechnicalPopupError("No technical interview types are available yet.");
    }
    setIsLoadingTechnicalTypes(false);
  }, [isLoadingTechnicalTypes, technicalTypes.length]);

  const startInterview = useCallback(
    async (interviewType: string, questionCount: number) => {
      if (startingInterviewType) {
        return false;
      }

      const normalizedType = normalizeInterviewType(interviewType);

      setStartingInterviewType(normalizedType);
      setBehavioralPopupError(null);
      setTechnicalPopupError(null);
      setStartError(null);

      try {
        if (!isLoading && !user?.id) {
          router.push("/auth/login");
          return false;
        }

        if (!user?.id) {
          return false;
        }

        const response = await interviewService.createSession({
          name: buildInterviewSessionName(normalizedType),
          type: normalizedType,
          status: "in_progress",
          user_id: user.id,
        });

        if (!response.success || !response.data?.id) {
          const message = response.message || "Failed to start interview session.";
          if (normalizedType === "HR") {
            setBehavioralPopupError(message);
          } else {
            setTechnicalPopupError(message);
          }
          setStartError(message);
          return false;
        }

        router.push(
          buildInterviewRecordingRoute(normalizedType, response.data.id, questionCount),
        );
        return true;
      } finally {
        setStartingInterviewType(null);
      }
    },
    [isLoading, router, startingInterviewType, user?.id],
  );

  const handleStartBehavioral = useCallback(() => {
    if (!isLoading && !user?.id) {
      router.push("/auth/login");
      return;
    }

    setBehavioralPopupError(null);
    setIsBehavioralPopupOpen(true);
  }, [isLoading, router, user?.id]);

  const handleConfirmBehavioral = useCallback(
    async (questionCount: number) => {
      const started = await startInterview("HR", questionCount);
      if (started) {
        setIsBehavioralPopupOpen(false);
      }
    },
    [startInterview],
  );

  const handleOpenTechnicalPopup = useCallback(() => {
    if (!isLoading && !user?.id) {
      router.push("/auth/login");
      return;
    }

    setTechnicalPopupError(null);
    setIsTechnicalPopupOpen(true);
    void loadTechnicalTypes();
  }, [isLoading, loadTechnicalTypes, router, user?.id]);

  const handleStartTechnical = useCallback(
    async (technicalType: string, questionCount: number) => {
      setSelectedTechnicalType(technicalType);
      const started = await startInterview(technicalType, questionCount);
      if (started) {
        setIsTechnicalPopupOpen(false);
      }
    },
    [startInterview],
  );

  const handleDownloadArchiveItem = useCallback((item: APIInterviewArchiveItem) => {
    const downloadUrl = reportsService.getReportDownloadUrl(item.report_id);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = item.report_filename;
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }, []);

  const isStartingAnyInterview = Boolean(startingInterviewType);

  const behavioralButtonLabel = useMemo(() => {
    if (startingInterviewType === "HR") {
      return "Starting...";
    }

    if (isLoading) {
      return "Loading...";
    }

    return "Start";
  }, [isLoading, startingInterviewType]);

  const technicalButtonLabel = useMemo(() => {
    if (startingInterviewType && startingInterviewType !== "HR") {
      return "Starting...";
    }

    if (isLoading) {
      return "Loading...";
    }

    return "Start";
  }, [isLoading, startingInterviewType]);

  const { isLarge, isMedium, isSmall } = useResponsive();
  const CardType = isLarge ? ChoiceCard : ChoiceCardHorizontal;
  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isLarge ? "repeat(2, 1fr) 1.2fr" : isMedium ? "1.5fr 1fr" : "1fr",
          gridTemplateRows: isLarge ? "2fr 1fr" : "repeat(3, 1fr)",
          gridColumnGap: "var(--space-lg)",
          gridRowGap: "var(--space-lg)",
          width: "100%",
          height: "100%",
          padding: "var(--space-xl)",
        }}
      >
        <CardType
          title="Behavioral Mock Interview"
          description="Practice answering the most common interview questions and improve how you present yourself and your skills."
          buttonVariant="primary-inverted"
          onClick={handleStartBehavioral}
          disabled={isLoading || isStartingAnyInterview}
          buttonLabel={behavioralButtonLabel}
          icon="/interview/hr.svg"
          style={{ gridArea: isLarge ? "1 / 1 / 2 / 2" : "1 / 1 / 2 / 2" }}
        />

        <CardType
          title="Technical Mock Interview"
          description="Choose the technical career you want to practice, then we will load the matching technical question bank."
          buttonVariant="primary-inverted"
          onClick={handleOpenTechnicalPopup}
          disabled={isLoading || isStartingAnyInterview}
          buttonLabel={technicalButtonLabel}
          icon="/interview/tech.svg"
          style={{ gridArea: isLarge ? "1 / 2 / 2 / 3" : "2 / 1 / 3 / 2" }}
        />

        {!isSmall && (
          <StackContainer
            Title="Interviews Archive"
            centerTitle
            style={{ gridArea: isLarge ? "1 / 3 / 2 / 4" : "1 / 2 / 4 / 3" }}
          >
            {archiveItems.length ? (
              archiveItems.map((item) => (
                <ActivityCard
                  key={item.report_id}
                  title={item.session_name}
                  date={formatInterviewArchiveDate(item.report_created_at || item.session_created_at)}
                  variant="download"
                  onClick={() => handleDownloadArchiveItem(item)}
                />
              ))
            ) : (
              <div
                style={{
                  color: archiveError ? "#FFD3D3" : "#D7E3FF",
                  fontFamily: "var(--font-jura)",
                  textAlign: "center",
                  paddingInline: "20px",
                }}
              >
                {isArchiveLoading
                  ? "Loading completed interview reports..."
                  : archiveError || "No completed interview reports yet."}
              </div>
            )}
          </StackContainer>
        )}

        <TipCard
          title="Tip of the day"
          description="Research the company and interviewers before your interview so you understand the company's goals and show how you fit."
          icon="/global/tip.svg"
          style={{ gridArea: isLarge ? "2 / 1 / 3 / 4" : "3 / 1 / 4 / 2" }}
        />

        {startError ? (
          <p
            style={{
              margin: 0,
              color: "#FFD3D3",
              gridArea: "3 / 1 / 4 / 4",
              alignSelf: "end",
              justifySelf: "center",
              fontFamily: "var(--font-jura)",
            }}
          >
            {startError}
          </p>
        ) : null}
      </div>

      {isBehavioralPopupOpen ? (
        <CustomizeInterviewPopup
          onClose={() => {
            if (isStartingAnyInterview) {
              return;
            }

            setIsBehavioralPopupOpen(false);
          }}
          onStart={(_, questionCount) => {
            void handleConfirmBehavioral(questionCount);
          }}
          options={["HR"]}
          title="Behavioral Interview Details"
          isSubmitting={startingInterviewType === "HR"}
          errorMessage={behavioralPopupError}
          initialValue="HR"
          hideRoleSelect
          minQuestions={MIN_INTERVIEW_QUESTION_COUNT}
          maxQuestions={MAX_INTERVIEW_QUESTION_COUNT}
          initialQuestionCount={DEFAULT_INTERVIEW_QUESTION_COUNT}
          helperText="Choose how many behavioral questions you want to practice in this mock interview."
        />
      ) : null}

      {isTechnicalPopupOpen ? (
        <CustomizeInterviewPopup
          onClose={() => {
            if (isStartingAnyInterview) {
              return;
            }

            setIsTechnicalPopupOpen(false);
          }}
          onStart={(technicalType, questionCount) => {
            void handleStartTechnical(technicalType, questionCount);
          }}
          options={technicalTypes}
          isSubmitting={Boolean(startingInterviewType && startingInterviewType !== "HR")}
          isLoadingOptions={isLoadingTechnicalTypes}
          errorMessage={technicalPopupError}
          initialValue={selectedTechnicalType}
          minQuestions={MIN_INTERVIEW_QUESTION_COUNT}
          maxQuestions={MAX_INTERVIEW_QUESTION_COUNT}
          initialQuestionCount={DEFAULT_INTERVIEW_QUESTION_COUNT}
          helperText="Choose your technical career and how many questions you want, and we'll load the matching question bank."
        />
      ) : null}
    </>
  );
}
