#!/bin/zsh
U="$1"
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
B=$(curl -sSL --max-time 30 -A "$UA" "$U" 2>/dev/null)
if [ ${#B} -lt 500 ]; then B=$(curl -sSL --max-time 30 "$U" 2>/dev/null); fi
if [ ${#B} -lt 500 ]; then B=$(curl -sSL --max-time 40 -A "$UA" "https://r.jina.ai/$U" 2>/dev/null); fi
T=$(print -r -- "$B" | python3 -I /Users/hh/Developer/Monographica/opencalls/.scratch/n1110/txt.py)
echo "###### $U raw=${#B} txt=${#T}"
print -r -- "$T" | grep -niE 'deadline|closing date|closes|submission|entries? (open|close)|apply by|open call|call for|due |2026|2027|no longer|closed' | head -28 | cut -c1-260
