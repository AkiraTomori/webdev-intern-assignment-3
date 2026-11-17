import { open } from "node:fs/promises";
import { createInterface } from "node:readline";

export interface CsvLine {
  /** 1-based line number in the file (the header is line 1). */
  readonly lineNo: number;
  readonly line: string;
}

/**
 * Streams a file line by line; memory stays flat however large the file is.
 * Opened read-only, so the dataset is never modified. `for await` stops reading while the caller is busy (backpressure).
 * Blank lines at the end of the file are dropped; a blank line in the middle is yielded
 * so it is reported as a bad row instead of vanishing.
 */
export async function* readCsvLines(path: string): AsyncGenerator<CsvLine> {
  const handle = await open(path, "r"); // rejects here (ENOENT, EACCES) with a clear error
  try {
    const lines = createInterface({ input: handle.createReadStream({ encoding: "utf8", autoClose: false }), crlfDelay: Infinity });
    let lineNo = 0;
    let pendingBlank: CsvLine[] = [];
    for await (const line of lines) {
      lineNo += 1;
      if (line === "") {
        pendingBlank.push({ lineNo, line });
        continue;
      }
      yield* pendingBlank;
      pendingBlank = [];
      yield { lineNo, line };
    }
  } finally {
    await handle.close();
  }
}
