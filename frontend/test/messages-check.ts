// Helpers that check message files. They are tested on fixtures (so we know they can fail),
// then run on the real files in messages.test.ts.

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/** Leaf keys as dotted paths, sorted. Arrays are not used in message files and count as leaves. */
export function leafKeys(value: Json, prefix = ""): string[] {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value).flatMap(([key, child]) => leafKeys(child, prefix ? `${prefix}.${key}` : key)).sort();
  }
  return [prefix];
}

export function leafEntries(value: Json, prefix = ""): [string, Json][] {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value).flatMap(([key, child]) => leafEntries(child, prefix ? `${prefix}.${key}` : key));
  }
  return [[prefix, value]];
}

export function diffKeys(reference: Json, other: Json): { missing: string[]; extra: string[] } {
  const ref = new Set(leafKeys(reference));
  const got = new Set(leafKeys(other));
  return { missing: [...ref].filter((key) => !got.has(key)), extra: [...got].filter((key) => !ref.has(key)) };
}

/** Names of `{x}` parameters in a message, sorted. Only simple `{name}` forms are used here. */
export function paramsOf(message: string): string[] {
  return [...message.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!).sort();
}

export function paramMismatches(reference: Json, other: Json): string[] {
  const otherMap = new Map(leafEntries(other));
  const bad: string[] = [];
  for (const [key, value] of leafEntries(reference)) {
    const counterpart = otherMap.get(key);
    if (typeof value === "string" && typeof counterpart === "string" && paramsOf(value).join() !== paramsOf(counterpart).join()) bad.push(key);
  }
  return bad;
}

export function emptyOrNonString(value: Json): string[] {
  return leafEntries(value).filter(([, leaf]) => typeof leaf !== "string" || leaf.trim() === "").map(([key]) => key);
}

/**
 * Duplicate keys inside one object, as dotted paths. JSON.parse silently keeps the last one,
 * so this scans the raw text with a small JSON reader.
 */
export function findDuplicateKeys(text: string): string[] {
  let i = 0;
  const duplicates: string[] = [];

  const skipSpace = () => {
    while (i < text.length && /\s/.test(text[i]!)) i++;
  };
  const readString = (): string => {
    let out = "";
    i++; // opening quote
    while (i < text.length && text[i] !== '"') {
      if (text[i] === "\\") {
        out += text[i]! + text[i + 1]!;
        i += 2;
      } else out += text[i++];
    }
    i++; // closing quote
    return out;
  };
  const readValue = (path: string): void => {
    skipSpace();
    const ch = text[i];
    if (ch === "{") {
      i++;
      const seen = new Set<string>();
      skipSpace();
      while (text[i] !== "}" && i < text.length) {
        skipSpace();
        const key = readString();
        const childPath = path ? `${path}.${key}` : key;
        if (seen.has(key)) duplicates.push(childPath);
        seen.add(key);
        skipSpace();
        i++; // colon
        readValue(childPath);
        skipSpace();
        if (text[i] === ",") i++;
        skipSpace();
      }
      i++;
    } else if (ch === "[") {
      i++;
      skipSpace();
      while (text[i] !== "]" && i < text.length) {
        readValue(path);
        skipSpace();
        if (text[i] === ",") i++;
        skipSpace();
      }
      i++;
    } else if (ch === '"') {
      readString();
    } else {
      while (i < text.length && !/[,\]}\s]/.test(text[i]!)) i++;
    }
  };

  readValue("");
  return duplicates;
}
