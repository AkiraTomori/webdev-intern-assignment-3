import vi from "../../messages/vi.json";

// The frontend has no list of subjects or levels of its own. It reads the keys of the
// message file, and test/vocabulary.test.ts checks them against backend/domain, order included.
export type SubjectCode = keyof typeof vi.subject;
export type LevelKey = keyof typeof vi.level;

export const SUBJECT_CODES = Object.keys(vi.subject) as SubjectCode[];
export const LEVEL_KEYS = Object.keys(vi.level) as LevelKey[];
