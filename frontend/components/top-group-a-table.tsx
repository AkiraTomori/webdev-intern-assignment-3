import { useTranslations } from "next-intl";
import { GROUP_A_CODES, type TopGroupARow } from "@/lib/api/top-group-a";
import { formatScore } from "@/lib/format-score";
import card from "./card.module.css";
import styles from "./top-group-a-view.module.css";

/** Rows in the order the API sent them; nothing here sorts (GS-04-AC05). */
export function TopGroupATable({ rows }: { rows: TopGroupARow[] }) {
  const t = useTranslations();
  return (
    <>
      <div className={card.scroll} role="region" aria-label={t("topGroupA.caption")} tabIndex={0}>
        <table className={card.table}>
          <caption>{t("topGroupA.caption")}</caption>
          <thead>
            <tr>
              <th scope="col" className={card.num}>
                {t("topGroupA.rank")}
              </th>
              <th scope="col">{t("topGroupA.sbd")}</th>
              {GROUP_A_CODES.map((code) => (
                <th key={code} scope="col" className={card.num}>
                  {t(`subject.${code}`)}
                </th>
              ))}
              <th scope="col" className={card.num}>
                {t("topGroupA.total")}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.rank}>
                <th scope="row" className={card.num}>
                  {row.rank}
                </th>
                <td>{row.sbd}</td>
                {GROUP_A_CODES.map((code) => (
                  <td key={code} className={card.num}>
                    {formatScore(row[code])}
                  </td>
                ))}
                <td className={`${card.num} ${styles.total}`}>{formatScore(row.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.note}>{t("topGroupA.note")}</p>
    </>
  );
}
