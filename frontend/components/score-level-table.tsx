import { useLocale, useTranslations } from "next-intl";
import type { ScoreLevelsReport } from "@/lib/api/score-levels";
import { LEVEL_KEYS } from "@/lib/api/vocabulary";
import { formatCount } from "@/lib/format-count";
import card from "./card.module.css";
import styles from "./reports-view.module.css";

/** The numbers behind the chart. Required, not optional: colour is never the only way to read them. */
export function ScoreLevelTable({ report }: { report: ScoreLevelsReport }) {
  const t = useTranslations();
  const locale = useLocale();
  return (
    <div className={`${card.scroll} ${styles.tableSection}`} role="region" aria-label={t("reports.tableCaption")} tabIndex={0}>
      <table className={card.table}>
        <caption>{t("reports.tableCaption")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("reports.subjectColumn")}</th>
            {LEVEL_KEYS.map((key) => (
              <th key={key} scope="col" className={card.num}>
                <span className={styles.swatch} style={{ background: `var(--level-${key})` }} aria-hidden="true" />
                {t(`level.${key}`)}
              </th>
            ))}
            <th scope="col" className={card.num}>
              {t("reports.totalColumn")}
            </th>
          </tr>
        </thead>
        <tbody>
          {report.subjects.map(({ code, total, counts }) => (
            <tr key={code}>
              <th scope="row">{t(`subject.${code}`)}</th>
              {LEVEL_KEYS.map((key) => (
                <td key={key} className={card.num}>
                  {formatCount(counts[key], locale)}
                </td>
              ))}
              <td className={`${card.num} ${styles.total}`}>{formatCount(total, locale)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
