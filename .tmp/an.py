import ast, json, collections
codes=json.load(open('D:/Work/Web/studyuBitProj/.tmp/codes.json',encoding='utf8'))
nodes=collections.Counter(); calls=collections.Counter(); attrs=collections.Counter(); imports=collections.Counter()
for c in codes:
    t=ast.parse(c['code'])
    for n in ast.walk(t):
        nodes[type(n).__name__]+=1
        if isinstance(n,ast.Call):
            f=n.func
            calls[ast.unparse(f) if not isinstance(f,ast.Attribute) or isinstance(f.value,(ast.Name,ast.Attribute)) else '?.'+f.attr]+=1
        if isinstance(n,(ast.Import,ast.ImportFrom)): imports[ast.unparse(n)]+=1
print(nodes.most_common()); print(); print(sorted(calls.items(),key=lambda x:-x[1])); print(imports)
