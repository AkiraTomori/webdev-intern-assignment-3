"use client";

import { useTranslations } from "next-intl";
import { getTopGroupA } from "@/lib/api/top-group-a";
import { useApiResource } from "@/lib/use-api-resource";
import card from "./card.module.css";
import { ErrorBlock, LoadingBlock } from "./request-status";
import { TopGroupATable } from "./top-group-a-table";

export function TopGroupAView() {
  const t = useTranslations("topGroupA");
  const { state, retry } = useApiResource(getTopGroupA);

  return (
    <section className={card.card}>
      {state.status === "loading" ? (
        <LoadingBlock height="22rem" />
      ) : state.status === "error" ? (
        <ErrorBlock errorKey={state.error} onRetry={retry} />
      ) : state.data.length === 0 ? (
        <div className={card.empty}>
          <p>{t("empty")}</p>
          <p>{t("emptyHint")}</p>
        </div>
      ) : (
        <TopGroupATable rows={state.data} />
      )}
    </section>
  );
}
