"use client";

import { useTranslations } from "next-intl";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errorPage");

  return (
    <>
      <h1>{t("title")}</h1>
      <p>{t("body")}</p>
      <button type="button" onClick={reset}>
        {t("retry")}
      </button>
    </>
  );
}
