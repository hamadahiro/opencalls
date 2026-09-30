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
MONEY=re.compile(r'(?:US\$|CA\$|AU\$|NZ\$|\$|€|£|¥|₹|CHF\s?|SEK\s?|NOK\s?|DKK\s?)\s?(\d[\d,\.]*)')
def amts(s):
    out=[]
    for m in MONEY.finditer(s or ''):
        v=m.group(1).replace(',','')
        try:
            f=float(v) if '.' in v else float(int(v))
        except: continue
        out.append(f)
    return out
print('=== FEE: stored amounts NOT on surface (understating risk) ===')
for s in slugs:
    c=by[s]; f=c.get('fee')
    if not f or f in ('Free',''): continue
    T=load(s)
    if len(T)<600: continue
    sa=set(amts(f)); ta=set(amts(T))
    miss=sorted(a for a in sa if a not in ta)
    if miss: print('  %-62s fee=%r MISSING=%s'%(s[:62],f,miss))
print()
print('=== FEE: surface amount ABOVE stored max (read the label) ===')
for s in slugs:
    c=by[s]; f=c.get('fee')
    if f is None: continue
    T=load(s)
    if len(T)<600: continue
    sa=amts(f); ta=amts(T)
    if not ta: continue
    mx=max(sa) if sa else 0
    hi=sorted({a for a in ta if a>mx and a<2000})
    if hi and (not sa or max(hi)>mx*1.5):
        # print context of the largest
        ctx=[]
        for a in hi[-3:]:
            av=('%d'%a) if a==int(a) else ('%g'%a)
            m=re.search(r'.{70}[\$€£]\s?'+re.escape(av)+r'\b.{70}',T,re.S)
            if m: ctx.append(re.sub(r'\s+',' ',m.group(0)))
        print('  %-58s fee=%r HIGHER=%s'%(s[:58],f,hi[-5:]))
        for x in ctx: print('        ...',x)
