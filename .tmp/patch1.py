import io
p = 'D:/Work/Web/studyuBitProj/js/custom.js'
s = io.open(p, encoding='utf8').read()


def rep(old, new):
    global s
    assert old in s, old[:70]
    s = s.replace(old, new, 1)


rep("""    const elem = (t) => (t && t.endsWith('[]') ? t.slice(0, -2) : 'number');
    function T(b) {
      if (!b) return 'number';
      switch (b.type) {""", """    const elem = (t) => (t && t.endsWith('[]') ? t.slice(0, -2) : null);
    // 모르면 null (함수의 반환 자료형처럼 나중에 알게 되는 것을 미리 '수'로 굳히지 않게)
    function Tq(b) {
      if (!b) return null;
      switch (b.type) {""")
rep("""        case 'lists_create_with': { const f = b.getInputTargetBlock('ADD0'); return f ? T(f) + '[]' : 'number[]'; }
        case 'mb_list_get': case 'mb_list_shift': case 'mb_list_pop': return elem(T(b.getInputTargetBlock('LIST')));
        case 'variables_get': {
          const n = varOf(b), top = topOf(b);
          if (top.type === 'mb_fn_def' && fnParams(top).includes(n)) return pt.get(top.getFieldValue('NAME') + '.' + n) || 'number';
          return vt.get(n) || 'number';
        }
        case 'mb_fn_call_expr': return ft.get(b.getFieldValue('NAME')) || 'number';
        case 'py_raw_expr': return pyType(b.hint) || 'number';
        default: return 'number';
      }
    }""", """        case 'lists_create_with': { const f = b.getInputTargetBlock('ADD0'); if (!f) return 'number[]'; const t = Tq(f); return t ? t + '[]' : null; }
        case 'mb_list_get': case 'mb_list_shift': case 'mb_list_pop': return elem(Tq(b.getInputTargetBlock('LIST')));
        case 'variables_get': {
          const n = varOf(b), top = topOf(b);
          if (top.type === 'mb_fn_def' && fnParams(top).includes(n)) return pt.get(top.getFieldValue('NAME') + '.' + n) || null;
          return vt.get(n) || null;
        }
        case 'mb_fn_call_expr': return ft.get(b.getFieldValue('NAME')) || null;
        case 'py_raw_expr': return pyType(b.hint);
        default: return 'number';
      }
    }
    const T = (b) => Tq(b) || 'number';""")
rep("""          const unknown = v && v.type === 'py_raw_expr' && !pyType(v.hint);
          if (!vt.has(n) && !empty && !unknown) vt.set(n, T(v));
        } else if (b.type === 'mb_list_push' || b.type === 'mb_list_insert') {
          const l = b.getInputTargetBlock('LIST');
          if (l && l.type === 'variables_get' && !vt.has(varOf(l))) vt.set(varOf(l), T(b.getInputTargetBlock('VALUE')) + '[]');
        } else if (b.type === 'controls_forEach') {
          if (!vt.has(varOf(b))) vt.set(varOf(b), elem(T(b.getInputTargetBlock('LIST'))));
        } else if (b.type === 'mb_fn_call' || b.type === 'mb_fn_call_expr') {
          const fn = b.getFieldValue('NAME');
          (b.params || []).forEach((p, i) => { const a = b.getInputTargetBlock('ARG' + i); if (a && !pt.has(fn + '.' + p)) pt.set(fn + '.' + p, T(a)); });
        } else if (b.type === 'mb_fn_return') {
          const top = topOf(b), v = b.getInputTargetBlock('VALUE');
          if (top.type === 'mb_fn_def' && v && !ft.has(top.getFieldValue('NAME'))) ft.set(top.getFieldValue('NAME'), T(v));
        }
      });
    }""", """          const t = Tq(v);
          if (!vt.has(n) && !empty && t) vt.set(n, t);
        } else if (b.type === 'mb_list_push' || b.type === 'mb_list_insert') {
          const l = b.getInputTargetBlock('LIST'), t = Tq(b.getInputTargetBlock('VALUE'));
          if (l && l.type === 'variables_get' && !vt.has(varOf(l)) && t) vt.set(varOf(l), t + '[]');
        } else if (b.type === 'controls_forEach') {
          const t = elem(Tq(b.getInputTargetBlock('LIST')));
          if (!vt.has(varOf(b)) && t) vt.set(varOf(b), t);
        } else if (b.type === 'mb_fn_call' || b.type === 'mb_fn_call_expr') {
          const fn = b.getFieldValue('NAME');
          (b.params || []).forEach((p, i) => { const t = Tq(b.getInputTargetBlock('ARG' + i)); if (t && !pt.has(fn + '.' + p)) pt.set(fn + '.' + p, t); });
        } else if (b.type === 'mb_fn_return') {
          const top = topOf(b), t = Tq(b.getInputTargetBlock('VALUE'));
          if (top.type === 'mb_fn_def' && t && !ft.has(top.getFieldValue('NAME'))) ft.set(top.getFieldValue('NAME'), t);
        }
      });
    }
    // 끝까지 모르는 것은 수로 본다
    all.forEach((b) => {
      if (b.type === 'controls_forEach' && !vt.has(varOf(b))) vt.set(varOf(b), 'number');
      if (b.type === 'variables_set' && !vt.has(varOf(b))) { const v = b.getInputTargetBlock('VALUE'); if (!(v && v.type === 'lists_create_with' && !v.getInputTargetBlock('ADD0'))) vt.set(varOf(b), T(v)); }
    });""")
rep("""        code = String(GEN[b.type].py(b, g.pyg)).split('\\n').map((l) => '// [파이썬] ' + l).join('\\n');
        g.raw++; commented = true;""", """        code = String(GEN[b.type].py(b, g.pyg)).split('\\n').map((l) => '// [파이썬] ' + l).join('\\n');
        // 반환문이면 자료형에 맞는 기본값을 돌려줘서 부르는 쪽 코드가 계속 맞게
        if (b.type === 'mb_fn_return') code += '\\nreturn ' + TS_DEFAULT(g.types.T(b.getInputTargetBlock('VALUE')));
        g.raw++; commented = true;""")
io.open(p, 'w', encoding='utf8', newline='\n').write(s)
print('ok')
