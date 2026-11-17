import { useTranslations } from "next-intl";
import type { Candidate } from "@/lib/api/candidate";
import { SUBJECT_CODES } from "@/lib/api/vocabulary";
import { formatScore } from "@/lib/format-score";
import card from "./card.module.css";
import styles from "./lookup-view.module.css";

/** Nine rows in SUBJECT_CODES order. A missing score is "Not taken", never 0 (GS-02-AC02). */
export function CandidateResult({ candidate }: { candidate: Candidate }) {
  const t = useTranslations();
  return (
    <table className={card.table}>
      <thead>
        <tr>
          <th scope="col">{t("lookup.subjectColumn")}</th>
          <th scope="col" className={card.num}>
            {t("lookup.scoreColumn")}
          </th>
        </tr>
      </thead>
      <tbody>
        {SUBJECT_CODES.map((code) => {
          const score = candidate.scores[code];
          // Show the code N1..N7 only next to a score; never a language name (GS-02-AC06, Q-04).
          const name =
            code === "ngoai_ngu" && score !== null && candidate.foreignLanguageCode
              ? t("lookup.foreignLanguageWithCode", { code: candidate.foreignLanguageCode })
              : t(`subject.${code}`);
          return (
            <tr key={code}>
              <th scope="row">{name}</th>
              <td className={card.num}>
                {score === null ? <span className={styles.notTaken}>{t("lookup.notTaken")}</span> : formatScore(score)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
