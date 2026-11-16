import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("topGroupA");
  return { title: t("title") };
}

export default async function TopGroupAPage() {
  const t = await getTranslations("topGroupA");

  return (
    <>
      <h1>{t("title")}</h1>
      <p>{t("placeholder")}</p>
    </>
  );
}
