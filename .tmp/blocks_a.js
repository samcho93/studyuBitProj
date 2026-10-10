
/* ── 블록 코딩 (MakeCode 호환) ─────────────────────────────────────────
 * 열기: 본문 예제의 [🧩 블록] 버튼 · 아래 편집기의 [🧩 블록으로] · 위쪽 막대의 [🧩 블록 코딩] 메뉴.
 * - 파이썬 예제를 makecode.microbit.org 와 같은 분류 · 색 · 이름의 블록으로 바꿔 보여 줍니다.
 *   (파이썬 문법은 시뮬레이터용 Pyodide 의 ast 모듈로 읽습니다. 블록으로 바꿀 수 없는 줄은 회색 '파이썬' 블록으로 남깁니다.)
 * - ▶ 실행: 블록 → MicroPython 으로 바꿔 오른쪽 시뮬레이터(🔌 보드를 골랐으면 실제 보드)에서 실행합니다.
 * - 💾 MakeCode 파일: 블록 → MakeCode JavaScript(main.ts)를 담은 .mkcd 파일. makecode.microbit.org 의 [가져오기]로 열면 블록으로 보입니다.
 * 순서: 블록 정의 → 생성기(MicroPython / MakeCode JavaScript) → 파이썬 → 블록 변환기 → 화면.
 */
(function () {
  'use strict';

  const BL = 'https://cdn.jsdelivr.net/npm/blockly@11.2.1/';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const toast = (m) => { if (window.app && app.toast) app.toast(m); };

  // MakeCode 와 같은 분류 색
  const C = {
    basic: '#1E90FF', input: '#D400D4', music: '#E63022', led: '#5C2D91', images: '#7600A8', loops: '#00AA00', logic: '#00A4A6',
    vars: '#DC143C', math: '#9400D3', fn: '#3455DB', arrays: '#FF8F08', text: '#B8860B', serial: '#002050', dl: '#378273', py: '#8A8A8A'
  };

  // [MicroPython 이름, MakeCode IconNames, 한국어, 5×5 무늬]
  const ICONS = [
    ['HEART', 'Heart', '하트', '09090:99999:99999:09990:00900'], ['HEART_SMALL', 'SmallHeart', '작은 하트', '00000:09090:09990:00900:00000'],
    ['YES', 'Yes', '체크', '00000:00009:00090:90900:09000'], ['NO', 'No', '엑스', '90009:09090:00900:09090:90009'],
    ['HAPPY', 'Happy', '웃는 얼굴', '00000:09090:00000:90009:09990'], ['SAD', 'Sad', '슬픈 얼굴', '00000:09090:00000:09990:90009'],
    ['CONFUSED', 'Confused', '헷갈림', '00000:09090:00000:09090:90909'], ['ANGRY', 'Angry', '화남', '90009:09090:00000:99999:90909'],
    ['ASLEEP', 'Asleep', '잠', '00000:99099:00000:09990:00000'], ['SURPRISED', 'Surprised', '놀람', '09090:00000:00900:09090:00900'],
    ['SILLY', 'Silly', '장난', '90009:00000:99999:00909:00999'], ['FABULOUS', 'Fabulous', '멋짐', '99999:99099:00000:09090:09990'],
    ['MEH', 'Meh', '시큰둥', '09090:00000:00090:00900:09000'], ['TSHIRT', 'TShirt', '티셔츠', '99099:99999:09990:09990:09990'],
    ['ROLLERSKATE', 'Rollerskate', '롤러스케이트', '00099:00099:99999:99999:09090'], ['DUCK', 'Duck', '오리', '09900:99900:09999:09990:00000'],
    ['HOUSE', 'House', '집', '00900:09990:99999:09990:09090'], ['TORTOISE', 'Tortoise', '거북이', '00000:09990:99999:09090:00000'],
    ['BUTTERFLY', 'Butterfly', '나비', '99099:99999:00900:99999:99099'], ['STICKFIGURE', 'StickFigure', '사람', '00900:99999:00900:09090:90009'],
    ['GHOST', 'Ghost', '유령', '99999:90909:99999:99999:90909'], ['SWORD', 'Sword', '칼', '00900:00900:00900:09990:00900'],
    ['GIRAFFE', 'Giraffe', '기린', '99000:09000:09000:09990:09090'], ['SKULL', 'Skull', '해골', '09990:90909:99999:09990:09990'],
    ['UMBRELLA', 'Umbrella', '우산', '09990:99999:00900:90900:09900'], ['SNAKE', 'Snake', '뱀', '99000:99099:09090:09990:00000'],
    ['RABBIT', 'Rabbit', '토끼', '90900:90900:99990:99090:99990'], ['COW', 'Cow', '소', '90009:90009:99999:09990:00900'],
    ['MUSIC_CROTCHET', 'QuarterNote', '4분음표', '00900:00900:00900:99900:99900'], ['MUSIC_QUAVER', 'EighthNote', '8분음표', '00900:00990:00909:99900:99900'],
    ['PITCHFORK', 'Pitchfork', '쇠스랑', '90909:90909:99999:00900:00900'], ['TARGET', 'Target', '과녁', '00900:09990:99099:09990:00900'],
    ['TRIANGLE', 'Triangle', '삼각형', '00000:00900:09090:99999:00000'], ['TRIANGLE_LEFT', 'LeftTriangle', '왼쪽 삼각형', '90000:99000:90900:90090:99999'],
    ['CHESSBOARD', 'Chessboard', '체스판', '09090:90909:09090:90909:09090'], ['DIAMOND', 'Diamond', '다이아몬드', '00900:09090:90009:09090:00900'],
    ['DIAMOND_SMALL', 'SmallDiamond', '작은 다이아몬드', '00000:00900:09090:00900:00000'], ['SQUARE', 'Square', '사각형', '99999:90009:90009:90009:99999'],
    ['SQUARE_SMALL', 'SmallSquare', '작은 사각형', '00000:09990:09090:09990:00000'], ['SCISSORS', 'Scissors', '가위', '99009:99090:00900:99090:99009']
  ];
  const ARROWS = [
    ['N', 'North', '북쪽', '00900:09990:90909:00900:00900'], ['NE', 'NorthEast', '북동쪽', '00999:00099:00909:09000:90000'],
    ['E', 'East', '동쪽', '00900:00090:99999:00090:00900'], ['SE', 'SouthEast', '남동쪽', '90000:09000:00909:00099:00999'],
    ['S', 'South', '남쪽', '00900:00900:90909:09990:00900'], ['SW', 'SouthWest', '남서쪽', '00009:00090:90900:99000:99900'],
    ['W', 'West', '서쪽', '00900:09000:99999:09000:00900'], ['NW', 'NorthWest', '북서쪽', '99900:99000:90900:00090:00009']
  ];
  const ICON_BY = Object.fromEntries(ICONS.map((i) => [i[0], i]));
  const ARROW_BY = Object.fromEntries(ARROWS.map((a) => [a[0], a]));
  // [한국어, MicroPython 이름, MakeCode Gesture]
  const GESTURES = [
    ['흔들림', 'shake', 'Shake'], ['로고 위쪽', 'up', 'LogoUp'], ['로고 아래쪽', 'down', 'LogoDown'], ['화면 위쪽', 'face up', 'ScreenUp'],
    ['화면 아래쪽', 'face down', 'ScreenDown'], ['왼쪽 기울임', 'left', 'TiltLeft'], ['오른쪽 기울임', 'right', 'TiltRight'],
    ['떨어짐', 'freefall', 'FreeFall'], ['3g', '3g', 'ThreeG'], ['6g', '6g', 'SixG'], ['8g', '8g', 'EightG']
  ];
  const GESTURE_BY = Object.fromEntries(GESTURES.map((g) => [g[1], g]));

  // 5×5 무늬 → 드롭다운 그림 (data URI)
  function ledUri(pat, px) {
    const rows = pat.split(':');
    let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 50 50"><rect width="50" height="50" rx="5" fill="#222"/>`;
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) s += `<rect x="${3 + c * 9.4}" y="${3 + r * 9.4}" width="7" height="7" rx="1.5" fill="${rows[r][c] !== '0' ? '#ff2d1a' : '#4a4a4a'}"/>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s + '</svg>');
  }
  const iconOptions = () => ICONS.map((i) => [{ src: ledUri(i[3], 30), width: 30, height: 30, alt: i[2] }, i[0]]);
  const arrowOptions = () => ARROWS.map((a) => [{ src: ledUri(a[3], 30), width: 30, height: 30, alt: a[2] }, a[0]]);

  /* ── 블록 정의 ── */
  const V = (name) => ({ type: 'input_value', name });
  const DD = (name, options) => ({ type: 'field_dropdown', name, options });
  const S = (type, colour, msg, args, extra) => Object.assign({ type, colour, message0: msg, args0: args || [], previousStatement: null, nextStatement: null, inputsInline: true }, extra);
  const E = (type, colour, msg, args, output, extra) => Object.assign({ type, colour, message0: msg, args0: args || [], output: output === undefined ? null : output, inputsInline: true }, extra);
  const H = (type, colour, msg, args, extra) => Object.assign({ type, colour, message0: msg, args0: args || [], message1: '%1', args1: [{ type: 'input_statement', name: 'DO' }] }, extra);
  const BTN = () => DD('BTN', [['A', 'A'], ['B', 'B'], ['A+B', 'AB']]);
  const MODE = () => DD('MODE', [['끝날 때까지', 'wait'], ['백그라운드로', 'bg']]);
  const GEST = () => DD('G', GESTURES.map((g) => [g[0], g[1]]));

  let defined = false;
  function defineBlocks() {
    if (defined) return;
    defined = true;
    const Bk = Blockly;
    Bk.common.defineBlocksWithJsonArray([
      // 기본
      H('mb_on_start', C.basic, '시작하면 실행', [], { tooltip: '프로그램이 시작될 때 한 번 실행합니다.' }),
      H('mb_forever', C.basic, '무한반복 실행', [], { tooltip: '안의 블록을 계속 되풀이합니다.' }),
      S('mb_show_number', C.basic, '수 출력 %1', [V('NUM')], { tooltip: 'LED 화면에 수를 보입니다 (두 자리 이상은 흘러갑니다).' }),
      S('mb_show_string', C.basic, '문자열 출력 %1', [V('TEXT')], { tooltip: 'LED 화면에 글자를 보입니다 (두 글자 이상은 흘러갑니다).' }),
      S('mb_show_icon', C.basic, '아이콘 출력 %1', [DD('ICON', iconOptions())]),
      S('mb_show_arrow', C.basic, '화살표 출력 %1', [DD('DIR', arrowOptions())]),
      S('mb_clear', C.basic, 'LED 스크린 지우기'),
      S('mb_pause', C.basic, '일시중지 (ms) %1', [V('MS')]),
      // 입력
      H('mb_on_button', C.input, '%1 버튼 누르면 실행', [BTN()]),
      H('mb_on_gesture', C.input, '%1 감지하면 실행', [GEST()]),
      H('mb_on_logo', C.input, '로고 터치하면 실행'),
      E('mb_button_pressed', C.input, '%1 버튼 누름 상태', [BTN()], 'Boolean'),
      E('mb_logo_pressed', C.input, '로고 터치 상태', [], 'Boolean'),
      E('mb_is_gesture', C.input, '%1 감지 상태', [GEST()], 'Boolean'),
      E('mb_accel', C.input, '가속도 센서 값 (mg) %1', [DD('AXIS', [['x', 'x'], ['y', 'y'], ['z', 'z'], ['세기', 'strength']])], 'Number'),
      E('mb_compass', C.input, '나침반 방향 (°)', [], 'Number'),
      S('mb_calibrate', C.input, '나침반 보정하기'),
      E('mb_magnetic', C.input, '자기장 세기', [], 'Number', { tooltip: 'MicroPython 은 nT, MakeCode 는 µT 단위입니다.' }),
      E('mb_running_time', C.input, '동작 시간 (ms)', [], 'Number'),
      E('mb_temperature', C.input, '온도 (°C)', [], 'Number'),
      E('mb_light', C.input, '빛 센서 값', [], 'Number'),
      E('mb_sound', C.input, '소리 크기', [], 'Number'),
      // 음악
      S('mb_play_tone', C.music, '%1 Hz 소리를 %2 ms 동안 %3 재생', [V('FREQ'), V('MS'), MODE()]),
      S('mb_play_melody', C.music, '멜로디 %1 빠르기 %2 %3 재생', [{ type: 'field_input', name: 'MELODY', text: 'C5 E5 G5' }, V('BPM'), MODE()]),
      // LED
      S('mb_plot', C.led, 'LED 켜기 x %1 y %2', [V('X'), V('Y')]),
      S('mb_unplot', C.led, 'LED 끄기 x %1 y %2', [V('X'), V('Y')]),
      S('mb_plot_brightness', C.led, 'LED 켜기 x %1 y %2 밝기 %3', [V('X'), V('Y'), V('B')], { tooltip: '밝기 0~255 (MicroPython 의 0~9 로 바꿔 실행합니다).' }),
      E('mb_point', C.led, 'LED 밝기 x %1 y %2', [V('X'), V('Y')], 'Number'),
      // 이미지
      S('mb_show_image', C.images, '이미지 %1 출력', [V('IMG')]),
      E('mb_icon_image', C.images, '아이콘 이미지 %1', [DD('ICON', iconOptions())], 'Image'),
      E('mb_arrow_image', C.images, '화살표 이미지 %1', [DD('DIR', arrowOptions())], 'Image'),
      // 반복
      {
        type: 'mb_for_index', colour: C.loops, message0: '%1 값을 0 부터 %2 까지 1씩 늘리며 반복',
        args0: [{ type: 'field_variable', name: 'VAR', variable: 'index' }, V('TO')], message1: '%1', args1: [{ type: 'input_statement', name: 'DO' }],
        previousStatement: null, nextStatement: null, inputsInline: true
      },
      // 계산
      E('mb_math_fn1', C.math, '%1 %2', [DD('OP', [['제곱근', 'sqrt'], ['절댓값', 'abs'], ['반올림', 'round'], ['내림', 'floor'], ['올림', 'ceil'], ['소수점 버림', 'trunc'], ['sin', 'sin'], ['cos', 'cos'], ['tan', 'tan']]), V('X')], 'Number'),
      E('mb_math_fn2', C.math, '%1 ( %2 , %3 )', [DD('OP', [['최솟값', 'min'], ['최댓값', 'max'], ['몫 (정수 나눗셈)', 'idiv'], ['atan2', 'atan2']]), V('A'), V('B')], 'Number'),
      E('mb_random', C.math, '%1 부터 %2 까지 정수 랜덤값', [V('A'), V('B')], 'Number'),
      E('mb_pi', C.math, 'π', [], 'Number'),
      // 텍스트
      E('mb_text_length', C.text, '%1 의 글자 수', [V('TEXT')], 'Number'),
      E('mb_to_text', C.text, '%1 을(를) 문자열로', [V('X')], 'String'),
      E('mb_text_index_of', C.text, '%1 에서 %2 의 위치', [V('TEXT'), V('SUB')], 'Number'),
      E('mb_text_char_at', C.text, '%1 의 %2 번째 글자', [V('TEXT'), V('I')], 'String'),
      E('mb_text_includes', C.text, '%1 에 %2 포함?', [V('TEXT'), V('SUB')], 'Boolean'),
      E('mb_parse_number', C.text, '%1 을(를) 수로', [V('TEXT')], 'Number'),
      // 배열
      E('mb_list_get', C.arrays, '%1 의 %2 번째 값', [V('LIST'), V('I')]),
      S('mb_list_set', C.arrays, '%1 의 %2 번째 값을 %3 (으)로 바꾸기', [V('LIST'), V('I'), V('VALUE')]),
      E('mb_list_length', C.arrays, '%1 의 길이', [V('LIST')], 'Number'),
      S('mb_list_push', C.arrays, '%1 의 끝에 %2 추가', [V('LIST'), V('VALUE')]),
      S('mb_list_remove_first', C.arrays, '%1 의 첫 번째 값 삭제', [V('LIST')]),
      S('mb_list_remove_last', C.arrays, '%1 의 마지막 값 삭제', [V('LIST')]),
      S('mb_list_remove_at', C.arrays, '%1 의 %2 번째 값 삭제', [V('LIST'), V('I')]),
      E('mb_list_shift', C.arrays, '%1 의 첫 번째 값 꺼내기', [V('LIST')]),
      E('mb_list_pop', C.arrays, '%1 의 마지막 값 꺼내기', [V('LIST')]),
      S('mb_list_insert', C.arrays, '%1 의 %2 번째에 %3 넣기', [V('LIST'), V('I'), V('VALUE')]),
      E('mb_list_index_of', C.arrays, '%1 에서 %2 의 위치', [V('LIST'), V('VALUE')], 'Number'),
      // 함수
      S('mb_fn_return', C.fn, '반환 %1', [V('VALUE')], { nextStatement: undefined }),
      // 시리얼 · 데이터 로거
      S('mb_serial_line', C.serial, '시리얼 출력 (한 줄) %1', [V('TEXT')], { tooltip: '콘솔에 한 줄 찍습니다 (MicroPython 의 print).' }),
      S('dl_set_columns', C.dl, '데이터 로거 열 이름 %1 시간 기록 %2', [{ type: 'field_input', name: 'COLS', text: 'time,steps' }, DD('TS', [['안 함', 'none'], ['초', 's'], ['밀리초', 'ms'], ['분', 'min']])], { tooltip: '열 이름은 쉼표로 나눠 씁니다.' }),
      S('dl_delete', C.dl, '데이터 로그 지우기')
    ]);

    // LED 출력 · 이미지 만들기 — 5×5 체크 칸
    const grid = (b) => { for (let r = 0; r < 5; r++) { const inp = b.appendDummyInput('R' + r); for (let c = 0; c < 5; c++) inp.appendField(new Bk.FieldCheckbox(false), 'L' + (r * 5 + c)); } };
    Bk.Blocks.mb_show_leds = {
      init() { this.appendDummyInput().appendField('LED 출력'); grid(this); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(C.basic); this.setTooltip('칸을 눌러 켤 LED 를 고릅니다.'); }
    };
    Bk.Blocks.mb_create_image = {
      init() { this.appendDummyInput().appendField('이미지 만들기'); grid(this); this.setOutput(true, 'Image'); this.setColour(C.images); }
    };

    // 회색 '파이썬' 블록 — 블록으로 바꿀 수 없는 코드를 그대로 담는다 (고치기는 파이썬 편집기에서)
    const rawLines = (b) => {
      for (let i = 0; b.getInput('C' + i); i++) b.removeInput('C' + i);
      String(b.code || '').split('\n').forEach((l, k) => b.appendDummyInput('C' + k).appendField(new Bk.FieldLabel(l.replace(/ /g, ' ') || ' ', 'bk-raw-line')));
    };
    Bk.Blocks.py_raw = {
      init() { this.code = ''; this.appendDummyInput('HEAD').appendField('파이썬'); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(C.py); this.setTooltip('블록으로 바꿀 수 없는 파이썬 코드입니다. 실행할 때는 그대로 쓰이고, MakeCode 로 보낼 때는 주석으로 남습니다.'); },
      saveExtraState() { return { code: this.code }; },
      loadExtraState(s) { this.code = s.code || ''; rawLines(this); }
    };
    Bk.Blocks.py_raw_expr = {
      init() { this.code = ''; this.appendDummyInput('HEAD').appendField('파이썬'); this.setOutput(true); this.setInputsInline(true); this.setColour(C.py); this.setTooltip('블록으로 바꿀 수 없는 파이썬 식입니다.'); },
      saveExtraState() { return { code: this.code }; },
      loadExtraState(s) { this.code = s.code || ''; this.getInput('HEAD').appendField(new Bk.FieldLabel(this.code, 'bk-raw-line')); }
    };

    // 데이터 기록 — 열 개수를 + / − 로 바꾼다 (MakeCode 의 log data 블록과 같음)
    const pm = (d) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><circle cx="10" cy="10" r="9" fill="#fff" fill-opacity=".85"/><path d="${d}" stroke="${C.dl}" stroke-width="2.5"/></svg>`);
    const PLUS = pm('M5 10h10M10 5v10'), MINUS = pm('M5 10h10');
    Bk.Blocks.dl_log = {
      init() { this.n = 0; this.appendDummyInput('HEAD').appendField('데이터 기록'); this.setPreviousStatement(true); this.setNextStatement(true); this.setColour(C.dl); this.setInputsInline(false); this.setN(1); },
      saveExtraState() { return { n: this.n }; },
      loadExtraState(s) { this.setN(s.n || 1); },
      setN(n) {
        if (this.getInput('PM')) this.removeInput('PM');
        while (this.n < n) { const i = this.n++; this.appendValueInput('VAL' + i).appendField('열').appendField(new Bk.FieldTextInput('열' + (i + 1)), 'COL' + i).appendField('값'); }
        while (this.n > n) { this.n--; this.removeInput('VAL' + this.n); }
        const row = this.appendDummyInput('PM');
        row.appendField(new Bk.FieldImage(PLUS, 20, 20, '+', () => this.setN(this.n + 1)));
        if (this.n > 1) row.appendField(new Bk.FieldImage(MINUS, 20, 20, '-', () => this.setN(this.n - 1)));
      }
    };

    // 함수 정의 · 호출 (MakeCode 의 함수 블록처럼 매개변수 · 반환 블록을 쓴다)
    const identOk = (t) => { t = String(t).trim().replace(/\s+/g, '_'); return t && /^[A-Za-z_가-힣][\w가-힣]*$/.test(t) ? t : null; };
    Bk.Blocks.mb_fn_def = {
      init() {
        this.appendDummyInput('HEAD').appendField('함수').appendField(new Bk.FieldTextInput('함수이름', identOk), 'NAME')
          .appendField('(').appendField(new Bk.FieldTextInput('', (t) => String(t).split(',').map((p) => p.trim()).filter(identOk).join(', ')), 'PARAMS').appendField(')');
        this.appendStatementInput('DO');
        this.setColour(C.fn);
        this.setTooltip('괄호 안에는 매개변수 이름을 쉼표로 나눠 씁니다 (예: x, y). 매개변수는 변수 블록으로 꺼내 씁니다.');
      }
    };
    const callBlock = (out) => ({
      init() {
        this.params = [];
        this.appendDummyInput('HEAD').appendField('호출').appendField(new Bk.FieldLabelSerializable('함수이름'), 'NAME');
        if (out) this.setOutput(true); else { this.setPreviousStatement(true); this.setNextStatement(true); }
        this.setInputsInline(true); this.setColour(C.fn);
      },
      saveExtraState() { return { name: this.getFieldValue('NAME'), params: this.params.slice() }; },
      loadExtraState(s) { this.setFieldValue(s.name || '함수이름', 'NAME'); this.setParams(s.params || []); },
      setParams(ps) {
        if (ps.join(',') === this.params.join(',') && ps.every((_, i) => this.getInput('ARG' + i))) return;
        const keep = this.params.map((_, i) => { const inp = this.getInput('ARG' + i); const t = inp && inp.connection.targetBlock(); if (t) inp.connection.disconnect(); return t; });
        this.params.forEach((_, i) => { if (this.getInput('ARG' + i)) this.removeInput('ARG' + i); });
        ps.forEach((p, i) => { const inp = this.appendValueInput('ARG' + i).appendField(p); if (keep[i] && keep[i].outputConnection) inp.connection.connect(keep[i].outputConnection); });
        keep.slice(ps.length).forEach((t) => t && t.dispose(true));
        this.params = ps.slice();
      }
    });
    Bk.Blocks.mb_fn_call = callBlock(false);
    Bk.Blocks.mb_fn_call_expr = callBlock(true);
  }
  const fnParams = (b) => String(b.getFieldValue('PARAMS') || '').split(',').map((p) => p.trim()).filter(Boolean);

  // MakeCode 색 테마 (기본 블록 · 변수 · 목록 등)
  function theme() {
    const st = (c) => ({ colourPrimary: c });
    return Blockly.Theme.defineTheme('mb-makecode', {
      base: Blockly.Themes.Classic,
      blockStyles: {
        logic_blocks: st(C.logic), loop_blocks: st(C.loops), math_blocks: st(C.math), text_blocks: st(C.text),
        list_blocks: st(C.arrays), variable_blocks: st(C.vars), variable_dynamic_blocks: st(C.vars), procedure_blocks: st(C.fn)
      },
      componentStyles: { workspaceBackgroundColour: '#f3f6f9', toolboxBackgroundColour: '#ffffff', flyoutBackgroundColour: '#e6ebf0', flyoutOpacity: 1, scrollbarColour: '#c4cbd3' }
    });
  }

  /* ── 도구 상자 (MakeCode 와 같은 분류 · 순서) ── */
  const sh = (type, fields) => ({ shadow: { type, fields } });
  const N = (v) => sh('math_number', { NUM: v });
  const T = (v) => sh('text', { TEXT: v });
  const tb = (type, inputs, extra) => Object.assign({ kind: 'block', type }, inputs ? { inputs } : null, extra);
  function toolbox() {
    const cat = (name, colour, contents) => ({ kind: 'category', name, colour, contents });
    return {
      kind: 'categoryToolbox',
      contents: [
        cat('기본', C.basic, [tb('mb_on_start'), tb('mb_forever'), tb('mb_show_number', { NUM: N(0) }), tb('mb_show_string', { TEXT: T('Hello!') }),
          tb('mb_show_icon'), tb('mb_show_leds'), tb('mb_show_arrow'), tb('mb_clear'), tb('mb_pause', { MS: N(100) })]),
        cat('입력', C.input, [tb('mb_on_button'), tb('mb_on_gesture'), tb('mb_on_logo'), tb('mb_button_pressed'), tb('mb_logo_pressed'), tb('mb_is_gesture'),
          tb('mb_accel'), tb('mb_compass'), tb('mb_calibrate'), tb('mb_magnetic'), tb('mb_running_time'), tb('mb_temperature'), tb('mb_light'), tb('mb_sound')]),
        cat('음악', C.music, [tb('mb_play_tone', { FREQ: N(262), MS: N(500) }), tb('mb_play_melody', { BPM: N(120) })]),
        cat('LED', C.led, [tb('mb_plot', { X: N(0), Y: N(0) }), tb('mb_unplot', { X: N(0), Y: N(0) }), tb('mb_plot_brightness', { X: N(0), Y: N(0), B: N(255) }), tb('mb_point', { X: N(0), Y: N(0) })]),
        cat('반복', C.loops, [tb('controls_repeat_ext', { TIMES: N(4) }), tb('controls_whileUntil', { BOOL: sh('logic_boolean', { BOOL: 'TRUE' }) }),
          tb('mb_for_index', { TO: N(4) }), tb('controls_forEach'), tb('controls_flow_statements')]),
        cat('논리', C.logic, [tb('controls_if'), tb('controls_if', null, { extraState: { hasElse: true } }), tb('logic_compare', { A: N(0), B: N(0) }),
          tb('logic_operation'), tb('logic_negate'), tb('logic_boolean')]),
        { kind: 'category', name: '변수', colour: C.vars, custom: 'VARIABLE' },
        cat('계산', C.math, [tb('math_number'), tb('math_arithmetic', { A: N(0), B: N(0) }), tb('math_modulo', { DIVIDEND: N(0), DIVISOR: N(1) }),
          tb('mb_math_fn2', { A: N(0), B: N(0) }), tb('mb_math_fn1', { X: N(0) }), tb('mb_random', { A: N(0), B: N(10) }), tb('mb_pi')]),
        { kind: 'category', name: '함수', colour: C.fn, custom: 'MB_FUNCTIONS' },
        cat('배열', C.arrays, [tb('lists_create_with', { ADD0: N(1), ADD1: N(2) }, { extraState: { itemCount: 2 } }), tb('lists_create_with', null, { extraState: { itemCount: 0 } }),
          tb('mb_list_get', { I: N(0) }), tb('mb_list_set', { I: N(0) }), tb('mb_list_length'), tb('mb_list_push'), tb('mb_list_remove_first'), tb('mb_list_remove_last'),
          tb('mb_list_remove_at', { I: N(0) }), tb('mb_list_shift'), tb('mb_list_pop'), tb('mb_list_insert', { I: N(0) }), tb('mb_list_index_of')]),
        cat('텍스트', C.text, [tb('text'), tb('text_join', { ADD0: T('Hello'), ADD1: T('World') }, { extraState: { itemCount: 2 } }), tb('mb_text_length', { TEXT: T('Hello') }),
          tb('mb_to_text', { X: N(0) }), tb('mb_text_index_of', { TEXT: T('Hello'), SUB: T('l') }), tb('mb_text_char_at', { TEXT: T('Hello'), I: N(0) }),
          tb('mb_text_includes', { TEXT: T('Hello'), SUB: T('ell') }), tb('mb_parse_number', { TEXT: T('123') })]),
        { kind: 'sep' },
        cat('이미지', C.images, [tb('mb_show_image'), tb('mb_create_image'), tb('mb_icon_image'), tb('mb_arrow_image')]),
        cat('시리얼', C.serial, [tb('mb_serial_line', { TEXT: T('Hello') })]),
        cat('데이터 로거', C.dl, [tb('dl_set_columns'), tb('dl_log'), tb('dl_delete')])
      ]
    };
  }
  function functionsFlyout(ws) {
    const list = [{ kind: 'label', text: '함수를 만들고 호출합니다' }, tb('mb_fn_def'), tb('mb_fn_return')];
    ws.getBlocksByType('mb_fn_def', false).forEach((d) => {
      const st = { name: d.getFieldValue('NAME'), params: fnParams(d) };
      list.push(tb('mb_fn_call', null, { extraState: st }), tb('mb_fn_call_expr', null, { extraState: st }));
    });
    return list;
  }
