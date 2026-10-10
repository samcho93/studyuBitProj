import ast, json, collections
codes=json.load(open('codes.json',encoding='utf8'))
imgs=collections.Counter(); kws=collections.Counter(); show=collections.Counter(); misc=collections.Counter()
for c in codes:
    t=ast.parse(c['code'])
    for n in ast.walk(t):
        if isinstance(n,ast.Attribute) and isinstance(n.value,ast.Name) and n.value.id=='Image': imgs[n.attr]+=1
        if isinstance(n,ast.Call):
            f=ast.unparse(n.func)
            for k in n.keywords: kws[f+':'+str(k.arg)+'='+ast.unparse(k.value)]+=1
            if f=='display.show' and n.args: show[type(n.args[0]).__name__+':'+ast.unparse(n.args[0])[:30]]+=1
        if isinstance(n,(ast.Dict,ast.ListComp,ast.With,ast.Try,ast.Slice,ast.IfExp)): misc[c['title']+' '+type(n).__name__]+=1
print(imgs); print(); print(kws); print(); print([k for k in show if not k.startswith('Attribute')]); print(); print(list(misc))
