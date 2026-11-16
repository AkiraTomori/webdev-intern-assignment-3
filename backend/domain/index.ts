import { ForeignLanguageSubject, Subject } from "./subject";
import { SubjectGroup } from "./subject-group";
import { SubjectRegistry } from "./subject-registry";

// The one place subjects are defined. Order = CSV column order = api.md §3.
export const subjects = new SubjectRegistry([
  new Subject("toan", "Toán"),
  new Subject("ngu_van", "Ngữ văn"),
  new ForeignLanguageSubject("ngoai_ngu", "Ngoại ngữ"),
  new Subject("vat_li", "Vật lí"),
  new Subject("hoa_hoc", "Hoá học"),
  new Subject("sinh_hoc", "Sinh học"),
  new Subject("lich_su", "Lịch sử"),
  new Subject("dia_li", "Địa lí"),
  new Subject("gdcd", "GDCD"),
]);

export type SubjectCode = ReturnType<typeof subjects.codes>[number];

// Group A (Toán, Vật lí, Hoá học) is a combination built from the registry, not a hard-coded column list.
export const GROUP_A = SubjectGroup.fromCodes("A", subjects, ["toan", "vat_li", "hoa_hoc"]);

export { Score } from "./score";
export type { ScoreIssue, ScoreParseResult } from "./score";
export { ScoreLevel } from "./score-level";
export type { ScoreLevelKey } from "./score-level";
export { ForeignLanguageSubject, Subject } from "./subject";
export type { RawRow, RelatedIssue, SubjectScoreIssue, SubjectScoreResult } from "./subject";
export { SubjectGroup } from "./subject-group";
export type { ScoreMap } from "./subject-group";
export { SubjectRegistry } from "./subject-registry";
