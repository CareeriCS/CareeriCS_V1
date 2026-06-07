"use client";

import { useRouter } from "next/navigation";
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Pause, Play, RotateCcw, Video, Volume2 } from "lucide-react";
import InterviewLayout from "@/components/ui/interview";
import InterviewContainer from "@/components/ui/interview-card";
import { interviewService } from "@/services/interview.service";
import { useAuth } from "@/providers/auth-provider";
import { useInterviewFlow } from "@/hooks";
import {
  buildInterviewAudioCandidates,
  type InterviewAudioKind,
} from "@/lib/interview-media";

const MIN_RECORDING_SECONDS = 5;

export default function RecordingPage() {
  const router = useRouter();
  const { user } = useAuth();

  const {
    sessionId,
    followupText,
    followupAudio,
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
  const secondsRef = useRef(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const promptAudioElementRef = useRef<HTMLAudioElement | null>(null);
  const promptCandidateIndexRef = useRef(0);
  const pendingSubmitRef = useRef(false);

  const currentQuestion = questions.find((q) => q.id === activeId) || null;
  const currentQuestionText = followupText || currentQuestion?.text || "";

  const hasMinimumRecordingLength = seconds >= MIN_RECORDING_SECONDS;
  const minimumSecondsLeft = Math.max(0, MIN_RECORDING_SECONDS - seconds);

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
        : questionsError
          ? questionsError
          : actionError
            ? actionError
            : isQuestionsLoading
              ? "Questions are still loading."
              : isSubmitting
                ? "Submission is already in progress."
                : !questions.length
                  ? "No questions are available for this interview type."
                  : !currentQuestion?.questionId
                    ? "Current question is not ready yet."
                    : status === "recording" && !hasMinimumRecordingLength
                      ? `Record at least ${minimumSecondsLeft} more second${
                          minimumSecondsLeft === 1 ? "" : "s"
                        }.`
                      : status !== "recording" && !recordedMedia
                        ? "Record your answer first."
                        : recordedMedia && !hasMinimumRecordingLength
                          ? `Your answer must be at least ${MIN_RECORDING_SECONDS} seconds.`
                          : "";

  const isSubmitDisabled = Boolean(submitBlockedReason);

  useEffect(() => {
    setActiveId(currentQ);
  }, [currentQ]);

  useEffect(() => {
    if (status === "recording") {
      timerRef.current = setInterval(() => {
        setSeconds((prev) => {
          const next = prev + 1;
          secondsRef.current = next;
          return next;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
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
      previewVideoRef.current.pause();
      previewVideoRef.current.srcObject = null;
    }
  };

  const getRecorderOptions = (): MediaRecorderOptions | undefined => {
    if (typeof MediaRecorder === "undefined") {
      return undefined;
    }

    const preferredTypes = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ];

    const supportedType = preferredTypes.find((type) => MediaRecorder.isTypeSupported(type));

    return supportedType ? { mimeType: supportedType } : undefined;
  };

  const handleCameraToggle = async () => {
    if (status === "recording") {
      setIsFinalizingRecording(true);
      stopAndCleanupMedia();
      setStatus("stopped");
      return;
    }

    try {
      setActionError("");

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });

      streamRef.current = mediaStream;

      if (previewVideoRef.current) {
        previewVideoRef.current.srcObject = mediaStream;
        previewVideoRef.current.muted = true;
        previewVideoRef.current.playsInline = true;
      }

      const recorder = new MediaRecorder(mediaStream, getRecorderOptions());
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

            if (secondsRef.current >= MIN_RECORDING_SECONDS) {
              void submitRecordedAnswer(blob);
            } else {
              setActionError(`Your answer must be at least ${MIN_RECORDING_SECONDS} seconds.`);
            }
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

      secondsRef.current = 0;
      setSeconds(0);
      setStatus("recording");

      requestAnimationFrame(() => {
        void previewVideoRef.current?.play().catch(() => {
          // Browser may delay playback until the video is visible.
        });
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        setActionError(
          "Camera and microphone access are required to record an answer. Please allow permissions in your browser settings.",
        );
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
    secondsRef.current = 0;
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
      if (disposed) return;
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
    if (
      !sessionId ||
      !currentQuestion?.questionId ||
      isSubmitting ||
      secondsRef.current < MIN_RECORDING_SECONDS
    ) {
      return;
    }

    setIsSubmitting(true);
    setActionError("");

    const submitResponse = await interviewService.submitAnswer(
      sessionId,
      currentQuestion.questionId,
      media,
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
        followupMode: Boolean(followupText),
      }),
    );
  };

  const handleSubmit = async () => {
    if (!sessionId || !currentQuestion?.questionId || isSubmitting) {
      return;
    }

    if (secondsRef.current < MIN_RECORDING_SECONDS) {
      setActionError(`Your answer must be at least ${MIN_RECORDING_SECONDS} seconds.`);
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

  const isPeeking = activeId !== unlockedId;

  const controlButtonBase: React.CSSProperties = {
    width: "58px",
    height: "58px",
    borderRadius: "999px",
    border: "1px solid rgba(255,255,255,0.16)",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s ease",
    fontWeight: 400,
  };

  const controls = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "28px",
        opacity: isPeeking ? 0.35 : 1,
        pointerEvents: isPeeking ? "none" : "auto",
        flexWrap: "wrap",
      }}
    >
      <button
        type="button"
        onClick={handleCameraToggle}
        disabled={isQuestionsLoading || isSubmitting || isFinalizingRecording}
        aria-label={status === "recording" ? "Stop recording" : "Start video recording"}
        title={status === "recording" ? "Stop recording" : "Start video recording"}
        style={{
          ...controlButtonBase,
          width: "72px",
          height: "72px",
          background:
            status === "recording"
              ? "rgba(255, 78, 78, 0.16)"
              : "linear-gradient(180deg, #d4ff47 0%, #b9f128 100%)",
          color: status === "recording" ? "#ff6b6b" : "#111827",
          cursor:
            isQuestionsLoading || isSubmitting || isFinalizingRecording ? "not-allowed" : "pointer",
          opacity: isQuestionsLoading || isSubmitting || isFinalizingRecording ? 0.55 : 1,
          boxShadow:
            status === "recording"
              ? "0 0 0 8px rgba(255, 78, 78, 0.08)"
              : "0 10px 30px rgba(212, 255, 71, 0.24)",
        }}
      >
        {status === "recording" ? (
          <Pause size={32} fill="currentColor" strokeWidth={0} />
        ) : status === "stopped" ? (
          <Play size={32} fill="currentColor" strokeWidth={0} />
        ) : (
          <Video size={32} strokeWidth={2.2} />
        )}
      </button>

      <span
        style={{
          fontSize: "40px",
          color: "white",
          fontFamily: "var(--font-nova-square)",
          minWidth: "120px",
          textAlign: "center",
          letterSpacing: "0.04em",
          fontWeight: 400,
        }}
      >
        {formatTime(seconds)}
      </span>

      <button
        type="button"
        onClick={handleReset}
        aria-label="Retake answer"
        title="Retake answer"
        style={{
          ...controlButtonBase,
          background: "rgba(255,255,255,0.08)",
          color: "#ffffff",
          cursor: "pointer",
        }}
      >
        <RotateCcw size={26} />
      </button>

      <button
        type="button"
        onClick={() => void handleReplayQuestionAudio()}
        disabled={!canReplayQuestionAudio || isReplayingQuestion}
        aria-label="Replay question audio"
        title="Replay question audio"
        style={{
          ...controlButtonBase,
          width: "auto",
          height: "46px",
          gap: "8px",
          padding: "0 18px",
          backgroundColor: "#d4ff47",
          color: "#111827",
          border: "none",
          fontSize: "13px",
          fontFamily: "var(--font-nova-square)",
          fontWeight: 400,
          cursor: !canReplayQuestionAudio || isReplayingQuestion ? "not-allowed" : "pointer",
          opacity: !canReplayQuestionAudio || isReplayingQuestion ? 0.65 : 1,
        }}
      >
        <Volume2 size={18} />
        {isReplayingQuestion ? "Replaying..." : "Replay"}
      </button>
    </div>
  );

  return (
    <InterviewLayout
      title="Interview Questions"
      questions={layoutQuestions}
      currentActiveId={activeId}
      unlockedStepId={unlockedId}
      onQuestionClick={onQuestionClick}
      singleLineItems
      disableNavigation
    >
      <div
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "relative",
        }}
      >
        <audio
          ref={promptAudioElementRef}
          preload="auto"
          onError={handlePromptAudioError}
          style={{ display: "none" }}
        />

        <InterviewContainer
          questionTitle={`${unlockedId}. ${currentQuestionText}`}
          videoContent={
            <div
              style={{
                width: "100%",
                height: "100%",
                position: "relative",
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  minHeight: "320px",
                  borderRadius: "24px",
                  overflow: "hidden",
                  background:
                    status === "recording" || recordedPreviewUrl
                      ? "#050505"
                      : "radial-gradient(circle at center, rgba(212,255,71,0.08), rgba(0,0,0,0.2) 45%, rgba(0,0,0,0.45))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transform: status === "recording" ? "scaleX(-1)" : "none",
                }}
              >
                <video
                  ref={previewVideoRef}
                  autoPlay
                  muted
                  playsInline
                  controls={status !== "recording" && Boolean(recordedPreviewUrl)}
                  src={status !== "recording" ? recordedPreviewUrl ?? undefined : undefined}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    borderRadius: "24px",
                    display: status === "recording" || recordedPreviewUrl ? "block" : "none",
                  }}
                />

                {status === "idle" && !recordedPreviewUrl ? (
                  <Video size={54} color="#d4ff47" />
                ) : null}
              </div>
            </div>
          }
          controlsContent={controls}
          actionButton={
            !sessionId ? (
              <button
                type="button"
                onClick={() => router.push("/features/interview")}
                title={submitBlockedReason || undefined}
                style={{
                  background: "#d4ff47",
                  padding: "15px 100px",
                  borderRadius: "15px",
                  border: "none",
                  fontWeight: 400,
                  fontSize: "18px",
                  fontFamily: "var(--font-nova-square)",
                  cursor: "pointer",
                  opacity: 1,
                  transition: "0.3s",
                  color: "#1a1a1a",
                }}
              >
                Back To Interview Home
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitDisabled}
                title={submitBlockedReason || undefined}
                style={{
                  background: "#d4ff47",
                  padding: "15px 100px",
                  borderRadius: "15px",
                  border: "none",
                  fontWeight: 400,
                  fontSize: "18px",
                  fontFamily: "var(--font-nova-square)",
                  cursor: isSubmitDisabled ? "not-allowed" : "pointer",
                  opacity: isSubmitDisabled ? 0.5 : 1,
                  transition: "0.3s",
                  color: "#1a1a1a",
                }}
              >
                {isSubmitting ? "Submitting..." : isFinalizingRecording ? "Preparing..." : "Submit"}
              </button>
            )
          }
        />
      </div>
    </InterviewLayout>
  );
}