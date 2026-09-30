import json,re,os,datetime
B=json.load(open('scripts/logs/2026-09-30-1000-batch.json'))
D=json.load(open('data.json'))
rows=D['calls'] if isinstance(D,dict) else D
by={r['slug']:r for r in rows}
slugs=[e['slug'] for e in B['batch']]
LOG='scripts/logs/v1000/'

print('=== 1. eligibility [] but description/summary states a RESTRICTION ===')
RESTR=re.compile(r'\b(only open to|open only to|must be (?:a )?(?:resident|citizen|based|aged)|residents of|citizens of|members only|aged \d{2}\+|\d{2} (?:years )?(?:or older|and over)|students? only|women only|under-?\d{2} only|restricted to|limited to (?:artists|photographers) (?:living|based|residing)|must (?:live|reside) in|nationals? of)\b',re.I)
n=0
for s in slugs:
    c=by[s]
    if c.get('eligibility')!=[]: continue
    blob=' '.join(str(c.get(k) or '') for k in ('description','summary'))
    m=RESTR.search(blob)
    if m:
        i=m.start(); print('  %-56s :: %s'%(s[:56],re.sub(r'\s+',' ',blob[max(0,i-100):i+140]))); n+=1
print('  hits:',n)

print()
print('=== 2. verifyNote EMAIL LEAK (corpus-wide) ===')
EM=re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b')
leak=0
for r in rows:
    nt=r.get('verifyNote') or ''
    hits=sorted(set(EM.findall(nt)))
    hits=[h for h in hits if not h.lower().startswith(('email@','user@','name@','you@','someone@','example@'))]
    if hits:
        print('  %-58s %s'%(r['slug'][:58],hits[:4])); leak+=1
print('  rows with a leaked address in verifyNote:',leak)

print()
print('=== 3. url == submitUrl : mechanical form test on RAW ===')
for e in B['batch']:
    if not any('identical' in w for w in e.get('_warnings',[])): continue
    s=e['slug']; c=by[s]
    p=LOG+'%s__url.raw'%s
    raw=open(p,encoding='utf-8',errors='replace').read() if os.path.exists(p) else ''
    cnt={k:len(re.findall(k,raw,re.I)) for k in ['<form','type="file"','type="submit"','stripe','paypal','entrythingy','smarterentry','callforentry','submittable','tally\\.so','jotform','wufoo','airtable','google\\.com/forms']}
    print('  %-58s submitVia=%-22s %s'%(s[:58],c.get('submitVia'),{k:v for k,v in cnt.items() if v}))

print()
print('=== 4. DEADLINE == TODAY 2026-09-30 : closure strings on surface ===')
CLOSE=re.compile(r'(now closed|closed for (?:submissions|entries)|submissions (?:are )?closed|deadline has passed|no longer accepting|applications (?:are )?closed)',re.I)
for s in slugs:
    c=by[s]
    if c.get('deadline')!='2026-09-30': continue
    T=''
    for k in ('url','sub'):
        p=LOG+'%s__%s.txt'%(s,k)
        if os.path.exists(p): T+='\n'+open(p,encoding='utf-8',errors='replace').read()
    hits=[re.sub(r'\s+',' ',T[max(0,m.start()-90):m.end()+60]) for m in CLOSE.finditer(T)]
    print('  %-58s len=%-6d closure_hits=%d'%(s[:58],len(T),len(hits)))
    for h in hits[:2]: print('        !',h[:170])
