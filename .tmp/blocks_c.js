
  /* ── 변환기: 파이썬 코드 → 블록 ──
   * Pyodide 의 ast 로 구문 트리(JSON)를 받아 MakeCode 블록 JSON 으로 바꾼다.
   * - 맨 바깥 while True: → '무한반복 실행', 그 안의 'if 버튼.was_pressed():' → '버튼 누르면 실행' 이벤트 (MakeCode 방식)
   * - 함수는 함수 블록으로, 함수 안에서만 쓰는 변수가 바깥 변수와 이름이 겹치면 '이름_함수' 로 바꾼다 (블록의 변수는 모두 전역이라서)
   * - 바꿀 수 없는 문장 · 식은 회색 '파이썬' 블록 (실행은 되고, MakeCode 로 보낼 때는 주석)
   */
  const AST_PY = String.raw`
import ast, json, tokenize, io

def _j(n):
    if isinstance(n, ast.AST):
        d = {'_': type(n).__name__}
        for k, v in ast.iter_fields(n):
            if k in ('ctx', 'type_comment', 'kind', 'type_params'):
                continue
            d[k] = _j(v)
        if isinstance(n, (ast.stmt, ast.expr)):
            d['ln'] = n.lineno
            d['eln'] = n.end_lineno
            if isinstance(n, ast.expr):
                try:
                    d['py'] = ast.unparse(n)
                except Exception:
                    d['py'] = ''
        return d
    if isinstance(n, list):
        return [_j(x) for x in n]
    if n is None or isinstance(n, (bool, int, float, str)):
        return n
    return repr(n)

def to_json(src):
    try:
        tree = ast.parse(src)
    except SyntaxError as e:
        return json.dumps({'error': '%s (%s번째 줄)' % (e.msg, e.lineno)}, ensure_ascii=False)
    comments = []
    try:
        for t in tokenize.generate_tokens(io.StringIO(src).readline):
            if t.type == tokenize.COMMENT:
                comments.append([t.start[0], t.string[1:].strip(), t.line[:t.start[1]].strip() != ''])
    except Exception:
        pass
    return json.dumps({'body': _j(tree.body), 'comments': comments}, ensure_ascii=False)
`;
  let astFn = null;
  async function pyAst(src) {
    if (!astFn) {
      const py = await MbEngine.load();
      const ns = py.globals.get('dict')();
      py.runPython(AST_PY, { globals: ns });
      astFn = ns.get('to_json');
    }
    return JSON.parse(astFn(src));
  }

  // MakeCode 에 sum · min(목록) · max(목록) 블록이 없어서 준비된 함수로 붙인다
  const LIST_HELPERS = {
    sum: ['sum_list', 'def sum_list(values):\n    # 준비된 함수: 목록의 값을 모두 더하기\n    sum_total = 0\n    for sum_item in values:\n        sum_total += sum_item\n    return sum_total'],
    min: ['min_list', 'def min_list(values):\n    # 준비된 함수: 목록에서 가장 작은 값\n    min_best = values[0]\n    for min_item in values:\n        if min_item < min_best:\n            min_best = min_item\n    return min_best'],
    max: ['max_list', 'def max_list(values):\n    # 준비된 함수: 목록에서 가장 큰 값\n    max_best = values[0]\n    for max_item in values:\n        if max_item > max_best:\n            max_best = max_item\n    return max_best']
  };

  function walk(n, fn, skipDefs) {
    if (Array.isArray(n)) { n.forEach((x) => walk(x, fn, skipDefs)); return; }
    if (!n || typeof n !== 'object' || !n._) return;
    if (fn(n) === false) return;
    for (const k in n) { if (k === '_' || k === 'py') continue; const v = n[k]; if (v && typeof v === 'object') { if (skipDefs && v._ === 'FunctionDef') continue; walk(v, fn, skipDefs); } }
  }
  const dotted = (f) => (f && f._ === 'Name' ? f.id : f && f._ === 'Attribute' && dotted(f.value) ? dotted(f.value) + '.' + f.attr : null);
  const isConst = (n, t) => n && n._ === 'Constant' && (t ? typeof n.value === t : true);
  const numVal = (n) => (isConst(n, 'number') ? n.value : n && n._ === 'UnaryOp' && n.op._ === 'USub' && isConst(n.operand, 'number') ? -n.operand.value : null);
  const targetNames = (t, out) => { if (!t) return out; if (t._ === 'Name') out.push(t.id); else if (t._ === 'Tuple' || t._ === 'List') t.elts.forEach((e) => targetNames(e, out)); return out; };

  async function convertPython(src) {
    src = String(src).replace(/\t/g, '    ').replace(/\r\n?/g, '\n');
    let tree = await pyAst(src);
    if (tree.error) return { error: tree.error };
    // sum(목록) · min(목록) · max(목록) 을 쓰면 준비된 함수를 뒤에 붙여 다시 읽는다
    const need = new Set();
    walk(tree.body, (n) => { if (n._ === 'Call' && n.func._ === 'Name' && LIST_HELPERS[n.func.id] && n.args.length === 1 && !n.keywords.length) need.add(n.func.id); });
    const defined = new Set(tree.body.filter((n) => n._ === 'FunctionDef').map((n) => n.name));
    const add = [...need].filter((k) => !defined.has(LIST_HELPERS[k][0]));
    if (add.length) { tree = await pyAst(src + '\n\n' + add.map((k) => LIST_HELPERS[k][1]).join('\n\n') + '\n'); if (tree.error) return { error: tree.error }; }
    return buildBlocks(tree, src);
  }

  function buildBlocks(tree, src) {
    const lines = src.split('\n');
    const notes = new Set();
    let uid = 0, raw = 0, count = 0;
    const vars = new Map();
    const vid = (n) => { if (!vars.has(n)) vars.set(n, 'v_' + vars.size + '_' + n.replace(/\W/g, '')); return vars.get(n); };
    const B = (type, fields, inputs, extra) => {
      count++;
      const o = { type, id: 'k' + (++uid) };
      if (fields) o.fields = fields;
      if (inputs) { o.inputs = {}; for (const k in inputs) if (inputs[k]) o.inputs[k] = { block: inputs[k] }; }
      if (extra) o.extraState = extra;
      return o;
    };
    const chain = (arr) => { arr = arr.filter(Boolean); for (let i = 0; i < arr.length - 1; i++) { let last = arr[i]; while (last.next) last = last.next.block; last.next = { block: arr[i + 1] }; } return arr[0] || null; };
    const VAR = (n) => ({ VAR: { id: vid(n) } });
    const num = (v) => B('math_number', { NUM: v });
    const txt = (s) => B('text', { TEXT: s });
    const getv = (n) => B('variables_get', VAR(n));
    const setv = (n, v) => B('variables_set', VAR(n), { VALUE: v });
    const arith = (op, a, b) => B('math_arithmetic', { OP: op }, { A: a, B: b });
    const fn1 = (op, x) => B('mb_math_fn1', { OP: op }, { X: x });
    const fn2 = (op, a, b) => B('mb_math_fn2', { OP: op }, { A: a, B: b });
    const listOf = (items) => { const inputs = {}; items.forEach((it, i) => { inputs['ADD' + i] = it; }); return B('lists_create_with', null, inputs, { itemCount: items.length }); };
    const joinOf = (items) => { const inputs = {}; items.forEach((it, i) => { inputs['ADD' + i] = it; }); return B('text_join', null, inputs, { itemCount: items.length }); };
    const rawExpr = (n) => { raw++; return B('py_raw_expr', null, null, { code: n.py || '' }); };
    const dedent = (ls) => { const ind = Math.min(...ls.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length)); return ls.map((l) => l.slice(ind)).join('\n').replace(/\s+$/, ''); };
    const rawStmt = (n) => { raw++; return B('py_raw', null, null, { code: dedent(lines.slice(n.ln - 1, n.eln)) }); };

    // 주석: 문장의 첫 줄과 그 앞에 있는 # 주석을 블록 메모로
    const comments = (tree.comments || []).slice();
    let ci = 0;
    const takeComments = (upto) => { const t = []; while (ci < comments.length && comments[ci][0] <= upto) t.push(comments[ci++][1]); return t; };
    const dropComments = (upto) => { while (ci < comments.length && comments[ci][0] <= upto) ci++; };
    const attach = (blk, texts) => { if (blk && texts.length) { const t = texts.filter(Boolean).join('\n'); if (t) blk.icons = { comment: { text: (blk.icons ? blk.icons.comment.text + '\n' : '') + t, pinned: false, height: 60, width: 260 } }; } };

    /* 함수 정보 · 이름 겹침 정리 */
    const body = tree.body;
    const fdefs = body.filter((n) => n._ === 'FunctionDef');
    const FN = {};
    const globalNames = new Set();
    body.forEach((n) => {
      if (n._ === 'FunctionDef') return;
      walk(n, (m) => {
        if (m._ === 'Assign') m.targets.forEach((t) => targetNames(t, []).forEach((x) => globalNames.add(x)));
        else if (m._ === 'AugAssign' || m._ === 'For') targetNames(m.target, []).forEach((x) => globalNames.add(x));
      }, true);
    });
    fdefs.forEach((f) => {
      const params = f.args.args.map((a) => a.arg);
      const defaults = f.args.defaults || [];
      const glob = new Set(), loc = new Set();
      walk(f.body, (m) => {
        if (m._ === 'Global') m.names.forEach((x) => { glob.add(x); globalNames.add(x); });
        else if (m._ === 'Assign') m.targets.forEach((t) => targetNames(t, []).forEach((x) => loc.add(x)));
        else if (m._ === 'AugAssign' || m._ === 'For') targetNames(m.target, []).forEach((x) => loc.add(x));
      }, true);
      FN[f.name] = { params, defaults: params.map((_, i) => defaults[i - (params.length - defaults.length)] || null), glob, loc };
    });
    fdefs.forEach((f) => {
      const info = FN[f.name], ren = {};
      info.loc.forEach((x) => { if (!info.glob.has(x) && !info.params.includes(x) && globalNames.has(x)) ren[x] = x + '_' + f.name; });
      if (Object.keys(ren).length) {
        walk(f.body, (m) => { if (m._ === 'Name' && ren[m.id]) m.id = ren[m.id]; }, true);
        notes.add(`함수 ${f.name}() 안의 변수 ${Object.keys(ren).join(', ')} 는 바깥 변수와 이름이 겹쳐 ${Object.values(ren).join(', ')} (으)로 바꿨습니다 (블록의 변수는 모두 전역).`);
      }
    });

    /* 자료형 짐작: num · str · bool · img · list<…> · dict · any */
    const VT = new Map(), FT = new Map(), PT = new Map();
    let curFn = null;
    const elemOf = (t) => (t && t.startsWith('list<') ? t.slice(5, -1) : 'any');
    function typeOf(n) {
      if (!n) return 'any';
      switch (n._) {
        case 'Constant': return typeof n.value === 'string' ? 'str' : typeof n.value === 'boolean' ? 'bool' : typeof n.value === 'number' ? 'num' : 'any';
        case 'Name': {
          if (curFn && FN[curFn] && FN[curFn].params.includes(n.id)) return PT.get(curFn + '.' + n.id) || 'any';
          return VT.get(n.id) || 'any';
        }
        case 'BinOp': {
          const a = typeOf(n.left), b = typeOf(n.right);
          if (n.op._ === 'Add' && (a === 'str' || b === 'str')) return 'str';
          if (n.op._ === 'Mod' && a === 'str') return 'str';
          if (a.startsWith('list') || (n.op._ === 'Mult' && b.startsWith('list'))) return a.startsWith('list') ? a : b;
          return 'num';
        }
        case 'UnaryOp': return n.op._ === 'Not' ? 'bool' : 'num';
        case 'BoolOp': case 'Compare': return 'bool';
        case 'IfExp': return typeOf(n.body);
        case 'List': case 'Tuple': return 'list<' + (n.elts.length ? typeOf(n.elts[0]) : 'any') + '>';
        case 'Dict': return 'dict<' + (n.values.length ? typeOf(n.values[0]) : 'any') + '>';
        case 'ListComp': return 'list<any>';
        case 'JoinedStr': return 'str';
        case 'Attribute': return dotted(n.value) === 'Image' ? 'img' : 'num';
        case 'Subscript': {
          const t = typeOf(n.value);
          if (n.slice && n.slice._ === 'Slice') return t;
          if (t === 'str') return 'str';
          if (t.startsWith('dict<')) return t.slice(5, -1);
          return elemOf(t);
        }
        case 'Call': {
          const f = dotted(n.func);
          if (f && FN[f]) return FT.get(f) || 'any';
          if (['str', 'chr'].includes(f) || /\.(join|format|upper|lower|strip|replace)$/.test(f || '')) return 'str';
          if (f === 'Image' || (f && f.startsWith('Image.'))) return 'img';
          if (/\.(is_pressed|was_pressed|is_touched|was_gesture|is_gesture)$/.test(f || '')) return 'bool';
          if (f === 'accelerometer.get_values') return 'list<num>';
          if (f === 'list') return typeOf(n.args[0]);
          if (/\.split$/.test(f || '')) return 'list<str>';
          if (n.func._ === 'Attribute' && n.func.attr === 'pop') return elemOf(typeOf(n.func.value));
          if (n.func._ === 'Attribute' && n.func.attr === 'get') return typeOf(n.func.value).startsWith('dict<') ? typeOf(n.func.value).slice(5, -1) : 'any';
          return 'num';
        }
        default: return 'any';
      }
    }
    const setT = (name, t) => { if (t && t !== 'any' && t !== 'list<any>' && (!VT.has(name) || VT.get(name) === 'list<any>')) VT.set(name, t); else if (t === 'list<any>' && !VT.has(name)) VT.set(name, t); };
    function inferStmt(n) {
      walk(n, (m) => {
        if (m._ === 'FunctionDef') return false;
        if (m._ === 'Assign') {
          m.targets.forEach((t) => {
            if (t._ === 'Name') setT(t.id, typeOf(m.value));
            else if (t._ === 'Tuple' || t._ === 'List') {
              t.elts.forEach((e, i) => { if (e._ !== 'Name') return; const v = m.value; setT(e.id, v._ === 'Tuple' || v._ === 'List' ? typeOf(v.elts[i]) : elemOf(typeOf(v)) === 'any' && dotted(v.func) === 'accelerometer.get_values' ? 'num' : elemOf(typeOf(v))); });
            }
          });
        } else if (m._ === 'AugAssign' && m.target._ === 'Name') setT(m.target.id, typeOf(m.value));
        else if (m._ === 'For') {
          const it = m.iter, f = it._ === 'Call' ? dotted(it.func) : null;
          const et = f === 'range' ? 'num' : elemOf(typeOf(it));
          if (m.target._ === 'Name') setT(m.target.id, et);
          else if (m.target._ === 'Tuple') m.target.elts.forEach((e) => { if (e._ === 'Name') setT(e.id, elemOf(et)); });
        } else if (m._ === 'Call') {
          const f = dotted(m.func);
          if (m.func._ === 'Attribute' && m.func.attr === 'append' && m.func.value._ === 'Name' && (VT.get(m.func.value.id) || 'list<any>') === 'list<any>') VT.set(m.func.value.id, 'list<' + typeOf(m.args[0]) + '>');
          if (f && FN[f]) FN[f].params.forEach((p, i) => { const a = m.args[i]; if (a && !PT.has(f + '.' + p)) { const t = typeOf(a); if (t !== 'any') PT.set(f + '.' + p, t); } });
        } else if (m._ === 'Return' && curFn && m.value && !FT.has(curFn)) {
          const t = typeOf(m.value); if (t !== 'any' && t !== 'list<any>') FT.set(curFn, t);
        }
      });
    }
    for (let pass = 0; pass < 3; pass++) {
      body.forEach((n) => {
        if (n._ === 'FunctionDef') { curFn = n.name; n.body.forEach(inferStmt); curFn = null; } else inferStmt(n);
      });
    }

    /* 식 */
    const ctx = { fn: null };
    const T = (n) => { const s = curFn; curFn = ctx.fn; const t = typeOf(n); curFn = s; return t; };
    function idx(listNode, i) {
      const k = numVal(i);
      if (k != null && k < 0) return arith('MINUS', T(listNode) === 'str' ? B('mb_text_length', null, { TEXT: ex(listNode) }) : B('mb_list_length', null, { LIST: ex(listNode) }), num(-k));
      return ex(i);
    }
    function ex(n) {
      const r = ex0(n);
      return r || rawExpr(n);
    }
    function ex0(n) {
      switch (n._) {
        case 'Constant':
          if (typeof n.value === 'boolean') return B('logic_boolean', { BOOL: n.value ? 'TRUE' : 'FALSE' });
          if (typeof n.value === 'number') return num(n.value);
          if (typeof n.value === 'string') return txt(n.value);
          return null;
        case 'Name':
          if (FN[n.id]) return null;
          return getv(n.id);
        case 'UnaryOp':
          if (n.op._ === 'Not') return B('logic_negate', null, { BOOL: ex(n.operand) });
          if (n.op._ === 'USub') return numVal(n) != null ? num(numVal(n)) : arith('MINUS', num(0), ex(n.operand));
          if (n.op._ === 'UAdd') return ex(n.operand);
          return null;
        case 'BinOp': {
          const op = n.op._, lt = T(n.left), rt = T(n.right);
          if (op === 'Add' && (lt === 'str' || rt === 'str')) {
            const items = [];
            const flat = (m) => { if (m._ === 'BinOp' && m.op._ === 'Add' && (T(m.left) === 'str' || T(m.right) === 'str')) { flat(m.left); flat(m.right); } else items.push(m._ === 'Call' && dotted(m.func) === 'str' && m.args.length === 1 ? ex(m.args[0]) : ex(m)); };
            flat(n);
            return joinOf(items);
          }
          if (lt.startsWith('list') || rt.startsWith('list') || lt === 'str' || rt === 'str') return null;
          const M = { Add: 'ADD', Sub: 'MINUS', Mult: 'MULTIPLY', Div: 'DIVIDE', Pow: 'POWER' };
          if (M[op]) return arith(M[op], ex(n.left), ex(n.right));
          if (op === 'Mod') return B('math_modulo', null, { DIVIDEND: ex(n.left), DIVISOR: ex(n.right) });
          if (op === 'FloorDiv') return fn2('idiv', ex(n.left), ex(n.right));
          return null;
        }
        case 'BoolOp': {
          const op = n.op._ === 'And' ? 'AND' : 'OR';
          return n.values.slice(1).reduce((a, v) => B('logic_operation', { OP: op }, { A: a, B: ex(v) }), ex(n.values[0]));
        }
        case 'Compare': {
          const parts = [];
          let left = n.left;
          for (let i = 0; i < n.ops.length; i++) {
            const right = n.comparators[i], op = n.ops[i]._;
            const C2 = { Eq: 'EQ', NotEq: 'NEQ', Lt: 'LT', LtE: 'LTE', Gt: 'GT', GtE: 'GTE' };
            let p;
            if (C2[op]) p = B('logic_compare', { OP: C2[op] }, { A: ex(left), B: ex(right) });
            else if (op === 'In' || op === 'NotIn') {
              const rt = T(right);
              if (rt === 'str') p = B('mb_text_includes', null, { TEXT: ex(right), SUB: ex(left) });
              else if (rt.startsWith('list')) p = B('logic_compare', { OP: 'GTE' }, { A: B('mb_list_index_of', null, { LIST: ex(right), VALUE: ex(left) }), B: num(0) });
              else return null;
              if (op === 'NotIn') p = B('logic_negate', null, { BOOL: p });
            } else return null;
            parts.push(p);
            left = right;
          }
          return parts.slice(1).reduce((a, p) => B('logic_operation', { OP: 'AND' }, { A: a, B: p }), parts[0]);
        }
        case 'List': case 'Tuple':
          if (n.elts.some((e) => e._ === 'Starred')) return null;
          return listOf(n.elts.map(ex));
        case 'Subscript': {
          if (n.slice._ === 'Slice') return null;
          const t = T(n.value);
          if (t.startsWith('dict')) return null;
          if (t === 'str') return B('mb_text_char_at', null, { TEXT: ex(n.value), I: idx(n.value, n.slice) });
          return B('mb_list_get', null, { LIST: ex(n.value), I: idx(n.value, n.slice) });
        }
        case 'Attribute': {
          const d = dotted(n);
          if (d === 'math.pi') return B('mb_pi');
          if (d && d.startsWith('Image.')) {
            const k = d.slice(6);
            if (ICON_BY[k]) return B('mb_icon_image', { ICON: k });
            if (k.startsWith('ARROW_') && ARROW_BY[k.slice(6)]) return B('mb_arrow_image', { DIR: k.slice(6) });
          }
          return null;
        }
        case 'Call': return callExpr(n);
        default: return null;
      }
    }
    const kw = (n) => Object.fromEntries((n.keywords || []).map((k) => [k.arg, k.value]));
    function callExpr(n) {
      const f = dotted(n.func), a = n.args, k = kw(n);
      if (a.some((x) => x._ === 'Starred') || (n.keywords || []).some((x) => !x.arg)) return null;
      const simple = { running_time: 'mb_running_time', temperature: 'mb_temperature', 'display.read_light_level': 'mb_light', 'microphone.sound_level': 'mb_sound', 'compass.heading': 'mb_compass', 'compass.get_field_strength': 'mb_magnetic', 'pin_logo.is_touched': 'mb_logo_pressed' };
      if (simple[f] && !a.length) return B(simple[f]);
      let m;
      if ((m = /^button_([ab])\.(is_pressed|was_pressed)$/.exec(f || ''))) {
        if (m[2] === 'was_pressed') notes.add('was_pressed() 를 이벤트로 옮길 수 없는 곳은 \'버튼 누름 상태\' 블록으로 바꿨습니다 (누르고 있는 동안 참).');
        return B('mb_button_pressed', { BTN: m[1].toUpperCase() });
      }
      if ((m = /^accelerometer\.get_([xyz])$/.exec(f || ''))) return B('mb_accel', { AXIS: m[1] });
      if (f === 'accelerometer.get_strength') return B('mb_accel', { AXIS: 'strength' });
      if (f === 'accelerometer.get_values') return listOf(['x', 'y', 'z'].map((x) => B('mb_accel', { AXIS: x })));
      if (/^accelerometer\.(was|is)_gesture$/.test(f || '') && isConst(a[0], 'string') && GESTURE_BY[a[0].value]) return B('mb_is_gesture', { G: a[0].value });
      if (f === 'display.get_pixel' && a.length === 2) return fn2('idiv', B('mb_point', null, { X: ex(a[0]), Y: ex(a[1]) }), num(28));
      if (f === 'random.randint' && a.length === 2) return B('mb_random', null, { A: ex(a[0]), B: ex(a[1]) });
      if ((m = /^math\.(sqrt|sin|cos|tan|floor|ceil|fabs)$/.exec(f || '')) && a.length === 1) return fn1(m[1] === 'fabs' ? 'abs' : m[1], ex(a[0]));
      if (f === 'math.atan2' && a.length === 2) return fn2('atan2', ex(a[0]), ex(a[1]));
      if (f === 'math.radians' && a.length === 1) return arith('DIVIDE', arith('MULTIPLY', ex(a[0]), B('mb_pi')), num(180));
      if (f === 'math.degrees' && a.length === 1) return arith('DIVIDE', arith('MULTIPLY', ex(a[0]), num(180)), B('mb_pi'));
      if (f === 'abs' && a.length === 1) return fn1('abs', ex(a[0]));
      if (f === 'round' && a.length === 1) return fn1('round', ex(a[0]));
      if (f === 'round' && a.length === 2 && numVal(a[1]) != null) { const p = Math.pow(10, numVal(a[1])); return arith('DIVIDE', fn1('round', arith('MULTIPLY', ex(a[0]), num(p))), num(p)); }
      if (f === 'int' && a.length === 1) return T(a[0]) === 'str' ? fn1('trunc', B('mb_parse_number', null, { TEXT: ex(a[0]) })) : fn1('trunc', ex(a[0]));
      if (f === 'float' && a.length === 1) return T(a[0]) === 'str' ? B('mb_parse_number', null, { TEXT: ex(a[0]) }) : ex(a[0]);
      if (f === 'str' && a.length === 1) return T(a[0]) === 'str' ? ex(a[0]) : B('mb_to_text', null, { X: ex(a[0]) });
      if (f === 'len' && a.length === 1) return T(a[0]) === 'str' ? B('mb_text_length', null, { TEXT: ex(a[0]) }) : T(a[0]).startsWith('dict') ? null : B('mb_list_length', null, { LIST: ex(a[0]) });
      if ((f === 'min' || f === 'max') && a.length >= 2) return a.slice(1).reduce((acc, x) => fn2(f, acc, ex(x)), ex(a[0]));
      if (LIST_HELPERS[f] && a.length === 1 && !Object.keys(k).length) return fnCall(LIST_HELPERS[f][0], a, {}, true);
      if (f === 'Image' && a.length === 1 && isConst(a[0], 'string')) return imageBlock('mb_create_image', a[0].value);
      if (n.func._ === 'Attribute') {
        const obj = n.func.value, at = n.func.attr, ot = T(obj);
        if (ot.startsWith('list')) {
          if (at === 'pop' && !a.length) return B('mb_list_pop', null, { LIST: ex(obj) });
          if (at === 'pop' && numVal(a[0]) === 0) return B('mb_list_shift', null, { LIST: ex(obj) });
          if (at === 'index' && a.length === 1) return B('mb_list_index_of', null, { LIST: ex(obj), VALUE: ex(a[0]) });
        }
        if (ot === 'str' && at === 'find' && a.length === 1) return B('mb_text_index_of', null, { TEXT: ex(obj), SUB: ex(a[0]) });
      }
      if (f && FN[f]) return fnCall(f, a, k, true);
      return null;
    }
    function fnCall(f, a, k, expr) {
      const info = FN[f] || { params: ['values'], defaults: [null] };
      const inputs = {};
      for (let i = 0; i < info.params.length; i++) {
        const p = info.params[i];
        const v = a[i] || k[p] || info.defaults[i];
        if (v) inputs['ARG' + i] = ex(v);
      }
      return B(expr ? 'mb_fn_call_expr' : 'mb_fn_call', null, inputs, { name: f, params: info.params });
    }
    function imageBlock(type, s) {
      const rows = String(s).split(':').map((r) => r.trim());
      if (rows.length !== 5 || rows.some((r) => !/^[0-9]{5}$/.test(r))) return null;
      const fields = {};
      rows.forEach((r, i) => r.split('').forEach((c, j) => { fields['L' + (i * 5 + j)] = c !== '0'; }));
      if (rows.join('').split('').some((c) => c !== '0' && c !== '9')) notes.add('LED 밝기(1~8)는 MakeCode 의 \'LED 출력\' 에서 켜짐으로 바뀝니다.');
      return B(type, fields);
    }

    /* 문장 */
    function showBlock(x, scroll) {
      const d = x._ === 'Attribute' ? dotted(x) : null;
      if (d && d.startsWith('Image.') && !scroll) {
        const k = d.slice(6);
        if (ICON_BY[k]) return B('mb_show_icon', { ICON: k });
        if (k.startsWith('ARROW_') && ARROW_BY[k.slice(6)]) return B('mb_show_arrow', { DIR: k.slice(6) });
        return null;
      }
      if (x._ === 'Call' && dotted(x.func) === 'Image' && x.args.length === 1 && isConst(x.args[0], 'string')) return imageBlock('mb_show_leds', x.args[0].value);
      const t = T(x);
      if (t === 'img') return B('mb_show_image', null, { IMG: ex(x) });
      if (t === 'str') return B('mb_show_string', null, { TEXT: ex(x) });
      if (t === 'num' || t === 'any' || t === 'bool') return B('mb_show_number', null, { NUM: ex(x) });
      return null;
    }
    function callStmt(n) {
      const f = dotted(n.func), a = n.args, k = kw(n);
      if (a.some((x) => x._ === 'Starred') || (n.keywords || []).some((x) => !x.arg)) return null;
      if (f === 'display.show' && a.length === 1) return showBlock(a[0], false);
      if (f === 'display.scroll' && a.length === 1) return showBlock(a[0], true);
      if (f === 'display.clear' && !a.length) return B('mb_clear');
      if (f === 'display.set_pixel' && a.length === 3) {
        const v = numVal(a[2]);
        if (v === 9) return B('mb_plot', null, { X: ex(a[0]), Y: ex(a[1]) });
        if (v === 0) return B('mb_unplot', null, { X: ex(a[0]), Y: ex(a[1]) });
        return B('mb_plot_brightness', null, { X: ex(a[0]), Y: ex(a[1]), B: v != null ? num(Math.round(v * 255 / 9)) : arith('MULTIPLY', ex(a[2]), num(28)) });
      }
      if (f === 'sleep' && a.length === 1) return B('mb_pause', null, { MS: ex(a[0]) });
      if (f === 'compass.calibrate' && !a.length) return B('mb_calibrate');
      if (f === 'music.pitch' && (a.length >= 2 || k.duration)) {
        const bg = k.wait && k.wait._ === 'Constant' && k.wait.value === false;
        return B('mb_play_tone', { MODE: bg ? 'bg' : 'wait' }, { FREQ: ex(a[0]), MS: ex(a[1] || k.duration) });
      }
      if (f === 'music.play' && a[0] && a[0]._ === 'List' && a[0].elts.every((e) => isConst(e, 'string'))) {
        const bg = k.wait && k.wait._ === 'Constant' && k.wait.value === false;
        if (a[0].elts.some((e) => e.value.includes(':'))) notes.add('멜로디의 음 길이(:2 등)는 MakeCode 멜로디 블록에서 한 박자로 맞춰집니다.');
        return B('mb_play_melody', { MELODY: a[0].elts.map((e) => e.value.split(':')[0]).join(' '), MODE: bg ? 'bg' : 'wait' }, { BPM: num(120) });
      }
      if (f === 'log.set_labels' && a.length && a.every((x) => isConst(x, 'string'))) {
        const t = k.timestamp, d = t ? dotted(t) : 'log.SECONDS';
        const ts = t && t._ === 'Constant' && t.value === null ? 'none' : { 'log.SECONDS': 's', 'log.MILLISECONDS': 'ms', 'log.MINUTES': 'min' }[d];
        if (!ts) return null;
        return B('dl_set_columns', { COLS: a.map((x) => x.value).join(','), TS: ts });
      }
      if (f === 'log.add' && !a.length && n.keywords.length) {
        const fields = {}, inputs = {};
        n.keywords.forEach((x, i) => { fields['COL' + i] = x.arg; inputs['VAL' + i] = ex(x.value); });
        return B('dl_log', fields, inputs, { n: n.keywords.length });
      }
      if (f === 'log.delete') return B('dl_delete');
      if (f === 'print') {
        if (Object.keys(k).some((x) => x !== 'sep')) return null;
        const sep = k.sep ? (isConst(k.sep, 'string') ? k.sep.value : null) : ' ';
        if (sep == null) return null;
        if (!a.length) return B('mb_serial_line', null, { TEXT: txt('') });
        if (a.length === 1) return B('mb_serial_line', null, { TEXT: T(a[0]) === 'str' ? ex(a[0]) : B('mb_to_text', null, { X: ex(a[0]) }) });
        const items = [];
        a.forEach((x, i) => { if (i && sep) items.push(txt(sep)); items.push(ex(x)); });
        // 이웃한 글자 조각은 하나로 합친다 ("x" + " " → "x ")
        const merged = [];
        items.forEach((it) => { const last = merged[merged.length - 1]; if (last && last.type === 'text' && it.type === 'text') last.fields.TEXT += it.fields.TEXT; else merged.push(it); });
        return B('mb_serial_line', null, { TEXT: merged.length === 1 ? merged[0] : joinOf(merged) });
      }
      if (n.func._ === 'Attribute') {
        const obj = n.func.value, at = n.func.attr, ot = T(obj);
        if (ot.startsWith('list') || (obj._ === 'Name' && !VT.has(obj.id))) {
          if (at === 'append' && a.length === 1) return B('mb_list_push', null, { LIST: ex(obj), VALUE: ex(a[0]) });
          if (at === 'pop' && !a.length) return B('mb_list_remove_last', null, { LIST: ex(obj) });
          if (at === 'pop' && numVal(a[0]) === 0) return B('mb_list_remove_first', null, { LIST: ex(obj) });
          if (at === 'pop' && a.length === 1) return B('mb_list_remove_at', null, { LIST: ex(obj), I: ex(a[0]) });
          if (at === 'insert' && a.length === 2) return B('mb_list_insert', null, { LIST: ex(obj), I: ex(a[0]), VALUE: ex(a[1]) });
        }
      }
      if (f && FN[f]) return fnCall(f, a, k, false);
      return null;
    }
    // 여러 값을 한 번에 넣기 (x, y = …)
    function unpack(names, value) {
      if (value._ === 'Call' && dotted(value.func) === 'accelerometer.get_values' && names.length === 3) return names.map((nm, i) => setv(nm, B('mb_accel', { AXIS: 'xyz'[i] })));
      if ((value._ === 'Tuple' || value._ === 'List') && value.elts.length === names.length) {
        // 오른쪽에서 왼쪽 변수를 읽지 않으면 차례로 넣어도 같다 (a, b = b, a 처럼 겹치면 임시 목록을 거친다)
        const rhs = new Set(); walk(value, (m) => { if (m._ === 'Name') rhs.add(m.id); });
        if (!names.some((nm) => rhs.has(nm))) return names.map((nm, i) => setv(nm, ex(value.elts[i])));
      }
      const tmp = 'tmp_list';
      VT.set(tmp, 'list<num>');
      return [setv(tmp, ex(value)), ...names.map((nm, i) => setv(nm, B('mb_list_get', null, { LIST: getv(tmp), I: num(i) })))];
    }
    function stmts(list) {
      const out = [];
      list.forEach((n) => { const bs = stmt(n); if (bs && bs.length) out.push(...bs); });
      return chain(out);
    }
    function stmt(n) {
      const cm = takeComments(n.ln);
      let r;
      try { r = stmt0(n); } catch (e) { r = null; }
      if (r === undefined) { if (cm.length) pendingCm.push(...cm); return []; }
      if (!r) { dropComments(n.eln); r = [rawStmt(n)]; }
      attach(r[0], pendingCm.splice(0).concat(cm));
      return r;
    }
    const pendingCm = [];
    function stmt0(n) {
      switch (n._) {
        case 'Expr':
          if (isConst(n.value, 'string')) return undefined;
          if (n.value._ === 'Call') { const b = callStmt(n.value); return b ? [b] : null; }
          return null;
        case 'Pass': case 'Global': case 'Import': case 'ImportFrom': return undefined;
        case 'Assign': {
          const v = n.value, out = [];
          for (const t of n.targets) {
            if (t._ === 'Name') out.push(setv(t.id, ex(v)));
            else if (t._ === 'Subscript' && t.slice._ !== 'Slice' && T(t.value).startsWith('list')) out.push(B('mb_list_set', null, { LIST: ex(t.value), I: idx(t.value, t.slice), VALUE: ex(v) }));
            else if ((t._ === 'Tuple' || t._ === 'List') && t.elts.every((e) => e._ === 'Name')) out.push(...unpack(t.elts.map((e) => e.id), v));
            else return null;
          }
          return out;
        }
        case 'AugAssign': {
          const t = n.target, op = n.op._;
          const M = { Add: 'ADD', Sub: 'MINUS', Mult: 'MULTIPLY', Div: 'DIVIDE', Pow: 'POWER' };
          if (t._ === 'Name') {
            if (T(t) !== 'str' && (op === 'Add' || op === 'Sub')) {
              const d = op === 'Add' ? ex(n.value) : numVal(n.value) != null ? num(-numVal(n.value)) : arith('MINUS', num(0), ex(n.value));
              return [B('math_change', VAR(t.id), { DELTA: d })];
            }
            const cur = getv(t.id), rhs = ex(n.value);
            if (op === 'Add' && T(t) === 'str') return [setv(t.id, joinOf([cur, rhs]))];
            if (M[op]) return [setv(t.id, arith(M[op], cur, rhs))];
            if (op === 'Mod') return [setv(t.id, B('math_modulo', null, { DIVIDEND: cur, DIVISOR: rhs }))];
            if (op === 'FloorDiv') return [setv(t.id, fn2('idiv', cur, rhs))];
            return null;
          }
          if (t._ === 'Subscript' && T(t.value).startsWith('list') && M[op]) {
            const get = B('mb_list_get', null, { LIST: ex(t.value), I: idx(t.value, t.slice) });
            return [B('mb_list_set', null, { LIST: ex(t.value), I: idx(t.value, t.slice), VALUE: arith(M[op], get, ex(n.value)) })];
          }
          return null;
        }
        case 'If': {
          const inputs = {};
          let i = 0, cur = n;
          for (;;) {
            inputs['IF' + i] = ex(cur.test);
            inputs['DO' + i] = stmts(cur.body);
            i++;
            if (cur.orelse.length === 1 && cur.orelse[0]._ === 'If') { cur = cur.orelse[0]; pendingCm.push(...takeComments(cur.ln)); continue; }
            break;
          }
          const hasElse = cur.orelse.length > 0;
          if (hasElse) inputs.ELSE = stmts(cur.orelse);
          const ext = {};
          if (i > 1) ext.elseIfCount = i - 1;
          if (hasElse) ext.hasElse = true;
          return [B('controls_if', null, inputs, Object.keys(ext).length ? ext : null)];
        }
        case 'While':
          if (n.orelse.length) return null;
          return [B('controls_whileUntil', { MODE: 'WHILE' }, { BOOL: ex(n.test), DO: stmts(n.body) })];
        case 'For': {
          if (n.orelse.length) return null;
          const it = n.iter, f = it._ === 'Call' ? dotted(it.func) : null;
          if (f === 'range' && n.target._ === 'Name' && it.args.length >= 1 && it.args.length <= 3) {
            const [start, stop, step] = it.args.length === 1 ? [null, it.args[0], null] : it.args;
            const v = n.target.id;
            if ((!start || numVal(start) === 0) && !step) {
              const sv = numVal(stop);
              const to = sv != null ? num(sv - 1) : arith('MINUS', ex(stop), num(1));
              return [B('mb_for_index', VAR(v), { TO: to, DO: stmts(n.body) })];
            }
            let cont = false; walk(n.body, (m) => { if (m._ === 'Continue') cont = true; if (m._ === 'For' || m._ === 'While') return false; });
            if (cont) return null;
            const stp = step ? numVal(step) : 1;
            if (stp == null || stp === 0) return null;
            const loopBody = stmts(n.body);
            const inc = B('math_change', VAR(v), { DELTA: num(stp) });
            return [setv(v, start ? ex(start) : num(0)), B('controls_whileUntil', { MODE: 'WHILE' }, { BOOL: B('logic_compare', { OP: stp > 0 ? 'LT' : 'GT' }, { A: getv(v), B: ex(stop) }), DO: chain([loopBody, inc]) })];
          }
          if (T(it) === 'str' || T(it).startsWith('dict')) return null;
          if (n.target._ === 'Name') return [B('controls_forEach', VAR(n.target.id), { LIST: ex(it), DO: stmts(n.body) })];
          if (n.target._ === 'Tuple' && n.target.elts.every((e) => e._ === 'Name')) {
            const item = 'item';
            const sets = n.target.elts.map((e, i) => setv(e.id, B('mb_list_get', null, { LIST: getv(item), I: num(i) })));
            return [B('controls_forEach', VAR(item), { LIST: ex(it), DO: chain([...sets, stmts(n.body)]) })];
          }
          return null;
        }
        case 'Break': return [B('controls_flow_statements', { FLOW: 'BREAK' })];
        case 'Continue': return [B('controls_flow_statements', { FLOW: 'CONTINUE' })];
        case 'Return':
          if (!ctx.fn) return null;
          return [B('mb_fn_return', null, n.value && !(n.value._ === 'Constant' && n.value.value === null) ? { VALUE: ex(n.value) } : null)];
        default: return null;
      }
    }

    /* 맨 바깥: 함수 · 시작 · 무한반복 · 이벤트 */
    const tops = [], start = [], events = new Map();
    let forever = null;
    const loopIdx = (() => {
      for (let i = body.length - 1; i >= 0; i--) {
        const n = body[i];
        if (n._ === 'FunctionDef') continue;
        if (n._ === 'While' && n.test._ === 'Constant' && n.test.value === true && !n.orelse.length) {
          let flow = false;
          walk(n.body, (m) => { if (m._ === 'Break' || m._ === 'Continue') flow = true; if (m._ === 'For' || m._ === 'While') return false; }, true);
          return flow ? -1 : i;
        }
        return -1;
      }
      return -1;
    })();
    // if 버튼.was_pressed() [and 조건]: → 이벤트로 옮길 수 있으면 { key, block, extra }
    function eventOf(test) {
      const one = (t) => {
        const f = t._ === 'Call' && !t.args.length ? dotted(t.func) : null;
        let m;
        if (f && (m = /^button_([ab])\.was_pressed$/.exec(f))) return { key: 'btn:' + m[1].toUpperCase(), make: () => B('mb_on_button', { BTN: m[1].toUpperCase() }) };
        if (t._ === 'Call' && dotted(t.func) === 'accelerometer.was_gesture' && isConst(t.args[0], 'string') && GESTURE_BY[t.args[0].value]) { const g = t.args[0].value; return { key: 'g:' + g, make: () => B('mb_on_gesture', { G: g }) }; }
        return null;
      };
      const e = one(test);
      if (e) return Object.assign(e, { extra: null });
      if (test._ === 'BoolOp' && test.op._ === 'And') {
        const hits = test.values.map(one);
        if (hits.filter(Boolean).length !== 1) return null;
        const k = hits.findIndex(Boolean);
        const rest = test.values.filter((_, i) => i !== k);
        let walked = false; rest.forEach((r) => walk(r, (m) => { if (m._ === 'Call' && /was_pressed|was_gesture/.test(dotted(m.func) || '')) walked = true; }));
        if (walked) return null;
        return Object.assign(hits[k], { extra: rest.length === 1 ? rest[0] : { _: 'BoolOp', op: { _: 'And' }, values: rest, py: rest.map((r) => r.py).join(' and ') } });
      }
      return null;
    }
    body.forEach((n, i) => {
      if (n._ === 'FunctionDef') {
        const info = FN[n.name];
        ctx.fn = n.name;
        const cm = takeComments(n.ln);
        const first = n.body[0];
        if (first) cm.push(...takeComments(first.ln - 1));
        if (first && first._ === 'Expr' && isConst(first.value, 'string')) cm.push(first.value.value.trim());
        if (n.decorator_list.length || n.args.vararg || n.args.kwarg || n.args.kwonlyargs.length) { ctx.fn = null; dropComments(n.eln); tops.push(rawStmt(n)); return; }
        info.params.forEach(vid);
        const d = B('mb_fn_def', { NAME: n.name, PARAMS: info.params.join(', ') }, { DO: stmts(n.body) });
        attach(d, cm);
        if (info.defaults.some(Boolean)) notes.add(`함수 ${n.name}() 의 기본값 매개변수는 MakeCode 에 없어서, 부르는 곳마다 값을 채워 넣었습니다.`);
        tops.push(d);
        ctx.fn = null;
        return;
      }
      if (i !== loopIdx) { start.push(...stmt(n)); return; }
      // 맨 바깥 while True:
      const loopCm = takeComments(n.ln);
      const rest = [];
      n.body.forEach((s) => {
        let ev = s._ === 'If' ? eventOf(s.test) : null;
        // elif 사슬이 모두 버튼 · 제스처 조건이면 하나씩 이벤트로
        const chainIfs = [];
        if (ev) {
          let cur = s;
          for (;;) {
            const e = eventOf(cur.test);
            if (!e) { ev = null; break; }
            chainIfs.push([cur, e]);
            if (!cur.orelse.length) break;
            if (cur.orelse.length === 1 && cur.orelse[0]._ === 'If') { cur = cur.orelse[0]; continue; }
            ev = null; break;
          }
        }
        if (!ev) { rest.push(...stmt(s)); return; }
        chainIfs.forEach(([cur, e]) => {
          const cm = takeComments(cur.ln);
          let h = events.get(e.key);
          if (!h) { h = { block: e.make(), parts: [] }; events.set(e.key, h); attach(h.block, cm); } else attach(h.block, cm);
          const inner = stmts(cur.body);
          h.parts.push(e.extra ? B('controls_if', null, { IF0: ex(e.extra), DO0: inner }) : inner);
        });
      });
      // 잠깐 쉬기(sleep)만 남으면 무한반복은 만들지 않는다 (MakeCode 의 이벤트가 알아서 기다림)
      const onlySleep = (() => { let b = rest[0]; if (!b) return true; for (const x of rest) { let y = x; while (y) { if (y.type !== 'mb_pause') return false; y = y.next && y.next.block; } } return true; })();
      if (!onlySleep || !events.size) { forever = B('mb_forever', null, { DO: chain(rest) }); attach(forever, loopCm); }
      else if (events.size) attach([...events.values()][0].block, loopCm);
      if (events.size) notes.add('맨 바깥 반복의 버튼 · 제스처 조건은 MakeCode 처럼 \'… 누르면 실행\' 이벤트 블록으로 옮겼습니다.');
    });
    events.forEach((h) => { h.block.inputs = h.block.inputs || {}; const c = chain(h.parts); if (c) h.block.inputs.DO = { block: c }; });
    const all = [];
    if (start.length) all.push(B('mb_on_start', null, { DO: chain(start) }));
    all.push(...tops.filter((t) => t.type === 'mb_fn_def'));
    events.forEach((h) => all.push(h.block));
    if (forever) all.push(forever);
    tops.filter((t) => t.type !== 'mb_fn_def').forEach((t) => all.push(B('mb_on_start', null, { DO: t })));
    all.forEach((b, i) => { b.x = 20; b.y = 20 + i * 60; });
    const state = { blocks: { languageVersion: 0, blocks: all }, variables: [...vars].map(([name, id]) => ({ name, id })) };
    return { state, raw, count, notes: [...notes] };
  }
