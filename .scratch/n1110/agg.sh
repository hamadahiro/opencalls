#!/bin/zsh
U="$1"
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
B=$(curl -sSL --max-time 35 -A "$UA" "$U" 2>/dev/null)
if [ ${#B} -lt 800 ]; then B=$(curl -sSL --max-time 40 -A "$UA" "https://r.jina.ai/$U" 2>/dev/null); fi
T=$(print -r -- "$B" | python3 -I /Users/hh/Developer/Monographica/opencalls/.scratch/n1110/txt.py)
echo "###### $U raw=${#B} txt=${#T}"
print -r -- "$T" | head -c 7000
