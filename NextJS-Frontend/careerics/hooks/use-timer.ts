/**
 * Countdown / count-up timer hook for interview recording.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseTimerOptions {
  /** If set, counts DOWN from this value (seconds). Otherwise counts UP. */
  initialSeconds?: number;
  /** Auto-start the timer on mount. Default false. */
  autoStart?: boolean;
  /** Called when a countdown reaches 0. */
  onComplete?: () => void;
}

interface UseTimerReturn {
  /** Current elapsed / remaining seconds. */
  seconds: number;
  /** Whether the timer is currently ticking. */
  isRunning: boolean;
  /** Formatted mm:ss string. */
  formatted: string;
  start: () => void;
  pause: () => void;
  reset: () => void;
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function useTimer(options: UseTimerOptions = {}): UseTimerReturn {
  const { initialSeconds = 0, autoStart = false, onComplete } = options;

  const isCountdown = initialSeconds > 0;
  const [seconds, setSeconds] = useState(initialSeconds);
  const [isRunning, setIsRunning] = useState(autoStart);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(() => setIsRunning(true), []);
  const pause = useCallback(() => setIsRunning(false), []);
  const reset = useCallback(() => {
    setIsRunning(false);
    setSeconds(initialSeconds);
  }, [initialSeconds]);

  useEffect(() => {
    if (!isRunning) {
      clearTimer();
      return;
    }

    intervalRef.current = setInterval(() => {
      setSeconds((prev) => {
        if (isCountdown) {
          if (prev <= 1) {
            setIsRunning(false);
            onCompleteRef.current?.();
            return 0;
          }
          return prev - 1;
        }
        return prev + 1;
      });
    }, 1_000);

    return clearTimer;
  }, [isRunning, isCountdown, clearTimer]);

  return {
    seconds,
    isRunning,
    formatted: formatTime(seconds),
    start,
    pause,
    reset,
  };
}
