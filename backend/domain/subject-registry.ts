import type { Subject } from "./subject";

const CODE_PATTERN = /^[a-z_]+$/;

/**
 * The one list of subjects. Seeder, lookup, report and top 10 all take their
 * subjects and column names from here. `has()` is the whitelist for column
 * identifiers in raw SQL: SQL never gets a column name from user input.
 */
export class SubjectRegistry<C extends string> {
  private readonly byCode: ReadonlyMap<string, Subject<C>>;
  private readonly list: readonly Subject<C>[];
  private readonly codeList: readonly C[];

  constructor(subjects: readonly Subject<C>[]) {
    if (subjects.length === 0) throw new Error("SubjectRegistry needs at least one subject");
    const byCode = new Map<string, Subject<C>>();
    for (const subject of subjects) {
      if (!CODE_PATTERN.test(subject.code)) throw new Error(`Invalid subject code: ${JSON.stringify(subject.code)}`);
      if (byCode.has(subject.code)) throw new Error(`Duplicate subject code: ${subject.code}`);
      byCode.set(subject.code, subject);
    }
    this.byCode = byCode;
    this.list = Object.freeze([...subjects]);
    this.codeList = Object.freeze(subjects.map((subject) => subject.code));
  }

  all(): readonly Subject<C>[] {
    return this.list;
  }

  codes(): readonly C[] {
    return this.codeList;
  }

  /** Programmer error (throws) for an unknown code. Use has() first for untrusted input. */
  get(code: C): Subject<C> {
    const subject = this.byCode.get(code);
    if (!subject) throw new Error(`Unknown subject code: ${JSON.stringify(code)}`);
    return subject;
  }

  has(code: string): code is C {
    return this.byCode.has(code);
  }
}
