"use client";

import { useEffect, useRef } from "react";

interface Options {
  /** Polling interval in milliseconds. Defaults to 30 seconds. */
  intervalMs?: number;
  /** Whether polling is active. Defaults to true. */
  enabled?: boolean;
  /** Callback fired on each successful poll. */
  onPoll: () => void | Promise<void>;
}

/**
 * Polls a callback at a fixed interval while the tab is visible.
 *
 * Uses `visibilitychange` to pause polling when the tab is hidden,
 * and immediately resumes (with one fresh poll) when the tab becomes
 * visible again. This keeps the API costs low and avoids stale data
 * when the user returns to the page.
 */
export function useDeploymentPolling({
  intervalMs = 30000,
  enabled = true,
  onPoll,
}: Options) {
  const onPollRef = useRef(onPoll);
  onPollRef.current = onPoll;

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;

    let timer: ReturnType<typeof setInterval> | null = null;

    function start() {
      if (timer) return;
      timer = setInterval(() => {
        onPollRef.current();
      }, intervalMs);
    }

    function stop() {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        // Immediate refresh, then resume interval
        onPollRef.current();
        start();
      } else {
        stop();
      }
    }

    if (document.visibilityState === "visible") {
      start();
    }

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled, intervalMs]);
}
