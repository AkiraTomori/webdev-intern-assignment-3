"use client";

import { useCallback, useEffect, useState } from "react";
import type { ApiErrorKey, ApiResult } from "./api/client";

export type ResourceState<T> = { status: "loading" } | { status: "error"; error: ApiErrorKey } | { status: "success"; data: T };

/**
 * Loads once on mount and again on retry(). `load` must be a stable function (module level), not an
 * inline arrow. The previous request is aborted on retry and on unmount, so a late answer never
 * overwrites a newer one. State holds the error key, not the translated text, so a language change
 * re-translates the message without a new request.
 */
export function useApiResource<T>(load: (signal: AbortSignal) => Promise<ApiResult<T> | null>) {
  const [state, setState] = useState<ResourceState<T>>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal).then((result) => {
      if (result === null || controller.signal.aborted) return;
      setState(result.ok ? { status: "success", data: result.data } : { status: "error", error: result.error });
    });
    return () => controller.abort();
  }, [load, attempt]);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((count) => count + 1);
  }, []);

  return { state, retry };
}
