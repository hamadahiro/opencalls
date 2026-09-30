import json,re,os,datetime,calendar
B=json.load(open('scripts/logs/2026-09-30-1000-batch.json'))
D=json.load(open('data.json'))
rows=D['calls'] if isinstance(D,dict) else D
by={r['slug']:r for r in rows}
slugs=[e['slug'] for e in B['batch']]
LOG='scripts/logs/v1000/'
def load(s,k):
    p=LOG+'%s__%s.%s'%(s,k,'txt')
    q=LOG+'%s__%s.%s'%(s,k,'raw')
    t=open(p).read() if os.path.exists(p) else ''
    r=open(q).read() if os.path.exists(q) else ''
    return t,r
MON='January February March April May June July August September October November December'.split()
MAB={m[:3].lower():i+1 for i,m in enumerate(MON)}
WD='Monday Tuesday Wednesday Thursday Friday Saturday Sunday'.split()
CLOSE=re.compile(r'(now closed|closed for (?:submissions|entries)|submissions (?:are )?closed|call is closed|entries (?:are )?closed|deadline has passed|no longer accepting|applications (?:are )?closed|this open call is closed|closed!)',re.I)
EXT=re.compile(r'(deadline extended|extended (?:to|until|through)|new deadline|extension)',re.I)
out={}
for s in slugs:
    c=by[s]; rec={}
    tu,ru=load(s,'url'); ts,rs=load(s,'sub')
    T=tu+'\n@@@SUB@@@\n'+ts; R=ru+'\n@@@SUB@@@\n'+rs
    rec['lenU']=len(tu); rec['lenS']=len(ts)
    cl=[(m.start(),m.group(0)) for m in CLOSE.finditer(T)]
    if cl: rec['closure']=cl[:6]
    ex=[(m.start(),m.group(0)) for m in EXT.finditer(T)]
    if ex: rec['extend']=ex[:6]
    # hidden-markup closure
    if CLOSE.search(R) and ('w-condition-invisible' in R or 'w-dyn-hide' in R): rec['hidden_markup']=True
    # deadline presence
    d=c.get('deadline')
    if d and re.match(r'^\d{4}-\d{2}-\d{2}$',str(d)):
        y,mo,da=map(int,d.split('-'))
        dt=datetime.date(y,mo,da)
        pats=[r'%s\s+%d(?:st|nd|rd|th)?,?\s*%d'%(MON[mo-1],da,y), r'%s\.?\s+%d(?:st|nd|rd|th)?,?\s*%d'%(MON[mo-1][:3],da,y),
              r'%d(?:st|nd|rd|th)?\s+%s,?\s*%d'%(da,MON[mo-1],y), r'%04d-%02d-%02d'%(y,mo,da),
              r'%d[/.]%d[/.]%d'%(mo,da,y), r'%d[/.]%d[/.]%d'%(da,mo,y),
              r'%s\s+%d(?:st|nd|rd|th)?\b'%(MON[mo-1],da), r'%s\.?\s+%d(?:st|nd|rd|th)?\b'%(MON[mo-1][:3],da)]
        rec['dl_found']=any(re.search(p,T,re.I) for p in pats)
        rec['dl_wd']=WD[dt.weekday()]
    # weekday-dated phrases on surface
    wdp=[]
    for m in re.finditer(r'(%s)\s*,?\s*(?:the\s+)?(?:(%s)[a-z]*\.?\s+(\d{1,2})|(\d{1,2})(?:st|nd|rd|th)?\s+(%s)[a-z]*)(?:,?\s*(\d{4}))?'%('|'.join(WD),'|'.join(m[:3] for m in MON),'|'.join(m[:3] for m in MON)),T,re.I):
        wd=m.group(1); mn=(m.group(2) or m.group(5)).lower()[:3]; dd=int(m.group(3) or m.group(4)); yy=int(m.group(6)) if m.group(6) else None
        for yc in ([yy] if yy else [2026,2027]):
            try: real=WD[datetime.date(yc,MAB[mn],dd).weekday()]
            except Exception: continue
            if real.lower()==wd.lower(): break
        else:
            wdp.append((m.group(0)[:60], 'claims '+wd, 'actual '+(WD[datetime.date(yy or 2026,MAB[mn],dd).weekday()] if True else '')))
    if wdp: rec['weekday_mismatch']=wdp[:6]
    out[s]=rec
json.dump(out,open('_v1000_sweep.json','w'),indent=0)
# report
print('=== CLOSURE HITS ===')
for s,r in out.items():
    if 'closure' in r: print(' ',s,'| lenU=%d lenS=%d'%(r['lenU'],r['lenS']),'| hidden' if r.get('hidden_markup') else '','|',r['closure'])
print()
print('=== EXTENSION HITS ===')
for s,r in out.items():
    if 'extend' in r: print(' ',s,'|',r['extend'])
print()
print('=== DEADLINE NOT FOUND ON SURFACE ===')
for s,r in out.items():
    if r.get('dl_found') is False: print('  %-70s stored=%s (%s) lenU=%d lenS=%d'%(s,by[s]['deadline'],r.get('dl_wd'),r['lenU'],r['lenS']))
print()
print('=== WEEKDAY MISMATCH PHRASES ===')
for s,r in out.items():
    if 'weekday_mismatch' in r:
        print(' ',s)
        for w in r['weekday_mismatch']: print('     ',w)
