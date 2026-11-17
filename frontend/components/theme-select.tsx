"use client";

import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import styles from "./select.module.css";

const themes = ["light", "dark", "system"] as const;
const subscribe = () => () => {};

export function ThemeSelect() {
  const t = useTranslations("shell.theme");
  const { theme, setTheme } = useTheme();
  // useTheme() only knows the stored value after mount. Until then show "system" and lock the select, to avoid a hydration mismatch.
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);

  return (
    <label className={styles.field}>
      <span>{t("label")}</span>
      <span className={styles.control}>
        <select value={mounted ? (theme ?? "system") : "system"} disabled={!mounted} onChange={(event) => setTheme(event.target.value)}>
        {themes.map((name) => (
          <option key={name} value={name}>
            {t(name)}
          </option>
        ))}
      </select>
      </span>
    </label>
  );
}
