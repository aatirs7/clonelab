"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Debounced persistence for the builders.
 *
 * Six hundred milliseconds, and never on every keystroke: the extra instruction field is
 * a textarea, and a write per character would be one request per letter typed. The
 * trailing write still fires on unmount so a value typed and immediately navigated away
 * from is not lost.
 */
export function useRunPersist(runId: number, delayMs = 600) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Record<string, unknown> | null>(null);

  const flush = useCallback(() => {
    if (!pending.current) return;
    const body = pending.current;
    pending.current = null;
    void fetch(`/api/runs/${runId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }, [runId]);

  const save = useCallback(
    (values: Record<string, unknown>) => {
      pending.current = { ...(pending.current ?? {}), ...values };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, delayMs);
    },
    [flush, delayMs],
  );

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      flush();
    };
  }, [flush]);

  return { save, flush };
}
