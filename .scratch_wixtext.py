import sys,re,html,json
p=sys.argv[1]
b=open(p,encoding='utf-8',errors='replace').read()
# pull text out of Wix warmup JSON + inline html
texts=[]
# 1) plain html text nodes
body=re.sub(r'(?is)<(script|style)[^>]*>.*?</\1>',' ',b)
body=re.sub(r'(?s)<[^>]+>',' ',body)
texts.append(html.unescape(body))
# 2) escaped html inside JSON strings
for m in re.finditer(r'\\u003c[^"]{0,20000}',b):
    s=m.group(0)
    s=s.replace('\\u003c','<').replace('\\u003e','>').replace('\\u0026','&').replace('\\"','"')
    s=re.sub(r'(?s)<[^>]+>',' ',s)
    texts.append(html.unescape(s))
t=' '.join(texts)
t=re.sub(r'[ \t\xa0]+',' ',t)
t=re.sub(r'\n{2,}','\n',t)
print(t)
