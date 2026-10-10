import io
p = 'D:/Work/Web/studyuBitProj/js/custom.js'
s = io.open(p, encoding='utf8').read()


def rep(old, new):
    global s
    assert old in s, old[:70]
    s = s.replace(old, new, 1)


# 쓰임새로 자료형 짐작 (매개변수 path 를 path[i][0] 처럼 쓰면 number[][])
rep("""    // 끝까지 모르는 것은 수로 본다
    all.forEach((b) => {""", """    // 그래도 모르면 쓰임새로 짐작: 목록 블록의 '목록' 칸에 들어가면 배열, 글자 블록이면 문자열
    const LIST_IN = { mb_list_get: 1, mb_list_set: 1, mb_list_length: 1, mb_list_push: 1, mb_list_remove_first: 1, mb_list_remove_last: 1, mb_list_remove_at: 1, mb_list_shift: 1, mb_list_pop: 1, mb_list_insert: 1, mb_list_index_of: 1 };
    const usage = (vb) => {
      const p = vb.getParent(), inp = p && p.getInputWithBlock(vb);
      if (!inp) return null;
      if (LIST_IN[p.type] && inp.name === 'LIST') { if (p.type === 'mb_list_get') { const u = usage(p); return (u && u.endsWith('[]') ? u : 'number') + '[]'; } return 'number[]'; }
      if (p.type === 'controls_forEach' && inp.name === 'LIST') return 'number[]';
      if (/^mb_text_(length|char_at|index_of|includes)$/.test(p.type) && inp.name === 'TEXT') return 'string';
      return null;
    };
    all.forEach((b) => {
      if (b.type !== 'variables_get') return;
      const n = varOf(b), top = topOf(b), u = usage(b);
      if (!u) return;
      if (top.type === 'mb_fn_def' && fnParams(top).includes(n)) { const k = top.getFieldValue('NAME') + '.' + n; if (!pt.has(k)) pt.set(k, u); } else if (!vt.has(n)) vt.set(n, u);
    });
    // 끝까지 모르는 것은 수로 본다
    all.forEach((b) => {""")
# 값 없는 return → 함수 반환 자료형의 기본값 (MakeCode 는 모든 길에서 값을 돌려줘야 함)
rep("""  stmt('mb_fn_return', (b, g) => (b.getInputTargetBlock('VALUE') ? `return ${g.v(b, 'VALUE', O.NONE)}` : 'return'));""",
    """  stmt('mb_fn_return', (b, g) => (b.getInputTargetBlock('VALUE') ? `return ${g.v(b, 'VALUE', O.NONE)}` : 'return'), (b, g) => {
    if (b.getInputTargetBlock('VALUE')) return `return ${g.v(b, 'VALUE', O.NONE)}`;
    const top = topOf(b), rt = top.type === 'mb_fn_def' && g.types.ft.get(top.getFieldValue('NAME'));
    return rt ? 'return ' + TS_DEFAULT(rt) : 'return';
  });""")
rep("""      out.push([...cmLines(b, false), `function ${g.name(fn)} (${ps.join(', ')}) {`, g.body(b, 'DO'), '}'].join('\\n'));""",
    """      // 값을 돌려주는 함수는 끝에서도 돌려주게 하고, 배열을 돌려주면 형식을 적는다 (MakeCode 컴파일러가 요구)
      const rt = T.ft.get(fn);
      let last = b.getInputTargetBlock('DO');
      while (last && last.getNextBlock()) last = last.getNextBlock();
      let body = g.body(b, 'DO');
      if (rt && !(last && last.type === 'mb_fn_return')) body += (body ? '\\n' : '') + '    return ' + TS_DEFAULT(rt);
      out.push([...cmLines(b, false), `function ${g.name(fn)} (${ps.join(', ')})${rt && rt.endsWith('[]') ? ': ' + rt : ''} {`, body, '}'].join('\\n'));""")
io.open(p, 'w', encoding='utf8', newline='\n').write(s)
print('ok')
