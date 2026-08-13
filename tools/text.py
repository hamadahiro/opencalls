#!/usr/bin/env python3
"""HTML -> readable text. Decodes \\uXXXX, strips comments + script/style FIRST.
Usage: python3 tools/text.py FILE [grep-token ...]
With tokens: prints only context windows around each token (case-insensitive,
newline-safe). Without: prints the whole stripped body.
"""
import sys, re, html, codecs

path = sys.argv[1]
toks = sys.argv[2:]
raw = open(path, "rb").read().decode("utf-8", "replace")

# 1. decode \uXXXX escapes (JSON blobs inside script tags)
def _u(m):
    try:
        return codecs.decode(m.group(0), "unicode_escape")
    except Exception:
        return m.group(0)
raw = re.sub(r"\\u[0-9a-fA-F]{4}", _u, raw)
raw = raw.replace("\\/", "/").replace('\\"', '"')

# 2. strip comments, script, style BEFORE tags
raw = re.sub(r"<!--.*?-->", " ", raw, flags=re.S)
raw = re.sub(r"<script\b.*?</script>", " ", raw, flags=re.S | re.I)
raw = re.sub(r"<style\b.*?</style>", " ", raw, flags=re.S | re.I)
raw = re.sub(r"<noscript\b.*?</noscript>", " ", raw, flags=re.S | re.I)

# 3. block tags -> newlines
raw = re.sub(r"<(br|/p|/div|/li|/h[1-6]|/tr|/section)\b[^>]*>", "\n", raw, flags=re.I)
raw = re.sub(r"<[^>]+>", " ", raw)
txt = html.unescape(raw)
txt = re.sub(r"[ \t\xa0]+", " ", txt)
txt = re.sub(r"\n\s*\n\s*", "\n", txt)
txt = txt.strip()

if not toks:
    print(txt)
else:
    flat = txt
    for t in toks:
        print(f"\n===== {t} =====")
        n = 0
        for m in re.finditer(re.escape(t), flat, re.I):
            a, b = max(0, m.start() - 250), min(len(flat), m.end() + 350)
            print("  ..." + flat[a:b].replace("\n", " ⏎ ") + "...")
            n += 1
            if n >= 12:
                print("  [12 shown, more exist]")
                break
        if n == 0:
            print("  (0 hits)")
