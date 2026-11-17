import type { PrismaClient } from "../../backend/generated/prisma/client";
import { countCandidates, insertCandidateBatch, truncateCandidates } from "../../backend/model/candidate-model";
import type { NewCandidate } from "../../backend/model/candidate-model";
import { checkHeader, parseCandidateRow, type RowIssue } from "./candidate-row";
import { readCsvLines } from "./csv-lines";

// Measured: @prisma/debug keeps the arguments of its last 100 debug() calls even when DEBUG is off,
// and @prisma/adapter-pg logs every statement with its SQL and all parameters. Retained heap is therefore
// ~100 x one batch: ~110 MB at 1,000 rows, ~750 MB at 5,000 rows (which ran out of a 200 MB heap).
export const DEFAULT_BATCH_SIZE = 1000;
const MAX_LINES_PER_REASON = 20; // caps memory of the error report
const PROGRESS_EVERY = 100_000;

export interface SeedOptions {
  readonly csvPath: string;
  readonly fresh: boolean;
  readonly batchSize: number;
  readonly prisma: PrismaClient;
  readonly log: (line: string) => void;
}

export type SeedOutcome =
  | "seeded" // loaded, table count equals CSV data rows
  | "already-full" // table already holds exactly the CSV rows: nothing done
  | "refused" // table holds a different number of rows: needs --fresh
  | "invalid-rows" // pass 1 found bad rows: nothing written
  | "bad-header"
  | "file-error"
  | "insert-failed" // the database (or a changed file) stopped a batch
  | "count-mismatch"; // loaded, but table count differs from CSV data rows

export interface IssueSummary {
  count: number;
  /** First CSV line numbers (capped). */
  lines: number[];
  /** Issue count per subject code, for subject-bound reasons. */
  subjects: Record<string, number>;
}

export interface SeedReport {
  outcome: SeedOutcome;
  exitCode: number;
  dataRows: number;
  inserted: number;
  batches: number;
  tableCount: number | null;
  issues: Record<string, IssueSummary>;
  message: string | null;
  seconds: number;
  maxRssMb: number;
}

class IssueCollector {
  readonly summary: Record<string, IssueSummary> = {};
  total = 0;

  add(issue: RowIssue): void {
    const entry = (this.summary[issue.reason] ??= { count: 0, lines: [], subjects: {} });
    entry.count += 1;
    this.total += 1;
    if (entry.lines.length < MAX_LINES_PER_REASON && entry.lines.at(-1) !== issue.lineNo) entry.lines.push(issue.lineNo);
    if (issue.subject) entry.subjects[issue.subject] = (entry.subjects[issue.subject] ?? 0) + 1;
  }
}

/**
 * Pass 1 (read only) and pass 2 (load) share the reading; `onRow` receives each valid row and
 * `onInvalid` each rejected one (pass 1 collects them, pass 2 throws).
 */
async function scanCsv(
  csvPath: string,
  onRow: (row: NewCandidate, lineNo: number) => Promise<void>,
  onInvalid: (issues: readonly RowIssue[], lineNo: number) => void,
): Promise<{ ok: true; dataRows: number } | { ok: false; header: string }> {
  let dataRows = 0;
  let sawHeader = false;
  for await (const { lineNo, line } of readCsvLines(csvPath)) {
    const fields = line.split(",");
    if (!sawHeader) {
      sawHeader = true;
      const header = checkHeader(fields);
      if (!header.ok) return { ok: false, header: header.message };
      continue;
    }
    dataRows += 1;
    const parsed = parseCandidateRow(fields, lineNo);
    if (parsed.ok) await onRow(parsed.row, lineNo);
    else onInvalid(parsed.issues, lineNo);
  }
  if (!sawHeader) return { ok: false, header: "CSV file is empty (no header)" };
  return { ok: true, dataRows };
}

function brief(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text.length > 500 ? `${text.slice(0, 500)}…` : text; // Prisma errors can echo a large query
}

export async function runSeed(options: SeedOptions): Promise<SeedReport> {
  const { csvPath, fresh, batchSize, prisma, log } = options;
  const startedAt = performance.now();
  const issues = new IssueCollector();
  const report: SeedReport = {
    outcome: "seeded",
    exitCode: 0,
    dataRows: 0,
    inserted: 0,
    batches: 0,
    tableCount: null,
    issues: issues.summary,
    message: null,
    seconds: 0,
    maxRssMb: 0,
  };

  const finish = (outcome: SeedOutcome, exitCode: number, message: string | null): SeedReport => {
    report.outcome = outcome;
    report.exitCode = exitCode;
    report.message = message;
    report.seconds = Number(((performance.now() - startedAt) / 1000).toFixed(2));
    report.maxRssMb = Math.round(process.resourceUsage().maxRSS / 1024);
    printSummary(report, log);
    return report;
  };

  // Pass 1: read only. Validate every row; keep nothing but counters.
  log(`Lượt 1: kiểm tra ${csvPath}`);
  try {
    const scan = await scanCsv(
      csvPath,
      async () => {},
      (rowIssues) => rowIssues.forEach((issue) => issues.add(issue)),
    );
    if (!scan.ok) return finish("bad-header", 1, scan.header);
    report.dataRows = scan.dataRows;
  } catch (error) {
    return finish("file-error", 1, `Không đọc được file CSV ${csvPath}: ${brief(error)}`);
  }
  if (issues.total > 0) {
    return finish("invalid-rows", 1, `Có ${issues.total} lỗi trong CSV, chưa ghi gì vào CSDL.`);
  }

  // Decide from the table state, only now that the file is known to be clean:
  // a full table is left alone, a partial one needs --fresh.
  const existing = await countCandidates(prisma);
  if (existing > 0 && !fresh) {
    if (existing === report.dataRows) {
      report.tableCount = existing;
      return finish("already-full", 0, `Bảng đã đủ ${existing} thí sinh, không làm gì.`);
    }
    report.tableCount = existing;
    return finish("refused", 1, `Bảng có ${existing} dòng, CSV có ${report.dataRows}; chạy lại với --fresh.`);
  }
  if (existing > 0) {
    log(`--fresh: xoá ${existing} dòng hiện có rồi nạp lại.`);
    await truncateCandidates(prisma);
  }

  // Pass 2: load in batches. At most one batch is held in memory.
  log(`Lượt 2: nạp ${report.dataRows} dòng, lô ${batchSize}.`);
  let batch: NewCandidate[] = [];
  let batchFirstLine = 0;
  let lastLogged = 0;
  const flush = async (lastLine: number): Promise<void> => {
    try {
      report.inserted += await insertCandidateBatch(prisma, batch);
    } catch (error) {
      throw new Error(`lô dòng CSV ${batchFirstLine}-${lastLine} bị CSDL từ chối: ${brief(error)}`);
    }
    report.batches += 1;
    batch = [];
    if (report.inserted - lastLogged >= PROGRESS_EVERY) {
      lastLogged = report.inserted;
      log(`  đã nạp ${report.inserted}/${report.dataRows}`);
    }
  };
  try {
    const loaded = await scanCsv(
      csvPath,
      async (row, lineNo) => {
        if (batch.length === 0) batchFirstLine = lineNo;
        batch.push(row);
        if (batch.length >= batchSize) await flush(lineNo);
      },
      (rowIssues, lineNo) => {
        // Pass 1 accepted every row, so a rejection here means the file changed between the passes.
        const reasons = [...new Set(rowIssues.map((issue) => issue.reason))].join(", ");
        throw new Error(`dòng CSV ${lineNo} bị từ chối ở lượt 2 (${reasons}); file đã đổi giữa hai lượt`);
      },
    );
    if (!loaded.ok) throw new Error(loaded.header);
    if (batch.length > 0) await flush(loaded.dataRows + 1);
  } catch (error) {
    return finish("insert-failed", 1, `${brief(error)}. Các lô trước đã commit; chạy lại với --fresh.`);
  }

  report.tableCount = await countCandidates(prisma);
  if (report.tableCount !== report.dataRows) {
    return finish("count-mismatch", 1, `Bảng có ${report.tableCount} dòng, CSV có ${report.dataRows}.`);
  }
  return finish("seeded", 0, null);
}

function printSummary(report: SeedReport, log: (line: string) => void): void {
  if (report.message) log(report.message);
  log(
    `Dòng dữ liệu CSV: ${report.dataRows}; đã nạp: ${report.inserted}; dòng bảng: ${report.tableCount ?? "(chưa đếm)"}` +
      (report.tableCount !== null ? (report.tableCount === report.dataRows ? " (khớp CSV)" : " (LỆCH CSV)") : ""),
  );
  for (const [reason, entry] of Object.entries(report.issues)) {
    const bySubject = Object.entries(entry.subjects).map(([code, n]) => `${code}=${n}`).join(" ");
    const more = entry.count > entry.lines.length ? ", …" : "";
    log(`  ${reason}: ${entry.count}${bySubject ? ` (${bySubject})` : ""}; dòng ${entry.lines.join(", ")}${more}`);
  }
  log(`Thời gian: ${report.seconds}s; RSS lớn nhất: ${report.maxRssMb} MB`);
}
