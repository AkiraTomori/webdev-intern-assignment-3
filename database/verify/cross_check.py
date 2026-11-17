#!/usr/bin/env python3
"""G-Scores: independent cross-check of the API against the raw CSV.

Deliberately shares NO code with the application:
  * its own CSV parser (stdlib `csv`), reads the file directly, never the database;
  * thresholds written out again here (>=8, 6<=x<8, 4<=x<6, <4), not imported from the app;
  * blank cell = subject not taken (skipped, never 0);
  * `decimal.Decimal` built from the CSV text, never `float`; SBD always a string.

Read-only: the CSV is opened for reading, the API receives GET requests only,
no database access, no .env access, no file written.

Run from the repo root (stdlib only, isolated mode):
  python3 -I database/verify/cross_check.py --csv dataset/diem_thi_thpt_2024.csv --api http://127.0.0.1:4000
  python3 -I database/verify/cross_check.py --csv database/verify/fixtures/boundary.csv --self-test

Exit code: 0 all match, 1 mismatch, 2 usage error / API unreachable / unexpected API error.
"""

import argparse
import csv
import hashlib
import io
import json
import os
import random
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from collections import namedtuple
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation

EXPECTED_HEADER = [
    "sbd", "toan", "ngu_van", "ngoai_ngu", "vat_li", "hoa_hoc",
    "sinh_hoc", "lich_su", "dia_li", "gdcd", "ma_ngoai_ngu",
]
SCORE_COLUMNS = EXPECTED_HEADER[1:10]
GROUP_A = ("toan", "vat_li", "hoa_hoc")
KHTN = ("vat_li", "hoa_hoc", "sinh_hoc")
LEVEL_KEYS = ("gte8", "gte6", "gte4", "lt4")

SBD_RE = re.compile(r"[0-9]{8}")
SCORE_RE = re.compile(r"[0-9]+(\.[0-9]+)?")

EIGHT, SIX, FOUR, TEN = Decimal(8), Decimal(6), Decimal(4), Decimal(10)

TIE_KS = (10, 20)            # ranks whose ties we report (default top, ?limit=20)
POOL_PRUNE_AT = 4096         # prune the top-candidate pool beyond this size
SAMPLE_SIZE = 150            # random SBDs for lookup check
SAMPLE_SEED = 2024
PINNED_SBDS = ("01000001", "01095066")                       # two SBDs whose scores are checked field by field
ABSENT_PROBES = ("00000000", "99999999", "12345678", "00000001")  # first one absent from CSV is used
MAX_PRINT = 10               # mismatches printed per section

Row = namedtuple("Row", "sbd scores code")


class Fatal(Exception):
    """Usage error / API unreachable / unexpected API error -> exit code 2."""


def fmt(d):
    return format(d.normalize(), "f")


# --------------------------------------------------------------------------- CSV

def level_of(x):
    if x >= EIGHT:
        return "gte8"
    if x >= SIX:
        return "gte6"
    if x >= FOUR:
        return "gte4"
    return "lt4"


def parse_row(fields):
    """Return (Row, None) or (None, reason)."""
    if len(fields) != len(EXPECTED_HEADER):
        return None, f"expected {len(EXPECTED_HEADER)} fields, got {len(fields)}"
    sbd = fields[0]
    if not SBD_RE.fullmatch(sbd):
        return None, f"invalid sbd {sbd!r}"
    scores = {}
    for col, raw in zip(SCORE_COLUMNS, fields[1:10]):
        cell = raw.strip()
        if cell == "":
            scores[col] = None
            continue
        if not SCORE_RE.fullmatch(cell):
            return None, f"{col}: not a plain decimal: {cell!r}"
        d = Decimal(cell)
        if d < 0 or d > TEN:
            return None, f"{col}: out of range 0..10: {cell!r}"
        scores[col] = d
    return Row(sbd, scores, fields[10].strip() or None), None


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


class Analysis:
    pass


def analyze(stream, sample_size=SAMPLE_SIZE, seed=SAMPLE_SEED):
    """One streaming pass over a CSV text stream. Memory does not grow with file size."""
    a = Analysis()
    a.rows = 0
    a.bad_count = 0
    a.bad_examples = []
    a.total = {c: 0 for c in SCORE_COLUMNS}
    a.counts = {c: {k: 0 for k in LEVEL_KEYS} for c in SCORE_COLUMNS}
    a.header_ok = False

    reader = csv.reader(stream)
    header = next(reader, None)
    a.header_ok = header == EXPECTED_HEADER
    if not a.header_ok:
        return a

    pool, cutoff = [], None       # (group-A total, sbd, Row) with total >= rank-20 cutoff
    keep = max(TIE_KS)
    rng = random.Random(seed)
    reservoir, good = [], 0
    pinned, seen_probes = {}, set()
    first = {"no_khtn": None, "foreign_not_n1": None, "no_foreign": None}

    def prune():
        nonlocal cutoff
        pool.sort(key=lambda e: (-e[0], e[1]))
        if len(pool) >= keep:
            cutoff = pool[keep - 1][0]
            pool[:] = [e for e in pool if e[0] >= cutoff]

    for fields in reader:
        a.rows += 1
        row, reason = parse_row(fields)
        if row is None:
            a.bad_count += 1
            if len(a.bad_examples) < 5:
                a.bad_examples.append((reader.line_num, reason))
            continue
        good += 1
        for c in SCORE_COLUMNS:
            x = row.scores[c]
            if x is not None:
                a.total[c] += 1
                a.counts[c][level_of(x)] += 1

        if all(row.scores[c] is not None for c in GROUP_A):
            total = sum((row.scores[c] for c in GROUP_A), Decimal(0))
            if cutoff is None or total >= cutoff:
                pool.append((total, row.sbd, row))
                if len(pool) >= POOL_PRUNE_AT:
                    prune()

        if row.sbd in PINNED_SBDS:
            pinned[row.sbd] = row
        if row.sbd in ABSENT_PROBES:
            seen_probes.add(row.sbd)
        if first["no_khtn"] is None and row.sbd.startswith("0") \
                and all(row.scores[c] is None for c in KHTN):
            first["no_khtn"] = row
        if first["foreign_not_n1"] is None and row.code not in (None, "N1"):
            first["foreign_not_n1"] = row
        if first["no_foreign"] is None and row.scores["ngoai_ngu"] is None and row.code is None:
            first["no_foreign"] = row

        if len(reservoir) < sample_size:
            reservoir.append(row)
        else:
            j = rng.randrange(good)
            if j < sample_size:
                reservoir[j] = row

    prune()
    a.ranked = pool                                   # sorted by (-total, sbd), ties at rank 20 kept
    a.pinned = pinned
    a.first = first
    a.reservoir = reservoir
    a.absent = next((s for s in ABSENT_PROBES if s not in seen_probes), None)
    return a


def tie_info(ranked, k):
    """Group sharing the k-th total: how many, which were kept, which were cut."""
    if len(ranked) < k:
        return None
    t = ranked[k - 1][0]
    group = [(i, e) for i, e in enumerate(ranked) if e[0] == t]
    return {
        "total": t,
        "n": len(group),
        "kept": [e[1] for i, e in group if i < k],
        "cut": [e[1] for i, e in group if i >= k],
    }


# --------------------------------------------------------------------------- API

class Api:
    def __init__(self, base):
        parts = urllib.parse.urlsplit(base)
        if parts.scheme not in ("http", "https") or not parts.netloc:
            raise Fatal(f"--api must be an http(s) URL, got {base!r}")
        self.base = base.rstrip("/")

    def get(self, path):
        """Return (status, parsed JSON). Floats are parsed as Decimal."""
        url = self.base + path
        try:
            with urllib.request.urlopen(url, timeout=30) as resp:  # noqa: S310 (scheme checked)
                status, body = resp.status, resp.read()
        except urllib.error.HTTPError as e:
            status, body = e.code, e.read()
        except (urllib.error.URLError, OSError):
            raise Fatal(f"không gọi được API tại {self.base}")
        try:
            return status, json.loads(body.decode("utf-8"), parse_float=Decimal)
        except (ValueError, UnicodeDecodeError):
            raise Fatal(f"API returned non-JSON body (HTTP {status}) for {path}")

    def get_ok(self, path):
        status, doc = self.get(path)
        if status != 200 or not isinstance(doc, dict) or "data" not in doc:
            code = doc.get("error", {}).get("code") if isinstance(doc, dict) and isinstance(doc.get("error"), dict) else None
            raise Fatal(f"unexpected API response for {path}: HTTP {status}, code={code}")
        return doc["data"]


def show(v):
    """Readable API value for mismatch messages."""
    return fmt(v) if isinstance(v, Decimal) else repr(v)


def to_dec(v):
    """JSON number -> Decimal; None for anything else (incl. bool, str, null)."""
    if isinstance(v, bool):
        return None
    if isinstance(v, int):
        return Decimal(v)
    if isinstance(v, Decimal):
        return v
    return None


def to_int(v):
    d = to_dec(v)
    return int(d) if d is not None and d == d.to_integral_value() else None


class Report:
    def __init__(self):
        self.failures = 0
        self._printed = {}

    def fail(self, section, msg):
        self.failures += 1
        n = self._printed.get(section, 0)
        self._printed[section] = n + 1
        if n < MAX_PRINT:
            print(f"  MISMATCH [{section}] {msg}")
        elif n == MAX_PRINT:
            print(f"  … more mismatches in [{section}] not printed")


# ------------------------------------------------------------------ comparisons

def check_levels(api, a, rep):
    data = api.get_ok("/api/reports/score-levels")
    sec = "score-levels"
    subjects = data.get("subjects") if isinstance(data, dict) else None
    levels = data.get("levels") if isinstance(data, dict) else None
    if not isinstance(subjects, list) or not isinstance(levels, list):
        rep.fail(sec, "response shape: need data.levels[] and data.subjects[]")
        return
    keys = [l.get("key") for l in levels if isinstance(l, dict)]
    if set(keys) != set(LEVEL_KEYS) or len(keys) != len(LEVEL_KEYS):
        rep.fail(sec, f"level keys {keys} != {list(LEVEL_KEYS)}")
    by_code = {}
    for s in subjects:
        if isinstance(s, dict) and isinstance(s.get("code"), str):
            if s["code"] in by_code:
                rep.fail(sec, f"duplicate subject code {s['code']}")
            by_code[s["code"]] = s
    if set(by_code) != set(SCORE_COLUMNS):
        rep.fail(sec, f"subject codes {sorted(by_code)} != {sorted(SCORE_COLUMNS)}")

    print(f"  {'subject':<10}{'gte8':>9}{'gte6':>9}{'gte4':>9}{'lt4':>9}{'total':>10}  csv==api")
    matched = 0
    for c in SCORE_COLUMNS:
        exp = a.counts[c]
        s = by_code.get(c)
        ok = s is not None
        if s is not None:
            counts = s.get("counts") if isinstance(s.get("counts"), dict) else {}
            api_total = to_int(s.get("total"))
            api_counts = {k: to_int(counts.get(k)) for k in LEVEL_KEYS}
            if api_total != a.total[c]:
                ok = False
                rep.fail(sec, f"{c}.total csv={a.total[c]} api={api_total}")
            for k in LEVEL_KEYS:
                if api_counts[k] != exp[k]:
                    ok = False
                    rep.fail(sec, f"{c}.{k} csv={exp[k]} api={api_counts[k]}")
            if None not in api_counts.values() and sum(api_counts.values()) != api_total:
                ok = False
                rep.fail(sec, f"{c}: api sum(counts)={sum(api_counts.values())} != total={api_total}")
        if sum(exp.values()) != a.total[c]:        # CSV side of Σ counts == total
            ok = False
            rep.fail(sec, f"{c}: csv sum(counts)={sum(exp.values())} != total={a.total[c]}")
        matched += ok
        print(f"  {c:<10}" + "".join(f"{exp[k]:>9}" for k in LEVEL_KEYS)
              + f"{a.total[c]:>10}  {'OK' if ok else 'MISMATCH'}")
    print(f"[score-levels] {matched}/{len(SCORE_COLUMNS)} subjects match")
    if all(a.total[c] > 0 for c in SCORE_COLUMNS) and all(
            to_int((by_code.get(c) or {}).get("total")) == 0 for c in SCORE_COLUMNS):
        print("  Gợi ý: CSDL có vẻ chưa seed (mọi total = 0).")


def check_top(api, a, rep):
    sec = "top-group-a"
    ranked = a.ranked
    results = {}
    for label, query, limit in (("default", "", 10), ("limit=20", "?limit=20", 20)):
        data = api.get_ok("/api/reports/top-group-a" + query)
        results[label] = data
        expect = ranked[:limit]
        ok = True
        if not isinstance(data, list):
            rep.fail(sec, f"{label}: data is not a list")
            print(f"[top-group-a] {label} shape error")
            continue
        if len(data) != len(expect):
            ok = False
            rep.fail(sec, f"{label}: {len(data)} rows, expected {len(expect)}")
            if not data:
                print("  Gợi ý: CSDL có vẻ chưa seed (top rỗng).")
        good = 0
        for i, (total, sbd, row) in enumerate(expect):
            if i >= len(data) or not isinstance(data[i], dict):
                break
            r = data[i]
            problems = []
            if to_int(r.get("rank")) != i + 1:
                problems.append(f"rank csv={i + 1} api={show(r.get('rank'))}")
            if r.get("sbd") != sbd or not isinstance(r.get("sbd"), str):
                problems.append(f"sbd csv={sbd} api={show(r.get('sbd'))}")
            for col in GROUP_A:
                if to_dec(r.get(col)) != row.scores[col]:
                    problems.append(f"{col} csv={fmt(row.scores[col])} api={show(r.get(col))}")
            api_total = to_dec(r.get("total"))
            if api_total != total:
                problems.append(f"total csv={fmt(total)} api={show(r.get('total'))}")
            if problems:
                ok = False
                rep.fail(sec, f"{label} row {i + 1} ({sbd}): " + "; ".join(problems))
            else:
                good += 1
        results[label + "_ok"] = (good, len(expect))
    repeat = api.get_ok("/api/reports/top-group-a")
    repeat_ok = repeat == results["default"]
    if not repeat_ok:
        rep.fail(sec, "two identical requests returned different lists")
    g10, n10 = results.get("default_ok", (0, 0))
    g20, n20 = results.get("limit=20_ok", (0, 0))
    print(f"[top-group-a] limit=default {g10}/{n10} match · limit=20 {g20}/{n20} match · "
          f"repeat {'identical' if repeat_ok else 'DIFFERENT'}")
    for k in TIE_KS:
        t = tie_info(ranked, k)
        if t is None:
            print(f"  tie at #{k}: fewer than {k} eligible candidates")
            continue
        cut = " ".join(t["cut"][:5]) + (" …" if len(t["cut"]) > 5 else "")
        print(f"  tie at #{k}: total {fmt(t['total'])}, {t['n']} candidates, "
              f"kept {' '.join(t['kept'])}" + (f", cut {cut}" if t["cut"] else ", all kept"))


def lookup_targets(a):
    """Ordered, de-duplicated list of rows to look up."""
    rows = [a.pinned[s] for s in PINNED_SBDS if s in a.pinned]
    rows += [r for r in a.first.values() if r is not None]
    rows += [e[2] for e in a.ranked[:10]]
    rows += a.reservoir
    seen, out = set(), []
    for r in rows:
        if r.sbd not in seen:
            seen.add(r.sbd)
            out.append(r)
    return out


def check_candidates(api, a, rep):
    sec = "candidates"
    targets = lookup_targets(a)
    good = 0
    for row in targets:
        status, doc = api.get(f"/api/candidates/{row.sbd}")
        if status not in (200, 404):
            code = doc.get("error", {}).get("code") if isinstance(doc, dict) and isinstance(doc.get("error"), dict) else None
            raise Fatal(f"unexpected API response for /api/candidates/{row.sbd}: HTTP {status}, code={code}")
        if status == 404:
            rep.fail(sec, f"{row.sbd}: in CSV but API says not found")
            continue
        data = doc.get("data") if isinstance(doc, dict) else None
        if not isinstance(data, dict):
            rep.fail(sec, f"{row.sbd}: response shape")
            continue
        problems = []
        if data.get("sbd") != row.sbd:
            problems.append(f"sbd api={show(data.get('sbd'))}")
        scores = data.get("scores") if isinstance(data.get("scores"), dict) else {}
        if set(scores) != set(SCORE_COLUMNS):
            problems.append(f"score keys {sorted(scores)}")
        for c in SCORE_COLUMNS:
            exp, got = row.scores[c], scores.get(c, "<missing>")
            if exp is None:
                if got is not None:
                    problems.append(f"{c} csv=blank api={show(got)}")
            elif to_dec(got) != exp:
                problems.append(f"{c} csv={fmt(exp)} api={show(got)}")
        if data.get("foreignLanguageCode") != row.code:
            problems.append(f"foreignLanguageCode csv={row.code!r} api={show(data.get('foreignLanguageCode'))}")
        if problems:
            rep.fail(sec, f"{row.sbd}: " + "; ".join(problems))
        else:
            good += 1
    line = f"[candidates] {good}/{len(targets)} match"
    if a.absent is None:
        line += " · no absent SBD probe available"
    else:
        status, doc = api.get(f"/api/candidates/{a.absent}")
        err = doc.get("error", {}).get("code") if isinstance(doc, dict) and isinstance(doc.get("error"), dict) else None
        if status == 404 and err == "CANDIDATE_NOT_FOUND":
            line += f" · 404 for {a.absent} OK"
        else:
            rep.fail(sec, f"{a.absent}: not in CSV, expected 404 CANDIDATE_NOT_FOUND, got HTTP {status} code={err}")
            line += f" · {a.absent} MISMATCH"
    print(line)


# --------------------------------------------------------------------------- main

def git_info(repo_root):
    try:
        run = lambda *args: subprocess.run(  # noqa: E731
            ["git", *args], cwd=repo_root, capture_output=True, text=True, timeout=10)
        head = run("rev-parse", "--short", "HEAD")
        if head.returncode != 0:
            return None
        dirty = run("status", "--porcelain", "--untracked-files=no", "--", "backend", "database")
        return head.stdout.strip() + (" (dirty: backend/database)" if dirty.stdout.strip() else "")
    except (OSError, subprocess.SubprocessError):
        return None


def print_csv_summary(a, rep, sha_before, sha_after):
    sha_ok = sha_before == sha_after
    print(f"CSV: {a.rows} rows, {a.bad_count} bad rows, header OK")
    if a.bad_count:
        rep.fail("csv", f"{a.bad_count} bad rows (the dataset is expected to have none)")
        for line_no, reason in a.bad_examples:
            print(f"    line {line_no}: {reason}")
    if not sha_ok:
        rep.fail("csv", "sha256 changed while reading: something else is writing dataset/")
    return sha_ok


def run_check(args):
    repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    api = Api(args.api)
    try:
        sha_before = sha256_of(args.csv)
        with open(args.csv, "r", encoding="utf-8", newline="") as f:
            a = analyze(f)
        sha_after = sha256_of(args.csv)
    except (OSError, UnicodeDecodeError) as e:
        raise Fatal(f"cannot read CSV {args.csv}: {type(e).__name__}")
    if not a.header_ok:
        raise Fatal("CSV header does not match the 11 expected columns")

    rep = Report()
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
    git = git_info(repo_root)
    print(f"G-Scores cross-check  {stamp}  git {git or 'n/a'}  csv sha256 {sha_after} "
          f"({'unchanged' if sha_before == sha_after else 'CHANGED'})")
    print_csv_summary(a, rep, sha_before, sha_after)
    check_levels(api, a, rep)
    check_top(api, a, rep)
    check_candidates(api, a, rep)
    print("RESULT: " + ("PASS" if rep.failures == 0 else f"FAIL ({rep.failures} mismatches)"))
    return 0 if rep.failures == 0 else 1


# Hand-computed from database/verify/fixtures/boundary.csv (not produced by this script).
SELF_TEST_EXPECTED = {
    "rows": 10,
    "total": {"toan": 9, "ngu_van": 8, "ngoai_ngu": 3, "vat_li": 8, "hoa_hoc": 7,
              "sinh_hoc": 2, "lich_su": 2, "dia_li": 1, "gdcd": 0},
    "counts": {
        "toan":      (5, 2, 0, 2),
        "ngu_van":   (2, 2, 3, 1),
        "ngoai_ngu": (0, 3, 0, 0),
        "vat_li":    (5, 1, 2, 0),
        "hoa_hoc":   (3, 2, 2, 0),
        "sinh_hoc":  (0, 0, 1, 1),
        "lich_su":   (1, 0, 0, 1),
        "dia_li":    (0, 0, 0, 1),
        "gdcd":      (0, 0, 0, 0),
    },
    # 00000003 lacks hoa_hoc, 01000007 lacks toan, 01000010 lacks vat_li: not eligible.
    # 00000002 and 00000004 tie at 30; 00000004 comes first in the file, SBD order must win.
    "ranked": [("00000002", "30"), ("00000004", "30"), ("01000005", "28.75"), ("01000009", "23"),
               ("00000001", "19.75"), ("01000008", "17.5"), ("01000006", "13.99")],
    "tie_at_1": {"total": "30", "n": 2, "kept": ["00000002"], "cut": ["00000004"]},
    "first": {"no_khtn": "01000007", "foreign_not_n1": "00000004", "no_foreign": "00000002"},
    "absent": "00000000",
}

# In-memory rows that must each be rejected as bad (the 11th field is irrelevant).
SELF_TEST_BAD_ROWS = [
    "00000001,8,7",                                   # too few fields
    "0000001,8,,,,,,,,,",                             # 7-char SBD
    "00000002,10.5,,,,,,,,,",                         # above 10
    "00000003,abc,,,,,,,,,",                          # not a number
    "00000004,NaN,,,,,,,,,",                          # NaN
    "00000005,8,,,,,,,,,,",                           # too many fields
    "00000006,-1,,,,,,,,,",                           # negative
    "00000007,8,6,8,6,5,4,3,2,1,N1",                  # control: valid
]


def run_self_test(args):
    failures = []

    def expect(name, got, want):
        if got != want:
            failures.append(f"{name}: got {got!r}, want {want!r}")

    try:
        with open(args.csv, "r", encoding="utf-8", newline="") as f:
            a = analyze(f)
    except (OSError, UnicodeDecodeError) as e:
        raise Fatal(f"cannot read CSV {args.csv}: {type(e).__name__}")
    if not a.header_ok:
        raise Fatal("CSV header does not match the 11 expected columns")
    exp = SELF_TEST_EXPECTED
    expect("rows", a.rows, exp["rows"])
    expect("bad rows", a.bad_count, 0)
    expect("total", a.total, exp["total"])
    for c in SCORE_COLUMNS:
        expect(f"counts[{c}]", tuple(a.counts[c][k] for k in LEVEL_KEYS), exp["counts"][c])
    expect("ranked", [(sbd, fmt(t)) for t, sbd, _ in a.ranked], exp["ranked"])
    t1 = tie_info(a.ranked, 1)
    expect("tie_at_1", {"total": fmt(t1["total"]), "n": t1["n"], "kept": t1["kept"], "cut": t1["cut"]},
           exp["tie_at_1"])
    expect("first", {k: (r.sbd if r else None) for k, r in a.first.items()}, exp["first"])
    expect("absent", a.absent, exp["absent"])
    expect("lookup targets unique", len({r.sbd for r in lookup_targets(a)}),
           len(lookup_targets(a)))

    # Bad-row detection, from memory (no file).
    text = ",".join(EXPECTED_HEADER) + "\n" + "\n".join(SELF_TEST_BAD_ROWS) + "\n"
    b = analyze(io.StringIO(text))
    expect("bad rows (in-memory)", (b.rows, b.bad_count), (len(SELF_TEST_BAD_ROWS), len(SELF_TEST_BAD_ROWS) - 1))

    # Quoted fields and a BOM-less header are handled by the real CSV parser.
    q = analyze(io.StringIO(",".join(EXPECTED_HEADER) + '\n"01000001","8.40",,,,,,,,,"N1"\n'))
    expect("quoted fields", (q.bad_count, q.total["toan"], q.counts["toan"]["gte8"]), (0, 1, 1))

    # Wrong header must be reported, not silently analysed.
    expect("header check", analyze(io.StringIO("sbd,toan\n00000001,8\n")).header_ok, False)

    if failures:
        for f in failures:
            print(f"  SELF-TEST MISMATCH {f}")
        print(f"SELF-TEST: FAIL ({len(failures)})")
        return 1
    print("SELF-TEST: PASS (fixture counts, tie order, bad-row detection)")
    return 0


def main(argv=None):
    p = argparse.ArgumentParser(description="Independent cross-check of the G-Scores API against the CSV.")
    p.add_argument("--csv", required=True, help="path to diem_thi_thpt_2024.csv (or the fixture)")
    p.add_argument("--api", default="http://127.0.0.1:4000", help="backend base URL (default %(default)s)")
    p.add_argument("--self-test", action="store_true", help="check this script against the fixture; no API calls")
    args = p.parse_args(argv)
    try:
        return run_self_test(args) if args.self_test else run_check(args)
    except Fatal as e:
        print(f"ERROR: {e}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
