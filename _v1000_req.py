import json,re,os
B=json.load(open('scripts/logs/2026-09-30-1000-batch.json'))
D=json.load(open('data.json'))
rows=D['calls'] if isinstance(D,dict) else D
by={r['slug']:r for r in rows}
slugs=[e['slug'] for e in B['batch']]
LOG='scripts/logs/v1000/'
W={'one':1,'two':2,'three':3,'four':4,'five':5,'six':6,'seven':7,'eight':8,'nine':9,'ten':10,'twelve':12,'fifteen':15,'twenty':20,'thirty':30}
CAP=re.compile(r'(?:up to|maximum(?: of)?|max\.?(?: of)?|no more than|a maximum of|limit(?:ed)? to|submit)\s+(\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty|thirty)\s*(?:\(\d+\)\s*)?(images?|photographs?|photos?|works?|pieces?|entries|files)',re.I)
RANGE=re.compile(r'(\d{1,3})\s*(?:-|–|—|to)\s*(\d{1,3})\s*(images?|photographs?|photos?|works?|pieces?)',re.I)
def num(x):
    x=x.lower()
    return W.get(x, int(x) if x.isdigit() else None)
print('=== REQUIREMENTS cap diff: surface cap vs stored ===')
for s in slugs:
    c=by[s]; r=c.get('requirements')
    T=''
    for k in ('url','sub'):
        p=LOG+'%s__%s.txt'%(s,k)
        if os.path.exists(p): T+='\n'+open(p,encoding='utf-8',errors='replace').read()
    if len(T)<600: continue
    stored=[int(x) for x in re.findall(r'\d+',r or '')]
    smax=max(stored) if stored else None
    caps={}
    for m in CAP.finditer(T):
        n=num(m.group(1)); u=m.group(2).lower()
        if n is None or n>200: continue
        caps.setdefault(n,re.sub(r'\s+',' ',T[max(0,m.start()-70):m.end()+40]))
    for m in RANGE.finditer(T):
        n=int(m.group(2))
        if n>200: continue
        caps.setdefault(n,re.sub(r'\s+',' ',T[max(0,m.start()-70):m.end()+40]))
    if not caps: continue
    hi=[n for n in caps if smax is not None and n>smax]
    if hi:
        print('  %-56s stored=%r (max %s)'%(s[:56],r,smax))
        for n in sorted(hi)[-3:]: print('       surface cap %-4d ... %s'%(n,caps[n][:190]))
