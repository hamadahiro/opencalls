import json,re,os,datetime
D=json.load(open('data.json')); rows=D['calls'] if isinstance(D,dict) else D
by={r['slug']:r for r in rows}
done=set(l.strip() for l in open('scripts/logs/2026-09-30-1000-verified.txt') if l.strip())
B=json.load(open('scripts/logs/2026-09-30-1000-batch.json'))
left=[e['slug'] for e in B['batch'] if e['slug'] not in done]
MON='January February March April May June July August September October November December'.split()
def surf(s):
    t=''
    for k in ('url','sub'):
        p='scripts/logs/v1000/%s__%s.txt'%(s,k)
        if os.path.exists(p): t+='\n@@%s@@\n'%k+open(p,encoding='utf-8',errors='replace').read()
        p='scripts/logs/v1000/%s__%s.raw'%(s,k)
        if os.path.exists(p): t+='\n@@%sRAW@@\n'%k+open(p,encoding='utf-8',errors='replace').read()
    return t
MONEY=re.compile(r'(?:US\$|CA\$|AU\$|NZ\$|\$|€|£|¥|₹)\s?(\d[\d,]*(?:\.\d\d)?)')
for s in left:
    c=by[s]; T=surf(s)
    d=c.get('deadline'); ev='-'
    if d and re.match(r'^\d{4}-\d{2}-\d{2}$',str(d)):
        y,mo,da=map(int,d.split('-'))
        pats=[(r'%s\s*\.?\s*%d(?:st|nd|rd|th)?,?\s*%d'%(MON[mo-1],da,y)),(r'%s\s*\.?\s*%d(?:st|nd|rd|th)?,?\s*%d'%(MON[mo-1][:3],da,y)),
              (r'%d(?:st|nd|rd|th)?\s*%s,?\s*%d'%(da,MON[mo-1],y)),(r'%d(?:st|nd|rd|th)?\s*%s,?\s*%d'%(da,MON[mo-1][:3],y)),
              (r'%04d-%02d-%02d'%(y,mo,da)),(r'\b%d/%d/%d\b'%(mo,da,y%100)),(r'\b%02d/%02d/%02d\b'%(mo,da,y%100)),(r'\b%d/%d/%d\b'%(da,mo,y%100)),(r'\b%02d/%02d/%04d\b'%(da,mo,y)),
              (r'%s\s*\.?\s*%d(?:st|nd|rd|th)?\b'%(MON[mo-1],da)),(r'%s\s*\.?\s*%d(?:st|nd|rd|th)?\b'%(MON[mo-1][:3],da)),(r'%d(?:st|nd|rd|th)?\s+%s'%(da,MON[mo-1]))]
        for p in pats:
            m=re.search(p,T,re.I)
            if m: ev=re.sub(r'\s+',' ',T[max(0,m.start()-55):m.end()+25]); break
    elif d=='Continuous':
        m=re.search(r'[^\n]{0,60}(rolling|ongoing|continuous|year[- ]round|any time|no deadline)[^\n]{0,60}',T,re.I)
        ev=re.sub(r'\s+',' ',m.group(0)) if m else '!! no rolling phrase'
    fee=c.get('fee'); fa=set()
    for m in MONEY.finditer(fee or ''):
        try: fa.add(float(m.group(1).replace(',','')))
        except: pass
    ta=set()
    for m in MONEY.finditer(T):
        try: ta.add(float(m.group(1).replace(',','')))
        except: pass
    fmiss=sorted(a for a in fa if a not in ta)
    pz=c.get('prize'); pa=set()
    for m in MONEY.finditer(pz or ''):
        try: pa.add(float(m.group(1).replace(',','')))
        except: pass
    pmiss=sorted(a for a in pa if a not in ta)
    tag='OK ' if (ev not in ('-',) and not ev.startswith('!!') and not fmiss and not pmiss) else '?? '
    print('%s%-62s dl=%-11s'%(tag,s[:62],d))
    print('        dl_ev: %s'%ev[:150])
    if fmiss: print('        FEE amounts not on surface: %s   (fee=%r)'%(fmiss,fee))
    if pmiss: print('        PRIZE amounts not on surface: %s   (prize=%r)'%(pmiss,pz))
