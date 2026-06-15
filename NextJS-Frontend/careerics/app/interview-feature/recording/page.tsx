"use client";
import { useRouter } from "next/navigation";
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import InterviewLayout from "@/components/ui/interview";
import InterviewContainer from "@/components/ui/interview-card";
import { interviewService } from "@/services/interview.service";
import { useAuth } from "@/providers/auth-provider";
import { useInterviewFlow } from "@/hooks";
import {
  buildInterviewAudioCandidates,
  type InterviewAudioKind,
} from "@/lib/interview-media";
import { Button } from "@/components/ui/button";
import { useResponsive } from "@/hooks/useResponsive";

export default function RecordingPage() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    sessionId,
    followupText,
    followupAudio,
    followupMode,
    currentQ,
    questions,
    isQuestionsLoading,
    questionsError,
    buildRecordingUrl,
    buildAnalyzingUrl,
  } = useInterviewFlow();

  const [activeId, setActiveId] = useState(currentQ);
  const unlockedId = currentQ;

  const [status, setStatus] = useState<"idle" | "recording" | "stopped">("idle");
  const [seconds, setSeconds] = useState(0);
  const [recordedMedia, setRecordedMedia] = useState<Blob | null>(null);
  const [recordedPreviewUrl, setRecordedPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinalizingRecording, setIsFinalizingRecording] = useState(false);
  const [isReplayingQuestion, setIsReplayingQuestion] = useState(false);
  const [isPromptAutoplayBlocked, setIsPromptAutoplayBlocked] = useState(false);
  const [actionError, setActionError] = useState("");

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const promptAudioElementRef = useRef<HTMLAudioElement | null>(null);
  const promptCandidateIndexRef = useRef(0);
  const pendingSubmitRef = useRef(false);

  const currentQuestion = questions.find((q) => q.id === activeId) || null;
  const currentQuestionText = followupText || currentQuestion?.text || "";
  const promptAudioUrl = useMemo(() => {
    if (followupText) {
      return followupAudio;
    }

    return currentQuestion?.audioUrl || "";
  }, [currentQuestion, followupAudio, followupText]);
  const promptAudioKind: InterviewAudioKind = followupText ? "followups" : "questions";
  const promptAudioCandidates = useMemo(
    () => buildInterviewAudioCandidates(promptAudioUrl, promptAudioKind),
    [promptAudioKind, promptAudioUrl],
  );
  const canReplayQuestionAudio = Boolean(promptAudioUrl || currentQuestionText);

  const layoutQuestions = useMemo(
    () =>
      questions.map((q) => ({
        ...q,
        title: q.text,
      })),
    [questions],
  );

  const submitBlockedReason =
    !user?.id
      ? "Please sign in first so an interview session can be created."
      : !sessionId
        ? actionError || "Start your interview from the interview home first."
        : isQuestionsLoading
          ? "Questions are still loading."
          : isSubmitting
            ? "Submission is already in progress."
            : !questions.length
              ? "No questions are available for this interview type."
              : !currentQuestion?.questionId
                ? "Current question is not ready yet."
                : "";

  const isSubmitDisabled = Boolean(submitBlockedReason);

  useEffect(() => {
    setActiveId(currentQ);
  }, [currentQ]);

  // 3. Timer Logic
  useEffect(() => {
    if (status === "recording") {
      timerRef.current = setInterval(() => setSeconds((prev) => prev + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status]);

  const formatTime = (s: number) => {
    const mins = Math.floor(s / 60).toString().padStart(2, "0");
    const secs = (s % 60).toString().padStart(2, "0");
    return `${mins}:${secs}`;
  };

  const stopAndCleanupMedia = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (previewVideoRef.current) {
      previewVideoRef.current.srcObject = null;
    }
  };

  const getRecorderOptions = (): MediaRecorderOptions | undefined => {
    if (typeof MediaRecorder === "undefined") return undefined;

    const preferredTypes = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];

    const supportedType = preferredTypes.find((type) => MediaRecorder.isTypeSupported(type));
    return supportedType ? { mimeType: supportedType } : undefined;
  };

  // 4. Action Handlers
  const handleCameraToggle = async () => {
    if (status === "recording") {
      setIsFinalizingRecording(true);
      stopAndCleanupMedia();
      setStatus("stopped");
      return;
    }

    try {
      setActionError("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      streamRef.current = stream;

      if (previewVideoRef.current) {
        previewVideoRef.current.srcObject = stream;
      }

      const recorder = new MediaRecorder(stream, getRecorderOptions());
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        setIsFinalizingRecording(false);

        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "video/webm",
        });
        if (blob.size > 0) {
          if (recordedPreviewUrl) {
            URL.revokeObjectURL(recordedPreviewUrl);
          }

          setRecordedMedia(blob);
          setRecordedPreviewUrl(URL.createObjectURL(blob));

          if (pendingSubmitRef.current) {
            pendingSubmitRef.current = false;
            void submitRecordedAnswer(blob);
          }
        } else if (pendingSubmitRef.current) {
          pendingSubmitRef.current = false;
          setActionError("No recording data was captured. Please record again.");
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecordedMedia(null);
      if (recordedPreviewUrl) {
        URL.revokeObjectURL(recordedPreviewUrl);
        setRecordedPreviewUrl(null);
      }
      setSeconds(0);
      setStatus("recording");
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        setActionError("Camera and microphone access are required to record an answer. Please allow permissions in your browser settings.");
      } else if (error instanceof DOMException && error.name === "NotFoundError") {
        setActionError("No camera or microphone device was found.");
      } else {
        setActionError("Unable to start recording. Please refresh and try again.");
      }
      setStatus("idle");
    }
  };

  const handleReset = () => {
    pendingSubmitRef.current = false;
    stopAndCleanupMedia();
    setStatus("idle");
    setIsFinalizingRecording(false);
    setSeconds(0);
    setRecordedMedia(null);
    if (recordedPreviewUrl) {
      URL.revokeObjectURL(recordedPreviewUrl);
      setRecordedPreviewUrl(null);
    }
    setActionError("");
  };

  useEffect(() => {
    return () => {
      stopAndCleanupMedia();
      if (recordedPreviewUrl) {
        URL.revokeObjectURL(recordedPreviewUrl);
      }
    };
  }, [recordedPreviewUrl]);

  const playPromptAudio = useCallback(
    async (startIndex = 0): Promise<boolean> => {
      const player = promptAudioElementRef.current;
      if (!player || !promptAudioCandidates.length) {
        return false;
      }

      const safeStartIndex = Math.max(0, Math.min(startIndex, promptAudioCandidates.length - 1));

      for (let index = safeStartIndex; index < promptAudioCandidates.length; index += 1) {
        const candidate = promptAudioCandidates[index];
        promptCandidateIndexRef.current = index;

        if (player.src !== candidate) {
          player.src = candidate;
          player.load();
        }

        player.currentTime = 0;
        player.muted = false;
        player.volume = 1;

        try {
          await player.play();
          setIsPromptAutoplayBlocked(false);
          return true;
        } catch (error) {
          const blocked = error instanceof DOMException && error.name === "NotAllowedError";
          if (blocked) {
            setIsPromptAutoplayBlocked(true);
            return false;
          }
        }
      }

      return false;
    },
    [promptAudioCandidates],
  );

  const speakPromptFallback = useCallback((): boolean => {
    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window) ||
      !currentQuestionText.trim()
    ) {
      return false;
    }

    try {
      const utterance = new SpeechSynthesisUtterance(currentQuestionText.trim());
      utterance.lang = "en-US";
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
      return true;
    } catch {
      return false;
    }
  }, [currentQuestionText]);

  useEffect(() => {
    promptCandidateIndexRef.current = 0;

    if (!promptAudioCandidates.length) {
      setIsPromptAutoplayBlocked(false);
      speakPromptFallback();
      return;
    }

    void playPromptAudio(0);
  }, [activeId, followupText, playPromptAudio, promptAudioCandidates, speakPromptFallback]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (!isPromptAutoplayBlocked || typeof window === "undefined") {
      return;
    }

    let disposed = false;

    const retryPlayback = () => {
      if (disposed) {
        return;
      }

      void playPromptAudio(promptCandidateIndexRef.current);
    };

    window.addEventListener("pointerdown", retryPlayback, { once: true });
    window.addEventListener("keydown", retryPlayback, { once: true });

    return () => {
      disposed = true;
      window.removeEventListener("pointerdown", retryPlayback);
      window.removeEventListener("keydown", retryPlayback);
    };
  }, [isPromptAutoplayBlocked, playPromptAudio]);

  const handlePromptAudioError = () => {
    const nextIndex = promptCandidateIndexRef.current + 1;
    if (nextIndex < promptAudioCandidates.length) {
      void playPromptAudio(nextIndex);
      return;
    }

    speakPromptFallback();
  };

  const submitRecordedAnswer = async (media: Blob) => {
    if (!sessionId || !currentQuestion?.questionId || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setActionError("");

    const submitResponse = await interviewService.submitAnswer(
      sessionId,
      currentQuestion.questionId,
      media,
      Boolean(followupText || followupMode),
    );

    setIsSubmitting(false);

    if (!submitResponse.success) {
      setActionError(submitResponse.message || "Failed to submit answer.");
      return;
    }

    router.push(
      buildAnalyzingUrl({
        q: String(activeId),
        questionId: currentQuestion.questionId,
        answerId: submitResponse.data?.answer_id,
        followupMode: Boolean(followupText || followupMode),
      }),
    );
  };

  const handleSubmit = async () => {
    if (!sessionId || !currentQuestion?.questionId || isSubmitting) {
      return;
    }

    if (status === "recording") {
      pendingSubmitRef.current = true;
      setIsFinalizingRecording(true);
      stopAndCleanupMedia();
      setStatus("stopped");
      return;
    }

    if (status === "stopped" && isFinalizingRecording) {
      pendingSubmitRef.current = true;
      return;
    }

    if (!recordedMedia) {
      setActionError("Record your answer first, then submit.");
      return;
    }

    await submitRecordedAnswer(recordedMedia);
  };

  const onQuestionClick = (id: number) => {
    pendingSubmitRef.current = false;
    setActiveId(id);
    router.replace(
      buildRecordingUrl({
        q: String(id),
        followup: null,
        followupAudio: null,
        followupMode: false,
        questionId: null,
      }),
    );
    handleReset();
  };

  const handleReplayQuestionAudio = async () => {
    if (isReplayingQuestion || !canReplayQuestionAudio) {
      return;
    }

    setIsReplayingQuestion(true);
    setActionError("");

    try {
      const started = await playPromptAudio(promptCandidateIndexRef.current);
      if (!started && !speakPromptFallback()) {
        setActionError("Prompt audio is unavailable right now.");
      }
    } finally {
      setIsReplayingQuestion(false);
    }
  };

  // 5. UI Controls
  const isPeeking = activeId !== unlockedId;
  const { isLarge, isMedium, isSmall } = useResponsive();

  const controls = (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: "var(--space-2xl)",
      opacity: isPeeking ? 0.3 : 1, // Dim controls if looking at a future question
      pointerEvents: isPeeking ? "none" : "auto"
    }}>
      <img
        src={status === "idle" ? "/interview/record.svg" : status === "recording" ? "/interview/pause.svg" : "/interview/Play.svg"}
        alt="Control"
        style={{ height: "var(--icon-2xl)", cursor: isQuestionsLoading ? "not-allowed" : "pointer", opacity: isQuestionsLoading ? 0.5 : 1 }}
        onClick={handleCameraToggle}
      />
      <span style={{ fontSize: "var(--text-lg)", color: "white", fontFamily: "var(--font-nova-square)", minWidth: "120px", textAlign: "center" }}>
        {formatTime(seconds)}
      </span>
      <img
        src="/interview/retake.svg"
        alt="Reset"
        style={{ height: "var(--icon-2xl)", cursor: "pointer" }}
        onClick={handleReset}
      />

    </div>
  );

  return (
    <InterviewLayout
      title="Interview Questions"
      questions={layoutQuestions}
      currentActiveId={activeId}
      unlockedStepId={unlockedId}
      onQuestionClick={onQuestionClick}
    >
      <div
        style={{
          width: "var(--container-sm)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "relative",
          gap: "var(--space-lg)",
          justifyContent: "space-evenly",
          height: "100%"
        }}
      >
        <audio
          ref={promptAudioElementRef}
          preload="auto"
          onError={handlePromptAudioError}
          style={{ display: "none" }}
        />
        <div
          style={{
            display: "flex",
            width: "100%",
            justifyContent: "space-between",
            alignItems: "flex-start",
            height: "fit-content",
            gap: "var(--space-lg)",
          }}
        >

          <h2
            style={{
              margin: 0,
              textAlign: "center",
              fontSize: followupText ? "var(--text-xs)" : "var(--text-lg)",
              lineHeight: "var(--line-normal)",
              color: "var(--text-primary)",
              fontFamily: "var(--font-nova-square), sans-serif",
            }}
          >
            {`${followupText ? "" : `${unlockedId} .`} ${currentQuestionText}`}
          </h2>
          <Button
            type="button"
            variant="primary-inverted"
            onClick={() => void handleReplayQuestionAudio()}
            disabled={!canReplayQuestionAudio || isReplayingQuestion}
            style={{
              border: "none",
              borderRadius: "999px",
              height: "fit-content",
              paddingBlock: "var(--space-xs)",
              paddingInline: "var(--space-lg)",
              fontSize: "var(--text-sm)",
              fontFamily: "var(--font-nova-square)",
              fontWeight: 700,
              cursor: !canReplayQuestionAudio || isReplayingQuestion ? "not-allowed" : "pointer",
              opacity: !canReplayQuestionAudio || isReplayingQuestion ? 0.65 : 1,
            }}
          >
            <img
            src="/interview/speaker.svg"
            style={{
              height:"var(--icon-xs)"
            }}
            />
            
            {isReplayingQuestion ? "Replaying..." : "Replay"}
          </Button>
        </div>

        <InterviewContainer
          // STICKY TITLE: Always shows the unlocked question
          questionTitle={`${unlockedId}. ${currentQuestionText}`}
          videoContent={
            <div style={{
              width: "100%",
              color: "white",
              fontSize: "18px",
              textAlign: "center"
            }}
            >
              {isQuestionsLoading
                ? "Loading questions..."
                : questionsError || actionError
                  ? questionsError || actionError
                  : !user?.id
                    ? "Please sign in to start interview session."
                    : !sessionId
                      ? "This interview session is missing. Start from the interview home first."
                      : status === "recording"
                        ? " Recording..."
                        : isFinalizingRecording
                          ? "Finalizing recording..."
                          : status === "stopped"
                            ? "⏸ Paused"
                            : recordedMedia
                              ? "Ready to submit"
                              : ""}

              <video
                ref={previewVideoRef}
                autoPlay={status === "recording"}
                muted
                playsInline
                controls={status !== "recording"}
                src={status !== "recording" ? recordedPreviewUrl ?? undefined : undefined}
                style={{
                  width: "100%",
                  objectFit: "cover",
                  borderRadius: "24px",
                  transform: "scaleX(-1)",
                  display: status === "recording" || recordedPreviewUrl ? "block" : "none",
                }}
              />
            </div>

          }
          controlsContent={controls}
          actionButton={
            !sessionId ? (
              <button
                onClick={() => router.push("/features/interview")}
                disabled={false}
                title={submitBlockedReason || undefined}
                style={{
                  background: "var(--primary-green)",
                  padding: "15px 100px",
                  borderRadius: "15px",
                  border: "none",
                  fontWeight: "bold",
                  fontSize: "18px",
                  fontFamily: "var(--font-nova-square)",
                  cursor: "pointer",
                  opacity: 1,
                  transition: "0.3s",
                  color: "#1a1a1a"
                }}
              >
                Back To Interview Home
              </button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={isSubmitDisabled}
                title={submitBlockedReason || undefined}
                style={{
                  cursor: isSubmitDisabled ? "not-allowed" : "pointer",
                  opacity: isSubmitDisabled ? 0.5 : 1,
                  paddingInline: "var(--space-2xl)",
                }}
              >
                {isSubmitting ? "Submitting..." : isFinalizingRecording ? "Preparing..." : "Submit"}
              </Button>
            )
          }
        />
      </div>
    </InterviewLayout>
  );
}
