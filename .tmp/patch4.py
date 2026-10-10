import io
p = 'D:/Work/Web/studyuBitProj/js/custom.js'
s = io.open(p, encoding='utf8').read()


def rep(old, new):
    global s
    assert old in s, old[:70]
    s = s.replace(old, new, 1)


rep("""    guess.forEach((u, k) => { const key = k.slice(2); if (k[0] === 'p') { if (!pt.has(key)) pt.set(key, u); } else if (!vt.has(key)) vt.set(key, u); });""",
    """    guess.forEach((u, k) => { const key = k.slice(2); if (k[0] === 'p') { if (!pt.has(key)) pt.set(key, u); } else if (!vt.has(key)) vt.set(key, u); });
    // 돌려주는 값의 자료형을 모르는 함수는, 호출 결과를 받는 변수의 자료형으로
    all.forEach((b) => {
      if (b.type !== 'mb_fn_call_expr' || ft.has(b.getFieldValue('NAME'))) return;
      const p = b.getParent();
      if (p && p.type === 'variables_set' && vt.has(varOf(p))) ft.set(b.getFieldValue('NAME'), vt.get(varOf(p)));
    });""")
rep("""        if (b.type === 'mb_fn_return') code += '\\nreturn ' + TS_DEFAULT(g.types.T(b.getInputTargetBlock('VALUE')));""",
    """        if (b.type === 'mb_fn_return') { const top = topOf(b); code += '\\nreturn ' + TS_DEFAULT((top.type === 'mb_fn_def' && g.types.ft.get(top.getFieldValue('NAME'))) || g.types.T(b.getInputTargetBlock('VALUE'))); }""")
io.open(p, 'w', encoding='utf8', newline='\n').write(s)
print('ok')
