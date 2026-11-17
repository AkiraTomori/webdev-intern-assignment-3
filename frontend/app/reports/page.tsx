import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ReportsView } from "@/components/reports-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("reports");
  return { title: t("title") };
}

export default async function ReportsPage() {
  const t = await getTranslations("reports");

  return (
    <>
      <h1>{t("title")}</h1>
      <p>{t("intro")}</p>
      <ReportsView />
    </>
  );
}
