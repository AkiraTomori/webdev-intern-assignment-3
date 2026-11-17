"use client";

import { useTranslations } from "next-intl";
import { getScoreLevels, isEmptyReport } from "@/lib/api/score-levels";
import { useApiResource } from "@/lib/use-api-resource";
import card from "./card.module.css";
import { ErrorBlock, LoadingBlock } from "./request-status";
import { ScoreLevelChart } from "./score-level-chart";
import { ScoreLevelTable } from "./score-level-table";

export function ReportsView() {
  const t = useTranslations("reports");
  const { state, retry } = useApiResource(getScoreLevels);

  return (
    <section className={card.card}>
      {state.status === "loading" ? (
        <>
          <LoadingBlock height="360px" />
          <div style={{ height: "1rem" }} />
          <LoadingBlock height="14rem" />
        </>
      ) : state.status === "error" ? (
        <ErrorBlock errorKey={state.error} onRetry={retry} />
      ) : isEmptyReport(state.data) ? (
        <div className={card.empty}>
          <p>{t("empty")}</p>
          <p>{t("emptyHint")}</p>
        </div>
      ) : (
        <>
          <ScoreLevelChart report={state.data} />
          <ScoreLevelTable report={state.data} />
        </>
      )}
    </section>
  );
}
