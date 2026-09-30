import json,sys,io
P='data.json'
def load():
    with io.open(P,encoding='utf-8') as f: return json.load(f)
def save(D):
    with io.open(P,'w',encoding='utf-8') as f:
        json.dump(D,f,ensure_ascii=False,indent=2)
        f.write('\n')
def rowsof(D): return D['calls'] if isinstance(D,dict) else D
def apply(edits):
    D=load(); rows=rowsof(D); by={r['slug']:r for r in rows}
    for slug,field,old,new in edits:
        c=by[slug]
        cur=c.get(field,'<ABSENT>')
        assert cur==old, 'MISMATCH %s.%s stored=%r expected=%r'%(slug,field,cur,old)
        c[field]=new
        print('OK %-58s %-12s %r -> %r'%(slug,field,old,new))
    save(D)
    # revalidate
    D2=load(); assert len(rowsof(D2))==len(rows), 'row count changed'
    print('data.json valid, rows=',len(rowsof(D2)))
if __name__=='__main__':
    pass
