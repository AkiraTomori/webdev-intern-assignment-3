import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LookupView } from "@/components/lookup-view";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("lookup");
  return { title: t("title") };
}

export default async function LookupPage() {
  const t = await getTranslations("lookup");

  return (
    <>
      <h1>{t("title")}</h1>
      <LookupView />
    </>
  );
}
