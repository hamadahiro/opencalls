#!/usr/bin/env python3
"""Dup check against data.json. ABSOLUTE path + known-negative canary.

The path stays absolute at runtime (so CWD never matters) but is derived
from this file's own location rather than written out, so moving the repo
needs no edit here.

Usage: python3 tools/dupcheck.py <token> [<token> ...]
Each token is matched independently (never a multi-word phrase) against
title, org, url, submitUrl, slug — diacritic-folded, curly-quote-normalised,
host-squashed. ALL hits print. Never truncated.
"""
import json, sys, unicodedata, re
from pathlib import Path

DATA = str(Path(__file__).resolve().parent.parent / "data.json")
CANARY = "zzqqxx-known-negative-canary"


def fold(s):
    if s is None:
        return ""
    s = str(s)
    s = s.replace("’", "'").replace("‘", "'")
    s = s.replace("“", '"').replace("”", '"')
    s = s.replace("–", "-").replace("—", "-")
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return s.lower()


def squash(s):
    """collapse to alnum only — kills www., hyphens, spaces, punctuation"""
    return re.sub(r"[^a-z0-9]", "", fold(s))


def main():
    calls = json.load(open(DATA))["calls"]
    print(f"[dupcheck] loaded {len(calls)} calls from {DATA}")
    toks = sys.argv[1:] + [CANARY]
    for tok in toks:
        ft, st = fold(tok), squash(tok)
        hits = []
        for c in calls:
            blob = " | ".join(fold(c.get(k)) for k in
                              ("title", "org", "url", "submitUrl", "slug"))
            sblob = squash(blob)
            if (ft and ft in blob) or (st and st in sblob):
                hits.append(c)
        tag = "CANARY" if tok == CANARY else "TOKEN "
        print(f"\n=== {tag} {tok!r}: {len(hits)} hit(s) ===")
        for c in hits:
            print(f"  - {c.get('title')} | org={c.get('org')} | "
                  f"deadline={c.get('deadline')} | slug={c.get('slug')}")
            print(f"    url={c.get('url')}  submitUrl={c.get('submitUrl')}")
    print("\n[dupcheck] done (canary above MUST be 0 hits)")


if __name__ == "__main__":
    main()
