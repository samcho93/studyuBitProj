import io
p = 'D:/Work/Web/studyuBitProj/js/custom.js'
s = io.open(p, encoding='utf8').read()


def rep(old, new):
    global s
    assert old in s, old[:70]
    s = s.replace(old, new, 1)


rep("""    if (t.startsWith('list<')) { const e = pyType(t.slice(5, -1)); return (e || 'number') + '[]'; }""",
    """    if (t.startsWith('list<')) { const e = pyType(t.slice(5, -1)); return e ? e + '[]' : null; }""")
rep("""      if (/^mb_text_(length|char_at|index_of|includes)$/.test(p.type) && inp.name === 'TEXT') return 'string';
      return null;
    };
    all.forEach((b) => {
      if (b.type !== 'variables_get') return;
      const n = varOf(b), top = topOf(b), u = usage(b);
      if (!u) return;
      if (top.type === 'mb_fn_def' && fnParams(top).includes(n)) { const k = top.getFieldValue('NAME') + '.' + n; if (!pt.has(k)) pt.set(k, u); } else if (!vt.has(n)) vt.set(n, u);
    });""", """      if (/^mb_text_(length|char_at|index_of|includes)$/.test(p.type) && inp.name === 'TEXT') return 'string';
      if (p.type === 'logic_compare') { const o = p.getInputTargetBlock(inp.name === 'A' ? 'B' : 'A'); return Tq(o) === 'string' ? 'string' : null; }
      return null;
    };
    // 쓰임새가 여럿이면 더 구체적인 것 (글자 · 참거짓이 들어 있거나 배열이 더 깊은 것)
    const score = (t) => (/string|boolean/.test(t) ? 10 : 0) + (t.match(/\\[\\]/g) || []).length;
    const guess = new Map();
    all.forEach((b) => {
      if (b.type !== 'variables_get') return;
      const n = varOf(b), top = topOf(b), u = usage(b);
      if (!u) return;
      const k = top.type === 'mb_fn_def' && fnParams(top).includes(n) ? 'p:' + top.getFieldValue('NAME') + '.' + n : 'v:' + n;
      if (!guess.has(k) || score(u) > score(guess.get(k))) guess.set(k, u);
    });
    guess.forEach((u, k) => { const key = k.slice(2); if (k[0] === 'p') { if (!pt.has(key)) pt.set(key, u); } else if (!vt.has(key)) vt.set(key, u); });""")
io.open(p, 'w', encoding='utf8', newline='\n').write(s)
print('ok')
