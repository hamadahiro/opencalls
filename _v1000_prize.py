import json,re,os
B=json.load(open('scripts/logs/2026-09-30-1000-batch.json'))
D=json.load(open('data.json'))
rows=D['calls'] if isinstance(D,dict) else D
by={r['slug']:r for r in rows}
slugs=[e['slug'] for e in B['batch']]
LOG='scripts/logs/v1000/'
def load(s):
    t=''
    for k in ('url','sub'):
        p=LOG+'%s__%s.txt'%(s,k)
        if os.path.exists(p): t+='\n@@%s@@\n'%k+open(p).read()
    return t
MONEY=re.compile(r'(?:US\$|CA\$|AU\$|NZ\$|\$|€|£|¥|₹)\s?(\d[\d,]*(?:\.\d\d)?)')
def amts(s):
    o=[]
    for m in MONEY.finditer(s or ''):
        try: o.append(float(m.group(1).replace(',','')))
        except: pass
    return o
# enumerated run: 2+ money tokens within 200 chars near an award word
AWARD=re.compile(r'(award|prize|place|winner|best of|honorable|grand|1st|2nd|3rd|first|second|third)',re.I)
MULT=re.compile(r'(\d+)\s*(?:×|x)\s*(?:US\$|CA\$|\$|€|£)|(?:US\$|CA\$|\$|€|£)\s?\d[\d,]*\s*(?:each|per\s+(?:winner|category|artist|photographer)|×\s*\d+)|(\d+)\s+(?:photographers?|winners?|artists?)\s+will\s+receive|(?:each\s+of\s+the\s+)(\w+)\s+(?:categor|winner)',re.I)
print('=== PRIZE: surface enumerated award amounts NOT in stored prize ===')
for s in slugs:
    c=by[s]; p=c.get('prize') or ''
    T=load(s)
    if len(T)<600: continue
    sp=set(amts(p))
    # collect award-context amounts
    ctx=set()
    for m in MONEY.finditer(T):
        w=T[max(0,m.start()-90):m.end()+90]
        if AWARD.search(w):
            try: ctx.add(float(m.group(1).replace(',','')))
            except: pass
    miss=sorted(a for a in ctx if a not in sp and a>=50)
    if len(miss)>=2 and sp:
        print('  %-56s prize=%r'%(s[:56],p))
        print('        surface-award amounts not in field:',miss[:12])
print()
print('=== PRIZE: MULTIPLIER language on surface ===')
for s in slugs:
    c=by[s]; p=c.get('prize') or ''
    T=load(s)
    if len(T)<600: continue
    hits=[]
    for m in MULT.finditer(T):
        hits.append(re.sub(r'\s+',' ',T[max(0,m.start()-70):m.end()+50]))
    if hits:
        pm = bool(re.search(r'×|\bx\s*\d|\beach\b|\bper\b',p,re.I))
        print('  %-52s prize=%r  field_has_mult=%s'%(s[:52],p,pm))
        for h in hits[:3]: print('        ...',h)
