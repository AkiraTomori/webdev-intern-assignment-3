"use client";

import { useTranslations } from "next-intl";
import type { ApiErrorKey } from "@/lib/api/client";
import styles from "./request-status.module.css";

/** Grey block as tall as the real content, so the layout does not jump when data arrives. */
export function LoadingBlock({ height }: { height: string }) {
  const t = useTranslations("common");
  return (
    <div className={styles.loading} style={{ height }} aria-busy="true">
      <span className={styles.srOnly}>{t("loading")}</span>
    </div>
  );
}

/** Error inside the card, never a blank page. `onRetry` is left out when retrying cannot help. */
export function ErrorBlock({ errorKey, onRetry }: { errorKey: ApiErrorKey; onRetry?: () => void }) {
  const t = useTranslations();
  return (
    <div className={styles.error} role="alert">
      <p>{t(`error.${errorKey}`)}</p>
      {onRetry ? (
        <button type="button" className={styles.button} onClick={onRetry}>
          {t("common.retry")}
        </button>
      ) : null}
    </div>
  );
}
