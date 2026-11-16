import { getTranslations } from "next-intl/server";
import Link from "next/link";
import styles from "./home.module.css";

const cards = [
  { href: "/lookup", key: "lookup" },
  { href: "/reports", key: "reports" },
  { href: "/top-group-a", key: "topGroupA" },
] as const;

export default async function HomePage() {
  const t = await getTranslations("home");

  return (
    <>
      <h1>{t("title")}</h1>
      <p>{t("intro")}</p>
      <ul className={styles.cards}>
        {cards.map(({ href, key }) => (
          <li key={href}>
            <Link href={href} className={styles.card}>
              <h2>{t(`cards.${key}.title`)}</h2>
              <p>{t(`cards.${key}.description`)}</p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
