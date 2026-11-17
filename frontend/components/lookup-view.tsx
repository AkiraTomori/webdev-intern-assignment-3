"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { getCandidate, type Candidate } from "@/lib/api/candidate";
import type { ApiErrorKey } from "@/lib/api/client";
import { normalizeSbd } from "@/lib/sbd";
import { useSbdValidation } from "@/lib/use-just-validate";
import card from "./card.module.css";
import { CandidateResult } from "./candidate-result";
import styles from "./lookup-view.module.css";
import { ErrorBlock, LoadingBlock } from "./request-status";
import statusStyles from "./request-status.module.css";

type LookupState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; candidate: Candidate }
  | { status: "error"; error: ApiErrorKey; sbd: string };

export function LookupView() {
  const t = useTranslations();
  const ids = useId();
  const hintId = `${ids}-hint`;
  const errorsId = `${ids}-errors`;

  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const errorsRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const [state, setState] = useState<LookupState>({ status: "idle" });

  useEffect(() => () => controllerRef.current?.abort(), []);

  const search = useCallback(async (sbd: string) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState({ status: "loading" });

    const result = await getCandidate(sbd, controller.signal);
    if (result === null || controller.signal.aborted) return;
    setState(result.ok ? { status: "success", candidate: result.data } : { status: "error", error: result.error, sbd });
  }, []);

  const submit = useCallback(() => {
    const input = inputRef.current;
    if (!input) return;
    // Look up exactly what the person sees: write the trimmed value back.
    const sbd = normalizeSbd(input.value);
    input.value = sbd;
    // The button is disabled while loading; keep focus in the input so the next SBD can be typed.
    input.focus();
    void search(sbd);
  }, [search]);

  useSbdValidation({ formRef, inputRef, errorsRef, message: t("error.INVALID_SBD"), onValid: submit });

  const loading = state.status === "loading";

  return (
    <>
      <section className={card.card}>
        <h2>{t("lookup.formTitle")}</h2>
        <form ref={formRef} noValidate>
          <label htmlFor={`${ids}-sbd`} className={styles.label}>
            {t("lookup.sbdLabel")}
          </label>
          <div className={styles.row}>
            <input
              ref={inputRef}
              id={`${ids}-sbd`}
              name="sbd"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              className={styles.input}
              aria-describedby={`${hintId} ${errorsId}`}
            />
            <button type="submit" className={statusStyles.button} disabled={loading} aria-busy={loading}>
              {loading ? t("lookup.submitting") : t("lookup.submit")}
            </button>
          </div>
          <p id={hintId} className={styles.hint}>
            {t("lookup.sbdHint")}
          </p>
          {/* JustValidate writes into this div; React never renders children into it. */}
          <div id={errorsId} ref={errorsRef} className={styles.errors} />
        </form>
      </section>

      <div aria-live="polite">
        <Result state={state} onRetry={search} />
      </div>
    </>
  );
}

function Result({ state, onRetry }: { state: LookupState; onRetry: (sbd: string) => void }) {
  const t = useTranslations();
  if (state.status === "idle") return null;
  if (state.status === "loading") {
    return (
      <section className={card.card}>
        <LoadingBlock height="16rem" />
      </section>
    );
  }
  if (state.status === "error") {
    // 404 and a backend INVALID_SBD will not change on retry, so no retry button for them.
    const final = state.error === "CANDIDATE_NOT_FOUND" || state.error === "INVALID_SBD";
    return (
      <section className={card.card}>
        <h2>{t("lookup.resultTitle", { sbd: state.sbd })}</h2>
        <ErrorBlock errorKey={state.error} onRetry={final ? undefined : () => onRetry(state.sbd)} />
      </section>
    );
  }
  return (
    <section className={card.card}>
      <h2>{t("lookup.resultTitle", { sbd: state.candidate.sbd })}</h2>
      <CandidateResult candidate={state.candidate} />
    </section>
  );
}
