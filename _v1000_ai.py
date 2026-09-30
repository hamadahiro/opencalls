import json,re,os
B=json.load(open('scripts/logs/2026-09-30-1000-batch.json'))
D=json.load(open('data.json'))
rows=D['calls'] if isinstance(D,dict) else D
by={r['slug']:r for r in rows}
slugs=[e['slug'] for e in B['batch']]
LOG='scripts/logs/v1000/'
# creation/authorship AI clause only
CLAUSE=re.compile(r'[^.\n]{0,170}(?:\bA\.?I\.?\b|artificial intelligence|generative)[^.\n]{0,170}',re.I)
CREATION=re.compile(r'(generat|creat|produc|made with|made using|authorship|wholly|entirely|assisted|derived|synthet|prompt)',re.I)
NOISE=re.compile(r'(Anguilla|"AI":|AI":"|/ai/|\bAIGA\b|AIR\b|Air\b)',re.I)
print('=== AI CREATION CLAUSES on surfaces vs stored ai ===')
for s in slugs:
    c=by[s]; stored=c.get('ai','<ABSENT>')
    hits=[]
    for k in ('url','sub'):
        for ext in ('txt','raw'):
            p=LOG+'%s__%s.%s'%(s,k,ext)
            if not os.path.exists(p): continue
            t=open(p,encoding='utf-8',errors='replace').read()
            for m in CLAUSE.finditer(t):
                g=re.sub(r'\s+',' ',m.group(0)).strip()
                if NOISE.search(g): continue
                if not CREATION.search(g): continue
                hits.append((k,ext,g[:230]))
    if not hits: continue
    seen=set(); uh=[]
    for k,e,g in hits:
        key=g[:90]
        if key in seen: continue
        seen.add(key); uh.append((k,e,g))
    print('  %-58s stored_ai=%r'%(s[:58],stored))
    for k,e,g in uh[:3]: print('      [%s/%s] %s'%(k,e,g))
