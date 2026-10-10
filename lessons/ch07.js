/* Chapter 07. 가상 공간 설계와 경로 기록 */
(function () {
  /* ───────── 지도 (JS 그림과 파이썬 코드에서 같이 씀) ───────── */
  // # 벽 · . 바닥 · D 문 · P 기둥 · S 시작점 · G 목표 · B 칠판 앞 · W 창가
  const ROOM_CLASS = [
    '##########',
    '#...G....#',
    '#........#',
    '#..P.....#',
    '#........#',
    '#........#',
    '#S.......D',
    '##########'
  ];
  const ROOM_ROUTE = [
    '##########',
    '#...BB...#',
    '#W.......#',
    '#W..P....#',
    '#W.......#',
    '#.......SD',
    '##########'
  ];
  const ROOM_HALL = [
    '#########D##########',
    '#S.................#',
    '#....P.......P.....#',
    '#.................G#',
    '####################'
  ];
  const ROOM_LIB = [
    '############',
    '#S.........#',
    '#.##.##.##.#',
    '#.##.##.##.#',
    '#..........#',
    '#...G..P...#',
    '#####D######'
  ];
  const pyList = (name, rows) => name + ' = [\n' + rows.map(r => '    "' + r + '",').join('\n') + '\n]\n';

  /* ───────── 공통 파이썬 조각 (준비된 함수) ───────── */
  const PY_MOVE = `def move(x, y, heading, stride):
    # 준비된 함수: heading 방향으로 stride 만큼 한 칸 밀기 -> 새 위치 (ch06)
    rad = math.radians(heading)
    return x + stride * math.sin(rad), y + stride * math.cos(rad)
`;
  const PY_STRENGTH = `def strength():
    # 준비된 함수: 흔들림 세기 (ch02)
    x, y, z = accelerometer.get_values()
    return int(math.sqrt(x * x + y * y + z * z))
`;
  const PY_SMOOTH = `recent = []

def smooth(value):
    # 준비된 함수: 최근 4개 값의 평균 (ch03)
    recent.append(value)
    if len(recent) > 4:
        recent.pop(0)
    return sum(recent) // len(recent)
`;
  const PY_STEP = `above = False
last_step = 0

def is_step(value):
    # 준비된 함수: 걸음이면 True (ch03)
    global above, last_step
    if value > THRESHOLD:
        above = True
        return False
    if above:
        above = False
        now = running_time()
        if now - last_step >= MIN_GAP:
            last_step = now
            return True
    return False
`;
  const PY_STEP_KIT = `THRESHOLD = 1150   # 기준선 (ch03 에서 정한 우리 모둠 값)
MIN_GAP = 300      # 걸음 사이 최소 간격 (ms)

` + PY_STRENGTH + `
` + PY_SMOOTH + `
` + PY_STEP;

  const PY_FIND = `def find(ch):
    # 준비된 함수: 지도에서 글자 ch 가 있는 칸 (열, 줄)
    for r in range(len(ROOM)):
        c = ROOM[r].find(ch)
        if c >= 0:
            return c, r
    return None
`;
  const PY_CELL = `def cell(c, r):
    # 준비된 함수: (열, 줄) 칸의 글자 — 지도 밖은 벽으로 봄
    if 0 <= r < len(ROOM) and 0 <= c < len(ROOM[r]):
        return ROOM[r][c]
    return "#"
`;
  const PY_WALK_KIT = `LIGHT = {"#": 3, "P": 3, "D": 6, "G": 6, "B": 6, "W": 6}   # LED 밝기

def tile_at(x, y):
    # 준비된 함수: 위치 (x, y) cm 가 놓인 칸의 글자
    return cell(SC + round(x / CELL), SR - round(y / CELL))

def try_move(x, y, heading, stride):
    # 준비된 함수: 한 걸음 가 보고, 벽 · 기둥이면 제자리
    nx, ny = move(x, y, heading, stride)
    if tile_at(nx, ny) in "#P":
        return x, y, False
    return nx, ny, True

def show_room(x, y):
    # 준비된 함수: 사람 둘레 5x5 칸을 LED 에 (벽 흐리게 · 사람 밝게)
    pc = SC + round(x / CELL)
    pr = SR - round(y / CELL)
    for i in range(5):
        for j in range(5):
            t = cell(pc + i - 2, pr + j - 2)
            display.set_pixel(i, j, LIGHT.get(t, 0))
    display.set_pixel(2, 2, 9)
`;
  // 지도 걷기 준비물 한 묶음
  const PY_MAP_KIT = PY_FIND + `
` + PY_CELL + `
` + PY_WALK_KIT;

  /* ───────── 지도 그리기 도우미 (SVG) ───────── */
  const drawMap = (rows, x0, y0, s) => {
    let out = '';
    rows.forEach((row, r) => {
      row.split('').forEach((ch, c) => {
        const x = x0 + c * s, y = y0 + r * s, cx = x + s / 2, cy = y + s / 2;
        out += `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="none" stroke="var(--line)" stroke-width="1"/>`;
        if (ch === '#') out += `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="var(--fg)" opacity="0.7"/>`;
        else if (ch === 'P') out += `<rect x="${x + 4}" y="${y + 4}" width="${s - 8}" height="${s - 8}" rx="3" fill="var(--muted)"/>`;
        else if (ch === 'D') out += `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="var(--warn)"/>`;
        else if (ch === 'S') out += `<circle cx="${cx}" cy="${cy}" r="${s * 0.32}" fill="var(--ok)"/>`;
        else if (ch === 'G') out += `<path d="M${cx} ${y + 4} L${x + s - 4} ${cy} L${cx} ${y + s - 4} L${x + 4} ${cy} Z" fill="var(--danger)"/>`;
        else if (ch === 'B') out += `<rect x="${x + 3}" y="${y + 3}" width="${s - 6}" height="${s - 6}" fill="var(--accent)" opacity="0.6"/>`;
        else if (ch === 'W') out += `<rect x="${x + 3}" y="${y + 3}" width="${s - 6}" height="${s - 6}" fill="var(--accent2)" opacity="0.6"/>`;
      });
    });
    return out;
  };
  const northArrow = (x, y, id) => `<path d="M${x} ${y + 60} L${x} ${y}" stroke="var(--fg)" stroke-width="4" marker-end="url(#${id})"/><text x="${x}" y="${y - 10}" text-anchor="middle" font-size="22" font-weight="bold" fill="var(--fg)">N</text>`;
  const arrowDef = (id, color) => `<marker id="${id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0 L10 5 L0 10 Z" fill="${color}"/></marker>`;

  /* ───────── 그림 7-1. 위에서 내려다본 교실 도면 ───────── */
  const FIG_PLAN = `<svg viewBox="0 0 1280 400" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <defs>${arrowDef('c7pa', 'var(--fg)')}</defs>
  ${drawMap(ROOM_CLASS, 60, 40, 38)}
  <text x="212" y="78" font-size="16" fill="var(--danger)">칠판 앞</text>
  <text x="132" y="290" font-size="16" fill="var(--ok)">시작</text>
  <text x="402" y="300" font-size="16" fill="var(--warn)">문</text>
  <text x="170" y="178" font-size="16" fill="var(--muted)">기둥</text>
  <path d="M60 370 L98 370 M60 362 L60 378 M98 362 L98 378" stroke="var(--fg)" stroke-width="3"/>
  <text x="110" y="377" font-size="18" fill="var(--fg)">1칸 = 1m (축척)</text>
  ${northArrow(500, 70, 'c7pa')}
  <text x="500" y="160" text-anchor="middle" font-size="17" fill="var(--muted)">북쪽 표시</text>
  <rect x="640" y="40" width="600" height="320" rx="14" fill="var(--code-bg)" stroke="var(--accent)" stroke-width="3"/>
  <text x="940" y="80" text-anchor="middle" font-size="23" font-weight="bold" fill="var(--accent)">도면에 꼭 넣을 것</text>
  <text x="670" y="125" font-size="20" fill="var(--fg)">① 벽 — 지나갈 수 없는 곳 (진한 칸)</text>
  <text x="670" y="160" font-size="20" fill="var(--fg)">② 문 — 드나드는 곳 (주황 칸)</text>
  <text x="670" y="195" font-size="20" fill="var(--fg)">③ 기둥 · 큰 가구 — 피해 가야 할 곳</text>
  <text x="670" y="230" font-size="20" fill="var(--fg)">④ 시작점 — 위치 (0, 0) 이 되는 곳</text>
  <text x="670" y="265" font-size="20" fill="var(--fg)">⑤ 목표 지점 — 가려는 곳</text>
  <text x="670" y="300" font-size="20" fill="var(--fg)">⑥ 축척 (1칸 = 몇 m) · ⑦ 북쪽 방향</text>
  <text x="670" y="338" font-size="17" fill="var(--muted)">책상 하나하나는 빼도 됩니다 — 길을 막는 것만</text>
</svg>`;

  /* ───────── 그림 7-2. 공간 설계 도구 화면 ───────── */
  const FIG_TOOL = (() => {
    const tools = ['벽', '문', '방', '기둥', '목표', '시작점', '지우개'];
    const pal = tools.map((t, i) => `<rect x="30" y="${84 + i * 42}" width="130" height="34" rx="8" fill="${i === 0 ? 'var(--accent)' : 'var(--code-bg)'}" stroke="var(--line)" stroke-width="2"/>
  <text x="95" y="${107 + i * 42}" text-anchor="middle" font-size="18" fill="${i === 0 ? '#fff' : 'var(--fg)'}">${t}</text>`).join('');
    const btn = (x, w, t) => `<rect x="${x}" y="22" width="${w}" height="38" rx="8" fill="var(--code-bg)" stroke="var(--line)" stroke-width="2"/><text x="${x + w / 2}" y="48" text-anchor="middle" font-size="17" fill="var(--fg)">${t}</text>`;
    return `<svg viewBox="0 0 1280 400" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  ${btn(30, 190, '예제 불러오기 ▾')}${btn(230, 90, '저장')}${btn(330, 110, '불러오기')}${btn(450, 150, '북쪽 ↻ 0°')}
  ${pal}
  ${drawMap(ROOM_CLASS, 200, 84, 36)}
  <text x="380" y="388" text-anchor="middle" font-size="17" fill="var(--muted)">격자 한 칸 = 1m · 칸을 눌러 그리고, 끌어서 길게</text>
  <circle cx="254" cy="318" r="16" fill="none" stroke="var(--ok)" stroke-width="4"/>
  <path d="M254 318 L290 318" stroke="var(--ok)" stroke-width="4"/>
  <text x="300" y="342" font-size="16" fill="var(--ok)">가상의 사람</text>
  <path d="M640 30 L640 380" stroke="var(--line)" stroke-width="2"/>
  <circle cx="800" cy="210" r="100" fill="var(--code-bg)" stroke="var(--line)" stroke-width="3"/>
  <circle cx="800" cy="170" r="34" fill="var(--accent)"/>
  <text x="800" y="96" text-anchor="middle" font-size="17" fill="var(--muted)">움직임 조이스틱</text>
  <text x="940" y="130" font-size="20" fill="var(--fg)">가운데 (손 뗌) → 멈춤</text>
  <text x="940" y="170" font-size="20" fill="var(--fg)">위로 살짝 → 걷기</text>
  <text x="940" y="210" font-size="20" fill="var(--fg)">위로 끝까지 → 뛰기</text>
  <text x="940" y="250" font-size="20" fill="var(--fg)">옆으로 → 방향 전환</text>
  <text x="940" y="300" font-size="20" font-weight="bold" fill="var(--danger)">벽 · 기둥에 닿으면 멈춤</text>
</svg>`;
  })();

  /* ───────── 그림 7-3. 도면의 위쪽과 실제 북쪽 ───────── */
  const FIG_NORTH = `<svg viewBox="0 0 1280 400" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <defs>${arrowDef('c7na', 'var(--fg)')}${arrowDef('c7nb', 'var(--accent)')}</defs>
  <text x="220" y="40" text-anchor="middle" font-size="23" font-weight="bold" fill="var(--fg)">① 종이 위의 도면</text>
  <rect x="100" y="110" width="240" height="180" fill="none" stroke="var(--fg)" stroke-width="5"/>
  <rect x="160" y="110" width="120" height="14" fill="var(--accent)"/>
  <text x="220" y="150" text-anchor="middle" font-size="17" fill="var(--accent)">칠판</text>
  <path d="M220 270 L220 180" stroke="var(--accent)" stroke-width="4" marker-end="url(#c7nb)"/>
  <text x="220" y="330" text-anchor="middle" font-size="19" fill="var(--accent)">도면 위쪽 = 칠판 쪽</text>
  <path d="M460 30 L460 380" stroke="var(--line)" stroke-width="2"/>
  <text x="700" y="40" text-anchor="middle" font-size="23" font-weight="bold" fill="var(--fg)">② 실제 교실</text>
  <g transform="rotate(30 700 210)">
    <rect x="580" y="120" width="240" height="180" fill="none" stroke="var(--fg)" stroke-width="5"/>
    <rect x="640" y="120" width="120" height="14" fill="var(--accent)"/>
    <path d="M700 270 L700 180" stroke="var(--accent)" stroke-width="4" marker-end="url(#c7nb)"/>
  </g>
  ${northArrow(560, 80, 'c7na')}
  <text x="560" y="170" text-anchor="middle" font-size="16" fill="var(--muted)">실제 북쪽</text>
  <text x="700" y="375" text-anchor="middle" font-size="19" fill="var(--fg)">칠판 쪽을 보면 나침반 = 30°</text>
  <rect x="900" y="80" width="340" height="250" rx="14" fill="var(--code-bg)" stroke="var(--accent)" stroke-width="3"/>
  <text x="1070" y="120" text-anchor="middle" font-size="22" font-weight="bold" fill="var(--accent)">맞추는 방법</text>
  <text x="925" y="165" font-size="19" fill="var(--fg)">1. 도면 위쪽을 바라보고</text>
  <text x="925" y="198" font-size="19" fill="var(--fg)">2. 나침반 값을 읽어 적기</text>
  <text x="925" y="231" font-size="19" font-family="monospace" fill="var(--fg)">   MAP_UP = 30</text>
  <text x="925" y="270" font-size="19" fill="var(--fg)">3. 도면 방위 =</text>
  <text x="925" y="303" font-size="18" font-family="monospace" fill="var(--fg)">(나침반 − MAP_UP) % 360</text>
</svg>`;

  /* ───────── 그림 7-4. 공간 속 이동 → 센서값 → 프로그램 ───────── */
  const FIG_FLOW = (() => {
    const box = (x, w, t1, t2, t3, c) => `<rect x="${x}" y="70" width="${w}" height="150" rx="14" fill="var(--code-bg)" stroke="${c}" stroke-width="3"/>
  <text x="${x + w / 2}" y="108" text-anchor="middle" font-size="20" font-weight="bold" fill="${c}">${t1}</text>
  <text x="${x + w / 2}" y="148" text-anchor="middle" font-size="17" fill="var(--fg)">${t2}</text>
  <text x="${x + w / 2}" y="178" text-anchor="middle" font-size="17" fill="var(--fg)">${t3}</text>`;
    const ar = (x) => `<path d="M${x} 145 L${x + 34} 145" stroke="var(--fg)" stroke-width="3" marker-end="url(#c7fa)"/>`;
    return `<svg viewBox="0 0 1280 400" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <defs>${arrowDef('c7fa', 'var(--fg)')}</defs>
  <text x="40" y="40" font-size="22" font-weight="bold" fill="var(--fg)">시뮬레이터 안에서 일어나는 일</text>
  ${box(30, 200, '① 조이스틱', '걷기 · 뛰기', '방향 전환', 'var(--accent)')}${ar(236)}
  ${box(276, 220, '② 가상의 사람', '공간 속 위치 이동', '벽이면 멈춤', 'var(--ok)')}${ar(502)}
  ${box(542, 220, '③ 보드 센서값', '가속도: 출렁임', '방위: 몸의 방향', 'var(--warn)')}${ar(768)}
  ${box(808, 220, '④ 우리 프로그램', 'is_step(...)', 'compass.heading()', 'var(--accent2)')}${ar(1034)}
  ${box(1074, 180, '⑤ 계산한 위치', 'LED 지도', '경로 기록', 'var(--danger)')}
  <rect x="276" y="260" width="750" height="110" rx="12" fill="none" stroke="var(--line)" stroke-width="2" stroke-dasharray="8 6"/>
  <text x="651" y="300" text-anchor="middle" font-size="19" fill="var(--fg)">프로그램은 ②의 진짜 위치를 <tspan font-weight="bold">모릅니다</tspan> — ③ 센서값만 받습니다</text>
  <text x="651" y="340" text-anchor="middle" font-size="18" fill="var(--muted)">실제 보드를 몸에 달고 걸을 때와 똑같은 조건</text>
</svg>`;
  })();

  /* ───────── 그림 7-5. 한 줄에 담을 다섯 가지 값 ───────── */
  const FIG_ROW = (() => {
    const cols = [['time', '12.5', '시간 (초)'], ['steps', '20', '걸음 수'], ['heading', '90', '방위각 (°)'], ['x', '1300', '동쪽 (cm)'], ['y', '0', '북쪽 (cm)']];
    const cells = cols.map(([h, v, k], i) => {
      const x = 40 + i * 130;
      return `<rect x="${x}" y="80" width="130" height="50" fill="var(--accent)" opacity="0.85" stroke="var(--line)"/>
  <text x="${x + 65}" y="112" text-anchor="middle" font-size="19" font-weight="bold" font-family="monospace" fill="#fff">${h}</text>
  <rect x="${x}" y="130" width="130" height="50" fill="var(--code-bg)" stroke="var(--line)"/>
  <text x="${x + 65}" y="162" text-anchor="middle" font-size="20" font-family="monospace" fill="var(--fg)">${v}</text>
  <text x="${x + 65}" y="215" text-anchor="middle" font-size="17" fill="var(--muted)">${k}</text>`;
    }).join('');
    let dots = '';
    for (let i = 0; i <= 12; i++) {
      const x = 840 + Math.min(i, 8) * 40, y = 320 - Math.max(0, i - 8) * 40;
      dots += `<circle cx="${x}" cy="${y}" r="${i === 8 ? 11 : 6}" fill="${i === 8 ? 'var(--danger)' : 'var(--fg)'}"/>`;
    }
    return `<svg viewBox="0 0 1280 400" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <text x="40" y="50" font-size="22" font-weight="bold" fill="var(--fg)">기록 한 줄 = 그 순간의 사진 한 장</text>
  ${cells}
  <text x="40" y="275" font-size="19" fill="var(--fg)">x · y 만 있으면 점을 찍을 수 있고,</text>
  <text x="40" y="308" font-size="19" fill="var(--fg)">time · steps · heading 은 “왜 거기 있었는지” 를 알려 줍니다.</text>
  <text x="40" y="350" font-size="18" fill="var(--muted)">CSV 로 쓰면: 12.5,20,90,1300,0</text>
  ${dots}
  <text x="840" y="360" font-size="17" fill="var(--muted)">출발 (0, 0)</text>
  <text x="1170" y="300" font-size="17" fill="var(--danger)">이 한 줄</text>
  <text x="1160" y="150" font-size="17" fill="var(--muted)">걸음마다 한 점</text>
</svg>`;
  })();

  /* ───────── 그림 7-6. 걸음마다 저장 vs 1초마다 저장 ───────── */
  const FIG_WHEN = (() => {
    const x0 = 230, w = 900;         // 60초 = 900px
    let a = '', b = '';
    for (let t = 0; t < 60; t += 0.5) {
      const walking = t < 20 || t >= 40;
      if (walking) a += `<path d="M${x0 + t * 15} 120 L${x0 + t * 15} 160" stroke="var(--accent)" stroke-width="2"/>`;
    }
    for (let t = 0; t < 60; t += 1) b += `<path d="M${x0 + t * 15} 230 L${x0 + t * 15} 270" stroke="var(--warn)" stroke-width="2"/>`;
    return `<svg viewBox="0 0 1280 400" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <rect x="${x0}" y="50" width="300" height="34" fill="var(--ok)" opacity="0.25"/>
  <rect x="${x0 + 300}" y="50" width="300" height="34" fill="var(--muted)" opacity="0.25"/>
  <rect x="${x0 + 600}" y="50" width="300" height="34" fill="var(--ok)" opacity="0.25"/>
  <text x="${x0 + 150}" y="74" text-anchor="middle" font-size="18" fill="var(--fg)">걷기 20초</text>
  <text x="${x0 + 450}" y="74" text-anchor="middle" font-size="18" fill="var(--fg)">멈춤 20초</text>
  <text x="${x0 + 750}" y="74" text-anchor="middle" font-size="18" fill="var(--fg)">걷기 20초</text>
  <text x="40" y="148" font-size="20" font-weight="bold" fill="var(--accent)">걸음마다</text>
  ${a}
  <text x="${x0 + 450}" y="148" text-anchor="middle" font-size="17" fill="var(--muted)">(기록 없음)</text>
  <text x="1150" y="148" font-size="18" fill="var(--accent)">80줄</text>
  <text x="40" y="258" font-size="20" font-weight="bold" fill="var(--warn)">1초마다</text>
  ${b}
  <text x="1150" y="258" font-size="18" fill="var(--warn)">60줄</text>
  <path d="M${x0} 300 L${x0 + w} 300" stroke="var(--fg)" stroke-width="2"/>
  <text x="${x0}" y="325" text-anchor="middle" font-size="16" fill="var(--muted)">0초</text>
  <text x="${x0 + w}" y="325" text-anchor="middle" font-size="16" fill="var(--muted)">60초</text>
  <text x="640" y="370" text-anchor="middle" font-size="19" fill="var(--fg)">걸음마다: 움직일 때만 자세히 · 1초마다: 멈춘 시간도 고르게 (1초에 2걸음일 때)</text>
</svg>`;
  })();

  /* ───────── 그림 7-7. 기록 흐름 버튼 ───────── */
  const FIG_BTN = (() => {
    const st = (x, t1, t2, c) => `<rect x="${x}" y="110" width="250" height="110" rx="16" fill="var(--code-bg)" stroke="${c}" stroke-width="3"/>
  <text x="${x + 125}" y="155" text-anchor="middle" font-size="22" font-weight="bold" fill="${c}">${t1}</text>
  <text x="${x + 125}" y="192" text-anchor="middle" font-size="17" fill="var(--muted)">${t2}</text>`;
    return `<svg viewBox="0 0 1280 400" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <defs>${arrowDef('c7ba', 'var(--fg)')}</defs>
  ${st(40, '기다림', 'LED 에 “A”', 'var(--muted)')}
  ${st(515, '기록 중', '걸음마다 한 줄 저장', 'var(--accent)')}
  ${st(990, '기록 끝', 'LED 에 ✓', 'var(--ok)')}
  <path d="M290 165 L507 165" stroke="var(--fg)" stroke-width="3" marker-end="url(#c7ba)"/>
  <text x="398" y="150" text-anchor="middle" font-size="20" font-weight="bold" fill="var(--fg)">A 출발</text>
  <text x="398" y="200" text-anchor="middle" font-size="16" fill="var(--muted)">위치 (0, 0)</text>
  <text x="398" y="222" text-anchor="middle" font-size="16" fill="var(--muted)">처음 방향 기억</text>
  <path d="M765 165 L982 165" stroke="var(--fg)" stroke-width="3" marker-end="url(#c7ba)"/>
  <text x="873" y="150" text-anchor="middle" font-size="20" font-weight="bold" fill="var(--fg)">B 도착</text>
  <text x="873" y="200" text-anchor="middle" font-size="16" fill="var(--muted)">기록 멈춤</text>
  <path d="M590 220 C560 320 760 320 700 228" fill="none" stroke="var(--warn)" stroke-width="3" marker-end="url(#c7ba)"/>
  <text x="640" y="335" text-anchor="middle" font-size="19" font-weight="bold" fill="var(--warn)">로고 터치 → 지금 위치 보여 주기</text>
  <text x="640" y="365" text-anchor="middle" font-size="16" fill="var(--muted)">(기록은 계속)</text>
  <path d="M1115 220 L1115 280 L165 280 L165 228" fill="none" stroke="var(--muted)" stroke-width="2" stroke-dasharray="7 6" marker-end="url(#c7ba)"/>
  <text x="165" y="305" font-size="16" fill="var(--muted)">다시 A → 새 기록</text>
</svg>`;
  })();

  /* ───────── 그림 7-8. 실습 경로 (문 → 칠판 → 창가) ───────── */
  const FIG_ROUTE = (() => {
    const s = 44, x0 = 60, y0 = 50;
    const c = (col, row) => `${x0 + col * s + s / 2} ${y0 + row * s + s / 2}`;
    return `<svg viewBox="0 0 1280 400" xmlns="http://www.w3.org/2000/svg" font-family="sans-serif">
  <defs>${arrowDef('c7ra', 'var(--danger)')}</defs>
  ${drawMap(ROOM_ROUTE, x0, y0, s)}
  <path d="M${c(8, 5)} L${c(8, 1)} L${c(5, 1)}" fill="none" stroke="var(--danger)" stroke-width="5" marker-end="url(#c7ra)"/>
  <path d="M${c(5, 1)} L${c(2, 1)} L${c(2, 3)} L${c(1, 3)}" fill="none" stroke="var(--danger)" stroke-width="5" stroke-dasharray="10 6" marker-end="url(#c7ra)"/>
  <text x="${x0 + 9 * s + s + 8}" y="${y0 + 5 * s + 30}" font-size="18" fill="var(--warn)">문</text>
  <text x="${x0 + 4 * s}" y="${y0 - 10}" font-size="18" fill="var(--accent)">칠판 앞 (B)</text>
  <text x="${x0 - 50}" y="${y0 + 3 * s + 30}" font-size="18" fill="var(--accent2)">창가</text>
  <rect x="580" y="50" width="660" height="290" rx="14" fill="var(--code-bg)" stroke="var(--accent)" stroke-width="3"/>
  <text x="910" y="92" text-anchor="middle" font-size="23" font-weight="bold" fill="var(--accent)">오늘의 경로 (1칸 = 1m)</text>
  <text x="610" y="140" font-size="20" fill="var(--fg)">① 문 옆 시작점(S)에서 칠판 쪽(도면 위)을 보고 A</text>
  <text x="610" y="180" font-size="20" fill="var(--fg)">② 북쪽 4m → 서쪽 3m : 칠판 앞 도착</text>
  <text x="610" y="220" font-size="20" fill="var(--fg)">③ 서쪽 3m → 남쪽 2m → 서쪽 1m : 창가 도착</text>
  <text x="610" y="260" font-size="20" fill="var(--fg)">④ B 로 기록 끝 → 📊 로그 탭 확인</text>
  <text x="610" y="310" font-size="18" fill="var(--muted)">기둥(P)은 피해서 · 보폭 65cm 면 약 20걸음</text>
</svg>`;
  })();

  MB_COURSE.addChapter({
    id: 'ch07', no: '07',
    title: '가상 공간 설계와 경로 기록',
    subtitle: '도면 · 축척 · 시작점 · 북쪽 맞추기 · 벽 검사 · 경로 저장 · log · path.csv · 메모리 어림',
    summary: '이번 챕터에서는 위치를 계산하는 데서 한 걸음 더 나아가, 위치가 놓일 <b>공간</b>을 만듭니다. 1교시에는 <b>2차원 공간 설계 도구</b>로 교실 · 복도 · 도서관 같은 가상 공간을 축척(1칸 = 1m)에 맞춰 그리고, 시작점과 북쪽 방향을 정한 뒤 가상의 사람을 조이스틱으로 걷게 합니다. 같은 공간을 파이썬의 <b>문자 지도</b>로 옮겨, 벽에 부딪히면 멈추는 위치 추적기도 만듭니다. 2교시에는 걸어간 길을 나중에 다시 그릴 수 있도록 <b>무엇을 · 언제 · 어디에</b> 저장할지 정하고, <code>log</code> 모듈과 <code>path.csv</code> 파일로 경로를 기록하는 <b>경로 기록기</b>를 완성합니다.',
    goals: [
      '위에서 내려다본 도면에 꼭 들어가야 할 것(벽 · 문 · 기둥 · 시작점 · 목표 · 축척 · 북쪽)을 말하고 공간 설계 도구로 그릴 수 있다',
      '도면의 위쪽과 실제 북쪽이 다를 때 <code>MAP_UP</code> 값으로 방향을 맞출 수 있다',
      '공간을 파이썬 문자 지도로 옮기고, 준비된 함수 <code>try_move()</code> · <code>show_room()</code> 으로 벽에서 멈추는 이동을 만들 수 있다',
      '경로 기록에 필요한 값(시간 · 걸음 수 · 방위각 · x · y)과 저장 시점(걸음마다 / 1초마다)의 장단점을 설명할 수 있다',
      '<code>log</code> 모듈 또는 <code>open()</code> 으로 경로를 저장하고, A 출발 · B 도착 · 로고 위치 표시가 있는 <b>경로 기록기</b>를 만들 수 있다',
      '한 줄 크기 × 줄 수로 기록할 수 있는 시간을 어림하고, 실제 공간 측정 · 실험 계획의 문제를 토론할 수 있다'
    ],
    sections: [
      /* ═══════════════════════ 1교시 ═══════════════════════ */
      {
        id: 'ch07-1',
        title: '2차원 공간 설계하기',
        minutes: 50,
        goals: [
          '도면에 꼭 넣을 것과 축척(1칸 = 1m)의 뜻을 말하고, 공간 설계 도구로 벽 · 문 · 기둥 · 목표를 그릴 수 있다',
          '시작점과 북쪽 방향을 정하고, 도면 위쪽과 실제 북쪽의 차이를 <code>MAP_UP</code> 으로 맞출 수 있다',
          '공간을 문자 지도로 옮겨 저장 · 불러오기 하고, 가상의 사람을 걷게 해 벽에서 멈추는 모습을 확인할 수 있다',
          '공간 속 이동이 센서값으로 바뀌어 프로그램에 전달되는 흐름을 설명하고, 실제 공간을 잴 때의 문제를 토론할 수 있다'
        ],
        flow: [['생각하기 나누기', 5], ['도면에 꼭 넣을 것 · 축척', 8], ['공간 설계 도구 사용법', 8], ['시작점과 북쪽 맞추기', 7], ['예제 공간 · 저장 · 불러오기', 5], ['가상의 사람 걷게 하기', 9], ['토론: 실제 공간 재기', 6], ['정리', 2]],
        content: [
          { type: 'callout', kind: 'info', title: '생각하기 (수업 전)', html: '<b>우리 학교 복도와 교실을 위에서 내려다본 지도로 그린다면, 무엇을 꼭 넣어야 할까요?</b> 새처럼 천장 위에서 내려다본다고 상상하고, 공책에 교실 하나를 네모로 그려 오세요. 그리고 “이것이 없으면 길을 잃는다” 싶은 것 다섯 가지에 동그라미를 칩니다.' },
          { type: 'p', html: '그려 온 지도를 모아 보면 사람마다 넣은 것이 조금씩 다릅니다. 어떤 친구는 책상을 하나하나 다 그렸고, 어떤 친구는 문과 창문만 그렸을 것입니다. 그런데 <b>길 찾기</b>에 꼭 필요한 것은 생각보다 적습니다. “지나갈 수 없는 곳(벽 · 기둥)”, “드나드는 곳(문)”, “어디서 출발했나(시작점)”, “어디로 가나(목표)”, 그리고 “얼마나 크고 어느 쪽이 북쪽인가(축척 · 방향)”입니다.' },
          { type: 'callout', kind: 'tip', title: '단계별 개발 — 오늘은 어디쯤?', html: '실내 이동 경로 추적 프로젝트의 두 번째 시간입니다. 문제 정하기 → 잴 것 정하기 → 센서 읽기 → 계산하기(ch06) → <b>공간 만들기 · 저장하기</b>(오늘) → 보여 주기 → 고치기. ch06 에서는 빈 운동장 같은 곳에서 위치만 계산했다면, 오늘은 <b>벽과 문이 있는 진짜 같은 공간</b>을 만들고, 그 안에서 걸은 길을 <b>저장</b>합니다.' },

          { type: 'h', text: '도면 — 위에서 내려다본 지도' },
          { type: 'p', html: '건물을 바로 위에서 내려다보고 그린 그림을 <b>도면(floor plan)</b>이라고 합니다. 도면에서는 높이를 생각하지 않고, 바닥에 무엇이 어디 있는지만 그립니다. 그래서 의자 · 책상처럼 쉽게 옮기는 것은 빼고, <b>길을 막거나 길을 알려 주는 것</b>만 넣습니다.' },
          { type: 'figure', html: FIG_PLAN, caption: '그림 7-1. 위에서 내려다본 교실 도면 — 꼭 넣을 일곱 가지' },
          { type: 'p', html: '도면을 <b>모눈(격자)</b> 위에 그리면 계산이 쉬워집니다. 모눈 한 칸이 실제로 몇 m 인지를 <b>축척(scale)</b>이라고 합니다. 이 강좌에서는 <b>1칸 = 1m</b> 로 정합니다. 가로 8m, 세로 6m 인 교실은 가로 8칸, 세로 6칸이고, 벽 두께까지 넣으면 그림처럼 10칸 × 8칸이 됩니다.' },
          { type: 'p', html: '줄자로 잰 길이를 칸 수로 바꾸려면 <b>cm 길이 ÷ 100</b> 을 하고 반올림합니다. 셸에서 확인해 봅니다.' },
          {
            type: 'code', title: '예제 7-1. 잰 길이를 칸 수로 바꾸기', repl: true, code: `CELL = 100
round(730 / CELL)
round(1260 / CELL)`,
            desc: '<code>CELL</code> 은 한 칸의 길이(cm)입니다. 교실 가로가 730cm 면 7칸, 복도가 1260cm 면 13칸입니다. 반올림하기 때문에 한 칸 안에서 <b>최대 50cm</b> 까지 차이가 날 수 있다는 점도 기억해 둡니다.',
            expect: '>>> CELL = 100\n>>> round(730 / CELL)\n7\n>>> round(1260 / CELL)\n13'
          },
          { type: 'callout', kind: 'more', title: '더 알아보기 — 칸을 더 작게 하면?', html: '1칸을 50cm 로 하면 도면이 더 자세해지지만 칸 수가 4배로 늘어나 그리기도, 보드에 넣기도 힘들어집니다. 사람 한 걸음이 대략 50~70cm 이므로, 길 찾기에는 <b>1칸 = 1m</b> 정도가 알맞은 타협입니다.' },

          { type: 'h', text: '공간 설계 도구 사용법' },
          { type: 'p', html: '시뮬레이터에는 이런 도면을 직접 그리는 <b>공간 설계 도구</b>가 있습니다. 왼쪽에서 그릴 것을 고르고, 가운데 격자 칸을 누르거나 끌어서 그립니다. 오른쪽의 <b>움직임 조이스틱</b>으로는 공간 안에 세운 가상의 사람을 움직입니다.' },
          { type: 'figure', html: FIG_TOOL, caption: '그림 7-2. 공간 설계 도구 — 왼쪽 그리기 도구 · 가운데 격자 · 오른쪽 조이스틱' },
          { type: 'table', head: ['도구', '하는 일', '쓰는 방법'], rows: [
            ['벽', '지나갈 수 없는 칸', '칸을 누르거나 끌어서 한 줄로 길게'],
            ['문', '드나드는 칸 (지나갈 수 있음)', '벽 한 칸을 문으로 바꾸기'],
            ['방', '네모난 방의 벽을 한 번에', '모서리에서 반대쪽 모서리까지 끌기'],
            ['기둥', '가운데에 서 있는 장애물', '한 칸씩 누르기'],
            ['목표', '가려는 곳 (칠판 앞 · 창가 등)', '한 칸 누르기 · 여러 개 가능'],
            ['시작점', '위치 (0, 0) 이 되는 칸', '한 칸만 · 다시 누르면 옮겨짐'],
            ['지우개', '잘못 그린 칸을 바닥으로', '칸을 누르거나 끌기']
          ], caption: '표 7-1. 공간 설계 도구의 그리기 도구' },
          { type: 'list', ordered: true, items: [
            '<b>방</b> 도구로 바깥 벽을 먼저 그립니다. 줄자로 잰 가로 · 세로 칸 수에 벽 두 칸을 더한 크기입니다.',
            '<b>문</b> 도구로 바깥 벽의 한 칸을 문으로 바꿉니다.',
            '<b>기둥</b> 과 큰 가구(사물함 줄 등)처럼 길을 막는 것을 그립니다.',
            '<b>시작점</b> 과 <b>목표</b> 를 찍습니다.',
            '위쪽의 <b>북쪽 ↻</b> 로 북쪽 방향을 맞춘 뒤 <b>저장</b> 합니다.'
          ] },
          { type: 'callout', kind: 'info', title: '공간 설계 도구가 안 보이면', html: '화면이 좁거나 도구가 열리지 않으면, 아래에서 배우는 <b>문자 지도</b>로 같은 공간을 만들 수 있습니다. 공책 모눈에 그린 도면을 한 줄씩 글자로 옮기면 됩니다. 가상의 사람 대신 <b>A · B 버튼</b>과 <b>🧭 센서</b> 탭의 방위각 슬라이더로 걷기를 흉내 냅니다.' },

          { type: 'h', text: '도면을 글자로 — 문자 지도' },
          { type: 'p', html: 'micro:bit 프로그램은 그림을 볼 수 없으므로, 도면을 <b>글자 줄의 목록</b>으로 바꾸어 넣습니다. 한 글자가 한 칸입니다. 이 강좌에서는 아래 글자를 씁니다.' },
          { type: 'table', head: ['글자', '뜻', '지나갈 수 있나요?'], rows: [
            ['<code>#</code>', '벽', '없음'],
            ['<code>.</code>', '바닥', '있음'],
            ['<code>D</code>', '문 (Door)', '있음'],
            ['<code>P</code>', '기둥 (Pillar)', '없음'],
            ['<code>S</code>', '시작점 (Start)', '있음'],
            ['<code>G</code>', '목표 (Goal)', '있음']
          ], caption: '표 7-2. 문자 지도의 글자' },
          {
            type: 'code', title: '예제 7-2. 교실을 문자 지도로 만들기', code: `from microbit import *

CELL = 100        # 1칸 = 1m = 100cm
` + pyList('ROOM', ROOM_CLASS) + `
for r in range(len(ROOM)):
    print(r, ROOM[r])

walls = 0
inside = 0
for row in ROOM:
    for ch in row:
        if ch == "#":
            walls += 1
        elif ch != "D":
            inside += 1
print("벽 칸:", walls)
print("안쪽 넓이:", inside, "m² (1칸 = 1m × 1m)")`,
            desc: '줄 번호와 함께 지도를 콘솔에 찍고, 벽 칸과 안쪽 칸을 셉니다. 그림 7-1 과 같은 교실입니다. 가로 10칸 · 세로 8칸이지만 벽을 빼면 안쪽은 8 × 6 = 48칸, 곧 <b>48m²</b> 입니다. 지도 글자를 바꿔 기둥을 하나 더 넣어 보세요.',
            expect: '0 ##########\n1 #...G....#\n2 #........#\n3 #..P.....#\n4 #........#\n5 #........#\n6 #S.......D\n7 ##########\n벽 칸: 31\n안쪽 넓이: 48 m² (1칸 = 1m × 1m)'
          },
          { type: 'callout', kind: 'warn', title: '모든 줄의 길이를 같게', html: '문자 지도의 줄마다 글자 수가 다르면 지도가 찌그러지고, 오른쪽 끝 칸을 읽을 때 엉뚱한 결과가 나옵니다. 글자를 넣거나 뺄 때는 <b>바닥(<code>.</code>)으로 바꾸기</b>만 하고, 줄의 길이는 그대로 둡니다.' },
          { type: 'p', html: '이제 지도에서 시작점 · 문 · 목표가 <b>몇 번째 열, 몇 번째 줄</b>에 있는지 찾아봅니다. 준비된 함수 <code>find()</code> 를 씁니다. 열 번호는 왼쪽에서 0, 1, 2 …, 줄 번호는 위에서 0, 1, 2 … 입니다(LED 의 x, y 와 같은 방향).' },
          {
            type: 'code', title: '예제 7-3. 시작점 · 문 · 목표 찾기', code: `from microbit import *
import math

CELL = 100
` + pyList('ROOM', ROOM_CLASS) + `
` + PY_FIND + `
sc, sr = find("S")
for name, ch in [("문", "D"), ("목표", "G")]:
    c, r = find(ch)
    dx = c - sc          # 동쪽으로 몇 칸
    dy = sr - r          # 북쪽으로 몇 칸 (줄 번호는 아래로 커짐)
    dist = math.sqrt(dx * dx + dy * dy)
    print(name, "칸", (c, r), "· 시작점에서 동", dx, "북", dy, "· 곧게", round(dist, 1), "m")`,
            desc: '시작점 S 는 (1, 6) 칸입니다. 문까지는 동쪽으로 8칸, 곧 8m 이고, 목표(칠판 앞)까지는 동쪽 3칸 · 북쪽 5칸이라 곧게 가면 약 5.8m 입니다. 줄 번호는 아래로 갈수록 커지므로 북쪽 칸 수는 <code>sr - r</code> 로 <b>뒤집어</b> 계산합니다(ch06 의 LED 지도와 같은 생각).',
            expect: '문 칸 (9, 6) · 시작점에서 동 8 북 0 · 곧게 8.0 m\n목표 칸 (4, 1) · 시작점에서 동 3 북 5 · 곧게 5.8 m'
          },

          { type: 'h', text: '시작점과 북쪽 방향 정하기' },
          { type: 'p', html: '<b>시작점</b>은 ch06 의 위치 (0, 0) 이 되는 칸입니다. 실제로 걸을 때는 언제나 이 칸에 서서 출발해야 하므로, 문 옆 · 기둥 앞처럼 <b>누구나 같은 자리를 찾을 수 있는 곳</b>으로 정합니다.' },
          { type: 'p', html: '다음은 <b>방향</b>입니다. 도면은 보통 보기 좋게 칠판 쪽을 위로 그립니다. 그런데 실제 교실의 칠판 쪽이 정확히 북쪽일 리는 거의 없습니다. 나침반(<code>compass.heading()</code>)은 <b>실제 북쪽</b>을 0° 로 재므로, 그대로 쓰면 도면 위의 사람이 엉뚱한 쪽으로 걸어갑니다.' },
          { type: 'figure', html: FIG_NORTH, caption: '그림 7-3. 도면의 위쪽과 실제 북쪽이 다를 때 — MAP_UP 으로 맞춘다' },
          { type: 'p', html: '맞추는 방법은 간단합니다. 보드를 들고 <b>도면의 위쪽(칠판 쪽)을 바라본 채</b> 나침반 값을 한 번 읽어 <code>MAP_UP</code> 에 적어 둡니다. 그 뒤로는 나침반 값에서 <code>MAP_UP</code> 을 빼면 <b>도면 기준의 방위</b>가 됩니다. 빼서 음수가 되면 <code>% 360</code> 이 0~359 로 되돌려 줍니다.' },
          {
            type: 'code', title: '예제 7-4. 실제 방위를 도면 방위로 바꾸기', repl: true, code: `MAP_UP = 30
(30 - MAP_UP) % 360
(120 - MAP_UP) % 360
(0 - MAP_UP) % 360`,
            desc: '칠판 쪽을 볼 때 나침반이 30° 인 교실입니다. 칠판 쪽(30°)을 보면 도면 방위 <b>0</b>(위), 오른쪽으로 90° 돈 120° 를 보면 <b>90</b>(도면 오른쪽), 실제 북쪽(0°)을 보면 <b>330</b>(도면에서 위쪽보다 조금 왼쪽)이 됩니다.',
            expect: '>>> MAP_UP = 30\n>>> (30 - MAP_UP) % 360\n0\n>>> (120 - MAP_UP) % 360\n90\n>>> (0 - MAP_UP) % 360\n330'
          },
          { type: 'callout', kind: 'tip', title: '공간 설계 도구에서는', html: '도구 위쪽의 <b>북쪽 ↻</b> 를 돌려 도면에 실제 북쪽을 표시해 두면, 가상의 사람이 도면 위쪽을 볼 때 보드의 나침반도 그 각도를 가리킵니다. 프로그램에서는 그 각도를 <code>MAP_UP</code> 에 적습니다. 처음에는 <b>0°</b>(도면 위쪽 = 북쪽)로 두고 연습하면 쉽습니다.' },
          { type: 'callout', kind: 'board', title: '실제 보드에서는', html: '<code>MAP_UP</code> 을 잴 때는 철제 사물함 · 칠판 · 스피커에서 조금 떨어져서, 보드를 <b>수평</b>으로 들고 잽니다(ch02 · ch06). 같은 자리에서 두세 번 재어 값이 비슷한지 확인하고, 값이 크게 다르면 <code>compass.calibrate()</code> 로 나침반을 다시 맞춥니다.' },

          { type: 'h', text: '예제 공간 불러오기 · 내 공간 저장하기' },
          { type: 'p', html: '처음부터 그리기 어렵다면 <b>예제 불러오기 ▾</b> 에서 <b>교실 · 복도 · 도서관</b> 공간을 골라 시작합니다. 아래 예제는 같은 세 공간을 문자 지도로 담아 두고, A 버튼으로 하나씩 넘겨 보는 프로그램입니다.' },
          {
            type: 'code', title: '예제 7-5. 예제 공간 세 개 넘겨 보기', code: `from microbit import *

` + pyList('CLASSROOM', ROOM_CLASS) + pyList('HALL', ROOM_HALL) + pyList('LIBRARY', ROOM_LIB) + `
SPACES = [("교실", "C", CLASSROOM), ("복도", "H", HALL), ("도서관", "L", LIBRARY)]
now = 0

def show_space(i):
    name, letter, rows = SPACES[i]
    print("===", name, "·", len(rows[0]), "x", len(rows), "칸 ===")
    for row in rows:
        print(row)
    display.show(letter)

show_space(now)
while True:
    if button_a.was_pressed():
        now = (now + 1) % len(SPACES)
        show_space(now)
    sleep(50)`,
            desc: 'A 를 누를 때마다 교실 → 복도 → 도서관 → 교실 … 순서로 지도가 콘솔에 찍히고, LED 에는 첫 글자(C · H · L)가 보입니다. 복도는 길고 좁으며 기둥이 있고, 도서관은 책장(<code>##</code>) 사이로 좁은 길이 나 있습니다.',
            hint: '보드 그림의 <b>A 버튼</b>을 눌러 세 공간을 넘겨 보세요.',
            expect: '=== 교실 · 10 x 8 칸 ===\n##########\n#...G....#\n…\n(A 를 누르면)\n=== 복도 · 20 x 5 칸 ===\n#########D##########\n#S.................#\n…'
          },
          { type: 'p', html: '내가 만든 공간은 도구의 <b>저장</b> 단추로 브라우저에 남겨 두고, 다음 시간에 <b>불러오기</b>로 다시 엽니다. 보드에도 저장할 수 있습니다. micro:bit 에는 작은 <b>파일 시스템</b>이 있어서, <code>open()</code> 으로 글자 파일을 쓰고 읽을 수 있습니다.' },
          {
            type: 'code', title: '예제 7-6. 내 공간을 보드 파일로 저장하고 다시 불러오기', code: `from microbit import *

` + pyList('ROOM', ROOM_CLASS) + `
# 저장하기: 한 줄씩 room.txt 에 쓰기
with open("room.txt", "w") as f:
    for row in ROOM:
        f.write(row + "\\n")

# 불러오기: 파일을 읽어 다시 줄 목록으로
with open("room.txt") as f:
    loaded = f.read().split("\\n")
loaded = [row for row in loaded if row]

print("불러온 줄 수:", len(loaded))
for row in loaded:
    print(row)
print("처음과 같나요?", loaded == ROOM)`,
            desc: '<code>"w"</code> 는 쓰기(write) 모드로, 같은 이름의 파일이 있으면 <b>지우고 새로</b> 씁니다. 읽을 때는 파일 전체를 글자 하나로 읽은 뒤 줄바꿈(<code>\\n</code>)으로 잘라 목록으로 만듭니다. 마지막 빈 줄은 걸러 냅니다. 실행 뒤 <b>💾 파일</b> 탭에서 <code>room.txt</code> 를 열어 보세요.',
            hint: '실행한 뒤 시뮬레이터의 <b>💾 파일</b> 탭을 열어 <code>room.txt</code> 가 생겼는지 확인하세요.',
            expect: '불러온 줄 수: 8\n##########\n#...G....#\n#........#\n#..P.....#\n#........#\n#........#\n#S.......D\n##########\n처음과 같나요? True'
          },
          { type: 'callout', kind: 'board', title: '실제 보드에서는', html: '실제 micro:bit 에서는 프로그램을 새로 올리면(플래시) 보드 안의 파일이 <b>지워질 수 있습니다</b>. 공간 도면은 컴퓨터(공간 설계 도구의 저장)에 남겨 두고, 보드에는 프로그램 안의 문자 지도로 함께 넣는 것이 안전합니다.' },

          { type: 'h', text: '가상의 사람을 공간에 세우고 걷게 하기' },
          { type: 'p', html: '공간 설계 도구에서 시작점을 찍으면 그 자리에 <b>가상의 사람</b>이 섭니다. 조이스틱을 위로 밀면 걷고, 끝까지 밀면 뛰고, 옆으로 밀면 몸을 돌립니다. 벽이나 기둥 칸에 닿으면 <b>더 나아가지 않고 멈춥니다</b>. 진짜 사람이 벽을 뚫고 지나갈 수 없는 것과 같습니다.' },
          { type: 'p', html: '우리 프로그램도 지도를 알고 있으면 같은 규칙을 쓸 수 있습니다. ch06 의 <code>move()</code> 로 한 걸음 가 본 다음, 그 칸이 벽이나 기둥이면 <b>제자리에 머무르게</b> 합니다. 이 일을 하는 준비된 함수들입니다.' },
          {
            type: 'code', title: '준비된 함수 모음 — 지도 걷기', run: false, code: PY_MAP_KIT,
            desc: '<b><code>tile_at(x, y)</code></b>: 위치(cm)가 지도의 어느 칸인지 보고 그 칸의 글자를 돌려줍니다. <b><code>try_move(x, y, 방향, 보폭)</code></b>: 한 걸음 가 본 새 위치와, 갈 수 있었는지(<code>True</code>/<code>False</code>)를 돌려줍니다. <b><code>show_room(x, y)</code></b>: 사람 둘레 5×5 칸을 LED 에 보여 줍니다(가운데 밝은 점 = 사람, 흐린 점 = 벽 · 기둥, 중간 밝기 = 문 · 목표). 쓰기 전에 <code>SC, SR = find("S")</code> 로 시작점 칸을 정해 둡니다.'
          },
          {
            type: 'code', title: '예제 7-7. 버튼으로 문까지 걸어 보기', code: `from microbit import *
import math

CELL = 100
` + pyList('ROOM', ROOM_CLASS) + `
` + PY_MOVE + `
` + PY_MAP_KIT + `
SC, SR = find("S")       # 시작점 칸 = 위치 (0, 0)
x, y, h = 0, 0, 90       # 동쪽(문 쪽)을 보고 출발
steps = 0
show_room(x, y)

while True:
    if button_a.was_pressed():           # 한 걸음 (1칸)
        x, y, ok = try_move(x, y, h, CELL)
        if ok:
            steps += 1
            print(steps, "걸음 → x =", round(x), "y =", round(y), "칸:", tile_at(x, y))
        else:
            print("쿵! 벽이라 멈춥니다")
        show_room(x, y)
        if tile_at(x, y) == "D":
            print("문에 도착!")
            display.show(Image.YES)
    if button_b.was_pressed():           # 오른쪽으로 90도 돌기
        h = (h + 90) % 360
        print("방향", h)
    sleep(20)`,
            desc: 'A 는 “한 칸 걷기”, B 는 “오른쪽으로 돌기”입니다. 동쪽으로 8번 걸으면 문에 닿아 ✓ 가 보이고, 한 번 더 가면 지도 밖이라 멈춥니다. B 로 북쪽(0)을 보게 한 뒤 걸으면 5칸 만에 위쪽 벽에 막힙니다. LED 의 흐린 점(벽)이 사람 둘레에서 어떻게 움직이는지 보세요.',
            hint: '<b>A</b> 를 8번 눌러 문까지 가 보세요. 그다음 ▶ 실행을 다시 누르고, 이번에는 <b>B</b> 를 세 번 눌러 북쪽(0)을 보게 한 뒤 <b>A</b> 를 눌러 위쪽 벽까지 가 봅니다.',
            expect: '1 걸음 → x = 100 y = 0 칸: .\n2 걸음 → x = 200 y = 0 칸: .\n…\n8 걸음 → x = 800 y = 0 칸: D\n문에 도착!\n쿵! 벽이라 멈춥니다'
          },
          { type: 'p', html: '이번에는 버튼 대신 <b>센서</b>로 걷습니다. ch06 의 위치 추적기에 <code>MAP_UP</code> 과 <code>try_move()</code> 를 더하면, 조이스틱으로 움직이는 가상의 사람을 보드가 <b>센서값만으로</b> 따라갑니다.' },
          { type: 'figure', html: FIG_FLOW, caption: '그림 7-4. 공간 속 이동이 센서값으로 바뀌어 프로그램에 전달되는 흐름' },
          { type: 'p', html: '그림에서 중요한 점은 ④ 프로그램이 ② 가상의 사람의 <b>진짜 위치를 직접 받지 않는다</b>는 것입니다. 시뮬레이터는 가상의 사람이 걸을 때의 출렁임을 <b>가속도 값</b>으로, 몸의 방향을 <b>방위 값</b>으로 바꾸어 보드에 줄 뿐입니다. 그래서 시뮬레이터에서 잘 되는 프로그램은 실제 보드를 몸에 달았을 때도 같은 방법으로 동작합니다.' },
          {
            type: 'code', title: '예제 7-8. 조이스틱으로 걷는 공간 속 위치 추적기', code: `from microbit import *
import math

` + PY_STEP_KIT + `
` + PY_MOVE + `
CELL = 100
` + pyList('ROOM', ROOM_CLASS) + `
` + PY_MAP_KIT + `
SC, SR = find("S")
MAP_UP = 0         # 도면 위쪽을 볼 때의 나침반 값
STRIDE = 65        # 내 보폭 (cm, ch05 실측)
x, y = 0, 0
steps = 0
show_room(x, y)

while True:
    if is_step(smooth(strength())):
        h = (compass.heading() - MAP_UP) % 360
        x, y, ok = try_move(x, y, h, STRIDE)
        steps += 1
        if not ok:
            print("벽에 막힘!")
        show_room(x, y)
        print(steps, "걸음 · 방향", h, "· x =", round(x), "y =", round(y), tile_at(x, y))
        if tile_at(x, y) == "D":
            print("문에 도착!", steps, "걸음")
    sleep(20)`,
            desc: 'ch06 예제 6-8 과 거의 같고, 바뀐 곳은 두 군데입니다. 방향을 <code>(compass.heading() - MAP_UP) % 360</code> 으로 <b>도면 기준</b>으로 바꾸고, <code>move()</code> 대신 <code>try_move()</code> 로 <b>벽 검사</b>를 합니다. 보폭이 65cm 라 문까지(8m) 약 12~13걸음이 걸립니다.',
            hint: '<b>움직임 조이스틱</b>을 옆으로 밀어 가상의 사람이 동쪽(90°)을 보게 한 뒤, 위로 살짝 밀어 문까지 걸어 보세요. 조이스틱이 없으면 방위각 슬라이더를 90 에 두고 <b>흔들기</b> 제스처를 일정한 박자로 누릅니다.',
            expect: '1 걸음 · 방향 90 · x = 65 y = 0 .\n2 걸음 · 방향 90 · x = 130 y = 0 .\n…\n12 걸음 · 방향 90 · x = 780 y = 0 D\n문에 도착! 12 걸음',
            nondeterministic: true
          },
          { type: 'callout', kind: 'warn', title: '도구의 사람과 계산한 위치는 다를 수 있습니다', html: '가상의 사람은 공간 설계 도구 안에서 <b>정확히</b> 움직이지만, 보드는 걸음 · 방향 · 보폭으로 <b>짐작</b>합니다. 걸음을 하나 놓치거나 보폭이 실제와 다르면, 도구의 사람은 문에 닿았는데 보드는 아직 한 칸 앞이라고 생각할 수 있습니다. 이 차이를 비교하는 일은 다음 챕터에서 합니다. 오늘은 “차이가 생길 수 있다”는 것만 기억해 둡니다.' },
          {
            type: 'code', title: '응용 7-9. 복도 공간에서 걸어 보기', code: `from microbit import *
import math

CELL = 100
` + pyList('ROOM', ROOM_HALL) + `
` + PY_MOVE + `
` + PY_MAP_KIT + `
SC, SR = find("S")
x, y, h = 0, 0, 90
steps = 0
show_room(x, y)

while True:
    if button_a.was_pressed():
        x, y, ok = try_move(x, y, h, CELL)
        if ok:
            steps += 1
        here = tile_at(x, y)
        print(steps, "걸음 · 방향", h, "· 칸", here)
        show_room(x, y)
        if here == "G":
            print("목표 도착!", steps, "걸음")
            display.show(Image.HAPPY)
    if button_b.was_pressed():           # 오른쪽 90도
        h = (h + 90) % 360
    if pin_logo.is_touched():            # 왼쪽 90도
        h = (h + 270) % 360
        print("방향", h)
        sleep(300)
    sleep(20)`,
            desc: '예제 7-7 에서 지도만 <b>복도</b>로 바꾸고, 금색 로고를 “왼쪽으로 돌기”로 더했습니다. 시작점 S 에서 목표 G 까지 기둥 두 개를 피해 가 보세요. 지도를 도서관(<code>ROOM_LIB</code> 모양)으로 바꾸면 책장 사이 좁은 길을 걷게 됩니다.',
            hint: '<b>A</b> = 한 칸, <b>B</b> = 오른쪽으로 돌기, <b>로고</b> = 왼쪽으로 돌기입니다. 가장 적은 걸음으로 G 에 가는 길을 찾아보세요.',
            expect: '1 걸음 · 방향 90 · 칸 .\n…\n17 걸음 · 방향 90 · 칸 .\n(B 로 남쪽을 보고)\n19 걸음 · 방향 180 · 칸 G\n목표 도착! 19 걸음'
          },

          { type: 'h', text: '직접 해 보기 — 우리 교실 도면' },
          { type: 'list', ordered: true, items: [
            '모둠별로 교실(또는 집의 방)의 가로 · 세로를 줄자로 재고, 예제 7-1 처럼 칸 수로 바꿉니다.',
            '공간 설계 도구(또는 문자 지도)로 벽 · 문 · 기둥(큰 가구)을 그리고, 시작점과 문을 정합니다.',
            '칠판 쪽을 바라볼 때의 나침반 값을 재어 <code>MAP_UP</code> 을 정합니다 (시뮬레이터에서는 0 으로 두어도 됩니다).',
            '예제 7-8 의 지도를 우리 교실로 바꾸고, 가상의 사람을 <b>시작점에서 문까지</b> 걷게 합니다. 몇 걸음이 걸렸나요?',
            '도구의 공간을 <b>저장</b>하고, 문자 지도는 예제 7-6 으로 <code>room.txt</code> 에도 저장해 둡니다.'
          ] },

          { type: 'h', text: '토론 — 실제 공간을 잴 때 생기는 문제' },
          { type: 'p', html: '공간 설계 도구 안의 교실은 반듯하지만, 진짜 교실을 재어 옮기면 여러 가지 틀린 곳이 생깁니다. 도면이 틀리면 위치 계산이 맞아도 “벽 속을 걷는” 이상한 결과가 나옵니다. 모둠별로 이야기해 봅니다.' },
          { type: 'table', head: ['문제', '어떤 일이 생기나요?', '줄이는 방법 (생각해 보기)'], rows: [
            ['줄자가 짧아 여러 번 이어 잼', '이을 때마다 몇 cm 씩 틀려 합치면 크게 틀림', '바닥 타일 개수 세기 · 긴 줄자 · 두 사람이 따로 재서 비교'],
            ['손으로 대충 그린 도면', '벽이 비뚤거나 방 크기가 다름 → 진짜로는 갈 수 있는 곳이 벽', '먼저 숫자(길이)를 적고 그다음 그리기 · 1칸 = 1m 지키기'],
            ['문 위치 오차', '문이 한 칸 옆에 그려지면 “문에 도착” 이 늦거나 안 나옴', '벽 모서리에서 문까지 거리를 따로 재기'],
            ['반올림 (1칸 = 1m)', '7.3m → 7칸, 한 칸 안에서 최대 50cm 차이', '중요한 곳(문 · 목표)은 한 칸 넓게 그리기'],
            ['움직이는 물건 (의자 · 가방)', '도면에 없는 장애물 때문에 돌아서 걷게 됨', '실험 전에 길을 치우기 · 도면에는 고정된 것만']
          ], caption: '표 7-3. 실제 공간을 도면으로 옮길 때의 문제' },
          { type: 'list', items: [
            '💬 우리 교실을 잴 때 가장 틀리기 쉬운 곳은 어디일까요?',
            '💬 도면의 문 위치가 실제보다 1m 옆이라면, 시작점에서 문까지 걸었을 때 보드는 무엇이라고 말할까요?',
            '💬 바닥 타일 한 장의 크기를 안다면 줄자 없이 교실 크기를 잴 수 있을까요?'
          ] },
          { type: 'callout', kind: 'tip', title: '1교시 정리', html: '도면에는 벽 · 문 · 기둥 · 시작점 · 목표 · 축척 · 북쪽을 넣습니다. 공간 설계 도구(또는 문자 지도)로 1칸 = 1m 공간을 만들고, <code>MAP_UP</code> 으로 도면 방향을 맞추고, <code>try_move()</code> 로 벽에서 멈추게 했습니다. 다음 교시에는 이 공간에서 걸은 길을 <b>저장</b>합니다.' }
        ],
        slides: [
          { layout: 'title', title: '2차원 공간 설계하기', subtitle: 'Chapter 07 · 가상 공간 설계와 경로 기록', badge: '1교시', notes: '<p>ch06 에서 만든 위치 추적기를 떠올리게 합니다. “점은 움직였는데, 그 점이 교실의 어디쯤일까요?”로 시작합니다.</p><p>시간: 1분</p>' },
          { layout: 'bullets', title: '생각하기 — 지도에 꼭 넣을 것', lead: '위에서 내려다본 우리 교실', bullets: ['지나갈 수 없는 곳: 벽 · 기둥', '드나드는 곳: 문', '어디서 출발? 시작점', '어디로? 목표 지점', '얼마나 크고 어느 쪽? 축척 · 북쪽'], notes: '<p>학생들이 그려 온 지도를 두세 장 보여 주고 공통점을 찾습니다.</p><p>💬 “책상은 꼭 넣어야 할까요?” — 옮기기 쉬운 것은 빼도 된다. 길을 막는 것만.</p><p>💬 “축척이 없으면 무엇을 알 수 없나요?” — 실제 거리.</p><p>시간: 4분</p>' },
          { layout: 'diagram', title: '도면 — 1칸 = 1m', html: FIG_PLAN, caption: '꼭 넣을 일곱 가지', notes: '<p>그림을 가리키며 일곱 가지를 하나씩 짚습니다.</p><p>예제 7-1(셸)로 730cm → 7칸을 함께 계산합니다. 반올림 때문에 최대 50cm 차이가 난다는 점을 짚습니다.</p><p>💬 “1칸을 10cm 로 하면 좋을까요?” — 자세하지만 칸이 너무 많아진다.</p><p>시간: 5분</p>' },
          { layout: 'diagram', title: '공간 설계 도구', html: FIG_TOOL, caption: '그리기 도구 · 격자 · 조이스틱', notes: '<p>시뮬레이터에서 공간 설계 도구를 직접 열어 시연합니다: 방 → 문 → 기둥 → 시작점 → 목표 → 저장.</p><p>지우개로 고치는 방법도 보여 줍니다.</p><p>도구가 보이지 않는 환경이면 다음 슬라이드의 문자 지도로 바로 넘어갑니다.</p><p>시간: 6분</p>' },
          { layout: 'code', title: '도면을 글자로 — 문자 지도', code: `from microbit import *

` + pyList('ROOM', ROOM_CLASS) + `
for r in range(len(ROOM)):
    print(r, ROOM[r])`, points: ['<code>#</code> 벽 · <code>.</code> 바닥 · <code>D</code> 문', '<code>P</code> 기둥 · <code>S</code> 시작 · <code>G</code> 목표', '모든 줄의 길이는 같게'], notes: '<p>실행해서 콘솔에 지도가 찍히는 것을 보여 줍니다.</p><p>💬 “기둥을 하나 더 넣으려면?” — <code>.</code> 하나를 <code>P</code> 로 바꾼다. 글자를 끼워 넣으면 줄 길이가 달라져서 안 된다.</p><p>예제 7-3 의 <code>find()</code> 는 “지도에서 글자 찾기” 라고만 소개합니다.</p><p>시간: 4분</p>' },
          { layout: 'diagram', title: '도면 위쪽 ≠ 실제 북쪽', html: FIG_NORTH, caption: 'MAP_UP = 도면 위쪽을 볼 때의 나침반 값', notes: '<p>교실에서 실제로 칠판 쪽이 어느 방위인지 보드나 휴대폰 나침반으로 확인해 보면 좋습니다.</p><p>💬 “칠판 쪽이 30° 인데 그대로 쓰면 어떻게 될까요?” — 도면 위 사람이 비스듬히 걷는다.</p><p>시간: 3분</p>' },
          { layout: 'code', title: '도면 방위로 바꾸기', repl: true, code: `MAP_UP = 30
(30 - MAP_UP) % 360
(120 - MAP_UP) % 360
(0 - MAP_UP) % 360`, points: ['칠판 쪽 → 0 (도면 위)', '오른쪽으로 90° → 90', '음수는 <code>% 360</code> 으로 0~359'], notes: '<p>셸에서 한 줄씩 실행합니다. 결과 0 · 90 · 330 을 그림 7-3 위에서 손가락으로 가리켜 확인합니다.</p><p>💬 “MAP_UP 을 잴 때 조심할 점은?” — 수평으로, 철제 가구에서 떨어져서, 두세 번.</p><p>시간: 4분</p>' },
          { layout: 'table', title: '예제 공간 · 저장 · 불러오기', head: ['공간', '크기', '특징'], rows: [['교실', '10 × 8칸', '기둥 1 · 문 1'], ['복도', '20 × 5칸', '길고 좁음 · 기둥 2'], ['도서관', '12 × 7칸', '책장 사이 좁은 길']], lead: '도구: 예제 불러오기 ▾ · 저장 · 불러오기 / 보드: room.txt', notes: '<p>예제 7-5 로 세 공간을 넘겨 보고, 예제 7-6 으로 <code>room.txt</code> 를 저장한 뒤 💾 파일 탭을 함께 엽니다.</p><p>실제 보드는 프로그램을 새로 올리면 파일이 지워질 수 있다는 점을 짚습니다.</p><p>시간: 5분</p>' },
          { layout: 'bullets', title: '가상의 사람 걷게 하기', bullets: ['조이스틱: 걷기 · 뛰기 · 방향 전환', '벽 · 기둥에 닿으면 멈춤', ['우리 프로그램: <code>try_move()</code>', '가 보고 벽이면 제자리'], '버튼 버전: A 한 칸 · B 오른쪽 90°', 'LED: 사람 둘레 5×5'], notes: '<p>예제 7-7(버튼)로 문까지 8칸을 걸어 ✓ 를 보여 줍니다. 그다음 예제 7-8(조이스틱)로 같은 길을 걸어 봅니다.</p><p>💬 “보폭 65cm 로 8m 를 가면 몇 걸음?” — 약 12~13걸음.</p><p>시간: 5분</p>' },
          { layout: 'diagram', title: '이동 → 센서값 → 프로그램', html: FIG_FLOW, caption: '프로그램은 센서값만 받는다', notes: '<p>가장 중요한 그림입니다. 시뮬레이터가 “정답 위치”를 알려 주는 것이 아니라 센서값만 준다는 점을 강조합니다.</p><p>💬 “그럼 도구의 사람과 보드가 계산한 위치가 다를 수도 있나요?” — 그렇다. 비교는 다음 챕터에서.</p><p>시간: 4분</p>' },
          { layout: 'bullets', title: '토론 — 실제 공간을 잴 때', bullets: ['줄자가 짧아 이어 잼 → 오차가 쌓임', '대충 그린 도면 → 갈 수 있는 곳이 벽', '문 위치 오차 → “도착”이 늦거나 안 나옴', '반올림 → 한 칸 안에서 최대 50cm', '의자 · 가방 → 실험 전에 길 치우기'], notes: '<p>모둠별로 한 가지씩 맡아 해결 아이디어를 말하게 합니다.</p><p>💬 “타일 한 장이 30cm 라면 타일 몇 장이 1m 일까요?” — 약 3.3장. 타일 세기도 좋은 방법.</p><p>남는 시간에는 “직접 해 보기 — 우리 교실 도면”을 시작하게 합니다.</p><p>시간: 6분</p>' },
          { layout: 'summary', title: '1교시 정리', bullets: ['도면: 벽 · 문 · 기둥 · 시작 · 목표 · 축척 · 북쪽', '1칸 = 1m · 문자 지도로 보드에', '도면 방위 = (나침반 − MAP_UP) % 360', '<code>try_move()</code>: 벽이면 제자리', '프로그램은 센서값만 받는다'], notes: '<p>오늘 만든 도면은 꼭 저장하게 합니다(다음 시간에 씀).</p><p>다음 시간 “생각하기”: 걸어간 길을 나중에 다시 그리려면 무엇을, 얼마나 자주 저장해야 할까요? 를 안내합니다.</p><p>시간: 2분</p>' }
        ]
      },

      /* ═══════════════════════ 2교시 ═══════════════════════ */
      {
        id: 'ch07-2',
        title: '이동 경로 저장하기',
        minutes: 50,
        goals: [
          '경로를 다시 그리는 데 필요한 값(시간 · 걸음 수 · 방위각 · x · y)을 정하고 한 줄로 만들 수 있다',
          '걸음마다 저장과 1초마다 저장의 장단점을 표로 비교할 수 있다',
          '<code>log</code> 모듈과 <code>open()</code> 으로 경로를 저장하고 📊 로그 · 💾 파일 탭에서 확인할 수 있다',
          'A 출발 · B 도착 · 로고 위치 표시가 있는 경로 기록기를 만들고, 기록 가능한 시간을 어림할 수 있다'
        ],
        flow: [['생각하기 나누기', 5], ['저장할 값 정하기', 6], ['저장 시점 비교', 6], ['log · 파일로 저장', 9], ['경로 기록기 만들기', 12], ['메모리 어림 계산', 5], ['토론 · 실험 계획표', 5], ['정리', 2]],
        content: [
          { type: 'callout', kind: 'info', title: '생각하기 (수업 전)', html: '<b>걸어간 길을 나중에 다시 그리려면, 무엇을 얼마나 자주 저장해야 할까요?</b> 집에서 학교까지 걸어가는 길을 친구에게 나중에 그려 주어야 한다고 상상해 보세요. 걸어가면서 무엇을 메모하겠나요? 1분마다? 길모퉁이마다? 메모할 것과 메모하는 때를 적어 오세요.' },
          { type: 'p', html: '적어 온 답은 크게 두 가지입니다. 하나는 “<b>모퉁이에서 돌 때마다</b> 몇 걸음 왔는지와 어느 쪽으로 돌았는지”이고, 다른 하나는 “<b>정해진 시간마다</b> 지금 어디쯤인지”입니다. 두 방법 모두 쓸모가 있고, 저마다 좋은 점과 아쉬운 점이 있습니다. 오늘은 이 두 방법을 비교하고, 1교시에 만든 공간에서 걸은 길을 보드에 저장하는 <b>경로 기록기</b>를 만듭니다.' },

          { type: 'h', text: '저장할 값 정하기' },
          { type: 'p', html: 'ch05 의 러닝 기록기는 시간 · 걸음 수 · 케이던스 · 거리를 저장했습니다. 경로를 그리려면 무엇보다 <b>위치</b>가 필요합니다. 그리고 나중에 “왜 여기서 길이 휘었지?” 하고 원인을 찾으려면 위치를 만든 재료도 함께 남겨 두면 좋습니다.' },
          { type: 'figure', html: FIG_ROW, caption: '그림 7-5. 기록 한 줄에 담을 다섯 가지 값' },
          { type: 'table', head: ['이름표', '뜻', '없으면 생기는 일'], rows: [
            ['<code>time</code>', '출발 뒤 지난 시간 (초)', '어디서 오래 머물렀는지, 빨리 걸었는지 알 수 없음'],
            ['<code>steps</code>', '지금까지 걸음 수', '걸음을 놓쳤는지 확인할 수 없음'],
            ['<code>heading</code>', '도면 기준 방위각 (0~359)', '방향이 틀어진 곳을 찾을 수 없음'],
            ['<code>x</code>', '동쪽(도면 오른쪽)으로 간 거리 (cm)', '점을 찍을 수 없음'],
            ['<code>y</code>', '북쪽(도면 위쪽)으로 간 거리 (cm)', '점을 찍을 수 없음']
          ], caption: '표 7-4. 경로 기록의 다섯 가지 값' },
          { type: 'p', html: '이 다섯 값을 쉼표로 이어 한 줄로 만든 것이 ch05 에서 본 <b>CSV</b> 의 한 줄입니다. 먼저 값 다섯 개를 한 줄로 만들어 봅니다.' },
          {
            type: 'code', title: '예제 7-10. 다섯 값을 CSV 한 줄로', code: `from microbit import *

t, steps, h, x, y = 12.5, 20, 90, 1300.4, -0.2
print("time,steps,heading,x,y")
line = "{},{},{},{},{}".format(t, steps, h, round(x), round(y))
print(line)
print("글자 수:", len(line))`,
            desc: '<code>"{},{}…".format(...)</code> 는 중괄호 자리에 값을 차례로 넣어 글자를 만듭니다. 위치는 <code>round()</code> 로 cm 단위 정수로 만들어 줄을 짧게 합니다(1cm 아래 숫자는 경로 그리기에 쓸모가 없습니다). 이 한 줄이 17글자, 곧 대략 17바이트라는 것도 기억해 둡니다.',
            expect: 'time,steps,heading,x,y\n12.5,20,90,1300,0\n글자 수: 17'
          },
          { type: 'callout', kind: 'tip', title: 'x · y 를 저장하나, heading 과 걸음만 저장하나?', html: '사실 시작점 · 방위각 · 걸음 수 · 보폭만 있으면 x · y 는 나중에 다시 계산할 수 있습니다. 그래도 x · y 를 함께 저장하면 컴퓨터에서 <b>바로 점을 찍을 수 있고</b>, 보드가 그때 무엇이라고 계산했는지도 남습니다. 대신 한 줄이 조금 길어집니다. 이렇게 “편리함 ↔ 저장 공간”을 고르는 것도 설계입니다.' },

          { type: 'h', text: '저장 시점 비교 — 걸음마다 vs 1초마다' },
          { type: 'p', html: '언제 저장할지는 두 가지 방법이 있습니다. <b>걸음마다 저장</b>은 걸음을 느낄 때마다 한 줄, <b>1초마다 저장</b>은 시계를 보고 1초가 지날 때마다 한 줄을 붙입니다. 걷다가 잠깐 멈췄다가 다시 걷는 60초를 그림으로 비교해 봅니다.' },
          { type: 'figure', html: FIG_WHEN, caption: '그림 7-6. 같은 60초 — 걸음마다 저장과 1초마다 저장' },
          {
            type: 'code', title: '예제 7-11. 저장 줄 수 비교하기', code: `from microbit import *

# 60초: 걷기 20초 → 멈춤 20초 → 걷기 20초
moving = [1] * 20 + [0] * 20 + [1] * 20
for speed in [2, 3]:             # 1초에 2걸음(걷기) · 3걸음(뛰기)
    per_step = 0
    per_sec = 0
    for sec in range(60):
        per_sec += 1             # 1초마다: 매초 한 줄
        if moving[sec]:
            per_step += speed    # 걸음마다: 걸은 만큼 줄
    print("1초에", speed, "걸음 → 걸음마다", per_step, "줄 · 1초마다", per_sec, "줄")`,
            desc: '걸을 때(1초에 2걸음)는 걸음마다 저장이 80줄, 1초마다 저장이 60줄입니다. 뛸 때(1초에 3걸음)는 걸음마다 저장이 120줄로 늘지만, 1초마다 저장은 그대로 60줄입니다. 대신 멈춘 20초 동안 걸음마다 저장은 <b>0줄</b>이라 “멈춰 있었다”는 것을 시간 칸의 빈틈으로만 알 수 있습니다.',
            expect: '1초에 2 걸음 → 걸음마다 80 줄 · 1초마다 60 줄\n1초에 3 걸음 → 걸음마다 120 줄 · 1초마다 60 줄'
          },
          { type: 'table', head: ['', '걸음마다 저장', '1초마다 저장'], rows: [
            ['경로의 모양', '<b>모든 걸음</b>이 점 하나 → 모퉁이가 또렷함', '1초 사이에 2~3걸음을 건너뜀 → 모퉁이가 뭉툭할 수 있음'],
            ['멈춰 있을 때', '줄이 생기지 않음 → 공간 절약', '같은 위치가 계속 쌓임 → 머문 시간을 알기 쉬움'],
            ['뛸 때', '줄이 많아져 공간이 빨리 참', '줄 수가 늘 같음 → 기록 시간을 미리 알 수 있음'],
            ['프로그램', '걸음이 나는 자리에서 저장 (간단)', '“다음 저장 시각”을 따로 챙김 (ch05 방식)'],
            ['어울리는 곳', '실내 경로 · 모퉁이가 많은 길', '러닝 기록 · 오래 걷는 기록']
          ], caption: '표 7-5. 저장 시점의 장단점' },
          { type: 'p', html: '실내 이동 경로는 문 · 모퉁이에서 방향이 자주 바뀌므로, 이 강좌의 경로 기록기는 <b>걸음마다 저장</b>을 기본으로 합니다. 1초마다 저장도 직접 해 보고 비교할 수 있도록 두 예제를 모두 실어 둡니다.' },

          { type: 'h', text: 'log 모듈로 경로 저장하기' },
          { type: 'p', html: 'ch05 에서 쓴 <code>log</code> 모듈을 그대로 씁니다. <code>log.set_labels()</code> 로 이름표 다섯 개를 정하고, 걸음마다 <code>log.add()</code> 로 한 줄을 붙입니다. 먼저 센서 대신 <b>A 버튼 = 한 걸음(1m)</b>, <b>B 버튼 = 오른쪽으로 돌기</b>로 연습합니다.' },
          {
            type: 'code', title: '예제 7-12. 걸음마다 경로 저장하기 (log)', code: `from microbit import *
import math
import log

` + PY_MOVE + `
STRIDE = 100      # 연습: 1걸음 = 1칸(1m)
log.set_labels("time", "steps", "heading", "x", "y", timestamp=None)
x, y, h = 0, 0, 0
steps = 0
start = running_time()

while True:
    if button_b.was_pressed():           # 오른쪽으로 90도
        h = (h + 90) % 360
        print("방향", h)
    if button_a.was_pressed():           # 한 걸음 = 한 줄 저장
        x, y = move(x, y, h, STRIDE)
        steps += 1
        t = (running_time() - start) // 100 / 10
        log.add(time=t, steps=steps, heading=h, x=round(x), y=round(y))
        print("저장:", t, steps, h, round(x), round(y))
    sleep(20)`,
            desc: '<code>t</code> 는 출발 뒤 지난 시간을 0.1초 단위로 만든 값입니다(<code>// 100 / 10</code>). A 를 누를 때마다 콘솔에 “저장:” 줄이 찍히고, <b>📊 로그</b> 탭의 표에도 한 줄씩 붙습니다. 북쪽 2걸음 → B → 동쪽 3걸음을 해 보면 x · y 가 (0, 200) 다음 (300, 200) 까지 가는 것이 보입니다.',
            hint: '<b>A</b> 를 두 번 누르고, <b>B</b> 를 한 번 눌러 동쪽을 보게 한 뒤, <b>A</b> 를 세 번 누르세요. 그다음 <b>📊 로그</b> 탭을 열어 표를 확인합니다.',
            expect: '저장: 1.2 1 0 0 100\n저장: 1.8 2 0 0 200\n방향 90\n저장: 3.5 3 90 100 200\n저장: 4.0 4 90 200 200\n저장: 4.6 5 90 300 200',
            nondeterministic: true
          },
          { type: 'callout', kind: 'info', title: '기록을 깨끗하게 시작하려면', html: 'log 기록은 다시 실행해도 <b>앞의 기록 아래에 이어서</b> 붙습니다(ch05). 새로 시작하려면 📊 로그 탭의 <b>🗑 지우기</b>를 누릅니다. 이름표가 다른 기록을 섞으면 표가 헷갈리므로, 예제를 바꿀 때마다 지우고 시작하는 습관을 들입니다.' },
          {
            type: 'code', title: '예제 7-13. 1초마다 경로 저장하기 (log)', code: `from microbit import *
import math
import log

` + PY_MOVE + `
STRIDE = 100
log.set_labels("time", "steps", "heading", "x", "y", timestamp=None)
x, y, h = 0, 0, 0
steps = 0
sec = 0
next_save = running_time() + 1000

while True:
    if button_b.was_pressed():
        h = (h + 90) % 360
    if button_a.was_pressed():           # 걸음은 위치만 바꿈
        x, y = move(x, y, h, STRIDE)
        steps += 1
    if running_time() >= next_save:      # 1초가 지나면 한 줄 저장
        next_save += 1000
        sec += 1
        log.add(time=sec, steps=steps, heading=h, x=round(x), y=round(y))
        print("저장:", sec, steps, h, round(x), round(y))
    sleep(20)`,
            desc: '이번에는 걸음과 저장이 따로 놉니다. A 를 누르지 않아도 1초마다 같은 위치가 계속 저장되고, 1초 안에 A 를 여러 번 누르면 <b>중간 위치는 저장되지 않습니다</b>. 예제 7-12 와 같은 순서로 눌러 보고 📊 로그 표를 비교해 보세요.',
            hint: '아무것도 누르지 않고 3초 기다린 뒤, <b>A</b> 를 빠르게 세 번 눌러 보세요. 표에서 걸음 수가 한꺼번에 3 늘어난 줄을 찾아봅니다.',
            expect: '저장: 1 0 0 0 0\n저장: 2 0 0 0 0\n저장: 3 0 0 0 0\n저장: 4 3 0 0 300\n…',
            nondeterministic: true
          },

          { type: 'h', text: '또는 파일로 — open("path.csv", "w")' },
          { type: 'p', html: '<code>log</code> 모듈 대신, 1교시의 <code>room.txt</code> 처럼 <code>open()</code> 으로 <b>CSV 파일을 직접</b> 쓸 수도 있습니다. 첫 줄에 이름표를 쓰고, 그 아래에 값을 한 줄씩 씁니다. 먼저 정해진 길(동쪽 3걸음 → 북쪽 2걸음)을 계산으로 걸어 파일에 쓰고, 다시 읽어 확인합니다.' },
          {
            type: 'code', title: '예제 7-14. path.csv 에 경로 쓰고 읽기', code: `from microbit import *
import math

` + PY_MOVE + `
route = [(90, 3), (0, 2)]     # 동쪽 3걸음 → 북쪽 2걸음
x, y, steps = 0, 0, 0
with open("path.csv", "w") as f:
    f.write("steps,heading,x,y\\n")
    for heading, n in route:
        for i in range(n):
            x, y = move(x, y, heading, 100)
            steps += 1
            f.write("{},{},{},{}\\n".format(steps, heading, round(x), round(y)))

with open("path.csv") as f:
    print(f.read())`,
            desc: '<code>with open(...) as f:</code> 블록이 끝나면 파일이 <b>저절로 닫히며</b> 내용이 확실히 저장됩니다. 줄 끝마다 <code>\\n</code> 을 붙여야 다음 값이 새 줄에 씁니다. 실행 뒤 <b>💾 파일</b> 탭에서 <code>path.csv</code> 를 열거나 내려받아 보세요.',
            hint: '실행한 뒤 <b>💾 파일</b> 탭에서 <code>path.csv</code> 를 확인하세요. <code>route</code> 에 <code>(270, 1)</code> 을 더하면 줄이 어떻게 바뀔까요?',
            expect: 'steps,heading,x,y\n1,90,100,0\n2,90,200,0\n3,90,300,0\n4,0,300,100\n5,0,300,200'
          },
          { type: 'table', head: ['', 'log 모듈', 'open() 파일'], rows: [
            ['보는 곳', '📊 로그 탭 · 실제 보드의 MY_DATA.HTM', '💾 파일 탭 · 실제 보드 파일 시스템'],
            ['이름표', '<code>set_labels()</code> 로 한 번', '첫 줄에 직접 씀'],
            ['한 줄 쓰기', '<code>log.add(이름=값, …)</code>', '<code>f.write("…\\n")</code> — 쉼표 · 줄바꿈 직접'],
            ['다시 실행하면', '앞 기록 아래에 이어 붙음', '<code>"w"</code> 는 지우고 새로 씀'],
            ['조심할 점', '지우기(<code>log.delete()</code>)는 되돌릴 수 없음', '끝에 파일을 <b>닫아야</b> 확실히 저장됨']
          ], caption: '표 7-6. log 모듈과 open() 파일 비교' },
          { type: 'callout', kind: 'board', title: '실제 보드에서는', html: 'log 기록(MY_DATA.HTM)은 전원을 꺼도 남고, 프로그램을 새로 올려도 지워지지 않습니다. 반면 <code>open()</code> 으로 만든 파일은 프로그램을 새로 올리면 <b>지워질 수 있고</b>, 파일을 닫기 전에 전원이 꺼지면 마지막 내용이 빠질 수 있습니다. 실제로 몸에 달고 걷는 기록에는 <b>log 모듈</b>이 더 안전합니다.' },

          { type: 'h', text: '기록 흐름 버튼 — A 출발 · B 도착 · 로고 위치' },
          { type: 'p', html: '실제로 걸으며 기록할 때는 화면을 볼 수 없으므로, 버튼 하나하나의 역할을 <b>간단하고 분명하게</b> 정해 둡니다. 경로 기록기의 버튼은 이렇게 정합니다.' },
          { type: 'figure', html: FIG_BTN, caption: '그림 7-7. 경로 기록기의 버튼 흐름' },
          { type: 'list', items: [
            '<b>A = 출발</b>: 위치를 (0, 0), 걸음 수를 0 으로 되돌리고, 지금 바라보는 나침반 값을 <b>처음 방향</b>으로 기억합니다. 이 처음 방향이 1교시의 <code>MAP_UP</code> 역할을 합니다. 그래서 출발할 때는 꼭 <b>도면의 위쪽(칠판 쪽)을 바라보고</b> A 를 누릅니다.',
            '<b>B = 도착</b>: 기록을 멈추고 ✓ 를 보여 줍니다. 그 뒤로는 걸어도 저장하지 않습니다.',
            '<b>로고 터치 = 현재 위치</b>: 기록은 계속하면서, 지금 계산한 위치를 콘솔에 찍고 LED 에 잠깐 과녁 그림을 보여 줍니다. 목표 지점에 섰을 때 눌러 두면 나중에 “여기서 목표에 섰다”는 표시가 됩니다.'
          ] },
          { type: 'p', html: '오늘의 실습 경로는 1교시와 조금 다른 교실 도면입니다. 문 옆 시작점에서 출발해 <b>칠판 앞(B)</b> 을 지나 <b>창가(W)</b> 까지 걷습니다.' },
          { type: 'figure', html: FIG_ROUTE, caption: '그림 7-8. 오늘의 경로 — 문 → 칠판 → 창가' },
          {
            type: 'code', title: '예제 7-15. 경로 기록기 (log 저장)', code: `from microbit import *
import math
import log

` + PY_STEP_KIT + `
` + PY_MOVE + `
CELL = 100
` + pyList('ROOM', ROOM_ROUTE) + `
` + PY_MAP_KIT + `
SC, SR = find("S")
NAMES = {"D": "문", "B": "칠판 앞", "W": "창가"}
STRIDE = 65        # 내 보폭 (cm)
log.set_labels("time", "steps", "heading", "x", "y", timestamp=None)

recording = False
x, y, steps = 0, 0, 0
start_t, start_h = 0, 0
last_tile = "S"
display.show("A")

while True:
    if button_a.was_pressed():               # 출발
        x, y, steps = 0, 0, 0
        start_t = running_time()
        start_h = compass.heading()          # 처음 방향 = 도면 위쪽
        last_tile = "S"
        recording = True
        show_room(x, y)
        print("기록 시작 · 처음 방향", start_h)
    if button_b.was_pressed() and recording: # 도착
        recording = False
        display.show(Image.YES)
        print("기록 끝:", steps, "걸음")
    if recording and is_step(smooth(strength())):
        h = (compass.heading() - start_h) % 360
        x, y, ok = try_move(x, y, h, STRIDE)
        steps += 1
        t = (running_time() - start_t) // 100 / 10
        log.add(time=t, steps=steps, heading=h, x=round(x), y=round(y))
        show_room(x, y)
        here = tile_at(x, y)
        if not ok:
            print("벽에 막힘! (", steps, "걸음 )")
        if here != last_tile and here in NAMES:
            print("지나감:", NAMES[here], "·", steps, "걸음")
        last_tile = here
    if recording and pin_logo.is_touched():  # 현재 위치 표시
        print("지금 위치 x =", round(x), "y =", round(y), "·", steps, "걸음")
        display.show(Image.TARGET)
        sleep(500)
        show_room(x, y)
    sleep(20)`,
            desc: '길어 보이지만 위쪽은 모두 준비된 함수이고, 우리가 조립한 것은 맨 아래 반복문입니다. 반복문은 그림 7-7 의 세 버튼을 그대로 옮긴 것입니다. 걸음이 날 때마다 ① 도면 방위 계산 → ② 벽 검사하며 한 걸음 → ③ <code>log.add()</code> 로 한 줄 저장 → ④ LED 지도 갱신 → ⑤ 칠판 앞 · 창가를 지나면 알림 순서로 일합니다.',
            hint: '가상의 사람을 시작점에서 <b>위쪽(칠판 쪽)</b>을 보게 하고 <b>A</b>. 조이스틱으로 북쪽 4m → 서쪽 3m(칠판 앞) → 서쪽 3m → 남쪽 2m → 서쪽 1m(창가)를 걷고, 칠판 앞과 창가에서 <b>로고</b>를 만진 뒤 마지막에 <b>B</b>. 조이스틱이 없으면 방위각 슬라이더 + 흔들기 제스처로 합니다.',
            expect: '기록 시작 · 처음 방향 0\n…\n지나감: 칠판 앞 · 10 걸음\n지금 위치 x = -260 y = 390 · 10 걸음\n…\n지나감: 창가 · 20 걸음\n지금 위치 x = -715 y = 195 · 20 걸음\n기록 끝: 20 걸음',
            nondeterministic: true
          },
          { type: 'callout', kind: 'tip', title: '기록을 확인하는 방법', html: 'B 를 누른 뒤 <b>📊 로그</b> 탭을 열면 걸음마다 한 줄씩 쌓인 표가 보입니다. x 는 서쪽으로 가서 <b>음수</b>(−260 → −715)가 되고, y 는 북쪽으로 갔다가(390) 남쪽으로 내려오며(195) 줄어드는지 확인합니다. 표를 CSV 로 내려받아 두면 다음 챕터에서 지도 위에 그려 봅니다.' },
          { type: 'callout', kind: 'warn', title: '출발 방향이 틀리면 경로 전체가 돌아갑니다', html: 'A 를 누를 때 칠판 쪽이 아니라 문 쪽을 보고 있었다면, 처음 방향이 90° 틀리게 기억되어 <b>경로 전체가 90° 돌아간 모양</b>으로 저장됩니다. 위치 계산은 맞아도 도면 위에서는 벽 속을 걷게 됩니다. 출발 전에 “칠판 쪽 보기 → A” 를 소리 내어 확인합니다.' },
          { type: 'p', html: '같은 기록기를 <b>파일</b>로 저장하는 방법도 봅니다. A 에서 파일을 열고, 걸음마다 한 줄을 쓰고, B 에서 <b>꼭 닫습니다</b>. 지도 걷기는 빼고 기록 부분만 남겨 짧게 만들었습니다.' },
          {
            type: 'code', title: '응용 7-16. 파일로 저장하는 경로 기록기', code: `from microbit import *
import math

` + PY_STEP_KIT + `
` + PY_MOVE + `
STRIDE = 65
f = None                       # 열린 파일 (없으면 None)
x, y, steps = 0, 0, 0
start_t, start_h = 0, 0
display.show("A")

while True:
    if button_a.was_pressed() and f is None:     # 출발: 파일 열기
        x, y, steps = 0, 0, 0
        start_t = running_time()
        start_h = compass.heading()
        f = open("path.csv", "w")
        f.write("time,steps,heading,x,y\\n")
        display.show(Image.ARROW_N)
        print("기록 시작")
    if button_b.was_pressed() and f is not None: # 도착: 파일 닫기
        f.close()
        f = None
        display.show(Image.YES)
        print("기록 끝:", steps, "걸음 · path.csv 저장")
    if f is not None and is_step(smooth(strength())):
        h = (compass.heading() - start_h) % 360
        x, y = move(x, y, h, STRIDE)
        steps += 1
        t = (running_time() - start_t) // 100 / 10
        f.write("{},{},{},{},{}\\n".format(t, steps, h, round(x), round(y)))
        print(steps, "걸음 · x =", round(x), "y =", round(y))
    sleep(20)`,
            desc: '<code>f</code> 가 <code>None</code> 이면 “기록하지 않는 중”, 파일이면 “기록 중”입니다. 그래서 따로 <code>recording</code> 변수가 필요 없습니다. B 로 <code>f.close()</code> 를 해야 마지막 줄까지 확실히 저장됩니다. 닫기 전에 ■ 중지를 누르면 어떻게 되는지도 실험해 보세요.',
            hint: '<b>A</b> → 조이스틱으로 몇 걸음 → <b>B</b> 를 누른 뒤 <b>💾 파일</b> 탭에서 <code>path.csv</code> 를 확인하세요.',
            expect: '기록 시작\n1 걸음 · x = 0 y = 65\n2 걸음 · x = 0 y = 130\n…\n기록 끝: 8 걸음 · path.csv 저장',
            nondeterministic: true
          },
          {
            type: 'code', title: '더 해 보기 7-17. path.csv 가 잘 저장됐는지 확인하기', code: `from microbit import *

try:
    with open("path.csv") as f:
        lines = f.read().split("\\n")
except OSError:
    lines = []

rows = [ln for ln in lines[1:] if ln]
print("기록한 줄 수:", len(rows))
if rows:
    print("첫 줄:", rows[0])
    print("마지막 줄:", rows[-1])
    last = rows[-1].split(",")
    print("끝점 x =", last[-2], "y =", last[-1])
else:
    print("path.csv 가 없거나 비어 있습니다. 예제 7-14 나 응용 7-16 을 먼저 실행하세요.")`,
            desc: '첫 줄(이름표)을 빼고 줄 수를 세고, 마지막 줄을 쉼표로 잘라 <b>끝점</b>을 꺼냅니다. 파일이 없으면 <code>OSError</code> 가 나므로 <code>try … except</code> 로 잡아 안내 문장을 보여 줍니다. 예제 7-14 를 먼저 실행했다면 아래처럼 나옵니다.',
            expect: '기록한 줄 수: 5\n첫 줄: 1,90,100,0\n마지막 줄: 5,0,300,200\n끝점 x = 300 y = 200'
          },

          { type: 'h', text: '메모리 어림 계산 — 몇 분까지 기록할 수 있을까?' },
          { type: 'p', html: '보드의 저장 공간은 컴퓨터보다 아주 작습니다. 기록을 시작하기 전에 “이 기록기로 몇 분쯤 걸을 수 있을까?”를 <b>어림</b>해 둡니다. 계산은 간단합니다.' },
          { type: 'list', items: [
            '<b>1분에 쓰는 양</b> = 한 줄 크기(바이트) × 1분 동안의 줄 수',
            '<b>기록할 수 있는 시간</b> = 남은 저장 공간 ÷ 1분에 쓰는 양'
          ] },
          {
            type: 'code', title: '예제 7-18. 기록할 수 있는 시간 어림하기', repl: true, code: `len("125.5,320,90,1300,-250\\n")
23 * 110
30000 // 2530
30000 // (23 * 60)`,
            desc: '조금 긴 한 줄(시간 125.5초 · 320걸음 · 위치 4자리)은 줄바꿈까지 <b>23바이트</b>입니다. 걸음마다 저장하고 1분에 110걸음을 걸으면 1분에 <b>2530바이트</b>를 씁니다. 남은 공간이 <b>30000바이트라고 가정</b>하면 약 <b>11분</b>, 1초마다 저장(1분에 60줄)이라면 약 <b>21분</b>입니다.',
            expect: '>>> len("125.5,320,90,1300,-250\\n")\n23\n>>> 23 * 110\n2530\n>>> 30000 // 2530\n11\n>>> 30000 // (23 * 60)\n21'
          },
          { type: 'table', head: ['저장 방법', '1분 동안 줄 수', '1분에 쓰는 양', '30000바이트면'], rows: [
            ['걸음마다 · 걷기 (110걸음/분)', '110줄', '약 2530바이트', '약 11분'],
            ['걸음마다 · 뛰기 (165걸음/분)', '165줄', '약 3800바이트', '약 7분'],
            ['1초마다', '60줄', '약 1380바이트', '약 21분'],
            ['2초마다', '30줄', '약 690바이트', '약 43분']
          ], caption: '표 7-7. 저장 방법에 따른 기록 시간 어림 (30000바이트는 계산을 위한 가정)' },
          { type: 'callout', kind: 'board', title: '실제 보드에서는', html: '실제로 남은 저장 공간은 보드에 이미 있는 파일 · 기록에 따라 달라집니다. 또 log 모듈은 표의 머리 등 조금 더 많은 공간을 씁니다. 그래서 어림한 시간의 <b>절반쯤</b>만 믿고, 실험 전에 이전 기록을 꺼내 둔 뒤 지우고 시작합니다. 교실 경로처럼 몇 분 안에 끝나는 기록은 걸음마다 저장해도 넉넉합니다.' },
          { type: 'callout', kind: 'more', title: '더 알아보기 — 줄을 짧게 만드는 방법', html: '같은 공간에 더 오래 기록하고 싶다면 한 줄을 짧게 만듭니다. 위치를 cm 대신 <b>10cm 단위</b>로 저장하면 숫자가 한 자리 줄고, 시간을 0.1초 대신 <b>초 단위</b>로 저장하면 소수점이 빠집니다. 방위각을 저장하지 않는 방법도 있지만, 그러면 나중에 원인을 찾기 어려워집니다.' },

          { type: 'h', text: '토론 · 실험 계획표' },
          { type: 'p', html: '다음 시간에는 기록한 경로를 지도 위에 그려 봅니다. 그 전에, 실제 보드로 실험한다면 누가 무엇을 할지 모둠별로 <b>실험 계획표</b>를 만듭니다. 계획 없이 걸으면 “누가 A 를 눌렀지?”, “어느 길로 걸었지?”를 나중에 알 수 없습니다.' },
          { type: 'table', head: ['정할 것', '예시', '우리 모둠'], rows: [
            ['보드를 드는 사람 · 기록하는 사람', '민지: 걷기 · 준호: 시간과 사건 적기', ''],
            ['보드를 붙이는 곳', '가슴 (목걸이 줄 + 받침, 수평)', ''],
            ['시작점과 출발 방향', '문 옆 S 칸 · 칠판 쪽 보고 A', ''],
            ['걸을 경로', '문 → 칠판 앞 → 창가 (그림 7-8)', ''],
            ['몇 번 걸을지', '같은 경로 3번 · 매번 log 내려받기', ''],
            ['목표 지점에서 할 일', '칠판 앞 · 창가에서 로고 터치', ''],
            ['안전 · 정리', '복도에서 뛰지 않기 · 끝나면 log 지우기', '']
          ], caption: '표 7-8. 실험 계획표 — 공책에 옮겨 적어 씁니다' },
          { type: 'list', items: [
            '💬 같은 경로를 왜 한 번이 아니라 세 번 걸어야 할까요?',
            '💬 보드를 든 사람이 걸음을 셀 때마다 화면을 보면 어떤 문제가 생길까요? (보드가 기울어 방향이 틀어짐 — ch06)',
            '💬 기록하는 사람이 “칠판 앞 도착 12초” 처럼 따로 적어 두면, 나중에 log 표와 어떻게 비교할 수 있을까요?'
          ] },
          { type: 'callout', kind: 'tip', title: '2교시 정리', html: '경로 기록 한 줄 = 시간 · 걸음 수 · 방위각 · x · y. 실내 경로는 <b>걸음마다</b> 저장이 모퉁이를 잘 남깁니다. <code>log</code> 모듈(안전) 또는 <code>open("path.csv", "w")</code>(닫기 필수)로 저장하고, A 출발 · B 도착 · 로고 위치 표시로 기록 흐름을 정했습니다. 한 줄 크기 × 줄 수로 기록 시간을 어림했습니다.' }
        ],
        slides: [
          { layout: 'title', title: '이동 경로 저장하기', subtitle: 'Chapter 07 · 가상 공간 설계와 경로 기록', badge: '2교시', notes: '<p>지난 시간에 저장한 도면을 다시 불러오게 합니다. “어제 걸은 길을 오늘 다시 그릴 수 있을까요?”로 시작합니다.</p><p>시간: 1분</p>' },
          { layout: 'bullets', title: '생각하기 — 무엇을, 얼마나 자주?', bullets: ['모퉁이마다: 몇 걸음 · 어느 쪽', '정해진 시간마다: 지금 어디쯤', '둘 다 쓸모 있음 → 오늘 비교'], notes: '<p>학생들의 메모 방법을 “모퉁이마다 / 시간마다”로 칠판에 나눠 적습니다.</p><p>💬 “1분마다 메모하면 어떤 길을 놓칠까요?” — 1분 안에 꺾은 모퉁이.</p><p>시간: 4분</p>' },
          { layout: 'diagram', title: '기록 한 줄 = 다섯 가지 값', html: FIG_ROW, caption: 'time · steps · heading · x · y', notes: '<p>x · y 만 있으면 점은 찍지만, 나머지 셋은 “왜 거기 있었나”를 알려 준다는 점을 강조합니다.</p><p>예제 7-10 으로 CSV 한 줄(17글자)을 만들어 봅니다.</p><p>💬 “x · y 는 나중에 계산할 수도 있는데 왜 저장할까요?” — 바로 그리기 편하고, 보드의 계산을 남기려고.</p><p>시간: 6분</p>' },
          { layout: 'diagram', title: '걸음마다 vs 1초마다', html: FIG_WHEN, caption: '같은 60초 — 80줄 vs 60줄', notes: '<p>예제 7-11 을 실행해 줄 수를 확인합니다.</p><p>💬 “멈춰 있던 20초는 걸음마다 기록에서 어떻게 보일까요?” — 줄이 없고, 시간 칸이 20초 건너뛴다.</p><p>시간: 3분</p>' },
          { layout: 'table', title: '저장 시점 장단점', head: ['', '걸음마다', '1초마다'], rows: [['모퉁이', '또렷함', '뭉툭할 수 있음'], ['멈춤', '줄 없음', '같은 위치 쌓임'], ['뛸 때', '줄이 많아짐', '늘 같음'], ['어울리는 곳', '실내 경로', '러닝 기록']], lead: '이 강좌의 경로 기록기 = 걸음마다', notes: '<p>ch05 러닝 기록기는 왜 1초마다였는지 떠올리게 합니다 — 속도 · 케이던스 그래프는 시간 축이 고른 것이 좋다.</p><p>시간: 3분</p>' },
          { layout: 'code', title: 'log 로 걸음마다 저장', code: `from microbit import *
import log

log.set_labels("time", "steps", "x", timestamp=None)
steps = 0
start = running_time()

while True:
    if button_a.was_pressed():       # 동쪽으로 한 걸음
        steps += 1
        t = (running_time() - start) // 100 / 10
        log.add(time=t, steps=steps, x=steps * 100)
        print("저장:", t, steps, steps * 100)
    sleep(20)`, points: ['<code>set_labels</code> = 이름표 한 번', '<code>log.add</code> = 걸음마다 한 줄', '📊 로그 탭에서 확인 · 🗑 지우기'], notes: '<p>슬라이드용으로 줄인 코드입니다(동쪽으로만 걷기). 실행 후 A 를 몇 번 눌러 📊 로그 탭을 보여 줍니다.</p><p>본문의 예제 7-12(방향 포함) · 7-13(1초마다)을 학생들이 직접 비교하게 합니다.</p><p>시간: 5분</p>' },
          { layout: 'code', title: '또는 파일로 — path.csv', code: `from microbit import *

with open("path.csv", "w") as f:
    f.write("steps,x,y\\n")
    for s in range(1, 4):
        f.write("{},{},{}\\n".format(s, s * 100, 0))

with open("path.csv") as f:
    print(f.read())`, points: ['<code>"w"</code> = 지우고 새로 쓰기', '줄 끝마다 <code>\\n</code>', '<code>with</code> 가 끝나면 저절로 닫힘', '💾 파일 탭에서 확인'], notes: '<p>실행 후 💾 파일 탭에서 path.csv 를 엽니다.</p><p>💬 “log 와 파일 중 실제로 걸을 때는 무엇이 안전할까요?” — log. 전원이 꺼져도, 프로그램을 다시 올려도 남는다.</p><p>시간: 4분</p>' },
          { layout: 'diagram', title: '기록 흐름 버튼', html: FIG_BTN, caption: 'A 출발 · B 도착 · 로고 위치', notes: '<p>A 를 누를 때 “처음 방향”을 기억하는 까닭을 1교시의 MAP_UP 과 연결합니다.</p><p>💬 “A 를 누를 때 문 쪽을 보고 있었다면?” — 경로 전체가 90° 돌아간다.</p><p>시간: 3분</p>' },
          { layout: 'diagram', title: '오늘의 경로', html: FIG_ROUTE, caption: '문 → 칠판 앞 → 창가', notes: '<p>예제 7-15(경로 기록기)를 실행하고, 조이스틱으로 경로를 따라 걷는 것을 시연한 뒤 학생들이 직접 해 보게 합니다.</p><p>칠판 앞 · 창가에서 로고를 만지고, 끝나면 B → 📊 로그 탭 확인 → CSV 내려받기까지 합니다.</p><p>빨리 끝난 학생은 응용 7-16(파일 버전)과 7-17(확인)을 합니다.</p><p>시간: 12분</p>' },
          { layout: 'table', title: '몇 분까지 기록할 수 있을까?', head: ['저장 방법', '1분에 쓰는 양', '30000바이트면'], rows: [['걸음마다 · 걷기', '약 2530바이트', '약 11분'], ['걸음마다 · 뛰기', '약 3800바이트', '약 7분'], ['1초마다', '약 1380바이트', '약 21분']], lead: '한 줄 크기 × 줄 수 (30000 은 가정)', notes: '<p>예제 7-18(셸)로 함께 계산합니다.</p><p>30000바이트는 계산을 위한 가정이며 실제 남은 공간은 보드마다 다르다는 점을 분명히 합니다.</p><p>💬 “더 오래 기록하려면?” — 줄을 짧게, 덜 자주.</p><p>시간: 5분</p>' },
          { layout: 'bullets', title: '토론 · 실험 계획표', bullets: ['누가 들고 · 누가 적나', '어디에 붙이나 (수평으로)', '시작점 · 출발 방향', '어느 경로를 몇 번', '목표에서 로고 · 끝나면 log 정리'], notes: '<p>모둠별로 표 7-8 을 공책에 채우게 합니다.</p><p>💬 “왜 세 번 걸을까요?” — 한 번은 우연일 수 있다. 비슷한지 비교.</p><p>복도 실험은 안전(뛰지 않기)을 꼭 강조합니다.</p><p>시간: 5분</p>' },
          { layout: 'summary', title: '2교시 정리', bullets: ['한 줄 = time · steps · heading · x · y', '실내 경로는 걸음마다 저장', '<code>log</code> (안전) · <code>open()</code> (닫기 필수)', 'A 출발 · B 도착 · 로고 위치', '한 줄 크기 × 줄 수로 기록 시간 어림'], notes: '<p>오늘 내려받은 CSV 를 잘 보관하게 합니다(다음 챕터에서 지도로 그림).</p><p>다음 시간 “생각하기”: 기록한 경로를 도면 위에 그렸더니 벽을 뚫고 지나간다면, 무엇이 잘못된 걸까요? 를 안내합니다.</p><p>시간: 2분</p>' }
        ]
      }
    ]
  });
})();
