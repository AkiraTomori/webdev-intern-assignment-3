"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, locales, resolveLocale } from "@/i18n/config";
import styles from "./select.module.css";

export function LanguageSelect() {
  const t = useTranslations("shell.language");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function change(next: string) {
    const chosen = resolveLocale(next);
    document.cookie = `${LOCALE_COOKIE}=${chosen}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE}; SameSite=Lax`;
    // Re-render the current page on the server in the new language. The URL and client state stay.
    startTransition(() => router.refresh());
  }

  return (
    <label className={styles.field}>
      <span>{t("label")}</span>
      <span className={styles.control}>
        <select value={locale} disabled={pending} onChange={(event) => change(event.target.value)}>
        {locales.map((code) => (
          <option key={code} value={code}>
            {t(code)}
          </option>
        ))}
      </select>
      </span>
    </label>
  );
}
