#!/usr/bin/env python3
"""Fold a list of candidate (title, org, deadline) rows against data.json.
Reads JSON lines on stdin: {"title":..,"org":..,"deadline":..,"url":..}
Prints NEW / MATCH per row. Fold-matches on title tokens AND org.
"""
import json, sys, unicodedata, re

DATA = "/Users/machina/Documents/Projects/Monographica/opencalls/data.json"


def fold(s):
    if not s:
        return ""
    s = str(s)
    for a, b in (("’", "'"), ("‘", "'"), ("“", '"'), ("”", '"'),
                 ("–", "-"), ("—", "-"), ("&amp;", "&")):
        s = s.replace(a, b)
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def sq(s):
    return fold(s).replace(" ", "")


calls = json.load(open(DATA))["calls"]
idx = []
for c in calls:
    idx.append((sq(c.get("title")), sq(c.get("org")), c))

STOP = set("the a an of and for in on at to open call photo photography "
           "photographic contest award awards prize international annual "
           "exhibition competition 2026 2027 juried show".split())

rows = [json.loads(l) for l in sys.stdin if l.strip()]
new, matched = [], []
for r in rows:
    t, o = sq(r.get("title")), sq(r.get("org"))
    hit = None
    for st, so, c in idx:
        if t and (t in st or st in t) and len(t) > 6:
            hit = c
            break
        if o and so and (o in so or so in o) and len(o) > 5:
            hit = c
            break
    # token overlap fallback
    if not hit:
        toks = [w for w in fold(r.get("title")).split() if w not in STOP and len(w) > 3]
        if len(toks) >= 2:
            for st, so, c in idx:
                if sum(1 for w in toks if w in st) >= max(2, len(toks) - 1):
                    hit = c
                    break
    (matched if hit else new).append((r, hit))

print(f"### {len(rows)} rows -> {len(new)} NEW, {len(matched)} matched\n")
print("=== NEW (need research) ===")
for r, _ in new:
    print(f"  * {r.get('deadline','?'):<22} | {r.get('title','')} | org={r.get('org','')} | {r.get('url','')}")
print("\n=== MATCHED (already stored) ===")
for r, h in matched:
    print(f"  - {r.get('title','')[:60]:<60} -> {h.get('slug')}")
