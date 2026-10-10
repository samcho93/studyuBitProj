
  /* ── 생성기: 블록 → MicroPython (강좌 시뮬레이터 · 보드) / MakeCode JavaScript (main.ts) ── */
  const O = { ATOM: 0, MEMBER: 1, UNARY: 2, POW: 3, MUL: 4, ADD: 5, REL: 6, NOT: 7, AND: 8, OR: 9, NONE: 99 };
  const PY_RESERVED = new Set(('False None True and as assert async await break class continue def del elif else except finally for from global if import in is ' +
    'lambda nonlocal not or pass raise return try while with yield display button_a button_b accelerometer compass music math log random Image pin_logo ' +
    'microphone sleep running_time temperature print len str int float round abs min max range sum show_number show_string index_of').split(' '));
  const TS_RESERVED = new Set(('break case catch class const continue debugger default delete do else enum export extends false finally for function if import in ' +
    'instanceof new null return super switch this throw true try typeof var void while with yield let static implements interface package private protected public ' +
    'any number string boolean basic input music led images serial pins radio control game datalogger Math Image console randint').split(' '));
  const q = (s) => JSON.stringify(String(s));
  const leds = (b) => { const r = []; for (let i = 0; i < 5; i++) { let s = ''; for (let j = 0; j < 5; j++) s += b.getFieldValue('L' + (i * 5 + j)) === 'TRUE' ? '9' : '0'; r.push(s); } return r; };
  const tsLeds = (rows) => '`\n' + rows.map((r) => '        ' + r.split('').map((c) => (c === '0' ? '.' : '#')).join(' ')).join('\n') + '\n        `';
  const STMT_VARS = { variables_set: 1, math_change: 1 };
  const LOOP_VARS = { controls_forEach: 1, mb_for_index: 1 };
  const varOf = (b) => b.getField('VAR').getText();
  const topOf = (b) => { let t = b; while (t.getSurroundParent()) t = t.getSurroundParent(); return t; };

  // 블록마다 값의 자료형을 짐작한다 (MakeCode JavaScript 의 let 선언 · 함수 매개변수 형식에 씀)
  function typer(ws) {
    const vt = new Map(), ft = new Map(), pt = new Map();
    const all = ws.getAllBlocks(false);
    const elem = (t) => (t && t.endsWith('[]') ? t.slice(0, -2) : 'number');
    function T(b) {
      if (!b) return 'number';
      switch (b.type) {
        case 'text': case 'text_join': case 'mb_to_text': case 'mb_text_char_at': return 'string';
        case 'logic_compare': case 'logic_operation': case 'logic_negate': case 'logic_boolean': case 'mb_button_pressed': case 'mb_logo_pressed':
        case 'mb_is_gesture': case 'mb_text_includes': return 'boolean';
        case 'mb_create_image': case 'mb_icon_image': case 'mb_arrow_image': return 'Image';
        case 'lists_create_with': { const f = b.getInputTargetBlock('ADD0'); return f ? T(f) + '[]' : 'number[]'; }
        case 'mb_list_get': case 'mb_list_shift': case 'mb_list_pop': return elem(T(b.getInputTargetBlock('LIST')));
        case 'variables_get': {
          const n = varOf(b), top = topOf(b);
          if (top.type === 'mb_fn_def' && fnParams(top).includes(n)) return pt.get(top.getFieldValue('NAME') + '.' + n) || 'number';
          return vt.get(n) || 'number';
        }
        case 'mb_fn_call_expr': return ft.get(b.getFieldValue('NAME')) || 'number';
        default: return 'number';
      }
    }
    for (let pass = 0; pass < 3; pass++) {
      all.forEach((b) => {
        if (b.type === 'variables_set') {
          const n = varOf(b), v = b.getInputTargetBlock('VALUE');
          const empty = v && v.type === 'lists_create_with' && !v.getInputTargetBlock('ADD0');
          if (!vt.has(n) && !empty) vt.set(n, T(v));
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
    }
    // 빈 목록으로만 만든 변수는 수 목록으로 본다
    all.forEach((b) => { if (b.type === 'variables_set' && !vt.has(varOf(b))) vt.set(varOf(b), 'number[]'); });
    return { T, vt, ft, pt };
  }

  function makeGen(ws, lang) {
    const py = lang === 'py';
    const g = { py, ws, imports: new Set(), helpers: new Set(), pend: [], raw: 0, datalogger: false, depth: 0, names: new Map(), types: typer(ws) };
    const reserved = py ? PY_RESERVED : TS_RESERVED;
    g.name = (n) => {
      if (g.names.has(n)) return g.names.get(n);
      let o = String(n);
      if (py ? !/^[A-Za-z_]\w*$/.test(o) : !/^[\p{L}_$][\p{L}\p{N}_$]*$/u.test(o)) o = 'v' + (g.names.size + 1);
      const used = new Set(g.names.values());
      while (reserved.has(o) || used.has(o)) o += '_';
      g.names.set(n, o);
      return o;
    };
    g.vname = (b) => g.name(varOf(b));
    g.expr = (b) => { const f = GEN[b.type]; return f ? f[lang](b, g) : [py ? 'None' : 'null', O.ATOM]; };
    g.v = (b, input, order, dflt) => {
      const t = b.getInputTargetBlock(input);
      if (!t || !t.isEnabled()) return dflt != null ? dflt : '0';
      const [c, o] = g.expr(t);
      return o > order ? '(' + c + ')' : c;
    };
    g.one = (b) => {
      const f = GEN[b.type];
      const saved = g.pend; g.pend = [];
      const code = f ? f[lang](b, g) : '';
      const pre = [];
      const cm = b.getCommentText && b.getCommentText();
      if (cm) cm.split('\n').forEach((l) => pre.push((py ? '# ' : '// ') + l));
      pre.push(...g.pend);
      g.pend = saved;
      return { pre, code: typeof code === 'string' ? code : '' };
    };
    g.stack = (b) => {
      const out = [];
      for (; b; b = b.getNextBlock()) {
        if (!b.isEnabled()) continue;
        const r = g.one(b);
        out.push(...r.pre);
        if (r.code) out.push(...r.code.split('\n'));
      }
      return out;
    };
    g.body = (b, input) => {
      g.depth++;
      const lines = g.stack(b.getInputTargetBlock(input));
      g.depth--;
      if (py && !lines.some((l) => !/^\s*#/.test(l))) lines.push('pass');
      return lines.map((l) => '    ' + l).join('\n');
    };
    g.block = (head, b, input) => (py ? head + ':\n' + g.body(b, input) : head + ' {\n' + g.body(b, input) + '\n}');
    g.isText = (b, input) => g.types.T(b.getInputTargetBlock(input)) === 'string';
    return g;
  }

  const GEN = {};
  const def = (type, py, ts) => { GEN[type] = { py, ts: ts || py }; };
  const stmt = (type, py, ts) => def(type, py, ts);
  const call = (code) => [code, O.MEMBER];

  // 기본
  stmt('mb_show_number', (b, g) => { g.helpers.add('show_number'); return `show_number(${g.v(b, 'NUM', O.NONE)})`; }, (b, g) => `basic.showNumber(${g.v(b, 'NUM', O.NONE)})`);
  stmt('mb_show_string', (b, g) => { g.helpers.add('show_string'); return `show_string(${g.v(b, 'TEXT', O.NONE, '""')})`; }, (b, g) => `basic.showString(${g.v(b, 'TEXT', O.NONE, '""')})`);
  stmt('mb_show_icon', (b) => `display.show(Image.${b.getFieldValue('ICON')})`, (b) => `basic.showIcon(IconNames.${ICON_BY[b.getFieldValue('ICON')][1]})`);
  stmt('mb_show_arrow', (b) => `display.show(Image.ARROW_${b.getFieldValue('DIR')})`, (b) => `basic.showArrow(ArrowNames.${ARROW_BY[b.getFieldValue('DIR')][1]})`);
  stmt('mb_show_leds', (b) => `display.show(Image("${leds(b).join(':')}"))`, (b) => `basic.showLeds(${tsLeds(leds(b))})`);
  stmt('mb_clear', () => 'display.clear()', () => 'basic.clearScreen()');
  stmt('mb_pause', (b, g) => `sleep(${g.v(b, 'MS', O.NONE)})`, (b, g) => `basic.pause(${g.v(b, 'MS', O.NONE)})`);
  // 입력
  const BTN_PY = { A: 'button_a.is_pressed()', B: 'button_b.is_pressed()', AB: 'button_a.is_pressed() and button_b.is_pressed()' };
  def('mb_button_pressed', (b) => [BTN_PY[b.getFieldValue('BTN')], b.getFieldValue('BTN') === 'AB' ? O.AND : O.MEMBER], (b) => call(`input.buttonIsPressed(Button.${b.getFieldValue('BTN')})`));
  def('mb_logo_pressed', () => call('pin_logo.is_touched()'), () => call('input.logoIsPressed()'));
  def('mb_is_gesture', (b) => call(`accelerometer.is_gesture(${q(b.getFieldValue('G'))})`), (b) => call(`input.isGesture(Gesture.${GESTURE_BY[b.getFieldValue('G')][2]})`));
  def('mb_accel', (b) => call(b.getFieldValue('AXIS') === 'strength' ? 'accelerometer.get_strength()' : `accelerometer.get_${b.getFieldValue('AXIS')}()`),
    (b) => call(`input.acceleration(Dimension.${{ x: 'X', y: 'Y', z: 'Z', strength: 'Strength' }[b.getFieldValue('AXIS')]})`));
  def('mb_compass', () => call('compass.heading()'), () => call('input.compassHeading()'));
  stmt('mb_calibrate', () => 'compass.calibrate()', () => 'input.calibrateCompass()');
  def('mb_magnetic', () => call('compass.get_field_strength()'), () => call('input.magneticForce(Dimension.Strength)'));
  def('mb_running_time', () => call('running_time()'), () => call('input.runningTime()'));
  def('mb_temperature', () => call('temperature()'), () => call('input.temperature()'));
  def('mb_light', () => call('display.read_light_level()'), () => call('input.lightLevel()'));
  def('mb_sound', () => call('microphone.sound_level()'), () => call('input.soundLevel()'));
  // 음악
  stmt('mb_play_tone', (b, g) => { g.imports.add('music'); return `music.pitch(${g.v(b, 'FREQ', O.NONE)}, ${g.v(b, 'MS', O.NONE)}${b.getFieldValue('MODE') === 'bg' ? ', wait=False' : ''})`; },
    (b, g) => `music.play(music.tonePlayable(${g.v(b, 'FREQ', O.NONE)}, ${g.v(b, 'MS', O.NONE)}), music.PlaybackMode.${b.getFieldValue('MODE') === 'bg' ? 'InBackground' : 'UntilDone'})`);
  stmt('mb_play_melody', (b, g) => {
    g.imports.add('music');
    const notes = String(b.getFieldValue('MELODY')).trim().split(/\s+/).filter(Boolean).map(q).join(', ');
    return `music.set_tempo(bpm=${g.v(b, 'BPM', O.NONE, '120')})\nmusic.play([${notes}]${b.getFieldValue('MODE') === 'bg' ? ', wait=False' : ''})`;
  }, (b, g) => `music.play(music.stringPlayable(${q(String(b.getFieldValue('MELODY')).trim() + ' ')}, ${g.v(b, 'BPM', O.NONE, '120')}), music.PlaybackMode.${b.getFieldValue('MODE') === 'bg' ? 'InBackground' : 'UntilDone'})`);
  // LED
  const XY = (b, g) => `${g.v(b, 'X', O.NONE)}, ${g.v(b, 'Y', O.NONE)}`;
  stmt('mb_plot', (b, g) => `display.set_pixel(${XY(b, g)}, 9)`, (b, g) => `led.plot(${XY(b, g)})`);
  stmt('mb_unplot', (b, g) => `display.set_pixel(${XY(b, g)}, 0)`, (b, g) => `led.unplot(${XY(b, g)})`);
  stmt('mb_plot_brightness', (b, g) => {
    const t = b.getInputTargetBlock('B');
    const lv = t && t.type === 'math_number' ? String(Math.max(0, Math.min(9, Math.round(Number(t.getFieldValue('NUM')) * 9 / 255)))) : `min(9, round(${g.v(b, 'B', O.MUL)} * 9 / 255))`;
    return `display.set_pixel(${XY(b, g)}, ${lv})`;
  }, (b, g) => `led.plotBrightness(${XY(b, g)}, ${g.v(b, 'B', O.NONE)})`);
  def('mb_point', (b, g) => [`display.get_pixel(${XY(b, g)}) * 28`, O.MUL], (b, g) => call(`led.pointBrightness(${XY(b, g)})`));
  // 이미지
  stmt('mb_show_image', (b, g) => `display.show(${g.v(b, 'IMG', O.NONE, 'Image()')})`, (b, g) => `${g.v(b, 'IMG', O.MEMBER, 'images.iconImage(IconNames.Heart)')}.showImage(0)`);
  def('mb_create_image', (b) => call(`Image("${leds(b).join(':')}")`), (b) => call(`images.createImage(${tsLeds(leds(b))})`));
  def('mb_icon_image', (b) => [`Image.${b.getFieldValue('ICON')}`, O.MEMBER], (b) => call(`images.iconImage(IconNames.${ICON_BY[b.getFieldValue('ICON')][1]})`));
  def('mb_arrow_image', (b) => [`Image.ARROW_${b.getFieldValue('DIR')}`, O.MEMBER], (b) => call(`images.arrowImage(ArrowNames.${ARROW_BY[b.getFieldValue('DIR')][1]})`));
  // 반복
  stmt('controls_repeat_ext', (b, g) => g.block(`for _ in range(${g.v(b, 'TIMES', O.NONE)})`, b, 'DO'),
    (b, g) => { const i = 'index' + (g.depth ? g.depth + 1 : ''); return g.block(`for (let ${i} = 0; ${i} < ${g.v(b, 'TIMES', O.REL - 1)}; ${i}++)`, b, 'DO'); });
  stmt('controls_whileUntil', (b, g) => {
    const until = b.getFieldValue('MODE') === 'UNTIL';
    return g.block(until ? `while not ${g.v(b, 'BOOL', O.NOT, 'False')}` : `while ${g.v(b, 'BOOL', O.NONE, 'False')}`, b, 'DO');
  }, (b, g) => {
    const until = b.getFieldValue('MODE') === 'UNTIL';
    return g.block(until ? `while (!${g.v(b, 'BOOL', O.UNARY, 'false')})` : `while (${g.v(b, 'BOOL', O.NONE, 'false')})`, b, 'DO');
  });
  stmt('mb_for_index', (b, g) => {
    const t = b.getInputTargetBlock('TO');
    let n;
    if (t && t.type === 'math_number') n = String(Number(t.getFieldValue('NUM')) + 1);
    else if (t && t.type === 'math_arithmetic' && t.getFieldValue('OP') === 'MINUS' && t.getInputTargetBlock('B') && t.getInputTargetBlock('B').type === 'math_number' && Number(t.getInputTargetBlock('B').getFieldValue('NUM')) === 1) n = g.v(t, 'A', O.NONE);
    else n = `${g.v(b, 'TO', O.ADD)} + 1`;
    return g.block(`for ${g.vname(b)} in range(${n})`, b, 'DO');
  }, (b, g) => { const v = g.vname(b); return g.block(`for (let ${v} = 0; ${v} <= ${g.v(b, 'TO', O.ADD)}; ${v}++)`, b, 'DO'); });
  stmt('controls_forEach', (b, g) => g.block(`for ${g.vname(b)} in ${g.v(b, 'LIST', O.NONE, '[]')}`, b, 'DO'),
    (b, g) => g.block(`for (let ${g.vname(b)} of ${g.v(b, 'LIST', O.NONE, '[]')})`, b, 'DO'));
  stmt('controls_flow_statements', (b) => (b.getFieldValue('FLOW') === 'BREAK' ? 'break' : 'continue'));
  // 논리
  stmt('controls_if', (b, g) => {
    let s = '', i = 0;
    for (; b.getInput('IF' + i); i++) {
      const c = g.v(b, 'IF' + i, g.py ? O.NONE : O.NONE, g.py ? 'False' : 'false');
      if (g.py) s += (i ? '\nelif ' : 'if ') + c + ':\n' + g.body(b, 'DO' + i);
      else s += (i ? ' else if (' : 'if (') + c + ') {\n' + g.body(b, 'DO' + i) + '\n}';
    }
    if (b.getInput('ELSE')) s += g.py ? '\nelse:\n' + g.body(b, 'ELSE') : ' else {\n' + g.body(b, 'ELSE') + '\n}';
    return s;
  });
  const CMP = { EQ: '==', NEQ: '!=', LT: '<', LTE: '<=', GT: '>', GTE: '>=' };
  def('logic_compare', (b, g) => [`${g.v(b, 'A', O.ADD)} ${CMP[b.getFieldValue('OP')]} ${g.v(b, 'B', O.ADD)}`, O.REL]);
  def('logic_operation', (b, g) => {
    const and = b.getFieldValue('OP') === 'AND', o = and ? O.AND : O.OR;
    const op = g.py ? (and ? 'and' : 'or') : (and ? '&&' : '||');
    const f = g.py ? 'False' : 'false';
    return [`${g.v(b, 'A', o, f)} ${op} ${g.v(b, 'B', o, f)}`, o];
  });
  def('logic_negate', (b, g) => [`not ${g.v(b, 'BOOL', O.NOT, 'False')}`, O.NOT], (b, g) => [`!${g.v(b, 'BOOL', O.UNARY, 'false')}`, O.UNARY]);
  def('logic_boolean', (b) => [b.getFieldValue('BOOL') === 'TRUE' ? 'True' : 'False', O.ATOM], (b) => [b.getFieldValue('BOOL') === 'TRUE' ? 'true' : 'false', O.ATOM]);
  // 계산
  def('math_number', (b) => { const n = Number(b.getFieldValue('NUM')); return [String(n), n < 0 ? O.UNARY : O.ATOM]; });
  const ARITH = { ADD: ['+', O.ADD], MINUS: ['-', O.ADD], MULTIPLY: ['*', O.MUL], DIVIDE: ['/', O.MUL], POWER: ['**', O.POW] };
  def('math_arithmetic', (b, g) => {
    const [op, o] = ARITH[b.getFieldValue('OP')];
    if (op === '**') return [`${g.v(b, 'A', O.MEMBER)} ** ${g.v(b, 'B', O.POW)}`, o];
    return [`${g.v(b, 'A', o)} ${op} ${g.v(b, 'B', o - 1)}`, o];
  });
  def('math_modulo', (b, g) => [`${g.v(b, 'DIVIDEND', O.MUL)} % ${g.v(b, 'DIVISOR', O.MUL - 1, '1')}`, O.MUL]);
  const FN1_PY = { sqrt: 'math.sqrt', abs: 'abs', round: 'round', floor: 'math.floor', ceil: 'math.ceil', trunc: 'int', sin: 'math.sin', cos: 'math.cos', tan: 'math.tan' };
  def('mb_math_fn1', (b, g) => { const f = FN1_PY[b.getFieldValue('OP')]; if (f.startsWith('math.')) g.imports.add('math'); return call(`${f}(${g.v(b, 'X', O.NONE)})`); },
    (b, g) => call(`Math.${b.getFieldValue('OP')}(${g.v(b, 'X', O.NONE)})`));
  def('mb_math_fn2', (b, g) => {
    const op = b.getFieldValue('OP');
    if (op === 'idiv') return [`${g.v(b, 'A', O.MUL)} // ${g.v(b, 'B', O.MUL - 1, '1')}`, O.MUL];
    if (op === 'atan2') g.imports.add('math');
    return call(`${op === 'atan2' ? 'math.atan2' : op}(${g.v(b, 'A', O.NONE)}, ${g.v(b, 'B', O.NONE)})`);
  }, (b, g) => call(`Math.${b.getFieldValue('OP')}(${g.v(b, 'A', O.NONE)}, ${g.v(b, 'B', O.NONE)})`));
  def('mb_random', (b, g) => { g.imports.add('random'); return call(`random.randint(${g.v(b, 'A', O.NONE)}, ${g.v(b, 'B', O.NONE)})`); }, (b, g) => call(`randint(${g.v(b, 'A', O.NONE)}, ${g.v(b, 'B', O.NONE)})`));
  def('mb_pi', (b, g) => { g.imports.add('math'); return ['math.pi', O.MEMBER]; }, () => ['Math.PI', O.MEMBER]);
  // 변수
  def('variables_get', (b, g) => [g.vname(b), O.ATOM]);
  stmt('variables_set', (b, g) => `${g.vname(b)} = ${g.v(b, 'VALUE', O.NONE)}`);
  stmt('math_change', (b, g) => `${g.vname(b)} += ${g.v(b, 'DELTA', O.NONE, '1')}`);
  // 텍스트
  def('text', (b) => [q(b.getFieldValue('TEXT')), O.ATOM]);
  def('text_join', (b, g) => {
    const items = [];
    for (let i = 0; b.getInput('ADD' + i); i++) if (b.getInputTargetBlock('ADD' + i)) items.push(i);
    if (!items.length) return ['""', O.ATOM];
    if (g.py) return [items.map((i) => (g.isText(b, 'ADD' + i) ? g.v(b, 'ADD' + i, O.MUL) : `str(${g.v(b, 'ADD' + i, O.NONE)})`)).join(' + '), items.length > 1 ? O.ADD : O.MEMBER];
    const parts = items.map((i) => g.v(b, 'ADD' + i, O.MUL));
    if (!g.isText(b, 'ADD' + items[0])) parts.unshift('""');
    return parts.length > 1 ? [parts.join(' + '), O.ADD] : [parts[0], O.ATOM];
  });
  def('mb_text_length', (b, g) => call(`len(${g.v(b, 'TEXT', O.NONE, '""')})`), (b, g) => [`${g.v(b, 'TEXT', O.MEMBER, '""')}.length`, O.MEMBER]);
  def('mb_to_text', (b, g) => call(`str(${g.v(b, 'X', O.NONE)})`), (b, g) => [`"" + ${g.v(b, 'X', O.MUL)}`, O.ADD]);
  def('mb_text_index_of', (b, g) => call(`${g.v(b, 'TEXT', O.MEMBER, '""')}.find(${g.v(b, 'SUB', O.NONE, '""')})`), (b, g) => call(`${g.v(b, 'TEXT', O.MEMBER, '""')}.indexOf(${g.v(b, 'SUB', O.NONE, '""')})`));
  def('mb_text_char_at', (b, g) => call(`${g.v(b, 'TEXT', O.MEMBER, '""')}[${g.v(b, 'I', O.NONE)}]`), (b, g) => call(`${g.v(b, 'TEXT', O.MEMBER, '""')}.charAt(${g.v(b, 'I', O.NONE)})`));
  def('mb_text_includes', (b, g) => [`${g.v(b, 'SUB', O.ADD, '""')} in ${g.v(b, 'TEXT', O.ADD, '""')}`, O.REL], (b, g) => call(`${g.v(b, 'TEXT', O.MEMBER, '""')}.includes(${g.v(b, 'SUB', O.NONE, '""')})`));
  def('mb_parse_number', (b, g) => call(`float(${g.v(b, 'TEXT', O.NONE, '"0"')})`), (b, g) => call(`parseFloat(${g.v(b, 'TEXT', O.NONE, '"0"')})`));
  // 배열
  def('lists_create_with', (b, g) => { const a = []; for (let i = 0; b.getInput('ADD' + i); i++) a.push(g.v(b, 'ADD' + i, O.NONE)); return ['[' + a.join(', ') + ']', O.ATOM]; });
  const L = (b, g) => g.v(b, 'LIST', O.MEMBER, '[]');
  def('mb_list_get', (b, g) => call(`${L(b, g)}[${g.v(b, 'I', O.NONE)}]`));
  stmt('mb_list_set', (b, g) => `${L(b, g)}[${g.v(b, 'I', O.NONE)}] = ${g.v(b, 'VALUE', O.NONE)}`);
  def('mb_list_length', (b, g) => call(`len(${g.v(b, 'LIST', O.NONE, '[]')})`), (b, g) => [`${L(b, g)}.length`, O.MEMBER]);
  stmt('mb_list_push', (b, g) => `${L(b, g)}.append(${g.v(b, 'VALUE', O.NONE)})`, (b, g) => `${L(b, g)}.push(${g.v(b, 'VALUE', O.NONE)})`);
  stmt('mb_list_remove_first', (b, g) => `${L(b, g)}.pop(0)`, (b, g) => `${L(b, g)}.shift()`);
  stmt('mb_list_remove_last', (b, g) => `${L(b, g)}.pop()`);
  stmt('mb_list_remove_at', (b, g) => `${L(b, g)}.pop(${g.v(b, 'I', O.NONE)})`, (b, g) => `${L(b, g)}.removeAt(${g.v(b, 'I', O.NONE)})`);
  def('mb_list_shift', (b, g) => call(`${L(b, g)}.pop(0)`), (b, g) => call(`${L(b, g)}.shift()`));
  def('mb_list_pop', (b, g) => call(`${L(b, g)}.pop()`));
  stmt('mb_list_insert', (b, g) => `${L(b, g)}.insert(${g.v(b, 'I', O.NONE)}, ${g.v(b, 'VALUE', O.NONE)})`, (b, g) => `${L(b, g)}.insertAt(${g.v(b, 'I', O.NONE)}, ${g.v(b, 'VALUE', O.NONE)})`);
  def('mb_list_index_of', (b, g) => { g.helpers.add('index_of'); return call(`index_of(${g.v(b, 'LIST', O.NONE, '[]')}, ${g.v(b, 'VALUE', O.NONE)})`); }, (b, g) => call(`${L(b, g)}.indexOf(${g.v(b, 'VALUE', O.NONE)})`));
  // 함수
  stmt('mb_fn_return', (b, g) => (b.getInputTargetBlock('VALUE') ? `return ${g.v(b, 'VALUE', O.NONE)}` : 'return'));
  const args = (b, g) => (b.params || []).map((_, i) => g.v(b, 'ARG' + i, O.NONE)).join(', ');
  stmt('mb_fn_call', (b, g) => `${g.name(b.getFieldValue('NAME'))}(${args(b, g)})`);
  def('mb_fn_call_expr', (b, g) => call(`${g.name(b.getFieldValue('NAME'))}(${args(b, g)})`));
  // 시리얼 · 데이터 로거
  stmt('mb_serial_line', (b, g) => `print(${g.v(b, 'TEXT', O.NONE, '""')})`,
    (b, g) => `serial.writeLine(${g.isText(b, 'TEXT') || !b.getInputTargetBlock('TEXT') ? g.v(b, 'TEXT', O.NONE, '""') : '"" + ' + g.v(b, 'TEXT', O.MUL)})`);
  const cols = (b) => String(b.getFieldValue('COLS') || '').split(',').map((c) => c.trim()).filter(Boolean);
  const TS_PY = { none: 'None', s: 'log.SECONDS', ms: 'log.MILLISECONDS', min: 'log.MINUTES' };
  const TS_TS = { none: 'None', s: 'Seconds', ms: 'Milliseconds', min: 'Minutes' };
  stmt('dl_set_columns', (b, g) => { g.imports.add('log'); return `log.set_labels(${cols(b).map(q).join(', ')}, timestamp=${TS_PY[b.getFieldValue('TS')]})`; },
    (b, g) => { g.datalogger = true; return `datalogger.includeTimestamp(FlashLogTimeStampFormat.${TS_TS[b.getFieldValue('TS')]})\ndatalogger.setColumnTitles(${cols(b).map(q).join(', ')})`; });
  stmt('dl_log', (b, g) => {
    g.imports.add('log');
    const kv = []; for (let i = 0; i < b.n; i++) kv.push([String(b.getFieldValue('COL' + i)).trim(), g.v(b, 'VAL' + i, O.NONE)]);
    if (kv.every(([k]) => /^[A-Za-z_]\w*$/.test(k) && !PY_RESERVED.has(k))) return `log.add(${kv.map(([k, v]) => k + '=' + v).join(', ')})`;
    return `log.add({${kv.map(([k, v]) => q(k) + ': ' + v).join(', ')}})`;
  }, (b, g) => {
    g.datalogger = true;
    const kv = []; for (let i = 0; i < b.n; i++) kv.push(`datalogger.createCV(${q(String(b.getFieldValue('COL' + i)).trim())}, ${g.v(b, 'VAL' + i, O.NONE)})`);
    return `datalogger.log(${kv.join(', ')})`;
  });
  stmt('dl_delete', (b, g) => { g.imports.add('log'); return 'log.delete()'; }, (b, g) => { g.datalogger = true; return 'datalogger.deleteLog()'; });
  // 파이썬 그대로
  stmt('py_raw', (b) => b.code, (b, g) => { g.raw++; return String(b.code).split('\n').map((l) => '// [파이썬] ' + l).join('\n'); });
  def('py_raw_expr', (b) => [b.code, O.NONE], (b, g) => { g.raw++; g.pend.push('// [파이썬] ' + b.code); return ['0', O.ATOM]; });

  const PY_HELPERS = {
    show_number: 'def show_number(n):\n    # MakeCode 의 \'수 출력\' 과 같게: 한 자리 정수는 그대로, 아니면 흘려서 보이기\n    if n == int(n) and 0 <= n <= 9:\n        display.show(int(n))\n    else:\n        display.scroll(n)',
    show_string: 'def show_string(s):\n    # MakeCode 의 \'문자열 출력\' 과 같게: 한 글자는 그대로, 아니면 흘려서 보이기\n    if len(s) == 1:\n        display.show(s)\n    else:\n        display.scroll(s)',
    index_of: 'def index_of(items, value):\n    # MakeCode 의 \'위치\' 블록과 같게: 없으면 -1\n    return items.index(value) if value in items else -1'
  };
  const PY_DEFAULT = (t) => (t === 'string' ? '""' : t === 'boolean' ? 'False' : t === 'Image' ? 'Image()' : t.endsWith('[]') ? '[]' : '0');
  const TS_DEFAULT = (t) => (t === 'string' ? '""' : t === 'boolean' ? 'false' : t === 'Image' ? 'null' : t.endsWith('[]') ? '[]' : '0');
  const EVENT_TYPES = ['mb_on_button', 'mb_on_gesture', 'mb_on_logo'];

  // 함수 · 이벤트 안에서 값을 바꾸는 변수 (매개변수 · 반복 변수 제외)
  function assigned(top, skip) {
    const s = new Set();
    top.getDescendants(false).forEach((d) => { if (STMT_VARS[d.type] && d.isEnabled()) s.add(varOf(d)); });
    (skip || []).forEach((p) => s.delete(p));
    return [...s];
  }
  function topsOf(ws) {
    const tops = ws.getTopBlocks(true).filter((b) => b.isEnabled());
    const by = (t) => tops.filter((b) => b.type === t);
    return { fns: by('mb_fn_def'), starts: by('mb_on_start'), forevers: by('mb_forever'), events: tops.filter((b) => EVENT_TYPES.includes(b.type)) };
  }
  // '시작하면 실행' 의 맨 바깥 줄에서 값을 정하는 변수
  function startSets(starts) {
    const s = new Set();
    starts.forEach((st) => { for (let b = st.getInputTargetBlock('DO'); b; b = b.getNextBlock()) if (b.type === 'variables_set' && b.isEnabled()) s.add(varOf(b)); });
    return s;
  }
  const allVars = (ws) => { const s = new Set(); ws.getAllBlocks(false).forEach((b) => { if (STMT_VARS[b.type] && b.isEnabled()) s.add(varOf(b)); }); return s; };
  const cmLines = (b, py) => { const c = b.getCommentText && b.getCommentText(); return c ? c.split('\n').map((l) => (py ? '# ' : '// ') + l) : []; };

  function genPy(ws) {
    const g = makeGen(ws, 'py');
    const { fns, starts, forevers, events } = topsOf(ws);
    const defs = [], loop = [];
    const globalsLine = (top, params) => { const a = assigned(top, params).map(g.name); return a.length ? '    global ' + a.join(', ') + '\n' : ''; };
    const defBlock = (top, name, params) => [...cmLines(top, true), `def ${name}(${params.map(g.name).join(', ')}):`].join('\n') + '\n' + globalsLine(top, params) + g.body(top, 'DO');
    fns.forEach((b) => defs.push(defBlock(b, g.name(b.getFieldValue('NAME')), fnParams(b))));
    const used = new Set();
    const uniq = (n) => { let o = n, i = 2; while (used.has(o)) o = n + '_' + i++; used.add(o); return o; };
    let logo = false;
    events.forEach((b) => {
      if (b.type === 'mb_on_button') {
        const k = b.getFieldValue('BTN'), name = uniq('on_button_' + k.toLowerCase());
        defs.push(defBlock(b, name, []));
        if (k === 'AB') loop.unshift(`if button_a.is_pressed() and button_b.is_pressed():\n    while button_a.is_pressed() or button_b.is_pressed():\n        sleep(10)\n    button_a.was_pressed()\n    button_b.was_pressed()\n    ${name}()`);
        else loop.push(`if button_${k.toLowerCase()}.was_pressed():\n    ${name}()`);
      } else if (b.type === 'mb_on_gesture') {
        const k = b.getFieldValue('G'), name = uniq('on_gesture_' + k.replace(/\W/g, '_'));
        defs.push(defBlock(b, name, []));
        loop.push(`if accelerometer.was_gesture(${q(k)}):\n    ${name}()`);
      } else {
        const name = uniq('on_logo_pressed');
        defs.push(defBlock(b, name, []));
        loop.push(`touched = pin_logo.is_touched()\nif touched and not logo_was_touched:\n    ${name}()\nlogo_was_touched = touched`);
        logo = true;
      }
    });
    forevers.forEach((b) => { const name = uniq('on_forever'); defs.push(defBlock(b, name, [])); loop.push(`${name}()`); });
    // 시작할 때 값이 정해지지 않는 변수는 MakeCode 처럼 0 · "" · [] 로 먼저 둔다
    const set0 = startSets(starts), init = [];
    allVars(ws).forEach((n) => { if (!set0.has(n)) init.push(`${g.name(n)} = ${PY_DEFAULT(g.types.vt.get(n) || 'number')}`); });
    const start = [];
    starts.forEach((b) => { start.push(...cmLines(b, true), ...g.stack(b.getInputTargetBlock('DO'))); });
    const head = ['from microbit import *', ...[...g.imports].sort().map((m) => 'import ' + m)];
    const parts = [head.join('\n')];
    const helpers = [...g.helpers].map((h) => PY_HELPERS[h]);
    if (helpers.length) parts.push(helpers.join('\n\n'));
    if (defs.length) parts.push(defs.join('\n\n'));
    if (logo) init.push('logo_was_touched = False');
    const body = [...init, ...start];
    if (loop.length) body.push('while True:\n' + [...loop, 'sleep(20)'].join('\n').split('\n').map((l) => '    ' + l).join('\n'));
    if (body.length) parts.push(body.join('\n'));
    return { code: parts.join('\n\n') + '\n', raw: g.raw };
  }

  function genTs(ws) {
    const g = makeGen(ws, 'ts');
    const { fns, starts, forevers, events } = topsOf(ws);
    const out = [];
    const T = g.types;
    fns.forEach((b) => {
      const fn = b.getFieldValue('NAME');
      const ps = fnParams(b).map((p) => `${g.name(p)}: ${T.pt.get(fn + '.' + p) || 'number'}`);
      out.push([...cmLines(b, false), `function ${g.name(fn)} (${ps.join(', ')}) {`, g.body(b, 'DO'), '}'].join('\n'));
    });
    events.forEach((b) => {
      let head;
      if (b.type === 'mb_on_button') head = `input.onButtonPressed(Button.${b.getFieldValue('BTN')}, function () {`;
      else if (b.type === 'mb_on_gesture') head = `input.onGesture(Gesture.${GESTURE_BY[b.getFieldValue('G')][2]}, function () {`;
      else head = 'input.onLogoEvent(TouchButtonEvent.Pressed, function () {';
      out.push([...cmLines(b, false), head, g.body(b, 'DO'), '})'].join('\n'));
    });
    // 변수 선언: '시작하면 실행' 맨 바깥에서 처음 값을 정하면 그 줄을 let 으로, 나머지는 기본값으로 먼저 선언
    const declared = new Set(), start = [], seen = new Set();
    const ann = (n, vb) => { const t = T.vt.get(n) || 'number'; const empty = vb && vb.type === 'lists_create_with' && !vb.getInputTargetBlock('ADD0'); return empty || (vb && vb.type === 'py_raw_expr') || t === 'Image' ? ': ' + t : ''; };
    starts.forEach((s) => {
      start.push(...cmLines(s, false));
      for (let b = s.getInputTargetBlock('DO'); b; b = b.getNextBlock()) {
        if (!b.isEnabled()) continue;
        const r = g.one(b);
        let code = r.code;
        if (b.type === 'variables_set') {
          const n = varOf(b);
          if (!declared.has(n) && !seen.has(n)) { declared.add(n); code = `let ${g.name(n)}${ann(n, b.getInputTargetBlock('VALUE'))}${code.slice(g.name(n).length)}`; }
        }
        b.getDescendants(false).forEach((d) => { if (d.getField && d.getField('VAR')) seen.add(varOf(d)); });
        start.push(...r.pre, ...code.split('\n'));
      }
    });
    const decl = [];
    allVars(ws).forEach((n) => { if (!declared.has(n)) { const t = T.vt.get(n) || 'number'; decl.push(`let ${g.name(n)}${t.endsWith('[]') || t === 'Image' ? ': ' + t : ''} = ${TS_DEFAULT(t)}`); } });
    if (decl.length || start.length) out.push([...decl, ...start].join('\n'));
    forevers.forEach((b) => out.push([...cmLines(b, false), 'basic.forever(function () {', g.body(b, 'DO'), '})'].join('\n')));
    return { code: out.join('\n') + '\n', raw: g.raw, datalogger: g.datalogger };
  }

  // makecode.microbit.org 의 [가져오기 → 파일 가져오기]로 여는 프로젝트 파일 (.mkcd · JSON)
  // main.blocks 를 비워 두면 MakeCode 가 main.ts 를 읽어 블록으로 바꿔 보여 줍니다.
  function mkcd(ws, name) {
    const ts = genTs(ws);
    const deps = { core: '*', radio: '*', microphone: '*' };
    if (ts.datalogger) deps.datalogger = '*';
    const pxt = { name, description: '', dependencies: deps, files: ['main.blocks', 'main.ts', 'README.md'], preferredEditor: 'blocksprj' };
    const source = { 'main.blocks': '', 'main.ts': ts.code, 'README.md': ' ', 'pxt.json': JSON.stringify(pxt, null, 4) };
    return JSON.stringify({ meta: { cloudId: 'pxt/microbit', editor: 'blocksprj', name, mbBlocks: Blockly.serialization.workspaces.save(ws) }, source: JSON.stringify(source) });
  }
