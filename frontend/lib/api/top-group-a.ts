import { getJson } from "./client";
import { isRecord, isSbd, isScore } from "./guards";

/** Field names of the top-list rows, not a definition of group A. test/vocabulary.test.ts compares them with GROUP_A. */
export const GROUP_A_CODES = ["toan", "vat_li", "hoa_hoc"] as const;
export type GroupACode = (typeof GROUP_A_CODES)[number];

export type TopGroupARow = { rank: number; sbd: string; total: number } & Record<GroupACode, number>;

const MAX_ROWS = 10;
const MAX_TOTAL = 30;

/** Accepts the top-list response (rows ranked 1..n). Order is the API's: nothing re-sorts it. */
export function parseTopGroupAResponse(data: unknown): TopGroupARow[] | null {
  if (!Array.isArray(data) || data.length > MAX_ROWS) return null;

  const rows: TopGroupARow[] = [];
  for (const [index, item] of data.entries()) {
    if (!isRecord(item) || item.rank !== index + 1 || !isSbd(item.sbd)) return null;
    const total = item.total;
    if (typeof total !== "number" || !Number.isFinite(total) || total < 0 || total > MAX_TOTAL) return null;
    const { toan, vat_li, hoa_hoc } = item;
    if (!isScore(toan) || !isScore(vat_li) || !isScore(hoa_hoc)) return null;
    rows.push({ rank: item.rank, sbd: item.sbd, toan, vat_li, hoa_hoc, total });
  }
  return rows;
}

export function getTopGroupA(signal?: AbortSignal) {
  return getJson("/api/reports/top-group-a", parseTopGroupAResponse, signal);
}
