import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import Link from "next/link";
import { LanguageSelect } from "./language-select";
import { NavMenu } from "./nav-menu";
import { ThemeSelect } from "./theme-select";
import styles from "./app-shell.module.css";

export async function AppShell({ children }: { children: ReactNode }) {
  const t = await getTranslations("shell");

  return (
    <div className={styles.shell}>
      <a href="#main" className={styles.skip}>
        {t("skipToContent")}
      </a>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>
          {t("appName")}
        </Link>
        <div className={styles.controls}>
          <LanguageSelect />
          <ThemeSelect />
        </div>
      </header>
      <div className={styles.body}>
        <aside className={styles.sidebar}>
          <NavMenu />
        </aside>
        <main id="main" tabIndex={-1} className={styles.main}>
          {children}
        </main>
      </div>
      <footer className={styles.footer}>{t("footer")}</footer>
    </div>
  );
}
